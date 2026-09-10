// chunk-boundary.test.mjs — the chunk read-back becomes an ENFORCED boundary
// (#247, epic #864 task 2.3; spec.md D4 guards 1-4; design.md A1-A5, testing
// strategy rows 1-4). Per #863 D3 (ratified 2026-09-08): this is the
// READ-BACK boundary only — `share` still calls `engram sync --export`
// (`engram.mjs:1108` `save()` is `unsupportedOp`, so the export is engram's
// only producer path into `records/` until task 3.2, #874). Nothing that
// runs is changed by this file; it only asserts what already imports what.
//
// RED-first (design A4, the one real trap): `lane-scrub.test.mjs:88-94`'s
// `source.split('\n')` + `/^\s*import\b/` idiom cannot see `cli.mjs:615-617`,
// a 3-line `const { … } = await import(\n  "./lib/migrate-v1.mjs"\n);`. This
// guard matches over the WHOLE source with one regex covering both the
// static and the dynamic spelling, so it sees the edge the line-filtered
// idiom misses.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, globSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testTmp } from '../lib/test-tmp.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

// The roots this guard walks — design A2: tests are INCLUDED, one flat
// allowlist, not a production-only sample. Excluding `**/*.test.mjs` would
// make `migrate-v1.test.mjs:13` (a real importer) invisible.
const WALK_GLOBS = ['brain/scripts/**/*.mjs', 'test/**/*.mjs'];

// Matches BOTH `import { x, y } from '...'` and the dynamic
// `const { x, y } = await import('...')` (which may span multiple lines) —
// one regex, over the whole source, not `split('\n')` + a leading-`import`
// filter (design A4).
const CHUNK_IMPORT_RE =
  /(?:import\s*\{([^}]*)\}\s*from\s*|(?:const|let|var)\s*\{([^}]*)\}\s*=\s*await\s+import\s*\(\s*)['"]([^'"]+)['"]/g;

/**
 * Walks `roots` (globs, relative to `cwd`) and extracts every import edge
 * matching CHUNK_IMPORT_RE. Returns the scanned file list (for the "did the
 * scan actually read anything" self-check) plus every edge found.
 */
