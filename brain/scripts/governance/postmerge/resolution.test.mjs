// resolution.test.mjs — whole-commit first-parent diff-inversion
// revert-resolution predicate (design §3, revised after judgment-round-1's
// rename bypass, engram #916). Fixtures below are ported DIRECTLY from the
// forge scripts that derived and validated this mechanism against every
// case at once (doctrine #900 — fixtures are derived from the attack, not
// reverse-engineered from the implementation):
//   - forge_final.mjs — the 11-case validation matrix (C2 real loop, pure
//     rename, rename+modify, copy launder, partial revert, invert+extra,
//     drift liveness, F-1 empty, F-2 binary evil/true, whitespace-exact).
//   - forge6.mjs / insp4.mjs — F-4, the attacker-planted `.gitattributes
//     *.md -diff` at tip; content must stay exposed.
//   - blast.mjs — the U3 context-window blast radius: an intervening
//     neighbor edit close to the payload line either conflicts a genuine
//     `git revert` or shifts the rendered hunk so it no longer byte-matches
//     (a documented, accepted trade-off — NOT resolved falls to the human
//     gate); far enough away (>=4 lines), the genuine revert still matches.
//
// The mutation-bar section at the bottom names the specific line each test
// kills if removed (doctrine #900's "reddens against the prior
// plausible-but-wrong fix" bar, generalized to "reddens against a mutant of
// the CURRENT fix").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { gitTry, gitOrThrow } from './git-seam.mjs';
import { isResolvedAt, isReverterOf, makeGit } from './resolution.mjs';

const POSTMERGE_DIR = fileURLToPath(new URL('.', import.meta.url));

// ── Fixture helpers (house pattern — cursor.test.mjs, CP-PR1 hermeticity) ──

// Every repo the fixtures commit into MUST carry its own identity. `git
// clone`/`git init` inherit none, and a fresh runner (actions/checkout) has
// none to auto-detect, so a fixture that commits without setting identity
// fails only off the author's machine. Non-negotiable (CP-PR1 lesson).
function setIdentity(dir) {
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir, encoding: 'utf8' });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir, encoding: 'utf8' });
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

// `git revert` failing (a genuine merge conflict) is a DISTINCT, expected
// outcome (blast-radius distance 1 — falls to the human gate, PR4's
// concern, not this predicate's). Returns { ok, stdout } instead of
// throwing so callers can assert on the conflict itself.
function runMaybe(dir, ...argv) {
  const r = spawnSync('git', argv, { cwd: dir, encoding: 'utf8' });
  return { ok: r.status === 0, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() };
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

// Merge `branch` into `main` with `--no-ff`, returning the merge sha. Every
// candidate reverter in this mechanism MUST be a first-parent merge (the
// set `git rev-list --first-parent --merges` enumerates, exactly what
// brain-audit tracks) — a plain, non-merge commit is never a candidate.
function mergeIntoMain(dir, branch, message) {
  run(dir, 'checkout', 'main');
  run(dir, 'merge', '--no-ff', branch, '-m', message);
  return headSha(dir);
}

// An offender MERGE that adds `files` at the given paths (the realistic
// `--first-parent --merges` shape brain-audit tracks). Returns the merge
// sha; its first parent is main's tip before the merge.
function mergeAddingPayload(dir, files, label) {
  run(dir, 'checkout', '-b', `feat-${label}`);
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
    run(dir, 'add', path);
  }
  run(dir, 'commit', '-m', `${label}: add payload`);
  return mergeIntoMain(dir, `feat-${label}`, `${label}: merge payload`);
}

// `git revert -m 1 --no-edit <offender>` on a fresh branch off `main`, then
// merged back in — a GENUINE revert, always landed as a first-parent merge
// (matching the real auto-revert PR flow, design §6). Returns the merge
// sha, or `{ conflict: true }` if the revert itself could not be applied
// cleanly (blast-radius distance 1 — falls to the human gate).
function genuineRevertMerge(dir, offender, branchName, mergeLabel) {
  run(dir, 'checkout', '-b', branchName, 'main');
  const r = runMaybe(dir, 'revert', '-m', '1', '--no-edit', offender);
  if (!r.ok) {
    runMaybe(dir, 'revert', '--abort');
    run(dir, 'checkout', 'main');
    return { conflict: true };
  }
  return { conflict: false, sha: mergeIntoMain(dir, branchName, mergeLabel) };
}

