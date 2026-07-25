// FORK B v3 — does dropping each env pin FLIP A VERDICT (resolved true<->false) under hostile
// ambient config, with --binary PRESENT? That is the only thing that justifies "reddens-on-drop".
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sh=(d,c,e={})=>execFileSync('bash',['-c',c],{cwd:d,encoding:'utf8',env:{...process.env,...e}});
const strip=r=>r.split('\n').filter(l=>!/^@@ /.test(l)&&!/^index /.test(l)).join('\n');
const rev=(d,r,e)=>sh(d,`git rev-parse ${r}`,e).trim();
function repo(){const d=mkdtempSync(join(tmpdir(),'fb3-'));sh(d,'git init -q -b main && git config user.email a@b.c && git config user.name t && git config commit.gpgsign false');return d;}
const hostile=(d,t)=>{const p=join(d,'h.cfg');writeFileSync(p,t);return{GIT_CONFIG_GLOBAL:p,GIT_CONFIG_SYSTEM:'/dev/null'};};
const merge=(d,b,m,e)=>{sh(d,`git checkout -q main && git merge --no-ff -q -m "${m}" ${b}`,e);return rev(d,'HEAD',e);};
function nd(d,a,b,pins,e){
  const cfg=[]; if(pins.has('alg'))cfg.push('-c','diff.algorithm=myers'); if(pins.has('ren'))cfg.push('-c','diff.renames=false'); if(pins.has('attr'))cfg.push('-c','core.attributesFile=/dev/null');
  const f=['diff']; if(pins.has('ntc'))f.push('--no-textconv'); if(pins.has('ned'))f.push('--no-ext-diff'); f.push('--no-renames','--binary','-U3');
  return strip(sh(d,['git',...cfg,...f,a,b].map(x=>`'${x}'`).join(' '),e));
}
const ALL=new Set(['alg','ren','attr','ntc','ned']);
const drop=p=>{const s=new Set(ALL);s.delete(p);return s;};
const resolved=(d,O,R,pins,e)=>{const pO=nd(d,`${O}^1`,O,pins,e);return pO!==''&&nd(d,R,`${R}^1`,pins,e)===pO;};

// scenario 1: genuine revert of a text offender; hostile textconv/ext-diff/attrs ambient. --binary present.
function genuineRevert(driverCfg, attrsLine){
  const d=repo();
  const helper=join(d,'c.sh');writeFileSync(helper,'#!/bin/sh\necho COLLAPSED\n');chmodSync(helper,0o755);
  const e=hostile(d,driverCfg(helper));
  sh(d,'echo seed>s.txt && git add -A && git commit -q -m seed',e);
  if(attrsLine)sh(d,`printf '${attrsLine}\\n' > .gitattributes && git add -A && git commit -q -m attrs`,e);
  sh(d,`git checkout -q -b f && printf 'PAYLOAD\\n' > p.md && git add -A && git commit -q -m o`,e);
  const O=merge(d,'f','PR1',e);
  sh(d,`git checkout -q -b rv main && git revert -m 1 --no-edit ${O}`,e);
  const R=merge(d,'rv','PR2',e);
  return {d,e,O,R};
}
for(const [name,cfg,attrs,pin] of [
  ['--no-textconv', h=>`[diff "hide"]\n\ttextconv = ${h}\n`, '*.md diff=hide', 'ntc'],
  ['--no-ext-diff', h=>`[diff]\n\texternal = ${h}\n`, null, 'ned'],
  ['core.attributesFile', h=>`[diff "hide"]\n\ttextconv = ${h}\n[core]\n\tattributesFile = ${h.replace('c.sh','h.attributes')}\n`, null, 'attr'],
]){
  const {d,e,O,R}=genuineRevert(cfg,attrs);
  if(pin==='attr'){const p=join(d,'h.attributes');writeFileSync(p,'*.md diff=hide\n');}
  const wp=resolved(d,O,R,ALL,e), np=resolved(d,O,R,drop(pin),e);
  console.log(`${name.padEnd(20)} genuine revert: WITH pin resolved=${wp}  WITHOUT=${np}  ${wp!==np?'← VERDICT FLIP → reddens-on-drop REAL':'← no flip (--binary masks) → DiD, not behavioral'}`);
  rmSync(d,{recursive:true,force:true});
}

// scenario 2: diff.algorithm — repeated-block file, histogram ambient; does verdict flip?
{
  const d=repo();const e=hostile(d,`[diff]\n\talgorithm = histogram\n`);
  const L=a=>a.join('\\n')+'\\n';
  sh(d,`printf '${L(['A','B','A','B','A','B'])}' > f.txt && git add -A && git commit -q -m seed`,e);
  sh(d,`git checkout -q -b f && printf '${L(['A','B','A','B','PAY','A','B'])}' > f.txt && git add -A && git commit -q -m o`,e);
  const O=merge(d,'f','PR1',e);
  sh(d,`git checkout -q -b rv main && git revert -m 1 --no-edit ${O}`,e);
  const R=merge(d,'rv','PR2',e);
  const wp=resolved(d,O,R,ALL,e), np=resolved(d,O,R,drop('alg'),e);
  console.log(`${'diff.algorithm'.padEnd(20)} genuine revert: WITH pin resolved=${wp}  WITHOUT(histogram)=${np}  ${wp!==np?'← VERDICT FLIP → reddens-on-drop REAL':'← no flip → determinism/DiD, not behavioral'}`);
  rmSync(d,{recursive:true,force:true});
}
