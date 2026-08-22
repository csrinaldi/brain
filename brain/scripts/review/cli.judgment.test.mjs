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

test('#743: the config and the judgment gate cannot contradict each other', () => {
  // This pin used to walk the TIER TABLE. The #743 ruling took the review system
  // out of that table, so the same property is now asserted over the surface that
  // does decide: `reviewer.inferential.enabled` and `reviewer.protocol`.
  //
  // Two things the earlier cuts got wrong and this keeps: the assertions must not
  // sit inside `if (j.run)` — a pin that passes when nothing runs constrains
  // nothing — and the case list must exercise BOTH sides of the gate, or the loop
  // passes vacuously on a list where the half never runs.
  const CASES = [
    { label: 'nothing declared', config: {}, protocol: JUDGMENT_PROTOCOL, run: true, enabled: true },
    { label: 'explicitly off', config: { reviewer: { inferential: { enabled: false } } },
      protocol: JUDGMENT_PROTOCOL, run: false, enabled: false },
    { label: 'asked for, refused by the protocol', config: {}, protocol: 'brain-review/1',
      run: false, enabled: true },
  ];

  for (const c of CASES) {
    const j = resolveJudgment({ config: c.config, protocol: c.protocol });
    assert.equal(j.run, c.run, `${c.label}: resolved run state`);
    assert.equal(j.enabled, c.enabled, `${c.label}: resolved enabled state`);

    if (j.run) {
      assert.ok(j.challenger, `${c.label}: runs the half with no challenger`);
      assert.ok(j.axis, `${c.label}: runs the half with no declared axis`);
      assert.equal(j.reason, null, `${c.label}: runs, and still reports a reason it did not`);
    } else {
      assert.equal(j.challenger, null, `${c.label}: does not run, yet resolved a challenger`);
      assert.equal(j.axis, null, `${c.label}: does not run, yet declared an axis`);
      assert.ok(j.reason, `${c.label}: refused silently — nothing to report to the operator`);
    }

    // The distinction #741 F2 named, and the reason `enabled` is separate from
    // `run`: a repo that ASKED and was refused must not read like one that never
    // asked. Only the first can be reported.
    if (c.enabled && !c.run) {
      assert.equal(j.enabled, true, `${c.label}: asked-and-refused must still read as ASKED`);
    }
  }

  assert.ok(CASES.some(c => c.run), 'no case runs the half — the on path is untested by this list');
  assert.ok(CASES.some(c => !c.run), 'no case refuses the half — the off path is untested by this list');
  assert.ok(CASES.some(c => c.enabled && !c.run),
    'no case is asked-and-refused — the state that must be REPORTED is untested');
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
  const askedExplicitly = await run({
    tier: 'standard', protocol: 'brain-review/1', config: CFG('human'),
  });
  assert.match(askedExplicitly.body, /the judgment half did not run — .*requires brain-review\/2/);

  // And asked BY DEFAULT, which is the common case after the #743 ruling: an
  // absent key means the half is ON, so a repo that declared nothing and runs at
  // `/1` has asked for it just as surely as one that wrote the key.
  const askedByDefault = await run({ tier: 'standard', protocol: 'brain-review/1', config: {} });
  assert.match(askedByDefault.body, /the judgment half did not run — .*requires brain-review\/2/,
    'the default-on half, refused by the protocol, must say so');

  // The repo that never asked sees no noise — #690's wallpaper rule. Reaching
  // this state now takes an EXPLICIT `false`; before the ruling the tier could
  // put a repo here without anyone choosing it.
  const neverAsked = await run({
    tier: 'lite', protocol: 'brain-review/1',
    config: { reviewer: { inferential: { enabled: false } } },
  });
  assert.match(neverAsked.body, /^conditions: \[\]$/m);
  assert.notEqual(askedByDefault.body, neverAsked.body,
    'asked-and-refused must not render like never-asked');
});

// ── slice A · the judgment half runs END TO END, from a file ─────────────────
//
// #682's acceptance criterion 2 asked that producer and challenger land
// together; criterion 3 asks for the real verb. This is the half of 3 that a
// hand-written artifact can prove: file → reader → generate → producer →
// challenger → verdict. No agent is spawned; that is slice B.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { artifactPathFor, ARTIFACT_TAG } from './lib/findings-artifact.mjs';
import { COLD_REVIEW_STAGE } from '../lib/stage-engine.mjs';
import { artifactDeps } from './cli.mjs';