function scanImportEdges(cwd, globs) {
  const files = globSync(globs, { cwd }).map((f) => f.split(sep).join('/'));
  const edges = [];
  for (const relFile of files) {
    const src = readFileSync(join(cwd, relFile), 'utf8');
    const re = new RegExp(CHUNK_IMPORT_RE.source, CHUNK_IMPORT_RE.flags);
    let m;
    while ((m = re.exec(src))) {
      const names = (m[1] ?? m[2] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const specifier = m[3];
      const line = src.slice(0, m.index).split('\n').length;
      edges.push({ file: relFile, line, names, specifier });
    }
  }
  return { files, edges };
}

/** Every import edge whose specifier resolves to `migrate-v1.mjs` and whose
 * named imports include `collectChunkObservations` — the surface D4 guard 2
 * constrains to an annotated allowlist. */
function chunkImporters(cwd) {
  const { files, edges } = scanImportEdges(cwd, WALK_GLOBS);
  const found = edges
    .filter((e) => e.specifier.endsWith('migrate-v1.mjs') && e.names.includes('collectChunkObservations'))
    .map((e) => ({ file: e.file, line: e.line }))
    .sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
  return { files, found };
}

const sortAllowlist = (rows) =>
  [...rows].map(({ file, line }) => ({ file, line })).sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

// ── D4 guard 2 — `collectChunkObservations`'s importers are an annotated
// allowlist (spec.md, design A2-A4) ─────────────────────────────────────────

// The annotated allowlist itself (design A4's literal) — each row names the
// ticket that retires it. Measured live on this worktree (tasks.md 0.1):
// exactly `engram.mjs:48`, `cli.mjs:615`, `migrate-v1.test.mjs:13`.
// Line 61 (not 48): the #247 header note above `engram.mjs`'s import block
// (Work Unit 4.1) inserted 13 lines ahead of it — re-measured after that
// edit landed, per tasks.md 0.5's "re-read every ledger anchor" rule.
const ALLOWLIST = [
  { file: 'brain/scripts/memory/backends/engram.mjs', line: 61, retiredBy: '3.2 (#874) — ledger row 2' },
  { file: 'brain/scripts/memory/cli.mjs', line: 615, retiredBy: '2.4 — ledger row 7' },
  { file: 'brain/scripts/memory/lib/migrate-v1.test.mjs', line: 13, retiredBy: '2.4 — ledger row 7' },
];

test('collectChunkObservations: the real importer set equals the annotated allowlist, both directions (D4 guard 2, A3)', () => {
  const { found } = chunkImporters(repoRoot);
  assert.deepEqual(sortAllowlist(found), sortAllowlist(ALLOWLIST));
});

test('collectChunkObservations: a stale allowlist row (code stopped importing) fails the check — the reverse direction (A3)', () => {
  // Real `found` set against an allowlist that ADDS a row nothing in the
  // tree imports (an already-retired file) — the reverse of "a new importer
  // appears": an allowlisted entry surviving a retirement must fail, not
  // pass silently. `check-refs.mjs`'s exemptions (`:57-58`, `:80`) are
  // one-directional and cannot catch this; this guard is stricter.
  const { found } = chunkImporters(repoRoot);
  const staleAllowlist = [
    ...ALLOWLIST,
    { file: 'brain/scripts/memory/backends/already-retired.mjs', line: 1, retiredBy: 'never landed' },
  ];
  assert.notDeepEqual(sortAllowlist(found), sortAllowlist(staleAllowlist), 'a stale allowlist row must break equality');
});

test('collectChunkObservations: a fixture importer with no allowlist row fails the check — the forward direction (A3)', () => {
  // An isolated fixture tree (testTmp — #842 hygiene), never the real repo:
  // plant a `.mjs` file importing `collectChunkObservations` from a path
  // ending in `migrate-v1.mjs`, scan ONLY that fixture root, and assert the
  // walker finds it while an empty allowlist does not name it — the "a new
  // importer with no allowlist row fails" direction, proven without ever
  // mutating a tracked file.
  const fixtureRoot = testTmp('chunk-boundary-fixture-');
  const fixtureDir = join(fixtureRoot, 'brain', 'scripts');
  mkdirSync(fixtureDir, { recursive: true });
  // Built via concatenation, not a literal `import {...} from '...'`
  // string: this file is itself under `brain/scripts/**`, so a literal
  // match here would register as a SECOND real importer when this guard
  // scans its own tree, corrupting the allowlist equality test above.
  const plantedSource = ['im' + 'port', "{ collectChunkObservations }", 'from', "'./lib/migrate-v1.mjs';\n"].join(' ');
  writeFileSync(join(fixtureDir, 'planted-importer.mjs'), plantedSource, 'utf8');
  const { found } = chunkImporters(fixtureRoot);
  assert.equal(found.length, 1, 'the walker must see the planted fixture importer');
  assert.equal(found[0].file, 'brain/scripts/planted-importer.mjs');
  assert.notDeepEqual(sortAllowlist(found), sortAllowlist([]), 'an unlisted importer must not equal an empty allowlist');
});

test('collectChunkObservations: the scan actually read something — evidence floor (A3, settings-hooks.test.mjs pattern)', () => {
  // A scan that reads nothing proves nothing (harness/backends/settings-hooks.test.mjs:145-150's rule).
  const { files } = chunkImporters(repoRoot);
  assert.ok(files.length > 100, `the scan read ${files.length} files — it is not looking where it thinks`);
  for (const known of [
    'brain/scripts/memory/backends/engram.mjs',
    'brain/scripts/memory/cli.mjs',
    'brain/scripts/memory/lib/migrate-v1.mjs',
  ]) {
    assert.ok(files.includes(known), `the scan never read ${known}; a scan that reads nothing proves nothing`);
  }
});

test('collectChunkObservations: migrate-v1.mjs still exports the symbol the allowlist is annotated against (A3)', () => {
  const src = readFileSync(join(repoRoot, 'brain/scripts/memory/lib/migrate-v1.mjs'), 'utf8');
  assert.match(
    src,
    /^export function collectChunkObservations\b/m,
    'a deleted migrate-v1.mjs would leave the allowlist check vacuously green',
  );
});

// ── D4 guard 1 — `readChunkObservations` has zero importers (spec.md, design A5) ──

test('readChunkObservations: zero importers across brain/scripts/** and test/** (D4 guard 1)', () => {
  const { edges } = scanImportEdges(repoRoot, WALK_GLOBS);
  const importers = edges.filter((e) => e.names.includes('readChunkObservations'));
  assert.deepEqual(importers, [], 'readChunkObservations must have zero importers');
});

test('readChunkObservations: no definition anywhere in brain/scripts/** or test/** (D4 guard 1, A5)', () => {
  // Two assertions, deliberately: zero importers alone would pass over a
  // resurrected module nobody imports YET. Comments are NOT scanned —
  // `store.mjs:281`, `store.test.mjs:266,269`, `run-check.test.mjs:32`
  // mention the name as history, and this pattern only matches a real
  // `export function` declaration.
  const files = globSync(WALK_GLOBS, { cwd: repoRoot }).map((f) => f.split(sep).join('/'));
  const defined = files.filter((relFile) => {
    const src = readFileSync(join(repoRoot, relFile), 'utf8');
    return /^\s*export\s+function\s+readChunkObservations\b/m.test(src);
  });
  assert.deepEqual(defined, [], 'readChunkObservations must not be redefined anywhere');
});

// ── D4 guard 4 — PR #258's readers stay records-only (spec.md, pin) ────────

test('brain-audit.mjs and brain-check.mjs import readRecordObservations, never a chunk reader (D4 guard 4)', () => {
  // Green on arrival, not red-first — PR #258 already migrated both readers.
  // Stated as a regression pin, not a red-first, per spec.md's scenario.
  for (const relFile of ['brain/scripts/brain-audit.mjs', 'brain/scripts/brain-check.mjs']) {
    const src = readFileSync(join(repoRoot, relFile), 'utf8');
    assert.match(
      src,
      /import\s*\{[^}]*\breadRecordObservations\b[^}]*\}\s*from\s*['"][^'"]*store\.mjs['"]/,
      `${relFile} must import readRecordObservations`,
    );
    assert.doesNotMatch(src, /\breadChunkObservations\b/, `${relFile} must never reference readChunkObservations`);
    assert.doesNotMatch(
      src,
      /\bcollectChunkObservations\b/,
      `${relFile} must never reference collectChunkObservations`,
    );
  }
});
