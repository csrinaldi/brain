#!/usr/bin/env node
// brain-audit.mjs — audit merged commits for governance invariants (REQ-S4-5, REQ-S4-6).
//
// Usage: node brain/scripts/brain-audit.mjs [<git-range>]
// Default range: origin/main..HEAD (falls back to HEAD if origin/main is absent).
//
// For each first-parent merge in the range, runs all 4 generic checks:
//   diffSize · issueLink · adrPresence · memoryPresence
//
// Two net-parity skips (design §15, anchored to the NET tree state at HEAD):
//   • resolved-skip  — a merge whose own first-parent contribution is NET-ABSENT
//     at HEAD (`isResolvedAt`, directional net-parity) is skipped BEFORE the four
//     checks run: `[SKIP] … resolved by revert`.
//   • reverter-skip  — a FAILING merge is exempt from its TREE-KEYED failures
//     only (adrPresence/diffSize; issueLink/memoryPresence always survive) iff
//     every path it ADDS OR MODIFIES is absent from the tree at the audited tip
//     (`addedPathsAbsentAt`, the liveness guard) AND its own contribution is
//     net-absent across the full window (`netAddFull ≤ 0`). A tip-most cleanup
//     revert that only DELETES touches no surviving path, so it settles without
//     itself being flagged; a merge
//     that puts a payload back on the tree — a revert-of-a-revert, or a re-add
//     of a payload first introduced BEHIND the window base — stays flagged.
//
// Output (one line per merge):
//   [PASS] <sha7> <subject>
//   [FAIL] <sha7> <subject> — <check>: <reason>; ...
//   [FAIL-SHA] <full-sha>            (auto-revert signal — tree-keyed classes ONLY)
//   [SKIP] <sha7> <subject> — resolved by revert | reverts offender (net-absent)
//   [UNCOMPUTABLE] <sha7> <subject> — PR metadata unreachable (REQ-TS-1, #474)
//
// Exit (fail-closed, REQ-D2-6): 0 all pass/legitimately skipped · 1 ≥1 [FAIL]
// (any class) · 2 uncomputable-infra (never a silent PASS).
//
// UNCOMPUTABLE DOMINATES (REQ-TS-2, issue #474). A merge whose PR-metadata
// fetch FAILED is not evaluated at all — evaluating it is what manufactures a
// false verdict — and ≥1 such merge drives the whole window to exit 2,
// regardless of the other merges' verdicts. This is exit-codes.mjs's own rule
// ("an uncomputable check must never read as clean or as a mere violation")
// applied at window scope: advancing the cursor past a merge that was never
// evaluated would make it permanently un-re-auditable (ADR-0015 rung 3). The
// halt self-heals — the postmerge workflow retries on every push and daily.
//
// NOT uncomputable, deliberately: a subject with no PR reference (nothing to
// fetch; the commit body IS the evidence) and an unconfigured VCS adapter (a
// configuration, uniform and therefore visible — surfaced as one [WARN]).

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { isAfterBaseline, selectIssueLinkBody } from './lib/audit-helpers.mjs';
import { readRecordObservations } from './memory/lib/store.mjs';
import { makeGit } from './governance/postmerge/resolution.mjs';
// The first-parent merge walk (EVIDENCE + VERDICT layers) is SHARED with
// brain-metrics — see lib/merge-walk.mjs's module header (design D1, issue
// #324). Emission ([PASS]/[FAIL]/[SKIP], [FAIL-SHA] dedup, crossCheckExit)
// stays local: it is a judgment about how to REPORT a verdict, not the
// verdict itself.
//
// NOTE (MINOR 2, external ruling rev 3 on #297): there is deliberately NO
// error-swallowing `git()` helper anywhere in the walk. The per-merge reads
// (numstat, changed files, commit body, parents) go through `gitOrThrow`
// (lib/merge-walk.mjs), so a transient git failure becomes exit 2 at the
// top-level catch below instead of an EMPTY diff that makes diffSize and
// adrPresence PASS. A source-scan test in brain-audit.test.mjs keeps the
// helper from returning (re-pointed at lib/merge-walk.mjs, issue #324 Phase 2).
import {
  resolvedSkipLine, listMerges, readMergeParent, readMergeDiff, fetchPrMeta, resolveVcs, evaluateMerge,
  resolveBaseline, makeGitIsAncestor, countUnauditedNonMerges,
} from './lib/merge-walk.mjs';
// Tier resolution (issue #358 Q5, REQ-TIER-9): the audit path is the rung-2/
// rung-3 enforcement surface (release.yml's pre-tag gate, governance-postmerge.yml's
// auto-revert) — it MUST resolve the SAME tier-scoped diff budget and
// size:exception policy as the CI/hook path (run-check.mjs), never its own
// silent 400-line default.
import { resolveTier, tierParams } from './vcs/governance-tiers.mjs';

