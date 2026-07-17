// cli.test.mjs — Unit tests for the `brain:review` CLI skeleton (REQ-H1-5;
// design.md §2). No test spawns a real gh/glab/git process — identity and
// cold-boot seams are injected exactly like their own unit tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs, main } from './cli.mjs';

function spyVcs() {
  const calls = { prReviewComment: 0, issueComment: 0, labelAdd: 0, labelRemove: 0 };
  return {
    calls,
    prReviewComment: async () => { calls.prReviewComment++; return { url: 'unused' }; },
    issueComment: async () => { calls.issueComment++; return { url: 'unused' }; },
    labelAdd: async () => { calls.labelAdd++; return { ok: true }; },
    labelRemove: async () => { calls.labelRemove++; return { ok: true }; },
  };
}

function readyDeps({ vcs }) {
  return {
    project: 'csrinaldi/brain',
    provider: 'github',
    identityDeps: {
      readConfig: () => ({ handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
      readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
    },
    coldBootDeps: {
      fetchPr: async () => ({ number: 42, author: 'alice', labels: [], body: '' }),
      fetchHead: async () => 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      cloneDetached: async () => ({ detached: true }),
      readRecords: () => [],
      fetchReviews: async () => [],
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

// ── --dry-run: prints the verdict, posts nothing ────────────────────────────

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
  assert.deepEqual(vcs.calls, { prReviewComment: 0, issueComment: 0, labelAdd: 0, labelRemove: 0 });
});

test('main WITHOUT --dry-run also invokes zero write verbs — H1-1 has no poster yet', async () => {
  const vcs = spyVcs();
  const code = await main({ argv: ['--pr', '42'], log: () => {}, ...readyDeps({ vcs }) });
  assert.equal(code, 0);
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
      fetchHead: async () => { throw new Error('must not be called on abstain'); },
      cloneDetached: async () => { throw new Error('must not be called on abstain'); },
      readRecords: () => { throw new Error('must not be called on abstain'); },
      fetchReviews: async () => { throw new Error('must not be called on abstain'); },
    },
  });
  assert.equal(code, 0);
  assert.ok(lines.some(l => /abstain/i.test(l)));
  assert.deepEqual(vcs.calls, { prReviewComment: 0, issueComment: 0, labelAdd: 0, labelRemove: 0 });
});
