// cli.test.mjs — Unit tests for the `brain:review` CLI (REQ-H1-5, REQ-H1-7,
// REQ-H1-8, REQ-H1-9; design.md §2). No test spawns a real gh/glab/git
// process — identity, cold-boot, tranche, and poster seams are all injected,
// exactly like their own unit tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs, main } from './cli.mjs';
import { REQUIRED_JOBS } from '../vcs/governance-checks.mjs';

const HEAD = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

function spyVcs() {
  const calls = { prReviewComment: 0, issueComment: 0, labelAdd: 0, labelRemove: 0 };
  return {
    calls,
    prReviewComment: async () => { calls.prReviewComment++; return { url: 'unused' }; },
    issueComment: async () => { calls.issueComment++; return { url: 'unused' }; },
    labelAdd: async () => { calls.labelAdd++; return { ok: true }; },
    labelRemove: async () => { calls.labelRemove++; return { ok: true }; },
    prView: async () => { calls.prView = (calls.prView ?? 0) + 1; return { headRefOid: HEAD }; },
  };
}

function greenRollup() {
  return REQUIRED_JOBS.map(name => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
}

function readyDeps({ vcs, labels = [] } = {}) {
  return {
    project: 'csrinaldi/brain',
    provider: 'github',
    baseSha: 'BASE',
    getChangedFiles: () => [],
    identityDeps: {
      readConfig: () => ({ handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
      readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
    },
    coldBootDeps: {
      fetchPr: async () => ({ number: 42, author: 'alice', labels, body: '', headRefOid: HEAD }),
      cloneDetached: async () => ({ detached: true }),
      readRecords: () => [],
      fetchReviews: async () => [],
    },
    trancheDeps: {
      fetchRollup: async () => greenRollup(),
      diffNumstat: () => '10\t5\tfoo.mjs\n',
      readIgnoreList: () => [],
    },
    writeVerbs: vcs,
  };
}

// ── parseArgs ─────────────────────────────────────────────────────────────

test('parseArgs: --pr, --mode, --dry-run', () => {
  assert.deepEqual(parseArgs(['--pr', '42', '--mode', 'tranche', '--dry-run']), {
    pr: 42, mode: 'tranche', dryRun: true,
  });
});

test('parseArgs: defaults mode to auto, dryRun to false', () => {
  assert.deepEqual(parseArgs(['--pr', '7']), { pr: 7, mode: 'auto', dryRun: false });
});

// ── --dry-run: computes the real verdict, posts nothing ─────────────────────

test('main --dry-run: prints the verdict to stdout and invokes zero write verbs', async () => {
  const vcs = spyVcs();
  const lines = [];
  const code = await main({
    argv: ['--pr', '42', '--dry-run'],
    log: (s) => lines.push(s),
    ...readyDeps({ vcs }),
  });

  assert.equal(code, 0);
  assert.ok(lines.some(l => /protocol: brain-review\/1/.test(l)));
  assert.ok(lines.some(l => /verdict: APPROVE/.test(l)), 'green gates + budget in range → APPROVE');
  assert.deepEqual(vcs.calls, { prReviewComment: 0, issueComment: 0, labelAdd: 0, labelRemove: 0 });
});

// ── real posting: H1-2c wires the real poster ───────────────────────────────

test('main WITHOUT --dry-run (mode auto → tranche): posts the verdict via prReviewComment exactly once', async () => {
  const vcs = spyVcs();
  const lines = [];
  const code = await main({ argv: ['--pr', '42'], log: (s) => lines.push(s), ...readyDeps({ vcs }) });
  assert.equal(code, 0);
  assert.equal(vcs.calls.prReviewComment, 1);
  assert.equal(vcs.calls.issueComment, 0);
  assert.equal(vcs.calls.labelAdd, 0);
  assert.ok(lines.some(l => /protocol: brain-review\/1/.test(l)));
});

test('main: a failing required gate produces a REVISE verdict that still posts (the reviewer never approves/blocks merge itself)', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.trancheDeps.fetchRollup = async () =>
    greenRollup().map(g => (g.name === 'memory-gate' ? { ...g, conclusion: 'FAILURE' } : g));
  const lines = [];
  const code = await main({ argv: ['--pr', '42'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.ok(lines.some(l => /verdict: REVISE/.test(l)));
  assert.equal(vcs.calls.prReviewComment, 1);
});

// ── mode ruling/checkpoint: explicit not-yet-implemented stub, never silent ─

test('main: mode derives to "ruling" (needs-ruling label) → explicit not-yet-implemented, exits non-zero, posts nothing', async () => {
  const vcs = spyVcs();
  const errors = [];
  const code = await main({
    argv: ['--pr', '42'],
    log: () => {},
    error: (s) => errors.push(s),
    ...readyDeps({ vcs, labels: ['needs-ruling'] }),
  });
  assert.equal(code, 1);
  assert.ok(errors.some(l => /ruling/.test(l) && /not.*yet.*implement/i.test(l)));
  assert.deepEqual(vcs.calls, { prReviewComment: 0, issueComment: 0, labelAdd: 0, labelRemove: 0 });
});

test('main: an explicit --mode checkpoint → explicit not-yet-implemented, exits non-zero, posts nothing', async () => {
  const vcs = spyVcs();
  const errors = [];
  const code = await main({
    argv: ['--pr', '42', '--mode', 'checkpoint'],
    log: () => {},
    error: (s) => errors.push(s),
    ...readyDeps({ vcs }),
  });
  assert.equal(code, 1);
  assert.ok(errors.some(l => /checkpoint/.test(l) && /not.*yet.*implement/i.test(l)));
  assert.deepEqual(vcs.calls, { prReviewComment: 0, issueComment: 0, labelAdd: 0, labelRemove: 0 });
});

// ── absent token: fail-closed (wires Phase 2) ───────────────────────────────

test('main: absent BRAIN_REVIEWER_TOKEN exits non-zero with the fail-closed message', async () => {
  const errors = [];
  const code = await main({
    argv: ['--pr', '42'],
    error: (s) => errors.push(s),
    identityDeps: {
      readConfig: () => ({ tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
      readEnv: () => ({}),
      getPatUrl: async () => 'https://example.test/pat',
    },
  });
  assert.equal(code, 1);
  assert.ok(errors.some(l => /BRAIN_REVIEWER_TOKEN/.test(l)));
});

// ── self-review abstention wired end-to-end ─────────────────────────────────

test('main: self-review abstains, exits 0, posts nothing', async () => {
  const vcs = spyVcs();
  const lines = [];
  const code = await main({
    argv: ['--pr', '42'],
    log: (s) => lines.push(s),
    ...readyDeps({ vcs }),
    coldBootDeps: {
      fetchPr: async () => ({ number: 42, author: 'brain-reviewer', labels: [], body: '' }),
      cloneDetached: async () => { throw new Error('must not be called on abstain'); },
      readRecords: () => { throw new Error('must not be called on abstain'); },
      fetchReviews: async () => { throw new Error('must not be called on abstain'); },
    },
  });
  assert.equal(code, 0);
  assert.ok(lines.some(l => /abstain/i.test(l)));
  assert.deepEqual(vcs.calls, { prReviewComment: 0, issueComment: 0, labelAdd: 0, labelRemove: 0 });
});