/**
 * REQ-D2-6(b) / design §15.5 — the fail-closed exit contract, with `failCount`
 * (human-readable `[FAIL]` lines of ANY class) DECOUPLED from the `[FAIL-SHA]`
 * (auto-revert) count now that emission is class-filtered:
 *
 *   • exit 1 ⟺ failCount ≥ 1 (any class). A `[FAIL-SHA]` count of 0 on exit 1 is
 *     LEGITIMATE (all violations are issueLink/memoryPresence — non-auto-revertible).
 *   • The old "any violation ⟹ ≥1 [FAIL-SHA]" coherence guard is REPLACED (not
 *     dropped) by the BIDIRECTIONAL NOMINABLE⟺[FAIL-SHA] invariant: ≥1 NOMINABLE
 *     tree-keyed failure ⟺ ≥1 [FAIL-SHA] line. A violation of EITHER direction is
 *     uncomputable → exit 2: (i) a nominable failure recorded but zero [FAIL-SHA]
 *     emitted (a crash mid-emission); (ii) a [FAIL-SHA] with no backing nominable
 *     failure. (A guard relaxed without a replacement is a guard deleted.)
 *
 *   • WHY "NOMINABLE", NOT "tree-keyed" (PR4 precondition, #302). Not every
 *     un-exempted tree-keyed failure is auto-revert-nominable: a removal-shaped
 *     cleanup (A11) or a replace-shaped cleanup (A12) fails a tree-keyed check,
 *     is (correctly) denied the exemption, yet is SUPPRESSED from [FAIL-SHA]
 *     because reverting it would RESURRECT a payload (§15.5). Those survivors
 *     legitimately emit `[FAIL]` (counted in failCount) with zero `[FAIL-SHA]`.
 *     So the coherence invariant re-anchors from "tree-keyed" to "nominable"
 *     (tree-keyed survivors whose revert does NOT resurrect); the old form would
 *     fire a spurious exit 2 the moment a cleanup is suppressed. `failCount`
 *     still governs exit 1 — a suppressed cleanup is a real [FAIL].
 *
 * @param {number} failCount               merges reported as [FAIL] (any class).
 * @param {number} nominableTreeKeyedCount tree-keyed survivors whose revert does NOT
 *                                         resurrect a payload (auto-revert-nominable).
 * @param {number} failShaCount            [FAIL-SHA] lines emitted (deduped carriers).
 * @returns {0|1|2}
 */
export function crossCheckExit(failCount, nominableTreeKeyedCount, failShaCount) {
  // Bidirectional NOMINABLE ⟺ [FAIL-SHA] coherence. Newest-carrier dedup keeps
  // ≥1 emission per payload, so nominableTreeKeyedCount>0 ⟹ failShaCount>0 always
  // holds on the healthy path; a mismatch is a genuine mid-emission crash.
  const nominable = nominableTreeKeyedCount > 0;
  const emitted = failShaCount > 0;
  if (nominable !== emitted) return 2;
  return failCount > 0 ? 1 : 0;
}

