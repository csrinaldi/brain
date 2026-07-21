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
//     every path it ADDS is absent from the tree at the audited tip
//     (`addedPathsAbsentAt`, the liveness guard) AND its own contribution is
//     net-absent across the full window (`netAddFull ≤ 0`). A tip-most cleanup
//     revert adds nothing, so it settles without itself being flagged; a merge
//     that puts a payload back on the tree — a revert-of-a-revert, or a re-add
//     of a payload first introduced BEHIND the window base — stays flagged.
//
// Output (one line per merge):
//   [PASS] <sha7> <subject>
//   [FAIL] <sha7> <subject> — <check>: <reason>; ...
//   [FAIL-SHA] <full-sha>            (auto-revert signal — tree-keyed classes ONLY)
//   [SKIP] <sha7> <subject> — resolved by revert | reverts offender (net-absent)
//
// Exit (fail-closed, REQ-D2-6): 0 all pass/legitimately skipped · 1 ≥1 [FAIL]
// (any class) · 2 uncomputable-infra (never a silent PASS).

import { execSync, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { diffSize } from './governance/checks/diff-size.mjs';
import { issueLink } from './governance/checks/issue-link.mjs';
import { adrPresence } from './governance/checks/adr-presence.mjs';
import { memoryPresence } from './governance/checks/memory-presence.mjs';
import { getVcs } from './vcs/cli.mjs';
import { parsePrNumber, shouldSkipSize, isAfterBaseline, selectIssueLinkBody, auditedTip } from './lib/audit-helpers.mjs';
import { readRecordObservations } from './memory/lib/store.mjs';
import { gitOrThrow } from './governance/postmerge/git-seam.mjs';
// COMPOSE the frozen net-parity primitives (design §15, PR2b). NEVER import the
// retired direction-blind pairwise `isReverterOf` — a no-import drift-guard test
// (brain-audit.test.mjs) asserts it never reappears in this file.
import { isResolvedAt, netAddFull, addedPathsAbsentAt, makeGit } from './governance/postmerge/resolution.mjs';

// NOTE (MINOR 2, external ruling rev 3 on #297): there is deliberately NO
// error-swallowing `git()` helper here. The per-merge reads (numstat,
// changed files, commit body, parents) go through `gitOrThrow`, so a transient
// git failure becomes exit 2 at the top-level catch instead of an EMPTY diff
// that makes diffSize and adrPresence PASS. Returning '' on failure was a
// silent fail-open inside the one slice whose thesis is "never a silent PASS" —
// which it already enforced for the range-load and the missing-parent paths.
// A source-scan test in brain-audit.test.mjs keeps the helper from returning.

/**
 * The subset of the four checks whose PASS/FAIL verdict is a pure function of
 * the commit's TREE (changed paths / the diff itself) — as opposed to its
 * commit/PR body (`issueLink`, free text) or repo-global state at HEAD
 * (`memoryPresence`). Only a tree-keyed check can be causally mirrored by a
 * commit's contribution being the net-inverse of an offender's, so ONLY these
 * classes are ever exempted by the reverter-skip and ONLY these emit the
 * `[FAIL-SHA]` auto-revert signal (design §15.5, REQ-D2-10a).
 */
export const TREE_KEYED_CHECKS = new Set(['adrPresence', 'diffSize']);

/**
 * Pre-evaluation resolved-skip (design §3.5/§15.3, REQ-D2-10): a merge whose own
 * first-parent contribution is NET-ABSENT at HEAD under exact-normDiff net-parity
 * accounting is skipped BEFORE any of the four checks run — including
 * memoryPresence. `isResolvedAt` is pure-read and fail-CLOSED: an offender whose
 * own contribution cannot be computed THROWS rather than returning a verdict.
 * This function deliberately does NOT try/catch that throw — swallowing it here
 * would be the ad-hoc silent skip design §5/REQ-D2-12 forbids. The one place the
 * throw is allowed to surface is the CLI's top-level fail-closed catch → exit 2.
 * Anchored at HEAD (§2.2 — every window ends at HEAD).
 */
export function resolvedSkipLine(sha, subject, { git, tip }) {
  // MINOR 1 (ruling rev 3) — the tip is REQUIRED, never defaulted to 'HEAD'.
  // `resolveRange` accepts an arbitrary range, so anchoring liveness at a
  // hardcoded 'HEAD' answers a question about a different commit than the one
  // being audited: an offender reverted PAST the audited tip would be exempted
  // out of a window that never contained the revert. A default would leave that
  // fail-open one careless caller away — and an exported guard whose soundness
  // depends on its caller is unsound by design. So: throw.
  if (!tip) {
    throw new Error('resolvedSkipLine: no audited tip supplied — refused fail-closed (design §2.2)');
  }
  const { resolved } = isResolvedAt(sha, tip, { git });
  return resolved ? `[SKIP] ${sha.slice(0, 7)} ${subject} — resolved by revert` : null;
}

/**
 * REQ-D2-6(b) / design §15.5 — the fail-closed exit contract, with `failCount`
 * (human-readable `[FAIL]` lines of ANY class) DECOUPLED from the `[FAIL-SHA]`
 * (auto-revert) count now that emission is class-filtered:
 *
 *   • exit 1 ⟺ failCount ≥ 1 (any class). A `[FAIL-SHA]` count of 0 on exit 1 is
 *     LEGITIMATE (all violations are issueLink/memoryPresence — non-auto-revertible).
 *   • The old "any violation ⟹ ≥1 [FAIL-SHA]" coherence guard is REPLACED (not
 *     dropped) by the BIDIRECTIONAL tree-keyed⟺[FAIL-SHA] invariant: ≥1 un-exempted
 *     tree-keyed failure ⟺ ≥1 [FAIL-SHA] line. A violation of EITHER direction is
 *     uncomputable → exit 2: (i) a tree-keyed failure recorded but zero [FAIL-SHA]
 *     emitted (a crash mid-emission); (ii) a [FAIL-SHA] with no backing tree-keyed
 *     failure. (A guard relaxed without a replacement is a guard deleted.)
 *
 * @param {number} failCount           merges reported as [FAIL] (any class).
 * @param {number} treeKeyedFailCount  merges with ≥1 un-exempted tree-keyed failure.
 * @param {number} failShaCount        [FAIL-SHA] lines emitted (deduped carriers).
 * @returns {0|1|2}
 */
export function crossCheckExit(failCount, treeKeyedFailCount, failShaCount) {
  // Bidirectional tree-keyed ⟺ [FAIL-SHA] coherence. Newest-carrier dedup keeps
  // ≥1 emission per payload, so treeKeyedFailCount>0 ⟹ failShaCount>0 always holds
  // on the healthy path; a mismatch is a genuine mid-emission crash / incoherence.
  const treeKeyed = treeKeyedFailCount > 0;
  const emitted = failShaCount > 0;
  if (treeKeyed !== emitted) return 2;
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

/**
 * Resolve the audit baseline ref from config.
 * Validates it against the repo; warns and returns null if it doesn't resolve.
 *
 * @param {string|null|undefined} baseline  Raw value from brain.config.json.
 * @param {string} cwd
 * @returns {string|null}
 */
function resolveBaseline(baseline, cwd) {
  if (!baseline) return null;
  // execFileSync (argv, not a shell string) so a config-supplied baseline can
  // never inject shell — the ref is passed as a literal argument.
  let resolved = '';
  try {
    resolved = execFileSync('git', ['rev-parse', '--verify', baseline], {
      encoding: 'utf8', cwd, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    resolved = '';
  }
  if (!resolved) {
    process.stderr.write(
      `[WARN] audit baseline '${baseline}' does not resolve in this repo — auditing all merges\n`,
    );
    return null;
  }
  return baseline;
}

/**
 * Build an isAncestor function backed by real git for production use.
 * Returns a function that answers: is `baseline` an ancestor of `sha`?
 */
function makeGitIsAncestor(cwd) {
  return function gitIsAncestor(baseline, sha) {
    try {
      // execFileSync (argv) — never expands shell metacharacters in the ref.
      execFileSync('git', ['merge-base', '--is-ancestor', baseline, sha], {
        encoding: 'utf8',
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return true; // exit 0 → baseline IS ancestor → sha is after baseline
    } catch {
      return false; // non-zero → not ancestor → sha is before baseline
    }
  };
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

    // ── Audit baseline (optional) ────────────────────────────────────────────
    // When governance.auditBaseline is set, only merges that are "after" that
    // ref are audited.  Merges before it are skipped as pre-baseline without
    // failing the audit.  This lets teams adopt governance incrementally.
    const rawBaseline = config?.governance?.auditBaseline ?? null;
    const baseline = resolveBaseline(rawBaseline, cwd);
    const gitIsAncestor = baseline ? makeGitIsAncestor(cwd) : null;
    const resolutionGit = makeGit(cwd);

    // ── VCS adapter for size:exception label check (best-effort) ────────────
    // If the adapter is unavailable or misconfigured, audit runs without the
    // size:exception bypass — never crash on a missing VCS config.
    let vcs = null;
    try {
      vcs = await getVcs({ config });
    } catch {
      // VCS not configured — size:exception label checks will not run
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
    let log;
    try {
      log = gitOrThrow(['log', '--first-parent', '--merges', '--format=%H%x09%s', range], { cwd }).trim();
    } catch (err) {
      console.log(`[FAIL] governance:audit-uncomputable — could not compute merge range ${range}: ${err.message}`);
      process.exit(2);
    }
    if (!log) {
      console.log(`[INFO] No merge commits found in range: ${range}`);
      process.exit(0);
    }

    const merges = log.split('\n').filter(Boolean).map(line => {
      const i = line.indexOf('\t');
      return { sha: line.slice(0, i), subject: line.slice(i + 1) };
    });

    // The reverter-skip is FULL-WINDOW (design §15.3): its signed count must see
    // an offender sitting at the window base BEHIND a tip-most cleanup revert.
    // `netAddFull` enumerates `${from}^1..${to}`, so `from` is the OLDEST merge in
    // the window (git log is newest-first) — a merge, so `from^1` always resolves,
    // and the inclusive window then covers every audited merge. `to` is always HEAD.
    const windowFrom = merges[merges.length - 1].sha;
    // MINOR 1 (ruling rev 3) — anchor at the AUDITED TIP, not a literal 'HEAD'.
    // `resolveRange` accepts an arbitrary range from argv; §2.2's "the window
    // ends at the tip" was a precondition nobody enforced. Now it is code, and
    // it is the single tip every skip and the reverter exemption share.
    const windowTo = auditedTip(range);

    let failCount = 0;          // [FAIL] lines of ANY class — governs exit 1.
    let treeKeyedFailCount = 0; // merges with ≥1 un-exempted tree-keyed failure.
    let failShaCount = 0;       // [FAIL-SHA] lines actually emitted (deduped).
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

      const parents = gitOrThrow(['log', '-1', '--format=%P', sha], { cwd })
        .trim().split(/\s+/).filter(Boolean);
      const parent1 = parents[0];
      if (!parent1) {
        // A --merges-qualified commit always has ≥2 parents; reaching here means
        // the local git state cannot answer — never a silent [SKIP] (design §5).
        console.log(`[FAIL] governance:audit-uncomputable — ${sha.slice(0, 7)} ${subject}: no resolvable parent`);
        process.exit(2);
      }

      // MINOR 2 — the THROWING seam: a transient git failure is exit 2 at the
      // top-level catch, never an empty diff that silently PASSes diffSize and
      // adrPresence.
      const numstat = gitOrThrow(['diff', '--numstat', parent1, sha], { cwd }).trim();
      const changedFiles = gitOrThrow(['diff', '--name-only', parent1, sha], { cwd })
        .split('\n').filter(Boolean);
      const body = gitOrThrow(['log', '-1', '--format=%B', sha], { cwd }).trim();

      // ── Best-effort PR metadata fetch (single call for labels + body) ─────
      // Parse the PR number from the merge subject, then fetch the PR once for:
      //   • labels  → size:exception check (diffSize skip)
      //   • body    → issueLink check (PR description has Closes/Part of #N;
      //               merge commit body is typically "Merge pull request #N")
      //
      // Any failure (VCS unconfigured, adapter error, no PR number found) leaves
      // both null (uncomputable — REQ-CIC-2) and falls back to commit-body
      // behavior.  NEVER crash, and NEVER collapse a fetched-but-null value back
      // into a fabricated [] / '' default — shouldSkipSize()/selectIssueLinkBody()
      // already treat null as "no evidence" correctly; re-fabricating an empty
      // default here would re-introduce the exact fail-open the seam removes,
      // just on a parallel path (prView fix-at-source disposition).
      let prLabels = null;
      let prBody = null;
      const prNum = parsePrNumber(subject);
      if (prNum !== null && vcs) {
        try {
          const pr = await vcs.prView({
            project: config.project?.slug,
            number: prNum,
          });
          prLabels = pr.labels;
          prBody = pr.body;
        } catch {
          // VCS call failed — proceed without PR metadata (audit normally)
        }
      }

      const sizeSkipped = shouldSkipSize(prLabels);

      // Use the PR description for issueLink when available (it contains the
      // actual Closes/Part of #N reference).  Fall back to the raw commit body
      // when the PR description is absent or empty.
      const issueLinkBody = selectIssueLinkBody(prBody, body);

      const results = {
        // Skip diffSize when the PR explicitly carries size:exception.
        diffSize: sizeSkipped
          ? { pass: true, note: 'size:exception label present — diffSize skipped' }
          : diffSize(numstat, ignoreList),
        issueLink: issueLink(issueLinkBody),
        adrPresence: adrPresence(changedFiles),
        memoryPresence: memoryPresence(allObservations),
      };

      const failures = Object.entries(results).filter(([, r]) => !r.pass);

      if (failures.length === 0) {
        const sizeNote = sizeSkipped ? ' [size:exception]' : '';
        console.log(`[PASS] ${sha.slice(0, 7)} ${subject}${sizeNote}`);
        continue;
      }

      // ── Reverter-skip (design §15.3, REQ-D2-10a; guard (c′) per the external
      // ruling rev 4 on #297) — evaluated ONLY for a merge that already failed,
      // so the happy path pays zero extra cost. A merge C is exempt from its
      // TREE-KEYED failures iff BOTH hold:
      //
      //   (1) LIVENESS — every path C itself ADDS is absent from the tree at the
      //       audited tip (`addedPathsAbsentAt`). A candidate that put a payload
      //       back on the tree can never be exempted, however the window counts.
      //       A pure-delete cleanup revert adds nothing → vacuously absent → the
      //       exemption stays available for (2) to decide.
      //   (2) NET-PARITY — C's own contribution is net-absent across the window:
      //       `netAddFull(C) ≤ 0`, deciding exactly as before.
      //
      // (1) exists because (2) alone FAILS OPEN when the payload's ORIGINAL add
      // sits BEHIND the window base: the window then sees only a delete and a
      // re-add, nets to 0, and a live-at-HEAD offender is exempted while the
      // audit exits 0 (the A8 fixture). (1) is ordered FIRST — it is two git
      // calls against `netAddFull`'s one-per-window-merge, and short-circuiting
      // on a live payload skips the whole count. It is NOT gated on
      // `isResolvedAt`: that predicate's DIRECTIONAL `(C, tip]` range is empty
      // for any tip-most merge, so it would deny the exemption to every
      // legitimate tip-most cleanup revert (A2/A6) — see
      // openspec/changes/issue-259-d2/brain-drafts/ruling-bound-to-an-unrun-mechanism.md.
      //
      // (`dC ≠ ''` is guaranteed here — any tree-keyed FAILING merge has a
      // non-empty contribution — so netAddFull never hits its F-1 vacuity throw
      // on this path; any throw either primitive does raise is a genuine
      // uncomputable that propagates to the top-level catch → exit 2, never a
      // silent exemption.)
      // issueLink/memoryPresence NEVER qualify for exemption (they are not
      // tree-mirrored) — a legit reverter's own body/global gaps still survive.
      const failingNames = failures.map(([name]) => name);
      const hasTreeKeyed = failingNames.some((name) => TREE_KEYED_CHECKS.has(name));
      const exempt = hasTreeKeyed
        && addedPathsAbsentAt(sha, windowTo, { git: resolutionGit })
        && netAddFull(sha, { git: resolutionGit, from: windowFrom, to: windowTo }) <= 0;

      const surviving = failures.filter(([name]) => !(exempt && TREE_KEYED_CHECKS.has(name)));

      if (surviving.length === 0) {
        // Every failure was a tree-keyed failure the net-parity exemption covers.
        console.log(`[SKIP] ${sha.slice(0, 7)} ${subject} — reverts offender (net-absent at HEAD)`);
        continue;
      }

      // ── [FAIL] (any surviving class) — governs exit 1 ────────────────────
      failCount += 1;
      const survivingNames = surviving.map(([name]) => name);
      let reasons = surviving.map(([name, r]) => `${name}: ${r.reason}`).join('; ');
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
      // TREE-KEYED failure, and ONLY for the newest carrier of each payload
      // signature (git log is newest-first, so the first-seen carrier is the
      // newest). Older carriers stay [FAIL] but emit no auto-revert signal, so
      // PR4 reverts the live carrier once — never O AND R2, never the intermediate
      // legit reverter. issueLink/memoryPresence-only merges emit nothing here.
      const survivesTreeKeyed = survivingNames.some((name) => TREE_KEYED_CHECKS.has(name));
      if (survivesTreeKeyed) {
        treeKeyedFailCount += 1;
        const sig = payloadSignature(resolutionGit, sha);
        if (!emittedSignatures.has(sig)) {
          emittedSignatures.add(sig);
          console.log(`[FAIL-SHA] ${sha}`);
          failShaCount += 1;
        }
      }
    }

    const exitCode = crossCheckExit(failCount, treeKeyedFailCount, failShaCount);
    if (exitCode === 2) {
      console.log('[FAIL] governance:audit-uncomputable — tree-keyed⟺[FAIL-SHA] coherence violated '
        + `(failCount=${failCount}, treeKeyedFailCount=${treeKeyedFailCount}, failShaCount=${failShaCount})`);
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
