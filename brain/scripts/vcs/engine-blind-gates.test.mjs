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

// The matcher is pure and tested against the bypass shapes round 1 named:
// a quoted literal, a BARE object key (`plain:` — 'gentle-ai' cannot be one
// without quotes), and the camel/Pascal identifier a hyphenated name becomes.
// A static scan can never pin "zero engine-conditional code" in full — code
// can always smuggle semantics through concatenation — so the honest contract
// is this pair: the scan pins every NAMEABLE form, and stage-wiring's D4
// parity pins the behaviour. Together they hold the produce/verify line.
export function findEngineMentions(text, engines) {
  const hits = [];
  for (const engine of engines) {
    const camel = engine.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const pascal = camel[0].toUpperCase() + camel.slice(1);
    const forms = [
      { form: 'string literal', re: new RegExp(`['"\`]${engine}['"\`]`) },
      { form: 'bare object key', re: new RegExp(`\\b${camel}\\s*:`) },
    ];
    if (camel !== engine) {
      forms.push({ form: 'camel identifier', re: new RegExp(`\\b(${camel}|${pascal})\\b`) });
    }
    for (const { form, re } of forms) {
      if (re.test(text)) hits.push({ engine, form });
    }
  }
  return hits;
}

test('#323 S7 (round 1): the matcher catches every nameable form — and ignores prose lookalikes', () => {
  const engines = ['gentle-ai', 'plain'];
  assert.deepEqual(findEngineMentions("const e = 'plain';", engines), [{ engine: 'plain', form: 'string literal' }]);
  assert.deepEqual(findEngineMentions('const map = { plain: run };', engines), [{ engine: 'plain', form: 'bare object key' }]);
  assert.deepEqual(findEngineMentions('if (gentleAi) fork();', engines), [{ engine: 'gentle-ai', form: 'camel identifier' }]);
  assert.deepEqual(findEngineMentions('new GentleAi()', engines), [{ engine: 'gentle-ai', form: 'camel identifier' }]);
  assert.deepEqual(findEngineMentions('// explain: plaintext output, in plain terms', engines), [],
    'prose lookalikes stay silent — an allowlist that fights noise dilutes to zero');
});

test('#323 S7: gate surfaces carry ZERO engine string literals — verification stays neutral', () => {
  const files = [...GATE_ROOTS.flatMap(mjsFilesUnder), ...GATE_FILES.map((f) => join(REPO, f))];
  assert.ok(files.length > 20, `the scan must actually see the gate tree (saw ${files.length} files)`);
  const offenders = [];
  for (const file of files) {
    const rel = relative(REPO, file);
    if (ALLOWLIST.has(rel)) continue;
    const text = readFileSync(file, 'utf8');
    for (const { engine, form } of findEngineMentions(text, SDD_ENGINES)) {
      offenders.push(`${rel} names '${engine}' (${form})`);
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
