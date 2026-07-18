// brain-audit.test.mjs — fixture-based tests for brain-audit.mjs (REQ-S4-5, REQ-S4-6)
// Uses a temporary git repository with synthetic merge commits to test without
// touching the real repo.  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const AUDIT_SCRIPT = new URL('./brain-audit.mjs', import.meta.url).pathname;

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeRepo(dir) {
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '--initial-branch=main');
  git('config', 'user.email', 'test@test.com');
  git('config', 'user.name', 'Test');
  return git;
}

function commit(git, dir, files, message) {
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path);
    mkdirSync(abs.replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(abs, content);
  }
  git('add', '-A');
  git('commit', '-m', message);
}

/**
 * Build a plaintext record string containing a single session_summary observation.
 */
function makeSessionSummaryRecord() {
  return JSON.stringify({
    id: 'rec-1',
    ts: '2026-07-12T12:00:00Z',
    actor: '@test',
    actorKind: 'human',
    type: 'session_summary',
    project: 'brain',
    content: 'Test session summary',
  }) + '\n';
}


// ── Tests ─────────────────────────────────────────────────────────────────────

test('brain-audit: PASS merge — emits [PASS] and exits 0', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-pass-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeRepo(dir);

  // Initial commit on main
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');

  // Feature branch with all invariants satisfied:
  //   issueLink   → "Closes #1" in commit message
  //   diffSize    → tiny diff
  //   adrPresence → neither ADR nor HOME.md changed → pass (no ADR needed)
  //   memoryPresence → .memory/records/ contains a valid session_summary observation
  git('checkout', '-b', 'feature/good');
  commit(git, dir,
    { '.memory/records/2026-07.jsonl': makeSessionSummaryRecord() },
    'feat: good feature Closes #1 (#1)');

  git('checkout', 'main');
  git('merge', '--no-ff', 'feature/good', '-m', 'Merge branch feature/good Closes #1');

  const r = spawnSync('node', [AUDIT_SCRIPT, 'HEAD~1..HEAD'], {
    cwd: dir, encoding: 'utf8',
  });

  assert.ok(r.stdout.includes('[PASS]'), `expected [PASS] in stdout:\n${r.stdout}\n${r.stderr}`);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\nstderr: ${r.stderr}`);
});

test('brain-audit: FAIL merge — emits [FAIL] with invariants and exits 1', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-fail-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');

  // Bad feature: no issue link + no memory → 2 failures
  git('checkout', '-b', 'feature/bad');
  commit(git, dir, { 'src/feature.mjs': 'export const x = 1;' }, 'feat: bad feature');
  git('checkout', 'main');
  git('merge', '--no-ff', 'feature/bad', '-m', 'Merge branch feature/bad (no issue link)');

  const r = spawnSync('node', [AUDIT_SCRIPT, 'HEAD~1..HEAD'], {
    cwd: dir, encoding: 'utf8',
  });

  assert.ok(r.stdout.includes('[FAIL]'), `expected [FAIL] in stdout:\n${r.stdout}\n${r.stderr}`);
  assert.ok(r.stdout.includes('issueLink'), `expected "issueLink" in output:\n${r.stdout}`);
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}`);
});

test('brain-audit: no merges in range — exits 0 with info message', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-empty-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');
  // A second non-merge commit
  commit(git, dir, { 'x.md': 'x' }, 'docs: add x (#1)');

  const r = spawnSync('node', [AUDIT_SCRIPT, 'HEAD~1..HEAD'], {
    cwd: dir, encoding: 'utf8',
  });

  assert.equal(r.status, 0, `expected exit 0 when no merges, got ${r.status}\nstderr: ${r.stderr}`);
});

