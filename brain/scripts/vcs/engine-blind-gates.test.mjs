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
// Comments and string CONTENTS cannot fork behaviour, and leaving them in
// makes a bare `plain` check unusable (every prose "in plain terms" would
// fire). So the bare-identifier pass runs on STRIPPED text — code only —
// while the quoted-literal pass runs on the original. Round 2's blocker:
// for a single-word engine (camel === token) no bare form was checked at
// all; `import { plain }` walked past the guard.
export function stripCommentsAndStrings(text) {
  // ONE alternation, not sequential passes (round 3's blocker): sequential
  // comment-then-string passes let a '//' INSIDE a string ('http://...')
  // eat the rest of the line — code included — before strings were touched.
  // A single regex scans left to right and whichever construct OPENS first
  // consumes: a string starting before the '//' swallows it as content.
  const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^\\`])*`|'(?:\\.|[^\\'])*'|"(?:\\.|[^\\"])*"/g;
  return text.replace(re, (m) => (m.startsWith('/') ? ' ' : "''"));
}

export function findEngineMentions(text, engines) {
  const hits = [];
  const code = stripCommentsAndStrings(text);
  for (const engine of engines) {
    const camel = engine.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const pascal = camel[0].toUpperCase() + camel.slice(1);
    if (new RegExp(`['"\`]${engine}['"\`]`).test(text)) {
      hits.push({ engine, form: 'string literal' });
    }
    const idents = [...new Set([camel, pascal, ...(/^[a-z][a-z0-9]*$/.test(engine) ? [engine] : [])])];
    if (new RegExp(`\\b(${idents.join('|')})\\b`).test(code)) {
      hits.push({ engine, form: 'bare identifier' });
    }
  }
  return hits;
}

test('#323 S7 (rounds 1+2): the matcher catches every nameable form — literal, key, identifier, single-word included', () => {
  const engines = ['gentle-ai', 'plain'];
  assert.deepEqual(findEngineMentions("const e = 'plain';", engines), [{ engine: 'plain', form: 'string literal' }]);
  assert.deepEqual(findEngineMentions('const map = { plain: run };', engines), [{ engine: 'plain', form: 'bare identifier' }]);
  assert.deepEqual(findEngineMentions('if (gentleAi) fork();', engines), [{ engine: 'gentle-ai', form: 'bare identifier' }]);
  assert.deepEqual(findEngineMentions('new GentleAi()', engines), [{ engine: 'gentle-ai', form: 'bare identifier' }]);
  // Round 2's three measured bypasses — all must fire now.
  assert.deepEqual(findEngineMentions('if (engine === plain) fork();', engines), [{ engine: 'plain', form: 'bare identifier' }]);
  assert.deepEqual(findEngineMentions('engines.plain.runStage();', engines), [{ engine: 'plain', form: 'bare identifier' }]);
  assert.deepEqual(findEngineMentions("import { plain } from './engines.mjs';", engines), [{ engine: 'plain', form: 'bare identifier' }]);
});

test('#323 S7 (round 3): a URL inside a string does not eat the code after it', () => {
  const engines = ['gentle-ai', 'plain'];
  // The reviewer's measured bypass: the '//' in the URL used to consume the
  // rest of the line as a "comment" BEFORE strings were stripped.
  assert.deepEqual(findEngineMentions('const url = "http://example.com/x"; if (plain) run();', engines),
    [{ engine: 'plain', form: 'bare identifier' }]);
  assert.deepEqual(findEngineMentions("const sep = '//'; gentleAi.run();", engines),
    [{ engine: 'gentle-ai', form: 'bare identifier' }]);
  assert.equal(stripCommentsAndStrings('const url = "http://example.com"; if (plain) x();').includes('plain'), true,
    'the stripped text keeps the CODE that follows a URL string');
});

test('#323 S7 (round 2): comments and string CONTENTS stay silent — they cannot fork behaviour', () => {
  const engines = ['gentle-ai', 'plain'];
  assert.deepEqual(findEngineMentions('// explain: plaintext output, in plain terms', engines), []);
  assert.deepEqual(findEngineMentions('/* the plain truth about gentleAi */', engines), []);
  assert.deepEqual(findEngineMentions('const msg = "plain text output";', engines), [],
    'a substring inside a string is not the exact quoted token and not code');
  assert.deepEqual(findEngineMentions('explain(); const plaintiff = 1;', engines), [],
    'word boundaries hold — lookalike identifiers stay silent');
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
