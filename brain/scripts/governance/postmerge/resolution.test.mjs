// resolution.test.mjs — tree-effect revert-resolution predicate (design §3).
// "The entire security thesis of this change." Every fixture A1-A6 below is
// copied VERBATIM from design §7.1's shape column (doctrine #900, BINDING) —
// each is built from the ATTACK SHAPE the design describes, NEVER derived from
// resolution.mjs's own behavior. Fixture → design §7.1 row mapping:
//   A1 → §7.1 A1 (forged trailer on a real descendant, no tree effect)
//   A2 → §7.1 A2 (genuine `git revert -m 1` — liveness)
//   A3 → §7.1 A3 (partial revert)
//   A4 → §7.1 A4 (empty-diff merge — anti-vacuity)
//   A5 → §7.1 A5 (reverted then re-introduced)
//   A6 → §7.1 A6 (adrPresence offender + genuine auto-revert; reverter-skip)
//
// The A1 fixture additionally REDDENS against the prior plausible-but-wrong
// fix — the shipped ancestry-only `merge-base --is-ancestor` code at commit
// `eff4560` (doctrine #900 rule 2). That RED-against-the-prior-fix is the
// actual proof this suite produces, not merely "fails on unfixed code".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { gitTry, gitOrThrow } from './git-seam.mjs';
import { changedPaths, isResolvedAt, isReverterOf } from './resolution.mjs';

const POSTMERGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

// ── Fixture helpers (house pattern — cursor.test.mjs) ─────────────────────────

// Every repo the fixtures commit into MUST carry its own identity. `git clone`
// inherits none and a fresh runner (actions/checkout) has none to auto-detect,
// so a fixture that commits without setting identity fails only off the
// author's machine. This is the CP-PR1 hermeticity lesson, non-negotiable.
function setIdentity(dir) {
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir, encoding: 'utf8' });
}

function makeRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'resolution-fixture-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  spawnSync('git', ['init', '--initial-branch=main', dir], { encoding: 'utf8' });
  setIdentity(dir);
  return dir;
}

