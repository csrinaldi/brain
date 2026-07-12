// phase-order-check.test.mjs — Unit tests for evaluatePhaseOrder (REQ-L4-1..4, design §2)
// and the PR4b git I/O wrapper + CLI (REQ-L4-1, REQ-L4-5, REQ-NEUTRALITY-1/2).
// Run with: npm test  (node --test, no dependencies)
//
// Wrapper tests use plain-data fakes injected via `deps` — no test spawns a real
// git process or touches the real cwd (CI-fragility discipline, same as
// run-check.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { evaluatePhaseOrder, runPhaseOrderCheck, main } from './phase-order-check.mjs';
import { LEGACY_GRANDFATHERED } from '../lib/sdd-layout.mjs';

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

test('Rule C: multi-dir — impl + two touched dirs, one checkedTasks===0 and one checkedTasks>=1 → fail attributed to the 0-checked dir', () => {
  // Regression: a bystander second change-dir edit (e.g. an unrelated checkbox
  // bump or shared doc touch in a second openspec/changes/** dir) must NOT
  // disable the enforcing core for the dir with the real violation.
  const result = evaluatePhaseOrder({
    changedFiles: [
      'brain/scripts/vcs/foo.mjs',
      'openspec/changes/issue-999-foo/tasks.md',
      'openspec/changes/issue-888-bar/tasks.md',
    ],
    changeDirs: [
      makeDir({ name: 'issue-999-foo', checkedTasks: 0 }),
      makeDir({ name: 'issue-888-bar', checkedTasks: 5 }),
    ],
  });
  assert.equal(result.level, 'fail');
  const ruleCFindings = result.findings.filter(f => f.rule === 'C');
  assert.equal(ruleCFindings.length, 1);
  assert.equal(ruleCFindings[0].change, 'issue-999-foo');
  assert.match(ruleCFindings[0].message, /tasks\.md has no checked item/);
});

test('Rule C: multi-dir — impl + two touched dirs, BOTH checkedTasks===0 → fail with one finding per dir', () => {
  const result = evaluatePhaseOrder({
    changedFiles: [
      'brain/scripts/vcs/foo.mjs',
      'openspec/changes/issue-999-foo/tasks.md',
      'openspec/changes/issue-888-bar/tasks.md',
    ],
    changeDirs: [
      makeDir({ name: 'issue-999-foo', checkedTasks: 0 }),
      makeDir({ name: 'issue-888-bar', checkedTasks: 0 }),
    ],
  });
  assert.equal(result.level, 'fail');
  const ruleCFindings = result.findings.filter(f => f.rule === 'C');
  assert.equal(ruleCFindings.length, 2);
  assert.ok(ruleCFindings.some(f => f.change === 'issue-999-foo'));
  assert.ok(ruleCFindings.some(f => f.change === 'issue-888-bar'));
});

