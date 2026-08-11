// base-comparison.test.mjs — issue #408.
//
// The unit half. The claim that matters — "a finding routed to follow_ups[] by a REAL
// run" — is proven in test/review-regulated/, because #408's exit criterion explicitly
// refuses a unit test that hand-feeds `causal_disposition`. What is pinned here is
// everything the e2e cannot vary cheaply: the uncomputable direction, the laziness
// rule, and the workflow-mirroring command list.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_REPRODUCIBLE_GATES, commandsFor, gateNameOf, needsBaseProbe, probeBase, classifyAgainstBase,
} from './base-comparison.mjs';
import { applyCausalAdmission } from './causal-admission.mjs';

const blocker = (id) => ({ id, severity: 'blocker', evidence: `prStatusRollup: ${id}` });

// ── which findings a base re-run can speak to ───────────────────────────────

test('#408: only a BLOCKING, base-reproducible gate triggers the probe', () => {
  // Both halves matter. Re-running at base is the most expensive thing the reviewer
  // does; it may only happen when the answer changes a verdict.
  assert.equal(needsBaseProbe([blocker('gate:local-checks')]), true);
  assert.equal(needsBaseProbe([{ ...blocker('gate:local-checks'), severity: 'editorial' }]), false,
    'an editorial finding routed to follow_ups blocks exactly as much as before — nothing');
  assert.equal(needsBaseProbe([blocker('gate:issue-link')]), false,
    'issue-link reads THIS PR body — asking whether it fails at base is meaningless, not hard');
  assert.equal(needsBaseProbe([blocker('budget')]), false);
  assert.equal(needsBaseProbe([]), false);
});

test('#408: exactly one gate is base-reproducible, and that is a measurement', () => {
  // Seven of the eight required jobs are diff- or PR-scoped BY CONSTRUCTION. If this
  // list ever grows, the header's measurement is what has to be re-taken first.
  assert.deepEqual([...BASE_REPRODUCIBLE_GATES], ['local-checks']);
  assert.equal(gateNameOf({ id: 'gate:local-checks' }), 'local-checks');
  assert.equal(gateNameOf({ id: 'detection:phase-order' }), null);
  assert.equal(gateNameOf({ id: 'budget' }), null);
  assert.equal(gateNameOf(undefined), null);
});

test('#408: the command list MIRRORS the workflow, including its .brain-source condition', () => {
  // governance.yml runs the unit suite only `if hashFiles('.brain-source') != ''`. A
  // probe that ran the suite in a consumer would answer a question the gate never
  // asked — and would make every consumer pay a suite run to learn nothing.
  const consumer = commandsFor('local-checks', '/wt', () => false);
  const source = commandsFor('local-checks', '/wt', () => true);
  assert.equal(consumer.length, 2, 'a consumer runs repo:check + brain:nav only');
  assert.equal(source.length, 3, 'the brain source repo also runs the suite');
  assert.ok(!JSON.stringify(consumer).includes('--test'));
  assert.ok(JSON.stringify(source).includes('--test'));
  assert.deepEqual(commandsFor('issue-link', '/wt', () => true), [],
    'a gate with no honest reproduction has no commands, never a guessed one');
});

// ── the classifier ──────────────────────────────────────────────────────────

test('#408: a gate that fails at base too becomes pre-existing, and KEEPS its evidence', () => {
  const { findings } = classifyAgainstBase({
    findings: [{ ...blocker('gate:local-checks'), causal_disposition: 'introduced' }],
    baseProbe: { failed: ['local-checks'], command: 'git worktree add … && node …' },
  });
  assert.equal(findings[0].causal_disposition, 'pre-existing');
  assert.match(findings[0].evidence, /prStatusRollup: gate:local-checks/,
    'the original quote must survive — a claim must keep the thing it is a claim about');
  assert.match(findings[0].evidence, /SAME gate fails at base/);
});

test('#408: a gate that is GREEN at base stays introduced — this change broke it', () => {
  const { findings } = classifyAgainstBase({
    findings: [{ ...blocker('gate:local-checks'), causal_disposition: 'introduced' }],
    baseProbe: { failed: [], command: 'cmd' },
  });
  assert.equal(findings[0].causal_disposition, 'introduced');
  assert.ok(!/base/.test(findings[0].evidence), 'and its evidence is not decorated with a non-finding');
});

test('#408: an UNCOMPUTABLE probe leaves findings blocking, and says so', () => {
  // The safe direction: a failed base check costs a false block, never a false pass.
  const { findings, conditions } = classifyAgainstBase({
    findings: [{ ...blocker('gate:local-checks'), causal_disposition: 'introduced' }],
    baseProbe: null,
    probeAttempted: true,
  });
  assert.equal(findings[0].causal_disposition, 'introduced');
  assert.equal(conditions.length, 1);
  assert.match(conditions[0], /evidence uncomputable: base comparison/);
});

test('#408: uncomputable is NOT `unknown` — that would summon a human on every PR', () => {
  // `unknown` forces STOP + escalate:human per finding. A base probe failing for infra
  // reasons would then escalate every gate finding on every review: the escalation
  // storm #394 exists to prevent.
  const { findings } = classifyAgainstBase({
    findings: [{ ...blocker('gate:local-checks'), causal_disposition: 'introduced' }],
    baseProbe: null, probeAttempted: true,
  });
  assert.notEqual(findings[0].causal_disposition, 'unknown');
});

