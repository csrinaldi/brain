// governance-checks.test.mjs — Tests for governance-checks.mjs (S3).
//
// Drift-guard: reads the actual governance.yml and asserts its job name: fields
// match GOVERNANCE_JOBS from the module. Fails closed on drift — a mismatch
// means branch protection could require a check that never reports, which
// deadlocks main with no self-healing path.
//
// Run with: npm test (node --test)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GOVERNANCE_JOBS,
  REQUIRED_JOBS,
  DETECTION_JOBS,
  checkContexts,
  diffArmedChecks,
} from './governance-checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

// ── Drift-guard ───────────────────────────────────────────────────────────────
// Parses the actual .github/workflows/governance.yml job name: fields and
// asserts the set equals GOVERNANCE_JOBS. Both the constant and the YAML must
// agree — this test is the only thing that keeps them honest.
//
// Parse strategy: job-level name: fields sit at exactly 4 leading spaces
// with a non-space value. Step-level names have 6+ spaces and a "- " prefix;
// the top-level workflow name: has 0 spaces. The regex selects only job names.

test('drift-guard: GOVERNANCE_JOBS matches governance.yml job names', () => {
  const yamlPath = resolve(REPO_ROOT, '.github/workflows/governance.yml');
  const yamlText = readFileSync(yamlPath, 'utf8');

  // ^    name: (\S+)\s*$  — 4-space indent, non-space value, optional trailing space.
  const matches = [...yamlText.matchAll(/^    name: (\S+)\s*$/mg)];
  const yamlJobNames = matches.map(m => m[1]);

  assert.deepEqual(
    [...new Set(yamlJobNames)].sort(),
    [...new Set(GOVERNANCE_JOBS)].sort(),
    `Drift detected: GOVERNANCE_JOBS=${JSON.stringify(GOVERNANCE_JOBS)} ` +
    `but governance.yml job names=${JSON.stringify(yamlJobNames)}`
  );
});

// ── Two-tier registry (REQUIRED_JOBS / DETECTION_JOBS) ─────────────────────────
//
// REQUIRED_JOBS become branch-protection contexts (checkContexts()). DETECTION_JOBS
// run and report but are not required at merge — the detection→prevention flip is a
// one-line list move from DETECTION_JOBS to REQUIRED_JOBS, no code change.

test('REQUIRED_JOBS and DETECTION_JOBS are exported arrays', () => {
  assert.ok(Array.isArray(REQUIRED_JOBS), 'REQUIRED_JOBS must be an array');
  assert.ok(Array.isArray(DETECTION_JOBS), 'DETECTION_JOBS must be an array');
});

test('GOVERNANCE_JOBS equals the union of REQUIRED_JOBS and DETECTION_JOBS', () => {
  assert.deepEqual(GOVERNANCE_JOBS, [...REQUIRED_JOBS, ...DETECTION_JOBS]);
});

test('checkContexts() derives contexts from REQUIRED_JOBS only, excluding DETECTION_JOBS', () => {
  const contexts = checkContexts();
  assert.deepEqual(contexts, [...REQUIRED_JOBS]);
  // PR2a: this loop is a no-op while DETECTION_JOBS = []. It becomes load-bearing
  // once DETECTION_JOBS is non-empty (e.g. 'phase-order') — wire a real fixture
  // then so this exclusion is actually exercised, not just vacuously true.
  for (const detectionJob of DETECTION_JOBS) {
    assert.ok(
      !contexts.includes(detectionJob),
      `checkContexts() must not include detection-only job "${detectionJob}"`
    );
  }
});

// ── Drift-guard regression: split preserves union ORDER, not just membership ───
//
// The drift-guard above sorts both sides before comparing, so it cannot catch a
// shuffled union. This is a genuinely different, order-sensitive assertion: the
// YAML must define REQUIRED_JOBS' jobs before DETECTION_JOBS' jobs, in exact
// GOVERNANCE_JOBS = [...REQUIRED_JOBS, ...DETECTION_JOBS] order. Becomes real signal
// once DETECTION_JOBS is non-empty (PR2a+) — today it degenerates to REQUIRED_JOBS
// order only, but the assertion shape is already correct.

test('drift-guard regression: governance.yml job order matches REQUIRED_JOBS then DETECTION_JOBS', () => {
  const yamlPath = resolve(REPO_ROOT, '.github/workflows/governance.yml');
  const yamlText = readFileSync(yamlPath, 'utf8');
  const matches = [...yamlText.matchAll(/^    name: (\S+)\s*$/mg)];
  const yamlJobNames = matches.map(m => m[1]);

  assert.deepEqual(
    yamlJobNames,
    GOVERNANCE_JOBS,
    `Order drift: GOVERNANCE_JOBS=${JSON.stringify(GOVERNANCE_JOBS)} ` +
    `but governance.yml job order=${JSON.stringify(yamlJobNames)}`
  );
});

// ── L1 local-checks job (REQ-L1-1) ──────────────────────────────────────────────

test('local-checks is present in REQUIRED_JOBS', () => {
  assert.ok(REQUIRED_JOBS.includes('local-checks'), 'REQUIRED_JOBS must include "local-checks"');
});

test('local-checks is present in the parsed governance.yml job names', () => {
  const yamlPath = resolve(REPO_ROOT, '.github/workflows/governance.yml');
  const yamlText = readFileSync(yamlPath, 'utf8');
  const matches = [...yamlText.matchAll(/^    name: (\S+)\s*$/mg)];
  const yamlJobNames = matches.map(m => m[1]);

  assert.ok(yamlJobNames.includes('local-checks'), 'governance.yml must define a "local-checks" job');
});

