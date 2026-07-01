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