// ── F-1 — anti-vacuity guard ──────────────────────────────────────────────

// An offender with an EMPTY first-parent contribution (tree == first
// parent's tree, via `-s ours`) MUST be refused, loudly, as the FIRST
// branch of isResolvedAt — never a vacuous pass regardless of what else is
// in range.
test('F-1 — an empty-diff offender is refused by the anti-vacuity guard, never a vacuous pass', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  run(dir, 'checkout', '-b', 'feat-empty');
  writeAndCommit(dir, 'sidecar.txt', 'side\n', 'feat work (discarded by -s ours)');
  run(dir, 'checkout', 'main');
  run(dir, 'merge', '--no-ff', '-s', 'ours', 'feat-empty', '-m', 'M: empty-effect merge');
  const m = headSha(dir);
  const git = realGit(dir);

  const result = isResolvedAt(m, m, { git });
  assert.deepEqual(result, { resolved: false, reason: 'offender has no first-parent contribution' });
});

// ── forge_final case 1 (~ A2 liveness) — C2 real D2 revert loop ────────────

test('C2 — a genuine revert merge resolves the offender (liveness, the real D2 loop shape)', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'p.md': 'SECRET_PAYLOAD\n' }, 'M');
  const r = genuineRevertMerge(dir, m, 'rv', 'PR2: revert M');
  assert.equal(r.conflict, false);
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r.sha, { git }), { resolved: true });
});

// ── forge_final case 2 — pure rename does NOT resolve ──────────────────────
// THE security-critical fixture: judgment-round-1 (#916) reproduced a
// bypass here against the prior path-scoped `P ∩ D = ∅` predicate — a
// rename made the offender's original path absent from the diff set while
// the payload survived, unmoved in content, at a new path. This mechanism
// compares whole diff TEXT, never paths in isolation, so a rename that does
// not restore the pre-offender content can never match.
test('pure rename does NOT resolve the offender (the #916 bypass shape)', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'p.md': 'SECRET_PAYLOAD\n' }, 'M');
  run(dir, 'checkout', '-b', 'rn', 'main');
  run(dir, 'mv', 'p.md', 'q.md');
  run(dir, 'commit', '-m', 'rn: rename only');
  const r = mergeIntoMain(dir, 'rn', 'PR2: rename launder');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
  // Fixture integrity: the payload really does survive, just relocated.
  const grep = spawnSync('git', ['grep', '-qa', 'SECRET_PAYLOAD', r], { cwd: dir });
  assert.equal(grep.status, 0, 'payload must still be present on disk at the renamed path');
});

// ── forge_final case 3 — rename + modify does NOT resolve ──────────────────

test('rename + content modification does NOT resolve the offender', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'p.md': 'SECRET_PAYLOAD\n' }, 'M');
  run(dir, 'checkout', '-b', 'rnm', 'main');
  run(dir, 'mv', 'p.md', 'q.md');
  writeFileSync(join(dir, 'q.md'), 'SECRET_PAYLOAD\n#x\n');
  run(dir, 'add', 'q.md');
  run(dir, 'commit', '-m', 'rnm: rename + modify');
  const r = mergeIntoMain(dir, 'rnm', 'PR2: rename+modify launder');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
});

// ── forge_final case 4 — copy launder does NOT resolve ─────────────────────

test('a copy-then-remove launder does NOT resolve the offender', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'p.md': 'SECRET_PAYLOAD\n' }, 'M');
  run(dir, 'checkout', '-b', 'cp', 'main');
  const src = readFileSync(join(dir, 'p.md'));
  writeFileSync(join(dir, 'keep.md'), src);
  run(dir, 'rm', 'p.md');
  run(dir, 'add', 'keep.md');
  run(dir, 'commit', '-m', 'cp: copy then remove original');
  const r = mergeIntoMain(dir, 'cp', 'PR2: copy launder');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
});

// ── forge_final case 5 (~ A3) — partial revert does NOT resolve ────────────

test('a partial revert (some paths restored, not all) does NOT resolve', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'a.md': 'SEC_A\n', 'b.md': 'SEC_B\n' }, 'M');
  run(dir, 'checkout', '-b', 'pr', 'main');
  run(dir, 'rm', 'a.md');
  run(dir, 'commit', '-m', 'restore only a.md');
  const r = mergeIntoMain(dir, 'pr', 'PR2: partial restore');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
});