test('Rule C: multi-dir — impl + two touched dirs, both checkedTasks>=1 → no Rule C violation', () => {
  const result = evaluatePhaseOrder({
    changedFiles: [
      'brain/scripts/vcs/foo.mjs',
      'openspec/changes/issue-999-foo/tasks.md',
      'openspec/changes/issue-888-bar/tasks.md',
    ],
    changeDirs: [
      makeDir({ name: 'issue-999-foo', checkedTasks: 1 }),
      makeDir({ name: 'issue-888-bar', checkedTasks: 5 }),
    ],
  });
  assert.equal(result.findings.filter(f => f.rule === 'C').length, 0);
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

// ── PR4b — git I/O wrapper + CLI (REQ-L4-1) ─────────────────────────────────────

/**
 * Builds injectable `deps` for gatherPhaseOrderInputs/runPhaseOrderCheck/main
 * from plain in-memory maps — no real git process, no real filesystem.
 *
 * `filesAfter`/`filesBefore` are flat maps of relative-path → file content
 * (working tree / BASE ref, respectively). A "directory" is any prefix shared
 * by at least one key, so `exists()`/`listDir()` behave like a real fs without
 * needing explicit directory entries.
 */
function makeFakeDeps({ baseSha = 'BASE', headSha = 'HEAD', changedFiles = [], filesAfter = {}, filesBefore = {} }) {
  const exists = relPath => {
    if (Object.prototype.hasOwnProperty.call(filesAfter, relPath)) return true;
    const prefix = `${relPath}/`;
    return Object.keys(filesAfter).some(k => k.startsWith(prefix));
  };
  const listDir = relPath => {
    const prefix = `${relPath}/`;
    const names = new Set();
    for (const key of Object.keys(filesAfter)) {
      if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split('/')[0]);
    }
    return [...names];
  };
  return {
    baseSha,
    headSha,
    diffNameOnly: () => changedFiles,
    exists,
    listDir,
    readFile: relPath => filesAfter[relPath] ?? null,
    showAtRef: (_ref, relPath) => filesBefore[relPath] ?? null,
  };
}

/** Runs `fn` with console.log captured; returns the logged lines. */
function captureLogs(fn) {
  const lines = [];
  const orig = console.log;
  console.log = msg => lines.push(msg);
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return lines;
}

const COMPLETE_DIR_FILES = {
  'openspec/changes/issue-999-foo/proposal.md': '',
  'openspec/changes/issue-999-foo/design.md': '',
  'openspec/changes/issue-999-foo/spec.md': '',
  'openspec/changes/issue-999-foo/tasks.md': '---\nstatus: tasked\n---\n- [x] done\n',
};

test('wrapper: happy path — complete artifacts + a checked task → main exits 0, pass verdict', () => {
  const deps = makeFakeDeps({
    changedFiles: ['brain/scripts/vcs/foo.mjs', 'openspec/changes/issue-999-foo/tasks.md'],
    filesAfter: COMPLETE_DIR_FILES,
    filesBefore: { 'openspec/changes/issue-999-foo/tasks.md': '---\nstatus: tasked\n---\n- [ ] pending\n' },
  });

  let exitCode;
  const lines = captureLogs(() => {
    exitCode = main(deps);
  });

  assert.equal(exitCode, 0);
  assert.equal(lines[0], 'phase-order-check: pass');
});

test('wrapper: fail path — impl change + zero checked tasks → main exits 1, expected verdict format', () => {
  const deps = makeFakeDeps({
    changedFiles: ['brain/scripts/vcs/foo.mjs', 'openspec/changes/issue-999-foo/tasks.md'],
    filesAfter: {
      ...COMPLETE_DIR_FILES,
      'openspec/changes/issue-999-foo/tasks.md': '---\nstatus: tasked\n---\n- [ ] not done\n',
    },
  });

  let exitCode;
  const lines = captureLogs(() => {
    exitCode = main(deps);
  });

  assert.equal(exitCode, 1);
  assert.equal(lines[0], 'phase-order-check: fail');
  assert.ok(
    lines.some(l => l.includes('Rule C') && l.includes('tasks.md has no checked item')),
    `expected a Rule C line, got: ${JSON.stringify(lines)}`
  );
});

test('wrapper: missing BASE_SHA/HEAD_SHA degrades to warn, never throws or fails', () => {
  const deps = makeFakeDeps({ changedFiles: [] });
  const result = runPhaseOrderCheck({ ...deps, baseSha: undefined, headSha: undefined });
  assert.equal(result.level, 'warn');
});

test('neutrality (REQ-NEUTRALITY-1): identical verdict with vs. without SKILL.md/.claude/** files present', () => {
  const shared = {
    changedFiles: ['brain/scripts/vcs/foo.mjs', 'openspec/changes/issue-999-foo/tasks.md'],
    filesAfter: COMPLETE_DIR_FILES,
    filesBefore: { 'openspec/changes/issue-999-foo/tasks.md': '---\nstatus: tasked\n---\n- [x] already\n' },
  };
  const without = runPhaseOrderCheck(makeFakeDeps(shared));
  const withHarness = runPhaseOrderCheck(
    makeFakeDeps({
      ...shared,
      changedFiles: [...shared.changedFiles, 'SKILL.md', '.claude/settings.json'],
      filesAfter: {
        ...shared.filesAfter,
        'SKILL.md': '# a harness skill file',
        '.claude/settings.json': '{}',
      },
    })
  );
  assert.deepEqual(without, withHarness);
});

// ── ci-context seam wiring (ADR-0016) — reads ctx.baseSha/headSha ────────────

test('ci-context seam: deps.ctx.baseSha/headSha are used when deps.baseSha/headSha are absent', () => {
  const deps = makeFakeDeps({ changedFiles: [] });
  delete deps.baseSha;
  delete deps.headSha;
  const result = runPhaseOrderCheck({ ...deps, ctx: { baseSha: 'BASE', headSha: 'HEAD' } });
  // makeFakeDeps' diffNameOnly ignores its args and returns `changedFiles` — a
  // pass/warn/fail verdict (not the "BASE_SHA/HEAD_SHA not set" degrade) proves
  // gatherPhaseOrderInputs was actually invoked with ctx-derived shas.
  assert.notEqual(result.findings[0]?.message, 'BASE_SHA/HEAD_SHA not set — cannot compute diff; skipping phase-order check.');
});

test('ci-context seam: missing both deps.baseSha/headSha AND ctx → degrades to warn (never reads process.env directly)', () => {
  const deps = makeFakeDeps({ changedFiles: [] });
  delete deps.baseSha;
  delete deps.headSha;
  const result = runPhaseOrderCheck({ ...deps, ctx: { baseSha: null, headSha: null } });
  assert.equal(result.level, 'warn');
});

test('neutrality source-scan (REQ-NEUTRALITY-2): phase-order-check.mjs source contains no .claude or SKILL.md literal', () => {
  const srcPath = fileURLToPath(new URL('./phase-order-check.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.equal(src.includes('.claude'), false, 'source must not reference .claude');
  assert.equal(src.includes('SKILL.md'), false, 'source must not reference SKILL.md');
});

test('Gap G1: change dir with specs/foo/spec.md (nested convention) is detected as hasSpec=true — no false Rule A fail', () => {
  const deps = makeFakeDeps({
    changedFiles: ['brain/scripts/vcs/foo.mjs', 'openspec/changes/issue-999-foo/tasks.md'],
    filesAfter: {
      'openspec/changes/issue-999-foo/proposal.md': '',
      'openspec/changes/issue-999-foo/design.md': '',
      'openspec/changes/issue-999-foo/specs/governance/spec.md': '',
      'openspec/changes/issue-999-foo/tasks.md': '- [x] done\n',
    },
  });
  const result = runPhaseOrderCheck(deps);
  assert.equal(
    result.findings.filter(f => f.rule === 'A').length,
    0,
    `expected no Rule A finding, got: ${JSON.stringify(result.findings)}`
  );
});

test('baseline (REQ-L4-5): pre-v3 legacy dir with no spec artifact → exempt, not fail, in detection mode', () => {
  // The original 3-dir BASELINE_EXEMPT_DIRS literal (deleted in B1, REQ-B1-3)
  // — a strict subset of LEGACY_GRANDFATHERED — is exercised directly here so
  // this test keeps proving the "no spec artifact at all" exemption case,
  // independent of the other 9 sealed dirs which all carry a nested spec.
  const HISTORICAL_BASELINE_EXEMPT_DIRS = ['installer-versionado', 'vcs-adapter', 'cli-i18n'];
  for (const legacyDir of HISTORICAL_BASELINE_EXEMPT_DIRS) {
    assert.ok(LEGACY_GRANDFATHERED.includes(legacyDir), `expected ${legacyDir} in LEGACY_GRANDFATHERED`);
    const deps = makeFakeDeps({
      changedFiles: ['brain/scripts/vcs/foo.mjs', `openspec/changes/${legacyDir}/tasks.md`],
      filesAfter: {
        [`openspec/changes/${legacyDir}/proposal.md`]: '',
        [`openspec/changes/${legacyDir}/design.md`]: '',
        // no spec.md, no specs/*/spec.md — models the real pre-v3 dirs.
        [`openspec/changes/${legacyDir}/tasks.md`]: '- [x] done\n',
      },
    });
    const result = runPhaseOrderCheck(deps);
    assert.equal(result.level, 'pass', `${legacyDir}: expected pass (exempt), got ${result.level}`);
    const finding = result.findings.find(f => f.change === legacyDir);
    assert.ok(finding, `${legacyDir}: expected an exempted finding`);
    assert.equal(finding.level, 'exempt');
    assert.match(finding.message, /baseline exemption/);
  }
});
