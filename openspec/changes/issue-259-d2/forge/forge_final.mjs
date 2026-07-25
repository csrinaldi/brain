// forge_final — the CHOSEN mechanism validated against every case at once.
// Mechanism: whitespace-EXACT, position-tolerant normalized diff over `git diff --binary`.
//   normDiff(a,b) = git diff --binary a b, drop lines /^@@ / (position) and /^index / (blob id),
//                   keep everything else byte-exact (paths, modes, +/- content incl. whitespace, binary blocks).
//   resolved(O,tip) ⟺ normDiff(O^1,O) non-empty AND ∃ fp-merge R∈(O,tip]: normDiff(R,R^1)==normDiff(O^1,O)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sh = (d, c) => execFileSync('bash', ['-c', c], { cwd: d, encoding: 'utf8' });
const rev = (d, r) => sh(d, `git rev-parse ${r}`).trim();
function repo(seed = 'echo base > README.md') { const d = mkdtempSync(join(tmpdir(), 'ff-')); sh(d, `git init -q -b main && git config user.email a@b.c && git config user.name t && git config commit.gpgsign false && ${seed} && git add -A && git commit -q -m base`); return d; }
const merge = (d, b, m) => { sh(d, `git checkout -q main && git merge --no-ff -q -m "${m}" ${b}`); return rev(d, 'HEAD'); };
function normDiff(d, a, b) {
  const raw = sh(d, `git diff --binary ${a} ${b}`);
  return raw.split('\n').filter(l => !/^@@ /.test(l) && !/^index /.test(l)).join('\n');
}
const nd = (d, a, b) => normDiff(d, a, b);
function resolved(d, O, Rlist) {
  const pO = nd(d, `${O}^1`, O);
  if (pO.trim() === '') return false;                         // F-1 anti-vacuity
  return Rlist.some(R => nd(d, R, `${R}^1`) === pO);
}
const survives = (d, r, n) => { try { sh(d, `git grep -qa "${n}" ${r}`); return true; } catch { return false; } };
const results = [];
function check(name, got, want, note = '') { const ok = got === want; results.push({ name, got, want, ok, note }); }

// 1. C2 real D2 loop
{ const d = repo();
  sh(d, 'git checkout -q -b f && echo SECRET_PAYLOAD > p.md && git add -A && git commit -q -m o'); const O = merge(d, 'f', 'PR1');
  sh(d, `git checkout -q -b rv main && git revert -m 1 --no-edit ${O}`); const R = merge(d, 'rv', 'PR2');
  check('C2 real D2 revert loop', resolved(d, O, [R]), true, `payload gone=${!survives(d, R, 'SECRET_PAYLOAD')}`); rmSync(d, { recursive: true, force: true }); }
// 2. pure rename
{ const d = repo();
  sh(d, 'git checkout -q -b f && echo SECRET_PAYLOAD > p.md && git add -A && git commit -q -m o'); const O = merge(d, 'f', 'PR1');
  sh(d, 'git checkout -q -b rn main && git mv p.md q.md && git commit -q -m rn'); const R = merge(d, 'rn', 'PR2');
  check('A pure rename', resolved(d, O, [R]), false, `payload survives=${survives(d, R, 'SECRET_PAYLOAD')}`); rmSync(d, { recursive: true, force: true }); }
// 3. rename+modify
{ const d = repo();
  sh(d, 'git checkout -q -b f && printf "SECRET_PAYLOAD\\n" > p.md && git add -A && git commit -q -m o'); const O = merge(d, 'f', 'PR1');
  sh(d, 'git checkout -q -b rn main && git mv p.md q.md && printf "SECRET_PAYLOAD\\n#x\\n" > q.md && git add -A && git commit -q -m rnm'); const R = merge(d, 'rn', 'PR2');
  check('B rename+modify', resolved(d, O, [R]), false, `payload survives=${survives(d, R, 'SECRET_PAYLOAD')}`); rmSync(d, { recursive: true, force: true }); }
// 4. copy launder
{ const d = repo();
  sh(d, 'git checkout -q -b f && echo SECRET_PAYLOAD > p.md && git add -A && git commit -q -m o'); const O = merge(d, 'f', 'PR1');
  sh(d, 'git checkout -q -b cp main && cp p.md keep.md && git rm -q p.md && git add -A && git commit -q -m cp'); const R = merge(d, 'cp', 'PR2');
  check('copy launder', resolved(d, O, [R]), false, `payload survives=${survives(d, R, 'SECRET_PAYLOAD')}`); rmSync(d, { recursive: true, force: true }); }
