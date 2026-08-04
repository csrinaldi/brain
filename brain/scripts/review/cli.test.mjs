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
      // #413: the token resolves to the configured handle — verification passes.
      whoami: async () => ({ username: 'brain-reviewer' }),
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
      // Pinned to 'standard' (issue #358 Q5 Phase 5 review finding 2):
      // gatherTrancheInputs now resolves requiredJobs/detectionJobs from the
      // repo's OWN declared tier (brain.config.json) rather than the stale
      // REQUIRED_JOBS/DETECTION_JOBS snapshot these fixtures import — pin the
      // tier explicitly so these tests stay deterministic and decoupled from
      // brain's own real declared tier ('lite'), which demotes memory-gate/
      // phase-order to detection and would otherwise change which findings
      // are blockers here.
      tier: 'standard',
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

// ── brain-review/2 protocol activation (issue #391 T2.3 §3/§5, issue #394 M3) ──
// Tier resolves the protocol: lite/standard default to `/1` (unchanged,
// findings never carry evidence_class/causal_disposition); regulated
// defaults to `/2` and runs findings through lib/causal-admission.mjs before
// buildVerdict, so every finding is annotated (never left `unknown` —
// no escalation-storm).

test('main: lite tier (brain\'s own declared tier, no override) → brain-review/1, findings carry no evidence_class/causal_disposition', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.tier = 'lite';
  deps.trancheDeps.fetchRollup = async () =>
    greenRollup().map(g => (g.name === 'memory-gate' ? { ...g, conclusion: 'FAILURE' } : g));
  const lines = [];
  const code = await main({ argv: ['--pr', '42'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.ok(lines.some(l => /protocol: brain-review\/1/.test(l)));
  assert.ok(!lines.some(l => /evidence_class:/.test(l)), '/1 must never render evidence_class');
  assert.ok(!lines.some(l => /causal_disposition:/.test(l)), '/1 must never render causal_disposition');
});

test('main: regulated tier → brain-review/2, a blocker finding is annotated evidence_class:deterministic + causal_disposition:introduced, and does NOT escalate (no escalation-storm)', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.tier = 'regulated';
  deps.trancheDeps.fetchRollup = async () =>
    greenRollup().map(g => (g.name === 'memory-gate' ? { ...g, conclusion: 'FAILURE' } : g));
  const lines = [];
  const code = await main({ argv: ['--pr', '42'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.ok(lines.some(l => /protocol: brain-review\/2/.test(l)));
  assert.ok(lines.some(l => /verdict: REVISE/.test(l)));
  assert.ok(lines.some(l => /evidence_class: deterministic/.test(l)));
  assert.ok(lines.some(l => /causal_disposition: introduced/.test(l)));
  assert.ok(!lines.some(l => /escalate: human/.test(l)), 'a deterministic, causally-introduced blocker must never force an escalation storm');
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

// ── §10 self-review FAILS CLOSED on an unset reviewer.handle (issue #382) ────
// This inverts P290-ABSTAIN-FAIL-OPEN, whose fail-open was scoped to the
// window before task 7.3 shipped a reviewer identity (#367). With a handle now
// expected, an empty one leaves BOTH the §10 abstention and the anti-loop lock
// (poster.mjs matches `lastVerdict.author` against the handle) inert — so the
// run must refuse at boot rather than post an unbounded verdict under an
// unverifiable identity. Exit 1, and no port write is attempted.
test('main: an unset reviewer.handle refuses at boot — §10 and the anti-loop lock fail closed (#382)', async () => {
  const errors = [];
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.identityDeps = {
    readConfig: () => ({ tokenEnv: 'BRAIN_REVIEWER_TOKEN' }), // handle unset
    readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
  };
  const code = await main({ argv: ['--pr', '42', '--dry-run'], log: () => {}, error: (s) => errors.push(s), ...deps });
  assert.equal(code, 1, 'an unset reviewer.handle must refuse the run, not proceed');
  assert.ok(
    errors.some(l => /refusing to run/.test(l) && /reviewer\.handle/.test(l)),
    'the refusal must name reviewer.handle as the missing configuration',
  );
  assert.ok(
    errors.some(l => /anti-loop/.test(l)),
    'the refusal must state that the anti-loop lock is inert too — not only §10',
  );
  assert.equal(vcs.calls.prReviewComment, 0, 'refusing at boot must post no verdict');
  assert.equal(vcs.calls.issueComment, 0, 'refusing at boot must post no ruling');
});

// ── #413: the handle is VERIFIED against the token, not taken on faith ──────
// Sibling of #382 — there the handle was EMPTY; here it is UNVERIFIED. The
// ticket's reproduction: config claims a bot handle, the token belongs to the
// PR author, and §10 abstention compares bot-vs-author → no abstention. The
// fix resolves the token's real login via whoami({ token }) at boot and
// refuses on disagreement, so the forged run never reaches cold-boot.

test('main: a token whose real login disagrees with reviewer.handle refuses at boot (#413)', async () => {
  const errors = [];
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  // The #413 reproduction: config claims the bot, the token is the author's.
  deps.identityDeps.whoami = async () => ({ username: 'csrinaldi' });
  const code = await main({ argv: ['--pr', '42', '--dry-run'], log: () => {}, error: (s) => errors.push(s), ...deps });
  assert.equal(code, 1, 'a mismatched token identity must refuse the run, not proceed');
  assert.ok(
    errors.some(l => /csrinaldi/.test(l) && /brain-reviewer/.test(l)),
    'the refusal must name BOTH identities — the claimed handle and the token\'s real login',
  );
  assert.equal(vcs.calls.prReviewComment, 0, 'refusing at boot must post no verdict');
});

test('main: whoami rejection refuses at boot — never proceed on an unverified identity (#413)', async () => {
  const errors = [];
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.identityDeps.whoami = async () => { throw new Error('api unreachable'); };
  const code = await main({ argv: ['--pr', '42', '--dry-run'], log: () => {}, error: (s) => errors.push(s), ...deps });
  assert.equal(code, 1, 'an unverifiable identity must refuse, mirroring §10 uncomputable-evidence');
  assert.ok(
    errors.some(l => /could not verify/.test(l) && /api unreachable/.test(l)),
    'the refusal must surface the underlying verification error',
  );
  assert.equal(vcs.calls.prReviewComment, 0, 'refusing at boot must post no verdict');
});

test('main: whoami matching the handle case-insensitively proceeds — logins are case-insensitive (#413)', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.identityDeps.whoami = async () => ({ username: 'Brain-Reviewer' });
  const lines = [];
  const code = await main({ argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0, 'a case-different login for the SAME account must not be refused as a forgery');
  assert.ok(lines.some(l => /verdict:/.test(l)), 'the run must reach a verdict');
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
