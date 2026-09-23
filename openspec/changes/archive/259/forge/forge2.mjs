// forge2 — validate Option 1 (whole-commit first-parent diff-inversion, fail-closed)
// on REAL brain topology: PRs merged with --merge (offender & reverter are MERGE COMMITS).
// Measures C1 (first-parent diff) and C2 (D2's own `git revert -m 1` loop closes) end-to-end.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function sh(cwd, cmd) { return execFileSync('bash', ['-c', cmd], { cwd, encoding: 'utf8' }); }
function rev(dir, r) { return sh(dir, `git rev-parse ${r}`).trim(); }

function newRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'forge2-'));
  sh(dir, 'git init -q -b main && git config user.email a@b.c && git config user.name t && git config commit.gpgsign false');
  sh(dir, 'echo base > README.md && git add -A && git commit -q -m base');
  return dir;
}
// Merge a PR branch into main the way brain does: --no-ff (a real merge commit).
function mergePR(dir, branch, msg) {
  sh(dir, `git checkout -q main && git merge --no-ff -q -m "${msg}" ${branch}`);
  return rev(dir, 'HEAD');
}

// ---- candidate predicate ----
// first-parent contribution of X, as a full patch
function fpPatch(dir, x, { stripIndex }) {
  const raw = sh(dir, `git diff ${x}^1 ${x}`);
  return normalize(raw, { stripIndex });
}
// inverse "view" of R's contribution: diff(R, R^1) == ¬diff(R^1,R)
function fpPatchInverse(dir, r, { stripIndex }) {
  const raw = sh(dir, `git diff ${r} ${r}^1`);
  return normalize(raw, { stripIndex });
}
function normalize(patch, { stripIndex }) {
  return patch.split('\n').filter(l => {
    if (/^@@ /.test(l)) return false;            // C3: strip hunk position headers ALWAYS
    if (stripIndex && /^index /.test(l)) return false; // relaxation under test
    return true;
  }).map(l => l.replace(/^@@.*$/, '@@')).join('\n');
}
// whole-commit first-parent inversion: is R an exact inverse of O?
function isInverse(dir, O, R, opts) {
  return fpPatch(dir, O, opts) === fpPatchInverse(dir, R, opts);
}
// git-native primitive: patch-id is stable across offset shifts by design.
function patchId(dir, cmd) {
  const out = sh(dir, `git diff ${cmd} | git patch-id --stable`).trim();
  return out.split(/\s+/)[0] || '';   // '' when diff empty
}
// resolved iff patch-id(O^1..O) == patch-id(R..R^1)  (R's inverse view)
function isInverseByPatchId(dir, O, R) {
  const a = patchId(dir, `${O}^1 ${O}`);
  const b = patchId(dir, `${R} ${R}^1`);
  return a !== '' && a === b;
}
function payloadSurvives(dir, r, needle) {
  try { sh(dir, `git grep -q "${needle}" ${r}`); return true; } catch { return false; }
}

function scenario(label, build, { needle = 'SECRET_PAYLOAD', stripIndex = false } = {}) {
  const dir = newRepo();
  const { O, R, tip } = build(dir);
  const showCombined = sh(dir, `git show --format= ${O}`).trim(); // -c/--cc combined merge diff
  const fpNonEmpty = fpPatch(dir, O, { stripIndex }).trim().length > 0;
  const inv = R ? isInverse(dir, O, R, { stripIndex }) : null;
  const invPid = R ? isInverseByPatchId(dir, O, R) : null;
  const survives = payloadSurvives(dir, tip, needle);
  console.log(`\n=== ${label} ===`);
  console.log(`  O is merge commit             : ${sh(dir,`git rev-list --parents -n1 ${O}`).trim().split(' ').length - 1} parents`);
  console.log(`  git show O (combined) empty?  : ${showCombined.length === 0 ? 'YES (clean merge → combined diff VACÍO)' : 'no'}`);
  console.log(`  first-parent diff(O) non-empty: ${fpNonEmpty ? 'YES (C1: O^1..O recovers the payload)' : 'NO'}`);
  if (R) console.log(`  inversion by my-normalize     : resolved=${inv}${stripIndex ? ' [stripIndex]' : ''}`);
  if (R) console.log(`  inversion by git patch-id     : resolved=${invPid}  <-- git-native`);
  console.log(`  payload on disk @tip          : ${survives ? 'YES' : 'no'}`);
  rmSync(dir, { recursive: true, force: true });
  return { inv, survives };
}

