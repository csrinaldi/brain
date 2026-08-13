// installed-package-root.resolve.test.mjs — new code must find an OLD install
// (issue #625).
//
// THE BREAK THIS DOES NOT FIX, stated first so the scope is not mistaken. A
// consumer on the git-tag install has `node_modules/brain`. The release that
// carries the scoped name kills their `brain:upgrade` mid-run: their vendored
// OLD code resolves `node_modules/brain`, `installSpec` installs from the git
// URL, npm reads the NEW package.json and lands the tree in
// `node_modules/@scope/brain`, and the old code then finds nothing. That code
// is already in their tree; nothing written here reaches it.
//
// WHAT IS FIXABLE is the mirror: NEW code finding an OLD install. After any
// recovery a tree can hold `node_modules/brain` while the running code expects
// the scoped path, and today that reads as "not installed".
//
// WHY IT IS TESTED WITH AN INJECTED NAME. `PACKAGE_NAME` is still `brain`
// today, so the fallback is inert until the rename. Shipping it untested until
// the day it matters is how a safety net is discovered to be missing while
// being used. `packageName` and `exists` are injectable so the scoped
// behaviour runs now.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  resolveInstalledPackageRoot,
  describeInstalledPackageSearch,
  installedPackageSearchPaths,
  PACKAGE_NAME,
  LEGACY_PACKAGE_DIR,
} from './installer.mjs';

const SCOPED = '@csrinaldi/brain';
const ROOT = '/consumer';
const scopedPath = join(ROOT, 'node_modules', '@csrinaldi', 'brain');
const legacyPath = join(ROOT, 'node_modules', 'brain');

/** A fake fs: only the listed paths exist. */
const only = (...present) => (p) => present.includes(p);

test('#625: a scoped install is found where it is', () => {
  assert.equal(
    resolveInstalledPackageRoot({ repoRoot: ROOT, packageName: SCOPED, exists: only(scopedPath) }),
    scopedPath,
  );
});

test('#625: a LEGACY install is found when the scoped path is absent', () => {
  assert.equal(
    resolveInstalledPackageRoot({ repoRoot: ROOT, packageName: SCOPED, exists: only(legacyPath) }),
    legacyPath,
  );
});

test('#625: the scoped path wins when BOTH exist — the legacy one is a fallback, not a preference', () => {
  assert.equal(
    resolveInstalledPackageRoot({ repoRoot: ROOT, packageName: SCOPED, exists: only(scopedPath, legacyPath) }),
    scopedPath,
  );
});

test('#625: with neither present it returns the CANONICAL path, so an error names what to create', () => {
  assert.equal(
    resolveInstalledPackageRoot({ repoRoot: ROOT, packageName: SCOPED, exists: only() }),
    scopedPath,
  );
});

test('#625: trailing segments are appended to whichever root won', () => {
  const rest = ['brain', 'core', 'managed-paths.mjs'];
  assert.equal(
    resolveInstalledPackageRoot({ repoRoot: ROOT, packageName: SCOPED, rest, exists: only(legacyPath) }),
    join(legacyPath, ...rest),
  );
  assert.equal(
    resolveInstalledPackageRoot({ repoRoot: ROOT, packageName: SCOPED, rest, exists: only(scopedPath) }),
    join(scopedPath, ...rest),
  );
});

test('#625: unscoped today — the canonical and legacy paths coincide, so nothing changes before the rename', () => {
  assert.equal(PACKAGE_NAME, LEGACY_PACKAGE_DIR,
    'PACKAGE_NAME has been scoped — this test documents the pre-rename state and should be revisited with it');
  assert.equal(
    resolveInstalledPackageRoot({ repoRoot: ROOT, packageName: PACKAGE_NAME, exists: only() }),
    legacyPath,
  );
});

// ── The failure has to be legible ───────────────────────────────────────────
//
// A resolver that searches two places and an error that names one is worse than
// no fallback at all: the reader is sent to inspect a path the code never looked
// at. `brain:upgrade` is the verb a consumer runs to RECOVER, so its death
// message is the last thing they get before they are on their own.

test('#625: the searched-paths list is exactly what the resolver probes, in the same order', () => {
  assert.deepEqual(
    installedPackageSearchPaths({ packageName: SCOPED }),
    ['node_modules/@csrinaldi/brain', 'node_modules/brain'],
  );
});

test('#625: a failure message names BOTH places that were searched', () => {
  const text = describeInstalledPackageSearch({ packageName: SCOPED });
  assert.match(text, /node_modules\/@csrinaldi\/brain/,
    'the canonical path is missing — the reader cannot tell where the code expected to find brain');
  assert.match(text, /node_modules\/brain/,
    'the pre-rename path is missing — the fallback searched it and the message hides that it did');
});

test('#625: before the rename it names ONE path — no phantom second location', () => {
  assert.deepEqual(installedPackageSearchPaths({ packageName: PACKAGE_NAME }), ['node_modules/brain']);
  const text = describeInstalledPackageSearch({ packageName: PACKAGE_NAME });
  assert.equal(text, 'node_modules/brain',
    'today the two paths coincide; a message inventing a second one sends the reader to look twice at one directory');
});

test('#625: trailing segments appear on every named path, not just the first', () => {
  const text = describeInstalledPackageSearch({ packageName: SCOPED, rest: ['package.json'] });
  assert.match(text, /node_modules\/@csrinaldi\/brain\/package\.json/);
  assert.match(text, /node_modules\/brain\/package\.json/);
});

/**
 * Executable lines of a file — comments stripped, so prose ABOUT the legacy path
 * (of which both entry points carry several, deliberately) is not read as code
 * resolving it.
 *
 * Throws rather than returning `''`: an unreadable file must not pass as a file
 * with no offending lines.
 */
function executableLines(relPath) {
  const full = fileURLToPath(new URL(`../${relPath}`, import.meta.url));
  const lines = readFileSync(full, 'utf8').split('\n');
  const kept = lines.filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
  if (kept.length === 0) throw new Error(`${relPath}: every line read as a comment — the stripper is broken, not the file`);
  return kept;
}

test('#625: the entry points do not hardcode the path they claim to have searched', () => {
  // The two sites that die when brain is not installed. Their text used to be a
  // literal, which after the rename would name a path the code never searched —
  // the worst kind of error message, because it is confidently wrong.
  const SITES = ['brain-upgrade.mjs', 'cli-entry.mjs'];
  const offenders = [];
  for (const site of SITES) {
    const hits = executableLines(site)
      .map((l, i) => ({ line: i + 1, text: l }))
      .filter((e) => /node_modules\/brain/.test(e.text));
    for (const h of hits) offenders.push(`  ${site}: ${h.text.trim()}`);
  }
  assert.deepEqual(
    offenders, [],
    'these spell the installed root into executable text instead of deriving it from PACKAGE_NAME:\n'
      + offenders.join('\n')
      + '\n\n  Use describeInstalledPackageSearch() from lib/installer.mjs.'
      + '\n\n  KNOWN AND DELIBERATE, not covered here: lib/init.mjs\'s BOOTSTRAP_SCRIPT_VALUE writes'
      + '\n  `node node_modules/brain/brain/scripts/brain-upgrade.mjs` into the CONSUMER\'s package.json.'
      + '\n  That is a third site of the same defect and changing it changes what is written to'
      + '\n  someone else\'s file, so it travels with the rename — see the PR for #625.',
  );
});