// ── --first-parent regression — nested slice merges must be EXCLUDED ──────────
//
// Real-world pattern: a feature branch (e.g., feature/governance) accumulates
// several slice PRs merged into it (sub/slice1 → feature). When the feature branch
// finally merges into main the git range A..main contains both:
//   • M1  — the integration merge (feature → main)      ← SHOULD be audited
//   • M2  — the nested slice merge (sub → feature)      ← MUST be excluded
//
// Without --first-parent the engine walks second parents and finds M2.
// M2 carries "Part of #5" body (no Closes #N) → issueLink fails → false FAIL.
// With --first-parent only M1 is visited → no false failures.
test('brain-audit: --first-parent excludes nested slice merges', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-firstparent-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeRepo(dir);

  // (A) initial commit on main
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');

  // (B) feature/big branch
  git('checkout', '-b', 'feature/big');

  // (C) sub/slice1 branch merged into feature/big — nested merge (no Closes #N)
  git('checkout', '-b', 'sub/slice1');
  commit(git, dir, { 'src/code.mjs': 'export const x = 1;' }, 'feat: partial work (Part of #5)');
  git('checkout', 'feature/big');
  git('merge', '--no-ff', 'sub/slice1', '-m',
    'Merge sub/slice1 into feature/big (Part of #5)');  // M2 — no Closes #N

  // (D) finalize feature: add memory record with a session_summary observation
  commit(git, dir, { '.memory/records/2026-07.jsonl': makeSessionSummaryRecord() },
    'chore: finalize (Part of #5)');

  // (E) merge feature/big into main — M1: the integration merge
  git('checkout', 'main');
  git('merge', '--no-ff', 'feature/big', '-m',
    'feat: big feature Closes #5');   // M1 — has Closes #N + .memory/ in diff

  // Range: HEAD~1..HEAD = just the top-level merge event on main.
  // With --first-parent: only M1 is audited → PASS (Closes #5, .memory/ present).
  // Without --first-parent: M2 is also visited → issueLink fails → exit 1.
  const r = spawnSync('node', [AUDIT_SCRIPT, 'HEAD~1..HEAD'], {
    cwd: dir, encoding: 'utf8',
  });

  assert.equal(r.status, 0,
    `expected exit 0 (only top-level merge M1 audited), got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.ok(r.stdout.includes('[PASS]'),
    `expected [PASS] in stdout:\n${r.stdout}`);
  assert.ok(!r.stdout.includes('[FAIL]'),
    `unexpected [FAIL] — nested merge must not be audited:\n${r.stdout}`);

  // Confirm only ONE audit line (M1 only, not M2 too)
  const auditLines = r.stdout.split('\n').filter(l => l.startsWith('[PASS]') || l.startsWith('[FAIL]'));
  assert.equal(auditLines.length, 1,
    `expected 1 audited merge (integration merge only), got ${auditLines.length}:\n${r.stdout}`);
});

// ── baseline — pre-baseline merges are skipped, not failed ───────────────────
//
// Pattern:
//   A (initial) → MERGE_BAD (no issue link) → E (add config) → [tag v0.1.0 on E] → MERGE_GOOD (Closes #1)
//
// With auditBaseline = "v0.1.0":
//   MERGE_BAD: v0.1.0 (E) is NOT ancestor of MERGE_BAD → [SKIP] — not a failure
//   MERGE_GOOD: v0.1.0 (E) IS ancestor of MERGE_GOOD → [PASS]
//   Exit: 0  (without baseline MERGE_BAD would cause exit 1)
test('brain-audit: baseline skips pre-baseline merges (no false failure)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-baseline-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeRepo(dir);

  // (A) initial commit on main
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');

  // (B) feature/bad — will be merged before the baseline tag; has no issue link
  git('checkout', '-b', 'feature/bad');
  commit(git, dir, { 'src/bad.mjs': 'export const x = 1;' }, 'feat: pre-baseline work');
  git('checkout', 'main');
  git('merge', '--no-ff', 'feature/bad', '-m', 'Merge feature/bad (no issue ref)');  // MERGE_BAD

  // (C) commit that carries the brain.config.json with the baseline setting
  commit(git, dir, {
    'brain.config.json': JSON.stringify({
      governance: { auditBaseline: 'v0.1.0' },
    }),
  }, 'chore: add audit config');

  // Tag v0.1.0 on the current HEAD (commit C — after MERGE_BAD)
  git('tag', 'v0.1.0');

  // (D) feature/good — after the baseline tag; has all invariants satisfied
  git('checkout', '-b', 'feature/good');
  commit(git, dir, { '.memory/records/2026-07.jsonl': makeSessionSummaryRecord() },
    'feat: after baseline Closes #1');
  git('checkout', 'main');
  git('merge', '--no-ff', 'feature/good', '-m', 'Merge feature/good Closes #1');  // MERGE_GOOD

  // Run without explicit range — defaults to HEAD (whole history)
  const r = spawnSync('node', [AUDIT_SCRIPT], {
    cwd: dir, encoding: 'utf8',
  });

  assert.equal(r.status, 0,
    `expected exit 0 (MERGE_BAD skipped by baseline), got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

  // MERGE_BAD must be skipped, not failed
  assert.ok(r.stdout.includes('[SKIP]'),
    `expected [SKIP] for pre-baseline merge:\n${r.stdout}`);
  assert.ok(!r.stdout.includes('[FAIL]'),
    `unexpected [FAIL] — pre-baseline merge must be skipped:\n${r.stdout}`);

  // MERGE_GOOD must be audited and pass
  assert.ok(r.stdout.includes('[PASS]'),
    `expected [PASS] for post-baseline merge:\n${r.stdout}`);
});

