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

import { WORKFLOW_NAME, GOVERNANCE_JOBS, checkContexts } from './governance-checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

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

// ── checkContexts ─────────────────────────────────────────────────────────────

test('checkContexts returns "governance / <job>" for each GOVERNANCE_JOB', () => {
  assert.deepEqual(checkContexts(), ['governance / issue-link', 'governance / diff-size']);
});

test('WORKFLOW_NAME is "governance"', () => {
  assert.equal(WORKFLOW_NAME, 'governance');
});