// ---------- C2: the REAL D2 loop, merge topology ----------
scenario('C2. REAL D2 LOOP: offender merge → git revert -m 1 → revert PR merged --merge', (dir) => {
  sh(dir, 'git checkout -q -b feat/payload && echo SECRET_PAYLOAD > payload.md && git add -A && git commit -q -m "feat: add payload"');
  const O = mergePR(dir, 'feat/payload', 'Merge PR #1: payload');   // offender = merge commit
  // CI: git revert -m 1 <offender> on a revert branch, then merge that PR with --merge
  sh(dir, `git checkout -q -b auto-revert/O main && git revert -m 1 --no-edit ${O}`);
  const R = mergePR(dir, 'auto-revert/O', 'Merge PR #2: revert offender'); // reverter = merge commit
  return { O, R, tip: rev(dir, 'HEAD') };
});

// ---------- A: pure rename launder, merge topology ----------
scenario('A. PURE RENAME launder (merge topology)', (dir) => {
  sh(dir, 'git checkout -q -b feat/payload && echo SECRET_PAYLOAD > payload.md && git add -A && git commit -q -m "feat: add payload"');
  const O = mergePR(dir, 'feat/payload', 'Merge PR #1: payload');
  sh(dir, 'git checkout -q -b refactor/rename main && git mv payload.md relocated.md && git commit -q -m "refactor: rename"');
  const R = mergePR(dir, 'refactor/rename', 'Merge PR #2: rename');
  return { O, R, tip: rev(dir, 'HEAD') };
});

// ---------- B: rename + one byte, merge topology ----------
scenario('B. RENAME+MODIFY launder (merge topology)', (dir) => {
  sh(dir, 'git checkout -q -b feat/payload && printf "SECRET_PAYLOAD\\n" > payload.md && git add -A && git commit -q -m "feat: add payload"');
  const O = mergePR(dir, 'feat/payload', 'Merge PR #1: payload');
  sh(dir, 'git checkout -q -b refactor/rn main && git mv payload.md relocated.md && printf "SECRET_PAYLOAD\\n# note\\n" > relocated.md && git add -A && git commit -q -m "refactor: rename+comment"');
  const R = mergePR(dir, 'refactor/rn', 'Merge PR #2: rename+modify');
  return { O, R, tip: rev(dir, 'HEAD') };
});

// ---------- HUNK-DRIFT: revert AFTER an intervening commit shifts line numbers ----------
// O modifies an existing file; an unrelated commit inserts lines ABOVE the payload,
// shifting offsets; THEN the revert lands. Tests whether @@-normalization keeps the
// real revert recognized (liveness) — and whether index-line stripping is needed.
function driftScenario(stripIndex) {
  scenario(`DRIFT. revert after offset shift (stripIndex=${stripIndex})`, (dir) => {
    // seed an existing file the offender will edit
    sh(dir, 'printf "L1\\nL2\\nL3\\n" > code.txt && git add -A && git commit -q -m seed');
    sh(dir, 'git checkout -q -b feat/edit && printf "L1\\nL2\\nL3\\nSECRET_PAYLOAD\\n" > code.txt && git add -A && git commit -q -m "feat: append payload line"');
    const O = mergePR(dir, 'feat/edit', 'Merge PR #1: edit');
    // intervening unrelated commit that shifts line numbers (insert at top)
    sh(dir, 'git checkout -q main && printf "TOP\\nL1\\nL2\\nL3\\nSECRET_PAYLOAD\\n" > code.txt && git add -A && git commit -q -m "chore: prepend header"');
    // now revert the offender via -m 1 on a PR branch, merged --merge
    sh(dir, `git checkout -q -b auto-revert/O main && git revert -m 1 --no-edit ${O}`);
    const R = mergePR(dir, 'auto-revert/O', 'Merge PR #3: revert');
    return { O, R, tip: rev(dir, 'HEAD') };
  }, { stripIndex });
}
driftScenario(false);
driftScenario(true);
