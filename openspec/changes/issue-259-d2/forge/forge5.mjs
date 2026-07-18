// forge5 (clean) — F-2 modify→modify of a PRE-EXISTING binary, two independent repos.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sh = (d, c) => execFileSync('bash', ['-c', c], { cwd: d, encoding: 'utf8' });
const rev = (d, r) => sh(d, `git rev-parse ${r}`).trim();
function repo() { const d = mkdtempSync(join(tmpdir(), 'f5-')); sh(d, 'git init -q -b main && git config user.email a@b.c && git config user.name t && git config commit.gpgsign false && printf "BIN\\x00\\x01original\\x00" > a.bin && git add -A && git commit -q -m base'); return d; }
const merge = (d, b, m) => { sh(d, `git checkout -q main && git merge --no-ff -q -m "${m}" ${b}`); return rev(d, 'HEAD'); };
const pidOf = (d, a, b, bin) => (sh(d, `git diff ${bin ? '--binary ' : ''}${a} ${b} | git patch-id --stable`).trim().split(/\s+/)[0] || '');

// ---- Repo A: fail-open probe (evil modification masquerading as revert) ----
const A = repo();
sh(A, `git checkout -q -b feat/o && printf 'BIN\\x00\\x01payloadAAA\\x00' > a.bin && git add -A && git commit -q -m o`);
const OA = merge(A, 'feat/o', 'PR1 offender');
sh(A, `git checkout -q -b feat/evil main && printf 'BIN\\x00\\x01payloadBBB\\x00' > a.bin && git add -A && git commit -q -m evil`);
const Revil = merge(A, 'feat/evil', 'PR2 evil-modify');
const diffLine = sh(A, `git diff ${OA}^1 ${OA}`).split('\n').find(l => /Binary|differ/.test(l));
console.log(`git diff (no --binary) of offender bin: ${JSON.stringify(diffLine)}\n`);
for (const bin of [false, true]) {
  const pO = pidOf(A, `${OA}^1`, OA, bin);
  const pEvil = pidOf(A, Revil, `${Revil}^1`, bin);
  const open = pO !== '' && pO === pEvil;
  console.log(`  --binary=${bin}: EVIL crowned reverter of O? ${open}  ${open ? '← FAIL-OPEN (diff carries no content)' : '✓ fail-closed'}`);
}
rmSync(A, { recursive: true, force: true });

// ---- Repo B: liveness — a genuine binary revert must still resolve WITH --binary ----
const B = repo();
sh(B, `git checkout -q -b feat/o && printf 'BIN\\x00\\x01payloadAAA\\x00' > a.bin && git add -A && git commit -q -m o`);
const OB = merge(B, 'feat/o', 'PR1 offender');
sh(B, `git checkout -q -b auto-revert/o main && git revert -m 1 --no-edit ${OB}`);
const Rtrue = merge(B, 'auto-revert/o', 'PR2 true revert');
console.log('');
for (const bin of [false, true]) {
  const pO = pidOf(B, `${OB}^1`, OB, bin);
  const pTrue = pidOf(B, Rtrue, `${Rtrue}^1`, bin);
  const live = pO !== '' && pO === pTrue;
  console.log(`  --binary=${bin}: TRUE binary revert recognized? ${live}  ${live ? '✓ liveness OK' : '← liveness broken (→ human gate)'}`);
}
const payloadGone = (() => { try { sh(B, `git grep -qa "payloadAAA" ${Rtrue}`); return false; } catch { return true; } })();
console.log(`  payload gone at tip after true revert: ${payloadGone}`);
rmSync(B, { recursive: true, force: true });