function repoWithArtifact(t, findings, pr = 762) {
  const root = mkdtempSync(join(tmpdir(), 'brain-slice-a-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const rel = artifactPathFor(pr);
  mkdirSync(join(root, dirname(rel)), { recursive: true });
  writeFileSync(
    join(root, rel),
    `# Cold review of PR #${pr}\n\n\`\`\`${ARTIFACT_TAG}\n${JSON.stringify(findings, null, 2)}\n\`\`\`\n`,
    'utf8',
  );
  return root;
}

test('slice A: a reasoned finding written to the stage artifact reaches the posted verdict', async (t) => {
  const root = repoWithArtifact(t, [{
    id: 'J1', severity: 'blocker',
    evidence: 'the parser is correct; the semantics are inverted',
    cites: 'reviewer-protocol.md §6.1', file: 'brain/scripts/review/verdict.mjs', line: 166,
  }]);

  const { body } = await run({
    protocol: 'brain-review/2', config: CFG('human'),
    generate: artifactDeps(762, root).generate,
  });

  assert.match(body, /the semantics are inverted/, 'the finding must reach the wire');
  assert.match(body, /^controls: \["deterministic", ?"inferential"\]$/m,
    'and the run must DECLARE that the judgment control was applied — it was');
  assert.doesNotMatch(body, /no transport is configured/,
    'the condition that ships today must be gone: there IS a transport now');
});

test('slice A: the artifact carries `file`+`line`, which is what an inline comment needs', async (t) => {
  const root = repoWithArtifact(t, [{
    id: 'J1', severity: 'blocker', evidence: 'e', cites: 'x §1',
    file: 'brain/scripts/review/verdict.mjs', line: 166,
  }]);
  const { body } = await run({
    protocol: 'brain-review/2', config: CFG('human'),
    generate: artifactDeps(762, root).generate,
  });
  assert.match(body, /file: brain\/scripts\/review\/verdict\.mjs/);
  assert.match(body, /line: 166/);
  // deriveInlineComments turns exactly this pair into a comment on the changed
  // line. A.4 proves it against a posted review; here it is proven to SURVIVE
  // the pipeline, which is the half that was missing.
});

test('slice A: an artifact that exists and is broken posts NOTHING, and says why', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'brain-slice-a-bad-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const rel = artifactPathFor(762);
  mkdirSync(join(root, dirname(rel)), { recursive: true });
  writeFileSync(join(root, rel), `\`\`\`${ARTIFACT_TAG}\n{ not json }\n\`\`\`\n`, 'utf8');

  const { code, body } = await run({
    protocol: 'brain-review/2', config: CFG('human'),
    generate: artifactDeps(762, root).generate,
  });

  assert.notEqual(code, 0, 'a transport that ran and broke must fail closed');
  assert.doesNotMatch(body, /^protocol: brain-review/m,
    'and no verdict may be rendered at all: one declaring `inferential` over findings nobody ' +
    'produced is the uncomputable-evidence APPROVE §10 forbids');

  // The control — the SAME run with a readable artifact does render one, so the
  // assertion above is not passing because this harness never renders anything.
  const good = mkdtempSync(join(tmpdir(), 'brain-slice-a-ok-'));
  t.after(() => rmSync(good, { recursive: true, force: true }));
  mkdirSync(join(good, dirname(rel)), { recursive: true });
  writeFileSync(join(good, rel), `\`\`\`${ARTIFACT_TAG}\n[]\n\`\`\`\n`, 'utf8');
  const ok = await run({
    protocol: 'brain-review/2', config: CFG('human'),
    generate: artifactDeps(762, good).generate,
  });
  assert.equal(ok.code, 0);
  assert.match(ok.body, /^protocol: brain-review/m);
});

test('slice A: the PRODUCTION path is the artifact — no injected deps at all', async (t) => {
  // The pin the three tests above do NOT provide: each of them hands `main` a
  // `generate` directly, so `deps.inferentialDeps ?? artifactDeps(...)` could be
  // deleted and every one of them would stay green. This drives the real branch
  // — nothing injected but the root the artifact is read from.
  const root = repoWithArtifact(t, [{
    id: 'J1', severity: 'blocker', evidence: 'found by the stage, not by a test double',
    cites: 'reviewer-protocol.md §6.1', file: 'a.mjs', line: 7,
  }], 42);   // 42 is the PR the run helper drives

  const lines = [];
  const code = await main({
    argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), error: () => {},
    root, ...deps({ protocol: 'brain-review/2', config: CFG('human') }),
  });
  const body = lines.join('\n');

  assert.equal(code, 0);
  assert.match(body, /found by the stage, not by a test double/,
    'the verdict must carry a finding that reached it through the production wiring');
  assert.match(body, /^controls: \["deterministic", ?"inferential"\]$/m);
});

