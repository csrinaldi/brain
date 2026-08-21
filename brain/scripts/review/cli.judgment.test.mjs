// cli.judgment.test.mjs — issue #682. THE COMPOSITION, driven through `main()`.
//
// WHY THIS FILE EXISTS. Two adversarial cold reviews of PR #740/#741 reached the
// same root cause independently: every mutation the first cut survived varied
// the UNITS and none varied the COMPOSITION. Replacing the challenger call in
// `cli.mjs` with `null` left the full suite green at 4094/4094, and all four
// blockers the second review found lived in the wiring, not in the evaluators.
//
// The axes they named as never varied are the sections below: the protocol, the
// axis, the id space, the conclusion, and the generator's failure modes. Each
// one is now driven end to end through the real verb.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { main } from './cli.mjs';
import { parseVerdict } from './lib/parse-verdict.mjs';
import { ID_PREFIX } from './evaluators/inferential.mjs';
import { UNCHALLENGED, ROUTED_HUMAN } from './evaluators/refuter.mjs';
import { REQUIRED_JOBS } from '../vcs/governance-checks.mjs';
import { tierParams } from '../vcs/governance-tiers.mjs';
import { resolveJudgment, JUDGMENT_PROTOCOL } from './lib/resolve-challenger.mjs';

/** Every required gate green — the same fixture `cli.test.mjs` uses. An empty
 *  rollup is NOT green: the tranche evaluator reads it as uncomputable evidence
 *  and REVISEs, which would have made the conclusion cases below pass for the
 *  wrong reason. */
const greenRollup = () => REQUIRED_JOBS.map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));

const HEAD = 'f'.repeat(40);

// The double must HONOUR the token (#604): one that returns a fixed login for
// any credential models the credential-injecting environment the negative
// control refuses, so it cannot stand in for a healthy one. Same shape as
// `cli.test.mjs`/`identity.test.mjs`.
const honestWhoami = (logins) => async ({ token }) => {
  if (Object.hasOwn(logins, token)) return { username: logins[token] };
  throw new Error('gh: Bad credentials (HTTP 401)');
};

/** A green tranche run, with every seam this file needs injectable. */
function deps({ config, protocol, generate, tier = 'regulated', refuterRunner } = {}) {
  const d = {
    project: 'csrinaldi/brain',
    provider: 'github',
    baseSha: 'BASE',
    tier,
    config,
    getChangedFiles: () => ['a.mjs'],
    identityDeps: {
      readConfig: () => ({ handle: 'brain-reviewer', tokenEnv: 'BRAIN_REVIEWER_TOKEN' }),
      readEnv: () => ({ BRAIN_REVIEWER_TOKEN: 'shh' }),
      whoami: honestWhoami({ shh: 'brain-reviewer' }),
    },
    coldBootDeps: {
      fetchPr: async () => ({ number: 42, author: 'alice', labels: [], body: '', headRefOid: HEAD }),
      cloneDetached: async () => ({ detached: true }),
      readRecords: () => [],
      fetchReviews: async () => [],
    },
    trancheDeps: {
      fetchRollup: async () => greenRollup(),
      diffNumstat: () => '10\t5\ta.mjs\n',
      readIgnoreList: () => [],
      tier: 'standard',
    },
    writeVerbs: {},
  };
  if (protocol !== undefined) d.protocol = protocol;
  if (generate !== undefined) d.inferentialDeps = { generate };
  if (refuterRunner !== undefined) d.refuterRunner = refuterRunner;
  return d;
}

const CFG = (axis) => ({
  reviewer: { inferential: { enabled: true, challenger: axis ? { axis } : undefined } },
});

const reasoned = (over = {}) => ([{
  id: 'J1', severity: 'blocker',
  evidence: 'the parser is correct; the semantics are inverted',
  cites: 'reviewer-protocol.md §6.1',
  ...over,
}]);

/** Runs the real verb at --dry-run and returns { code, body, verdict }. */
async function run(options) {
  const lines = [];
  const code = await main({ argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), error: () => {}, ...deps(options) });
  const body = lines.join('\n');
  return { code, body, verdict: parseVerdict({ body }), lines };
}

// ── AXIS 1: the protocol ─────────────────────────────────────────────────────