// ── forge_final case 6 — invert + extra damage does NOT resolve ────────────
// A candidate that DOES restore the offender's path but ALSO introduces
// unrelated extra content in the SAME commit is not a clean inversion — the
// candidate's own contribution, read backward, carries the extra damage
// too, so it cannot byte-match the offender's (smaller) contribution.

test('inverting the payload while also introducing extra damage does NOT resolve', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'a.md': 'SEC_A\n' }, 'M');
  run(dir, 'checkout', '-b', 'ie', 'main');
  run(dir, 'rm', 'a.md');
  writeFileSync(join(dir, 'evil.md'), 'EVIL\n');
  run(dir, 'add', 'evil.md');
  run(dir, 'commit', '-m', 'ie: restore + smuggle evil.md');
  const r = mergeIntoMain(dir, 'ie', 'PR2: invert+extra');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
});

// ── forge_final case 7 — drift liveness ─────────────────────────────────────
// An unrelated intervening commit shifts line numbers elsewhere in the
// file (outside the payload's own context window). A genuine revert still
// matches: normDiff drops the position-only `@@ ...@@` header, keeping only
// the byte-exact content, which is unaffected by the shift.

test('drift liveness — an unrelated intervening edit does not pin a genuine revert', (t) => {
  const dir = makeRepo(t);
  writeAndCommit(dir, 'c.txt', 'L1\nL2\nL3\n', 'base');
  const m = mergeAddingPayload(dir, { 'c.txt': 'L1\nL2\nL3\nSECRET_PAYLOAD\n' }, 'M');
  writeAndCommit(dir, 'c.txt', 'TOP\nL1\nL2\nL3\nSECRET_PAYLOAD\n', 'shift: unrelated prepend, far from the payload line');
  const r = genuineRevertMerge(dir, m, 'rv', 'PR2: revert despite drift');
  assert.equal(r.conflict, false);
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r.sha, { git }), { resolved: true });
});

// ── forge_final case 9/10 — F-2 binary payloads ─────────────────────────────

test('F-2 — a different binary payload at the same path does NOT resolve the offender', (t) => {
  const dir = makeRepo(t);
  writeAndCommit(dir, 'a.bin', Buffer.from([0x00, 0x6f, 0x72, 0x69, 0x67]), 'binary base');
  const m = mergeAddingPayload(dir, { 'a.bin': Buffer.from([0x00, 0x41, 0x41, 0x41]) }, 'M');
  run(dir, 'checkout', '-b', 'ev', 'main');
  writeFileSync(join(dir, 'a.bin'), Buffer.from([0x00, 0x42, 0x42, 0x42]));
  run(dir, 'add', 'a.bin');
  run(dir, 'commit', '-m', 'ev: different binary payload, not a real revert');
  const r = mergeIntoMain(dir, 'ev', 'PR2: binary evil-modify');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
});

test('F-2 — a genuine revert of a binary payload resolves the offender (liveness)', (t) => {
  const dir = makeRepo(t);
  writeAndCommit(dir, 'a.bin', Buffer.from([0x00, 0x6f, 0x72, 0x69, 0x67]), 'binary base');
  const m = mergeAddingPayload(dir, { 'a.bin': Buffer.from([0x00, 0x41, 0x41, 0x41]) }, 'M');
  const r = genuineRevertMerge(dir, m, 'rv', 'PR2: revert binary payload');
  assert.equal(r.conflict, false);
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r.sha, { git }), { resolved: true });
});

// ── forge_final case 11 — whitespace is part of content, never normalized ──

test('whitespace-only differences (indentation) are NOT treated as a match', (t) => {
  const dir = makeRepo(t);
  writeAndCommit(dir, 'w.txt', 'x\ny\n', 'base');
  const m = mergeAddingPayload(dir, { 'w.txt': 'x\nPAY\ny\n' }, 'M');
  run(dir, 'checkout', '-b', 'b', 'main');
  writeFileSync(join(dir, 'w.txt'), 'x\n    PAY\ny\n'); // re-indented, not byte-identical
  run(dir, 'add', 'w.txt');
  run(dir, 'commit', '-m', 'b: indented differently, not a byte-exact revert');
  const r = mergeIntoMain(dir, 'b', 'PR2: whitespace drift');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
});