test('slice A: with no artifact under the root, the half does not run and says so', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'brain-slice-a-none-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const lines = [];
  const code = await main({
    argv: ['--pr', '42', '--dry-run'], log: (s) => lines.push(s), error: () => {},
    root, ...deps({ protocol: 'brain-review/2', config: CFG('human') }),
  });
  const body = lines.join('\n');

  assert.equal(code, 0, 'a repo that never ran the stage has not failed at anything');
  assert.match(body, /no transport is configured/,
    'and it is TOLD — the condition that ships today, still correct when the artifact is absent');
});

// ── C.1 — the bound reaches the loop through the REAL verb ──────────────────

test('C.1: reviewer.convergence.maxRounds reaches the produce loop through main()', async () => {
  // THE PRODUCTION GLUE, PINNED. `main` resolves the bound and hands it to
  // `gatherInferentialInputs`; every unit test for the loop passes `maxRounds`
  // directly, so deleting that one argument from the call site left the whole
  // suite GREEN — measured. The config key would have been inert in the real
  // verb while `convergence.test.mjs` proved the loop honours a bound nobody
  // gave it. Same shape as A.3, where `deps.inferentialDeps ?? artifactDeps(…)`
  // was deletable green until a test drove the real branch.
  const rounds = [];
  const { code } = await run({
    config: {
      reviewer: {
        inferential: { enabled: true },
        convergence: { maxRounds: 4 },
      },
    },
    protocol: 'brain-review/2',
    generate: async ({ round }) => {
      rounds.push(round);
      // A distinct finding per round, so the loop cannot converge early and the
      // count is the bound rather than an accident of repetition.
      return [{ id: `R${round}`, severity: 'editorial', evidence: `round ${round}` }];
    },
  });

  assert.equal(code, 0);
  assert.deepEqual(rounds, [1, 2, 3, 4], 'the configured bound must reach the loop, not stop at the resolver');
});

test('C.1: no convergence key means one round through the real verb', async () => {
  const rounds = [];
  await run({
    config: CFG(),
    protocol: 'brain-review/2',
    generate: async ({ round }) => { rounds.push(round); return [{ id: `R${round}`, severity: 'editorial', evidence: 'x' }]; },
  });

  // The complement, and it is not redundant: without it, passing a constant 4 at
  // the call site would satisfy the test above.
  assert.deepEqual(rounds, [1], 'an unset key runs exactly what ran before it existed');
});

test('C.1: an unreadable maxRounds refuses the run rather than reviewing under the old bound', async () => {
  const { code, body } = await run({
    config: { reviewer: { inferential: { enabled: true }, convergence: { maxRounds: 'three' } } },
    protocol: 'brain-review/2',
    generate: async () => [{ id: 'x', severity: 'editorial', evidence: 'x' }],
  }).catch((err) => ({ code: 'threw', body: err.message }));

  // Fail-closed, like `resolveStageEngine`: an operator who wrote the key asked
  // for something, and quietly running the old bound reviews under a
  // configuration they did not choose.
  assert.match(String(body), /whole number of rounds/);
});

