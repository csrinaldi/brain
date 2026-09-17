// test-hygiene.test.mjs — a test that exercises a real entrypoint must not
// write into the real repo root (#1020, same class as #1011/#1013 and
// #1010/#1019). archive.test.mjs 4.1 built its sandbox under
// join(process.cwd(), 'scratch/test-archive-sandbox') and left the
// `scratch/` parent behind on every full-suite run; a cold-review candidate
// that runs the suite (the reviewer role explicitly allows this) then sees
// the real root's entry list change and refuses publication. This guard is
// the "keeps the class closed" half of #1020: a source-level scan, not a
// full-suite-in-a-temp-root run (too expensive to be worth it here).
//
// Scope, deliberately minimal (#1020: "at minimum a source-level scan"):
// flags ONLY a write call — one of WRITE_FNS below — whose OWN argument
// list directly references process.cwd()/resolve('.')/resolve(".") — the
// inline form archive.mjs's mutation test (below) reproduces. A same-file
// variable built from process.cwd() earlier and passed to a write call by
// name (the shape archive.test.mjs actually had, before #1020 unit 2) is
// NOT traced: whole-file, unscoped variable tracking was tried and measured
// to produce real false positives on this repo today —
// brain/scripts/lib/installed-version.test.mjs has four separate
// `const root = ...` bindings across different test() closures, only one
// `process.cwd()`-derived, and an unscoped scan conflates it with the
// OTHER `root`s' unrelated, harmless writeFileSync calls. A per-closure
// scope tracker would close that gap; not built here — direct-only is the
// precise, zero-false-positive floor #1020 asks for.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, globSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testTmp } from './lib/test-tmp.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The roots this guard walks — every *.test.mjs under brain/scripts/** and
// the top-level test/** suite (#1020's own wording); no production-only
// carve-out, since the defect class lives entirely in test code.
const WALK_GLOBS = ['brain/scripts/**/*.test.mjs', 'test/**/*.test.mjs'];

// Never spelled with a trailing `(` anywhere else in this file's raw
// source (including inside the fixture-building strings below) — that
// contiguous substring is exactly what WRITE_CALL_RE matches, and this
// guard scans its own file too (design mirrors chunk-boundary.test.mjs's
// IMPORT_KW/EXPORT_KW trick for the same reason).
const WRITE_FNS = ['mkdirSync', 'writeFileSync', 'symlinkSync', 'cpSync'];

const WRITE_CALL_RE = new RegExp(`\\b(${WRITE_FNS.join('|')})\\s*\\(`, 'g');

const CWD_REF_RE = /process\.cwd\(\)|resolve\(\s*['"]\.['"]\s*\)/;

/** Returns the text between a call's own `(` (at `openParenIdx`) and its
 * matching `)`, tracking nested parens and skipping over string-literal
 * content so a `)` inside a quoted argument never closes the call early. */
function callArgsText(src, openParenIdx) {
  let depth = 0;
  let inString = null;
  for (let i = openParenIdx; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === '\\') { i += 1; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { inString = c; continue; }
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(openParenIdx + 1, i);
    }
  }
  return src.slice(openParenIdx + 1);
}

/** Scans `globs` (relative to `cwd`) for a write call whose own argument
 * list directly references process.cwd()/resolve('.') — see the module doc
 * comment above for exactly what this does and does not cover. `cwd` is a
 * parameter (not hardcoded to the repo root) so a fixture root can be
 * scanned in isolation for the detection-proof test below. */
function findRealRootWriteViolations(cwd, globs) {
  const files = globSync(globs, { cwd }).map((f) => f.split(sep).join('/'));
  const found = [];
  for (const relFile of files) {
    const src = readFileSync(join(cwd, relFile), 'utf8');
    const re = new RegExp(WRITE_CALL_RE.source, WRITE_CALL_RE.flags);
    let m;
    while ((m = re.exec(src))) {
      const openParenIdx = m.index + m[0].length - 1;
      const argsText = callArgsText(src, openParenIdx);
      if (CWD_REF_RE.test(argsText)) {
        const line = src.slice(0, m.index).split('\n').length;
        found.push({ file: relFile, line, fn: m[1] });
      }
    }
  }
  return { files, found };
}

// Annotated allowlist (design: chunk-boundary.test.mjs's ALLOWLIST
// pattern) — empty today, kept as a real data structure rather than a bare
// assertion so a future genuinely-safe direct match has one documented
// place to land instead of a silent scanner tweak.
const ALLOWLIST = [];

const sortFound = (rows) =>
  [...rows]
    .map(({ file, line, fn }) => ({ file, line, fn }))
    .sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

test('no *.test.mjs under brain/scripts/** or test/** writes into the real repo root via a literal process.cwd()/resolve(\'.\') argument (#1020)', () => {
  const { files, found } = findRealRootWriteViolations(repoRoot, WALK_GLOBS);
  assert.ok(files.length > 0, 'the scan must actually walk files, not silently see nothing');
  assert.deepEqual(sortFound(found), sortFound(ALLOWLIST));
});

test('the scanner detects the violation it exists to catch, in an isolated fixture root', () => {
  // Fixture only — testTmp (#842), never brain/scripts/** itself. The
  // planted source is built via concatenation (MKDIR_KW): this file's own
  // text never spells the write-call name immediately followed by `(` —
  // see the module doc comment for why that self-match matters here.
  const fixtureRoot = testTmp('test-hygiene-fixture-');
  const fixtureDir = join(fixtureRoot, 'brain', 'scripts');
  mkdirSync(fixtureDir, { recursive: true });
  const MKDIR_KW = 'mkdir' + 'Sync';
  const plantedSource = [
    "import { mkdirSync } from 'node:fs';",
    "import { join } from 'node:path';",
    `${MKDIR_KW}(join(process.cwd(), 'x'), { recursive: true });`,
    '',
  ].join('\n');
  writeFileSync(join(fixtureDir, 'planted.test.mjs'), plantedSource, 'utf8');

  const { found } = findRealRootWriteViolations(fixtureRoot, WALK_GLOBS);
  assert.deepEqual(found, [{ file: 'brain/scripts/planted.test.mjs', line: 3, fn: 'mkdirSync' }]);
});
