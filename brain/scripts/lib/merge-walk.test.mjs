// merge-walk.test.mjs — unit tests for lib/merge-walk.mjs's baseline-resolution
// helpers (issue #324 fix round — B2).
//
// `resolveBaseline`/`makeGitIsAncestor` moved here from brain-audit.mjs so
// brain-metrics can share the EXACT same baseline decision brain-audit makes
// (design D1: shared code prevents drift between measurement and enforcement).
// Before this fix, brain-metrics had no baseline awareness at all, so it
// reported gate failures on merges brain-audit itself never evaluated.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { removeTempTree } from '../__fixtures__/tmp-tree.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { resolveBaseline, makeGitIsAncestor, evaluateMerge, fetchPrMeta } from './merge-walk.mjs';

function makeRepo(dir) {
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '--initial-branch=main');
  git('config', 'user.email', 'test@test.com');
  git('config', 'user.name', 'Test');
  return git;
}

function commit(git, dir, message) {
  git('commit', '--allow-empty', '-m', message);
}

test('resolveBaseline: a valid ref resolves and carries no warning', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-walk-baseline-'));
  t.after(() => removeTempTree(dir));
  const git = makeRepo(dir);
  commit(git, dir, 'chore: initial');
  git('tag', 'v0.1.0');

  const { ref, warning } = resolveBaseline('v0.1.0', dir);
  assert.equal(ref, 'v0.1.0');
  assert.equal(warning, null);
});

test('resolveBaseline: a null/undefined baseline resolves to null, no warning', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-walk-baseline-null-'));
  t.after(() => removeTempTree(dir));
  assert.deepEqual(resolveBaseline(null, dir), { ref: null, warning: null });
  assert.deepEqual(resolveBaseline(undefined, dir), { ref: null, warning: null });
});

test('resolveBaseline: an unresolvable ref falls back to null WITH a warning message (caller decides where it goes)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-walk-baseline-invalid-'));
  t.after(() => removeTempTree(dir));
  const git = makeRepo(dir);
  commit(git, dir, 'chore: initial');

  const { ref, warning } = resolveBaseline('v99.0.0-nonexistent', dir);
  assert.equal(ref, null);
  assert.match(warning, /v99\.0\.0-nonexistent/);
  assert.match(warning, /does not resolve/i);
});

test('makeGitIsAncestor: true when baseline is an ancestor of sha', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-walk-ancestor-'));
  t.after(() => removeTempTree(dir));
  const git = makeRepo(dir);
  commit(git, dir, 'chore: base');
  const base = git('rev-parse', 'HEAD').stdout.trim();
  commit(git, dir, 'chore: after');
  const after = git('rev-parse', 'HEAD').stdout.trim();

  const isAncestor = makeGitIsAncestor(dir);
  assert.equal(isAncestor(base, after), true);
});

test('makeGitIsAncestor: false when baseline is NOT an ancestor of sha', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-walk-ancestor-not-'));
  t.after(() => removeTempTree(dir));
  const git = makeRepo(dir);
  commit(git, dir, 'chore: base');
  const base = git('rev-parse', 'HEAD').stdout.trim();
  git('checkout', '-b', 'side');
  commit(git, dir, 'chore: side commit');
  const side = git('rev-parse', 'HEAD').stdout.trim();
  git('checkout', 'main');
  commit(git, dir, 'chore: unrelated main commit');
  const mainTip = git('rev-parse', 'HEAD').stdout.trim();

  const isAncestor = makeGitIsAncestor(dir);
  // `side` is NOT an ancestor of mainTip (diverged branch) — baseline is NOT before sha.
  assert.equal(isAncestor(side, mainTip), false);
});

// ── evaluateMerge: tier-scoped diff budget (issue #358 Q5, REQ-TIER-9/REQ-TIER-6) ──
//
// CRITICAL fix: evaluateMerge used to call diffSize(numstat, ignoreList) with NO
// budget argument, silently falling back to diff-size.mjs's own module-level
// DEFAULT_BUDGET (400) — and honored size:exception unconditionally, with zero
// tier awareness. Both are now explicit ctx params (`diffBudget`,
// `honorSizeException`) resolved by the CALLER (brain-audit.mjs / brain-metrics.mjs)
// from `tierParams(resolveTier(config))` — this layer stays pure and tier-agnostic.

