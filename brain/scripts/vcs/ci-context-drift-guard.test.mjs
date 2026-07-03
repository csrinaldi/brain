// ci-context-drift-guard.test.mjs — Drift guard (design.md open question, CP-A0
// ruling 2) + REQ-CIC-4 proof (pure evaluators unchanged by the seam).
//
// GUARD: no governance gate script may read a pipeline-context env var
// (PR_*, BASE_SHA, HEAD_SHA, BASE_BRANCH, GITHUB_REPOSITORY, GITHUB_HEAD_REF,
// GITHUB_EVENT_NAME, CI_MERGE_REQUEST_*, CI_PROJECT_*) directly via
// `process.env.<VAR>` — ONLY ci-context.mjs may. NO exemptions.
//
// REQ-CIC-4: introducing ci-context.mjs MUST NOT change any pure evaluator
// (evaluateActor, evaluatePhaseOrder + evaluateRuleA/B/C, adrPresence,
// memoryPresence, diffSize, issueLink) — they take plain arguments, never the
// environment, and never import the seam.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const VCS_DIR = dirname(fileURLToPath(import.meta.url));
const GOVERNANCE_CHECKS_DIR = join(VCS_DIR, '..', 'governance', 'checks');

// Pipeline context env vars that only ci-context.mjs may read directly.
const PIPELINE_ENV_PATTERN =
  /process\.env\.(PR_[A-Z_]+|BASE_SHA|HEAD_SHA|BASE_BRANCH|GITHUB_REPOSITORY|GITHUB_HEAD_REF|GITHUB_EVENT_NAME|GITHUB_ACTOR|GITHUB_SHA|GITHUB_BASE_REF|GITHUB_REF|CI_MERGE_REQUEST_[A-Z_]+|CI_PROJECT_[A-Z_]+|CI_COMMIT_[A-Z_]+|CI_API_V4_URL)\b/g;

// Every gate wrapper this seam was introduced for (the 5 files cited in
// ADR-0016) PLUS run-check.mjs's sibling checks dir, EXCLUDING ci-context.mjs
// itself (the sole sanctioned reader) and every *.test.mjs (fixtures may
// legitimately reference these var NAMES as strings/env overrides, not as a
// literal `process.env.X` read).
const GATE_FILES = [
  join(VCS_DIR, 'actor-check.mjs'),
  join(VCS_DIR, 'brain-writes-reviewed.mjs'),
  join(VCS_DIR, 'phase-order-check.mjs'),
  join(VCS_DIR, '..', 'governance', 'run-check.mjs'),
  join(VCS_DIR, 'providers', 'github.mjs'),
  join(VCS_DIR, 'providers', 'gitlab.mjs'),
  join(VCS_DIR, '..', 'brain-audit.mjs'),
];

test('drift-guard: no gate wrapper reads a pipeline-context env var directly — only ci-context.mjs may (NO exemptions)', () => {
  for (const file of GATE_FILES) {
    const src = readFileSync(file, 'utf8');
    const matches = src.match(PIPELINE_ENV_PATTERN) ?? [];
    assert.deepEqual(
      matches, [],
      `${file} must not read pipeline env directly — found: ${JSON.stringify(matches)}. All pipeline context must flow through ci-context.mjs.`
    );
  }
});

test('drift-guard: ci-context.mjs IS the sanctioned reader — it references process.env AND the pipeline var names (sanity: pattern is not vacuous)', () => {
  const src = readFileSync(join(VCS_DIR, 'ci-context.mjs'), 'utf8');
  assert.match(src, /deps\.env \?\? process\.env/, 'sanity: ci-context.mjs should read process.env as its default env source');
  for (const name of ['PR_NUMBER', 'BASE_SHA', 'HEAD_SHA', 'GITHUB_REPOSITORY', 'CI_MERGE_REQUEST_IID', 'CI_PROJECT_PATH']) {
    assert.ok(src.includes(name), `sanity: ci-context.mjs should reference ${name}`);
  }
});

// ── REQ-CIC-4: pure evaluators unchanged by the seam ──────────────────────────