/**
 * Payload-signature grouping key for the newest-carrier [FAIL-SHA] dedup ONLY —
 * NOT a security predicate. The security-critical resolution/exemption
 * comparisons all run inside `resolution.mjs`'s `normDiff` (which is
 * module-private and frozen for this PR — hence this thin mirror). It reproduces
 * that pinned command byte-for-byte so two DISTINCT payloads never collapse to
 * one key.
 *
 * RISK DIRECTION (corrected — the original note here was INVERTED, and the
 * inversion is the reason this comment is now this long). Drift COARSER does NOT
 * yield a harmless EXTRA [FAIL-SHA]: a coarser signature collides two distinct
 * payloads onto ONE dedup key, so the second payload's [FAIL-SHA] is SUPPRESSED
 * — a MISSED emission, fail-open for PR4's consumer. `crossCheckExit` compares
 * booleans (`> 0`), so it can never detect a partial suppression. Today the
 * mirror is byte-identical to `normDiff` (no live exploit) and it is FENCED by
 * the SIG drift-guard source-scan test in brain-audit.test.mjs, which reddens on
 * any divergence. See openspec/changes/issue-259-d2/brain-drafts/local-mirror-of-a-frozen-pin.md.
 *
 * This mirror is accepted for PR3 ONLY (external ruling rev 3, #297): exporting
 * a signature helper from resolution.mjs is the single-source-of-truth fix, but
 * it reopens the PR2b-frozen export surface, which is the owner's keystroke —
 * routed to the owner's backlog as the fast-follow. The mirror never decides
 * exempt/resolved: every security-critical comparison stays in resolution.mjs.
 */
const SIG_CONFIG = ['-c', 'diff.algorithm=myers', '-c', 'diff.renames=false', '-c', 'core.attributesFile=/dev/null'];
const SIG_ARGS = ['diff', '--no-textconv', '--no-ext-diff', '--no-renames', '--binary', '-U3'];
function payloadSignature(resolutionGit, sha) {
  const raw = resolutionGit.orThrow([...SIG_CONFIG, ...SIG_ARGS, `${sha}^1`, sha]);
  return raw
    .split('\n')
    .filter((line) => !/^@@ /.test(line) && !/^index /.test(line))
    .join('\n');
}

/** Load the full brain.config.json; returns {} on any error (never throws). */
function loadConfig(cwd) {
  try {
    return JSON.parse(readFileSync(join(cwd, 'brain.config.json'), 'utf8'));
  } catch {
    return {};
  }
}