// A git command runner scoped to `dir`. Explodes loudly on any failure — a
// sha PRODUCER never fabricates an empty string (the CP-PR1 lesson).
function run(dir, ...argv) {
  const r = spawnSync('git', argv, { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${argv.join(' ')} in ${dir} failed (status=${r.status}): ${(r.stderr ?? '').trim()}`);
  }
  return (r.stdout ?? '').trim();
}

function headSha(dir) {
  const sha = run(dir, 'rev-parse', 'HEAD');
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`headSha(${dir}): not a 40-hex sha: ${JSON.stringify(sha)}`);
  }
  return sha;
}

function realGit(cwd) {
  return { try: (argv) => gitTry(argv, { cwd }), orThrow: (argv) => gitOrThrow(argv, { cwd }) };
}

function writeAndCommit(dir, path, content, message) {
  const abs = join(dir, path);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
  run(dir, 'add', path);
  run(dir, 'commit', '-m', message);
  return headSha(dir);
}

// Base commit shared by every fixture: a single unrelated file on main.
function seedBase(dir) {
  return writeAndCommit(dir, 'base.txt', 'base\n', 'C0: base');
}

// An offender MERGE that adds `payload` files at the given paths (the realistic
// `--first-parent --merges` shape brain-audit tracks). Returns the merge sha;
// its first parent is main's tip before the merge, so changedPaths(M) is
// exactly the payload set.
function mergeAddingPayload(dir, files, label) {
  run(dir, 'checkout', '-b', `feat-${label}`);
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
    run(dir, 'add', path);
  }
  run(dir, 'commit', '-m', `${label}: add payload`);
  run(dir, 'checkout', 'main');
  run(dir, 'merge', '--no-ff', `feat-${label}`, '-m', `${label}: merge payload`);
  return headSha(dir);
}

// Extract eff4560's cursor.mjs (the shipped ancestry-only fix) to a temp file
// and import its `isRevertedInRange`. eff4560's module is self-contained (only
// node builtins) and takes a function-form injectable `git` seam. Read-only —
// no commits, so no identity needed.
async function loadEff4560(t) {
  const src = spawnSync('git', ['show', 'eff4560:brain/scripts/governance/postmerge/cursor.mjs'], {
    cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (src.status !== 0) {
    throw new Error(`cannot extract eff4560 cursor.mjs: ${(src.stderr ?? '').trim()}`);
  }
  const dir = mkdtempSync(join(tmpdir(), 'eff4560-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'cursor-eff4560.mjs');
  writeFileSync(file, src.stdout);
  return import(pathToFileURL(file).href);
}

// Function-form git seam eff4560 expects: returns stdout, throws on non-zero.
function fnGit(cwd) {
  return (argv) => {
    const r = spawnSync('git', argv, { cwd, encoding: 'utf8' });
    if (r.status !== 0) throw new Error((r.stderr ?? '').trim());
    return (r.stdout ?? '').trim();
  };
}

// ── Phase 2.1 — changedPaths + anti-vacuity ───────────────────────────────────

test('2.1.1 changedPaths — returns the set of paths a commit touches (2 files)', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'a/one.txt': '1\n', 'b/two.txt': '2\n' }, 'M');
  const git = realGit(dir);

  const paths = changedPaths(m, { git });
  assert.deepEqual(new Set(paths), new Set(['a/one.txt', 'b/two.txt']));
});

// A4 — anti-vacuity. An empty-diff merge (tree identical to first parent, via
// `-s ours`) has zero changed paths; a set-theoretic test over the empty set is
// trivially true, which is the exact vacuous-pass shape the review was built to
// find. isResolvedAt MUST refuse it, loudly, as the FIRST branch.
test('2.1.3/2.1.4 A4 — empty-diff merge is refused by the anti-vacuity guard, never a vacuous pass', (t) => {
  const dir = makeRepo(t);
  const c0 = seedBase(dir);
  run(dir, 'checkout', '-b', 'feat-empty');
  writeAndCommit(dir, 'sidecar.txt', 'side\n', 'feat work (discarded by -s ours)');
  run(dir, 'checkout', 'main');
  // `-s ours` records a real 2-parent merge whose tree == first parent's tree.
  run(dir, 'merge', '--no-ff', '-s', 'ours', 'feat-empty', '-m', 'M: empty-effect merge');
  const m = headSha(dir);
  const head = headSha(dir);
  const git = realGit(dir);

  // Fixture sanity: M genuinely has zero changed paths against its first parent.
  assert.equal(changedPaths(m, { git }).size ?? [...changedPaths(m, { git })].length, 0);

  const result = isResolvedAt(m, head, { git });
  assert.deepEqual(result, { resolved: false, reason: 'offender has no changed paths' });
  assert.equal(c0.length, 40); // c0 is a real base sha (fixture integrity)
});

// ── Phase 2.2 — isResolvedAt, the tree-effect predicate ───────────────────────

// A1 — THE security-critical fixture. Offender M adds a payload at path P.
// Then an ORDINARY commit X, a REAL descendant of M (forked AFTER M — the
// realistic linear-main shape), whose body claims `This reverts commit <M>.`
// but whose diff does NOT touch P. Tree-effect must keep M flagged (false),
// AND the SAME fixture must REDDEN against eff4560's ancestry-only fix.
test('2.2.1 A1 — forged revert trailer on a real descendant does NOT resolve (and reddens against eff4560)', async (t) => {
  const dir = makeRepo(t);
  const c0 = seedBase(dir);
  const m = mergeAddingPayload(dir, { 'payload.txt': 'PAYLOAD\n' }, 'M');

  // X: an ordinary commit forked AFTER M (descendant), touching only other.txt,
  // whose body carries a forged revert trailer citing M but reverting nothing.
  writeFileSync(join(dir, 'other.txt'), 'unrelated\n');
  run(dir, 'add', 'other.txt');
  run(dir, 'commit', '-m', `X: unrelated change\n\nThis reverts commit ${m}.`);
  const x = headSha(dir);
  const git = realGit(dir);

  // Fixture integrity: X really is a descendant of M (ancestry PASSES), and X's
  // diff does not touch M's payload path.
  assert.equal(run(dir, 'merge-base', '--is-ancestor', m, x) === '' , true);
  assert.equal([...changedPaths(x, { git })].includes('payload.txt'), false);
  assert.equal(c0.length, 40);

  // Tree-effect (this change): M is NOT resolved — payload.txt is still on disk.
  assert.deepEqual(isResolvedAt(m, x, { git }), { resolved: false });

  // RED-against-the-prior-fix: eff4560's ancestry-only isRevertedInRange WRONGLY
  // reports M as reverted, because X is a descendant of M so `merge-base
  // --is-ancestor` passes on a forged trailer. This is the defeat proof.
  const eff4560 = await loadEff4560(t);
  const wronglyResolved = eff4560.isRevertedInRange(m, { git: fnGit(dir), range: `${c0}..${x}` });
  assert.equal(wronglyResolved, true, 'eff4560 MUST wrongly resolve M — proving ancestry is defeated');
});

// A2 — liveness. A genuine `git revert -m 1 M` restores the tree; the mechanism
// must not pin on a real revert.
test('2.2.3 A2 — a genuine `git revert -m 1 M` resolves the offender (liveness)', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'payload.txt': 'PAYLOAD\n' }, 'M');
  run(dir, 'revert', '-m', '1', '--no-edit', m);
  const r = headSha(dir);
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: true });
});

