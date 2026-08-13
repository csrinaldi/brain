// checkpoint.test.mjs — Unit tests for REQ-H1-10: the checkpoint evaluator
// (design.md §2). No test spawns a real gh/git process except the ONE
// real-git test for `defaultRunReversion`'s isolation guarantee (mirrors
// cold-boot.test.mjs's COLDBOOT-CWD test) — every other seam is injected.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  evaluateCheckpoint,
  gatherCheckpointInputs,
  parseBudgetClaim,
  resolveChangeId,
  defaultRunReversion,
} from './checkpoint.mjs';
import { REQUIRED_JOBS, DETECTION_JOBS } from '../../vcs/governance-checks.mjs';
import { TIERS, tierParams } from '../../vcs/governance-tiers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VACUOUS_FIXTURE = join(__dirname, '..', 'fixtures', 'vacuous.test.mjs');

function greenRollup() {
  return [
    ...REQUIRED_JOBS.map(name => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
    ...DETECTION_JOBS.map(name => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
  ];
}

function greenTrancheInputs(overrides = {}) {
  return { requiredGates: greenRollup(), changedFiles: [], budget: { lines: 10, uncomputable: false, baseSha: 'BASE', headSha: 'HEAD' }, prBody: '', ...overrides };
}

// ── §10.1 report-vs-tree drift (parseBudgetClaim + evaluateCheckpoint) ──────

test('parseBudgetClaim: extracts "NNN/400" from report text', () => {
  assert.deepEqual(
    parseBudgetClaim('Counted diff re-derived cold = **372/400** — under budget.', 400),
    { claimed: 372, declaredBudget: 400, matchesTierBudget: true },
  );
});

test('parseBudgetClaim: no claim present → null', () => {
  assert.equal(parseBudgetClaim('No budget claim here.', 400), null);
});

// Issue #472: the denominator is the TIER's diff budget (ADR-0026: lite 1000 ·
// standard 400 · regulated 200), not a constant. The literal `400` predated Q5
// and matched `standard` by accident, so at the other two tiers the parser
// returned null, `reportClaims` stayed `[]`, and §10.1 checked NOTHING while
// reporting no finding — "no claim was parseable" indistinguishable from "the
// report matched the tree". `evidence-reader-empty-on-failure`, in the drift
// check whose entire job is catching a report that overstates.
test('parseBudgetClaim: parses an honest report at EVERY tier, not only at standard', () => {
  for (const [tier, budget, claimed] of [['lite', 1000, 372], ['standard', 400, 372], ['regulated', 200, 150]]) {
    const text = `Counted diff re-derived cold = **${claimed}/${budget}** — under budget.`;
    assert.deepEqual(
      parseBudgetClaim(text, budget),
      { claimed, declaredBudget: budget, matchesTierBudget: true },
      `${tier}: an honest report at this tier must yield a checkable claim`,
    );
  }
});

test('parseBudgetClaim: a report quoting a budget the repo does not operate under is parsed and FLAGGED, never silently dropped', () => {
  // Policy (issue #472, option 2): a checkpoint report citing the wrong tier's
  // budget is itself report drift — §10.1's subject. Returning null here would
  // turn a doctrine error back into the silence this issue exists to remove.
  assert.deepEqual(
    parseBudgetClaim('Counted diff re-derived cold = **372/400** — under budget.', 200),
    { claimed: 372, declaredBudget: 400, matchesTierBudget: false },
  );
});

test('parseBudgetClaim: with SEVERAL wrong-budget claims, selection is by value and not by position', () => {
  // The mismatch path needs its own multi-candidate case: every other
  // wrong-denominator case carries exactly one candidate, so which one the
  // fallback picks is unobservable there and a position-based pick survives.
  // Same fail-closed rule as the matching path — lowest numerator, both orders.
  for (const [label, text] of [
    ['lowest last', 'Slice A **372/400**. Slice B **150/200**.'],
    ['lowest first', 'Slice B **150/200**. Slice A **372/400**.'],
  ]) {
    assert.deepEqual(
      parseBudgetClaim(text, 1000),
      { claimed: 150, declaredBudget: 200, matchesTierBudget: false },
      `${label}: the wrong-budget claim reported must be chosen by value, not by where it appears`,
    );
  }
});

test('parseBudgetClaim: the omitted-budget default is RESOLVED from tierParams, never written as a literal', () => {
  // Blind-axis cover (SPELLING): every other case passes `diffBudget`
  // explicitly, so a literal reintroduced as the parameter's default would
  // survive all of them. This is the only case that drives the default, and it
  // compares against the resolver rather than against a typed-in number — a
  // number here would just be the same literal in a second place.
  const standardBudget = tierParams('standard').diffBudget;
  assert.deepEqual(
    parseBudgetClaim(`Counted diff re-derived cold = **372/${standardBudget}** — under budget.`),
    { claimed: 372, declaredBudget: standardBudget, matchesTierBudget: true },
  );
});

test('parseBudgetClaim: the omitted-budget default is written as a RESOLUTION, not as a number', () => {
  // No behavioural assertion can catch this: `standard`'s budget IS 400, so a
  // literal `400` default and the resolved one are indistinguishable at runtime
  // until the tier table changes — the same trap #468 hit with the 48h
  // staleness label. Asserting the source is the only form that distinguishes
  // them, and the untiered literal is precisely this issue's defect.
  const src = readFileSync(fileURLToPath(new URL('./checkpoint.mjs', import.meta.url)), 'utf8');
  assert.match(
    src,
    /diffBudget = tierParams\(DEFAULT_TIER\)\.diffBudget/,
    'the default must resolve through tierParams — a numeric literal here is the same defect this issue removes, in a second place',
  );
});

// Issue #472, second review round. The first implementation admitted ANY bold
// fraction as a claim, which made the drift check assert things reports never
// said — a false blocker carrying invented evidence, strictly worse than the
// silence this issue set out to remove. These cases pin the narrowing, and the
// SELECTION axis (which of several candidates wins) that nothing else varied.

test('parseBudgetClaim: the spaced form is a claim — 6 real reports state theirs only that way', () => {
  // SPELLING axis on the parser's own regex. `\s*` around the slash is
  // load-bearing: archive/205, 214, 219, 221, 222 and 229 write
  // `**330 / 400**` and nothing else, so deleting the tolerance sends all six
  // back to `null` — the round-2 blocker class (a real report newly silenced)
  // along an axis no case drove.
  for (const text of ['Counted diff **372 / 1000**.', 'Counted diff **372/1000**.', 'Counted diff **372 /1000**.']) {
    assert.deepEqual(
      parseBudgetClaim(text, 1000),
      { claimed: 372, declaredBudget: 1000, matchesTierBudget: true },
      `whitespace around the slash is formatting, never meaning: ${text}`,
    );
  }
});

test('parseBudgetClaim: a claim stated INSIDE a markdown table row is still a claim', () => {
  // Verbatim shape from openspec/changes/archive/193: this repo states the
  // diff-size gate verdict in a table, and for a report whose prose total
  // carries no denominator that row is its only machine-readable compliance
  // claim. An earlier round excluded rows wholesale and sent exactly this
  // report back to `null` — reintroducing, at `standard`, the silence this
  // issue removes. Structure is not what makes something a claim; the
  // denominator being a declared budget is.
  const text = [
    '| gate | level | verdict | note |',
    '| `diff-size` | REQUIRED | **PASS (conditional)** | 1/400 — provided the split lands |',
  ].join('\n');
  assert.deepEqual(
    parseBudgetClaim(text, 400),
    { claimed: 1, declaredBudget: 400, matchesTierBudget: true },
  );
});

test('parseBudgetClaim: a denominator no tier declares is not a budget claim (test counts, slice counts)', () => {
  // `npm test: **1269/1269**` is the shape that produced a fabricated
  // wrong-denominator blocker on archive/246.
  assert.equal(parseBudgetClaim('- `npm test`: **1269/1269** green.', 1000), null);
  assert.equal(parseBudgetClaim('Reverted **1/2** of the slices.', 1000), null);
  assert.equal(parseBudgetClaim('Tests: **2579/2579** green. No budget line.', 1000), null);

  // VALUE CLASS: the fixtures above are all irregular numbers, so a predicate
  // relaxed to "looks budget-ish" (any round hundred) rejects every one of them
  // and survives. Round denominators that no tier declares are the class that
  // catches it — the anti-pattern's rule 4, a partially-relaxed predicate.
  for (const notABudget of [100, 300, 500, 800, 2000]) {
    assert.equal(
      parseBudgetClaim(`Counted diff **250/${notABudget}**.`, 1000), null,
      `${notABudget} is round but is not a budget any tier declares — only the tier table decides`,
    );
  }
});

test('evaluateCheckpoint: a claim carrying no matchesTierBudget produces NO budget finding — the check is strictly === false', () => {
  // `reportClaims` is a published contract ("more parsers can be added without
  // changing the contract"), and any future producer omits this field. Relaxed
  // to `!== true`, every such claim emits a bogus blocker reading "this repo
  // resolves undefined". The strictness is deliberate; nothing else proves it.
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    reportClaims: [{ key: 'counted-lines', claimed: 10, recomputed: 10 }],
  });
  assert.equal(
    result.findings.filter((f) => f.id.endsWith('-budget')).length, 0,
    'a claim from a producer that does not classify the denominator must not be accused of quoting the wrong one',
  );
});