// ── baseline invalid ref — warns and audits all (no crash) ───────────────────
test('brain-audit: invalid baseline ref warns and falls back to auditing all', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-baseline-invalid-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');

  // Config with a baseline ref that does not exist
  commit(git, dir, {
    'brain.config.json': JSON.stringify({
      governance: { auditBaseline: 'v99.0.0-nonexistent' },
    }),
  }, 'chore: add config');

  // One good merge after the config
  git('checkout', '-b', 'feature/ok');
  commit(git, dir, { '.memory/records/2026-07.jsonl': makeSessionSummaryRecord() },
    'feat: good Closes #1');
  git('checkout', 'main');
  git('merge', '--no-ff', 'feature/ok', '-m', 'Merge feature/ok Closes #1');

  const r = spawnSync('node', [AUDIT_SCRIPT], {
    cwd: dir, encoding: 'utf8',
  });

  // Invalid baseline → falls back → audits all → [PASS] → exit 0
  assert.equal(r.status, 0,
    `expected exit 0 after invalid baseline fallback, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  // Warning must be emitted to stderr
  assert.ok(r.stderr.includes('[WARN]'),
    `expected [WARN] on stderr for invalid baseline:\n${r.stderr}`);
  // Still audits and passes the good merge
  assert.ok(r.stdout.includes('[PASS]'),
    `expected [PASS] in stdout after fallback:\n${r.stdout}`);
});

// ── real records path — session_summary causes memoryPresence to pass ─────
//
// This test is the canonical proof that the full real-records path works end-to-end:
// brain-audit reads the .memory/records/*.jsonl, parses the records,
// extracts the session_summary observation, and memoryPresence returns pass.
test('brain-audit: real records with session_summary → memoryPresence passes', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-realrecords-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');

  git('checkout', '-b', 'feature/real-records');
  commit(git, dir,
    { '.memory/records/2026-07.jsonl': makeSessionSummaryRecord() },
    'feat: real records Closes #2');
  git('checkout', 'main');
  git('merge', '--no-ff', 'feature/real-records', '-m',
    'Merge feature/real-records Closes #2');

  const r = spawnSync('node', [AUDIT_SCRIPT, 'HEAD~1..HEAD'], {
    cwd: dir, encoding: 'utf8',
  });

  assert.equal(r.status, 0,
    `expected exit 0, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.ok(r.stdout.includes('[PASS]'),
    `expected [PASS] in stdout:\n${r.stdout}`);
  assert.ok(!r.stdout.includes('memoryPresence'),
    `memoryPresence must not appear in output when passing:\n${r.stdout}`);
});

