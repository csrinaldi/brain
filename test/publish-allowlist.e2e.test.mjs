// publish-allowlist.e2e.test.mjs — the published tarball carries every byte a
// consumer needs, and nothing else (issue #607).
//
// WHY THIS EXISTS. `package.json` had no `files` field, so a publish would have
// shipped 1053 files and 16.8 MB — `.memory/` (2177 session records),
// `openspec/`, the whole test tree. An over-broad first publish cannot be
// cleanly unpublished, and `private: true` was the only thing preventing it.
//
// WHY IT MEASURES `npm pack` RATHER THAN THE `files` ARRAY. Reading the array
// back would only prove the array says what it says. npm applies its own rules
// on top — always-included files, always-excluded ones, and its handling of
// dot-directories, which is the half most likely to surprise. The evidence has
// to be the tarball listing, so what is asserted is what would actually ship.
//
// THE RULE. `managed` in brain/core/managed-paths.mjs is the authoritative list
// of what brain installs into a consumer. A path whose strategy needs BRAIN'S
// BYTES — copy, refuse, merge — must be in the tarball, or `brain:upgrade`
// breaks for a consumer on the release that first needs the missing file, which
// is #601's shape. A `regenerate` path must NOT be: it is compiled in the
// consumer from SOURCE_DOCS, and shipping brain's own would be a file
// describing the wrong repository (#397).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { managed, managedStrategy, STRATEGY } from '../brain/core/managed-paths.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Strategies that need brain's bytes present in the package. */
const NEEDS_BYTES = Object.freeze([STRATEGY.COPY, STRATEGY.REFUSE, STRATEGY.MERGE]);

/**
 * Roots that must never ship. Not the inverse of the allowlist — an explicit
 * list, so a future `files` entry that re-admits one fails here by name
 * instead of only moving a byte count.
 */
const MUST_NOT_SHIP = Object.freeze([
  { path: '.memory', why: '2177 session records narrating internal decisions; the #410/#427 records bypassed the secret-scrub backend path' },
  { path: 'openspec', why: 'in-flight and archived change artifacts — 5.3 MB of this project, meaningless to a consumer' },
  { path: 'test', why: "brain's own suites; the consumer runs the ones vendored under brain/scripts/**" },
  { path: 'docs', why: 'documentation of this repository, not of the product a consumer installs' },
  { path: '.brain-source', why: 'the marker brain:upgrade and npx brain init use to REFUSE running inside brain\'s own checkout' },
]);

/**
 * A canary, not a budget. It catches an accidental bulk addition that no named
 * rule above anticipated. Raise it deliberately when the product genuinely
 * grows; if raising it is ever the quick fix for a red run, read what got added
 * first.
 */
const SIZE_CANARY_MB = 8;

/**
 * The real packed listing. Throws rather than returning `[]`: an empty file
 * list would satisfy every "must not ship" assertion below and prove nothing —
 * "the pack failed" and "the tarball is clean" must not share a verdict.
 *
 * @returns {{files: string[], unpackedSize: number, entryCount: number}}
 */
function packedContents() {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(out);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const files = (entry?.files ?? []).map((f) => f.path);
  if (files.length === 0) throw new Error('npm pack reported no files — the pack failed, the tarball is not empty');
  return { files, unpackedSize: entry.unpackedSize, entryCount: entry.entryCount };
}

/** Is `managedPath` (a literal or a `**` glob) represented in the packed list? */
function isPacked(managedPath, files) {
  if (managedPath.endsWith('/**')) {
    const prefix = `${managedPath.slice(0, -2)}`; // keep the trailing slash
    return files.some((f) => f.startsWith(prefix));
  }
  return files.includes(managedPath);
}

const { files, unpackedSize, entryCount } = packedContents();
const byteNeeding = managed.filter((p) => NEEDS_BYTES.includes(managedStrategy[p] ?? STRATEGY.COPY));

// ── Vacuity guards — a broken reader must not read as a clean tarball ───────

test('publish-allowlist: the pack and the managed list both produced real evidence', () => {
  assert.ok(files.length > 100, `npm pack listed only ${files.length} files — the pack, not the allowlist, is what to look at`);
  assert.ok(managed.length >= 10, `managed lists only ${managed.length} paths — managed-paths.mjs was misread`);
  assert.ok(byteNeeding.length >= 10,
    `only ${byteNeeding.length} byte-needing paths derived from ${managed.length} managed — the strategy lookup is wrong`);
  console.log(`      # tarball: ${entryCount} files, ${(unpackedSize / 1048576).toFixed(2)} MB unpacked`);
});

// ── The rule ────────────────────────────────────────────────────────────────

test('publish-allowlist: every managed path that needs brain\'s bytes is in the tarball', () => {
  const missing = byteNeeding.filter((p) => !isPacked(p, files));
  assert.deepEqual(
    missing, [],
    'these paths are installed into a consumer but would NOT ship, so brain:upgrade breaks on the release that first needs them (#601):\n'
      + missing.map((p) => `  ${p}  (${managedStrategy[p] ?? 'copy'})`).join('\n')
      + '\n\n  Add them to `files` in package.json — the list is derived from `managed`, not hand-maintained.',
  );
});

test('publish-allowlist: a `regenerate` path is NOT shipped (#397 — a file describing the wrong repository)', () => {
  const regenerated = Object.entries(managedStrategy)
    .filter(([, s]) => s === STRATEGY.REGENERATE)
    .map(([p]) => p);
  assert.ok(regenerated.length > 0, 'no regenerate path found — the strategy map changed shape and this guard went inert');
  const shipped = regenerated.filter((p) => files.includes(p));
  assert.deepEqual(
    shipped, [],
    `these are compiled in the consumer from SOURCE_DOCS and must not ship: ${shipped.join(', ')}`,
  );
});

test('publish-allowlist: nothing on the must-not-ship list is in the tarball', () => {
  const leaked = MUST_NOT_SHIP.filter((e) => files.some((f) => f === e.path || f.startsWith(`${e.path}/`)));
  assert.deepEqual(
    leaked.map((e) => e.path), [],
    'these would be published and cannot be cleanly unpublished:\n'
      + leaked.map((e) => `  ${e.path} — ${e.why}`).join('\n'),
  );
});

test('publish-allowlist: the tarball has not silently gained bulk (canary, not a budget)', () => {
  const mb = unpackedSize / 1048576;
  assert.ok(
    mb < SIZE_CANARY_MB,
    `the tarball is ${mb.toFixed(2)} MB, over the ${SIZE_CANARY_MB} MB canary. Read what was added before raising it — `
      + 'this exists to catch bulk no named rule anticipated.',
  );
});

test('publish-allowlist: the package is licensed, and the licence file ships', () => {
  // A public repo with no licence is all-rights-reserved: legally unadoptable.
  const pkg = JSON.parse(execFileSync('node', ['-p', 'JSON.stringify(require("./package.json"))'],
    { cwd: REPO_ROOT, encoding: 'utf8' }));
  assert.equal(pkg.license, 'MIT', `package.json declares license "${pkg.license}"`);
  assert.ok(files.includes('LICENSE'), 'LICENSE is not in the tarball — the declared licence would not travel with the package');
});