test('parseBudgetClaim: with several candidates, the one stated against THIS tier wins regardless of position', () => {
  // SELECTION axis. Asserted from BOTH orders so that neither "take the first"
  // nor "take the last" can satisfy it — a single-order case is satisfied by
  // whichever accident put the right candidate at that end.
  const firstWins = 'Earlier slice ran **150/200**. Counted diff re-derived cold = **372/400**.';
  const lastWins = 'Counted diff re-derived cold = **372/400**. Earlier slice ran **150/200**.';
  for (const [label, text] of [['tier claim last', firstWins], ['tier claim first', lastWins]]) {
    assert.deepEqual(
      parseBudgetClaim(text, 400),
      { claimed: 372, declaredBudget: 400, matchesTierBudget: true },
      `${label}: position must not decide which claim is read`,
    );
  }

  // Two claims against the SAME (tier) budget — the case that actually forces a
  // choice. A single-denominator pair is what a first-vs-last selection can be
  // caught by; the pair above cannot catch it, because only one candidate ever
  // matched. The smallest numerator wins in BOTH orders: fail-closed, and a
  // property of the claim rather than of where the author typed it.
  for (const [label, text] of [
    ['larger stated last', 'Counted diff **372/400**. After the fixup: **500/400**.'],
    ['larger stated first', 'After the fixup: **500/400**. Counted diff **372/400**.'],
  ]) {
    assert.equal(parseBudgetClaim(text, 400).claimed, 372, `${label}: the drift check must read the claim most likely to surface drift`);
  }
});