// ── F-4 (forge6.mjs / insp4.mjs) — attacker-planted .gitattributes ─────────
// An attacker plants `*.md -diff` in `.gitattributes` at tip AFTER the
// offender lands, to make git render the payload as an opaque binary stub.
// `--binary` ALONE defeats this (the predicate is pure-read — no
// `.git/info/attributes` write): a `-diff`-attributed file still renders as
// a content-bearing base85 patch, so a non-revert candidate with DIFFERENT
// content is still correctly refused. (The ADD-shaped case below passes via
// path asymmetry; the MODIFY+MODIFY case is the one that actually reddens if
// `--binary` is dropped — see 'F-4 same-path MODIFY' below.)
test('F-4 — a planted .gitattributes "-diff" does not launder a non-revert candidate', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'secret.md': 'PAYLOAD_AAA\n' }, 'M');
  // Attacker plants the attribute AFTER the offender, directly on main.
  writeAndCommit(dir, '.gitattributes', '*.md -diff\n', 'chore: attributes (attacker-planted)');
  run(dir, 'checkout', '-b', 'ev', 'main');
  writeFileSync(join(dir, 'secret.md'), 'PAYLOAD_BBB\n');
  run(dir, 'add', 'secret.md');
  run(dir, 'commit', '-m', 'ev: different content, not a real revert');
  const r = mergeIntoMain(dir, 'ev', 'PR2: attribute-shielded launder attempt');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
});

// F-4 same-path MODIFY — the test that actually exercises the `--binary`
// defense (judgment-round-2, Judge A). The offender MODIFIES a pre-existing
// file (its diff has no `/dev/null` side), and a non-revert candidate
// MODIFIES the same path to DIFFERENT content, under the attacker's
// `*.md -diff`. WITHOUT `--binary` both first-parent diffs render as the
// identical content-blind "Binary files a/secret.md and b/secret.md differ"
// stub → they compare EQUAL → false `resolved:true`. WITH `--binary` the
// base85 blocks carry content → distinct → correctly refused. So dropping
// `--binary` reddens THIS test (the ADD-shaped F-4 case above cannot).
test('F-4 same-path MODIFY — a planted "-diff" cannot launder a modify-to-different-content (reddens on --binary drop)', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  writeAndCommit(dir, 'secret.md', 'ORIGINAL\n', 'seed: secret.md pre-exists so the offender MODIFIES it');
  run(dir, 'checkout', '-b', 'off', 'main');
  writeFileSync(join(dir, 'secret.md'), 'PAYLOAD_AAA\n');
  run(dir, 'add', 'secret.md');
  run(dir, 'commit', '-m', 'off: modify secret.md to AAA');
  const m = mergeIntoMain(dir, 'off', 'PR1: modify offender');
  // attacker plants -diff, then a MODIFY fake-reverter to DIFFERENT content
  writeAndCommit(dir, '.gitattributes', '*.md -diff\n', 'chore: attributes (attacker-planted)');
  run(dir, 'checkout', '-b', 'ev', 'main');
  writeFileSync(join(dir, 'secret.md'), 'PAYLOAD_BBB\n');
  run(dir, 'add', 'secret.md');
  run(dir, 'commit', '-m', 'ev: modify to BBB, not a revert');
  const r = mergeIntoMain(dir, 'ev', 'PR2: modify launder under -diff');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
});

// A genuine revert must ALSO still resolve under the same planted
// attribute — the hardening must not create a false NEGATIVE either.
test('F-4 — a genuine revert still resolves despite the planted .gitattributes', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'secret.md': 'PAYLOAD_AAA\n' }, 'M');
  writeAndCommit(dir, '.gitattributes', '*.md -diff\n', 'chore: attributes (attacker-planted)');
  const r = genuineRevertMerge(dir, m, 'rv', 'PR2: genuine revert under attribute attack');
  assert.equal(r.conflict, false);
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r.sha, { git }), { resolved: true });
});

// ── blast.mjs — the U3 context-window blast radius (documented tradeoff) ───
// A single-line payload edit at position P; an intervening, unrelated
// neighbor edit near P. Distance measured in lines from the payload.