test('composition: at brain-review/1 the judgment half does not run, and nothing declares it', async () => {
  // THE BLOCKER. `standard` ships `{inferentialEnabled: true, reviewProtocol:
  // 'brain-review/1'}`. With two gates the producer ran and the refuter was
  // skipped entirely: a reasoned blocker, never challenged, never escalated, in
  // a verdict declaring `controls_not_applied: []`. #552's ruled-against state.
  const { code, body } = await run({
    tier: 'standard', protocol: 'brain-review/1', config: CFG('human'), generate: async () => reasoned(),
  });

  assert.equal(code, 0);
  assert.doesNotMatch(body, /evidence_class: inferential/,
    'a reasoned finding must not be produced into a protocol that cannot carry it');
  assert.doesNotMatch(body, /controls: .*inferential/,
    'and nothing may declare the inferential control on a run where it did not apply');
});

test('composition: at brain-review/2 the same inputs DO run the judgment half', async () => {
  const { body } = await run({ protocol: 'brain-review/2', config: CFG('human'), generate: async () => reasoned() });
  assert.match(body, /evidence_class: inferential/);
  assert.match(body, /controls: .*"inferential"/);
});

// ── AXIS 2: the axis reaches the wire (REQ-682-3) ────────────────────────────

test('composition: the verdict DECLARES the axis that challenged the reasoned findings', async () => {
  // REQ-682-3 was claimed delivered by slice 2 and was not implemented at all:
  // `resolveAxis`'s value was consumed as a boolean and discarded, and no task in
  // any slice put it on the wire.
  const a = await run({ protocol: 'brain-review/2', config: CFG('human'), generate: async () => reasoned() });
  const b = await run({ protocol: 'brain-review/2', config: CFG('cross-family'), generate: async () => reasoned() });

  assert.match(a.body, /challenger_axis: human/);
  assert.match(b.body, /challenger_axis: cross-family/);
  assert.notEqual(a.body, b.body,
    'two evidentiary strengths must not render byte-identically — #683 one field over');
});

test('composition: no reasoned finding, no axis line — #690\'s wallpaper rule', async () => {
  const { body } = await run({ protocol: 'brain-review/2', config: CFG('human'), generate: async () => [] });
  assert.doesNotMatch(body, /challenger_axis:/,
    'an axis that challenged nothing is not evidence about this verdict');
});

test('composition: an unbuilt axis posts a verdict that says so — it does not crash', async () => {
  const { code, body } = await run({
    protocol: 'brain-review/2', config: CFG('cross-family'), generate: async () => reasoned(),
  });
  assert.equal(code, 0, 'a posted fail-closed verdict beats an unhandled rejection');
  assert.match(body, new RegExp(`refuter_outcome: ${UNCHALLENGED}`));
  assert.match(body, /escalate: human/);
});

// ── AXIS 3: the id space ─────────────────────────────────────────────────────

test('composition: a produced id cannot address a deterministic finding', async () => {
  const { body, verdict } = await run({
    protocol: 'brain-review/2', config: CFG('human'),
    generate: async () => reasoned({ id: 'gate:phase-order' }),
  });
  assert.match(body, new RegExp(`id: ${ID_PREFIX}gate:phase-order`));
  const ids = (verdict?.findings ?? []).map(f => f.id);
  assert.equal(ids.filter(i => i === 'gate:phase-order').length, 0,
    'the producer must not be able to emit a bare gate id');
});

// ── AXIS 4: the conclusion ───────────────────────────────────────────────────

test('composition: a reasoned blocker BLOCKS — it does not land in an APPROVE', async () => {
  // The judgment half could escalate when it was UNSURE and could not block when
  // it was SURE: `evaluateInferential`'s conclusion was discarded in the merge.
  const { body } = await run({
    protocol: 'brain-review/2', config: CFG('human'), generate: async () => reasoned(),
  });
  assert.doesNotMatch(body, /^verdict: APPROVE$/m,
    'a blocker that does not block is not a blocker');
  assert.match(body, /^verdict: (REVISE|STOP)$/m);
});

