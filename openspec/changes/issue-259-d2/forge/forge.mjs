// Forge harness: run the REAL isResolvedAt predicate against three attack repos.
// Proves points 1 & 2 of the ruling empirically (forge, don't reason).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isResolvedAt, makeGit, changedPaths } from '/home/gandalf/IA/brain-issue-259/brain/scripts/governance/postmerge/resolution.mjs';

function sh(cwd, cmd) { return execFileSync('bash', ['-c', cmd], { cwd, encoding: 'utf8' }); }

function newRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'forge-'));
  sh(dir, 'git init -q && git config user.email a@b.c && git config user.name t && git config commit.gpgsign false');
  sh(dir, 'echo base > README.md && git add -A && git commit -q -m base'); // C0 = offender^1
  return dir;
}

// blob-OID GLOBAL absence: is any blob OID that the offender INTRODUCED still
// anywhere in tip's full tree? (the "content, not path" proposal, clause 2)
function offenderIntroducedBlobs(dir, offender) {
  const parent = sh(dir, `git ls-tree -r ${offender}^1`).split('\n').filter(Boolean)
    .map(l => l.split(/\s+/)[2]);
  const parentSet = new Set(parent.map(x => x.split('\t')[0] ?? x));
  const at = sh(dir, `git ls-tree -r ${offender}`).split('\n').filter(Boolean)
    .map(l => l.split(/\s+/)[2].split('\t')[0]);
  return new Set(at.filter(oid => !parentSet.has(oid)));
}
function blobPresentInTree(dir, rev, oids) {
  const treeOids = new Set(sh(dir, `git ls-tree -r ${rev}`).split('\n').filter(Boolean)
    .map(l => l.split(/\s+/)[2].split('\t')[0]));
  for (const o of oids) if (treeOids.has(o)) return true;
  return false;
}
// does the offender's actual textual payload string survive anywhere in tip tree?
function payloadStringSurvives(dir, rev, needle) {
  try { sh(dir, `git grep -q "${needle}" ${rev}`); return true; } catch { return false; }
}

function run(label, build, needle) {
  const dir = newRepo();
  const { offender, tip } = build(dir);
  const git = makeGit(dir);
  const P = [...changedPaths(offender, { git })];
  const pathScoped = isResolvedAt(offender, tip, { git }).resolved;
  const introduced = offenderIntroducedBlobs(dir, offender);
  const blobGone = !blobPresentInTree(dir, tip, introduced);   // clause 2 says "resolved" when true
  const pathClause = pathScoped;                                // clause 1 == current predicate
  const conjunction = pathClause && blobGone;                   // path ∧ blob
  const survives = payloadStringSurvives(dir, tip, needle);
  console.log(`\n=== ${label} ===`);
  console.log(`  offender changed paths P      : ${JSON.stringify(P)}`);
  console.log(`  PAYLOAD actually on disk @tip : ${survives ? 'YES — still there' : 'no — truly gone'}`);
  console.log(`  path-scoped predicate (CURRENT): resolved=${pathScoped}`);
  console.log(`  blob-OID global absence clause : resolved=${blobGone}`);
  console.log(`  path ∧ blob conjunction        : resolved=${conjunction}`);
  const verdict = survives && (pathScoped || conjunction) ? '  >>> FAIL OPEN (says resolved, payload survives)'
    : (!survives && pathScoped) ? '  >>> correct (true revert)' : '  >>> (fail closed / other)';
  console.log(verdict);
  rmSync(dir, { recursive: true, force: true });
}

// A) PURE RENAME — point 1: legit refactor renames offender's file, no attacker needed
run('A. PURE RENAME (point 1)', (dir) => {
  sh(dir, 'echo SECRET_PAYLOAD > payload.md && git add -A && git commit -q -m offender');
  const offender = sh(dir, 'git rev-parse HEAD').trim();
  sh(dir, 'git mv payload.md relocated.md && git commit -q -m "refactor: rename"');
  return { offender, tip: sh(dir, 'git rev-parse HEAD').trim() };
}, 'SECRET_PAYLOAD');

// B) RENAME + ONE BYTE — point 2: git mv + modify one byte, blob OID changes
run('B. RENAME + MODIFY ONE BYTE (point 2)', (dir) => {
  sh(dir, 'printf "SECRET_PAYLOAD\\n" > payload.md && git add -A && git commit -q -m offender');
  const offender = sh(dir, 'git rev-parse HEAD').trim();
  sh(dir, 'git mv payload.md relocated.md && printf "SECRET_PAYLOAD\\n# note\\n" > relocated.md && git add -A && git commit -q -m "refactor: rename+comment"');
  return { offender, tip: sh(dir, 'git rev-parse HEAD').trim() };
}, 'SECRET_PAYLOAD');

// C) CONTROL — a genuine revert (delete the file). Must stay resolved=true, payload gone.
run('C. TRUE REVERT (control)', (dir) => {
  sh(dir, 'echo SECRET_PAYLOAD > payload.md && git add -A && git commit -q -m offender');
  const offender = sh(dir, 'git rev-parse HEAD').trim();
  sh(dir, 'git rm -q payload.md && git commit -q -m "revert offender"');
  return { offender, tip: sh(dir, 'git rev-parse HEAD').trim() };
}, 'SECRET_PAYLOAD');