// 5. partial revert (2 files, 1 reverted)
{ const d = repo();
  sh(d, 'git checkout -q -b f && echo SEC_A > a.md && echo SEC_B > b.md && git add -A && git commit -q -m o'); const O = merge(d, 'f', 'PR1');
  sh(d, 'git checkout -q -b pr main && git rm -q a.md && git commit -q -m parta'); const R = merge(d, 'pr', 'PR2');
  check('partial revert', resolved(d, O, [R]), false, `b survives=${survives(d, R, 'SEC_B')}`); rmSync(d, { recursive: true, force: true }); }
// 6. invert + extra damage
{ const d = repo();
  sh(d, 'git checkout -q -b f && echo SEC_A > a.md && git add -A && git commit -q -m o'); const O = merge(d, 'f', 'PR1');
  sh(d, 'git checkout -q -b ie main && git rm -q a.md && echo EVIL > evil.md && git add -A && git commit -q -m ie'); const R = merge(d, 'ie', 'PR2');
  check('invert+extra', resolved(d, O, [R]), false, `evil=${survives(d, R, 'EVIL')}`); rmSync(d, { recursive: true, force: true }); }
// 7. drift liveness (intervening commit shifts offsets)
{ const d = repo('printf "L1\\nL2\\nL3\\n" > c.txt');
  sh(d, 'git checkout -q -b f && printf "L1\\nL2\\nL3\\nSECRET_PAYLOAD\\n" > c.txt && git add -A && git commit -q -m o'); const O = merge(d, 'f', 'PR1');
  sh(d, 'git checkout -q main && printf "TOP\\nL1\\nL2\\nL3\\nSECRET_PAYLOAD\\n" > c.txt && git add -A && git commit -q -m shift');
  sh(d, `git checkout -q -b rv main && git revert -m 1 --no-edit ${O}`); const R = merge(d, 'rv', 'PR2');
  check('drift liveness', resolved(d, O, [R]), true, `payload gone=${!survives(d, R, 'SECRET_PAYLOAD')}`); rmSync(d, { recursive: true, force: true }); }
// 8. F-1 vacuity (empty/no-op offender)
{ const d = repo();
  sh(d, 'git checkout -q -b f && git commit -q --allow-empty -m noop'); const O = merge(d, 'f', 'PR1 empty');
  check('F-1 empty offender', resolved(d, O, [O]), false, 'must fail closed'); rmSync(d, { recursive: true, force: true }); }
// 9. F-2 binary evil vs true revert
{ const d = repo("printf 'BIN\\x00orig\\x00' > a.bin");
  sh(d, `git checkout -q -b f && printf 'BIN\\x00AAA\\x00' > a.bin && git add -A && git commit -q -m o`); const O = merge(d, 'f', 'PR1');
  sh(d, `git checkout -q -b ev main && printf 'BIN\\x00BBB\\x00' > a.bin && git add -A && git commit -q -m ev`); const Rev = merge(d, 'ev', 'PR2');
  check('F-2 binary evil-modify', resolved(d, O, [Rev]), false, 'different binary payload'); rmSync(d, { recursive: true, force: true }); }
{ const d = repo("printf 'BIN\\x00orig\\x00' > a.bin");
  sh(d, `git checkout -q -b f && printf 'BIN\\x00AAA\\x00' > a.bin && git add -A && git commit -q -m o`); const O = merge(d, 'f', 'PR1');
  sh(d, `git checkout -q -b rv main && git revert -m 1 --no-edit ${O}`); const Rt = merge(d, 'rv', 'PR2');
  check('F-2 binary true revert', resolved(d, O, [Rt]), true, 'liveness'); rmSync(d, { recursive: true, force: true }); }
// 10. whitespace sensitivity: normDiff must DISTINGUISH indentation
{ const d = repo('printf "x\\ny\\n" > w.txt');
  sh(d, 'git checkout -q -b a && printf "x\\nPAY\\ny\\n" > w.txt && git add -A && git commit -q -m a'); const ca = rev(d, 'HEAD');
  sh(d, 'git checkout -q -b b main && printf "x\\n    PAY\\ny\\n" > w.txt && git add -A && git commit -q -m b'); const cb = rev(d, 'HEAD');
  const same = nd(d, `${ca}^1`, ca) === nd(d, `${cb}^1`, cb);
  check('whitespace-exact (indent distinguished)', same, false, 'indent 0 vs 4 must NOT collide'); rmSync(d, { recursive: true, force: true }); }

console.log('CASE'.padEnd(38), 'GOT'.padEnd(7), 'WANT'.padEnd(7), 'OK   NOTE');
for (const r of results) console.log(String(r.name).padEnd(38), String(r.got).padEnd(7), String(r.want).padEnd(7), (r.ok ? ' ✓  ' : ' ✗✗ '), r.note);
console.log(`\n${results.every(r => r.ok) ? 'ALL PASS — mechanism validated' : 'FAILURES PRESENT'}`);
