// brain-audit.test.mjs — fixture-based tests for brain-audit.mjs (REQ-S4-5, REQ-S4-6)
// Uses a temporary git repository with synthetic merge commits to test without
// touching the real repo.  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync,
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

// ── A7 — revert-of-a-revert: a re-added offender is LIVE at HEAD, must be reported ─
//
// PROPERTY (attacker's chair): a merge that fails a tree-keyed governance check
// (diffSize / adrPresence) may only be EXEMPTED if its payload is NET-ABSENT from
// the tree at HEAD.  Equivalently: an offending artifact that is LIVE on disk at
// HEAD must ALWAYS be reported, no matter how many revert / re-revert operations
// sit in the window.  Any audit that lets a live-at-HEAD ungoverned artifact
// escape reporting is WRONG.
//
// THE ATTACK (A7 — the revert-of-a-revert):
//   O   = a merge that ADDS a >400-line file → fails the diffSize tree-keyed check.
//   R   = git revert -m1 O (landed as a first-parent merge) → REMOVES O's payload.
//   R2  = git revert -m1 R (landed as a first-parent merge) → RE-ADDS O's exact
//         payload.  The >400-line file is LIVE on disk at HEAD = R2.
//
// A direction-blind reverter-skip reads R2 as "the revert's own reverter" and
// wrongly exempts it — chaining O (resolved by R) and R (resolved by R2) into a
// full all-[SKIP] / exit-0 whitewash, even though the offending file is sitting
// in the tree at HEAD.  This fixture pins the PROPERTY through the real CLI: the
// live-at-HEAD offender must be REPORTED (never on a [SKIP] line) and the audit
// must exit non-zero.  It asserts WHAT is reported / the exit code — never HOW
// net-absence is computed.
//
// Each of O / R / R2 carries a Closes #N ref and a valid session_summary record
// sits at HEAD, so diffSize is the ONLY governance axis in play: R legitimately
// removes the payload (may be [SKIP] under a correct net-parity audit), while O
// and R2 keep the >400-line file live and MUST surface as offenders.

/** HEAD sha of the fixture repo — a producer that never fabricates an empty string. */
function headShaOf(git) {
  const sha = git('rev-parse', 'HEAD').stdout.trim();
  assert.match(sha, /^[0-9a-f]{40}$/, `headShaOf: not a 40-hex sha: ${JSON.stringify(sha)}`);
  return sha;
}

/**
 * An offender MERGE that adds `files` and lands as a first-parent merge on main
 * (the `--first-parent --merges` shape brain-audit tracks).  `mergeMsg` carries
 * the Closes #N ref that issueLink reads.  Returns the merge sha.
 */
function mergeAddingPayload(git, dir, files, label, mergeMsg) {
  git('checkout', '-b', `feat-${label}`, 'main');
  commit(git, dir, files, `${label}: add payload`);
  git('checkout', 'main');
  const m = git('merge', '--no-ff', `feat-${label}`, '-m', mergeMsg);
  assert.equal(m.status, 0, `merge ${label} failed: ${m.stderr}`);
  return headShaOf(git);
}

/**
 * `git revert -m 1 --no-edit <offender>` on a fresh branch off main, merged back
 * with --no-ff — a GENUINE revert that lands as a first-parent merge (the real
 * auto-revert PR flow).  `mergeMsg` carries the revert PR's own Closes #N ref.
 * Returns the merge sha.
 */
function genuineRevertMerge(git, dir, offenderSha, branchName, mergeMsg) {
  git('checkout', '-b', branchName, 'main');
  const rv = git('revert', '-m', '1', '--no-edit', offenderSha);
  assert.equal(rv.status, 0, `revert of ${offenderSha} failed: ${rv.stderr}`);
  git('checkout', 'main');
  const m = git('merge', '--no-ff', branchName, '-m', mergeMsg);
  assert.equal(m.status, 0, `merge ${branchName} failed: ${m.stderr}`);
  return headShaOf(git);
}