function blastTrial(t, distance) {
  const dir = makeRepo(t);
  const N = 60;
  const P = 30;
  const base = Array.from({ length: N }, (_, i) => `line_${i}`);
  writeAndCommit(dir, 'f.txt', `${base.join('\n')}\n`, 'base');
  const withPayload = [...base];
  withPayload[P - 1] = 'line_PAYLOAD';
  const m = mergeAddingPayload(dir, { 'f.txt': `${withPayload.join('\n')}\n` }, 'M');
  if (distance !== null) {
    const shifted = [...withPayload];
    shifted[P - 1 - distance] = 'line_NEIGHBOR';
    writeAndCommit(dir, 'f.txt', `${shifted.join('\n')}\n`, `neighbor edit at distance ${distance}`);
  }
  const r = genuineRevertMerge(dir, m, `rv-${distance}`, `PR2: revert at distance ${distance}`);
  return { dir, m, r };
}

test('blast radius — no intervening edit: genuine revert resolves', (t) => {
  const { dir, m, r } = blastTrial(t, null);
  assert.equal(r.conflict, false);
  const git = realGit(dir);
  assert.deepEqual(isResolvedAt(m, r.sha, { git }), { resolved: true });
});

test('blast radius — neighbor edit at distance 1 conflicts the revert itself (falls to the human gate)', (t) => {
  const { r } = blastTrial(t, 1);
  assert.equal(r.conflict, true);
});

test('blast radius — neighbor edit at distance 2 (within context) does NOT resolve', (t) => {
  const { dir, m, r } = blastTrial(t, 2);
  assert.equal(r.conflict, false);
  const git = realGit(dir);
  assert.deepEqual(isResolvedAt(m, r.sha, { git }), { resolved: false });
});

test('blast radius — neighbor edit at distance 4 (outside context) resolves normally', (t) => {
  const { dir, m, r } = blastTrial(t, 4);
  assert.equal(r.conflict, false);
  const git = realGit(dir);
  assert.deepEqual(isResolvedAt(m, r.sha, { git }), { resolved: true });
});

// ── isReverterOf — the reverter-skip (design §3.3) ──────────────────────────

test('isReverterOf — a genuine auto-revert is a reverter; a claim-only merge is not', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'docs/adr/0001-thing.md': '# ADR 1\n' }, 'M');
  const r = genuineRevertMerge(dir, m, 'rv', 'PR2: genuine auto-revert');
  assert.equal(r.conflict, false);
  const git = realGit(dir);

  assert.equal(isReverterOf(m, r.sha, { git }), true);

  // A merge that merely CLAIMS (via commit message) to revert M but has no
  // tree effect on M's own contribution.
  run(dir, 'checkout', '-b', 'rc', 'main');
  writeAndCommit(dir, 'other.txt', 'noise\n', `Rc: claims revert\n\nThis reverts commit ${m}.`);
  const rc = mergeIntoMain(dir, 'rc', 'PR3: claim-only merge');

  assert.equal(isReverterOf(m, rc, { git }), false);
});

// ── Checkpoint gate — violation-class → mechanism mapping (design §3.5) ────

// 2.4.1-equivalent: diffSize-shaped — a genuine revert resolves via the
// SAME predicate used for every class; there is no diffSize-specific
// branch.
test('diffSize-shaped offender — a genuine revert resolves via the same predicate (design §3.5 mechanism B)', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const big = `${Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n')}\n`;
  const m = mergeAddingPayload(dir, { 'big.txt': big }, 'M');
  const r = genuineRevertMerge(dir, m, 'rv', 'PR2: revert oversized offender');
  assert.equal(r.conflict, false);
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r.sha, { git }), { resolved: true });
});

// THE OWNER'S CASE — adrPresence forward-fix. M adds an ADR at path P. A
// LATER merge adds the missing brain/HOME.md at a DIFFERENT path Q, never
// touching P. Tree-effect (now diff-inversion) fails CLOSED forever: no
// merge's own contribution can ever equal pO, because none of them touch
// P at all. The ONLY path that clears M is the human gate
// (cursor.mjs accept, PR1) — outside resolution.mjs's concern by design.
test("owner's case — an adrPresence forward-fix (adds a DIFFERENT path) is NOT resolved, fails closed forever", (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'docs/adr/0002-thing.md': '# ADR 2\n' }, 'M');
  const forwardFix = mergeAddingPayload(dir, { 'brain/HOME.md': '# HOME\n' }, 'fix');
  const later = mergeAddingPayload(dir, { 'more.txt': 'later\n' }, 'later');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, forwardFix, { git }), { resolved: false });
  assert.deepEqual(isResolvedAt(m, later, { git }), { resolved: false });
});