test('parseBudgetClaim: no budget literal survives anywhere in the module, not only in the parameter default', () => {
  // Widened from a single-string source scan: the literal can come back at the
  // CALL SITE (`trancheInputs.diffBudget ?? 400`) or inside the function body,
  // and a scan for one exact spelling sees neither. Comments are stripped first
  // — they cite the tier table on purpose, and citing a number is not declaring
  // one. REQ-TIER-9: resolve, never re-declare.
  const src = readFileSync(fileURLToPath(new URL('./checkpoint.mjs', import.meta.url)), 'utf8');
  const code = src
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  // Numeric literals are normalised through Number(), so decimal, exponent
  // (`4e2`), hex/octal/binary (`0x190`) and separator (`1_000`) spellings are
  // all caught. The claim stops there, deliberately: a COMPUTED value
  // (`4 * 100`) is unreachable by any lexical scan, and asserting otherwise
  // would be the completeness this guard cannot have. What it buys is that
  // every spelling someone would plausibly TYPE is covered; what it does not
  // buy is proof that no budget can be reconstructed arithmetically.
  const budgets = new Set(TIERS.map((t) => tierParams(t).diffBudget));
  const literals = [...code.matchAll(/(?<![\w.$])(?:0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?)(?![\w.])/g)]
    .map((m) => Number(m[0].replace(/_/g, '')));
  const offenders = literals.filter((n) => budgets.has(n));
  assert.deepEqual(
    offenders, [],
    `a tier budget is written as a numeric literal in executable code (${offenders.join(', ')}) — resolve it through tierParams instead (REQ-TIER-9)`,
  );
});

test('parseBudgetClaim: prefers the claim whose denominator IS the tier budget over an unrelated fraction', () => {
  const text = 'Reverted 1/2 of the slices. Counted diff re-derived cold = **372/1000** — under budget.';
  assert.deepEqual(
    parseBudgetClaim(text, 1000),
    { claimed: 372, declaredBudget: 1000, matchesTierBudget: true },
  );
});

test('evaluateCheckpoint: report claims fewer lines than the cold recomputation → blocker citing the recomputed value', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    reportClaims: [{ key: 'counted-lines', claimed: 300, recomputed: 372 }],
  });
  assert.equal(result.conclusion, 'REVISE');
  const finding = result.findings.find(f => f.id === 'drift:counted-lines');
  assert.ok(finding, 'expected a drift finding');
  assert.equal(finding.severity, 'blocker');
  assert.match(finding.evidence, /300/);
  assert.match(finding.evidence, /372/);
});

test('evaluateCheckpoint: report claim matches the recomputation → no drift finding', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    reportClaims: [{ key: 'counted-lines', claimed: 372, recomputed: 372 }],
  });
  assert.ok(!result.findings.some(f => f.id === 'drift:counted-lines'));
});

// ── §10.2 artifact completeness ─────────────────────────────────────────────

test('evaluateCheckpoint: a missing tier-required artefact → blocker citing governance-tiers', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    artifacts: { missing: ['design.md'], hasCheckedTask: true },
  });
  assert.equal(result.conclusion, 'REVISE');
  const finding = result.findings.find(f => f.id === 'artifacts-missing');
  assert.ok(finding);
  assert.match(finding.evidence, /design\.md/);
});

test('evaluateCheckpoint: tasks.md has zero "- [x]" entries → blocker', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    artifacts: { missing: [], hasCheckedTask: false },
  });
  const finding = result.findings.find(f => f.id === 'tasks-no-progress');
  assert.ok(finding);
  assert.equal(finding.severity, 'blocker');
});

test('evaluateCheckpoint: artifacts complete, tasks.md has progress → no artifact findings', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    artifacts: { missing: [], hasCheckedTask: true },
  });
  assert.ok(!result.findings.some(f => f.id === 'artifacts-missing' || f.id === 'tasks-no-progress'));
});

// ── §10.3 prior pins applied, cited file:line ───────────────────────────────

test('evaluateCheckpoint: a pin with no citation → blocker', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    pins: [{ id: 'CP-1', citation: null }],
  });
  const finding = result.findings.find(f => f.id === 'pin:CP-1');
  assert.ok(finding);
  assert.match(finding.evidence, /no file:line citation/);
});

test('evaluateCheckpoint: a pin cited to a file absent from the tree → blocker (not applied)', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    pins: [{ id: 'CP-2', citation: 'brain/core/methodology/reviewer-protocol.md:42' }],
    exists: () => false,
  });
  const finding = result.findings.find(f => f.id === 'pin:CP-2');
  assert.ok(finding);
  assert.match(finding.evidence, /not found in the reviewed tree/);
});

test('evaluateCheckpoint: a pin cited to a file present in the tree → no finding', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    pins: [{ id: 'CP-3', citation: 'brain/core/methodology/reviewer-protocol.md:42' }],
    exists: () => true,
  });
  assert.ok(!result.findings.some(f => f.id === 'pin:CP-3'));
});

test('evaluateCheckpoint: a pin with a truthy non-string (numeric) citation → blocker, does not throw (MINOR 4)', () => {
  let result;
  assert.doesNotThrow(() => {
    result = evaluateCheckpoint({
      trancheInputs: greenTrancheInputs(),
      pins: [{ id: 'CP-4', citation: 42 }],
    });
  }, 'a non-string citation is a missing/invalid citation, not a crash');
  const finding = result.findings.find(f => f.id === 'pin:CP-4');
  assert.ok(finding, 'a numeric citation must produce a missing-citation finding');
  assert.equal(finding.severity, 'blocker');
  assert.match(finding.evidence, /no file:line citation/);
});

// ── §10.4 TDD-RED by reversion ──────────────────────────────────────────────

test('evaluateCheckpoint: reversion uncomputable (no base sha) → REVISE, conditions include "evidence uncomputable", never APPROVE', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    reversion: { uncomputable: true, command: null },
  });
  assert.equal(result.conclusion, 'REVISE');
  assert.ok(result.conditions.some(c => /evidence uncomputable/.test(c)));
});

test('evaluateCheckpoint: a new test that PASSED against the reverted base → blocker quoting the revert+test command', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    reversion: { uncomputable: false, command: 'git checkout BASE -- impl.mjs && node --test vacuous.test.mjs', vacuousTests: ['vacuous.test.mjs'] },
  });
  assert.equal(result.conclusion, 'REVISE');
  const finding = result.findings.find(f => f.id === 'reversion:vacuous.test.mjs');
  assert.ok(finding, 'a vacuous test must be caught by reversion');
  assert.equal(finding.severity, 'blocker');
  assert.match(finding.evidence, /git checkout BASE/);
});

