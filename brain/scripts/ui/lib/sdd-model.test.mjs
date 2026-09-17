// sdd-model.test.mjs — R998-4: seven stages per change, phase-order
// violations named, grandfathered changes claim no stage, archived changes
// appear with their archive path.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSddModel, STAGE_IDS, STAGE_VOCAB, LIFECYCLE_ORDER } from './sdd-model.mjs';
import { evaluatePhaseOrder } from '../../vcs/phase-order-check.mjs';
import { LIFECYCLE_STAGES } from '../../lib/sdd-layout.mjs';

const FULL = {
  id: 'issue-1-full', issue: 1, slug: 'full', dir: 'openspec/changes/issue-1-full', archived: false,
  grandfathered: false,
  missing: { ok: true, value: [] },
  artefacts: { proposal: true, spec: true, design: true, tasks: true, apply: true, verify: true, archive: false },
  tasks: { checked: { ok: true, value: 3 }, open: { ok: true, value: 0 }, next: { ok: true, value: '—' } },
  sliceScopes: { ok: true, value: [{ slice: 1, claims: ['R1-1'], terminal_pr: 'this PR -> main' }] },
};

const ONLY_PROPOSAL = {
  id: 'issue-2-only-proposal', issue: 2, slug: 'only-proposal', dir: 'openspec/changes/issue-2-only-proposal', archived: false,
  grandfathered: false,
  missing: { ok: true, value: ['design.md', 'tasks.md'] },
  artefacts: { proposal: true, spec: false, design: false, tasks: false, apply: false, verify: false, archive: false },
  tasks: {
    checked: { ok: false, reason: 'openspec/changes/issue-2-only-proposal/tasks.md could not be read' },
    open: { ok: false, reason: 'openspec/changes/issue-2-only-proposal/tasks.md could not be read' },
    next: { ok: false, reason: 'openspec/changes/issue-2-only-proposal/tasks.md could not be read' },
  },
  sliceScopes: { ok: false, reason: 'no slice-scope block' },
};

const HALF_TICKED = {
  id: 'issue-3-half', issue: 3, slug: 'half', dir: 'openspec/changes/issue-3-half', archived: false,
  grandfathered: false,
  missing: { ok: true, value: [] },
  artefacts: { proposal: true, spec: true, design: true, tasks: true, apply: false, verify: false, archive: false },
  tasks: { checked: { ok: true, value: 2 }, open: { ok: true, value: 3 }, next: { ok: true, value: 'do the thing' } },
  sliceScopes: { ok: true, value: [] },
};

const GRANDFATHERED = {
  id: 'installer-versionado', issue: 4, slug: null, dir: 'openspec/changes/installer-versionado', archived: false,
  grandfathered: true,
  missing: { ok: true, value: [] },
  artefacts: { proposal: false, spec: true, design: false, tasks: true, apply: false, verify: false, archive: false },
  tasks: { checked: { ok: true, value: 5 }, open: { ok: true, value: 0 }, next: { ok: true, value: '—' } },
  sliceScopes: { ok: true, value: [] },
};

const ARCHIVED = {
  id: '9', issue: 9, slug: null, dir: 'openspec/changes/archive/9', archived: true,
  grandfathered: false,
  missing: { ok: true, value: [] },
  artefacts: { proposal: true, spec: true, design: true, tasks: true, apply: false, verify: false, archive: false },
  tasks: { checked: { ok: true, value: 2 }, open: { ok: true, value: 0 }, next: { ok: true, value: '—' } },
  sliceScopes: { ok: true, value: [] },
};

const VIOLATION = {
  id: 'issue-6-viol', issue: 6, slug: 'viol', dir: 'openspec/changes/issue-6-viol', archived: false,
  grandfathered: false,
  missing: { ok: true, value: ['spec.md'] },
  artefacts: { proposal: true, spec: false, design: true, tasks: true, apply: false, verify: false, archive: false },
  tasks: { checked: { ok: true, value: 1 }, open: { ok: true, value: 0 }, next: { ok: true, value: '—' } },
  sliceScopes: { ok: true, value: [] },
};