// A3 — partial revert. M touches P1 and P2; only P1 is restored. Half the
// payload is still on disk → not resolved.
test('2.2.4 A3 — a partial revert (some paths restored, not all) does NOT resolve', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'p1.txt': 'ONE\n', 'p2.txt': 'TWO\n' }, 'M');
  run(dir, 'rm', 'p1.txt');
  run(dir, 'commit', '-m', 'restore only P1');
  const tip = headSha(dir);
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, tip, { git }), { resolved: false });
});

// A5 — reverted then RE-INTRODUCED. The predicate is anchored at the tip and
// sees the re-introduction. A liveness property the trailer approach never had.
test('2.2.5 A5 — payload reverted then re-added at the tip does NOT resolve (anchored at tip)', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'payload.txt': 'PAYLOAD\n' }, 'M');
  run(dir, 'revert', '-m', '1', '--no-edit', m);
  writeFileSync(join(dir, 'payload.txt'), 'PAYLOAD-AGAIN\n');
  run(dir, 'add', 'payload.txt');
  run(dir, 'commit', '-m', 're-introduce the payload');
  const tip = headSha(dir);
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, tip, { git }), { resolved: false });
});

// 2.2.7 drift-guard — the deleted discriminators must not exist anywhere in the
// postmerge SOURCE (non-test .mjs). A mechanical trip-wire against the exact
// regression this PR exists to prevent (design §3.0).
test('2.2.7 drift-guard — isRevertedInRange/findTrailerCandidates/trailerRegex are absent from postmerge source', () => {
  const banned = ['isRevertedInRange', 'findTrailerCandidates', 'trailerRegex'];
  const files = readdirSync(POSTMERGE_DIR).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'));
  assert.ok(files.length > 0, 'expected at least one non-test .mjs under postmerge/');
  for (const f of files) {
    const src = readFileSync(join(POSTMERGE_DIR, f), 'utf8');
    for (const name of banned) {
      assert.equal(src.includes(name), false, `${name} must not exist in ${f} (design §3.0)`);
    }
  }
});

// §3.4 drift-guard — no \x1e/\x1f record framing may reappear in postmerge
// source. NUL (-z / %x00) is the only byte git cannot store in a commit
// message; tree-effect reads no bodies, so the framing must simply be gone.
test('§3.4 drift-guard — no \\x1e/\\x1f framing constant exists in postmerge source', () => {
  const files = readdirSync(POSTMERGE_DIR).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'));
  for (const f of files) {
    const src = readFileSync(join(POSTMERGE_DIR, f), 'utf8');
    assert.equal(/\\x1[ef]/.test(src), false, `escaped \\x1e/\\x1f framing must not exist in ${f}`);
    assert.equal(/[\x1e\x1f]/.test(src), false, `raw \\x1e/\\x1f control byte must not exist in ${f}`);
  }
});

// ── Phase 2.3 — isReverterOf, the reverter-skip ───────────────────────────────

// A6 — an adrPresence-shaped offender M (adds an ADR without brain/HOME.md) and
// its genuine tree-effect-verified auto-revert R. isReverterOf(M, R) is true.
// A merge that merely CLAIMS to revert M (no tree effect) is NOT a reverter.
test('2.3.1 A6 — genuine auto-revert R of M is a reverter; a claim-only merge is not', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'docs/adr/0001-thing.md': '# ADR 1\n' }, 'M');
  run(dir, 'revert', '-m', '1', '--no-edit', m);
  const r = headSha(dir);
  const git = realGit(dir);

  // R demonstrably removed M's payload: resolved AT R, but NOT at R^1 (== M).
  assert.equal(isReverterOf(m, r, { git }), true);

  // A claim-only merge: touches other.txt, cites a revert trailer, but leaves
  // M's ADR on disk → no tree effect on M's paths → not a reverter.
  writeFileSync(join(dir, 'other.txt'), 'noise\n');
  run(dir, 'add', 'other.txt');
  run(dir, 'commit', '-m', `Rc: claims revert\n\nThis reverts commit ${m}.`);
  const rc = headSha(dir);

  assert.equal(isReverterOf(m, rc, { git }), false);
});