test('evaluateCheckpoint: every new test FAILED against base (real RED) → no reversion finding', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    reversion: { uncomputable: false, command: 'git checkout BASE -- impl.mjs && node --test real.test.mjs', vacuousTests: [] },
  });
  assert.ok(!result.findings.some(f => f.id?.startsWith('reversion:')));
});

// ── §10.5 audit/governance-status quoted + decision-gate step-2 → ruling ────

test('evaluateCheckpoint: brain:audit and brain:governance-status output are quoted verbatim as editorial findings', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    auditOutput: 'audit: 3 records, 0 orphaned',
    governanceStatusOutput: 'governance status — owner/repo (github)',
  });
  const audit = result.findings.find(f => f.id === 'audit-output');
  const gov = result.findings.find(f => f.id === 'governance-status-output');
  assert.ok(audit && gov);
  assert.equal(audit.severity, 'editorial');
  assert.match(audit.evidence, /3 records/);
  assert.equal(gov.severity, 'editorial');
  assert.match(gov.evidence, /owner\/repo/);
});

test('evaluateCheckpoint: an architectural surface touched without the "decision" label → blocker (converts the decision-gate step-2 warn into a ruling)', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs({ changedFiles: ['brain/core/methodology/reviewer-protocol.md'] }),
    changedFiles: ['brain/core/methodology/reviewer-protocol.md'],
    hasDecisionLabel: false,
  });
  assert.equal(result.conclusion, 'REVISE');
  const finding = result.findings.find(f => f.id === 'decision-surface');
  assert.ok(finding, 'expected the step-2 heuristic to be converted into a hard finding');
  assert.match(finding.evidence, /reviewer-protocol\.md/);
  assert.match(finding.cites, /decision-gate/);
});

test('evaluateCheckpoint: an architectural surface touched WITH the "decision" label → no decision-surface finding', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs({ changedFiles: ['brain/core/methodology/reviewer-protocol.md'] }),
    changedFiles: ['brain/core/methodology/reviewer-protocol.md'],
    hasDecisionLabel: true,
  });
  assert.ok(!result.findings.some(f => f.id === 'decision-surface'));
});

// ── reuse of evaluateTranche (no re-implementation of gates/budget/detection) ─

test('evaluateCheckpoint: a failing required gate (tranche-level) still surfaces through the checkpoint verdict', () => {
  const rollup = greenRollup().map(g => (g.name === 'memory-gate' ? { ...g, conclusion: 'FAILURE' } : g));
  const result = evaluateCheckpoint({ trancheInputs: greenTrancheInputs({ requiredGates: rollup }) });
  assert.equal(result.conclusion, 'REVISE');
  assert.ok(result.findings.find(f => f.id === 'gate:memory-gate'));
});

test('evaluateCheckpoint: everything green → APPROVE, gates carried through from evaluateTranche', () => {
  const result = evaluateCheckpoint({
    trancheInputs: greenTrancheInputs(),
    reversion: { uncomputable: false, command: 'cmd', vacuousTests: [] },
  });
  assert.equal(result.conclusion, 'APPROVE');
  assert.deepEqual(result.gates.required, REQUIRED_JOBS);
});

test('evaluateCheckpoint: the tiered diff budget reaches the checkpoint verdict through the shared gather (#443, REQ-443-5)', async () => {
  // #443 fixed `gatherTrancheInputs`, and checkpoint gathers through it — so this
  // evaluator is fixed "for free". "For free" is a CLAIM: an unexercised protection
  // carries no information, and the whole reason #443 existed is that the one tier
  // under test was the one where the bug was invisible. Gather for real (not
  // hand-wired trancheInputs) at regulated, where 250 lines is over the 200 budget
  // and was silently APPROVED before the fix.
  const inputs = await gatherCheckpointInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    changedFiles: ['a.mjs'],
    deps: {
      baseSha: 'BASE',
      trancheDeps: {
        tier: 'regulated',
        fetchRollup: async () => greenRollup(),
        diffNumstat: () => '250\t0\tbig.txt\n',
        readIgnoreList: () => [],
      },
      runReversion: async () => ({ uncomputable: false, command: 'cmd', vacuousTests: [] }),
      runAudit: () => '',
      runGovernanceStatus: () => '',
      exists: () => true,
      listDir: () => [],
      readFile: () => '',
    },
  });
  assert.equal(inputs.trancheInputs.diffBudget, 200, 'the gather must carry regulated\'s budget, not the pre-#443 constant');
  const result = evaluateCheckpoint(inputs);
  const finding = result.findings.find(f => f.id === 'budget');
  assert.ok(finding, 'the checkpoint verdict must carry the budget blocker — a 250-line diff at regulated is over doctrine');
  assert.equal(result.conclusion, 'REVISE');
});

// ── resolveChangeId ──────────────────────────────────────────────────────────

test('resolveChangeId: extracts the change id from a checkpoint-report.md path', () => {
  assert.equal(resolveChangeId(['openspec/changes/issue-266-h1-brain-review/checkpoint-report.md', 'a.mjs']), 'issue-266-h1-brain-review');
});

test('resolveChangeId: no checkpoint-report.md present → null', () => {
  assert.equal(resolveChangeId(['a.mjs']), null);
});

// ── gatherCheckpointInputs (DI-seam) ─────────────────────────────────────────

