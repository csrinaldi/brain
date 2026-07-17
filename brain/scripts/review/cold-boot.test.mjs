// cold-boot.test.mjs — Unit tests for the reviewer's cold boot (REQ-H1-2,
// REQ-H1-3; design.md §4). No test spawns a real gh/glab/git process — every
// I/O seam is injected via `deps`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evaluateSelfReview, gatherColdBoot, defaultCloneDetached } from './cold-boot.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const PR = { project: 'csrinaldi/brain', number: 42, provider: 'github' };

// headRefOid now comes from prView (ADR-0021 Decision 3) — the H1-1 cold-boot
// `fetchHead` DI-seam reader is retired, no separate seam exists.
function baseDeps(overrides = {}) {
  return {
    fetchPr: async () => ({ number: 42, author: 'alice', labels: [], body: '', headRefOid: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' }),
    cloneDetached: async () => ({ detached: true }),
    readRecords: () => [],
    fetchReviews: async () => [],
    ...overrides,
  };
}

// ── evaluateSelfReview (pure) ────────────────────────────────────────────────

test('evaluateSelfReview: reviewer handle equals author → true', () => {
  assert.equal(evaluateSelfReview({ reviewerHandle: 'brain-reviewer', author: 'brain-reviewer' }), true);
});

test('evaluateSelfReview: reviewer handle differs from author → false', () => {
  assert.equal(evaluateSelfReview({ reviewerHandle: 'brain-reviewer', author: 'alice' }), false);
});

// ── gatherColdBoot: anchor is the API headRefOid, detached ──────────────────

test('gatherColdBoot: checks out detached at prView\'s headRefOid, never a branch name', async () => {
  const cloneCalls = [];
  const fetchPrCalls = [];
  const result = await gatherColdBoot({
    ...PR,
    reviewerHandle: 'brain-reviewer',
    deps: baseDeps({
      fetchPr: async (args) => {
        fetchPrCalls.push(args);
        return { number: 42, author: 'alice', labels: [], body: '', headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d' };
      },
      cloneDetached: async (args) => { cloneCalls.push(args); return { detached: true }; },
    }),
  });

  assert.equal(result.abstain, false);
  assert.equal(result.headSha, 'cafef00dcafef00dcafef00dcafef00dcafef00d');
  assert.equal(cloneCalls.length, 1);
  // The clone seam receives ONLY the sha — no `branch` key exists on the call.
  assert.deepEqual(cloneCalls[0], { sha: 'cafef00dcafef00dcafef00dcafef00dcafef00d' });
  assert.deepEqual(fetchPrCalls[0], { project: PR.project, number: PR.number, provider: PR.provider });
});

// ── gatherColdBoot: doctrine is only records + prior verdicts ───────────────

test('gatherColdBoot: doctrine loads decision|architecture records + prior brain-review/1 blocks, excludes note records', async () => {
  const records = [
    { type: 'decision', id: 'd1' },
    { type: 'architecture', id: 'a1' },
    { type: 'note', id: 'n1' },
  ];
  const reviews = [
    { state: 'COMMENTED', author: 'brain-reviewer', body: '```yaml\nprotocol: brain-review/1\nverdict: REVISE\nhead_sha: aaa\nrev: 0\n```' },
    { state: 'COMMENTED', author: 'bob', body: 'just a plain human comment' },
  ];

  const result = await gatherColdBoot({
    ...PR,
    reviewerHandle: 'brain-reviewer',
    deps: baseDeps({
      readRecords: () => records,
      fetchReviews: async () => reviews,
    }),
  });

  assert.equal(result.abstain, false);
  assert.deepEqual(result.doctrine.records, [
    { type: 'decision', id: 'd1' },
    { type: 'architecture', id: 'a1' },
  ]);
  assert.equal(result.doctrine.priorVerdicts.length, 1);
  assert.equal(result.doctrine.priorVerdicts[0].head_sha, 'aaa');
  assert.equal(result.doctrine.priorVerdicts[0].author, 'brain-reviewer');
});

// ── gatherColdBoot: self-review abstention (REQ-H1-3) ────────────────────────

test('gatherColdBoot: reviewer handle equals PR author → abstains, no doctrine load, no boot I/O', async () => {
  const calls = { cloneDetached: 0, readRecords: 0, fetchReviews: 0 };
  const result = await gatherColdBoot({
    ...PR,
    reviewerHandle: 'alice',
    deps: baseDeps({
      fetchPr: async () => ({ number: 42, author: 'alice', labels: [], body: '', headRefOid: 'x' }),
      cloneDetached: async () => { calls.cloneDetached++; },
      readRecords: () => { calls.readRecords++; return []; },
      fetchReviews: async () => { calls.fetchReviews++; return []; },
    }),
  });

  assert.equal(result.abstain, true);
  assert.equal(result.headSha, undefined);
  assert.deepEqual(calls, { cloneDetached: 0, readRecords: 0, fetchReviews: 0 });
});

// ── fetchHead seam retirement (ADR-0021 Decision 3, Fork A condition 2) ─────

test('cold-boot.mjs source carries no fetchHead seam or TODO(#266) retirement marker — retired, headRefOid now comes from prView', () => {
  const src = readFileSync(fileURLToPath(new URL('./cold-boot.mjs', import.meta.url)), 'utf8');
  assert.doesNotMatch(src, /fetchHead/i, 'the fetchHead DI-seam reader must be fully removed');
  assert.doesNotMatch(src, /defaultFetchHead/, 'defaultFetchHead must be fully removed');
  assert.doesNotMatch(src, /TODO\(#266\)/, 'the TODO(#266) retirement marker must be removed once retired');
});

// ── COLDBOOT-CWD (real default, issue #266): protocol §8 "own clone/worktree" ─
// The ONE test that exercises the REAL defaultCloneDetached against real git —
// only the network fetch is stubbed (I/O, not the isolation logic). It must
// create an isolated detached worktree and NEVER move the operator's HEAD.

test('COLDBOOT-CWD (real default): defaultCloneDetached checks out a SEPARATE detached worktree and never moves the operator HEAD', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'brain-review-op-'));
  const wtParent = mkdtempSync(join(tmpdir(), 'brain-review-wt-'));
  t.after(() => {
    try { git(repo, 'worktree', 'prune'); } catch { /* best effort */ }
    rmSync(repo, { recursive: true, force: true });
    rmSync(wtParent, { recursive: true, force: true });
  });

  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 't@t.t');
  git(repo, 'config', 'user.name', 't');
  writeFileSync(join(repo, 'f.txt'), 'hi');
  git(repo, 'add', 'f.txt');
  git(repo, 'commit', '-q', '-m', 'a');
  const sha = git(repo, 'rev-parse', 'HEAD');
  const branch = git(repo, 'symbolic-ref', '--short', 'HEAD');

  // Real default; only the network fetch is stubbed (the sha is already local).
  const clone = defaultCloneDetached({ cwd: repo, fetch: () => {}, tmp: wtParent })({ sha });

  // isolated worktree, detached at the reviewed sha
  assert.ok(existsSync(clone.worktreePath), 'an isolated worktree must be created');
  assert.equal(git(clone.worktreePath, 'rev-parse', 'HEAD'), sha, 'worktree HEAD is the reviewed sha');
  assert.throws(() => git(clone.worktreePath, 'symbolic-ref', '-q', 'HEAD'), 'worktree HEAD must be DETACHED (no branch ref)');

  // the operator's HEAD did NOT move — still on its branch, still at the same sha
  assert.equal(git(repo, 'symbolic-ref', '--short', 'HEAD'), branch, 'operator HEAD stays on its branch — never detached in cwd');
  assert.equal(git(repo, 'rev-parse', 'HEAD'), sha, 'operator HEAD did not move');
});