// ── corrupt record line is skipped — no crash ─────────────────────────────────
//
// When a record file is present but has an invalid JSON line,
// brain-audit must skip it silently and NOT crash.  The merge will fail the
// memoryPresence check (no valid session_summary), but the audit process itself
// must exit cleanly (not with an unhandled exception).
test('brain-audit: corrupt record line is skipped — audit does not crash', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-corrupt-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');

  git('checkout', '-b', 'feature/corrupt');
  // Write a .jsonl file that is NOT valid JSON — should be caught and skipped
  commit(git, dir,
    { '.memory/records/2026-07.jsonl': 'this is not json data at all\n' },
    'feat: corrupt record Closes #3');
  git('checkout', 'main');
  git('merge', '--no-ff', 'feature/corrupt', '-m',
    'Merge feature/corrupt Closes #3');

  const r = spawnSync('node', [AUDIT_SCRIPT, 'HEAD~1..HEAD'], {
    cwd: dir, encoding: 'utf8',
  });

  // Corrupt chunk → skipped → allObservations=[] → memoryPresence fails → exit 1
  // But the audit process itself must NOT crash (stderr must not contain 'Error:' at top level)
  assert.equal(r.status, 1,
    `expected exit 1 (memoryPresence fail), got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.ok(r.stdout.includes('[FAIL]'),
    `expected [FAIL] in stdout:\n${r.stdout}`);
  // No unhandled exception
  assert.ok(!r.stderr.includes('brain-audit: unexpected error'),
    `unexpected top-level error logged:\n${r.stderr}`);
});

// ── prView fix-at-source disposition ──────────────────────────────────────────
//
// prView() now returns `labels: null, body: null` on a genuinely uncomputable
// fetch (REQ-CIC-2) — distinct from `[]`/`''` (genuinely empty). The audit
// consumer must NOT collapse that `null` back into a fabricated `[]`/`''`
// default (`pr.labels ?? []`) — that re-introduces the exact fail-open the
// seam was built to remove, just on a parallel path. `shouldSkipSize(null)`
// and `selectIssueLinkBody(null, commitBody)` (audit-helpers.test.mjs) already
// prove the downstream pure functions handle `null` safely; this proves the
// null actually reaches them, unmangled.
test('brain-audit: prView() null labels/body are NOT coerced to []/\'\' before reaching the pure helpers (fix dies at source)', () => {
  const src = readFileSync(fileURLToPath(new URL('./brain-audit.mjs', import.meta.url)), 'utf8');
  assert.equal(src.includes('pr.labels ?? []'), false,
    'must not fabricate an empty labels default over a possibly-null pr.labels — let null reach shouldSkipSize()');
  assert.equal(src.includes('pr.body ?? \'\''), false,
    'must not fabricate an empty body default over a possibly-null pr.body — let null reach selectIssueLinkBody()');
});

// ═══════════════════════════════════════════════════════════════════════════
// D2 PR3 — [FAIL-SHA] emission, resolved-skip, reverter-skip, fail-closed
// exit-2 (REQ-D2-3, REQ-D2-5, REQ-D2-10, REQ-D2-10a, REQ-D2-6, REQ-D2-12).
// Fixtures A1–A6 run END-TO-END through this file's own CLI/module entry
// (design §7.1, tasks §Phase 3.2) — never at resolution.mjs's unit level.
// ═══════════════════════════════════════════════════════════════════════════

import { crossCheckExit, resolvedSkipLine } from './brain-audit.mjs';
import { gitTry, gitOrThrow } from './governance/postmerge/git-seam.mjs';

function sessionSummaryFile() {
  return { '.memory/records/2026-07.jsonl': makeSessionSummaryRecord() };
}

// A merge adding `files`, with a message satisfying issueLink (`Closes #N`)
// unless `closesRef` is explicitly null (used to force an issueLink FAIL).
function mergeAdding(git, dir, branch, files, closesRef = '#1') {
  git('checkout', '-b', branch);
  commit(git, dir, files, closesRef ? `feat: ${branch} Closes ${closesRef}` : `feat: ${branch}`);
  git('checkout', 'main');
  const subject = closesRef ? `Merge ${branch} Closes ${closesRef}` : `Merge ${branch}`;
  git('merge', '--no-ff', branch, '-m', subject);
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
}

// A genuine `git revert -m 1 --no-edit <offender>` merged back with a
// Closes-carrying message — the real D2 auto-revert loop shape (design §6).
function revertMerge(git, dir, offender, branch, closesRef = '#1') {
  git('checkout', '-b', branch, 'main');
  spawnSync('git', ['revert', '-m', '1', '--no-edit', offender], { cwd: dir, encoding: 'utf8' });
  git('checkout', 'main');
  git('merge', '--no-ff', branch, '-m', `Revert ${branch} Closes ${closesRef}`);
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
}

// A merge that merely CLAIMS to revert `offender` in its message but whose
// contribution does NOT invert it (design §7.1 A1's shape).
function claimOnlyMerge(git, dir, offender, branch, files) {
  git('checkout', '-b', branch, 'main');
  commit(git, dir, files, `Rc: claims revert\n\nThis reverts commit ${offender}.`);
  git('checkout', 'main');
  git('merge', '--no-ff', branch, '-m', `Merge ${branch}\n\nThis reverts commit ${offender}.`);
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
}

test('D2 emission — [FAIL] carries an additive [FAIL-SHA] <full-sha> line', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-failsha-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');
  const m = mergeAdding(git, dir, 'feat-bad', { 'src/x.mjs': 'export const x = 1;' }, null);

  const r = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes(`[FAIL-SHA] ${m}`), `expected [FAIL-SHA] ${m}:\n${r.stdout}`);
});

