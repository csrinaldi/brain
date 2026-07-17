// checkpoint.test.mjs — Unit tests for REQ-H1-10: the checkpoint evaluator
// (design.md §2). No test spawns a real gh/git process except the ONE
// real-git test for `defaultRunReversion`'s isolation guarantee (mirrors
// cold-boot.test.mjs's COLDBOOT-CWD test) — every other seam is injected.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
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
  assert.equal(parseBudgetClaim('Counted diff re-derived cold = **372/400** — under budget.'), 372);
});

test('parseBudgetClaim: no claim present → null', () => {
  assert.equal(parseBudgetClaim('No budget claim here.'), null);
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

test('evaluateCheckpoint: missing REQUIRED_ARTIFACTS → blocker citing sdd-layout', () => {
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