test('gatherCheckpointInputs: deps.baseSha absent → reversion is uncomputable, runReversion never invoked, never reads ci-context', async () => {
  let called = false;
  const inputs = await gatherCheckpointInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    changedFiles: ['a.mjs'],
    deps: {
      runReversion: async () => { called = true; return { uncomputable: false, command: '', vacuousTests: [] }; },
      trancheDeps: { fetchRollup: async () => greenRollup(), diffNumstat: () => '', readIgnoreList: () => [] },
      runAudit: () => '', runGovernanceStatus: () => '',
    },
  });
  assert.equal(called, false);
  assert.equal(inputs.reversion.uncomputable, true);
});

test('gatherCheckpointInputs: deps.baseSha injected → wires runReversion with base+head+impl/test files derived from changedFiles', async () => {
  let seen = null;
  const inputs = await gatherCheckpointInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    changedFiles: ['review/evaluators/checkpoint.mjs', 'review/evaluators/checkpoint.test.mjs'],
    deps: {
      baseSha: 'BASE',
      runReversion: async (args) => { seen = args; return { uncomputable: false, command: 'cmd', vacuousTests: [] }; },
      trancheDeps: { fetchRollup: async () => greenRollup(), diffNumstat: () => '', readIgnoreList: () => [] },
      runAudit: () => '', runGovernanceStatus: () => '',
    },
  });
  assert.equal(seen.baseSha, 'BASE');
  assert.equal(seen.headSha, 'HEAD');
  assert.deepEqual(seen.implFiles, ['review/evaluators/checkpoint.mjs']);
  assert.deepEqual(seen.testFiles, ['review/evaluators/checkpoint.test.mjs']);
  assert.equal(inputs.reversion.uncomputable, false);
});

test('gatherCheckpointInputs: resolves artifacts + report claim from an injected fs seam (exists/listDir/readFile), never touches the real fs', async () => {
  const changeId = 'issue-999-fixture';
  const files = {
    [`openspec/changes/${changeId}/proposal.md`]: 'x',
    [`openspec/changes/${changeId}/spec.md`]: 'x',
    [`openspec/changes/${changeId}/design.md`]: 'x',
    [`openspec/changes/${changeId}/tasks.md`]: '- [x] done\n- [ ] pending\n',
    [`openspec/changes/${changeId}/checkpoint-report.md`]: 'Counted diff = **372/400**.',
  };
  const inputs = await gatherCheckpointInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    changedFiles: [`openspec/changes/${changeId}/checkpoint-report.md`],
    deps: {
      baseSha: 'BASE',
      exists: (p) => p in files,
      listDir: () => [],
      readFile: (p) => files[p],
      runReversion: async () => ({ uncomputable: false, command: 'cmd', vacuousTests: [] }),
      trancheDeps: { fetchRollup: async () => greenRollup(), diffNumstat: () => '10\t5\ta.mjs\n', readIgnoreList: () => [] },
      runAudit: () => '', runGovernanceStatus: () => '',
    },
  });
  assert.deepEqual(inputs.artifacts.missing, []);
  assert.equal(inputs.artifacts.hasCheckedTask, true);
  assert.equal(inputs.reportClaims[0].claimed, 372);
  assert.equal(inputs.reportClaims[0].recomputed, 15);
});

// Issue #472 — the integration cases. The unit tests above pass `diffBudget`
// explicitly, so they are blind along the PATH axis: reverting the CALL SITE to
// `parseBudgetClaim(reportText)` restores the whole defect (the parameter falls
// back to the `standard` default) while every unit test stays green. These
// drive the gather seam, which is the only place that binding is observable.
// (brain/core/anti-patterns/red-proof-blind-along-an-unvaried-axis.md)

/** Builds the injected fs + tranche seams for a checkpoint gather at a given tier. */
function gatherAtTier({ tier, reportText, numstat = '10\t5\ta.mjs\n' }) {
  const changeId = 'issue-999-fixture';
  const files = {
    [`openspec/changes/${changeId}/proposal.md`]: 'x',
    [`openspec/changes/${changeId}/spec.md`]: 'x',
    [`openspec/changes/${changeId}/design.md`]: 'x',
    [`openspec/changes/${changeId}/tasks.md`]: '- [x] done\n',
    [`openspec/changes/${changeId}/checkpoint-report.md`]: reportText,
  };
  return gatherCheckpointInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    changedFiles: [`openspec/changes/${changeId}/checkpoint-report.md`],
    // #555 round 2: the TOP-LEVEL tier, which drives requiredArtifactsFor. It was
    // passed only into trancheDeps, so every checkpoint test ran the artefact
    // resolution at the 'standard' default — the consumer was blind along the very
    // axis #555 introduced, and a cold review measured that neither of the PR's own
    // mutations moved a single checkpoint test.
    tier,
    deps: {
      baseSha: 'BASE',
      exists: (p) => p in files,
      listDir: () => [],
      readFile: (p) => files[p],
      runReversion: async () => ({ uncomputable: false, command: 'cmd', vacuousTests: [] }),
      trancheDeps: { tier, fetchRollup: async () => greenRollup(), diffNumstat: () => numstat, readIgnoreList: () => [] },
      runAudit: () => '', runGovernanceStatus: () => '',
    },
  });
}

test('gatherCheckpointInputs → evaluateCheckpoint: at LITE, an understated report still produces the drift blocker', async () => {
  // 372 claimed against a tree holding 400 counted lines. Before #472 the lite
  // report `**372/1000**` parsed to null, `reportClaims` stayed [], and §10.1
  // returned no finding — silence indistinguishable from a matching report.
  const inputs = await gatherAtTier({
    tier: 'lite',
    reportText: 'Counted diff re-derived cold = **372/1000** — under budget.',
    numstat: '300\t100\ta.mjs\n',
  });

  assert.equal(inputs.reportClaims.length, 1, 'a lite report must yield a checkable claim');
  assert.equal(inputs.reportClaims[0].claimed, 372);
  assert.equal(inputs.reportClaims[0].tierBudget, 1000, 'the budget must ride the SAME tier resolution as the job sets');
  assert.equal(
    inputs.reportClaims[0].matchesTierBudget, true,
    'the tier must reach the PARSER, not merely the claim object — this is the only value that changes if the call site drops its diffBudget argument, and the canonical fallback would otherwise mask that regression',
  );

  const result = evaluateCheckpoint({ ...inputs, trancheInputs: inputs.trancheInputs });
  const drift = result.findings.find((f) => f.id === 'drift:counted-lines');
  assert.ok(drift, 'a report claiming fewer lines than the tree holds must block at lite, exactly as at standard');
  assert.match(drift.evidence, /claims counted-lines=372; cold recomputation = 400/);
});