test('composition: a green run with no reasoned finding still APPROVEs', async () => {
  const { body } = await run({ protocol: 'brain-review/2', config: CFG('human'), generate: async () => [] });
  assert.match(body, /^verdict: APPROVE$/m, 'the judgment half must not block by existing');
});

// ── AXIS 5: the generator's failure modes ────────────────────────────────────

test('composition: a generator that FAILED refuses the run and posts nothing (#682 criterion 6)', async () => {
  for (const generate of [
    async () => { throw new Error('ECONNREFUSED'); },
    async () => undefined,
    async () => ({ error: 'unreachable' }),
  ]) {
    const { code, body } = await run({ protocol: 'brain-review/2', config: CFG('human'), generate });
    assert.equal(code, 1, 'an uncomputable judgment half must fail closed — protocol §10');
    assert.doesNotMatch(body, /controls:/,
      'and must post NO verdict, rather than one declaring the control applied over nothing');
  }
});

// ── the wiring itself ────────────────────────────────────────────────────────

test('composition: the challenger actually REACHES the refuter through main()', async () => {
  // The blocker from slice 1's review: replacing the `resolveJudgment` call with
  // `null` left the whole suite green, because every test called the resolver
  // directly and none observed `cli.mjs` calling it.
  const { body } = await run({
    protocol: 'brain-review/2', config: CFG('human'), generate: async () => reasoned(),
  });
  assert.match(body, new RegExp(`refuter_outcome: ${ROUTED_HUMAN}`),
    'the human runner constructed by resolveJudgment must have run inside the real verb');
});

test('composition: an unrecognised axis refuses the run and posts nothing', async () => {
  const { code, body } = await run({
    protocol: 'brain-review/2', config: CFG('same-modle'), generate: async () => reasoned(),
  });
  assert.equal(code, 1);
  assert.doesNotMatch(body, /protocol: brain-review/, 'no verdict may be posted on an unknown axis');
});

test('composition: an explicitly injected null runner still exercises the no-runner path', async () => {
  // `??` would have overridden a deliberate `null`; `'refuterRunner' in deps`
  // does not. Nothing in the repo relied on this, but the comment claimed it.
  const { body } = await run({
    protocol: 'brain-review/2', config: CFG('human'),
    generate: async () => reasoned(), refuterRunner: null,
  });
  assert.match(body, new RegExp(`refuter_outcome: ${UNCHALLENGED}`));
});

// ── round 1 of the review loop: the fixes, each pinned where it failed ────────
//
// Every test below reproduces a defect that four independent refuters
// CORROBORATED against the real `main()`. They live here rather than beside
// their units because all six were invisible to unit tests and visible in
// composition — the axis both cold reviews named as the one never varied.

test('A1: a CORROBORATED reasoned blocker changes the conclusion', async () => {
  // The judgment half could escalate when UNSURE and could not block when SURE:
  // the conclusion was decided from the producer's pre-challenge severities,
  // before the challenger ran, and nothing re-derived it.
  const { body } = await run({
    protocol: 'brain-review/2', config: CFG('human'),
    generate: async () => reasoned(),
    refuterRunner: async (bs) => ({ outcomes: bs.map(f => ({ id: f.id, outcome: 'corroborated', rationale: 'r' })) }),
  });
  assert.doesNotMatch(body, /^verdict: APPROVE$/m, 'a blocker the challenge UPHELD must block');
  assert.match(body, /^verdict: REVISE$/m);
});

test('A2: a REFUTED claim stops blocking — the fixer is not asked to comply with a disproved claim', async () => {
  // It left `verdict: REVISE` with ZERO blockers in the list, so the PR could
  // never go green on the strength of a claim the challenge had already shown
  // to be false.
  const { body } = await run({
    protocol: 'brain-review/2', config: CFG('human'),
    generate: async () => reasoned(),
    refuterRunner: async (bs) => ({ outcomes: bs.map(f => ({ id: f.id, outcome: 'refuted', rationale: 'not real' })) }),
  });
  assert.match(body, /^verdict: APPROVE$/m, 'nothing blocks once the only blocker is refuted');
  assert.match(body, /refuted: true/);
  assert.doesNotMatch(body, /severity: blocker/);
});