test('D2 A1 — a forged revert trailer on a real descendant does NOT resolve the offender', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-a1-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init', ...sessionSummaryFile() }, 'chore: initial (#0)');
  const m = mergeAdding(git, dir, 'feat-m', { 'p.md': 'SECRET_PAYLOAD\n' }, null);
  claimOnlyMerge(git, dir, m, 'feat-claim', { 'other.txt': 'noise\n' });

  const r = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1, r.stdout);
  assert.ok(r.stdout.includes(`[FAIL-SHA] ${m}`), `M must still FAIL:\n${r.stdout}`);
  assert.ok(!r.stdout.includes('resolved by revert'), `M must NOT be skipped:\n${r.stdout}`);
});

test('D2 A2 — a genuine revert resolves the offender (liveness), exit 0', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-a2-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init', ...sessionSummaryFile() }, 'chore: initial (#0)');
  const m = mergeAdding(git, dir, 'feat-m', { 'p.md': 'SECRET_PAYLOAD\n' }, null);
  revertMerge(git, dir, m, 'rv');

  const r = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
  assert.ok(r.stdout.includes(`[SKIP]`) && r.stdout.includes('resolved by revert'),
    `expected resolved-by-revert skip:\n${r.stdout}`);
  assert.ok(!r.stdout.includes(`[FAIL-SHA] ${m}`), `M must not FAIL:\n${r.stdout}`);
});

test('D2 A3 — a partial revert does NOT resolve the offender', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-a3-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init', ...sessionSummaryFile() }, 'chore: initial (#0)');
  const m = mergeAdding(git, dir, 'feat-m', { 'a.md': 'A_PAYLOAD\n', 'b.md': 'B_PAYLOAD\n' }, null);
  // Partial "fix": restores a.md only, via an ordinary commit (not `git revert`).
  git('checkout', '-b', 'fix-partial');
  writeFileSync(join(dir, 'a.md'), '');
  spawnSync('git', ['rm', '-q', 'a.md'], { cwd: dir });
  git('commit', '-m', 'fix: remove a.md only');
  git('checkout', 'main');
  git('merge', '--no-ff', 'fix-partial', '-m', 'Merge fix-partial Closes #2');

  const r = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  assert.ok(r.stdout.includes(`[FAIL-SHA] ${m}`), `M must still FAIL (partial revert):\n${r.stdout}`);
});

test('D2 A5 — re-introduction after revert is a NEW offender at its own tip, never silently skipped', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-a5-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init', ...sessionSummaryFile() }, 'chore: initial (#0)');
  const m = mergeAdding(git, dir, 'feat-m', { 'p.md': 'SECRET_PAYLOAD\n' }, null);
  revertMerge(git, dir, m, 'rv');
  const later = mergeAdding(git, dir, 'feat-readd', { 'p.md': 'SECRET_PAYLOAD\n' }, null);

  const r = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1, r.stdout);
  assert.ok(r.stdout.includes('resolved by revert'), `M must still resolve at this tip:\n${r.stdout}`);
  assert.ok(r.stdout.includes(`[FAIL-SHA] ${later}`),
    `re-add must be a NEW offender, not silently skipped:\n${r.stdout}`);
});

