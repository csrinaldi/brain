// cold-boot.test.mjs — Unit tests for the reviewer's cold boot (REQ-H1-2,
// REQ-H1-3; design.md §4). No test spawns a real gh/glab/git process — every
// I/O seam is injected via `deps`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

import { evaluateSelfReview, gatherColdBoot, defaultCloneDetached } from './cold-boot.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const PR = { project: 'csrinaldi/brain', number: 42, provider: 'github' };

function baseDeps(overrides = {}) {
  return {
    fetchPr: async () => ({ number: 42, author: 'alice', labels: [], body: '' }),
    fetchHead: async () => 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
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

test('gatherColdBoot: checks out detached at the injected headRefOid, never a branch name', async () => {
  const cloneCalls = [];
  const fetchHeadCalls = [];
  const result = await gatherColdBoot({
    ...PR,
    reviewerHandle: 'brain-reviewer',
    deps: baseDeps({
      fetchHead: async (args) => { fetchHeadCalls.push(args); return 'cafef00dcafef00dcafef00dcafef00dcafef00d'; },
      cloneDetached: async (args) => { cloneCalls.push(args); return { detached: true }; },
    }),
  });

  assert.equal(result.abstain, false);
  assert.equal(result.headSha, 'cafef00dcafef00dcafef00dcafef00dcafef00d');
  assert.equal(cloneCalls.length, 1);
  // The clone seam receives ONLY the sha — no `branch` key exists on the call.
  assert.deepEqual(cloneCalls[0], { sha: 'cafef00dcafef00dcafef00dcafef00dcafef00d' });
  assert.deepEqual(fetchHeadCalls[0], { project: PR.project, number: PR.number, provider: PR.provider });
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
  const calls = { fetchHead: 0, cloneDetached: 0, readRecords: 0, fetchReviews: 0 };
  const result = await gatherColdBoot({
    ...PR,
    reviewerHandle: 'alice',
    deps: baseDeps({
      fetchPr: async () => ({ number: 42, author: 'alice', labels: [], body: '' }),
      fetchHead: async () => { calls.fetchHead++; return 'x'; },
      cloneDetached: async () => { calls.cloneDetached++; },
      readRecords: () => { calls.readRecords++; return []; },
      fetchReviews: async () => { calls.fetchReviews++; return []; },
    }),
  });

  assert.equal(result.abstain, true);
  assert.equal(result.headSha, undefined);
  assert.deepEqual(calls, { fetchHead: 0, cloneDetached: 0, readRecords: 0, fetchReviews: 0 });
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
