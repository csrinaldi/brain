import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sh = (d, c) => execFileSync('bash', ['-c', c], { cwd: d, encoding: 'utf8' });
const shOk = (d, c) => { try { sh(d, c); return true; } catch { return false; } };
const rev = (d, r) => sh(d, `git rev-parse ${r}`).trim();
const HARD = `git -c diff.algorithm=myers -c diff.renames=false -c core.attributesFile=/dev/null diff --no-textconv --no-ext-diff --no-renames --binary -U3`;
const strip = (raw) => raw.split('\n').filter(l => !/^@@ /.test(l) && !/^index /.test(l)).join('\n');
const nd = (d, a, b) => strip(sh(d, `${HARD} ${a} ${b}`));

function trial(dist) {
  const d = mkdtempSync(join(tmpdir(), 'bl-'));
  sh(d, 'git init -q -b main && git config user.email a@b.c && git config user.name t && git config commit.gpgsign false');
  const N = 60, P = 30;
  const mk = (arr) => arr.join('\\n') + '\\n';
  const base = Array.from({length: N}, (_, i) => `line_${i}`);
  sh(d, `printf '${mk(base)}' > f.txt && git add -A && git commit -q -m base`);
  const off = [...base]; off[P-1] = 'line_PAYLOAD';
  sh(d, `git checkout -q -b feat && printf '${mk(off)}' > f.txt && git add -A && git commit -q -m o`);
  sh(d, 'git checkout -q main && git merge --no-ff -q -m PR1 feat'); const O = rev(d, 'HEAD');
  if (dist !== null) { const iv = [...off]; iv[P-1-dist] = 'line_NEIGHBOR'; sh(d, `printf '${mk(iv)}' > f.txt && git add -A && git commit -q -m neighbor`); }
  const ok = shOk(d, `git checkout -q -b rv main && git revert -m 1 --no-edit ${O}`);
  if (!ok) { rmSync(d, { recursive: true, force: true }); return 'REVERT-CONFLICT (→ human gate)'; }
  sh(d, 'git checkout -q main && git merge --no-ff -q -m PR2 rv'); const R = rev(d, 'HEAD');
  const resolved = nd(d, `${O}^1`, O) !== '' && nd(d, R, `${R}^1`) === nd(d, `${O}^1`, O);
  rmSync(d, { recursive: true, force: true });
  return resolved ? 'resolved (auto)' : 'NOT resolved (→ human gate)';
}
console.log('offender edits 1 line; intervening neighbor edit at distance d; context=U3:');
console.log(`  no intervening edit   : ${trial(null)}`);
for (const dist of [1,2,3,4,5,6,7,8]) console.log(`  neighbor at distance ${dist} : ${trial(dist)}`);