function resolveRange(cwd) {
  const arg = process.argv[2];
  if (arg) return arg;
  try {
    execSync('git rev-parse origin/main', { encoding: 'utf8', cwd, stdio: 'pipe' });
    return 'origin/main..HEAD';
  } catch {
    return 'HEAD';
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Wrap in an async IIFE so we can await VCS calls (best-effort PR label fetch).
  (async () => {
    const cwd = process.cwd();
    const range = resolveRange(cwd);
    const config = loadConfig(cwd);
    const ignoreList = Array.isArray(config?.governance?.ignoreList)
      ? config.governance.ignoreList
      : [];
    // REQ-TIER-9: one source for the diff-size budget and the size:exception
    // waiver policy. `resolveTier` defaults to `standard` (REQ-TIER-10) when
    // `governance.tier` is absent, so an un-migrated config keeps auditing at
    // the exact pre-tier 400-line/honored-waiver behaviour.
    const tier = resolveTier(config);
    const { diffBudget, honorSizeException } = tierParams(tier);

    // ── Audit baseline (optional) ────────────────────────────────────────────
    // When governance.auditBaseline is set, only merges that are "after" that
    // ref are audited.  Merges before it are skipped as pre-baseline without
    // failing the audit.  This lets teams adopt governance incrementally.
    // `resolveBaseline`/`makeGitIsAncestor` are SHARED with brain-metrics (design
    // D1, lib/merge-walk.mjs) — before issue #324's fix round, brain-metrics had
    // no baseline awareness at all and silently diverged from this decision.
    const rawBaseline = config?.governance?.auditBaseline ?? null;
    const { ref: baseline, warning: baselineWarning } = resolveBaseline(rawBaseline, cwd);
    if (baselineWarning) process.stderr.write(`${baselineWarning}\n`);
    const gitIsAncestor = baseline ? makeGitIsAncestor(cwd) : null;
    const resolutionGit = makeGit(cwd);

    // ── VCS adapter for size:exception label check (best-effort) ────────────
    // If the adapter is unavailable or misconfigured, audit runs without the
    // size:exception bypass — never crash on a missing VCS config.
    const vcs = await resolveVcs(config);
    // REQ-TS-3 (#474): an unconfigured adapter is a deliberate CONFIGURATION,
    // not an outage — it degrades issueLink to commit-body evidence uniformly
    // across every merge, so it is visible rather than selective, and it must
    // not fail the window closed (that would break every consumer repo running
    // brain:audit without a VCS adapter). But it must not be SILENT either:
    // one [WARN] for the run, never one per merge.
    if (!vcs) {
      console.log('[WARN] no VCS adapter configured — issueLink falls back to commit-body evidence '
        + 'for every merge; PR descriptions are not read. This is a configuration state, not a fetch failure.');
    }

    // Read the on-disk .memory/records/ ONCE (repo-level, not per-merge): the same
    // observations are passed to memoryPresence for every merge. Best-effort — a
    // missing/corrupt/schema-drifted record yields fewer observations, never a crash.
    const allObservations = readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') });

    // --first-parent: audit only the INTEGRATION merges that landed on the audited
    // branch (e.g. main), NOT the nested slice merges inside a feature branch.
    // Nested slice merges legitimately carry "Part of #N" bodies and no per-slice
    // memory — auditing them produces false failures.  The integration merge (the
    // one that actually landed on main) is the canonical governance checkpoint.
    //
    // Range-load via the throwing seam (salvaged R-2 exit-2 site, re-derived
    // against git-seam.mjs — never cherry-picked; design §8): a throwing call
    // distinguishes "git could not compute the range" (infra → exit 2) from
    // "the range genuinely has zero merges" (→ exit 0, below).
    let walk;
    try {
      walk = listMerges(range, cwd);
    } catch (err) {
      console.log(`[FAIL] governance:audit-uncomputable — could not compute merge range ${range}: ${err.message}`);
      process.exit(2);
    }
    // #518 residual (2) — SAY WHAT WAS NOT LOOKED AT.
    //
    // The walk enumerates `--first-parent --merges`. A squash merge lands as a
    // single-parent commit, so it is never in the audited set — and on a clean
    // window the cursor then advances past it, permanently. Until the walk is
    // widened (#518, a design change: the exemption model keys on `sha^1..sha`,
    // which for a linear commit is just its own diff), the honest thing the audit
    // can do is stop reporting a window clean without saying how much of it it
    // never read.
    //
    // Advisory ONLY. It does not touch the verdict, the exit code or the cursor.
    // Making it fail would halt the cursor on 33 commits of existing history and
    // turn `cursor.mjs accept` into routine — the erosion #518 already names.
    const skipped = countUnauditedNonMerges(range, cwd);
    if (skipped === null) {
      console.log('[WARN] could not count the first-parent commits this audit does not enumerate — '
        + 'coverage over this window is unknown (#518)');
    } else if (skipped > 0) {
      console.log(`[WARN] ${skipped} first-parent commit(s) in this range are NOT merges and were NOT audited `
        + '— squash/rebase merges are invisible to `--first-parent --merges`, and the cursor advances past them '
        + '(#518). This window is reported over the merges only.');
    }

    if (walk.merges.length === 0) {
      console.log(`[INFO] No merge commits found in range: ${range}`);
      process.exit(0);
    }
    const { merges, windowFrom, windowTo } = walk;

    let failCount = 0;          // [FAIL] lines of ANY class — governs exit 1.
    let nominableTreeKeyedCount = 0; // tree-keyed survivors whose revert does NOT resurrect a payload (auto-revert-nominable, §15.5).
    let failShaCount = 0;       // [FAIL-SHA] lines actually emitted (deduped).
    let uncomputableCount = 0;  // merges whose PR-metadata fetch FAILED (REQ-TS-1/-2) — dominates the exit code.
    const emittedSignatures = new Set(); // payload signatures already carried by a [FAIL-SHA].

    for (const { sha, subject } of merges) {
      // ── Baseline gate ────────────────────────────────────────────────────
      // Skip merges that pre-date the baseline ref (not an audit failure).
      if (baseline) {
        const after = isAfterBaseline(baseline, sha, gitIsAncestor);
        if (!after) {
          console.log(`[SKIP] ${sha.slice(0, 7)} ${subject} — before audit baseline`);
          continue;
        }
      }

      // ── Resolved-by-revert pre-evaluation skip (REQ-D2-10, design §15.3) ──
      // Runs BEFORE the four checks, symmetric to the baseline skip above. A
      // genuinely settled offender (payload net-absent at HEAD) is skipped
      // wholesale — including memoryPresence.
      const resolvedLine = resolvedSkipLine(sha, subject, { git: resolutionGit, tip: windowTo });
      if (resolvedLine) {
        console.log(resolvedLine);
        continue;
      }

      // MINOR 2 — the THROWING seam (lib/merge-walk.mjs): a transient git
      // failure is exit 2 at the top-level catch, never an empty diff that
      // silently PASSes diffSize and adrPresence. A missing parent1 (design
      // §5) also throws — never a silent [SKIP].
      const parent1 = readMergeParent(sha, subject, cwd);
      const { numstat, changedFiles, addedFiles, body } = readMergeDiff(parent1, sha, cwd);

      // ── Best-effort PR metadata fetch (single call for labels + body) ─────
      // Any failure (VCS unconfigured, adapter error, no PR number found)
      // leaves both null (uncomputable — REQ-CIC-2) and falls back to
      // commit-body behavior. NEVER crash, and NEVER collapse a
      // fetched-but-null value back into a fabricated [] / '' default —
      // shouldSkipSize()/selectIssueLinkBody() already treat null as "no
      // evidence" correctly; re-fabricating an empty default here would
      // re-introduce the exact fail-open the seam removes, just on a
      // parallel path (prView fix-at-source disposition).
      const { prNum, prLabels, prBody, prAuthor, prReviews, prMetaError } = await fetchPrMeta(subject, vcs, config);

      // ── Uncomputable merge (REQ-TS-1/-2, issue #474) ─────────────────────
      // The PR fetch was ATTEMPTED and FAILED. Do NOT evaluate this merge:
      // running the four checks over evidence the evaluator could not read is
      // exactly what manufactures a false verdict — selectIssueLinkBody would
      // fall back to the auto-generated merge commit body and issueLink would
      // report a confident FAIL for a PR whose body it never saw (#467).
      //
      // This merge is counted, not skipped: `uncomputableCount` DOMINATES the
      // exit code below, per governance/postmerge/exit-codes.mjs — "an
      // uncomputable check must never read as clean or as a mere violation".
      // Advancing the cursor past a merge that was never evaluated would make
      // it permanently un-re-auditable (ADR-0015 rung 3), so the whole window
      // fails closed rather than the merge being silently dropped.
      if (prMetaError !== null) {
        uncomputableCount += 1;
        console.log(`[UNCOMPUTABLE] ${sha.slice(0, 7)} ${subject} — PR #${prNum} metadata unreachable: ${prMetaError}`);
        continue;
      }

      // Use the PR description for issueLink when available (it contains the
      // actual Closes/Part of #N reference).  Fall back to the raw commit body
      // when the PR description is absent or empty.
      const issueLinkBody = selectIssueLinkBody(prBody, body);

      const rec = evaluateMerge(sha, {
        numstat, changedFiles, addedFiles, issueLinkBody, prLabels, ignoreList, allObservations,
        prReviews, prAuthor, prResolved: prNum !== null && !prMetaError,
        botAllowlist: config?.governance?.reviewActors ?? [],
        resolutionGit, windowFrom, windowTo,
        diffBudget, honorSizeException, tier,
      });

      if (rec.kind === 'pass') {
        const sizeNote = rec.sizeSkipped ? ' [size:exception]' : '';
        console.log(`[PASS] ${sha.slice(0, 7)} ${subject}${sizeNote}`);
        continue;
      }

      if (rec.kind === 'reverter-skip') {
        // Every failure was a tree-keyed failure the net-parity exemption covers.
        console.log(`[SKIP] ${sha.slice(0, 7)} ${subject} — reverts offender (net-absent at HEAD)`);
        continue;
      }

      // ── [FAIL] (any surviving class) — governs exit 1 ────────────────────
      failCount += 1;
      const survivingNames = rec.surviving.map(([name]) => name);
      let reasons = rec.surviving.map(([name, r]) => `${name}: ${r.reason}`).join('; ');
      // adrPresence is the one class with NO automatic forward-fix path
      // (REQ-D2-10a): append the human-gate remediation so the [FAIL] line is
      // self-documenting (design §15.6a).
      if (survivingNames.includes('adrPresence')) {
        reasons += ` — resolve by reverting ${sha.slice(0, 7)}, or: `
          + `node brain/scripts/governance/postmerge/cursor.mjs accept ${sha} `
          + `--reason "<why the ungoverned ADR is accepted>"`;
      }
      console.log(`[FAIL] ${sha.slice(0, 7)} ${subject} — ${reasons}`);

      // ── [FAIL-SHA] (auto-revert signal) — class-filtered + newest-carrier
      // dedup (design §15.5, REQ-D2-3). Emitted ONLY for a surviving un-exempted
      // TREE-KEYED failure that is auto-revert-nominable (rec.nominable, from
      // lib/merge-walk.mjs's evaluateMerge — `!revertResurrectsAt(...)`), and
      // ONLY for the newest carrier of each payload signature (git log is
      // newest-first, so the first-seen carrier is the newest). Older carriers
      // stay [FAIL] but emit no auto-revert signal, so PR4 reverts the live
      // carrier once — never O AND R2, never the intermediate legit reverter.
      // issueLink/memoryPresence-only merges emit nothing here.
      if (rec.nominable) {
        nominableTreeKeyedCount += 1;
        const sig = payloadSignature(resolutionGit, sha);
        if (!emittedSignatures.has(sig)) {
          emittedSignatures.add(sig);
          console.log(`[FAIL-SHA] ${sha}`);
          failShaCount += 1;
        }
      }
    }

    // ── Uncomputable DOMINATES (REQ-TS-2, issue #474) ───────────────────────
    // Decided HERE, deliberately OUTSIDE `crossCheckExit`: that function's
    // contract is the NOMINABLE⟺[FAIL-SHA] emission-coherence invariant over a
    // window that was fully evaluated, and folding a "could not evaluate" term
    // into it would conflate an emission bug with an evidence outage — the two
    // states this change exists to separate. `crossCheckExit`'s signature and
    // semantics are unchanged (REQ-TS-6).
    if (uncomputableCount > 0) {
      console.log(`[FAIL] governance:audit-uncomputable — ${uncomputableCount} merge(s) could not be evaluated: `
        + 'their PR metadata was unreachable, so no governance verdict was rendered for them. '
        + 'NOT a violation — the evaluator could not read its evidence. '
        + 'The cursor stays pinned; re-running once the API is reachable clears this '
        + '(the postmerge workflow retries on every push and daily via cron). '
        + 'If this is a local run, `gh auth login` is the usual fix.');
      process.exit(2);
    }

    const exitCode = crossCheckExit(failCount, nominableTreeKeyedCount, failShaCount);
    if (exitCode === 2) {
      console.log('[FAIL] governance:audit-uncomputable — tree-keyed⟺[FAIL-SHA] coherence violated '
        + `(failCount=${failCount}, nominableTreeKeyedCount=${nominableTreeKeyedCount}, failShaCount=${failShaCount})`);
    }
    process.exit(exitCode);
  })().catch(err => {
    // REQ-D2-12 / design §5: no error path produces a PASS/violation verdict.
    // The message is written to STDOUT (captured by the wrapper), never stderr,
    // and exit is 2 — never 1 or 0.
    console.log(`[FAIL] governance:audit-uncomputable — ${err.message}`);
    process.exit(2);
  });
}