test('B: an unrecognised challenger outcome is UNCHALLENGED, never "corroborated"', async () => {
  // The switch ended in the corroborated return, so eight out-of-vocabulary
  // values all rendered as "a challenge upheld this finding".
  for (const outcome of ['REFUTED', 'refute', 'unknown', '', 'partially-refuted', null, undefined]) {
    const { body } = await run({
      protocol: 'brain-review/2', config: CFG('human'),
      generate: async () => reasoned(),
      refuterRunner: async (bs) => ({ outcomes: bs.map(f => ({ id: f.id, outcome, rationale: 'r' })) }),
    });
    assert.match(body, new RegExp(`refuter_outcome: ${UNCHALLENGED}`),
      `outcome ${JSON.stringify(outcome)} must not read as a challenge that upheld the finding`);
    assert.match(body, /^escalate: human$/m);
  }
});

test('E: two findings sharing an id, and two with none, stay distinguishable', async () => {
  // Refuting one used to downgrade BOTH, and stamp the second with a rationale
  // written about the first.
  const { body, verdict } = await run({
    protocol: 'brain-review/2', config: CFG('human'),
    generate: async () => ([
      { id: 'J1', severity: 'blocker', evidence: 'first', cites: 'c' },
      { id: 'J1', severity: 'blocker', evidence: 'second', cites: 'c' },
      { severity: 'blocker', evidence: 'third', cites: 'c' },
      { severity: 'blocker', evidence: 'fourth', cites: 'c' },
    ]),
    refuterRunner: async (bs) => ({ outcomes: [{ id: bs[0].id, outcome: 'refuted', rationale: 'only the first' }] }),
  });
  const ids = (verdict?.findings ?? []).map(f => f.id);
  assert.equal(new Set(ids).size, ids.length, `ids must be unique within a batch — got ${ids.join(', ')}`);
  assert.equal((body.match(/refuted: true/g) ?? []).length, 1,
    'refuting one finding must not downgrade its namesake');
});

test('G: enabled-with-no-transport does not render like disabled', async () => {
  // #552's fold, re-created one layer up: neither state declares `inferential`,
  // so #690's complement says the same thing in both.
  const off = await run({ protocol: 'brain-review/2', config: { reviewer: { inferential: { enabled: false } } } });
  const on = await run({ protocol: 'brain-review/2', config: CFG('human') });

  assert.notEqual(off.body, on.body, 'a repo that turned the judgment half ON must be told it did not run');
  assert.match(on.body, /enabled but no transport is configured/);
  assert.match(off.body, /^conditions: \[\]$/m);
});

test('H: a challenger that throws fails CLOSED with a readable refusal, not a stack trace', async () => {
  // The call sat outside every try block and the entry point has no outer
  // catch, so it surfaced as an unhandled rejection with no verdict — quieter
  // than the fail-closed REVISE the same input produced before the challenger
  // existed.
  const lines = [];
  const errs = [];
  const code = await main({
    argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), error: (s) => errs.push(s),
    ...deps({
      protocol: 'brain-review/2', config: CFG('human'),
      generate: async () => reasoned(),
      refuterRunner: async () => { throw new Error('ECONNRESET'); },
    }),
  });
  assert.equal(code, 1);
  assert.match(errs.join('\n'), /brain:review: the challenger failed — ECONNRESET/);
  assert.doesNotMatch(lines.join('\n'), /protocol: brain-review/,
    'no verdict may be posted when the reasoned findings were never challenged');
});

