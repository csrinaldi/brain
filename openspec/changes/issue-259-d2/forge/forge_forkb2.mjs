// FORK B v2 — isolate whether --no-textconv / --no-ext-diff are load-bearing GIVEN --binary,
// or only without it. Also confirm the hostile driver is actually active (raw render probe).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
function sh(dir, cmd, env = {}) { return execFileSync('bash', ['-c', cmd], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } }); }
const strip = (raw) => raw.split('\n').filter(l => !/^@@ /.test(l) && !/^index /.test(l)).join('\n');
function rev(d, r, env) { return sh(d, `git rev-parse ${r}`, env).trim(); }
function newRepo() { const d = mkdtempSync(join(tmpdir(), 'fb2-')); sh(d, 'git init -q -b main && git config user.email a@b.c && git config user.name t && git config commit.gpgsign false && echo seed > seed.txt && git add -A && git commit -q -m seed'); return d; }
function hostileEnv(dir, text) { const p = join(dir, 'h.gitconfig'); writeFileSync(p, text); return { GIT_CONFIG_GLOBAL: p, GIT_CONFIG_SYSTEM: '/dev/null' }; }
function diff(dir, a, b, extraFlags, env) {
  const argv = ['git','-c','diff.algorithm=myers','-c','diff.renames=false','-c','core.attributesFile=/dev/null','diff', ...extraFlags,'--no-renames','-U3', a, b].map(x=>`'${x}'`).join(' ');
  return strip(sh(dir, argv, env));
}
// does the diff DISTINGUISH content A from content B under these flags?
function distinguishes(dir, A, B, extraFlags, env) {
  return diff(dir, `${A}^1`, A, extraFlags, env) !== diff(dir, `${B}^1`, B, extraFlags, env);
}

function setup(driverCfg, attrsLine, ext = 'md') {
  const d = newRepo();
  const helper = join(d, 'constant.sh'); writeFileSync(helper, '#!/bin/sh\necho COLLAPSED\n'); chmodSync(helper, 0o755);
  const env = hostileEnv(d, driverCfg(helper));
  if (attrsLine) sh(d, `printf '${attrsLine}\\n' > .gitattributes && git add -A && git commit -q -m attrs`, env);
  sh(d, `printf 'PAYLOAD_AAA\\n' > p.${ext} && git add -A && git commit -q -m a`, env); const A = rev(d,'HEAD',env);
  sh(d, `printf 'PAYLOAD_BBB\\n' > p.${ext} && git add -A && git commit -q -m b`, env); const B = rev(d,'HEAD',env);
  return { d, env, A, B, helper };
}

console.log('== --no-textconv ==');
{
  const { d, env, A, B } = setup(h => `[diff "hide"]\n\ttextconv = ${h}\n`, '*.md diff=hide');
  // raw probe: is textconv even active on a plain diff (no --binary, no --no-textconv)?
  const raw = diff(d, `${A}^1`, A, [], env);
  console.log(`  raw plain diff shows: ${JSON.stringify(raw.split('\n').find(l=>/COLLAPSED|PAYLOAD/.test(l)) || '(none)')}`);
  console.log(`  distinguishes  [--binary --no-textconv]: ${distinguishes(d,A,B,['--binary','--no-textconv'],env)}`);
  console.log(`  distinguishes  [--binary            ]  : ${distinguishes(d,A,B,['--binary'],env)}  ${!distinguishes(d,A,B,['--binary'],env)?'← --binary alone COLLAPSES → --no-textconv load-bearing':'← --binary alone still distinguishes'}`);
  console.log(`  distinguishes  [        --no-textconv]  : ${distinguishes(d,A,B,['--no-textconv'],env)}`);
  console.log(`  distinguishes  [                      ] : ${distinguishes(d,A,B,[],env)}  ${!distinguishes(d,A,B,[],env)?'← neither → collapse without any flag':''}`);
  rmSync(d,{recursive:true,force:true});
}

console.log('\n== --no-ext-diff ==');
{
  const { d, env, A, B, helper } = setup(h => `[diff]\n\texternal = ${h}\n`, null, 'txt');
  const raw = diff(d, `${A}^1`, A, [], env);
  console.log(`  raw plain diff shows: ${JSON.stringify(raw.split('\n').find(l=>/COLLAPSED|PAYLOAD/.test(l)) || '(none)')}`);
  console.log(`  distinguishes  [--binary --no-ext-diff]: ${distinguishes(d,A,B,['--binary','--no-ext-diff'],env)}`);
  console.log(`  distinguishes  [--binary             ] : ${distinguishes(d,A,B,['--binary'],env)}  ${!distinguishes(d,A,B,['--binary'],env)?'← --binary alone COLLAPSES → --no-ext-diff load-bearing':'← --binary alone still distinguishes'}`);
  console.log(`  distinguishes  [         --no-ext-diff] : ${distinguishes(d,A,B,['--no-ext-diff'],env)}`);
  console.log(`  distinguishes  [                       ]: ${distinguishes(d,A,B,[],env)}  ${!distinguishes(d,A,B,[],env)?'← collapse without any flag':''}`);
  rmSync(d,{recursive:true,force:true});
}

console.log('\n== core.attributesFile=/dev/null (hostile GLOBAL attrs → textconv) ==');
{
  const d = newRepo();
  const helper = join(d,'constant.sh'); writeFileSync(helper,'#!/bin/sh\necho COLLAPSED\n'); chmodSync(helper,0o755);
  const gattr = join(d,'h.attributes'); writeFileSync(gattr,'*.md diff=hide\n');
  const env = hostileEnv(d, `[diff "hide"]\n\ttextconv = ${helper}\n[core]\n\tattributesFile = ${gattr}\n`);
  sh(d,`printf 'PAYLOAD_AAA\\n' > p.md && git add -A && git commit -q -m a`,env); const A=rev(d,'HEAD',env);
  sh(d,`printf 'PAYLOAD_BBB\\n' > p.md && git add -A && git commit -q -m b`,env); const B=rev(d,'HEAD',env);
  // isolate: NO --no-textconv (so the driver is live), --binary present, toggle core.attributesFile
  const wImg = ['git','-c','core.attributesFile=/dev/null','diff','--binary','--no-renames','-U3'];
  const woImg = ['git','diff','--binary','--no-renames','-U3'];
  const run = (base, a, b) => strip(sh(d, [...base, a, b].map(x=>`'${x}'`).join(' '), env));
  const wDist = run(wImg,`${A}^1`,A) !== run(wImg,`${B}^1`,B);
  const woDist = run(woImg,`${A}^1`,A) !== run(woImg,`${B}^1`,B);
  console.log(`  raw plain (no pins) shows: ${JSON.stringify(run(['git','diff'],`${A}^1`,A).split('\n').find(l=>/COLLAPSED|PAYLOAD/.test(l))||'(none)')}`);
  console.log(`  WITH core.attributesFile=/dev/null (no --no-textconv): distinguishes? ${wDist}`);
  console.log(`  WITHOUT it (no --no-textconv): distinguishes? ${woDist}  ${wDist!==woDist?'← pin independently load-bearing (neutralizes GLOBAL-attrs textconv)':'← no change under --binary'}`);
  rmSync(d,{recursive:true,force:true});
}
