// brain-writes-reviewed.test.mjs — Unit tests for evaluateBrainWritesReviewed
// (REQ-L6-1 evidence path, design §6.1) and the gh I/O wrapper + CLI.
// Run with: npm test (node --test).
//
// Wrapper tests use plain-data fakes injected via `deps` — no test spawns a real
// `gh` or `git` process (CI-fragility discipline, same as actor-check.test.mjs
// and phase-order-check.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  evaluateBrainWritesReviewed,
  gatherBrainWritesReviewedInputs,
  runBrainWritesReviewedCheck,
  main,
} from './brain-writes-reviewed.mjs';

// ── Pure evaluator — evaluateBrainWritesReviewed (design §6.1) ────────────────

test('no brain/core or brain/project touched → pass (no Tier-2 requirement)', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['README.md', 'src/app.ts'],
    reviews: [],
    author: 'alice',
  });
  assert.equal(result.level, 'pass');
  assert.match(result.reason, /no brain/i);
});

test('touchesBrain matches brain/project/** too, not only brain/core/**', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['brain/project/notes.md'],
    reviews: [{ state: 'APPROVED', author: 'bob' }],
    author: 'alice',
  });
  assert.equal(result.level, 'pass');
  assert.match(result.reason, /bob/);
});

test('approver !== author, not bot-allow-listed → pass', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['brain/core/managed-paths.mjs'],
    reviews: [{ state: 'APPROVED', author: 'bob' }],
    author: 'alice',
  });
  assert.equal(result.level, 'pass');
  assert.match(result.reason, /bob/);
});

test('only self-approval (author is sole approver) → fail', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['brain/core/managed-paths.mjs'],
    reviews: [{ state: 'APPROVED', author: 'alice' }],
    author: 'alice',
  });
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /self/i);
});

test('adminOverride: allow-listed override:* label present → pass, logged (bypasses self-approval fail)', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['brain/core/managed-paths.mjs'],
    reviews: [{ state: 'APPROVED', author: 'alice' }],
    author: 'alice',
    adminOverride: true,
  });
  assert.equal(result.level, 'pass');
  assert.match(result.reason, /override/i);
});

test('no reviews at all (missing/unsupported reviews API) → warn + pass, never crashes', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['brain/core/managed-paths.mjs'],
    reviews: [],
    author: 'alice',
  });
  assert.equal(result.level, 'warn');
  assert.match(result.reason, /review/i);
});

test('reviews exist but zero APPROVED (only COMMENTED/CHANGES_REQUESTED) → warn + pass', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['brain/core/managed-paths.mjs'],
    reviews: [
      { state: 'COMMENTED', author: 'bob' },
      { state: 'CHANGES_REQUESTED', author: 'carol' },
    ],
    author: 'alice',
  });
  assert.equal(result.level, 'warn');
});

test('mixed states: only APPROVED reviews count toward approvers (a COMMENTED-only reviewer does not save a self-approval)', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['brain/core/managed-paths.mjs'],
    reviews: [
      { state: 'APPROVED', author: 'alice' },
      { state: 'COMMENTED', author: 'bob' },
    ],
    author: 'alice',
  });
  assert.equal(result.level, 'fail');
});

test('mixed states: a real human APPROVED review passes even alongside unrelated COMMENTED noise', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['brain/core/managed-paths.mjs'],
    reviews: [
      { state: 'COMMENTED', author: 'carol' },
      { state: 'APPROVED', author: 'bob' },
    ],
    author: 'alice',
  });
  assert.equal(result.level, 'pass');
});

test('dedup: the same approver appearing twice (re-approval after re-request) is deduped, still fails on self-approval', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['brain/core/managed-paths.mjs'],
    reviews: [
      { state: 'APPROVED', author: 'alice' },
      { state: 'APPROVED', author: 'alice' },
    ],
    author: 'alice',
  });
  assert.equal(result.level, 'fail');
});

test('bot-only approval (approver is bot-allow-listed, distinct from author but not human) → fail', () => {
  const result = evaluateBrainWritesReviewed({
    changedFiles: ['brain/core/managed-paths.mjs'],
    reviews: [{ state: 'APPROVED', author: 'release-bot' }],
    author: 'alice',
    botAllowlist: ['release-bot'],
  });
  assert.equal(result.level, 'fail');
});

// ── gh/git I/O wrapper — gatherBrainWritesReviewedInputs (DI fakes, no real gh/git) ─

function makeFakeDeps({ changedFiles = [], reviews = [], botAllowlist = [] } = {}) {
  return {
    diffNameOnly: () => changedFiles,
    fetchReviews: () => reviews,
    readBotAllowlist: () => botAllowlist,
  };
}

test('gatherBrainWritesReviewedInputs: resolves changedFiles via diffNameOnly, reviews via fetchReviews, allowlist via readBotAllowlist', () => {
  const deps = makeFakeDeps({
    changedFiles: ['brain/core/foo.mjs'],
    reviews: [{ state: 'APPROVED', author: 'bob' }],
    botAllowlist: ['release-bot'],
  });
  const inputs = gatherBrainWritesReviewedInputs({
    baseSha: 'base',
    headSha: 'head',
    prNumber: 144,
    repo: 'org/repo',
    author: 'alice',
    prLabels: [],
    deps,
  });
  assert.deepEqual(inputs.changedFiles, ['brain/core/foo.mjs']);
  assert.deepEqual(inputs.reviews, [{ state: 'APPROVED', author: 'bob' }]);
  assert.deepEqual(inputs.botAllowlist, ['release-bot']);
  assert.equal(inputs.author, 'alice');
  assert.equal(inputs.adminOverride, false);
});