test('D2 A6 — the reverter-skip closes the revert-of-revert loop; a mere claim is not skipped', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-a6-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init', ...sessionSummaryFile() }, 'chore: initial (#0)');
  const m = mergeAdding(git, dir, 'feat-adr',
    { 'brain/project/decisions/adr-9001-thing.md': '# ADR\n' }, null);
  const r = revertMerge(git, dir, m, 'rv-adr');
  const c = claimOnlyMerge(git, dir, m, 'feat-claim', { 'other.txt': 'noise\n' });

  const out = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  assert.ok(out.stdout.includes('resolved by revert'), `M must resolve:\n${out.stdout}`);
  assert.ok(out.stdout.includes(`revert of ${m.slice(0, 7)}`),
    `R (auto-revert of an adrPresence offender) must be [SKIP] revert of M:\n${out.stdout}`);
  assert.ok(!out.stdout.includes(`[FAIL-SHA] ${r}`), `R must not FAIL:\n${out.stdout}`);
  assert.ok(out.stdout.includes(`[FAIL-SHA] ${c}`), `claim-only merge must still FAIL:\n${out.stdout}`);
});

test('D2 FIX1 — reverter-skip exempts ONLY the mirrored check; R\'s own independent issueLink failure survives as [FAIL], not [SKIP]', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-fix1-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init', ...sessionSummaryFile() }, 'chore: initial (#0)');
  // O: adrPresence offender ONLY — ADR added without brain/HOME.md, but its
  // own commit body DOES carry a valid issue ref (passes issueLink).
  const o = mergeAdding(git, dir, 'feat-adr',
    { 'brain/project/decisions/adr-9002-thing.md': '# ADR\n' }, '#1');
  // R: a genuine `git revert -m 1 O`, merged, but R's OWN body carries NO
  // issue ref — R independently fails issueLink. This is NOT mirrored by O
  // (O passed issueLink), so it must survive as [FAIL], not be swallowed
  // whole by the reverter-skip (owner ruling — FIX1).
  const r = revertMerge(git, dir, o, 'rv-adr-noissue', null);

  const out = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  const rLine = out.stdout.split('\n').find((l) => l.includes(r.slice(0, 7)));
  assert.ok(rLine, `R must appear in output:\n${out.stdout}`);
  assert.ok(rLine.startsWith('[FAIL]'),
    `R must be [FAIL] (own issueLink failure not mirrored), not [SKIP]:\n${out.stdout}`);
  assert.ok(rLine.includes('issueLink'),
    `R's surviving failure must be issueLink:\n${rLine}`);
  assert.ok(!rLine.includes('adrPresence'),
    `R's mirrored adrPresence failure must be exempted, not listed:\n${rLine}`);
  assert.ok(out.stdout.includes(`[FAIL-SHA] ${r}`), `R must emit [FAIL-SHA]:\n${out.stdout}`);
});

test('D2 FORGE-C — issueLink is body-keyed, never mirrored by tree inversion: R must FAIL its own issueLink even when the reverted offender O ALSO lacked a ref', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-forgec-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init', ...sessionSummaryFile() }, 'chore: initial (#0)');
  // O: adrPresence offender that ALSO lacks an issue ref — fails {adrPresence, issueLink}.
  const o = mergeAdding(git, dir, 'feat-adr-noissue',
    { 'brain/project/decisions/adr-9003-thing.md': '# ADR\n' }, null);
  // R: a genuine `git revert -m 1 O`, merged, R's OWN body ALSO lacks a ref.
  // issueLink is keyed off R's OWN commit/PR body, never off the tree — the
  // fact that O's body coincidentally ALSO lacked a ref must not exempt R
  // from its own, independent issueLink violation (owner ruling — tree-keyed
  // restriction). Only adrPresence (tree-derived: R touches the same ADR
  // path O did) may ever be mirrored.
  const r = revertMerge(git, dir, o, 'rv-adr-noissue2', null);

  const out = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  const rLine = out.stdout.split('\n').find((l) => l.includes(r.slice(0, 7)));
  assert.ok(rLine, `R must appear in output:\n${out.stdout}`);
  assert.ok(rLine.startsWith('[FAIL]'),
    `R must be [FAIL] (issueLink is body-keyed, never mirrored by tree inversion), not [SKIP]:\n${out.stdout}`);
  assert.ok(rLine.includes('issueLink'),
    `R's surviving failure must be issueLink:\n${rLine}`);
  assert.ok(!rLine.includes('adrPresence'),
    `R's mirrored adrPresence failure must still be exempted (it IS tree-derived):\n${rLine}`);
  assert.ok(out.stdout.includes(`[FAIL-SHA] ${r}`), `R must emit [FAIL-SHA]:\n${out.stdout}`);
  const oLine = out.stdout.split('\n').find((l) => l.includes(o.slice(0, 7)));
  assert.ok(oLine && oLine.startsWith('[SKIP]') && oLine.includes('resolved by revert'),
    `O must still be resolved-skipped (pre-evaluation, unaffected by FIX):\n${out.stdout}`);
  assert.equal(out.status, 1, `expected exit 1 (R still fails):\n${out.stdout}`);
});

