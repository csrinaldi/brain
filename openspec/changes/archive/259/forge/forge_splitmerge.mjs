// Close the T4/T5 gap the design agent flagged: split-one-into-two and merge-two-into-one
// as laundering vectors, on merge topology. Predicate MUST fail closed (NOT resolved) with payload alive.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sh = (d, c) => execFileSync('bash', ['-c', c], { cwd: d, encoding: 'utf8' });
const rev = (d, r) => sh(d, `git rev-parse ${r}`).trim();
function repo(seed = 'echo base > README.md') { const d = mkdtempSync(join(tmpdir(), 'sm-')); sh(d, `git init -q -b main && git config user.email a@b.c && git config user.name t && git config commit.gpgsign false && ${seed} && git add -A && git commit -q -m base`); return d; }
const merge = (d, b, m) => { sh(d, `git checkout -q main && git merge --no-ff -q -m "${m}" ${b}`); return rev(d, 'HEAD'); };
const HARD = `git -c diff.algorithm=myers -c diff.renames=false -c core.attributesFile=/dev/null diff --no-textconv --no-ext-diff --no-renames --binary -U3`;
const nd = (d, a, b) => sh(d, `${HARD} ${a} ${b}`).split('\n').filter(l => !/^@@ /.test(l) && !/^index /.test(l)).join('\n');
function resolved(d, O, Rlist) { const pO = nd(d, `${O}^1`, O); if (pO.trim() === '') return false; return Rlist.some(R => nd(d, R, `${R}^1`) === pO); }
const survives = (d, r, n) => { try { sh(d, `git grep -qa "${n}" ${r}`); return true; } catch { return false; } };

// T4 — SPLIT: offender adds one file with two payload lines; "resolver" splits it into two files.
{ const d = repo();
  sh(d, 'git checkout -q -b f && printf "SECRET_ONE\\nSECRET_TWO\\n" > p.md && git add -A && git commit -q -m o'); const O = merge(d, 'f', 'PR1');
  sh(d, 'git checkout -q -b sp main && printf "SECRET_ONE\\n" > p1.md && printf "SECRET_TWO\\n" > p2.md && git rm -q p.md && git add -A && git commit -q -m split'); const R = merge(d, 'sp', 'PR2');
  console.log(`T4 SPLIT one→two : resolved=${resolved(d, O, [R])} (want false)  payload survives=${survives(d, R, 'SECRET_ONE') && survives(d, R, 'SECRET_TWO')}`);
  rmSync(d, { recursive: true, force: true }); }

// T5 — MERGE FILES: offender adds payload file; a later commit merges it into an existing file (content survives).
{ const d = repo('printf "HOST\\n" > host.md && git add -A');
  sh(d, 'git checkout -q -b f && printf "SECRET_PAYLOAD\\n" > p.md && git add -A && git commit -q -m o'); const O = merge(d, 'f', 'PR1');
  sh(d, 'git checkout -q -b mg main && printf "HOST\\nSECRET_PAYLOAD\\n" > host.md && git rm -q p.md && git add -A && git commit -q -m mergefiles'); const R = merge(d, 'mg', 'PR2');
  console.log(`T5 MERGE two→one : resolved=${resolved(d, O, [R])} (want false)  payload survives=${survives(d, R, 'SECRET_PAYLOAD')}`);
  rmSync(d, { recursive: true, force: true }); }

// T6 — EQUIVALENT REWRITE: offender adds payload; resolver "rewrites" to semantically-equivalent different bytes.
{ const d = repo();
  sh(d, 'git checkout -q -b f && printf "value = 42\\n" > cfg.md && git add -A && git commit -q -m o'); const O = merge(d, 'f', 'PR1');
  sh(d, 'git checkout -q -b rw main && printf "value=42 # same\\n" > cfg.md && git add -A && git commit -q -m rewrite'); const R = merge(d, 'rw', 'PR2');
  console.log(`T6 EQUIV REWRITE : resolved=${resolved(d, O, [R])} (want false)  payload survives=${survives(d, R, '42')}`);
  rmSync(d, { recursive: true, force: true }); }
