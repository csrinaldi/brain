// cli.test.mjs — Unit tests for the `brain:review` CLI (REQ-H1-5, REQ-H1-7,
// REQ-H1-8, REQ-H1-9; design.md §2). No test spawns a real gh/glab/git
// process — identity, cold-boot, tranche, and poster seams are all injected,
// exactly like their own unit tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseArgs, main } from './cli.mjs';
import { postVerdict } from './poster.mjs';
import { buildVerdict, renderVerdict } from './verdict.mjs';
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
    pr: 42, mode: 'tranche', dryRun: true, error: null,
  });
});

test('parseArgs: defaults mode to auto, dryRun to false', () => {
  assert.deepEqual(parseArgs(['--pr', '7']), { pr: 7, mode: 'auto', dryRun: false, error: null });
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
  assert.ok(lines.some(l => /protocol: brain-review\/2/.test(l)),
    'brain.config.json requests /2 since #442 — these run against the REAL config, so the resolved protocol is the dogfooded one, not lite\'s default');
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
  assert.ok(lines.some(l => /protocol: brain-review\/2/.test(l)),
    'brain.config.json requests /2 since #442 — these run against the REAL config, so the resolved protocol is the dogfooded one, not lite\'s default');
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

// #442 REWROTE THIS CASE, and its old name is why. It read "lite tier (brain's own
// declared tier, NO OVERRIDE) → brain-review/1" — true until brain.config.json began
// requesting `/2`. These CLI tests load the REAL config (there is no `deps.config`
// seam, deliberately: `deps.tier` is the one test-only override and #442 did not add a
// second), so what they observe is brain's ACTUAL resolved protocol. That makes this
// case the dogfooding, visible from the CLI: the tier is still `lite`, every gate is
// still lite's, and the verdict is `/2`.
//
// The property this case used to carry — "lite with no override defaults to /1" —
// did not disappear, it moved to the two layers that can express it honestly: pure
// (governance-tiers.test.mjs, every tier × absent override) and wire
// (test/review-regulated, a real config file with the key omitted).
test('main: lite tier + brain\'s own reviewer.protocol override → brain-review/2, findings ARE annotated (#442 dogfooding)', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.tier = 'lite';
  deps.trancheDeps.fetchRollup = async () =>
    greenRollup().map(g => (g.name === 'memory-gate' ? { ...g, conclusion: 'FAILURE' } : g));
  const lines = [];
  const code = await main({ argv: ['--pr', '42'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.ok(lines.some(l => /protocol: brain-review\/2/.test(l)),
    'the config override must beat the tier default — that is the whole of #442');
  assert.ok(lines.some(l => /evidence_class:/.test(l)),
    'and /2 annotates: the vocabulary is what dogfooding buys over testing');
  assert.ok(lines.some(l => /causal_disposition:/.test(l)));
});

// ── #408: the base probe's inability reaches the RENDERED verdict ───────────
//
// Cold review F5: nothing verified that `baseConditions` survives from
// `classifyAgainstBase` to the block a human reads. Dropping the append in cli.mjs
// left all 3128 tests green, so "the inability is reported, never swallowed" was an
// unproven claim at the only layer that matters. This also exercises `deps.probeBase`,
// which was a documented seam with no caller.
test('main: an UNCOMPUTABLE base probe puts its condition in the rendered verdict (#408)', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.tier = 'regulated';
  deps.trancheDeps.fetchRollup = async () =>
    greenRollup().map(g => (g.name === 'local-checks' ? { ...g, conclusion: 'FAILURE' } : g));
  let probed = 0;
  deps.probeBase = () => { probed += 1; return null; };
  const lines = [];
  const code = await main({ argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);
  assert.equal(probed, 1, 'a blocking gate:local-checks must trigger exactly one probe');
  const out = lines.join('\n');
  assert.match(out, /conditions:/, 'the verdict must carry a conditions block');
  assert.match(out, /evidence uncomputable: base comparison/,
    'and the probe\'s own inability must be IN it — appended to the evaluator\'s, not replacing them');
  assert.match(out, /causal_disposition: introduced/,
    'and the finding keeps blocking: a failed base check is a false block, never a false pass');
});

test('main: no base-comparable blocker ⇒ the probe never runs and no condition appears (#408)', async () => {
  // The laziness rule, at the CLI. Without this, a probe that ran on every review
  // would be invisible until someone noticed the wall-clock.
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.tier = 'regulated';
  deps.trancheDeps.fetchRollup = async () =>
    greenRollup().map(g => (g.name === 'memory-gate' ? { ...g, conclusion: 'FAILURE' } : g));
  let probed = 0;
  deps.probeBase = () => { probed += 1; return null; };
  const lines = [];
  await main({ argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), ...deps });
  assert.equal(probed, 0, 'memory-gate is not in BASE_REPRODUCIBLE_GATES — nothing to re-run');
  assert.ok(!lines.join('\n').includes('base comparison'), 'and no condition about a probe that never ran');
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
  assert.ok(lines.some(l => /protocol: brain-review\/2/.test(l)),
    'brain.config.json requests /2 since #442 — these run against the REAL config, so the resolved protocol is the dogfooded one, not lite\'s default');
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

// ── #555: the tier reaches the checkpoint's artifact set ────────────────────
//
// `cli.mjs` resolves the tier ONCE and threads it into `gatherCheckpointInputs`,
// which otherwise defaults to `standard`. Round 3 of the #555 review measured
// that thread: deleting `tier,` from the checkpoint call left the whole suite
// green, so every real PR would have been judged against `standard`'s artefact
// set no matter what tier the repo declares — silent, and undetectable from the
// tests. The two cases below are the two directions that mutation moves the
// verdict in, and both are asserted on the RENDERED block, which is what a human
// reads.
//
// `lite` is the tier used here on purpose: it is the tier brain itself declares,
// and its artefact set (`['spec']`) differs from `standard`'s in both directions —
// artefacts standard demands that lite does not, and a `missing:` line whose tier
// name is part of the evidence.
const TIER_CHANGE_ID = 'issue-999-tier-thread';
const TIER_CHANGE_DIR = `openspec/changes/${TIER_CHANGE_ID}`;

/** A checkpoint fixture whose change dir contains exactly `present`. */
function checkpointFixture(present) {
  const there = new Set(present.map(f => `${TIER_CHANGE_DIR}/${f}`));
  return {
    baseSha: 'BASE',
    exists: (p) => there.has(p),
    listDir: () => [],
    readFile: (p) => {
      // A tasks.md that IS executed — this fixture is about the artefact set,
      // not about Rule C's separate "zero checked items" blocker.
      if (p === `${TIER_CHANGE_DIR}/tasks.md` && there.has(p)) return '- [x] done\n';
      throw new Error(`no ${p} in this fixture`);
    },
    runReversion: async () => ({ uncomputable: false, command: 'cmd', vacuousTests: [] }),
    runAudit: () => '',
    runGovernanceStatus: () => '',
    trancheDeps: { fetchRollup: async () => greenRollup(), diffNumstat: () => '10\t5\tfoo.mjs\n', readIgnoreList: () => [] },
  };
}

function checkpointDeps(vcs, tier, present) {
  const deps = readyDeps({ vcs });
  deps.tier = tier;
  deps.getChangedFiles = () => [`${TIER_CHANGE_DIR}/checkpoint-report.md`];
  deps.checkpointDeps = checkpointFixture(present);
  return deps;
}

test('#555: --mode checkpoint measures the artifact set at the RESOLVED tier — the blocker names lite, never the `standard` default', async () => {
  const vcs = spyVcs();
  const lines = [];
  // Nothing but tasks.md: `lite` requires spec.md alone, `standard` requires
  // proposal/spec/design as well. The two produce different evidence text.
  const code = await main({
    argv: ['--pr', '42', '--mode', 'checkpoint', '--dry-run'],
    log: (s) => lines.push(s),
    ...checkpointDeps(vcs, 'lite', ['tasks.md']),
  });
  assert.equal(code, 0);
  const out = lines.join('\n');
  // `\"` in the pattern: renderVerdict emits the evidence as a quoted YAML
  // scalar, so the tier name arrives escaped inside the block.
  assert.match(out, /requiredArtifactsFor\(\\"lite\\"\) missing: spec\.md/,
    'cli.mjs must thread its resolved tier into gatherCheckpointInputs — without it the set silently reverts to `standard`');
  assert.doesNotMatch(out, /requiredArtifactsFor\(\\"standard\\"\)/,
    'and the evaluator default must never be what a real review measures against');
});

test('#555: at lite, a change carrying only what lite requires produces NO artifact blocker (the thread cuts both ways)', async () => {
  const vcs = spyVcs();
  const lines = [];
  const code = await main({
    argv: ['--pr', '42', '--mode', 'checkpoint', '--dry-run'],
    log: (s) => lines.push(s),
    ...checkpointDeps(vcs, 'lite', ['spec.md', 'tasks.md']),
  });
  assert.equal(code, 0);
  const out = lines.join('\n');
  assert.doesNotMatch(out, /requiredArtifactsFor/,
    'lite requires spec.md and it is there — a lost tier would demand proposal.md/design.md a lite change never owed');
  assert.doesNotMatch(out, /tasks-absent|zero "- \[x\]"/,
    'and an executed tasks.md is neither absent nor unstarted');
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

// #477, second half of the maintainer ruling: "an unreadable verdict is
// REPORTED, never silently folded into either of the other two."
//
// The board's own reporting made that impossible to satisfy by itself. It logs
// a line only when a PR has labels to add or remove — and an unreadable verdict
// has neither, because freezing the namespace is precisely what stops the
// writes. So the case the ruling is about was the one case that printed
// nothing: the operator saw "reconciled N open PR(s)" and no more. A flag that
// reaches no human is the "flag nobody reads" the ruling refused.
test('main("board"): a PR whose verdict could not be read is REPORTED, even though it produces no label writes (#477)', async () => {
  const lines = [];
  const code = await main({
    argv: ['board'],
    log: (m) => lines.push(m),
    project: 'csrinaldi/brain',
    provider: 'github',
    boardDeps: {
      listOpenPrs: async () => [{ number: 9 }],
      fetchPr: async () => ({ number: 9, labels: ['seq:after-411', 'reviewed:approved'] }),
      fetchReviews: async () => [{
        state: 'COMMENTED',
        author: 'brain-reviewer',
        body: '```yaml\nprotocol: brain-review/2\nverdict: APPROVE\nhead_sha: a\nrev: 0\nsequencing: not-valid-json\n```',
      }],
      getVcs: async () => ({
        labelAdd: async () => { throw new Error('must not write off an unreadable verdict'); },
        labelRemove: async () => { throw new Error('must not write off an unreadable verdict'); },
      }),
    },
  });
  assert.equal(code, 0);
  const reported = lines.filter(l => /unreadable/i.test(l));
  assert.equal(reported.length, 1, `expected exactly one unreadable report, got: ${JSON.stringify(lines)}`);
  assert.match(reported[0], /#9/, 'the report must name the PR');
  assert.match(reported[0], /sequencing/, 'and name the field that could not be read');
});

// Review finding: the report was hardcoded. It appended "not counted as clean;
// seq:* left untouched" to ANY non-empty `unreadable` — so a verdict with an
// unreadable `findings` and a perfectly readable `sequencing` printed the label
// moves it had just made and then claimed, on the next line, that seq:* was left
// untouched. Both halves false. A report that overstates its own caution is
// worse than no report: it is the same fail-open direction as the defect.
test('main("board"): the unreadable report does not claim a seq:* freeze that did not happen (#477)', async () => {
  const lines = [];
  const body = ['```yaml', 'protocol: brain-review/2', 'head_sha: a', 'verdict: APPROVE',
    'findings: [{"id"', 'sequencing: "[\\"seq:after-411\\"]"', '```'].join('\n');
  const code = await main({
    argv: ['board'],
    log: (m) => lines.push(m),
    project: 'csrinaldi/brain',
    provider: 'github',
    boardDeps: {
      listOpenPrs: async () => [{ number: 9 }],
      fetchPr: async () => ({ number: 9, labels: ['seq:stale'] }),
      fetchReviews: async () => [{ state: 'COMMENTED', author: 'brain-reviewer', body }],
      getVcs: async () => ({ labelAdd: async () => ({ ok: true }), labelRemove: async () => ({ ok: true }) }),
    },
  });
  assert.equal(code, 0);
  const reported = lines.filter(l => /unreadable/i.test(l));
  assert.equal(reported.length, 1, `expected one unreadable report, got: ${JSON.stringify(lines)}`);
  assert.match(reported[0], /findings/, 'it must name the field that was actually unreadable');
  assert.doesNotMatch(reported[0], /left untouched/,
    'seq:* was reconciled in this run — claiming otherwise misreports what the board just did');
});

test('main: an ordinary run (--pr flag, no subcommand) is UNAFFECTED by the queue/board dispatch check', () => {
  assert.deepEqual(parseArgs(['--pr', '42']), { pr: 42, mode: 'auto', dryRun: false, error: null });
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

// ── #405: the CLI hands the BUILT verdict's findings to the poster ───────────

test('#405: the poster receives the verdict findings, and the inline path stays silent while no evaluator anchors', async () => {
  // The behavioural half of the wiring, at the level a test can reach today.
  // `deriveInlineComments` and every layer below it are proven by poster.test,
  // the contract suite and the e2e; what this pins is that the CLI's payload
  // reaches the verb unchanged while findings carry no anchor — no stray
  // `comments` key, and the run's own output makes no dropped-anchor claim.
  const seen = [];
  const vcs = spyVcs();
  const lines = [];
  const deps = readyDeps({ vcs });
  deps.trancheDeps.fetchRollup = async () =>
    REQUIRED_JOBS.map(name => ({ name, status: 'COMPLETED', conclusion: name === 'phase-order' ? 'FAILURE' : 'SUCCESS' }));
  const code = await main({
    argv: ['--pr', '42'],
    log: (s) => lines.push(s),
    ...deps,
    posterDeps: { getVcs: async () => ({ ...vcs, prReviewComment: async (a) => { seen.push(a); return { url: 'u' }; } }) },
  });
  assert.equal(code, 0);
  assert.equal(seen.length, 1, 'one payload, carrying the verdict body');
  assert.match(seen[0].body, /gate:phase-order/, 'the finding really is in the posted block — otherwise the check below is vacuous');
  assert.equal('comments' in seen[0], false,
    `no evaluator anchors today, so no inline request may be made: ${JSON.stringify(Object.keys(seen[0]))}`);
  assert.ok(!lines.some(l => /could not be anchored/.test(l)),
    'and a run that never attempted an anchor must not report a dropped one');
});

test('#405: an anchored FOLLOW-UP renders but is never posted inline (REQ-405-2)', async () => {
  // The renderer emits `file`/`line` in BOTH branches; the poster receives only
  // `findings`. That asymmetry was real, deliberate and undocumented until the
  // round-4 cold review — and the Tier-2 draft about to become schema authority
  // asserted the opposite of it.
  //
  // The rule: a follow-up is `pre-existing` or `base-only`, which IS the verdict's
  // own statement that it is not this change's doing. Anchoring one would put a
  // comment on a line in this author's diff about a defect the same verdict says
  // they did not introduce.
  //
  // Pinned HERE rather than through `main()`: no evaluator emits an anchor or a
  // `pre-existing` disposition, so a CLI run cannot reach this state at all. The
  // CLI's half of the link is the drift guard below, which reds when
  // `findings: verdict.findings` becomes anything else — including
  // `[...findings, ...follow_ups]`, verified.
  const v = buildVerdict({
    headSha: HEAD,
    conclusion: 'REVISE',
    protocol: 'brain-review/2',
    findings: [{ id: 'inherited', severity: 'blocker', evidence: 'e', cites: 'c',
                 causal_disposition: 'pre-existing', file: 'a.mjs', line: 7 }],
  });
  assert.equal(v.follow_ups.length, 1, 'the anchored finding really was routed to follow_ups');
  assert.equal(v.findings.length, 0, 'and left findings empty — otherwise the check below is vacuous');
  assert.match(renderVerdict(v), /^ {4}file: a\.mjs$/m,
    'the anchor IS rendered in the follow_ups block — the two halves genuinely disagree, which is the point');

  const seen = [];
  await postVerdict({
    headSha: HEAD, project: 'csrinaldi/brain', number: 42, provider: 'github', mode: 'tranche',
    renderedBody: renderVerdict(v), reviewerHandle: 'brain-reviewer', priorVerdicts: [],
    findings: v.findings,
    deps: { getVcs: async () => ({
      prView: async () => ({ headRefOid: HEAD }),
      prReviewComment: async (a) => { seen.push(a); return { url: 'u' }; },
    }) },
  });
  assert.equal('comments' in seen[0], false,
    `a rendered follow-up anchor must not become an inline comment: ${JSON.stringify(Object.keys(seen[0]))}`);
});

test('#405: a dropped anchor is PRINTED, not just returned (REQ-405-4)', async () => {
  // The count reaching `postResult` is not the requirement — a reader seeing it
  // is. Without this line the run's output is identical whether every anchor was
  // refused or none was ever attempted, which is the exact silence REQ-405-4
  // exists to break, relocated one layer up from the poster.
  const vcs = spyVcs();
  const lines = [];
  const code = await main({
    argv: ['--pr', '42'],
    log: (s) => lines.push(s),
    ...readyDeps({ vcs }),
    posterDeps: { getVcs: async () => ({ ...vcs, prReviewComment: async () => ({ url: 'u', inlineDropped: 2 }) }) },
  });
  assert.equal(code, 0, 'a refused anchor must never fail the run');
  const reported = lines.filter(l => /could not be anchored/.test(l));
  assert.equal(reported.length, 1, `the count must be printed exactly once — got: ${JSON.stringify(lines)}`);
  // The WHOLE line, not a projection over it (round-18 cold review). `match(/\b2\b/)`
  // plus the filter regex pinned that a number and the phrase "could not be anchored"
  // are present; everything between them was free. Degrading the message to
  // `brain:review: 2 could not be anchored` left the suite green, and that message is
  // the failure REQ-405-4 cites by name: a reader told two things were lost, and not
  // told WHAT was lost or that the text survives in the summary block, concludes the
  // findings are gone. That is `evidence-reader-empty-on-failure` at the recovery
  // instruction instead of at the evidence.
  // An exact-string assertion is deliberate: rewording this message is a real change
  // to what a human is told on the one path where the tool has already failed at
  // something, and it should cost a test edit.
  assert.strictEqual(reported[0],
    'brain:review: 2 inline comment(s) could not be anchored — the finding text is in the summary block above.',
    'the message must name the count, WHAT was lost, and where the text still is');
});

test('#405: a SINGLE dropped anchor is printed too (REQ-405-4)', async () => {
  // The only fixture drove `inlineDropped: 2`, so `if (postResult.inlineDropped)`
  // could become `> 1` and ship silently (round-16 cold review). One lost anchor
  // is the commonest real loss — an anchor on a context line — and it is exactly
  // the case where a silent run is indistinguishable from a healthy one.
  const vcs = spyVcs();
  const lines = [];
  const code = await main({
    argv: ['--pr', '42'],
    log: (s) => lines.push(s),
    ...readyDeps({ vcs }),
    posterDeps: { getVcs: async () => ({ ...vcs, prReviewComment: async () => ({ url: 'u', inlineDropped: 1 }) }) },
  });
  assert.equal(code, 0);
  const reported = lines.filter(l => /could not be anchored/.test(l));
  assert.equal(reported.length, 1, `one lost anchor must still be reported — got: ${JSON.stringify(lines)}`);
  // The WHOLE line here too (round-19 cold review). Round 18 removed this exact
  // projection from the test three lines above and did not carry it the three
  // lines down — the correction it made was correct and stopped at the instance
  // it was pointed at, which is the thing round 18's own lesson had just named.
  // With only `match(/\b1\b/)` here, the singular case could be special-cased into
  // its own message and stay green — including
  // `brain:review: 1 inline comment(s) could not be anchored — no findings were
  // affected.`, which prints the count and asserts the OPPOSITE of what happened.
  assert.strictEqual(reported[0],
    'brain:review: 1 inline comment(s) could not be anchored — the finding text is in the summary block above.',
    'one lost anchor gets the same message as many — no degraded singular form');
});

test('#405: the CLI passes `findings` to postVerdict — the one link no seam can observe (drift guard)', () => {
  // Deliberately a SOURCE assertion, and it is worth saying why rather than
  // dressing it as behaviour. The anchor originates in an evaluator, and no
  // evaluator emits `file`/`line` yet (REQ-405-2 made the anchor optional so
  // they can adopt it one at a time), so there is no injectable seam through
  // which a test can put an anchored finding into a real `main()` run. The gap
  // was found the honest way: patching tranche.mjs to anchor its budget finding
  // left the e2e's posted payload with NO `comments` key, because this argument
  // was missing — the poster was wired and its caller was not.
  //
  // This guard is narrow on purpose: it proves the argument is passed, nothing
  // about what happens next. Delete it the day an evaluator anchors — at that
  // point the e2e tripwire becomes a real behavioural test of the same link.
  const src = readFileSync(fileURLToPath(new URL('./cli.mjs', import.meta.url)), 'utf8');
  const call = src.slice(src.indexOf('await postVerdict({'));
  // Anchored to the WHOLE property, not a substring of it. The first version
  // matched /findings: verdict\.findings/, which `verdict.findings.concat(
  // verdict.follow_ups)` satisfies — so the guard was green for the exact
  // population it names as forbidden, and the spec and the task list both said it
  // had been verified against that population (round-6 cold review, finding 1).
  // A substring match on a source guard is not a guard: it constrains a prefix.
  assert.match(call.slice(0, call.indexOf('});')), /^ *findings: verdict\.findings,$/m,
    'cli.mjs must hand the BUILT verdict\'s `findings` to the poster — EXACTLY that list. The evaluator\'s own ' +
    'is the wrong population (buildVerdict drops evidence-less findings), and so is findings+follow_ups: a ' +
    'follow-up is pre-existing/base-only, so anchoring one would comment on this author\'s diff about a defect ' +
    'the same verdict says they did not introduce. Both wrong populations red this guard.');
});

test('#501: the CLI binds the VERIFIED token to the port it hands cold-boot and the poster (drift guard)', () => {
  // A SOURCE assertion for the same reason as the guard above, and found the same
  // way: mutating this wiring to hand the poster an UNBOUND port left the whole
  // 2722-test suite green. The port-level binding was covered from six angles and
  // the one line that USES it was covered by nothing — this change reproducing its
  // own defect. `whoami` could always take a token; what was missing was a caller
  // passing one.
  //
  // No seam observes this: `getVcs` is imported directly, and a real `main()` run
  // cannot reach the poster without a live gh binary and a reviewer token — the
  // two things absent from the environment where this defect was found.
  const src = readFileSync(fileURLToPath(new URL('./cli.mjs', import.meta.url)), 'utf8');

  // `identity` must come from the identity that was VERIFIED, not from a second
  // read of the env var: a second read is a second chance to differ from the value
  // whoami() checked.
  assert.match(
    src,
    /^ *const boundGetVcs = \(opts = \{\}\) => getVcs\(\{ \.\.\.opts, identity: identity\.token \}\);$/m,
    'the port must be bound to `identity.token` — the value gatherIdentity verified, threaded, not re-read',
  );

  // Both consumers must receive it, asserted separately: binding a port nobody
  // uses is precisely the state this change found on main.
  assert.match(
    src,
    /^ *deps: deps\.coldBootDeps \?\? \{ getVcs: boundGetVcs \},$/m,
    'cold-boot must READ through the bound port — a port reading under one credential and writing ' +
      'under another can report on a repository it is not writing to',
  );
  assert.match(
    src,
    /^ *\(deps\.writeVerbs \? \{ getVcs: async \(\) => deps\.writeVerbs \} : \{ getVcs: boundGetVcs \}\);$/m,
    'the poster must WRITE through the bound port — the absence of this line is what made the reviewer ' +
      'verify as csrinaldibot and post as csrinaldi (PR #500, review 4887057484)',
  );
});

// Review finding: `doctrine.unreadableVerdicts` had NO production consumer.
// cli.mjs read only `records`/`priorVerdicts`/`priorDecisions`, poster.mjs only
// `priorVerdicts` — so at runtime an unreadable prior verdict behaved exactly as
// before and only a test asserted the field existed. That is precisely the
// "flag nobody reads" the #477 ruling refused as insufficient. The reviewer's
// own run is where it has to surface: the operator reading this output is the
// one deciding whether to trust the thread it just derived a rev count from.
test('main: a prior verdict the parser could not read is REPORTED on the reviewer run (#477)', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.coldBootDeps.fetchReviews = async () => [
    { state: 'COMMENTED', author: 'brain-reviewer',
      body: '```yaml\nprotocol: brain-review/2\nverdict: APPROVE\nhead_sha: OLD\nrev: 0\nfindings: [{"id"\n```' },
  ];
  const lines = [];
  const code = await main({ argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), ...deps });
  assert.equal(code, 0);

  const reported = lines.filter(l => /unreadable/i.test(l));
  assert.equal(reported.length, 1, `expected the unreadable prior verdict to be reported, got: ${JSON.stringify(lines)}`);
  assert.match(reported[0], /findings/, 'it must name the field that could not be read');
  assert.match(reported[0], /OLD/, 'and the head the unreadable verdict was bound to');
});

test('main: a thread of readable prior verdicts reports nothing unreadable — the control', async () => {
  const vcs = spyVcs();
  const deps = readyDeps({ vcs });
  deps.coldBootDeps.fetchReviews = async () => [
    { state: 'COMMENTED', author: 'brain-reviewer',
      body: '```yaml\nprotocol: brain-review/1\nverdict: REVISE\nhead_sha: OLD\nrev: 0\n```' },
  ];
  const lines = [];
  await main({ argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), ...deps });
  assert.equal(lines.filter(l => /unreadable/i.test(l)).length, 0,
    'a false positive here would teach the operator to ignore the line within a week');
});

// ── parseArgs: the PR number is required, and answerable when it is wrong ────
//
// Measured on main: `brain:review -- 665` (no `--pr`) parsed to `pr: null`,
// which reached `git fetch origin null` and surfaced as an unhandled Node
// stack trace — `fatal: couldn't find remote ref null`. Nothing in it said the
// PR number was missing, so a typo in the argv read as a broken remote.

test('parseArgs: a BARE positional PR number is accepted — brain:approve takes one', () => {
  // The two verbs disagreed: `brain:approve -- 640` works, `brain:review -- 665`
  // silently did not. Same repo, same operator, opposite conventions.
  const args = parseArgs(['665']);
  assert.equal(args.pr, 665);
  assert.equal(args.error, null);
});

test('parseArgs: the positional and the flag agree', () => {
  assert.deepEqual(parseArgs(['665']).pr, parseArgs(['--pr', '665']).pr);
});

test('parseArgs: a positional composes with the other flags', () => {
  const args = parseArgs(['665', '--dry-run', '--mode', 'tranche']);
  assert.deepEqual(args, { pr: 665, mode: 'tranche', dryRun: true, error: null });
});

test('parseArgs: no PR number is an ERROR, never a null that travels', () => {
  const args = parseArgs([]);
  assert.equal(args.pr, null);
  assert.match(args.error, /no PR number/i);
});

test('parseArgs: a non-numeric PR number reports what was TYPED, not "NaN"', () => {
  // "NaN" names the coercion; the operator needs to see their own mistake.
  assert.match(parseArgs(['--pr', 'abc']).error, /"abc"/);
  assert.match(parseArgs(['nonsense']).error, /"nonsense"/);
});

test('parseArgs: a trailing --pr with no value is an error, not NaN in flight', () => {
  const args = parseArgs(['--pr']);
  assert.ok(args.error, 'a flag with nothing after it must not reach the network as NaN');
  assert.match(args.error, /nothing/i);
});

test('parseArgs: zero and negative are refused — they are not PR numbers', () => {
  assert.ok(parseArgs(['--pr', '0']).error);
  assert.ok(parseArgs(['--pr', '-3']).error);
});

test('parseArgs: more than one positional is refused rather than silently picking one', () => {
  const args = parseArgs(['665', '666']);
  assert.match(args.error, /one PR number/i);
  assert.match(args.error, /665, 666/, 'the refusal must show both, so the operator sees the ambiguity');
});

test('parseArgs: a positional CONFLICTING with --pr is refused too, not silently resolved', () => {
  // The first cut refused `665 666` and then silently preferred the flag here —
  // the same silently-chosen winner it had just rejected, in another syntax.
  // The ambiguity is the same fact whichever way each number was written.
  const args = parseArgs(['665', '--pr', '666']);
  assert.ok(args.error, 'two PR numbers is two PR numbers, whatever the syntax');
  assert.match(args.error, /665, 666/);
  assert.equal(args.pr, null, 'and nothing may be resolved from an ambiguous argv');
});

test('parseArgs: a repeated --pr blames the RIGHT input, never a valid one', () => {
  // `--pr 665 --pr abc` used to report `"665" is not a PR number`. 665 is
  // perfectly valid; the bad token is `abc`. The message re-derived the raw
  // value with indexOf('--pr'), which finds the FIRST flag while `pr` held the
  // LAST one's value — naming the wrong input, which is the exact defect this
  // ticket exists to remove, rebuilt inside its own fix.
  const args = parseArgs(['--pr', '665', '--pr', 'abc']);
  assert.ok(args.error);
  assert.match(args.error, /abc/, 'the offending token must appear');
  assert.doesNotMatch(args.error, /"665" is not/, 'a valid number must never be blamed');
});

test('main: an unusable PR argument refuses BEFORE any git or network call', async () => {
  const errors = [];
  const vcs = spyVcs();
  let coldBootCalls = 0;
  const deps = readyDeps({ vcs });
  deps.coldBootDeps = new Proxy({}, { get: () => { coldBootCalls++; throw new Error('cold-boot must not run'); } });
  const code = await main({ argv: [], log: () => {}, error: (s) => errors.push(s), ...deps });
  assert.equal(code, 2, 'a usage error exits 2 — distinct from a governance refusal');
  assert.equal(coldBootCalls, 0, 'nothing may be fetched for a run that cannot name its PR');
  assert.equal(vcs.calls.prReviewComment, 0);
  assert.ok(errors.some(l => /no PR number/i.test(l)));
  assert.ok(errors.some(l => /Usage:/.test(l)), 'the refusal must show how to call it correctly');
});

test('main: the usage refusal names BOTH accepted forms and the subcommands', async () => {
  const errors = [];
  await main({ argv: [], log: () => {}, error: (s) => errors.push(s), ...readyDeps({ vcs: spyVcs() }) });
  const text = errors.join('\n');
  assert.match(text, /<pr-number>/);
  assert.match(text, /--pr/);
  assert.match(text, /queue \| board/, 'the subcommands are the other legal argv shape');
});

test('main: a bare positional PR number reaches a verdict, same as --pr', async () => {
  const vcs = spyVcs();
  const lines = [];
  const code = await main({ argv: ['42', '--dry-run'], log: (s) => lines.push(s), ...readyDeps({ vcs }) });
  assert.equal(code, 0, 'the positional form must be a real path, not merely parsed');
  assert.ok(lines.some(l => /verdict:/.test(l)));
});
