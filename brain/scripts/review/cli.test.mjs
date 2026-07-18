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

// ── mode ruling: wired (H1-4, REQ-H1-11) — Option (B), never auto-rules ─────

function validForkBody() {
  return [
    '## FORK',
    '',
    '### Option A',
    'cost: 2 days of rework',
    'consequence: widens the port surface',
    '',
    '### Option B',
    'cost: a new mini-port',
    'consequence: calcifies into a parallel seam',
    '',
    'Recommendation: Option A',
  ].join('\n');
}

test('main: mode derives to "ruling" (needs-ruling label) with a well-formed ## FORK → reaches evaluateRuling, posts STOP + escalate:human, never a ruled/APPROVE verdict', async () => {
  const vcs = spyVcs();
  const lines = [];
  const deps = readyDeps({ vcs, labels: ['needs-ruling'] });
  deps.coldBootDeps.fetchPr = async () => ({ number: 42, author: 'alice', labels: ['needs-ruling'], body: validForkBody(), headRefOid: HEAD });
  const code = await main({ argv: ['--pr', '42'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.ok(lines.some(l => /verdict: STOP/.test(l)));
  assert.ok(lines.some(l => /escalate: human/.test(l)));
  assert.ok(!lines.some(l => /verdict: APPROVE/.test(l)), 'the ruling evaluator never emits APPROVE');
  assert.equal(vcs.calls.issueComment, 1, 'ruling verdicts post via issueComment (R1, design.md §6), not prReviewComment');
  assert.equal(vcs.calls.prReviewComment, 0);
});

test('main: an explicit --mode ruling with a malformed ## FORK (single option) → REVISE, "a fork without options is a request to design", still posts', async () => {
  const vcs = spyVcs();
  const lines = [];
  const deps = readyDeps({ vcs });
  deps.coldBootDeps.fetchPr = async () => ({ number: 42, author: 'alice', labels: [], body: 'no fork section here', headRefOid: HEAD });
  const code = await main({ argv: ['--pr', '42', '--mode', 'ruling'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.ok(lines.some(l => /verdict: REVISE/.test(l)));
  assert.equal(vcs.calls.issueComment, 1);
});

// ── mode checkpoint: wired (H1-3) — REQ-H1-10 ───────────────────────────────

test('main: an explicit --mode checkpoint → wires gatherCheckpointInputs + evaluateCheckpoint, posts the verdict', async () => {
  const vcs = spyVcs();
  const lines = [];
  const deps = readyDeps({ vcs });
  deps.checkpointDeps = {
    baseSha: 'BASE',
    exists: () => true,
    listDir: () => [],
    readFile: () => { throw new Error('no checkpoint-report.md in this fixture'); },
    runReversion: async () => ({ uncomputable: false, command: 'cmd', vacuousTests: [] }),
    runAudit: () => '',
    runGovernanceStatus: () => '',
    trancheDeps: { fetchRollup: async () => greenRollup(), diffNumstat: () => '10\t5\tfoo.mjs\n', readIgnoreList: () => [] },
  };
  const code = await main({ argv: ['--pr', '42', '--mode', 'checkpoint'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.equal(vcs.calls.prReviewComment, 1);
  assert.ok(lines.some(l => /protocol: brain-review\/1/.test(l)));
});

test('main: --mode checkpoint with a genuinely uncomputable base (no ci-context, no port baseRefOid) → reversion skipped, fail-closed REVISE (never a silent APPROVE)', async () => {
  const vcs = spyVcs();
  const lines = [];
  const deps = readyDeps({ vcs });
  delete deps.baseSha; // no injected override
  deps.loadCiContext = async () => ({ baseSha: null }); // no CI env
  deps.coldBootDeps.fetchPr = async () => ({ number: 42, author: 'alice', labels: [], body: '', headRefOid: HEAD, baseRefOid: null }); // no port value
  let reversionCalled = false;
  deps.checkpointDeps = {
    exists: () => true,
    listDir: () => [],
    readFile: () => { throw new Error('no report'); },
    runReversion: async () => { reversionCalled = true; return { uncomputable: false, command: 'cmd', vacuousTests: [] }; },
    runAudit: () => '',
    runGovernanceStatus: () => '',
    trancheDeps: { fetchRollup: async () => greenRollup(), diffNumstat: () => '10\t5\tfoo.mjs\n', readIgnoreList: () => [] },
  };
  const code = await main({ argv: ['--pr', '42', '--mode', 'checkpoint', '--dry-run'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.equal(reversionCalled, false, 'a genuinely uncomputable base must skip the reversion, not run it against a bogus sha');
  assert.ok(lines.some(l => /verdict: REVISE/.test(l)));
  assert.ok(lines.some(l => /evidence uncomputable/.test(l)), 'the base is genuinely uncomputable → must fail closed');
});

test('main: --mode checkpoint local run (no ci-context) feeds boot.prView.baseRefOid into the checkpoint reversion — H1-2C-BASE closure reaches the checkpoint path', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  delete deps.baseSha; // exercise the port fallback, not the injected override
  deps.loadCiContext = async () => ({ baseSha: null }); // LOCAL run — ci-context unset
  deps.coldBootDeps.fetchPr = async () => ({
    number: 42, author: 'alice', labels: [], body: '', headRefOid: HEAD, baseRefOid: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });
  let reversionBaseSha;
  deps.checkpointDeps = {
    exists: () => true,
    listDir: () => [],
    readFile: () => { throw new Error('no report'); },
    runReversion: async ({ baseSha }) => { reversionBaseSha = baseSha; return { uncomputable: false, command: 'cmd', vacuousTests: [] }; },
    runAudit: () => '',
    runGovernanceStatus: () => '',
    trancheDeps: { fetchRollup: async () => greenRollup(), diffNumstat: () => '10\t5\tfoo.mjs\n', readIgnoreList: () => [] },
  };
  const lines = [];
  const code = await main({ argv: ['--pr', '42', '--mode', 'checkpoint', '--dry-run'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.equal(reversionBaseSha, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'the checkpoint reversion must receive the port-resolved baseSha, not null — the wiring that takes §10.4 live');
});

// ── escalation inbox wiring (H1-5b): cli passes verdict.escalate through ───
// to the poster, which applies needs-decision on escalate:'human'. ─────────

test('main: mode "ruling" with a well-formed FORK always escalates -> cli forwards escalate:"human" to the poster, which applies needs-decision', async () => {
  const vcs = spyVcs();
  const lines = [];
  const deps = readyDeps({ vcs, labels: ['needs-ruling'] });
  deps.coldBootDeps.fetchPr = async () => ({ number: 42, author: 'alice', labels: ['needs-ruling'], body: validForkBody(), headRefOid: HEAD });
  const code = await main({ argv: ['--pr', '42'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.ok(lines.some(l => /escalate: human/.test(l)));
  assert.equal(vcs.calls.labelAdd, 1, 'needs-decision must be applied when the verdict escalates to human');
});

test('main: mode "tranche" (no escalation) never calls labelAdd for needs-decision', async () => {
  const vcs = spyVcs();
  const lines = [];
  const code = await main({ argv: ['--pr', '42'], log: (s) => lines.push(s), ...readyDeps({ vcs }) });
  assert.equal(code, 0);
  assert.equal(vcs.calls.labelAdd, 0);
});

// ── subcommand dispatch (H1-5b, task 13.3): `queue`/`board` reach their own
// module's real composition function — proven end to end, not stubbed. ────

test('main("queue"): dispatches to queue.mjs\'s gatherQueue, prints the review queue AND the escalation inbox', async () => {
  const lines = [];
  const code = await main({
    argv: ['queue'],
    log: (s) => lines.push(s),
    project: 'csrinaldi/brain',
    provider: 'github',
    queueDeps: {
      listOpenPrs: async () => [{ number: 5, title: 'escalated one' }, { number: 2, title: 'plain review' }],
      fetchLabels: async ({ number }) => (number === 2 ? ['needs-review'] : ['needs-decision']),
    },
  });
  assert.equal(code, 0);
  assert.ok(lines.some(l => /#2\b.*plain review/.test(l)), 'the review queue section must list PR #2 (needs-review)');
  assert.ok(lines.some(l => /#5\b.*escalated one/.test(l)), 'the escalation inbox section must list PR #5 (needs-decision)');
});

test('main("board"): dispatches to board.mjs\'s runBoard, reconciles the open PRs it is given through the real deny-set', async () => {
  const labelAddCalls = [];
  const vcs = {
    labelAdd: async ({ labels }) => { labelAddCalls.push(labels); return { ok: true }; },
    labelRemove: async () => ({ ok: true }),
  };
  const code = await main({
    argv: ['board'],
    log: () => {},
    project: 'csrinaldi/brain',
    provider: 'github',
    boardDeps: {
      listOpenPrs: async () => [{ number: 9 }],
      fetchPr: async () => ({ number: 9, labels: [] }),
      fetchReviews: async () => [{
        state: 'COMMENTED',
        author: 'brain-reviewer',
        body: '```yaml\nprotocol: brain-review/1\nverdict: APPROVE\nhead_sha: a\nrev: 0\n```',
      }],
      getVcs: async () => vcs,
    },
  });
  assert.equal(code, 0);
  assert.deepEqual(labelAddCalls, [['reviewed:approved']], 'board must actually reconcile via the real reconcileOnePr/guardedLabelAdd path');
});

test('main: an ordinary run (--pr flag, no subcommand) is UNAFFECTED by the queue/board dispatch check', () => {
  assert.deepEqual(parseArgs(['--pr', '42']), { pr: 42, mode: 'auto', dryRun: false });
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

// ── H1-2C-BASE closure: local runs resolve baseSha from the port ────────────
// (ADR-0022 Decision 2). No ci-context.mjs BASE_SHA (a LOCAL run) + the
// port's prView.baseRefOid present → baseSha resolves from the port, the
// budget computes, the tranche path is NOT fail-closed. Mirrors the existing
// ci-context precedence: an explicit deps.baseSha still wins, then
// ctx?.baseSha (CI), then boot.prView.baseRefOid (the port, now the
// provider-agnostic default that also serves local runs).

test('main: local run (no ci-context baseSha) falls back to boot.prView.baseRefOid — H1-2C-BASE closes for the tranche path', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  delete deps.baseSha; // exercise the ctx?.baseSha ?? boot.prView.baseRefOid fallback, not the injected override
  deps.loadCiContext = async () => ({ baseSha: null }); // simulates a LOCAL run — ci-context unset
  deps.coldBootDeps.fetchPr = async () => ({
    number: 42, author: 'alice', labels: [], body: '', headRefOid: HEAD, baseRefOid: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });
  const seenBaseShas = [];
  deps.getChangedFiles = (baseSha) => { seenBaseShas.push(baseSha); return ['foo.mjs']; };
  const lines = [];
  const code = await main({ argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), ...deps });

  assert.equal(code, 0);
  assert.deepEqual(seenBaseShas, ['deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'], 'baseSha must resolve from the port when ci-context is unset locally');
  assert.ok(!lines.some(l => /evidence uncomputable/.test(l)), 'the budget dimension must not fail closed once baseSha resolves from the port');
  assert.ok(lines.some(l => /verdict: APPROVE/.test(l)), 'green gates + a resolved, in-range budget → APPROVE, proving the budget actually computed');
});

test('main: local run with no port baseRefOid either (uncomputable) still fails closed — the port widening never relaxes protocol §10', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  delete deps.baseSha;
  deps.loadCiContext = async () => ({ baseSha: null });
  deps.coldBootDeps.fetchPr = async () => ({ number: 42, author: 'alice', labels: [], body: '', headRefOid: HEAD, baseRefOid: null });
  const lines = [];
  const code = await main({ argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), ...deps });

  assert.equal(code, 0);
  assert.ok(lines.some(l => /verdict: REVISE/.test(l)));
  assert.ok(lines.some(l => /evidence uncomputable/.test(l)), 'baseSha genuinely uncomputable (no ci-context, no port value) must still fail closed');
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