const ALL = [FULL, ONLY_PROPOSAL, HALF_TICKED, GRANDFATHERED, ARCHIVED, VIOLATION];

function stageOf(model, id, stageId) {
  return model.value.changes.find((c) => c.id === id).stages.find((s) => s.id === stageId);
}

test('#998 R998-4: LIFECYCLE_ORDER (the browser-safe restatement) equals sdd-layout.mjs\'s LIFECYCLE_STAGES', () => {
  assert.deepEqual(LIFECYCLE_ORDER, LIFECYCLE_STAGES);
});

test('#998 R998-4: STAGE_IDS is exactly the seven, in order', () => {
  assert.deepEqual(STAGE_IDS, ['proposal', 'spec', 'design', 'tasks', 'apply', 'verify', 'archive']);
  for (const id of STAGE_IDS) assert.ok(id in { present: 1 } || true); // sanity: no throw building the constant
  assert.deepEqual(Object.keys(STAGE_VOCAB).sort(), ['done', 'in-progress', 'missing', 'not-applicable', 'present'].sort());
});

test('#998 R998-4: a change with every artefact — proposal/spec/design/apply/verify present, tasks done, archive missing', () => {
  const model = buildSddModel({ ok: true, value: [FULL] });
  assert.equal(model.ok, true);
  const c = model.value.changes[0];
  assert.equal(stageOf(model, 'issue-1-full', 'proposal').state, 'present');
  assert.equal(stageOf(model, 'issue-1-full', 'spec').state, 'present');
  assert.equal(stageOf(model, 'issue-1-full', 'design').state, 'present');
  assert.equal(stageOf(model, 'issue-1-full', 'tasks').state, 'done');
  assert.equal(stageOf(model, 'issue-1-full', 'apply').state, 'present');
  assert.equal(stageOf(model, 'issue-1-full', 'verify').state, 'present');
  assert.equal(stageOf(model, 'issue-1-full', 'archive').state, 'missing');
  assert.deepEqual(c.phaseOrder, { ok: true, violations: [] });
  assert.deepEqual(c.slices, [{ n: 1, claims: ['R1-1'], terminalPr: 'this PR -> main', source: { path: 'openspec/changes/issue-1-full/tasks.md' } }]);
});

test('#998 R998-4: a change with only proposal.md — every later stage is missing, and that is not a phase-order violation', () => {
  const model = buildSddModel({ ok: true, value: [ONLY_PROPOSAL] });
  const c = model.value.changes[0];
  assert.equal(stageOf(model, 'issue-2-only-proposal', 'proposal').state, 'present');
  for (const id of ['spec', 'design', 'tasks', 'apply', 'verify', 'archive']) {
    assert.equal(stageOf(model, 'issue-2-only-proposal', id).state, 'missing', id);
  }
  assert.deepEqual(c.phaseOrder.violations, [], 'nothing is present out of order — everything after proposal is simply absent');
  assert.equal(c.tasks.checked, 0);
  assert.equal(c.tasks.next, null);
  assert.deepEqual(c.slices, [], 'an unreadable slice-scope block is no slices, not a throw');
});

test('#998 R998-4: tasks half ticked is in-progress, not done', () => {
  const model = buildSddModel({ ok: true, value: [HALF_TICKED] });
  assert.equal(stageOf(model, 'issue-3-half', 'tasks').state, 'in-progress');
});

test('#998 R998-4: a grandfathered change claims no stage — not-applicable across all seven', () => {
  const model = buildSddModel({ ok: true, value: [GRANDFATHERED] });
  const c = model.value.changes[0];
  assert.deepEqual(c.stages.map((s) => s.state), STAGE_IDS.map(() => 'not-applicable'));
  assert.equal(c.grandfathered, true);
  assert.deepEqual(c.phaseOrder, { ok: true, violations: [] }, 'the past is recorded, not edited — no violation is computed for it either');
  // Tasks facts are still real, even though the stage matrix says nothing.
  assert.equal(c.tasks.checked, 5);
});

