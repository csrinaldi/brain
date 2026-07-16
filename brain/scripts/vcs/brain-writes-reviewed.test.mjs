// brain-writes-reviewed.test.mjs — Unit tests for evaluateBrainWritesReviewed
// (REQ-L6-1 evidence path, design §6.1) and the gh I/O wrapper + CLI.
// Run with: npm test (node --test).
//
// Wrapper tests use plain-data fakes injected via `deps` — no test spawns a real
// `gh` or `git` process (CI-fragility discipline, same as actor-check.test.mjs
// and phase-order-check.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { setSpawn } from './lib/exec.mjs';

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

test('gatherBrainWritesReviewedInputs: resolves changedFiles via diffNameOnly, reviews via fetchReviews, allowlist via readBotAllowlist', async () => {
  const deps = makeFakeDeps({
    changedFiles: ['brain/core/foo.mjs'],
    reviews: [{ state: 'APPROVED', author: 'bob' }],
    botAllowlist: ['release-bot'],
  });
  const inputs = await gatherBrainWritesReviewedInputs({
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

test('gatherBrainWritesReviewedInputs: adminOverride true only when an override:* label is BOTH present and allow-listed', async () => {
  const deps = makeFakeDeps({ botAllowlist: ['override:incident-response'] });
  const inputs = await gatherBrainWritesReviewedInputs({
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

test('gatherBrainWritesReviewedInputs: an override:* label present but NOT allow-listed does not grant adminOverride (no blanket bypass)', async () => {
  const deps = makeFakeDeps({ botAllowlist: [] });
  const inputs = await gatherBrainWritesReviewedInputs({
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

// FIX1-style fail-open guard (unpaginated gh api list fetch truncates to page
// 1) now lives with the code it guards: EXTRACTED into
// github.mjs#prReviews (issue #239 A3 TASK2/4th-violation fix) — see
// providers.test.mjs's "github.prReviews source includes --paginate".

// ── runBrainWritesReviewedCheck / main — never throws, degrades to warn on
// failure. Async as of A3 TASK2 (the default fetchReviews wrapper awaits the
// prReviews CONTRACT verb dispatched via getVcs — a Promise-returning call).

test('runBrainWritesReviewedCheck: gh api failure inside the wrapper → warn + pass, never throws', async () => {
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
  const result = await runBrainWritesReviewedCheck(deps);
  assert.equal(result.level, 'warn');
});

test('runBrainWritesReviewedCheck: missing BASE_SHA/HEAD_SHA/PR_NUMBER/repo/author context → warn + pass, never throws', async () => {
  const result = await runBrainWritesReviewedCheck({ baseSha: undefined, headSha: undefined, repo: undefined, prNumber: undefined, author: undefined });
  assert.equal(result.level, 'warn');
});

test('runBrainWritesReviewedCheck: happy path end-to-end through the wrapper — human approval passes', async () => {
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
  const result = await runBrainWritesReviewedCheck(deps);
  assert.equal(result.level, 'pass');
});

// ── main() / CLI — exit code mapping ────────────────────────────────────────────

async function captureLogs(fn) {
  const lines = [];
  const orig = console.log;
  console.log = msg => lines.push(msg);
  try {
    await fn();
  } finally {
    console.log = orig;
  }
  return lines;
}

test('main: fail verdict → exit code 1', async () => {
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
  const lines = await captureLogs(async () => {
    exitCode = await main(deps);
  });
  assert.equal(exitCode, 1);
  assert.equal(lines[0], 'brain-writes-reviewed: fail');
});

test('main: warn verdict → exit code 0', async () => {
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
  const lines = await captureLogs(async () => {
    exitCode = await main(deps);
  });
  assert.equal(exitCode, 0);
  assert.equal(lines[0], 'brain-writes-reviewed: warn');
});

test('main: pass verdict → exit code 0', async () => {
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
  const lines = await captureLogs(async () => {
    exitCode = await main(deps);
  });
  assert.equal(exitCode, 0);
  assert.equal(lines[0], 'brain-writes-reviewed: pass');
});

// ── ci-context seam wiring (ADR-0016) ─────────────────────────────────────────
//
// baseSha/headSha/prNumber/repo/author/prLabels now source from an injected
// `deps.ctx` (ci-context.mjs's loadContext()) instead of process.env.
// `ctx.labels` (already an array) replaces the PR_LABELS env parsing.

test('ci-context seam: deps.ctx feeds baseSha/headSha/prNumber/repo/author/prLabels when deps.* are absent', async () => {
  const deps = {
    ctx: {
      baseSha: 'base', headSha: 'head', prNumber: 144, repo: 'org/repo',
      author: 'alice', labels: ['override:incident-response'],
    },
    diffNameOnly: () => ['brain/core/foo.mjs'],
    fetchReviews: () => [{ state: 'APPROVED', author: 'bob' }],
    readBotAllowlist: () => ['override:incident-response'],
  };
  const result = await runBrainWritesReviewedCheck(deps);
  assert.equal(result.level, 'pass');
});

test('ci-context seam: no ctx and no deps.* context → warn (never reads process.env directly)', async () => {
  const result = await runBrainWritesReviewedCheck({ ctx: {} });
  assert.equal(result.level, 'warn');
});

test('ci-context seam: ctx.labels (array) feeds adminOverride resolution directly — no PR_LABELS string parsing needed', async () => {
  const deps = {
    ctx: {
      baseSha: 'base', headSha: 'head', prNumber: 144, repo: 'org/repo',
      author: 'alice', labels: ['override:incident-response'],
    },
    diffNameOnly: () => ['brain/core/foo.mjs'],
    fetchReviews: () => [{ state: 'APPROVED', author: 'alice' }], // self-approval — would fail without override
    readBotAllowlist: () => ['override:incident-response'],
  };
  const result = await runBrainWritesReviewedCheck(deps);
  assert.equal(result.level, 'pass');
  assert.match(result.reason, /override/i);
});

test('drift-guard: brain-writes-reviewed.mjs source never reads process.env.PR_LABELS/PR_AUTHOR/BASE_SHA/HEAD_SHA/PR_NUMBER/GITHUB_REPOSITORY directly', () => {
  const srcPath = fileURLToPath(new URL('./brain-writes-reviewed.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  for (const v of ['PR_LABELS', 'PR_AUTHOR', 'BASE_SHA', 'HEAD_SHA', 'PR_NUMBER', 'GITHUB_REPOSITORY']) {
    assert.equal(src.includes(`process.env.${v}`), false, `source must not reference process.env.${v}`);
  }
});

test('neutrality source-scan (REQ-NEUTRALITY-2): brain-writes-reviewed.mjs source contains no .claude or SKILL.md literal', () => {
  const srcPath = fileURLToPath(new URL('./brain-writes-reviewed.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.equal(src.includes('.claude'), false, 'source must not reference .claude');
  assert.equal(src.includes('SKILL.md'), false, 'source must not reference SKILL.md');
});

// ── A3 TASK2 (fresh-context review's class-closure audit — the 4th VIOLATION):
// defaultFetchReviews was STILL gh-CLI-hardcoded, the SAME defect class as
// finding #14 (issue-link) and the pre-fix labelEvents/fetchIssue wrappers in
// actor-check.mjs — on GitLab CI (no `gh` binary) it threw ENOENT, masking
// the L6 gate behind a permanent `warn`. Per lesson #10/#12, this test does
// NOT inject deps.fetchReviews — it mocks ONE layer lower, at getVcs, so the
// REAL defaultFetchReviews wrapper runs end-to-end.

test('A3 TASK2: GitLab self-approval on a brain/core change via the REAL default path (no injected fetchReviews) — defaultFetchReviews dispatches getVcs({provider}).prReviews(...), no gh/glab spawn, evaluateBrainWritesReviewed reaches fail', async () => {
  let receivedProvider;
  let calledParams;
  let spawnCalled = false;
  const fakeVcs = {
    prReviews: async (params) => {
      calledParams = params;
      return [{ state: 'APPROVED', author: 'alice' }];
    },
  };
  setSpawn(() => {
    spawnCalled = true;
    return { status: 0, stdout: '{}', stderr: '' };
  });
  try {
    const result = await runBrainWritesReviewedCheck({
      baseSha: 'base',
      headSha: 'head',
      prNumber: 144,
      repo: 'g/r',
      author: 'alice',
      prLabels: [],
      provider: 'gitlab',
      diffNameOnly: () => ['brain/core/foo.mjs'],
      getVcs: async (opts) => { receivedProvider = opts.provider; return fakeVcs; },
      readBotAllowlist: () => [],
      // deliberately NOT fetchReviews — exercising the REAL default wrapper.
    });

    assert.equal(spawnCalled, false, 'the GitLab default path must never spawn a CLI process (gh/glab)');
    assert.equal(receivedProvider, 'gitlab', 'getVcs must be called with the runtime ctx.provider (finding #14)');
    assert.equal(calledParams.project, 'g/r');
    assert.equal(calledParams.number, 144);
    assert.equal(result.level, 'fail', 'self-approval on brain/core must EVALUATE to fail via the real default path');
    assert.match(result.reason, /self/i);
  } finally {
    setSpawn(spawnSync);
  }
});

test('A3 TASK2 source-scan: defaultFetchReviews no longer contains execFileSync(\'gh\', ...) — structurally proves the default path cannot spawn gh regardless of provider', () => {
  const srcPath = fileURLToPath(new URL('./brain-writes-reviewed.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  const fnStart = src.indexOf('function defaultFetchReviews');
  assert.notEqual(fnStart, -1, 'defaultFetchReviews not found in source');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
  assert.equal(fnBody.includes('execFileSync'), false, 'defaultFetchReviews must dispatch via getVcs(...).prReviews(...), never a raw execFileSync(\'gh\', ...) call');
  assert.match(fnBody, /getVcs|prReviews/, 'sanity: dispatch through the vcs adapter is present');
});

// ── governance.reviewActors wiring (issue #266, design §3 two-key split) ──────
//
// L6's default botAllowlist reader must also read the NEW governance.reviewActors
// key and thread it into botAllowlist, in addition to governance.approvalActors —
// L5 (actor-check.mjs) is untouched and keeps reading approvalActors only.

test('governance.reviewActors (issue #266): L6 default botAllowlist reader unions governance.approvalActors and governance.reviewActors', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-config-'));
  writeFileSync(join(dir, 'brain.config.json'), JSON.stringify({
    governance: {
      approvalActors: ['release-bot'],
      reviewActors: ['brain-reviewer[bot]'],
    },
  }));
  const inputs = await gatherBrainWritesReviewedInputs({
    baseSha: 'base',
    headSha: 'head',
    prNumber: 144,
    repo: 'org/repo',
    author: 'alice',
    prLabels: [],
    cwd: dir,
    deps: {
      diffNameOnly: () => ['brain/core/foo.mjs'],
      fetchReviews: () => [],
      // deliberately NOT injecting readBotAllowlist — exercising the REAL
      // default reader, which must union both governance keys.
    },
  });
  assert.deepEqual(
    new Set(inputs.botAllowlist),
    new Set(['release-bot', 'brain-reviewer[bot]']),
    'L6 botAllowlist must include identities from BOTH governance.approvalActors and governance.reviewActors',
  );
});

// ── REQ-266-6 t2 (issue #266, rev-2 binding condition B, lock 3) ──────────────
//
// The reviewer identity (test fixture — task 7.3 is deferred, no real reviewer
// bot handle exists yet) is registered in governance.reviewActors and threaded
// into L6's botAllowlist. An APPROVED review it authors must NOT be counted as
// the human review.

test('REQ-266-6 t2 (lock-3, issue #266): reviewer identity in governance.reviewActors is excluded from L6\'s human-approver count — an APPROVED review it authors does not satisfy brain-writes-reviewed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-config-'));
  writeFileSync(join(dir, 'brain.config.json'), JSON.stringify({
    governance: { approvalActors: [], reviewActors: ['brain-reviewer[bot]'] },
  }));
  const result = await runBrainWritesReviewedCheck({
    baseSha: 'base',
    headSha: 'head',
    prNumber: 144,
    repo: 'org/repo',
    author: 'alice',
    prLabels: [],
    cwd: dir,
    diffNameOnly: () => ['brain/core/foo.mjs'],
    fetchReviews: () => [{ state: 'APPROVED', author: 'brain-reviewer[bot]' }],
    // deliberately NOT injecting readBotAllowlist — exercising the REAL default
    // reader, which must thread governance.reviewActors into botAllowlist.
  });
  assert.notEqual(result.level, 'pass', 'an APPROVED review authored only by the reviewer identity must never satisfy the Tier-2 human-review gate');
  assert.equal(result.level, 'fail', 'the only APPROVED reviewer is bot-allow-listed (via governance.reviewActors) — same outcome as any bot-only approval');
});
