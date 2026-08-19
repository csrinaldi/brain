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
