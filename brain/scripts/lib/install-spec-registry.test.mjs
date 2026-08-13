// install-spec-registry.test.mjs — the install spec becomes a package name
// (issue #644, ADR-0030 Decision 3).
//
// WHY THIS RUNS BEFORE THE RENAME. `"name"` is still `brain`, so every registry
// branch below is unreachable through the normal call path. A resolver that only
// runs correctly after the rename is a resolver that has never run — the same
// argument #625 made, and the same technique: inject the name.
//
// WHAT ADR-0030 FORBIDS, and what this file is really guarding:
//
//   "Never translate a git-ref version check into a registry one without
//    re-deriving it."
//
// A git tag and a registry version are not the same object. The tag is
// `v1.2.0`; the published version is `1.2.0`. Feeding one where the other is
// expected does not throw — it produces a spec npm resolves to nothing, or a
// comparison that silently orders wrong. So the `v` boundary is decided ONCE,
// here, and the git path keeps the ref VERBATIM because a git ref is a name and
// not a number.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveInstallSpec,
  specVersion,
  highestVersion,
  highestTag,
  installSpec,
  BRAIN_REPO_HTTPS,
  PACKAGE_NAME,
} from './installer.mjs';

const SCOPED = '@csrinaldi/brain';
const REPO = 'git+https://github.com/csrinaldi/brain.git';

// ── The boundary: a version is not a tag ────────────────────────────────────

test('#644: `v1.2.0` and `1.2.0` name the same release, and the registry wants the bare one', () => {
  assert.equal(specVersion('v1.2.0'), '1.2.0');
  assert.equal(specVersion('1.2.0'), '1.2.0');
  assert.equal(specVersion('v1.2.0-rc.1'), '1.2.0-rc.1', 'a prerelease keeps everything after the version');
});

test('#644: specVersion refuses what it cannot read rather than inventing a version', () => {
  for (const bad of [null, undefined, '', '   ', 'latest', 'main']) {
    assert.equal(specVersion(bad), null, `specVersion(${JSON.stringify(bad)}) should be null, not a guess`);
  }
});

// ── The two shapes ──────────────────────────────────────────────────────────

test('#644: a scoped installed name resolves to a REGISTRY spec', () => {
  const r = resolveInstallSpec({ name: SCOPED, version: 'v1.2.0', repoUrl: REPO });
  assert.equal(r.kind, 'registry');
  assert.equal(r.spec, '@csrinaldi/brain@1.2.0', 'the `v` must be stripped — npm has no `v1.2.0`');
});

test('#644: an UNSCOPED installed name keeps the git URL — byte-identical to today', () => {
  const r = resolveInstallSpec({ name: 'brain', version: 'v1.2.0', repoUrl: REPO });
  assert.equal(r.kind, 'git');
  assert.equal(r.spec, `${REPO}#v1.2.0`);
});

test('#644: the git path keeps the ref VERBATIM — a ref is a name, not a number', () => {
  // Stripping the `v` here would produce `#1.2.0`, a ref that does not exist.
  // This is the exact one-for-one translation ADR-0030 names as the error.
  const r = resolveInstallSpec({ name: 'brain', version: 'v1.2.0', repoUrl: REPO });
  assert.match(r.spec, /#v1\.2\.0$/);
});

test('#644: a missing repoUrl falls back to the constant, and SAYS it did', () => {
  const r = resolveInstallSpec({ name: 'brain', version: 'v1.2.0', repoUrl: null });
  assert.equal(r.spec, `${BRAIN_REPO_HTTPS}#v1.2.0`);
  assert.equal(r.source, 'fallback',
    'the caller must be able to tell a manifest-derived spec from a guessed one — a silent fallback is the #601 shape');
});

test('#644: a manifest-derived spec is marked as such, so the two are distinguishable', () => {
  assert.equal(resolveInstallSpec({ name: 'brain', version: 'v1', repoUrl: REPO }).source, 'manifest');
  assert.equal(resolveInstallSpec({ name: SCOPED, version: '1.2.0', repoUrl: REPO }).source, 'manifest');
});

test('#644: a scoped name with an unreadable version does not silently produce `@scope/name@null`', () => {
  const r = resolveInstallSpec({ name: SCOPED, version: 'main', repoUrl: REPO });
  assert.equal(r.kind, 'unresolved');
  assert.match(r.why, /main/, 'the reason must name what could not be read');
  assert.equal(r.spec, null);
});

// ── Ranking: the registry is asked, not parsed ──────────────────────────────

test('#644: highestVersion ranks a registry version LIST', () => {
  assert.equal(highestVersion(['1.0.0', '1.10.0', '1.9.0', '0.4.2']), '1.10.0');
});

test('#644: a prerelease never outranks a release, in either input order', () => {
  // MEASURED, and the reason this rule is explicit rather than left to the
  // sort: `compareSemver` reads only major.minor.patch, so `1.0.0-rc.1` and
  // `1.0.0` compare EQUAL. `Array.prototype.sort` is stable, so a naive
  // `.sort(compareSemver).at(-1)` would return whichever the registry happened
  // to list last — an answer that depends on input order and looks correct in
  // whichever direction you first test it.
  assert.equal(highestVersion(['1.0.0-rc.1', '1.0.0']), '1.0.0');
  assert.equal(highestVersion(['1.0.0', '1.0.0-rc.1']), '1.0.0');
  assert.equal(highestVersion(['1.0.0', '1.1.0-rc.1']), '1.0.0',
    'check-and-notify must never tell an operator to install an rc');
});

test('#644: with only prereleases there is no release to name, and that is not a read failure', () => {
  // null here means "nothing PUBLISHED as a release". The caller still holds the
  // raw list, so it can distinguish this from "could not read the registry" —
  // which is the distinction ADR-0030 Amendment 1 (#629) makes doctrine.
  assert.equal(highestVersion(['1.0.0-rc.1', '1.0.0-rc.2']), null);
});

test('#644: highestVersion returns null on nothing, and never throws on junk', () => {
  assert.equal(highestVersion([]), null);
  assert.equal(highestVersion(null), null);
  assert.equal(highestVersion(['latest', 'main']), null);
});

test('#644: highestTag on REGISTRY output returns nothing — proof the two are not interchangeable', () => {
  // The re-derivation ADR-0030 demands, made concrete. `highestTag` looks for
  // `refs/tags/…` lines; a registry version list has none. Reused blindly it
  // would report "no versions" on a healthy registry — indistinguishable from a
  // package that has never been published.
  const registryOutput = ['1.0.0', '1.10.0'].join('\n');
  assert.equal(highestTag(registryOutput), null);
  assert.equal(highestVersion(['1.0.0', '1.10.0']), '1.10.0');
});

// ── Nothing changes today ───────────────────────────────────────────────────

test('#644: unscoped today — installSpec still returns exactly what it returned before', () => {
  assert.equal(PACKAGE_NAME, 'brain',
    'PACKAGE_NAME has been scoped — this test pins the pre-rename contract and should be revisited with it');
  // No node_modules/brain in the brain source repo, so this exercises the
  // documented fallback path, which is what a consumer hits on a fresh adopt.
  assert.equal(installSpec('/nonexistent-consumer', 'v1.2.0'), `${BRAIN_REPO_HTTPS}#v1.2.0`);
});
