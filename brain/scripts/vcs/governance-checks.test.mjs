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
  for (const detectionJob of DETECTION_JOBS) {
    assert.ok(
      !contexts.includes(`${WORKFLOW_NAME} / ${detectionJob}`),
      `checkContexts() must not include detection-only job "${detectionJob}"`
    );
  }
});

// ── Drift-guard regression: split preserves the full-union YAML match ──────────
//
// Regression guard for the REQUIRED_JOBS/DETECTION_JOBS split itself: the YAML must
// still equal the full GOVERNANCE_JOBS union (not just REQUIRED_JOBS) after the
// registry refactor.

test('drift-guard regression: governance.yml job names still equal the full GOVERNANCE_JOBS union after the split', () => {
  const yamlPath = resolve(REPO_ROOT, '.github/workflows/governance.yml');
  const yamlText = readFileSync(yamlPath, 'utf8');
  const matches = [...yamlText.matchAll(/^    name: (\S+)\s*$/mg)];
  const yamlJobNames = matches.map(m => m[1]);

  assert.deepEqual(
    [...new Set(yamlJobNames)].sort(),
    [...new Set(GOVERNANCE_JOBS)].sort(),
    `Drift detected post-split: GOVERNANCE_JOBS=${JSON.stringify(GOVERNANCE_JOBS)} ` +
    `but governance.yml job names=${JSON.stringify(yamlJobNames)}`
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
  ]);
});

test('WORKFLOW_NAME is "governance"', () => {
  assert.equal(WORKFLOW_NAME, 'governance');
});