test('gatherCheckpointInputs → evaluateCheckpoint: at REGULATED, an understated report produces the drift blocker', async () => {
  const inputs = await gatherAtTier({
    tier: 'regulated',
    reportText: 'Counted diff re-derived cold = **150/200** — under budget.',
    numstat: '200\t100\ta.mjs\n',
  });

  assert.equal(inputs.reportClaims[0].tierBudget, 200);
  assert.equal(inputs.reportClaims[0].matchesTierBudget, true, 'the tier reached the parser (see the lite case)');
  const result = evaluateCheckpoint({ ...inputs, trancheInputs: inputs.trancheInputs });
  assert.ok(result.findings.some((f) => f.id === 'drift:counted-lines'), 'regulated must block too');
});

test('gatherCheckpointInputs: at STANDARD the behaviour is unchanged — the no-op migration guarantee (REQ-TIER-10)', async () => {
  // Asserted explicitly rather than inferred from "standard still passes":
  // every fixture in this suite sat at standard before #472, which is exactly
  // why the defect survived. "Standard is green" is not evidence about a change
  // that only ever misbehaved at the other two tiers.
  const inputs = await gatherAtTier({
    tier: 'standard',
    reportText: 'Counted diff re-derived cold = **372/400** — under budget.',
    numstat: '10\t5\ta.mjs\n',
  });

  assert.deepEqual(
    { claimed: inputs.reportClaims[0].claimed, recomputed: inputs.reportClaims[0].recomputed, tierBudget: inputs.reportClaims[0].tierBudget },
    { claimed: 372, recomputed: 15, tierBudget: 400 },
  );
  const result = evaluateCheckpoint({ ...inputs, trancheInputs: inputs.trancheInputs });
  assert.equal(result.findings.filter((f) => f.id.startsWith('drift:')).length, 0, 'an honest standard report drifts on nothing');
});

test('gatherCheckpointInputs → evaluateCheckpoint: a report quoting the WRONG tier budget blocks on the denominator (issue #472 option 2)', async () => {
  // The report is numerically honest (150 ≤ the tree) but cites `standard`'s
  // ceiling in a `regulated` repo — it asserts compliance against doctrine that
  // does not apply here. Silence would be the pre-#472 behaviour by another route.
  const inputs = await gatherAtTier({
    tier: 'regulated',
    reportText: 'Counted diff re-derived cold = **150/400** — under budget.',
    numstat: '10\t5\ta.mjs\n',
  });

  const result = evaluateCheckpoint({ ...inputs, trancheInputs: inputs.trancheInputs });
  const finding = result.findings.find((f) => f.id === 'drift:counted-lines-budget');
  assert.ok(finding, 'a report citing a budget the repo does not operate under is report drift in its own right');
  assert.match(finding.evidence, /states the counted-lines budget as 400; this repo resolves 200 \(tier: regulated\)/);
  assert.equal(finding.severity, 'blocker');
});

test('gatherCheckpointInputs: doctrineRecords with a `pin` field are surfaced as pins with their citation', async () => {
  const inputs = await gatherCheckpointInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    changedFiles: [],
    doctrineRecords: [
      { id: 'r1', type: 'decision', pin: { citation: 'brain/HOME.md:1' } },
      { id: 'r2', type: 'decision' }, // no pin — not a prior ruling pin
    ],
    deps: {
      trancheDeps: { fetchRollup: async () => greenRollup(), diffNumstat: () => '', readIgnoreList: () => [] },
      runAudit: () => '', runGovernanceStatus: () => '',
    },
  });
  assert.deepEqual(inputs.pins, [{ id: 'r1', citation: 'brain/HOME.md:1' }]);
});

test('gatherCheckpointInputs: default audit + governance-status runners spawn against the cold worktreePath, not the operator cwd (MINOR 3)', async () => {
  const seen = [];
  const worktreePath = '/tmp/cold-worktree-minor3';
  await gatherCheckpointInputs({
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    headSha: 'HEAD',
    changedFiles: [],
    worktreePath,
    deps: {
      // Capture what the DEFAULT audit/gov runners spawn (runAudit /
      // runGovernanceStatus are deliberately NOT injected → the real wiring
      // path is exercised, so this asserts they run against the cold worktree).
      exec: (file, args, opts) => { seen.push({ script: args[0], cwd: opts.cwd }); return `${args[0]} ran`; },
      trancheDeps: { fetchRollup: async () => greenRollup(), diffNumstat: () => '', readIgnoreList: () => [] },
    },
  });
  const auditCall = seen.find(c => c.script.includes('brain-audit'));
  const govCall = seen.find(c => c.script.includes('brain-governance-status'));
  assert.ok(auditCall, 'brain:audit must be spawned via the injected exec seam');
  assert.ok(govCall, 'brain:governance-status must be spawned via the injected exec seam');
  assert.equal(auditCall.cwd, worktreePath);
  assert.equal(govCall.cwd, worktreePath);
});

// ── REVERSION-CWD (real default, issue #266 H1-3): isolated worktree, never
// moves the operator's HEAD — mirrors cold-boot.test.mjs's COLDBOOT-CWD test.