// Design-intent assertion (no new code exercised) — enumerates the four
// violation classes brain-audit emits against the resolution mechanism each
// maps to, citing design §3.5's table, so a future reader sees the mapping
// is deliberate, not incidental.
test('violation-class -> resolution-mechanism mapping is deliberate (design §3.5)', () => {
  // Mechanisms per design §3.5:
  //   A = automatic re-evaluation (mutable input makes the check PASS)
  //   B = automatic diff-inversion skip (settled-by-revert; the ONLY use)
  //   C = human gate (accept --reason)
  //   D = exit-2 (uncomputable)
  const MECHANISMS_BY_CLASS = {
    diffSize: ['B', 'A', 'C'],
    issueLink: ['B', 'A', 'C'],
    adrPresence: ['B', 'C'], // revert ONLY — NO automatic forward-fix path
    memoryPresence: ['A'], // repo-global; re-eval ONLY, never tree-effect
  };

  assert.deepEqual(
    Object.keys(MECHANISMS_BY_CLASS).sort(),
    ['adrPresence', 'diffSize', 'issueLink', 'memoryPresence'],
    'exactly the four classes brain-audit emits (brain-audit.mjs:254-262)',
  );
  assert.equal(MECHANISMS_BY_CLASS.adrPresence.includes('A'), false);
  assert.equal(MECHANISMS_BY_CLASS.memoryPresence.includes('B'), false);
  const diffInversionClasses = Object.entries(MECHANISMS_BY_CLASS)
    .filter(([, m]) => m.includes('B')).map(([c]) => c).sort();
  assert.deepEqual(diffInversionClasses, ['adrPresence', 'diffSize', 'issueLink']);
});

// ── Drift guards ─────────────────────────────────────────────────────────