test('#408: a probe that was never NEEDED reports nothing — silence, not a condition', () => {
  const { conditions } = classifyAgainstBase({
    findings: [blocker('budget')], baseProbe: null, probeAttempted: false,
  });
  assert.deepEqual(conditions, [], 'reporting "could not compare" on a review that never needed to is noise');
});

// ── the probe itself ────────────────────────────────────────────────────────

test('#408: probeBase runs in a DETACHED worktree at base and tears it down', () => {
  const calls = [];
  const r = probeBase({
    baseSha: 'basesha', gates: ['local-checks'], cwd: '/repo', tmp: '/tmp',
    _exists: () => false,
    _exec: (file, args) => { calls.push([file, ...args].join(' ')); return ''; },
  });
  assert.deepEqual(r.failed, [], 'both checks passed at base');
  const joined = calls.join('\n');
  assert.match(joined, /git worktree add --detach \/tmp\/brain-review-base-basesha basesha/);
  assert.ok(calls.filter(c => c.includes('worktree remove')).length >= 1,
    'the worktree must be removed — never a checkout in the operator cwd, never a leak');
  assert.ok(!joined.includes('--test'), 'no .brain-source marker ⇒ no suite, mirroring the workflow');
});

test('#408: a failing command marks the gate failed and STOPS — the rest add nothing', () => {
  const ran = [];
  const r = probeBase({
    baseSha: 'b', gates: ['local-checks'], cwd: '/repo', tmp: '/tmp', _exists: () => false,
    _exec: (file, args) => {
      const cmd = [file, ...args].join(' ');
      if (cmd.includes('worktree')) return '';
      ran.push(cmd);
      if (cmd.includes('check-refs')) throw new Error('exit 1');
      return '';
    },
  });
  assert.deepEqual(r.failed, ['local-checks']);
  assert.equal(ran.length, 1, 'once the gate is red at base, the remaining steps prove nothing new');
});

test('#408: a git failure is null (uncomputable), never a crash and never a verdict', () => {
  const r = probeBase({
    baseSha: 'b', gates: ['local-checks'], cwd: '/repo', tmp: '/tmp',
    _exec: (file, args) => { if (args.includes('add')) throw new Error('git exploded'); return ''; },
  });
  assert.equal(r, null);
});

test('#408: with no base sha the probe never touches git — the guard is a refusal, not a shortcut', () => {
  // Asserting only the `null` return passes either way: without the guard the
  // worktree add fails and the catch returns null too. What the guard actually buys
  // is that a review with no resolvable base does not spawn git, create a path named
  // after `null`, and remove it again — so that is what gets asserted.
  const calls = [];
  const r = probeBase({
    baseSha: null, gates: ['local-checks'], cwd: '/repo', tmp: '/tmp',
    _exec: (file, args) => { calls.push([file, ...args].join(' ')); return ''; },
  });
  assert.equal(r, null, 'no base sha ⇒ nothing to compare against');
  assert.deepEqual(calls, [], 'and nothing may be spawned to discover that');

  const noGates = [];
  assert.equal(probeBase({ baseSha: 'b', gates: [], cwd: '/repo', tmp: '/tmp', _exec: (f, a) => { noGates.push(f); return ''; } }), null);
  assert.deepEqual(noGates, [], 'nor when there is no gate to reproduce');
});

test('#408: probeBase strips NODE_TEST_CONTEXT from the child env', () => {
  // Inherited, it trips node's recursive-test guard: the child SKIPS every file and
  // exits 0, which reads as "the suite passes at base" — the exact inversion of the
  // claim. Recorded in defaultRunReversion; the same trap, one module over.
  let seenEnv = null;
  process.env.NODE_TEST_CONTEXT = 'child';
  try {
    probeBase({
      baseSha: 'b', gates: ['local-checks'], cwd: '/repo', tmp: '/tmp', _exists: () => true,
      _exec: (file, args, opts) => { if (args.includes('--test')) seenEnv = opts.env; return ''; },
    });
  } finally { delete process.env.NODE_TEST_CONTEXT; }
  assert.ok(seenEnv, 'sanity: the suite command must have run');
  assert.equal(seenEnv.NODE_TEST_CONTEXT, undefined);
});

// ── the pipeline order ──────────────────────────────────────────────────────

test('#408: admission classifies against base BEFORE the refuter forks', async () => {
  // The refuter forks on BLOCKERS. A finding on its way out of the blocking set must
  // not be challenged as though it were still blocking.
  let refuterSawDisposition = null;
  const { findings } = await applyCausalAdmission({
    findings: [blocker('gate:local-checks')],
    baseProbe: { failed: ['local-checks'], command: 'cmd' },
    probeAttempted: true,
    runner: async ({ findings: fs }) => { refuterSawDisposition = fs[0].causal_disposition; return null; },
  });
  assert.equal(findings[0].causal_disposition, 'pre-existing');
  // The refuter is lazy and does not fire on deterministic findings, so the runner is
  // never called — asserting the ORDER means asserting the classifier already ran by
  // the time the refuter had its chance.
  assert.equal(refuterSawDisposition, null, 'the refuter stays a no-op on deterministic findings');
});

test('#408: annotation still defaults to introduced when no probe ran', async () => {
  const { findings, conditions } = await applyCausalAdmission({ findings: [blocker('gate:local-checks')] });
  assert.equal(findings[0].causal_disposition, 'introduced');
  assert.equal(findings[0].evidence_class, 'deterministic');
  assert.deepEqual(conditions, []);
});
