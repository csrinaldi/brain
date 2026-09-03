// engine-blind-gates.test.mjs — #323's deliverable 4, the half no test pinned:
// "zero engine-conditional code in any gate". The produce/verify line the epic
// holds (route who PRODUCES per stage; keep who VERIFIES neutral) is only real
// while no gate can even NAME an engine.
//
// HOW THIS GUARD HOLDS THE LINE — and why it owns no lexer. Three review
// rounds tried a strip-comments-then-scan approach and each round found the
// next token type it mishandled (URLs in strings, template interpolations,
// regex literals): hand-lexing JavaScript with regexes is an arms race with
// no finish line, and this repo ships zero dependencies, so no real lexer is
// available either. The sound observation that replaces it: a WORKING
// engine-conditional needs one of exactly two things —
//   · the engine's NAME: a quoted string literal, scanned on RAW text
//     (comments included — a gate file quoting an engine name deserves a
//     look, and the allowlist with a reason is the exit); or
//   · the engine's MODULE: an import whose specifier crosses into
//     brain/scripts/harness/** (the engines' home), scanned by specifier.
// A bare identifier bound to neither is a ReferenceError, not a fork; a
// binding chain that works ends at a literal in some scanned file (caught
// there) or at a harness import (caught here). Tokens come from platform.mjs,
// never a second list, so a future engine joins the guard the moment it
// joins the platform. Allowlist shape per #802: a reviewed one-line reason,
// never a widened scan.
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

/** Pure: every quoted engine-name literal in RAW text. */
export function engineLiterals(text, engines) {
  const hits = [];
  for (const engine of engines) {
    if (new RegExp(`['"\`]${engine}['"\`]`).test(text)) {
      hits.push({ engine, form: 'string literal' });
    }
  }
  return hits;
}

/** Pure: every import/re-export specifier in the text — static, dynamic, export-from. */
export function importSpecifiers(text) {
  const out = [];
  const re = /(?:import|export)\s[^'"();]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;
  for (const m of text.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/** Pure: specifiers that resolve into the engines' home, from a file at relDir. */
export function harnessImports(text, relDir) {
  return importSpecifiers(text).filter((spec) => {
    if (!spec.startsWith('.')) return false;
    const resolved = join(relDir, spec);
    return resolved.startsWith(join('brain', 'scripts', 'harness'));
  });
}

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

test('#323 S7: the two pure checks catch the binding roads — and only the binding roads', () => {
  const engines = ['gentle-ai', 'plain'];
  // The NAME road: quoted literals, any quote, raw text.
  assert.deepEqual(engineLiterals("const e = 'plain';", engines), [{ engine: 'plain', form: 'string literal' }]);
  assert.deepEqual(engineLiterals('run("gentle-ai")', engines), [{ engine: 'gentle-ai', form: 'string literal' }]);
  assert.deepEqual(engineLiterals('const s = `plain`;', engines), [{ engine: 'plain', form: 'string literal' }]);
  assert.deepEqual(engineLiterals('// in plain terms, explain plaintext', engines), [],
    'unquoted prose stays silent — the word is not the token');
  // The MODULE road: static, dynamic, and re-export specifiers into harness/.
  const dir = join('brain', 'scripts', 'vcs');
  assert.deepEqual(harnessImports("import { plain } from '../harness/backends/plain.mjs';", dir), ['../harness/backends/plain.mjs']);
  assert.deepEqual(harnessImports("const m = await import('../harness/platform.mjs');", dir), ['../harness/platform.mjs']);
  assert.deepEqual(harnessImports("export { runStage } from '../harness/stage-seam.mjs';", dir), ['../harness/stage-seam.mjs']);
  assert.deepEqual(harnessImports("import { resolveTier } from './governance-tiers.mjs';", dir), [],
    'a gate importing another gate is the normal shape — silent');
  // Round 2/3/4's bypass shapes all reduce to one of the two roads: a bare
  // identifier with neither binding is a ReferenceError, not a fork.
  assert.deepEqual(engineLiterals('if (engine === plain) fork();', engines), [],
    'caught not here but at the binding: `plain` must be imported (module road) or defined from a literal (name road)');
});

test('#323 S7: gate surfaces carry ZERO engine names and ZERO harness imports — verification stays neutral', () => {
  const files = [...GATE_ROOTS.flatMap(mjsFilesUnder), ...GATE_FILES.map((f) => join(REPO, f))];
  assert.ok(files.length > 20, `the scan must actually see the gate tree (saw ${files.length} files)`);
  const offenders = [];
  for (const file of files) {
    const rel = relative(REPO, file);
    if (ALLOWLIST.has(rel)) continue;
    const text = readFileSync(file, 'utf8');
    for (const { engine, form } of engineLiterals(text, SDD_ENGINES)) {
      offenders.push(`${rel} names '${engine}' (${form})`);
    }
    for (const spec of harnessImports(text, dirname(rel))) {
      offenders.push(`${rel} imports the engines' home ('${spec}')`);
    }
  }
  assert.deepEqual(offenders, [],
    `a gate that can name an engine or reach its module can fork per engine — ADR-0019 Amendment 1 ` +
    `condition 2. If a specific site genuinely must, add a reviewed ALLOWLIST entry with a one-line ` +
    `reason; never widen the scan to stop seeing it.`);
});

test('#323 S7: the token list is the PLATFORM\'s, not a copy — a new engine joins this guard automatically', () => {
  assert.ok(SDD_ENGINES.length >= 2, 'the epic shipped two engines; the guard reads them from platform.mjs');
  assert.ok(SDD_ENGINES.includes('plain') && SDD_ENGINES.includes('gentle-ai'), 'the two wired engines are the tokens scanned');
});
