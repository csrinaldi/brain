// phase-order-check.test.mjs — Unit tests for evaluatePhaseOrder (REQ-L4-1..4, design §2)
// Run with: npm test  (node --test, no dependencies)
//
// Covers PR4a scope only: the pure evaluator. The git I/O wrapper + CLI entrypoint
// (git diff, readdirSync, `git show BASE:path`, `- [x]` counting) is PR4b.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluatePhaseOrder } from './phase-order-check.mjs';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Builds a changeDirs entry with sane "everything complete, nothing changed" defaults. */
function makeDir(overrides = {}) {
  return {
    name: 'issue-999-foo',
    hasProposal: true,
    hasSpec: true,
    hasDesign: true,
    hasTasks: true,
    checkedTasks: 1,
    statusBefore: 'tasked',
    statusAfter: 'tasked',
    ...overrides,
  };
}

// ── Rule C — code-without-completed-phases (the enforcing core) ───────────────

test('Rule C: impl non-empty and exactly one touched dir with checkedTasks === 0 → fail', () => {
  const result = evaluatePhaseOrder({
    changedFiles: ['brain/scripts/vcs/foo.mjs', 'openspec/changes/issue-999-foo/tasks.md'],
    changeDirs: [makeDir({ checkedTasks: 0 })],
  });
  assert.equal(result.level, 'fail');
  const ruleCFinding = result.findings.find(f => f.rule === 'C');
  assert.ok(ruleCFinding, 'expected a Rule C finding');
  assert.equal(ruleCFinding.level, 'fail');
  assert.match(ruleCFinding.message, /tasks\.md has no checked item/);
});

test('Rule C: impl non-empty but no touched dir (unattributable) → warn, never fail', () => {
  const result = evaluatePhaseOrder({
    changedFiles: ['brain/scripts/vcs/foo.mjs'],
    changeDirs: [],
  });
  assert.equal(result.level, 'warn');
  assert.equal(result.findings.some(f => f.level === 'fail'), false);
  const ruleCFinding = result.findings.find(f => f.rule === 'C');
  assert.ok(ruleCFinding, 'expected a Rule C finding');
  assert.equal(ruleCFinding.level, 'warn');
});

test('Rule C: impl non-empty and touched dir has >= 1 checked task → no violation', () => {
  const result = evaluatePhaseOrder({
    changedFiles: ['brain/scripts/vcs/foo.mjs', 'openspec/changes/issue-999-foo/tasks.md'],
    changeDirs: [makeDir({ checkedTasks: 3 })],
  });
  assert.equal(result.level, 'pass');
  assert.deepEqual(result.findings, []);
});

// ── Rule A — artifact completeness, gated on Rule C seeing impl ────────────────

test('Rule A: touched change missing hasDesign → fail "implementation without spec.md/design.md"', () => {
  const result = evaluatePhaseOrder({
    changedFiles: ['brain/scripts/vcs/foo.mjs', 'openspec/changes/issue-999-foo/tasks.md'],
    changeDirs: [makeDir({ checkedTasks: 1, hasDesign: false })],
  });
  assert.equal(result.level, 'fail');
  const ruleAFinding = result.findings.find(f => f.rule === 'A');
  assert.ok(ruleAFinding, 'expected a Rule A finding');
  assert.equal(ruleAFinding.level, 'fail');
  assert.match(ruleAFinding.message, /implementation without spec\.md\/design\.md/);
});

test('Rule A: touched change lacking a spec artifact (either convention, via hasSpec) → fail', () => {
  // hasSpec is expected to already fold in BOTH spec.md and specs/*/spec.md
  // detection (Gap G1) — this pure function only consumes the resulting boolean.
  const result = evaluatePhaseOrder({
    changedFiles: ['brain/scripts/vcs/foo.mjs', 'openspec/changes/issue-999-foo/tasks.md'],
    changeDirs: [makeDir({ checkedTasks: 1, hasSpec: false })],
  });
  assert.equal(result.level, 'fail');
  const ruleAFinding = result.findings.find(f => f.rule === 'A');
  assert.ok(ruleAFinding, 'expected a Rule A finding');
  assert.equal(ruleAFinding.level, 'fail');
  assert.match(ruleAFinding.message, /implementation without spec\.md\/design\.md/);
});