test('brain-audit: A7 revert-of-a-revert — a re-added >400-line offender LIVE at HEAD is reported, never all-[SKIP]', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'audit-a7-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeRepo(dir);

  // Base on main: README + a valid session_summary record so memoryPresence
  // passes repo-wide (it is read once at HEAD). This isolates diffSize as the
  // only governance axis, so O/R2's offender status is purely the LIVE big file.
  commit(git, dir, {
    'README.md': 'init',
    '.memory/records/2026-07.jsonl': makeSessionSummaryRecord(),
  }, 'chore: initial (#0)');
  const base = headShaOf(git);

  // A >400-line file → fails the diffSize tree-keyed check (budget 400).
  const bigFile = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';

  // O — offender merge: adds the >400-line file. diffSize FAIL.
  const oSha = mergeAddingPayload(git, dir, { 'src/big.mjs': bigFile }, 'O',
    'O: add oversized payload Closes #1');

  // R — genuine revert of O (as a merge): REMOVES the payload. May legitimately
  // be [SKIP] under a correct net-parity audit; not asserted either way.
  genuineRevertMerge(git, dir, oSha, 'revert-O', 'R: revert O Closes #2');

  // R2 — revert of R (as a merge): RE-ADDS O's exact payload. The >400-line file
  // is LIVE on disk at HEAD = R2. MUST be reported as an offender.
  const r2Sha = genuineRevertMerge(git, dir, headShaOf(git), 'revert-R',
    'R2: revert R Closes #3');

  // Sanity: the offending file really is live in the working tree at HEAD.
  assert.ok(existsSync(join(dir, 'src/big.mjs')),
    'fixture invariant: the >400-line offender must be live on disk at HEAD=R2');

  // Audit the whole window base..HEAD (covers O, R, R2 on the first-parent chain).
  const r = spawnSync('node', [AUDIT_SCRIPT, `${base}..HEAD`], {
    cwd: dir, encoding: 'utf8',
  });

  // ── PROPERTY assertions — WHAT is reported / exit code, never the mechanism ──

  // 1. The live-at-HEAD offender must fail the audit. A direction-blind
  //    reverter-skip emits all-[SKIP] / exit 0 here — that is the WRONG answer.
  assert.notEqual(r.status, 0,
    `a live-at-HEAD >400-line ungoverned artifact must fail the audit (exit non-zero); got exit ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);

  // 2. R2 — the re-add that puts the offender back on disk at HEAD — must be
  //    REPORTED, and must NOT be exempted on a [SKIP] line. Format-agnostic:
  //    matches [FAIL] <sha7> and [FAIL-SHA] <full-sha> alike, reddens on [SKIP].
  const lines = r.stdout.split('\n').filter(Boolean);
  const r2Line = lines.find(l => l.includes(r2Sha) || l.includes(r2Sha.slice(0, 7)));
  assert.ok(r2Line,
    `R2 (the live re-add at HEAD) must appear in the audit output:\n${r.stdout}`);
  assert.ok(!r2Line.startsWith('[SKIP]'),
    `R2 re-adds a live >400-line offender at HEAD — it must NOT be [SKIP]-exempted:\n${r2Line}`);

  // 3. O — the original offender whose payload is live again at HEAD — must
  //    likewise be reported, never [SKIP]-exempted as "resolved by revert".
  const oLine = lines.find(l => l.includes(oSha) || l.includes(oSha.slice(0, 7)));
  assert.ok(oLine,
    `O (the original >400-line offender, live again at HEAD) must appear in the audit output:\n${r.stdout}`);
  assert.ok(!oLine.startsWith('[SKIP]'),
    `O's payload is live at HEAD via R2 — it must NOT be [SKIP]-exempted:\n${oLine}`);

  // 4. The window must NOT collapse into an all-[SKIP] whitewash: at least one
  //    merge is reported as an offender (the anti-whitewash property).
  const skipCount = lines.filter(l => l.startsWith('[SKIP]')).length;
  const auditedCount = lines.filter(l => /^\[(PASS|FAIL|FAIL-SHA|SKIP)\]/.test(l)).length;
  assert.ok(skipCount < auditedCount,
    `all-[SKIP] whitewash — every audited merge was exempted despite a live offender at HEAD:\n${r.stdout}`);
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