test('gatherBrainWritesReviewedInputs: adminOverride true only when an override:* label is BOTH present and allow-listed', () => {
  const deps = makeFakeDeps({ botAllowlist: ['override:incident-response'] });
  const inputs = gatherBrainWritesReviewedInputs({
    baseSha: 'base',
    headSha: 'head',
    prNumber: 144,
    repo: 'org/repo',
    author: 'alice',
    prLabels: ['override:incident-response'],
    deps,
  });
  assert.equal(inputs.adminOverride, true);
});

test('gatherBrainWritesReviewedInputs: an override:* label present but NOT allow-listed does not grant adminOverride (no blanket bypass)', () => {
  const deps = makeFakeDeps({ botAllowlist: [] });
  const inputs = gatherBrainWritesReviewedInputs({
    baseSha: 'base',
    headSha: 'head',
    prNumber: 144,
    repo: 'org/repo',
    author: 'alice',
    prLabels: ['override:unlisted'],
    deps,
  });
  assert.equal(inputs.adminOverride, false);
});

// ── FIX1-style fail-open guard: unpaginated gh api list fetch truncates to page 1 ─
//
// `gh api` does NOT auto-paginate. A PR reviews list can exceed one page on a
// long-lived PR with many re-review cycles — an unpaginated fetch can silently
// drop later reviews (including the one human APPROVED review that would flip
// self-approval to pass, or vice-versa). Guard via source-scan (mirrors
// actor-check.test.mjs's FIX1 guard).

test('fail-open guard: defaultFetchReviews source includes --paginate on the gh api reviews call', () => {
  const srcPath = fileURLToPath(new URL('./brain-writes-reviewed.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  const fnStart = src.indexOf('function defaultFetchReviews');
  assert.notEqual(fnStart, -1, 'defaultFetchReviews not found in source');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
  assert.match(fnBody, /pulls\/\$\{prNumber\}\/reviews/, 'sanity: PR reviews endpoint present');
  assert.match(
    fnBody,
    /--paginate/,
    'reviews fetch must use --paginate — otherwise a truncated page 1 can hide later reviews (fail-open/fail-closed risk)'
  );
});

// ── runBrainWritesReviewedCheck / main — never throws, degrades to warn on failure ─

test('runBrainWritesReviewedCheck: gh api failure inside the wrapper → warn + pass, never throws', () => {
  const deps = {
    baseSha: 'base',
    headSha: 'head',
    prNumber: 144,
    repo: 'org/repo',
    author: 'alice',
    prLabels: [],
    diffNameOnly: () => ['brain/core/foo.mjs'],
    fetchReviews: () => {
      throw new Error('gh api failed: rate limited');
    },
    readBotAllowlist: () => [],
  };
  assert.doesNotThrow(() => {
    const result = runBrainWritesReviewedCheck(deps);
    assert.equal(result.level, 'warn');
  });
});

test('runBrainWritesReviewedCheck: missing BASE_SHA/HEAD_SHA/PR_NUMBER/repo/author context → warn + pass, never throws', () => {
  const result = runBrainWritesReviewedCheck({ baseSha: undefined, headSha: undefined, repo: undefined, prNumber: undefined, author: undefined });
  assert.equal(result.level, 'warn');
});

test('runBrainWritesReviewedCheck: happy path end-to-end through the wrapper — human approval passes', () => {
  const deps = {
    baseSha: 'base',
    headSha: 'head',
    prNumber: 144,
    repo: 'org/repo',
    author: 'alice',
    prLabels: [],
    diffNameOnly: () => ['brain/core/foo.mjs'],
    fetchReviews: () => [{ state: 'APPROVED', author: 'bob' }],
    readBotAllowlist: () => [],
  };
  const result = runBrainWritesReviewedCheck(deps);
  assert.equal(result.level, 'pass');
});

// ── main() / CLI — exit code mapping ────────────────────────────────────────────

function captureLogs(fn) {
  const lines = [];
  const orig = console.log;
  console.log = msg => lines.push(msg);
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return lines;
}

test('main: fail verdict → exit code 1', () => {
  const deps = {
    baseSha: 'base',
    headSha: 'head',
    prNumber: 144,
    repo: 'org/repo',
    author: 'alice',
    prLabels: [],
    diffNameOnly: () => ['brain/core/foo.mjs'],
    fetchReviews: () => [{ state: 'APPROVED', author: 'alice' }],
    readBotAllowlist: () => [],
  };
  let exitCode;
  const lines = captureLogs(() => {
    exitCode = main(deps);
  });
  assert.equal(exitCode, 1);
  assert.equal(lines[0], 'brain-writes-reviewed: fail');
});

test('main: warn verdict → exit code 0', () => {
  const deps = {
    baseSha: 'base',
    headSha: 'head',
    prNumber: 144,
    repo: 'org/repo',
    author: 'alice',
    prLabels: [],
    diffNameOnly: () => ['brain/core/foo.mjs'],
    fetchReviews: () => [],
    readBotAllowlist: () => [],
  };
  let exitCode;
  const lines = captureLogs(() => {
    exitCode = main(deps);
  });
  assert.equal(exitCode, 0);
  assert.equal(lines[0], 'brain-writes-reviewed: warn');
});

test('main: pass verdict → exit code 0', () => {
  const deps = {
    baseSha: 'base',
    headSha: 'head',
    prNumber: 144,
    repo: 'org/repo',
    author: 'alice',
    prLabels: [],
    diffNameOnly: () => ['README.md'],
    fetchReviews: () => [],
    readBotAllowlist: () => [],
  };
  let exitCode;
  const lines = captureLogs(() => {
    exitCode = main(deps);
  });
  assert.equal(exitCode, 0);
  assert.equal(lines[0], 'brain-writes-reviewed: pass');
});
