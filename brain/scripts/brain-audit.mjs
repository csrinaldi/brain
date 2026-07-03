#!/usr/bin/env node
// brain-audit.mjs — audit merged commits for governance invariants (REQ-S4-5, REQ-S4-6).
//
// Usage: node brain/scripts/brain-audit.mjs [<git-range>]
// Default range: origin/main..HEAD (falls back to HEAD if origin/main is absent).
//
// For each merge commit in the range, runs all 4 generic checks:
//   diffSize · issueLink · adrPresence · memoryPresence
//
// Output (one line per merge):
//   [PASS] <sha7> <subject>
//   [FAIL] <sha7> <subject> — <check>: <reason>; ...
//   [SKIP] <sha7> <subject> — before audit baseline
//
// Exit: 0 when all audited commits pass, 1 when any fail.

import { execSync, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { diffSize } from './governance/checks/diff-size.mjs';
import { issueLink } from './governance/checks/issue-link.mjs';
import { adrPresence } from './governance/checks/adr-presence.mjs';
import { memoryPresence } from './governance/checks/memory-presence.mjs';
import { getVcs } from './vcs/cli.mjs';
import { parsePrNumber, shouldSkipSize, isAfterBaseline, selectIssueLinkBody } from './lib/audit-helpers.mjs';
import { readChunkObservations } from './lib/chunk-reader.mjs';

function git(args, cwd = process.cwd()) {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8', cwd, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
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

    // ── VCS adapter for size:exception label check (best-effort) ────────────
    // If the adapter is unavailable or misconfigured, audit runs without the
    // size:exception bypass — never crash on a missing VCS config.
    let vcs = null;
    try {
      vcs = await getVcs({ config });
    } catch {
      // VCS not configured — size:exception label checks will not run
    }

    // Read the on-disk .memory/chunks/ ONCE (repo-level, not per-merge): the same
    // observations are passed to memoryPresence for every merge. Best-effort — a
    // missing/corrupt/schema-drifted chunk yields fewer observations, never a crash.
    const allObservations = readChunkObservations(cwd);

    // --first-parent: audit only the INTEGRATION merges that landed on the audited
    // branch (e.g. main), NOT the nested slice merges inside a feature branch.
    // Nested slice merges legitimately carry "Part of #N" bodies and no per-slice
    // memory — auditing them produces false failures.  The integration merge (the
    // one that actually landed on main) is the canonical governance checkpoint.
    const log = git(`log --first-parent --merges --format=%H%x09%s ${range}`, cwd);
    if (!log) {
      console.log(`[INFO] No merge commits found in range: ${range}`);
      process.exit(0);
    }

    const merges = log.split('\n').filter(Boolean).map(line => {
      const i = line.indexOf('\t');
      return { sha: line.slice(0, i), subject: line.slice(i + 1) };
    });

    let anyFail = false;

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

      const parents = git(`log -1 --format=%P ${sha}`, cwd).split(/\s+/).filter(Boolean);
      const parent1 = parents[0];
      if (!parent1) {
        console.log(`[SKIP] ${sha.slice(0, 7)} ${subject} — no parent`);
        continue;
      }

      const numstat = git(`diff --numstat ${parent1} ${sha}`, cwd);
      const changedFiles = git(`diff --name-only ${parent1} ${sha}`, cwd)
        .split('\n').filter(Boolean);
      const body = git(`log -1 --format=%B ${sha}`, cwd);

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

      const failures = Object.entries(results)
        .filter(([, r]) => !r.pass)
        .map(([name, r]) => `${name}: ${r.reason}`);

      if (failures.length === 0) {
        const sizeNote = sizeSkipped ? ' [size:exception]' : '';
        console.log(`[PASS] ${sha.slice(0, 7)} ${subject}${sizeNote}`);
      } else {
        anyFail = true;
        console.log(`[FAIL] ${sha.slice(0, 7)} ${subject} — ${failures.join('; ')}`);
      }
    }

    process.exit(anyFail ? 1 : 0);
  })().catch(err => {
    console.error(`brain-audit: unexpected error — ${err.message}`);
    process.exit(1);
  });
}