test('REVERSION-CWD (real default): defaultRunReversion reverts impl to base in an ISOLATED worktree, catches the vacuous fixture, and never moves the operator HEAD', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'brain-review-rev-op-'));
  const wtParent = mkdtempSync(join(tmpdir(), 'brain-review-rev-wt-'));
  t.after(() => {
    try { execFileSync('git', ['worktree', 'prune'], { cwd: repo }); } catch { /* best effort */ }
    rmSync(repo, { recursive: true, force: true });
    rmSync(wtParent, { recursive: true, force: true });
  });

  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 't');

  // base: a "buggy" impl, no tests yet.
  writeFileSync(join(repo, 'impl.mjs'), 'export function add(a, b) { return a - b; }\n');
  git('add', 'impl.mjs');
  git('commit', '-q', '-m', 'base');
  const baseSha = git('rev-parse', 'HEAD');
  const branch = git('symbolic-ref', '--short', 'HEAD');

  // head: impl fixed + a real test (fails against base) + the vacuous fixture (passes against base).
  writeFileSync(join(repo, 'impl.mjs'), 'export function add(a, b) { return a + b; }\n');
  writeFileSync(join(repo, 'real.test.mjs'), [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { add } from './impl.mjs';",
    "test('add works', () => { assert.equal(add(2, 3), 5); });",
  ].join('\n') + '\n');
  copyFileSync(VACUOUS_FIXTURE, join(repo, 'vacuous.test.mjs'));
  git('add', 'impl.mjs', 'real.test.mjs', 'vacuous.test.mjs');
  git('commit', '-q', '-m', 'head');
  const headSha = git('rev-parse', 'HEAD');

  const runReversion = defaultRunReversion({ cwd: repo, tmp: wtParent });
  const result = runReversion({ baseSha, headSha, implFiles: ['impl.mjs'], testFiles: ['real.test.mjs', 'vacuous.test.mjs'] });

  assert.equal(result.uncomputable, false);
  assert.deepEqual(result.vacuousTests, ['vacuous.test.mjs'], 'the real test failed against base (good); the vacuous fixture passed against base (caught)');
  assert.match(result.command, /git checkout/);

  // operator HEAD never moved.
  assert.equal(git('symbolic-ref', '--short', 'HEAD'), branch);
  assert.equal(git('rev-parse', 'HEAD'), headSha);
});

// ── REVERSION reversion-semantics (issue #266 H1-3 BLOCKER 1): a checkpoint's
// dominant case is a PR that ADDS impl+test files. `git checkout <base> -- <p>`
// exits 1 for any path absent at base — the added file's base state is
// "absent", so it must be REMOVED, not checked out. Mixed add+modify must not
// abort the whole checkout, and any unexpected git failure must fail closed.

test('REVERSION-ADD (real default): a PR that ADDS impl+test — reversion removes the added impl (base=absent), the new test FAILS against base (not vacuous), never crashes, operator HEAD unmoved', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'brain-review-rev-add-op-'));
  const wtParent = mkdtempSync(join(tmpdir(), 'brain-review-rev-add-wt-'));
  t.after(() => {
    try { execFileSync('git', ['worktree', 'prune'], { cwd: repo }); } catch { /* best effort */ }
    rmSync(repo, { recursive: true, force: true });
    rmSync(wtParent, { recursive: true, force: true });
  });

  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 't');

  // base: only an unrelated file. newimpl.mjs does NOT exist at base.
  writeFileSync(join(repo, 'README.md'), '# base\n');
  git('add', 'README.md');
  git('commit', '-q', '-m', 'base');
  const baseSha = git('rev-parse', 'HEAD');
  const branch = git('symbolic-ref', '--short', 'HEAD');

  // head: the PR ADDS newimpl.mjs + newimpl.test.mjs (the test imports newimpl).
  writeFileSync(join(repo, 'newimpl.mjs'), 'export function feature() { return 42; }\n');
  writeFileSync(join(repo, 'newimpl.test.mjs'), [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { feature } from './newimpl.mjs';",
    "test('feature works', () => { assert.equal(feature(), 42); });",
  ].join('\n') + '\n');
  git('add', 'newimpl.mjs', 'newimpl.test.mjs');
  git('commit', '-q', '-m', 'head adds impl+test');
  const headSha = git('rev-parse', 'HEAD');

  const runReversion = defaultRunReversion({ cwd: repo, tmp: wtParent });
  let result;
  assert.doesNotThrow(() => {
    result = runReversion({ baseSha, headSha, implFiles: ['newimpl.mjs'], testFiles: ['newimpl.test.mjs'] });
  }, 'reversion must not crash on a file the PR ADDS');

  assert.equal(result.uncomputable, false);
  // The added impl was removed → base state = absent → the new test cannot
  // import it → real RED, correctly NOT flagged vacuous.
  assert.deepEqual(result.vacuousTests, []);

  // operator HEAD never moved.
  assert.equal(git('symbolic-ref', '--short', 'HEAD'), branch);
  assert.equal(git('rev-parse', 'HEAD'), headSha);
});