/** A resolutionGit stub that reports the tree-keyed failure as LIVE (not a
 * cleanup revert) — `addedPathsAbsentAt` returns false because the added path
 * is present both in the merge's own diff AND at the tip, so `evaluateMerge`
 * never reaches (or needs) `netAddFull`. */
function makeLiveTreeGitStub() {
  return {
    orThrow(argv) {
      if (argv.includes('ls-tree')) return 'src/big.mjs\0';
      if (argv.includes('--diff-filter=AM')) return 'src/big.mjs\0';
      // `revertResurrectsAt` (nominable computation) — no removed lines to report;
      // its result is irrelevant to these budget/waiver assertions.
      if (argv.includes('--diff-filter=AMD')) return '';
      throw new Error(`unexpected git call in test stub: ${argv.join(' ')}`);
    },
  };
}

test('evaluateMerge: lite tier (diffBudget 1000) passes a 900-line diff that would fail at the old hardcoded 400 default', () => {
  const rec = evaluateMerge('deadbee', {
    numstat: '900\t0\tsrc/big.mjs\n',
    changedFiles: ['src/big.mjs'],
    issueLinkBody: 'Closes #358',
    prLabels: [],
    ignoreList: [],
    allObservations: [{ type: 'session_summary' }],
    resolutionGit: makeLiveTreeGitStub(),
    windowFrom: 'deadbee',
    windowTo: 'deadbee',
    diffBudget: 1000,
    honorSizeException: true,
    tier: 'lite',
  });

  assert.equal(rec.kind, 'pass', `expected pass at lite (900 <= 1000): ${JSON.stringify(rec)}`);
  assert.equal(rec.realResults.diffSize.pass, true);
});

test('evaluateMerge: regulated tier (diffBudget 200, honorSizeException false) FAILS a 260-line diff even WITH size:exception present', () => {
  const rec = evaluateMerge('deadbee', {
    numstat: '260\t0\tsrc/big.mjs\n',
    changedFiles: ['src/big.mjs'],
    issueLinkBody: 'Closes #358',
    prLabels: ['size:exception'],
    ignoreList: [],
    allObservations: [{ type: 'session_summary' }],
    resolutionGit: makeLiveTreeGitStub(),
    windowFrom: 'deadbee',
    windowTo: 'deadbee',
    diffBudget: 200,
    honorSizeException: false,
    tier: 'regulated',
  });

  assert.equal(rec.kind, 'fail', `expected fail at regulated (260 > 200, waiver refused): ${JSON.stringify(rec)}`);
  assert.equal(rec.sizeSkipped, false, 'regulated must NOT honor size:exception');
  const [, diffSizeResult] = rec.failures.find(([name]) => name === 'diffSize');
  assert.match(diffSizeResult.reason, /size:exception is not honored/);
  assert.match(diffSizeResult.reason, /"regulated" tier/);
});