test('#998 R998-4: an archived change appears with its archive path, its stages read from what is actually there', () => {
  const model = buildSddModel({ ok: true, value: [ARCHIVED] });
  const c = model.value.changes[0];
  assert.equal(c.archived, true);
  assert.equal(c.dir, 'openspec/changes/archive/9');
  assert.equal(stageOf(model, '9', 'proposal').state, 'present');
  assert.equal(stageOf(model, '9', 'tasks').state, 'done');
  assert.equal(stageOf(model, '9', 'apply').state, 'missing');
  const archiveStage = stageOf(model, '9', 'archive');
  assert.equal(archiveStage.state, 'present', 'archived: true is itself the archive stage\'s fact, with no archive-report.md needed');
  assert.equal(archiveStage.source.path, 'openspec/changes/archive/9', 'the source is the archive dir itself, not an invented report file');
});

test('#998 R998-4: tasks present without spec is a phase-order violation, named', () => {
  const model = buildSddModel({ ok: true, value: [VIOLATION] });
  const c = model.value.changes[0];
  assert.equal(c.phaseOrder.ok, true);
  assert.ok(c.phaseOrder.violations.length > 0);
  const tasksViolation = c.phaseOrder.violations.find((v) => v.stage === 'tasks');
  assert.ok(tasksViolation, 'tasks is flagged');
  assert.match(tasksViolation.reason, /"tasks" is present but "spec"/);
  const designViolation = c.phaseOrder.violations.find((v) => v.stage === 'design');
  assert.ok(designViolation, 'design is flagged too — it also shipped ahead of spec');
});

test('#998 R998-4: the local phase-order restatement agrees with the enforced gate on a shared fixture', () => {
  const changeDirs = [{
    name: 'issue-6-viol', hasProposal: true, hasSpec: false, hasDesign: true, hasTasks: true,
    checkedTasks: 1, statusBefore: undefined, statusAfter: undefined,
  }];
  const changedFiles = [
    'openspec/changes/issue-6-viol/tasks.md',
    'openspec/changes/issue-6-viol/design.md',
    'brain/scripts/some-impl-file.mjs',
  ];
  const gate = evaluatePhaseOrder({ changedFiles, changeDirs });
  assert.equal(gate.level, 'fail');
  assert.ok(gate.findings.some((f) => f.rule === 'A' && f.change === 'issue-6-viol'), 'the enforced gate also flags this change');

  const model = buildSddModel({ ok: true, value: [VIOLATION] });
  assert.ok(model.value.changes[0].phaseOrder.violations.length > 0, 'the local restatement agrees');
});

test('#998 R998-4: totals count active, archived, and changes carrying a violation', () => {
  const model = buildSddModel({ ok: true, value: ALL });
  assert.deepEqual(model.value.totals, { active: 5, archived: 1, withViolations: 1, archiveSkipped: { count: 0, names: [] } });
});

// ── review of PR 4, fix 1: archiveSkipped surfaces on totals ───────────────

test('#998 fix1: totals.archiveSkipped counts and names the archive dirs snapshot.mjs said it skipped', () => {
  const model = buildSddModel({
    ok: true,
    value: ALL,
    archiveSkipped: [
      { name: 'governance', reason: 'not an issue-numbered archive dir' },
      { name: '2026-07-26-issue-334-brain-ship-labels', reason: 'not an issue-numbered archive dir' },
    ],
  });
  assert.deepEqual(model.value.totals.archiveSkipped, { count: 2, names: ['governance', '2026-07-26-issue-334-brain-ship-labels'] });
});

test('#998 R998-4: the section says why when it could not be read', () => {
  const model = buildSddModel({ ok: false, reason: 'openspec/changes could not be listed: boom' });
  assert.equal(model.ok, false);
  assert.match(model.reason, /boom/);
});

test('#998 R998-4: determinism — the same changes, shuffled, produce a byte-identical model', () => {
  const shuffled = [...ALL].reverse();
  const a = buildSddModel({ ok: true, value: ALL });
  const b = buildSddModel({ ok: true, value: shuffled });
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});
