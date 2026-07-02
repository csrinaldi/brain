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
  WORKFLOW_NAME,
  GOVERNANCE_JOBS,
  REQUIRED_JOBS,
  DETECTION_JOBS,
  checkContexts,
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
  assert.deepEqual(contexts, REQUIRED_JOBS.map(job => `${WORKFLOW_NAME} / ${job}`));
  // PR2a: this loop is a no-op while DETECTION_JOBS = []. It becomes load-bearing
  // once DETECTION_JOBS is non-empty (e.g. 'phase-order') — wire a real fixture
  // then so this exclusion is actually exercised, not just vacuously true.
  for (const detectionJob of DETECTION_JOBS) {
    assert.ok(
      !contexts.includes(`${WORKFLOW_NAME} / ${detectionJob}`),
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

test('checkContexts returns "governance / <job>" for each REQUIRED_JOB', () => {
  assert.deepEqual(checkContexts(), [
    'governance / issue-link',
    'governance / diff-size',
    'governance / local-checks',
    'governance / memory-gate',
    'governance / decision-gate',
  ]);
});

test('WORKFLOW_NAME is "governance"', () => {
  assert.equal(WORKFLOW_NAME, 'governance');
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