test('REVERSION-MIXED (real default): one ADDED impl + one MODIFIED impl — both reach base state (added removed, modified reverted), no whole-checkout abort, no crash', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'brain-review-rev-mix-op-'));
  const wtParent = mkdtempSync(join(tmpdir(), 'brain-review-rev-mix-wt-'));
  t.after(() => {
    try { execFileSync('git', ['worktree', 'prune'], { cwd: repo }); } catch { /* best effort */ }
    rmSync(repo, { recursive: true, force: true });
    rmSync(wtParent, { recursive: true, force: true });
  });

  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 't');

  // base: modfile exists (V='base'); addfile does NOT exist.
  writeFileSync(join(repo, 'modfile.mjs'), "export const V = 'base';\n");
  git('add', 'modfile.mjs');
  git('commit', '-q', '-m', 'base');
  const baseSha = git('rev-parse', 'HEAD');
  const branch = git('symbolic-ref', '--short', 'HEAD');

  // head: modfile modified (V='head'), addfile added, + a test per file pinning
  // it to its HEAD state (so both FAIL once brought to base → both real RED).
  writeFileSync(join(repo, 'modfile.mjs'), "export const V = 'head';\n");
  writeFileSync(join(repo, 'addfile.mjs'), 'export const N = 1;\n');
  writeFileSync(join(repo, 'mod.test.mjs'), [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { V } from './modfile.mjs';",
    "test('mod at head', () => { assert.equal(V, 'head'); });",
  ].join('\n') + '\n');
  writeFileSync(join(repo, 'add.test.mjs'), [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { N } from './addfile.mjs';",
    "test('add exists', () => { assert.equal(N, 1); });",
  ].join('\n') + '\n');
  git('add', 'modfile.mjs', 'addfile.mjs', 'mod.test.mjs', 'add.test.mjs');
  git('commit', '-q', '-m', 'head');
  const headSha = git('rev-parse', 'HEAD');

  const runReversion = defaultRunReversion({ cwd: repo, tmp: wtParent });
  let result;
  assert.doesNotThrow(() => {
    result = runReversion({ baseSha, headSha, implFiles: ['modfile.mjs', 'addfile.mjs'], testFiles: ['mod.test.mjs', 'add.test.mjs'] });
  }, 'the added file must not abort the whole checkout of the modified file');

  assert.equal(result.uncomputable, false);
  // modfile reverted to V='base' → mod.test (expects 'head') FAILS; addfile
  // removed → add.test import FAILS. Both real RED → neither is vacuous. If the
  // added path had aborted the checkout, modfile would stay 'head' and mod.test
  // would PASS → surface as vacuous. Empty vacuousTests proves BOTH reverted.
  assert.deepEqual(result.vacuousTests, []);

  assert.equal(git('symbolic-ref', '--short', 'HEAD'), branch);
  assert.equal(git('rev-parse', 'HEAD'), headSha);
});

test('REVERSION-CRASHSAFE (real default): an unexpected git failure (bogus head sha) folds to uncomputable/fail-closed, never throws', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'brain-review-rev-crash-op-'));
  const wtParent = mkdtempSync(join(tmpdir(), 'brain-review-rev-crash-wt-'));
  t.after(() => {
    try { execFileSync('git', ['worktree', 'prune'], { cwd: repo }); } catch { /* best effort */ }
    rmSync(repo, { recursive: true, force: true });
    rmSync(wtParent, { recursive: true, force: true });
  });

  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 't');
  writeFileSync(join(repo, 'README.md'), '# base\n');
  git('add', 'README.md');
  git('commit', '-q', '-m', 'base');

  const runReversion = defaultRunReversion({ cwd: repo, tmp: wtParent });
  let result;
  // headSha does not exist → `git worktree add` fails unexpectedly. This must
  // NOT escape and crash brain:review — the headline defense degrades safely.
  assert.doesNotThrow(() => {
    result = runReversion({ baseSha: 'HEAD', headSha: '0000000000000000000000000000000000000000', implFiles: ['x.mjs'], testFiles: ['x.test.mjs'] });
  }, 'an unexpected git failure must not escape the reversion runner');
  assert.equal(result.uncomputable, true);
  assert.equal(result.command, null);
});

// ── #555 round 2: the checkpoint consumer MOVES with the tier ────────────────

/** Like gatherAtTier, but the caller chooses which artefact files exist. */
function gatherWithArtefacts({ tier, present }) {
  const changeId = 'issue-999-artefacts';
  const files = Object.fromEntries(
    present.map(f => [`openspec/changes/${changeId}/${f}`, f === 'tasks.md' ? '- [x] done\n' : 'x']));
  files[`openspec/changes/${changeId}/checkpoint-report.md`] = 'Counted diff re-derived cold = **10/1000**.';
  return gatherCheckpointInputs({
    project: 'csrinaldi/brain', number: 42, provider: 'github', headSha: 'HEAD',
    changedFiles: [`openspec/changes/${changeId}/checkpoint-report.md`],
    tier,
    deps: {
      baseSha: 'BASE',
      exists: (p) => p in files,
      listDir: () => [],
      readFile: (p) => files[p] ?? '',
      runReversion: async () => ({ uncomputable: false, command: 'cmd', vacuousTests: [] }),
      trancheDeps: { tier, fetchRollup: async () => greenRollup(), diffNumstat: () => '1\t0\ta.mjs\n', readIgnoreList: () => [] },
      runAudit: () => '', runGovernanceStatus: () => '',
    },
  });
}

test('#555: at LITE the checkpoint accepts a change carrying only spec.md', async () => {
  const inputs = await gatherWithArtefacts({ tier: 'lite', present: ['spec.md'] });
  assert.deepEqual(inputs.artifacts.missing, [],
    'lite requires spec.md alone (ADR-0026); the reviewer must not block on the other three');
});

test('#555: at REGULATED the same change is missing four, named by their REAL filenames', async () => {
  const inputs = await gatherWithArtefacts({ tier: 'regulated', present: ['spec.md'] });
  assert.deepEqual(inputs.artifacts.missing,
    ['proposal.md', 'design.md', 'tasks.md', 'verify-report.md'],
    'and the verification artefact is verify-report.md, never the invented verification.md');
});

test('#555: at REGULATED, verify-report.md present completes the set', async () => {
  const inputs = await gatherWithArtefacts({
    tier: 'regulated',
    present: ['proposal.md', 'spec.md', 'design.md', 'tasks.md', 'verify-report.md'],
  });
  assert.deepEqual(inputs.artifacts.missing, [],
    'a regulated change carrying the five REAL artefacts is complete — the blocker B1 fixed');
});