// FORGE-E (multi-match, both recency orderings): R's tree is the byte-exact
// inverse of TWO prior offenders sharing the identical tree-derived failing
// set (both touch the same ADR path, so both fail ONLY adrPresence among the
// tree-keyed checks) but differing in their OWN, unmirrored issueLink status.
// Because the mirrored set is now restricted to tree-keyed checks only,
// EVERY candidate m that matches `isReverterOf` has the SAME tree-derived
// failing set ({adrPresence}) regardless of its own issueLink status — so
// which one the loop happens to visit first can no longer flip R's verdict.
// Two variants below swap which offender is CLOSER to R (i.e. visited first
// by the reverse-chronological `merges` iteration) to prove this.
function forgeEFixture(dir, { closerHasRef }) {
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init', ...sessionSummaryFile() }, 'chore: initial (#0)');
  const adrFile = { 'brain/project/decisions/adr-9004-thing.md': '# ADR\n' };

  // Offender WITH a valid ref (fails only adrPresence).
  const withRef = () => mergeAdding(git, dir, `feat-adr-ref-${Math.random().toString(36).slice(2)}`, adrFile, '#1');
  // Offender WITHOUT a ref (fails adrPresence + issueLink).
  const noRef = () => mergeAdding(git, dir, `feat-adr-noref-${Math.random().toString(36).slice(2)}`, adrFile, null);

  let farOffender, farRevert, closeOffender;
  if (closerHasRef) {
    // far = no-ref offender, reverted; close = valid-ref offender (re-add), reverted by R.
    farOffender = noRef();
    farRevert = revertMerge(git, dir, farOffender, 'rv-far', '#1');
    closeOffender = withRef();
  } else {
    // far = valid-ref offender, reverted; close = no-ref offender (re-add), reverted by R.
    farOffender = withRef();
    farRevert = revertMerge(git, dir, farOffender, 'rv-far', '#1');
    closeOffender = noRef();
  }
  void farRevert;
  // R: genuine revert of the CLOSE offender; R's own body lacks a ref.
  const r = revertMerge(git, dir, closeOffender, 'rv-close', null);
  return { farOffender, closeOffender, r };
}

test('D2 FORGE-E — multi-match: R\'s verdict does not depend on which tree-inverse offender is more recent (closer offender lacks ref)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-forgee-a-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { r } = forgeEFixture(dir, { closerHasRef: false });

  const out = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  const rLine = out.stdout.split('\n').find((l) => l.includes(r.slice(0, 7)));
  assert.ok(rLine, `R must appear in output:\n${out.stdout}`);
  assert.ok(rLine.startsWith('[FAIL]'),
    `R must be [FAIL] regardless of match order:\n${out.stdout}`);
  assert.ok(rLine.includes('issueLink'), `R's surviving failure must be issueLink:\n${rLine}`);
  assert.ok(!rLine.includes('adrPresence'), `adrPresence must still be mirrored/exempted:\n${rLine}`);
});

test('D2 FORGE-E — multi-match: R\'s verdict does not depend on which tree-inverse offender is more recent (closer offender has valid ref)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-forgee-b-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { r } = forgeEFixture(dir, { closerHasRef: true });

  const out = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  const rLine = out.stdout.split('\n').find((l) => l.includes(r.slice(0, 7)));
  assert.ok(rLine, `R must appear in output:\n${out.stdout}`);
  assert.ok(rLine.startsWith('[FAIL]'),
    `R must be [FAIL] regardless of match order:\n${out.stdout}`);
  assert.ok(rLine.includes('issueLink'), `R's surviving failure must be issueLink:\n${rLine}`);
  assert.ok(!rLine.includes('adrPresence'), `adrPresence must still be mirrored/exempted:\n${rLine}`);
});

