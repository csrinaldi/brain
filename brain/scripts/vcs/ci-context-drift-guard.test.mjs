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

import { GOVERNANCE_JOBS, DETECTION_JOBS } from './governance-checks.mjs';

const VCS_DIR = dirname(fileURLToPath(import.meta.url));
const GOVERNANCE_CHECKS_DIR = join(VCS_DIR, '..', 'governance', 'checks');
const GITLAB_GOVERNANCE_YML = join(VCS_DIR, '..', 'ci', 'gitlab-governance.yml');

// Pipeline context env vars that only ci-context.mjs may read directly.
// DEFAULT_BRANCH / CI_DEFAULT_BRANCH (issue #231 CP-A2a review, finding m4):
// the A2 phase 2 addendum introduced these as the new seam vars behind
// ctx.defaultBranch but never extended this negative-space enumeration to
// forbid a future gate from reading them directly — the #204 wiring-test
// lesson (the guard must cover everything it itself guards) repeating.
const PIPELINE_ENV_PATTERN =
  /process\.env\.(PR_[A-Z_]+|BASE_SHA|HEAD_SHA|BASE_BRANCH|GITHUB_REPOSITORY|GITHUB_HEAD_REF|GITHUB_EVENT_NAME|GITHUB_ACTOR|GITHUB_SHA|GITHUB_BASE_REF|GITHUB_REF|CI_MERGE_REQUEST_[A-Z_]+|CI_PROJECT_[A-Z_]+|CI_COMMIT_[A-Z_]+|CI_API_V4_URL|DEFAULT_BRANCH|CI_DEFAULT_BRANCH)\b/g;

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

// ── PIPELINE_ENV_PATTERN vocabulary gap (issue #231 CP-A2a review, finding
// m4): the A2 phase 2 addendum introduced ctx.defaultBranch, sourced from
// the NEW seam vars DEFAULT_BRANCH (GitHub, mapped) / CI_DEFAULT_BRANCH
// (GitLab, standard predefined) — but PIPELINE_ENV_PATTERN, this guard's own
// negative-space enumeration of pipeline-context env vars, was never
// extended to include them. A future gate reading `process.env.
// DEFAULT_BRANCH` directly (bypassing ci-context.mjs) would go undetected.
// This is the #204 wiring-test lesson repeating: the guard must cover
// everything it itself guards.

