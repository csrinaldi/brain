// engine-blind-gates.test.mjs — #323's deliverable 4, the half no test pinned:
// "zero engine-conditional code in any gate". The produce/verify line the epic
// holds (route who PRODUCES per stage; keep who VERIFIES neutral) is only real
// while no gate can even NAME an engine. This guard scans every gate surface
// for SDD_ENGINES string literals — the tokens come from platform.mjs, never a
// second list here, so a future engine joins the guard the moment it joins the
// platform. Same shape as #802's adoption scan: an allowlist with a reviewed
// reason is the only way past it, never a widened scan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SDD_ENGINES } from '../harness/platform.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..');

// The gate surfaces: the CI gates' implementations and the shared checkers
// they call. Harness/roles/review are PRODUCER territory — engines are their
// subject matter and they are deliberately out of scope here.
const GATE_ROOTS = [
  'brain/scripts/vcs',
  'brain/scripts/governance',
];
const GATE_FILES = ['brain/scripts/check-refs.mjs'];

// A file may buy its way in ONLY with a reviewed one-line reason.
const ALLOWLIST = new Map([
  // (empty — measured zero at #323 close; keep it that way)
]);

function mjsFilesUnder(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.mjs') && !name.endsWith('.test.mjs')) out.push(p);
    }
  };
  walk(join(REPO, root));
  return out;
}

test('#323 S7: gate surfaces carry ZERO engine string literals — verification stays neutral', () => {
  const files = [...GATE_ROOTS.flatMap(mjsFilesUnder), ...GATE_FILES.map((f) => join(REPO, f))];
  assert.ok(files.length > 20, `the scan must actually see the gate tree (saw ${files.length} files)`);
  const offenders = [];
  for (const file of files) {
    const rel = relative(REPO, file);
    if (ALLOWLIST.has(rel)) continue;
    const text = readFileSync(file, 'utf8');
    for (const engine of SDD_ENGINES) {
      const re = new RegExp(`['"\`]${engine}['"\`]`);
      if (re.test(text)) offenders.push(`${rel} names '${engine}'`);
    }
  }
  assert.deepEqual(offenders, [],
    `a gate that can name an engine can fork per engine — ADR-0019 Amendment 1 condition 2. ` +
    `If a specific site genuinely must, add a reviewed ALLOWLIST entry with a one-line reason; ` +
    `never widen the scan to stop seeing it.`);
});

test('#323 S7: the token list is the PLATFORM\'s, not a copy — a new engine joins this guard automatically', () => {
  assert.ok(SDD_ENGINES.length >= 2, 'the epic shipped two engines; the guard reads them from platform.mjs');
  assert.ok(SDD_ENGINES.includes('plain') && SDD_ENGINES.includes('gentle-ai'), 'the two wired engines are the tokens scanned');
});