test('D2 — memoryPresence skip-precedence: a resolved offender never reaches memoryPresence; an un-reverted merge still does', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-skipprec-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  // No session_summary anywhere — memoryPresence fails repo-globally for
  // every un-reverted (and un-resolved) merge in this fixture.
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');
  const m = mergeAdding(git, dir, 'feat-m', { 'p.md': 'PAYLOAD\n' });
  revertMerge(git, dir, m, 'rv');
  const n = mergeAdding(git, dir, 'feat-n', { 'q.md': 'OTHER\n' });

  const r = spawnSync('node', [AUDIT_SCRIPT], { cwd: dir, encoding: 'utf8' });
  const mLine = r.stdout.split('\n').find((l) => l.startsWith('[SKIP]') && l.includes(m.slice(0, 7)));
  assert.ok(mLine && !mLine.includes('memoryPresence'),
    `M must be skipped BEFORE memoryPresence runs:\n${r.stdout}`);
  assert.ok(r.stdout.includes(`[FAIL-SHA] ${n}`) && r.stdout.includes('memoryPresence'),
    `un-reverted N must still fail memoryPresence:\n${r.stdout}`);
});

test('D2 C3 — a crashing range load exits 2 (not 1, not 0), message on stdout', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-c3-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');

  const r = spawnSync('node', [AUDIT_SCRIPT, 'not-a-real-ref..HEAD'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 2, `expected exit 2, got ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`);
  assert.ok(r.stdout.includes('governance:audit-uncomputable'), `message must be on stdout:\n${r.stdout}`);
});

test('D2 crossCheckExit — code 1 requires >=1 recorded offender, or the run is itself uncomputable', () => {
  assert.equal(crossCheckExit(false, 0), 0);
  assert.equal(crossCheckExit(true, 3), 1);
  assert.equal(crossCheckExit(true, 0), 2, 'anyFail=true with zero recorded offenders must be uncomputable');
});

test('D2 — resolvedSkipLine never swallows an uncomputable offender (root-commit / missing-parent shape)', (t) => {
  // A merge whose own first-parent contribution cannot be read locally
  // (REQ-D2-12 "point 7" — the offender's diff is uncomputable, e.g. via a
  // shallow clone boundary). `--merges` itself treats a shallow-boundary
  // commit as parentless (excluding it from any real `--merges` walk — a
  // property of git's own shallow machinery, verified empirically), so this
  // shape cannot be reached by a NATURAL `--merges` enumeration; it is
  // exercised directly against the exported wiring function brain-audit's
  // own loop calls, proving the fail-closed contract at the exact call site
  // (never an ad-hoc try/catch swallow — design §5, REQ-D2-12).
  const origin = mkdtempSync(join(tmpdir(), 'audit-root-origin-'));
  const clone = mkdtempSync(join(tmpdir(), 'audit-root-clone-'));
  t.after(() => { rmSync(origin, { recursive: true, force: true }); rmSync(clone, { recursive: true, force: true }); });
  const git = makeRepo(origin);
  commit(git, origin, { 'base.txt': 'base\n' }, 'C0 base');
  git('checkout', '-b', 'feat');
  commit(git, origin, { 'p.md': 'p\n' }, 'feat add');
  git('checkout', 'main');
  git('merge', '--no-ff', 'feat', '-m', 'M: merge payload');
  const m = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: origin, encoding: 'utf8' }).stdout.trim();

  spawnSync('git', ['init', '-q', clone], { encoding: 'utf8' });
  spawnSync('git', ['-C', clone, 'fetch', '-q', '--depth', '1', `file://${origin}`, m], { encoding: 'utf8' });

  const seam = { try: (argv) => gitTry(argv, { cwd: clone }), orThrow: (argv) => gitOrThrow(argv, { cwd: clone }) };
  assert.throws(() => resolvedSkipLine(m, 'M: merge payload', { git: seam }),
    /exited|bad|ambiguous|unknown revision/i);
});