// ── Phase 2.4 — checkpoint gate: violation-class → mechanism (design §3.5) ─────

// 2.4.1 diffSize-shaped: M's own diff exceeds the line budget; a genuine revert
// restores its paths → tree-effect skip (mechanism B). The predicate is the
// SAME `P ∩ D = ∅` used for every class — there is NO diffSize-specific branch
// (design §3.5, mechanism B: "the ONLY use of the tree-effect skip").
test('2.4.1 diffSize-shaped — genuine revert resolves via the SAME tree-effect predicate (design §3.5 mechanism B)', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const big = `${Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n')}\n`;
  const m = mergeAddingPayload(dir, { 'big.txt': big }, 'M');
  run(dir, 'revert', '-m', '1', '--no-edit', m);
  const r = headSha(dir);
  const git = realGit(dir);

  // Identical call shape as A2/A6 — no class-specific parameter exists.
  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: true });
});

// 2.4.2 THE OWNER'S CASE — adrPresence forward-fix. M adds an ADR at path P. A
// LATER commit adds the missing brain/HOME.md at a DIFFERENT path Q, never
// touching P. Tree-effect fails CLOSED forever: P is still on disk so P∩D≠∅.
// The ONLY path that clears M is the human gate (cursor.mjs accept, PR1) —
// which is OUTSIDE resolution.mjs's concern by design (§3.5).
test('2.4.2 OWNER\'S CASE — adrPresence forward-fix is NOT resolved by tree-effect, fails closed forever', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'docs/adr/0002-thing.md': '# ADR 2\n' }, 'M');
  // Forward-fix: add the missing HOME.md at a DIFFERENT path, never touching P.
  writeAndCommit(dir, 'brain/HOME.md', '# HOME\n', 'forward-fix: add missing HOME.md');
  const tip1 = headSha(dir);
  // Even a second, later unrelated commit does not clear it — "false forever".
  writeAndCommit(dir, 'more.txt', 'later\n', 'later unrelated work');
  const tip2 = headSha(dir);
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, tip1, { git }), { resolved: false });
  assert.deepEqual(isResolvedAt(m, tip2, { git }), { resolved: false });
});

// 2.4.3 — design-intent assertion (no new code exercised). Enumerates all four
// violation classes brain-audit emits against the resolution mechanism each
// maps to, citing design §3.5's table, so a future reader sees the mapping is
// deliberate, not incidental. memoryPresence's "never tree-effect, re-eval
// only" claim is a repo-global property OUTSIDE resolution.mjs's per-offender
// predicate — documented here as a boundary; the cross-file wiring proof lands
// in PR 3 (Phase 3.2).
test('2.4.3 — violation-class → resolution-mechanism mapping is deliberate (design §3.5)', () => {
  // Mechanisms per design §3.5:
  //   A = automatic re-evaluation (mutable input makes the check PASS)
  //   B = automatic tree-effect skip (settled-by-revert; the ONLY tree-effect use)
  //   C = human gate (accept --reason)
  //   D = exit-2 (uncomputable)
  const MECHANISMS_BY_CLASS = {
    diffSize: ['B', 'A', 'C'], // revert | size:exception label re-eval | human gate
    issueLink: ['B', 'A', 'C'], // revert | PR-body edit re-eval | human gate
    adrPresence: ['B', 'C'], // revert ONLY — NO automatic forward-fix path
    memoryPresence: ['A'], // repo-global; re-eval ONLY, never tree-effect
  };

  assert.deepEqual(
    Object.keys(MECHANISMS_BY_CLASS).sort(),
    ['adrPresence', 'diffSize', 'issueLink', 'memoryPresence'],
    'exactly the four classes brain-audit emits (brain-audit.mjs:254-262)',
  );
  // The owner's case: adrPresence has NO automatic re-eval (A) path.
  assert.equal(MECHANISMS_BY_CLASS.adrPresence.includes('A'), false);
  // memoryPresence is NEVER tree-effect (B): a repo-global property.
  assert.equal(MECHANISMS_BY_CLASS.memoryPresence.includes('B'), false);
  // Tree-effect (B) — the ONLY mechanism resolution.mjs implements — appears for
  // exactly the classes with an immutable, revert-shaped contribution.
  const treeEffectClasses = Object.entries(MECHANISMS_BY_CLASS)
    .filter(([, m]) => m.includes('B')).map(([c]) => c).sort();
  assert.deepEqual(treeEffectClasses, ['adrPresence', 'diffSize', 'issueLink']);
});