// ── checkContexts ─────────────────────────────────────────────────────────────
//
// GitHub Actions names a check-run after the job's own `name:` field ONLY — the
// workflow name is a UI grouping label, never part of the check-run's identity.
// checkContexts() must therefore return bare job names (issue #203): a
// "workflow / job" prefix produces a required context that no check-run can ever
// match, silently hard-blocking every PR to a protected branch (root cause of
// PR #202's false block).

test('checkContexts returns bare job names (no workflow-name prefix)', () => {
  assert.deepEqual(checkContexts(), [
    'issue-link',
    'diff-size',
    'local-checks',
    'memory-gate',
    'decision-gate',
  ]);
});

// ── Drift-guard (issue #203, deliverable 2) ────────────────────────────────────
//
// Mirrors the GOVERNANCE_JOBS ↔ YAML drift-guard above, but asserts checkContexts()
// itself equals the bare YAML job `name:` fields for the REQUIRED subset — this is
// the regression guard that would have caught the "workflow / job" prefix bug: any
// future re-introduction of a prefix (or other divergence from the literal
// check-run name) turns this test red.

test('drift-guard: checkContexts() equals governance.yml REQUIRED job name: fields exactly (no prefix)', () => {
  const yamlPath = resolve(REPO_ROOT, '.github/workflows/governance.yml');
  const yamlText = readFileSync(yamlPath, 'utf8');
  const matches = [...yamlText.matchAll(/^    name: (\S+)\s*$/mg)];
  const yamlJobNames = matches.map(m => m[1]);
  const yamlRequiredJobNames = yamlJobNames.filter(name => REQUIRED_JOBS.includes(name));

  assert.deepEqual(
    checkContexts(),
    yamlRequiredJobNames,
    `checkContexts() must equal the literal check-run names GitHub reports — ` +
    `got ${JSON.stringify(checkContexts())} vs YAML ${JSON.stringify(yamlRequiredJobNames)}`
  );
});

// ── diffArmedChecks (issue #203, deliverable 3 — arm-and-verify) ───────────────
//
// Post-arm verification classifies the branch's actual check-run names against
// the required contexts. Design decision (design.md §3): warn, never fail — a
// freshly protected branch legitimately has zero check-runs before its first PR.
// Zero runs collapses to ONE "unverifiable" note, never N per-context warnings.

test('diffArmedChecks: flags a required context with no matching check-run', () => {
  const result = diffArmedChecks(['issue-link', 'diff-size'], ['issue-link']);
  assert.equal(result.unverifiable, false);
  assert.deepEqual(result.missing, ['diff-size']);
});

test('diffArmedChecks: no missing entries when all required contexts have matching runs', () => {
  const result = diffArmedChecks(
    ['issue-link', 'diff-size'],
    ['issue-link', 'diff-size', 'local-checks']
  );
  assert.equal(result.unverifiable, false);
  assert.deepEqual(result.missing, []);
});

test('diffArmedChecks: zero check-runs yields a single unverifiable note, not N warnings', () => {
  const result = diffArmedChecks(['issue-link', 'diff-size', 'local-checks'], []);
  assert.equal(result.unverifiable, true);
  assert.deepEqual(result.missing, []);
});

// ── L3 memory-gate + decision-gate jobs (REQ-L3-1, REQ-L3-2, REQ-L3-3) ──────────

test('memory-gate and decision-gate are present in REQUIRED_JOBS', () => {
  assert.ok(REQUIRED_JOBS.includes('memory-gate'), 'REQUIRED_JOBS must include "memory-gate"');
  assert.ok(REQUIRED_JOBS.includes('decision-gate'), 'REQUIRED_JOBS must include "decision-gate"');
});

test('memory-gate and decision-gate are present in the parsed governance.yml job names', () => {
  const yamlPath = resolve(REPO_ROOT, '.github/workflows/governance.yml');
  const yamlText = readFileSync(yamlPath, 'utf8');
  const matches = [...yamlText.matchAll(/^    name: (\S+)\s*$/mg)];
  const yamlJobNames = matches.map(m => m[1]);

  assert.ok(yamlJobNames.includes('memory-gate'), 'governance.yml must define a "memory-gate" job');
  assert.ok(yamlJobNames.includes('decision-gate'), 'governance.yml must define a "decision-gate" job');
});

// ── REQ-A2-3 (issue #231 A2 phase 5): the GitHub bash issue-link job sources
// the approved label from the config-driven resolver, never a hardcoded
// literal (design.md Decision 4 — no runtime code, bash included, hardcodes
// 'status:approved' after this slice). approved-label.mjs's CLI printer
// (brain/scripts/governance/approved-label.mjs) is the sanctioned non-Node
// consumer path — no bash config-parser was invented.

test('REQ-A2-3: governance.yml issue-link job sources the approved label from approved-label.mjs (github), never a hardcoded literal', () => {
  const yamlPath = resolve(REPO_ROOT, '.github/workflows/governance.yml');
  const yamlText = readFileSync(yamlPath, 'utf8');
  const jobStart = yamlText.indexOf('\n  issue-link:');
  assert.ok(jobStart !== -1, 'issue-link job not found in governance.yml');
  const nextJobStart = yamlText.indexOf('\n  diff-size:', jobStart);
  const block = nextJobStart === -1 ? yamlText.slice(jobStart) : yamlText.slice(jobStart, nextJobStart);

  assert.match(
    block, /\$\(node brain\/scripts\/governance\/approved-label\.mjs github\)/,
    'issue-link job must source the approved label via `node brain/scripts/governance/approved-label.mjs github`'
  );
  assert.doesNotMatch(
    block, /'status:approved'/,
    'issue-link job must not hardcode the literal \'status:approved\' — it must read the resolved value'
  );
});