test('REQ-CIC-4: the 4 generic governance evaluators (adrPresence, memoryPresence, diffSize, issueLink) do not import ci-context.mjs', () => {
  for (const name of ['adr-presence.mjs', 'memory-presence.mjs', 'diff-size.mjs', 'issue-link.mjs']) {
    const src = readFileSync(join(GOVERNANCE_CHECKS_DIR, name), 'utf8');
    assert.equal(src.includes('ci-context'), false, `${name} must not import/reference ci-context.mjs — it is a pure evaluator`);
  }
});

/** Extracts a named function's source body (from `export function <name>` to the next top-level `function`/`export`). */
function extractFunctionBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) return null;
  const rest = src.slice(start);
  const nextBoundary = rest.slice(1).search(/\n(export )?function /);
  return nextBoundary === -1 ? rest : rest.slice(0, nextBoundary + 1);
}

test('REQ-CIC-4: evaluateActor (pure evaluator, co-located with the wrapper) never references ci-context/loadContext', () => {
  const src = readFileSync(join(VCS_DIR, 'actor-check.mjs'), 'utf8');
  const body = extractFunctionBody(src, 'evaluateActor');
  assert.ok(body, 'evaluateActor not found in actor-check.mjs');
  assert.equal(body.includes('ci-context'), false);
  assert.equal(body.includes('loadContext'), false);
});

test('REQ-CIC-4: evaluateBrainWritesReviewed (pure evaluator, co-located with the wrapper) never references ci-context/loadContext', () => {
  const src = readFileSync(join(VCS_DIR, 'brain-writes-reviewed.mjs'), 'utf8');
  const body = extractFunctionBody(src, 'evaluateBrainWritesReviewed');
  assert.ok(body, 'evaluateBrainWritesReviewed not found in brain-writes-reviewed.mjs');
  assert.equal(body.includes('ci-context'), false);
  assert.equal(body.includes('loadContext'), false);
});

test('REQ-CIC-4: evaluatePhaseOrder (pure evaluator, co-located with the wrapper) never references ci-context/loadContext', () => {
  const src = readFileSync(join(VCS_DIR, 'phase-order-check.mjs'), 'utf8');
  const body = extractFunctionBody(src, 'evaluatePhaseOrder');
  assert.ok(body, 'evaluatePhaseOrder not found in phase-order-check.mjs');
  assert.equal(body.includes('ci-context'), false);
  assert.equal(body.includes('loadContext'), false);
});

test('REQ-CIC-4: only the thin wrappers (runActorCheck/runBrainWritesReviewedCheck/runPhaseOrderCheck/runCheck) import the seam', () => {
  const wrapperFiles = [
    join(VCS_DIR, 'actor-check.mjs'),
    join(VCS_DIR, 'brain-writes-reviewed.mjs'),
    join(VCS_DIR, 'phase-order-check.mjs'),
    join(VCS_DIR, '..', 'governance', 'run-check.mjs'),
  ];
  for (const file of wrapperFiles) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /from '.*ci-context\.mjs'/, `${file}: expected the wrapper to import ci-context.mjs`);
  }
});

// ── CP-A1 Rev 2: the actor-check job must feed ci-context.mjs a PR_NUMBER so the
// author is sourced from the prView API (ADR-0016 Never-do #3), not from env. This
// guards the exact regression the injected-ctx tests missed. ────────────────────
test('CI wiring: governance.yml actor-check job provides PR_NUMBER (author via API, not PR_AUTHOR env)', () => {
  const yml = readFileSync(
    join(VCS_DIR, '..', '..', '..', '.github', 'workflows', 'governance.yml'), 'utf8');
  const jobStart = yml.indexOf('\n  actor-check:');
  assert.ok(jobStart !== -1, 'actor-check job not found in governance.yml');
  const nextBlock = yml.indexOf('\n  # ', jobStart + 1);
  const block = nextBlock === -1 ? yml.slice(jobStart) : yml.slice(jobStart, nextBlock);
  assert.match(
    block, /PR_NUMBER:\s*\$\{\{\s*github\.event\.pull_request\.number/,
    'actor-check job must set PR_NUMBER so ci-context sources the author from the prView API');
  assert.doesNotMatch(
    block, /^\s*PR_AUTHOR:/m,
    'actor-check job must NOT set PR_AUTHOR — the author comes from the API (ADR-0016 Never-do #3), never env');
});
