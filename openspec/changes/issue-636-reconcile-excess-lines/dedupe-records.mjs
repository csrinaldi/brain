#!/usr/bin/env node
// dedupe-records.mjs — the ONE-SHOT reconciliation for issue #636.
//
// ── Why this lives HERE and not in brain/scripts/ ───────────────────────────
//
// `.memory/records/*.jsonl` is append-only by doctrine (ADR-0017), and union
// safety leans on it. This script REWRITES those files. A rewrite tool for an
// append-only log is a sharp thing to leave lying around, so it is deliberately
// not a `npm run` verb and not on the brain/ path: it sits in the change folder
// as the historical record of what was executed, next to the reasoning for why
// it was allowed once.
//
// Discarding it entirely was the alternative. Rejected: then the only evidence
// of a 139-line rewrite of the durable store would be the diff itself, and a
// reviewer would have to reconstruct the rule from it. Reproducible and
// auditable beats tidy.
//
// ── Fail-closed by construction ─────────────────────────────────────────────
//
// A repeat is dropped ONLY when its raw line is byte-identical to the line
// already kept for that id. Not "canonically equal", not "same id" — the same
// bytes. Anything else and the script refuses outright and reports every
// offender, because at that point a human is deciding which copy is the record,
// and that is not a decision a cleanup script may make silently.
//
// Measured on `main@1c21976` before writing this: 139 repeats, 139 raw
// byte-identical, 0 divergent. The strictest available rule was already
// satisfied, which is the one moment where "no information is lost" is provable
// rather than argued.
//
// Usage:
//   node dedupe-records.mjs <recordsDir>            # report only (default)
//   node dedupe-records.mjs <recordsDir> --apply    # rewrite the files

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const recordsDir = process.argv[2];
const apply = process.argv.includes('--apply');

if (!recordsDir) {
  console.error('usage: node dedupe-records.mjs <recordsDir> [--apply]');
  process.exit(1);
}

const files = readdirSync(recordsDir).filter((f) => f.endsWith('.jsonl')).sort();

/** id → { line, at } for the FIRST occurrence. First-wins, matching rebuildIndex. */
const kept = new Map();
const divergent = [];
const plan = new Map(); // filename → array of lines to keep
let totalLines = 0;
let dropped = 0;

for (const filename of files) {
  const raw = readFileSync(join(recordsDir, filename), 'utf8');
  const out = [];
  raw.split('\n').forEach((line, i) => {
    if (line.trim() === '') return;
    totalLines++;
    let id;
    try {
      id = JSON.parse(line).id;
    } catch {
      // A corrupt line is NOT this script's business. It is preserved verbatim
      // and reported by rebuildIndex, which is the fail-closed integrity gate.
      out.push(line);
      return;
    }
    const at = `${filename}:${i + 1}`;
    if (!kept.has(id)) {
      kept.set(id, { line, at });
      out.push(line);
      return;
    }
    if (kept.get(id).line !== line) {
      divergent.push({ id, kept: kept.get(id).at, at });
      out.push(line); // never dropped — the refusal below stops the run anyway
      return;
    }
    dropped++;
  });
  plan.set(filename, out);
}

console.log(`files            : ${files.length}`);
console.log(`physical lines   : ${totalLines}`);
console.log(`unique ids       : ${kept.size}`);
console.log(`byte-identical repeats to drop: ${dropped}`);

if (divergent.length > 0) {
  console.error(`\nREFUSING: ${divergent.length} repeat(s) are NOT byte-identical to the line kept for their id.`);
  console.error('Choosing between them is a human decision, not a cleanup script\'s:');
  for (const d of divergent.slice(0, 20)) {
    console.error(`  ${d.id} — kept ${d.kept}, differing copy at ${d.at}`);
  }
  if (divergent.length > 20) console.error(`  … +${divergent.length - 20} more`);
  process.exit(1);
}

if (totalLines - dropped !== kept.size) {
  // Arithmetic self-check: lines kept must equal unique ids (plus any corrupt
  // lines, which would make this differ and are worth stopping for).
  console.error(`\nREFUSING: ${totalLines} - ${dropped} = ${totalLines - dropped}, but there are ${kept.size} unique ids.`);
  process.exit(1);
}

if (!apply) {
  console.log('\n(report only — pass --apply to rewrite)');
  process.exit(0);
}

for (const [filename, lines] of plan) {
  writeFileSync(join(recordsDir, filename), lines.length ? lines.join('\n') + '\n' : '', 'utf8');
}
console.log(`\napplied — ${dropped} line(s) removed, ${kept.size} record(s) remain.`);