test('the tier table and the judgment gate cannot contradict each other', async () => {
  // The first cut of this pin was TAUTOLOGICAL: both assertions sat inside
  // `if (j.run)` and were entailed by `resolveJudgment`'s postconditions given
  // the test's own argument (`protocol: params.reviewProtocol`). Two tier-table
  // mutations left it green — `regulated → /1` (the half dies at every tier and
  // the loop body is never entered) and `standard → /2` (the half runs on an
  // unimplemented axis). A pin that passes when `run` is false for every tier
  // constrains nothing.
  //
  // What is NOT entailed is the relationship between the tier's two fields and
  // what the operator is told. Asserted over the shipped table, so a tier edit
  // fails here rather than in a posted verdict.
  for (const tier of ['lite', 'standard', 'regulated']) {
    const params = tierParams(tier);
    const j = resolveJudgment({ config: {}, tier, protocol: params.reviewProtocol });

    assert.equal(j.enabled, params.inferentialEnabled,
      `tier "${tier}": the resolved enabled state must be the tier's own`);

    if (params.inferentialEnabled && params.reviewProtocol === JUDGMENT_PROTOCOL) {
      assert.equal(j.run, true, `tier "${tier}" enables the half at /2 — it must run`);
      assert.ok(j.challenger, `tier "${tier}" runs the half with no challenger`);
      assert.ok(j.axis, `tier "${tier}" runs the half with no declared axis`);
    }

    if (params.inferentialEnabled && params.reviewProtocol !== JUDGMENT_PROTOCOL) {
      // The `standard` case, and the one #741 F2 named. It must NOT run, and the
      // operator must be TOLD — a tier that asks for the half and is refused
      // cannot render like a tier that never asked.
      assert.equal(j.run, false, `tier "${tier}" cannot run the half at ${params.reviewProtocol}`);
      assert.ok(j.reason, `tier "${tier}" is refused silently — no reason to report`);
      assert.equal(j.enabled, true, 'and it must still read as ASKED, or the refusal is unreportable');
    }
  }
});

test('at least one shipped tier exercises each side of the gate', () => {
  // Without this the loop above can pass vacuously on a table where no tier
  // enables the half at all — which is exactly how the first cut survived the
  // `regulated → /1` mutation.
  const tiers = ['lite', 'standard', 'regulated'].map(tierParams);
  assert.ok(tiers.some(p => p.inferentialEnabled && p.reviewProtocol === JUDGMENT_PROTOCOL),
    'no tier runs the judgment half — the gate is untested by this table');
  assert.ok(tiers.some(p => !p.inferentialEnabled),
    'no tier disables the judgment half — the off path is untested by this table');
});

test('a runner-reported UNCHALLENGED is COUNTED, not merely marked', async () => {
  // #742: deleting `unansweredCount++` from the runner-reported branch left the
  // full suite green while the verdict's "were NOT challenged" condition
  // vanished end to end. The partial-runner path was asserted on the count; the
  // runner-reported path was not — the same fact, two ways in, one guarded.
  const { body } = await run({
    protocol: 'brain-review/2', config: CFG('human'),
    generate: async () => reasoned(),
    refuterRunner: async (bs) => ({
      outcomes: bs.map(f => ({ id: f.id, outcome: UNCHALLENGED, rationale: 'nothing challenged it' })),
    }),
  });
  assert.match(body, /inferential blocker\(s\) were NOT challenged/,
    'the count is the sole input to the verdict-level condition — marking without counting loses it');
  assert.match(body, /^escalate: human$/m);
});

test('a repo that ASKED for the judgment half and did not get it is told why', async () => {
  // `judgment.reason` was computed on every off path and read nowhere, so a
  // repo that asked and received nothing was told nothing while
  // `resolveJudgment` knew exactly why.
  //
  // THIS TEST WAS WRITTEN ONCE BEFORE AND NEVER REACHED THE COMMIT: it was
  // appended, verified against a mutation, and then deleted by the
  // `git checkout --` that restored that same mutation. The PR body claimed it.
  // Read the commit, not your memory of it.
  const askedByConfig = await run({
    tier: 'standard', protocol: 'brain-review/1', config: CFG('human'),
  });
  assert.match(askedByConfig.body, /the judgment half did not run — .*requires brain-review\/2/);

  // And asked BY THE TIER, which the first cut could not see: `standard` ships
  // `inferentialEnabled: true` with `brain-review/1`.
  const askedByTier = await run({ tier: 'standard', protocol: 'brain-review/1', config: {} });
  assert.match(askedByTier.body, /the judgment half did not run — .*requires brain-review\/2/,
    'a tier that enables the half and cannot carry it must say so');

  // A tier that never asked sees no noise — #690's wallpaper rule.
  const neverAsked = await run({ tier: 'lite', protocol: 'brain-review/1', config: {} });
  assert.match(neverAsked.body, /^conditions: \[\]$/m);
  assert.notEqual(askedByTier.body, neverAsked.body,
    'enabled-by-tier-and-refused must not render like never-enabled');
});