test('drift-guard: PIPELINE_ENV_PATTERN also covers the ADDENDUM seam vars DEFAULT_BRANCH / CI_DEFAULT_BRANCH (m4 — a future gate reading these directly must be caught, not silently exempted)', () => {
  // Uses String#match (not assert.match/RegExp#test) deliberately: the
  // shared PIPELINE_ENV_PATTERN carries the `g` flag, and RegExp#test on a
  // global regex mutates `lastIndex` across calls — a second `.test()` call
  // on a shorter match can spuriously report no-match. String#match resets
  // `lastIndex` internally on every call, so it is safe to reuse the same
  // module-level regex object here exactly like the file's other assertions do.
  assert.ok('process.env.DEFAULT_BRANCH'.match(PIPELINE_ENV_PATTERN),
    'PIPELINE_ENV_PATTERN must forbid a gate wrapper reading process.env.DEFAULT_BRANCH directly');
  assert.ok('process.env.CI_DEFAULT_BRANCH'.match(PIPELINE_ENV_PATTERN),
    'PIPELINE_ENV_PATTERN must forbid a gate wrapper reading process.env.CI_DEFAULT_BRANCH directly');
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

// ── CI wiring (issue #231 A2 phase 2 ADDENDUM, pattern from #204): every
// GitHub job whose script calls ci-context's loadContext() must supply the
// MAPPED default-branch env var (DEFAULT_BRANCH, from repo metadata
// `github.event.repository.default_branch` — never a raw GITHUB_* trigger
// var read directly by the job script) so `ctx.defaultBranch` is computable
// rather than degrading to null. The GitLab side (`CI_DEFAULT_BRANCH`) is a
// free standard predefined var and lands with `gitlab-governance.yml` in a
// later phase — not asserted here (that YAML does not exist yet). ─────────

/** Extracts a job's YAML block (job header to the next top-level job header). */
function extractJobBlock(yml, jobName) {
  const jobStart = yml.indexOf(`\n  ${jobName}:`);
  if (jobStart === -1) return null;
  const rest = yml.slice(jobStart + 1);
  const nextJobMatch = rest.slice(1).match(/\n  [a-zA-Z][\w-]*:\n/);
  return nextJobMatch ? rest.slice(0, nextJobMatch.index + 1) : rest;
}

const CI_CONTEXT_CONSUMING_JOBS = [
  'memory-gate',
  'decision-gate',
  'phase-order',
  'actor-check',
  'brain-writes-reviewed',
];

for (const job of CI_CONTEXT_CONSUMING_JOBS) {
  test(`CI wiring: governance.yml "${job}" job supplies the mapped DEFAULT_BRANCH env var (ctx.defaultBranch computable, never null-by-omission)`, () => {
    const yml = readFileSync(
      join(VCS_DIR, '..', '..', '..', '.github', 'workflows', 'governance.yml'), 'utf8');
    const block = extractJobBlock(yml, job);
    assert.ok(block, `${job} job not found in governance.yml`);
    assert.match(
      block, /DEFAULT_BRANCH:\s*\$\{\{\s*github\.event\.repository\.default_branch\s*\}\}/,
      `${job} job must map DEFAULT_BRANCH from github.event.repository.default_branch (repo metadata, never a raw trigger var) so ci-context's loadContext() can compute ctx.defaultBranch`);
  });
}

// ── Drift-guard extension (issue #231 A2 phase 3/4, design.md Decision 5,
// REQ-A2-5): string-slice gitlab-governance.yml (NO `yaml` npm dependency —
// same technique the two loops above already use for governance.yml) and
// assert (a) its job-name set equals GOVERNANCE_JOBS; (b) `allow_failure:
// true` appears IFF the job is in DETECTION_JOBS (Amendment 3, Decision 3 —
// the two classes must never flatten into one). ──────────────────────────

// Reserved top-level GitLab CI keywords that are NOT jobs — EXCLUDING them
// keeps the job-name-set comparison below honest. `default:` (issue #231
// CP-A2b finding #13) is the global image pin all 8 jobs inherit; without
// this exclusion it would false-positive as a 9th "job" and desync from
// GOVERNANCE_JOBS.
const RESERVED_TOP_LEVEL_KEYS = ['default'];

/**
 * Extracts GitLab job names: top-level (zero-indent) YAML keys, EXCLUDING
 * hidden/template keys (GitLab convention: a leading `.` marks a key as a
 * template never instantiated as a real job, e.g. `.governance_mr_rules:`
 * used here via `extends:`) and reserved top-level keywords (`default:`).
 */
function extractGitlabJobNames(yml) {
  const matches = [...yml.matchAll(/^([a-zA-Z][\w-]*):\s*$/mg)];
  return matches.map((m) => m[1]).filter((name) => !RESERVED_TOP_LEVEL_KEYS.includes(name));
}

/** Extracts a GitLab job's YAML block (zero-indent job header to the next zero-indent key). */
function extractGitlabJobBlock(yml, jobName) {
  const jobStart = yml.indexOf(`\n${jobName}:`);
  if (jobStart === -1) return null;
  const rest = yml.slice(jobStart + 1);
  const nextKeyMatch = rest.slice(1).match(/\n[a-zA-Z.][\w-]*:\s*\n/);
  return nextKeyMatch ? rest.slice(0, nextKeyMatch.index + 1) : rest;
}

test('drift-guard (GitLab): gitlab-governance.yml job-name set equals GOVERNANCE_JOBS (REQ-A2-5)', () => {
  const yml = readFileSync(GITLAB_GOVERNANCE_YML, 'utf8');
  const yamlJobNames = extractGitlabJobNames(yml);
  assert.deepEqual(
    [...new Set(yamlJobNames)].sort(),
    [...new Set(GOVERNANCE_JOBS)].sort(),
    `Drift detected: GOVERNANCE_JOBS=${JSON.stringify(GOVERNANCE_JOBS)} but ` +
    `gitlab-governance.yml job names=${JSON.stringify(yamlJobNames)}`
  );
});

for (const job of GOVERNANCE_JOBS) {
  const isDetection = DETECTION_JOBS.includes(job);
  test(`drift-guard (GitLab): "${job}" job ${isDetection ? 'carries' : 'does NOT carry'} allow_failure: true (REQ-A2-4, Amendment 3 — never flatten)`, () => {
    const yml = readFileSync(GITLAB_GOVERNANCE_YML, 'utf8');
    const block = extractGitlabJobBlock(yml, job);
    assert.ok(block, `${job} job not found in gitlab-governance.yml`);
    const hasAllowFailure = /allow_failure:\s*true/.test(block);
    assert.equal(
      hasAllowFailure, isDetection,
      isDetection
        ? `DETECTION job "${job}" must carry allow_failure: true`
        : `REQUIRED job "${job}" must NOT carry allow_failure: true (that would silently un-gate it)`
    );
  });
}

// ── CI wiring (GitLab side of the A2 phase 2 addendum, issue #231 A2 phase
// 3/4): CI_DEFAULT_BRANCH is a standard GitLab-predefined variable, always
// available to every job automatically — unlike GitHub Actions, no job
// `variables:`/env mapping is needed (the fragment's header comment
// documents this). This guard is the inverse of the GitHub-side wiring test
// above: it asserts NO job in gitlab-governance.yml locally overrides
// CI_DEFAULT_BRANCH, which would shadow the platform-provided value and
// silently reintroduce a hardcoded default-branch literal (exactly what the
// addendum exists to prevent). ─────────────────────────────────────────────

test('CI wiring (GitLab): gitlab-governance.yml never locally overrides CI_DEFAULT_BRANCH (must stay the platform-provided predefined var, never hardcoded)', () => {
  const yml = readFileSync(GITLAB_GOVERNANCE_YML, 'utf8');
  assert.doesNotMatch(
    yml, /CI_DEFAULT_BRANCH:\s*\S/,
    'gitlab-governance.yml must not assign a value to CI_DEFAULT_BRANCH — it is a standard predefined ' +
    'GitLab CI/CD variable, automatically available to every job; a local override would shadow the ' +
    'platform-provided default branch and reintroduce a hardcoded literal (the exact gap the A2 phase 2 addendum closed).'
  );
});

// ── Drift-guard extension (issue #231 CP-A2b live-validation finding #13):
// `node --test "brain/scripts/**/*.test.mjs"` (local-checks job) needs glob
// expansion support that only landed in Node 21+ — node:20 fails with
// "Could not find ...". The fix is a SINGLE global `default: image:` pin (one
// place, all 8 jobs inherit) rather than a per-job `image:` line, so a future
// consumer editing one job can never silently drift back to node:20. This
// guard asserts the global pin exists and is >= 22, so a consumer downgrading
// the fragment back to node:20 (the exact regression this fixes) turns RED —
// same class of protection as the allow_failure-iff-DETECTION lock above. ──
test('drift-guard (GitLab): gitlab-governance.yml pins a single global node:22+ image via `default:` (finding #13 — node --test glob expansion needs Node 21+; a per-job image: line, or a downgrade to node:20, must turn this RED)', () => {
  const yml = readFileSync(GITLAB_GOVERNANCE_YML, 'utf8');

  const defaultMatch = yml.match(/^default:\s*\n\s+image:\s*node:(\d+)/m);
  assert.ok(
    defaultMatch,
    'gitlab-governance.yml must declare a top-level `default:\\n  image: node:<N>` block — ' +
    'the sole place that pins the image for all 8 jobs.'
  );
  const pinnedVersion = Number(defaultMatch[1]);
  assert.ok(
    pinnedVersion >= 22,
    `gitlab-governance.yml's default image pins node:${pinnedVersion}, but node --test glob expansion ` +
    '("brain/scripts/**/*.test.mjs" in the local-checks job) requires Node 21+ — pin node:22 or later.'
  );

  // No per-job `image:` override may reintroduce a node:20/21 job-local pin —
  // the whole point of the global default is ONE place, not eight. Scoped to
  // each job's own block (not the whole file) so the `default:` block's own
  // `image:` line is never mistaken for a per-job override.
  for (const job of GOVERNANCE_JOBS) {
    const block = extractGitlabJobBlock(yml, job);
    assert.ok(block, `${job} job not found in gitlab-governance.yml`);
    assert.doesNotMatch(
      block, /^\s+image:\s*node:\d+/m,
      `"${job}" must NOT carry its own \`image:\` line — the global \`default:\` block is the ` +
      'single source of truth (a per-job override could silently drift back to node:20).'
    );
  }
});
