// measure-701b.mjs — corrected. The first cut counted the whole TRACKED corpus,
// which every worktree carries because `.memory/records/` is versioned; that
// measured git, not the exporter.
//
// What an export actually WROTE since the worktree's last commit is exactly the
// untracked (`??`) and modified (`M`) entries under `.memory/records/`. Those
// are the population this ticket is about.
//
// Each written file is classified against origin/main:
//   RE-EXPORT  — byte-identical to a record already on main. The worktree did
//                not author it and adds nothing.
//   DIVERGENT  — same record path, different bytes. The `source`-widening case.
//   NEW        — not on main. Possibly authored here; reported separately, and
//                its `issue` field is shown so "possibly" can be checked.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = '/home/gandalf/IA';
const MAIN = 'origin/main';
const git = (cwd, args) => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1e9 }); }
  catch { return null; }
};

const mainRepo = join(ROOT, 'brain');
const mainFiles = new Map();
for (const p of (git(mainRepo, ['ls-tree', '--name-only', MAIN, '.memory/records/']) ?? '').trim().split('\n').filter(Boolean)) {
  mainFiles.set(basename(p), git(mainRepo, ['show', `${MAIN}:${p}`]) ?? '');
}

const worktrees = (git(mainRepo, ['worktree', 'list']) ?? '')
  .split('\n').map(l => l.split(/\s+/)[0]).filter(p => p.includes('brain-issue-'));

const rows = [];
const newRecords = [];
const divergentRecords = [];
let T = { written: 0, reexport: 0, divergent: 0, fresh: 0 };

for (const wt of worktrees) {
  const issue = Number(basename(wt).replace('brain-issue-', ''));
  const status = git(wt, ['status', '--porcelain', '--untracked-files=all', '.memory/records/']) ?? '';
  const written = status.split('\n').filter(Boolean)
    .map(l => ({ code: l.slice(0, 2).trim(), path: l.slice(3).trim() }))
    .filter(e => e.code === '??' || e.code.includes('M'));

  let reexport = 0, divergent = 0, fresh = 0;
  for (const e of written) {
    const abs = join(wt, e.path);
    if (!existsSync(abs)) continue;
    const local = readFileSync(abs, 'utf8');
    const name = basename(e.path);
    if (!mainFiles.has(name)) {
      fresh++;
      for (const line of local.split('\n').filter(Boolean)) {
        try { const o = JSON.parse(line); newRecords.push({ wt: basename(wt), id: o.id, issue: o.issue ?? null }); } catch {}
      }
    } else if (mainFiles.get(name) === local) {
      reexport++;
    } else {
      divergent++;
      const m = mainFiles.get(name).split('\n').filter(Boolean).map(l => { try { return JSON.parse(l).source; } catch { return null; } });
      const l = local.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l).source; } catch { return null; } });
      divergentRecords.push({ wt: basename(wt), name, main: m, local: l });
    }
  }

  rows.push({ wt: basename(wt), issue, written: written.length, reexport, divergent, fresh });
  T.written += written.length; T.reexport += reexport; T.divergent += divergent; T.fresh += fresh;
}

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');

console.log('LO QUE LA EXPORTACIÓN ESCRIBIÓ (sin trackear o modificado vs el HEAD del worktree)\n');
console.log('worktree                escritos  re-export  divergentes  nuevos   %no-autorados');
for (const r of rows) {
  console.log(`  ${r.wt.padEnd(21)} ${String(r.written).padStart(8)} ${String(r.reexport).padStart(10)} ${String(r.divergent).padStart(12)} ${String(r.fresh).padStart(7)}   ${pct(r.reexport + r.divergent, r.written).padStart(9)}`);
}
console.log(`  ${'TOTAL'.padEnd(21)} ${String(T.written).padStart(8)} ${String(T.reexport).padStart(10)} ${String(T.divergent).padStart(12)} ${String(T.fresh).padStart(7)}   ${pct(T.reexport + T.divergent, T.written).padStart(9)}`);

if (divergentRecords.length) {
  console.log('\nDIVERGENTES — mismo registro, bytes distintos:');
  for (const d of divergentRecords) console.log(`  ${d.wt}  ${d.name}\n     main : ${JSON.stringify(d.main)}\n     local: ${JSON.stringify(d.local)}`);
}

console.log('\nNUEVOS — no están en main (candidatos a "autorado acá"):');
const byWt = new Map();
for (const n of newRecords) { if (!byWt.has(n.wt)) byWt.set(n.wt, []); byWt.get(n.wt).push(n); }
for (const [wt, list] of byWt) {
  const wtIssue = Number(wt.replace('brain-issue-', ''));
  for (const n of list) {
    const own = n.issue != null && Number(n.issue) === wtIssue;
    console.log(`  ${wt.padEnd(21)} ${n.id}  issue=${n.issue ?? '—'}  ${own ? '← propio' : n.issue == null ? '← sin ticket' : '← AJENO'}`);
  }
}
if (!newRecords.length) console.log('  (ninguno)');