test('Rule A: planning-only PR (impl empty) is never subjected to Rule A, even with incomplete artifacts', () => {
  const result = evaluatePhaseOrder({
    changedFiles: ['openspec/changes/issue-999-foo/tasks.md'],
    changeDirs: [
      makeDir({
        checkedTasks: 0,
        hasSpec: false,
        hasDesign: false,
        statusBefore: 'draft',
        statusAfter: 'draft',
      }),
    ],
  });
  assert.equal(result.level, 'pass');
  assert.equal(result.findings.filter(f => f.rule === 'A').length, 0);
});

// ── Rule B — monotonic status ───────────────────────────────────────────────

test('Rule B: statusAfter earlier than statusBefore on the ladder → fail (backward phase jump)', () => {
  const result = evaluatePhaseOrder({
    changedFiles: ['openspec/changes/issue-999-foo/design.md'],
    changeDirs: [makeDir({ statusBefore: 'designed', statusAfter: 'proposed' })],
  });
  assert.equal(result.level, 'fail');
  const ruleBFinding = result.findings.find(f => f.rule === 'B');
  assert.ok(ruleBFinding, 'expected a Rule B finding');
  assert.equal(ruleBFinding.level, 'fail');
  assert.match(ruleBFinding.message, /designed.*proposed/s);
});

test('Rule B: unknown/custom status, unchanged status, absent frontmatter, forward-only → pass (no-op)', () => {
  const unchanged = evaluatePhaseOrder({
    changedFiles: ['openspec/changes/issue-999-foo/tasks.md'],
    changeDirs: [makeDir({ statusBefore: 'tasked', statusAfter: 'tasked' })],
  });
  assert.equal(unchanged.level, 'pass');
  assert.equal(unchanged.findings.filter(f => f.rule === 'B').length, 0);

  const forwardOnly = evaluatePhaseOrder({
    changedFiles: ['openspec/changes/issue-999-foo/tasks.md'],
    changeDirs: [makeDir({ statusBefore: 'spec', statusAfter: 'designed' })],
  });
  assert.equal(forwardOnly.level, 'pass');
  assert.equal(forwardOnly.findings.filter(f => f.rule === 'B').length, 0);

  const unknownStatus = evaluatePhaseOrder({
    changedFiles: ['openspec/changes/issue-999-foo/tasks.md'],
    changeDirs: [makeDir({ statusBefore: 'custom-legacy', statusAfter: 'draft' })],
  });
  assert.equal(unknownStatus.level, 'pass');
  assert.equal(unknownStatus.findings.filter(f => f.rule === 'B').length, 0);

  const absentFrontmatter = evaluatePhaseOrder({
    changedFiles: ['openspec/changes/issue-999-foo/tasks.md'],
    changeDirs: [makeDir({ statusBefore: undefined, statusAfter: undefined })],
  });
  assert.equal(absentFrontmatter.level, 'pass');
  assert.equal(absentFrontmatter.findings.filter(f => f.rule === 'B').length, 0);
});

// ── Aggregation — level + findings across rules (REQ-L4-1) ────────────────────

test('aggregation: level is pass and findings is empty when no rule reports a violation', () => {
  const result = evaluatePhaseOrder({ changedFiles: [], changeDirs: [] });
  assert.equal(result.level, 'pass');
  assert.deepEqual(result.findings, []);
});

test('aggregation: level is fail when multiple rules report violations across different dirs; findings collects all of them', () => {
  const result = evaluatePhaseOrder({
    changedFiles: [
      'brain/scripts/vcs/foo.mjs',
      'openspec/changes/issue-999-foo/tasks.md',
      'openspec/changes/issue-888-bar/design.md',
    ],
    changeDirs: [
      // Rule A fail: touched, impl present, missing design.
      makeDir({ name: 'issue-999-foo', checkedTasks: 1, hasDesign: false }),
      // Rule B fail: touched (via design.md), status regressed.
      makeDir({
        name: 'issue-888-bar',
        checkedTasks: 1,
        statusBefore: 'designed',
        statusAfter: 'proposed',
      }),
    ],
  });
  assert.equal(result.level, 'fail');
  assert.equal(result.findings.length, 2);
  assert.ok(result.findings.some(f => f.rule === 'A' && f.change === 'issue-999-foo'));
  assert.ok(result.findings.some(f => f.rule === 'B' && f.change === 'issue-888-bar'));
});

test('aggregation: level is warn (not fail) when only warn-level findings are present', () => {
  const result = evaluatePhaseOrder({
    changedFiles: ['brain/scripts/vcs/foo.mjs'],
    changeDirs: [],
  });
  assert.equal(result.level, 'warn');
  assert.equal(result.findings.every(f => f.level !== 'fail'), true);
});