// ── C.2a — THE STAGE IS REACHABLE FROM THE VERB ─────────────────────────────
//
// Until this section existed the slice had a producer, a transport and a reader
// that never touched: `runColdReviewStage` and `makeRunStageSeam` had ZERO
// production callers, measured by grep. Everything was tested and nothing was
// reachable — the same defect class the mutation passes kept finding, at slice
// scale rather than at line scale.
//
// These drive the WHOLE chain through `main()`: config routes the stage → the
// seam reaches a (stubbed) engine → the engine writes the artifact → the reader
// finds it → the finding lands in the verdict. No step is injected past the one
// that would otherwise spawn a real model.

/** A repo root the stage can write into, cleaned up after the test. */
function scratchRoot(t) {
  const dir = mkdtempSync(join(tmpdir(), 'cli-stage-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const ROUTED_CFG = {
  reviewer: { inferential: { enabled: true } },
  sdd: { map: { [COLD_REVIEW_STAGE]: { engine: 'claude', model: 'zz-9' } } },
};

test('C.2a: the routed stage runs, writes, and its finding reaches the verdict', async (t) => {
  const root = scratchRoot(t);
  let spawned = null;

  const lines = [];
  const code = await main({
    argv: ['--pr', '42', '--dry-run'],
    log: (s) => lines.push(s),
    error: () => {},
    ...deps({ config: ROUTED_CFG, protocol: 'brain-review/2' }),
    root,
    // The ONLY injection is the thing that would spawn a real model. Everything
    // between here and the verdict is production code.
    stageDeps: {
      runStage: async (args) => {
        spawned = args;
        const { writeFileSync, mkdirSync } = await import('node:fs');
        const { dirname } = await import('node:path');
        mkdirSync(dirname(join(root, artifactPathFor(42))), { recursive: true });
        writeFileSync(
          join(root, artifactPathFor(42)),
          `# cold review\n\n\`\`\`${ARTIFACT_TAG}\n` +
          JSON.stringify([{
            id: 'C1', severity: 'blocker',
            evidence: 'the stage ran and this came from its artifact',
            cites: 'REQ-S3-3',
          }]) + '\n\`\`\`\n'
        );
        return { ok: true };
      },
    },
  });

  assert.equal(code, 0);

  // 1. The verb reached the seam, with the routing the config named.
  assert.ok(spawned, 'the stage must actually be spawned — this is the call that did not exist');
  assert.equal(spawned.stage, COLD_REVIEW_STAGE);
  assert.equal(spawned.engine, 'claude');
  assert.equal(spawned.model, 'zz-9');
  assert.ok(spawned.prompt.includes(artifactPathFor(42)), 'the role names the path it must write');

  // 2. The artifact is on disk, where the reader looks.
  assert.ok(existsSync(join(root, artifactPathFor(42))), 'the stage wrote its artifact');

  // 3. The finding crossed into the verdict. THIS is the link that was missing:
  //    the reader could always read, but nothing had written.
  const body = lines.join('\n');
  const verdict = parseVerdict({ body });
  assert.ok(
    verdict.findings.some((f) => f.evidence?.includes('came from its artifact')),
    'the artifact the stage wrote must reach the rendered verdict'
  );
  assert.ok(
    !body.includes('no transport is configured'),
    'and the verdict must NOT claim the transport is unconfigured after running it'
  );
});

test('C.2a: the stage runs BEFORE the artifact is looked for', async (t) => {
  const root = scratchRoot(t);
  let existedWhenSpawned = null;

  await main({
    argv: ['--pr', '42', '--dry-run'],
    log: () => {}, error: () => {},
    ...deps({ config: ROUTED_CFG, protocol: 'brain-review/2' }),
    root,
    stageDeps: {
      runStage: async () => {
        existedWhenSpawned = existsSync(join(root, artifactPathFor(42)));
        const { writeFileSync, mkdirSync } = await import('node:fs');
        const { dirname } = await import('node:path');
        mkdirSync(dirname(join(root, artifactPathFor(42))), { recursive: true });
        writeFileSync(join(root, artifactPathFor(42)), `\`\`\`${ARTIFACT_TAG}\n[]\n\`\`\`\n`);
        return { ok: true };
      },
    },
  });

  // THE ORDERING IS THE WIRING. `makeArtifactGenerate` answers `null` for a file
  // absent AT THE MOMENT IT IS ASKED, so resolving the reader first would make
  // the FIRST review on every PR report "no transport is configured" about a
  // stage that had just written its artifact. The read has to come after.
  assert.equal(existedWhenSpawned, false, 'precondition: the artifact did not exist before the stage ran');
});

test('C.2a: an UNROUTED stage spawns nothing and still reads a hand-written artifact', async (t) => {
  const root = scratchRoot(t);
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(join(root, artifactPathFor(42))), { recursive: true });
  writeFileSync(
    join(root, artifactPathFor(42)),
    `\`\`\`${ARTIFACT_TAG}\n` +
    JSON.stringify([{ id: 'H1', severity: 'editorial', evidence: 'written by hand, no stage involved' }]) +
    '\n\`\`\`\n'
  );

  let spawned = false;
  const lines = [];
  await main({
    argv: ['--pr', '42', '--dry-run'],
    log: (s) => lines.push(s), error: () => {},
    ...deps({ config: CFG(), protocol: 'brain-review/2' }),   // no sdd.map
    root,
    stageDeps: { runStage: async () => { spawned = true; return { ok: true }; } },
  });

  // Routing the stage is opt-in — `sdd.map` ships empty. A repo that has not
  // routed it must not have an engine spawned on its behalf, and the file-only
  // path that slice A shipped must keep working exactly as it did.
  assert.equal(spawned, false, 'an unrouted stage spawns nothing');
  assert.ok(
    parseVerdict({ body: lines.join('\n') }).findings.some((f) => f.evidence?.includes('written by hand')),
    'and the artifact is still read'
  );
});

test('C.2a: an injected generator replaces the stage rather than running beside it', async (t) => {
  const root = scratchRoot(t);
  let spawned = false;

  await main({
    argv: ['--pr', '42', '--dry-run'],
    log: () => {}, error: () => {},
    ...deps({ config: ROUTED_CFG, protocol: 'brain-review/2', generate: async () => reasoned() }),
    root,
    stageDeps: { runStage: async () => { spawned = true; return { ok: true }; } },
  });

  // A caller supplying its own generator has supplied the thing the stage exists
  // to produce. Spawning anyway burns a model call whose output nothing reads —
  // and would make every existing test in this file spawn an engine.
  assert.equal(spawned, false, 'an injected generator means the stage is what was replaced');
});

test('C.2a: a FAILED stage refuses the run and does not report "no transport"', async (t) => {
  const root = scratchRoot(t);
  const errors = [];

  const code = await main({
    argv: ['--pr', '42', '--dry-run'],
    log: () => {}, error: (s) => errors.push(s),
    ...deps({ config: ROUTED_CFG, protocol: 'brain-review/2' }),
    root,
    stageDeps: { runStage: async () => ({ ok: false, reason: 'the engine exited with status 137' }) },
  });

  assert.equal(code, 1, 'a failed stage refuses the run');

  const said = errors.join('\n');
  assert.match(said, /the cold-review stage failed/);
  assert.match(said, /status 137/, 'and names what actually went wrong');

  // THE FOLD THIS BRANCH EXISTS TO PREVENT. Falling through instead would reach
  // `artifactDeps`, find no file, and render "enabled but no transport is
  // configured" — telling an operator who configured an engine that they did
  // not. Same words, opposite fact.
  assert.ok(
    !said.includes('no transport is configured'),
    'a configured engine that broke must not be reported as an unconfigured one'
  );
});

test('C.2a: a routed engine with no backend refuses through the REAL seam', async (t) => {
  const root = scratchRoot(t);
  const errors = [];

  // No `stageDeps` at all — this drives `makeRunStageSeam()` and the real
  // dispatcher, so B.6's refusal is exercised from the verb rather than from a
  // unit test standing next to it.
  const code = await main({
    argv: ['--pr', '42', '--dry-run'],
    log: () => {}, error: (s) => errors.push(s),
    ...deps({
      config: {
        reviewer: { inferential: { enabled: true } },
        sdd: { map: { [COLD_REVIEW_STAGE]: { engine: 'no-such-engine-at-all' } } },
      },
      protocol: 'brain-review/2',
    }),
    root,
  });

  assert.equal(code, 1);
  assert.match(errors.join('\n'), /no-such-engine-at-all/, 'the refusal names the engine the operator wrote');
  assert.match(errors.join('\n'), /Refusing rather than falling back/);
});