test('evaluateMerge: with no diffBudget/honorSizeException supplied, falls back to the pre-tier 400/honored default (backward compatibility)', () => {
  const rec = evaluateMerge('deadbee', {
    numstat: '401\t0\tsrc/big.mjs\n',
    changedFiles: ['src/big.mjs'],
    issueLinkBody: 'Closes #358',
    prLabels: [],
    ignoreList: [],
    allObservations: [{ type: 'session_summary' }],
    resolutionGit: makeLiveTreeGitStub(),
    windowFrom: 'deadbee',
    windowTo: 'deadbee',
  });

  assert.equal(rec.kind, 'fail', `expected the legacy 400-line default to still apply when no budget is passed: ${JSON.stringify(rec)}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// #474 (REQ-TS-1/-3) — fetchPrMeta distinguishes "could not fetch" from
// "genuinely empty". The bare `catch {}` this replaces KNEW the fetch had
// failed and discarded it, so selectIssueLinkBody fell back to the
// auto-generated merge commit body and issueLink rendered a CONFIDENT FAIL.
// These pin the three states apart at the seam.
// ═══════════════════════════════════════════════════════════════════════════

test('REQ-TS-1: a FAILED prView fetch surfaces prMetaError (never swallowed)', async () => {
  const vcs = { prView: async () => { throw new Error('HTTP 502: Bad Gateway'); } };
  const r = await fetchPrMeta('Merge pull request #471 from x/y', vcs, { project: { slug: 'o/r' } });

  assert.equal(r.prMetaError, 'HTTP 502: Bad Gateway',
    'the failure reason must survive as data — discarding it is the #474 defect');
  assert.equal(r.prLabels, null, 'a failed fetch must not fabricate labels');
  assert.equal(r.prBody, null, 'a failed fetch must not fabricate a body');
  assert.equal(r.prNum, 471);
});

test('REQ-TS-1: a SUCCESSFUL fetch of a genuinely empty PR sets no prMetaError', async () => {
  // The distinction that matters: labels [] and body '' are REAL evidence of
  // emptiness. They must never be confused with an unreachable API.
  const vcs = { prView: async () => ({ labels: [], body: '' }) };
  const r = await fetchPrMeta('Merge pull request #12 from x/y', vcs, {});

  assert.equal(r.prMetaError, null, 'a successful fetch is never uncomputable');
  assert.deepEqual(r.prLabels, []);
  assert.equal(r.prBody, '');
});

test('REQ-TS-3: no PR number in the subject is NOT uncomputable (nothing to fetch)', async () => {
  const vcs = { prView: async () => { throw new Error('must not be called'); } };
  const r = await fetchPrMeta('fix: a squash merge with no PR reference', vcs, {});

  assert.equal(r.prNum, null);
  assert.equal(r.prMetaError, null,
    'the ABSENCE of a PR is real evidence, not missing evidence — audit the commit body');
});

test('REQ-TS-3: an unconfigured VCS adapter is NOT uncomputable (a configuration)', async () => {
  const r = await fetchPrMeta('Merge pull request #9 from x/y', null, {});

  assert.equal(r.prMetaError, null,
    'an unconfigured adapter degrades uniformly and is surfaced as a [WARN], never a window halt');
  assert.equal(r.prLabels, null);
});

// This is the one that matters: it is the shape the REAL provider returns on an
// unauthenticated `gh`, and therefore the path the #467 outage over c724942
// actually took. `prView` never throws (REQ-CIC-2) — reading #474's issue text
// alone, which names only the bare `catch {}`, would have shipped a fix that
// never fired.
test('REQ-TS-1: prView\'s null/null REQ-CIC-2 sentinel is uncomputable (the real #467 path)', async () => {
  const vcs = {
    prView: async ({ number }) => ({
      number, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null,
    }),
  };
  const r = await fetchPrMeta('Merge pull request #471 from x/y', vcs, {});

  assert.ok(r.prMetaError !== null,
    'null labels AND null body is prView\'s uncomputable sentinel — consumers MUST fail closed on it (REQ-CIC-2)');
  assert.ok(/#471/.test(r.prMetaError), `the message must name the PR: ${r.prMetaError}`);
});

test('REQ-TS-1: a PR with real labels but a null body is NOT the sentinel', async () => {
  // Only null/null is unambiguous. A partial null must not poison the window.
  const vcs = { prView: async ({ number }) => ({ number, labels: ['type:bug'], body: null }) };
  const r = await fetchPrMeta('Merge pull request #5 from x/y', vcs, {});

  assert.equal(r.prMetaError, null, 'a successful fetch carrying evidence is never uncomputable');
  assert.deepEqual(r.prLabels, ['type:bug']);
});

test('REQ-TS-1: fetchPrMeta still never throws, whatever prView does', async () => {
  const vcs = { prView: async () => { throw 'a bare string, not an Error'; } };
  const r = await fetchPrMeta('Merge pull request #3 from x/y', vcs, {});

  assert.equal(typeof r.prMetaError, 'string');
  assert.ok(r.prMetaError.includes('bare string'), `expected the thrown value stringified, got ${r.prMetaError}`);
});