// The deleted discriminators must not exist anywhere in the postmerge
// SOURCE (non-test .mjs) — a mechanical trip-wire against the exact
// regression this module exists to prevent (design §3.0).
test('drift-guard — isRevertedInRange/findTrailerCandidates/trailerRegex are absent from postmerge source', () => {
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
// source. Tree-effect/diff-inversion reads no commit bodies at all.
test('drift-guard — no \\x1e/\\x1f framing constant exists in postmerge source', () => {
  const files = readdirSync(POSTMERGE_DIR).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'));
  for (const f of files) {
    const src = readFileSync(join(POSTMERGE_DIR, f), 'utf8');
    assert.equal(/\\x1[ef]/.test(src), false, `escaped \\x1e/\\x1f framing must not exist in ${f}`);
    assert.equal(/[\x1e\x1f]/.test(src), false, `raw \\x1e/\\x1f control byte must not exist in ${f}`);
  }
});

// ── MUTATION BAR — each test below reddens if the named guard is removed ───
// These are not hypothetical: every collision asserted "must NOT happen"
// here was empirically reproduced (in a throwaway scratch harness) by
// actually dropping the named flag/call and observing the predicate flip
// to a false positive. The comment on each test names the exact mutation.

// MUTATION: remove the `pO === ''` anti-vacuity guard (the first branch of
// isResolvedAt). Without it, an empty-diff offender's pO ('') would be
// compared against every candidate's reverse diff, including another,
// UNRELATED empty-diff merge later in the same range (also '') — a trivial
// match, falsely resolving an offender that never contributed anything.
test('MUTATION GUARD (F-1) — an empty-diff offender never matches an unrelated later empty-diff merge', (t) => {
  const dir = makeRepo(t);
  seedBase(dir);
  // M: an empty-effect merge (-s ours discards the feature branch's diff).
  run(dir, 'checkout', '-b', 'feat-empty');
  writeAndCommit(dir, 'sidecar.txt', 'side\n', 'feat work (discarded by -s ours)');
  run(dir, 'checkout', 'main');
  run(dir, 'merge', '--no-ff', '-s', 'ours', 'feat-empty', '-m', 'M: empty-effect merge');
  const m = headSha(dir);
  // A distinct, LATER empty-effect merge — also zero first-parent contribution.
  run(dir, 'checkout', '-b', 'feat-empty-2');
  writeAndCommit(dir, 'sidecar2.txt', 'side2\n', 'unrelated feat work (also discarded)');
  run(dir, 'checkout', 'main');
  run(dir, 'merge', '--no-ff', '-s', 'ours', 'feat-empty-2', '-m', 'N: unrelated empty-effect merge');
  const tip = headSha(dir);
  const git = realGit(dir);

  // WITH the guard: refused before the empty-vs-empty comparison is even
  // attempted (M's own pO is '', so the function returns immediately).
  assert.deepEqual(isResolvedAt(m, tip, { git }), { resolved: false, reason: 'offender has no first-parent contribution' });
});

// MUTATION: drop `--binary` from DIFF_ARGS. Without it, git's fallback for
// a binary-attributed/binary-content MODIFY is the content-blind stub
// "Binary files a/<path> and b/<path> differ" — IDENTICAL text for ANY two
// different binary payloads modifying the SAME path, collapsing a
// non-revert "evil" candidate onto the offender's own contribution.
// `--binary` is the load-bearing content/tree defense here (design §3.2) —
// this predicate is pure-read (no `hardenDiffRendering`/info-attributes
// write, judgment-round-1, engram #916/#921), so `--binary` alone is what
// stands between this attack and a false `resolved: true`. Behaviorally
// verified to redden on drop (see Definition of Done below).
test('MUTATION GUARD (--binary) — two different binary payloads at the same path never collapse to the content-blind stub', (t) => {
  const dir = makeRepo(t);
  writeAndCommit(dir, 'a.bin', Buffer.from([0x00, 0x6f, 0x72, 0x69, 0x67]), 'binary base');
  const m = mergeAddingPayload(dir, { 'a.bin': Buffer.from([0x00, 0x41, 0x41, 0x41]) }, 'M');
  run(dir, 'checkout', '-b', 'ev', 'main');
  writeFileSync(join(dir, 'a.bin'), Buffer.from([0x00, 0x42, 0x42, 0x42]));
  run(dir, 'add', 'a.bin');
  run(dir, 'commit', '-m', 'ev: different binary payload, not a real revert');
  const r = mergeIntoMain(dir, 'ev', 'PR2: binary stub-collapse attempt');
  const git = realGit(dir);

  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
});

// MUTATION: drop BOTH `--no-renames` AND `diff.renames=false` (git's
// default is renames=true, so only dropping the PAIR re-enables rename
// detection; dropping either one alone leaves renames off and stays green).
// A PURE
// rename (100% similarity, no content modification in the SAME commit)
// renders as "similarity index 100%\nrename from X\nrename to Y" with
// ZERO content bytes — self-consistent regardless of what the actual bytes
// are. An offender that is itself a pure rename, followed by tampering the
// content IN PLACE, followed by a "reverter" that pure-renames the
// (now-tampered) file back to the original path collapses to the SAME
// zero-content rename text as the offender's own contribution — laundering
// tampered content through a name-only match, exactly the class of bypass
// (#916) this module exists to close.
test('MUTATION GUARD (--no-renames) — a 100%-similarity rename never launders tampered content', (t) => {
  const dir = makeRepo(t);
  mkdirSync(join(dir, 'templates'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'adr'), { recursive: true });
  writeAndCommit(dir, 'templates/adr-template.md', 'ORIGINAL_CONTENT_C\n', 'base');

  // M: a PURE rename (the violation is the relocation itself), content C unchanged.
  run(dir, 'checkout', '-b', 'f');
  run(dir, 'mv', 'templates/adr-template.md', 'docs/adr/0099-secret.md');
  run(dir, 'commit', '-m', 'o: pure rename (the violation)');
  const m = mergeIntoMain(dir, 'f', 'PR1: pure rename offender');

  // Tamper: an ordinary commit corrupts the content IN PLACE (C -> D).
  writeAndCommit(dir, 'docs/adr/0099-secret.md', 'TAMPERED_CONTENT_D\n', 'tamper: corrupt content in place');

  // Attacker's fake reverter: a PURE rename back, content D left UNCHANGED
  // (never restored to C) — still 100% self-similar within this commit.
  run(dir, 'checkout', '-b', 'ev', 'main');
  mkdirSync(join(dir, 'templates'), { recursive: true });
  run(dir, 'mv', 'docs/adr/0099-secret.md', 'templates/adr-template.md');
  run(dir, 'commit', '-m', 'ev: pure rename back, content NOT restored');
  const r = mergeIntoMain(dir, 'ev', 'PR2: rename-back launder attempt');
  const git = realGit(dir);

  // WITHOUT --no-renames, BOTH M's own contribution and R's reverse
  // contribution render as "similarity index 100%\nrename from ... to ...\n"
  // with ZERO content — byte-identical regardless of C vs D, and this
  // assertion FAILS.
  assert.deepEqual(isResolvedAt(m, r, { git }), { resolved: false });
});

// ── HOSTILE-ENV ROBUSTNESS (ports forge_forkb3.mjs) — the verdict must be
// INDEPENDENT of the ambient git config of the machine the predicate runs
// on, not merely "defended by one specific flag". Runs the FULL public API
// (`isResolvedAt`) under an adversarial `GIT_CONFIG_GLOBAL`: a hostile
// textconv driver + `diff.external` + a global attributesFile (both
// referencing a helper that collapses content to a constant string) +
// `diff.algorithm=histogram`, with `GIT_CONFIG_SYSTEM=/dev/null` so no real
// system config leaks in. `--binary` (plus the other pinned flags) must
// still: (a) let a genuine revert resolve true (liveness) and (b) refuse a
// content-launder (safety) — replacing the deleted tautologies (a source
// grep for `--binary`, a direct `.git/info/attributes` content assertion)
// with an honest behavioral proof that the verdict does not depend on the
// environment (design §3.2, the CP-PR1/B6 "green that depends on the
// environment" failure class). Liveness and safety are asserted in TWO
// separate repos/offenders (not one shared history) — a genuine revert
// commit that lands before a later, unrelated launder merge would
// otherwise fall inside the ALREADY-resolved `(offender, tip]` range and
// make the launder assertion vacuously pass for the wrong reason.
function withHostileEnv(dir, t) {
  const helper = join(dir, 'constant.sh');
  writeFileSync(helper, '#!/bin/sh\necho COLLAPSED\n');
  spawnSync('chmod', ['+x', helper]);
  const globalAttrsPath = join(dir, 'hostile.attributes');
  writeFileSync(globalAttrsPath, '*.md diff=hide\n*.bin diff=hide\n');
  const hostileConfigPath = join(dir, 'hostile.gitconfig');
  writeFileSync(hostileConfigPath, [
    '[diff "hide"]',
    `\ttextconv = ${helper}`,
    '[diff]',
    `\texternal = ${helper}`,
    '\talgorithm = histogram',
    '[core]',
    `\tattributesFile = ${globalAttrsPath}`,
  ].join('\n'));

  const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
  const savedSystem = process.env.GIT_CONFIG_SYSTEM;
  process.env.GIT_CONFIG_GLOBAL = hostileConfigPath;
  process.env.GIT_CONFIG_SYSTEM = '/dev/null';
  t.after(() => {
    if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
    if (savedSystem === undefined) delete process.env.GIT_CONFIG_SYSTEM;
    else process.env.GIT_CONFIG_SYSTEM = savedSystem;
  });
}

test('HOSTILE-ENV ROBUSTNESS — liveness: a genuine revert still resolves under adversarial ambient git config (forge_forkb3)', (t) => {
  const dir = makeRepo(t);
  withHostileEnv(dir, t);

  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'secret.md': 'PAYLOAD_AAA\n' }, 'M');
  const genuine = genuineRevertMerge(dir, m, 'rv', 'PR2: genuine revert under hostile ambient config');
  assert.equal(genuine.conflict, false);
  const git = realGit(dir);

  assert.deepEqual(
    isResolvedAt(m, genuine.sha, { git }),
    { resolved: true },
    'liveness: a genuine revert must still resolve under a hostile ambient git config',
  );
});

test('HOSTILE-ENV ROBUSTNESS — safety: a content-launder is still refused under adversarial ambient git config (forge_forkb3)', (t) => {
  const dir = makeRepo(t);
  withHostileEnv(dir, t);

  seedBase(dir);
  const m = mergeAddingPayload(dir, { 'secret.md': 'PAYLOAD_AAA\n' }, 'M');
  run(dir, 'checkout', '-b', 'ev', 'main');
  writeFileSync(join(dir, 'secret.md'), 'PAYLOAD_BBB\n');
  run(dir, 'add', 'secret.md');
  run(dir, 'commit', '-m', 'ev: different content, not a real revert');
  const launder = mergeIntoMain(dir, 'ev', 'PR2: content-launder attempt under hostile ambient config');
  const git = realGit(dir);

  assert.deepEqual(
    isResolvedAt(m, launder, { git }),
    { resolved: false },
    'safety: a content-launder must still be refused under a hostile ambient git config',
  );
});
