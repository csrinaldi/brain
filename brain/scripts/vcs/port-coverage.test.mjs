// port-coverage.test.mjs — M10 Phase 1 (#336). The audit is detection-only, so
// its own correctness is the whole deliverable: a report that miscounts is
// worse than no report, because Phase 2 slices from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exportedVerbs, foldProvenance, classifyProvenance, coverageOf, countConsumers, buildReport } from './port-coverage.mjs';

// ── R336-1: verbs come from the adapter, not a list ─────────────────────────

test('#336: verbs are read from the adapter source — both function forms, no constants', () => {
  const src = [
    "export const PROVIDER = 'github';",
    'export const CONTRIBUTOR_SCAFFOLD = Object.freeze({});',
    'export async function authCheck({ host } = {}) {}',
    'export function repoCloneUrl(x) {}',
    'async function notExported() {}',
    '// export async function commentedOut() {}',
  ].join('\n');
  assert.deepEqual(exportedVerbs(src), ['authCheck', 'repoCloneUrl'],
    'exported functions only — constants are not verbs and a commented line is not code');
});

// ── R336-2: provenance is read, and disagreement survives ───────────────────

test('#336: provenance folds to recorded / derived / mixed / none', () => {
  assert.equal(foldProvenance([]), 'none', 'no fixture is not a provenance');
  assert.equal(foldProvenance([{ derived: true }]), 'derived');
  assert.equal(foldProvenance([{ recorded: '2026-07-30' }]), 'recorded');
  assert.equal(foldProvenance([{ recorded: 'x' }, { recorded: 'y' }]), 'recorded');
  assert.equal(foldProvenance([{ derived: true }, { recorded: 'x' }]), 'mixed',
    'a verb whose fixtures disagree is the #334 shape — never collapsed to the first one');
});

test('#336: a fixture that could not be read is UNREADABLE, never "none"', () => {
  assert.equal(foldProvenance([{ unreadable: true }]), 'unreadable');
  assert.equal(foldProvenance([{ recorded: 'x' }, { unreadable: true }]), 'unreadable',
    'one unreadable file makes the whole answer unreliable — absent evidence is not evidence of absence');
});

test('#336: a fixture with _provenance but neither flag reads as recorded-by-endpoint, not as none', () => {
  assert.equal(foldProvenance([{ endpoint: 'GET /x', date: '2026-07-30' }]), 'recorded',
    'the fixtures that predate the explicit flags carry an endpoint and a date — that IS a recording');
});

// ── R336-3 / coverage ───────────────────────────────────────────────────────

test('#336: coverage distinguishes contract, elsewhere and uncovered', () => {
  const contract = 'test("github.prView (contract): ...")';
  const elsewhere = 'const r = await gh.labelAdd({});';
  assert.equal(coverageOf('prView', contract, elsewhere), 'contract');
  assert.equal(coverageOf('labelAdd', contract, elsewhere), 'elsewhere',
    'covered somewhere weaker is a real state, not a synonym for covered');
  assert.equal(coverageOf('prReviews', contract, elsewhere), 'uncovered');
});

test('#336: a verb name that is only a SUBSTRING of another does not borrow its coverage', () => {
  const contract = 'test("github.issueListComments (contract): ...")';
  assert.equal(coverageOf('issueList', contract, ''), 'uncovered',
    'issueList is not covered by a test for issueListComments — word boundaries, not includes()');
});

test('#336: consumers are counted at the call site, and a provider calling itself is not one', () => {
  const consumers = [
    { file: 'brain/scripts/review/cli.mjs', text: 'await vcs.prReviews({}); await vcs.prReviews({});' },
    { file: 'brain/scripts/status/cli.mjs', text: 'await vcs.prReviews({});' },
    { file: 'brain/scripts/status/cli.mjs', text: 'vcs.issueView({})' },
  ];
  assert.equal(countConsumers('prReviews', consumers), 2, 'distinct FILES, not raw call count');
  assert.equal(countConsumers('issueView', consumers), 1);
  assert.equal(countConsumers('nobodyCallsMe', consumers), 0);
});

// ── R336-3: the gap list is ranked by blast radius ──────────────────────────

test('#336: uncovered rows sort by consumer count descending — the ranking the ticket exists for', () => {
  const report = buildReport({
    adapters: { github: 'export async function prReviews(){}\nexport async function patSetupUrl(){}\nexport async function prView(){}' },
    fixtures: [],
    contractText: 'test("github.prView (contract)")',
    otherTestText: '',
    consumers: [
      { file: 'a.mjs', text: 'vcs.prReviews()' },
      { file: 'b.mjs', text: 'vcs.prReviews()' },
      { file: 'c.mjs', text: 'vcs.patSetupUrl()' },
    ],
  });
  const uncovered = report.rows.filter((r) => r.coverage === 'uncovered').map((r) => r.verb);
  assert.deepEqual(uncovered, ['prReviews', 'patSetupUrl'],
    'alphabetical order is what let prReviews hide (#317) — blast radius first');
  assert.equal(report.rows.find((r) => r.verb === 'prView').coverage, 'contract');
});

test('#336: every exported verb reaches the report, covered or not', () => {
  const report = buildReport({
    adapters: { github: 'export function a(){}\nexport async function b(){}', gitlab: 'export function c(){}' },
    fixtures: [], contractText: '', otherTestText: '', consumers: [],
  });
  assert.deepEqual(report.rows.map((r) => `${r.provider}.${r.verb}`).sort(), ['github.a', 'github.b', 'gitlab.c']);
});

// ── The audit must not silently drop what it cannot classify ────────────────
// Found by cross-checking the report's own fixture total against a direct
// count of the directory: they disagreed by five, and all five were real —
// four fixtures for a verb no adapter exports, and one file outside the
// naming convention. An audit that skips those is lying about its coverage.

test('#336: a fixture naming a verb no adapter exports is REPORTED, not dropped', () => {
  const report = buildReport({
    adapters: { github: 'export async function prView(){}' },
    fixtures: [
      { provider: 'github', verb: 'prView', name: 'github-prView-happy.json', provenance: { derived: true } },
      { provider: 'github', verb: 'postmergeRuns', name: 'github-postmergeRuns-empty.json', provenance: {} },
      { provider: null, verb: null, name: 'gitlab-project.json', provenance: {} },
    ],
    contractText: '', otherTestText: '', consumers: [],
  });
  assert.deepEqual(report.orphans, [
    { name: 'github-postmergeRuns-empty.json', claims: 'github.postmergeRuns' },
    { name: 'gitlab-project.json', claims: null },
  ], 'both shapes surface: a verb that vanished, and a name outside the convention');
  assert.equal(report.rows.find((r) => r.verb === 'prView').fixtures, 1,
    'and an orphan is not miscounted against a real verb');
});

test('#336: the fixture total the report states equals what it was given', () => {
  const fixtures = [
    { provider: 'github', verb: 'prView', name: 'a.json', provenance: { derived: true } },
    { provider: 'github', verb: 'prView', name: 'b.json', provenance: {} },
    { provider: 'github', verb: 'gone', name: 'c.json', provenance: { derived: true } },
  ];
  const report = buildReport({ adapters: { github: 'export function prView(){}' }, fixtures, contractText: '', otherTestText: '', consumers: [] });
  const counted = report.rows.reduce((a, r) => a + r.fixtures, 0) + report.orphans.length;
  assert.equal(counted, fixtures.length,
    'every fixture is either attributed to a verb or listed as an orphan — none evaporates');
  assert.equal(report.derivedFixtures, 2, 'the derived count covers orphans too — they are still fixtures');
});

// ── The verb is DATA in a regex, and data must not be syntax ────────────────
// `exportedVerbs` accepts JS-legal identifiers, which may contain `$` — an
// end-of-string anchor unescaped. No adapter has one today; this is so the day
// one appears is not the day the audit starts lying quietly (round 1 editorial).

test('#336: a verb containing `$` is matched literally, not as a regex anchor', () => {
  const contract = 'test("github.pr$Reviews (contract): ...")';
  assert.equal(coverageOf('pr$Reviews', contract, ''), 'contract',
    'the $ is part of the name, not an anchor');
  assert.equal(coverageOf('pr$Nothing', contract, ''), 'uncovered',
    'and it does not match something else by accident');
  assert.equal(countConsumers('pr$Reviews', [{ file: 'a.mjs', text: 'vcs.pr$Reviews({})' }]), 1);
});

test('#336: identifier boundaries hold where \\b cannot — a $ suffix is not the same verb', () => {
  assert.equal(coverageOf('prView', 'test("github.prView$Extra (contract)")', ''), 'uncovered',
    'prView must not borrow coverage from prView$Extra — \\b would have allowed it, since $ is a non-word char');
  assert.equal(countConsumers('prView', [{ file: 'a.mjs', text: 'vcs.prView$Extra({})' }]), 0);
});

test('#336 (round 4): the port is reached through several receivers, and all of them count', () => {
  // Rounds 1 and 2 hardened the boundaries of `vcs.<verb>(` while the object
  // NAME was the wrong premise. Measured on the real tree before this fix:
  // branchProtect, capabilities and mrCreate read `consumers: 0` with live call
  // sites — the audit reproducing #317's blindness inside itself.
  const shapes = [
    'await vcs.prReviews({});',
    'result = await providerModule.prReviews({ project });',
    'const r = (await getVcsFn({ provider })).prReviews(x);',
    'prReviewsFn: (args) => providerModule.prReviews(args),',
  ];
  for (const text of shapes) {
    assert.equal(countConsumers('prReviews', [{ file: 'a.mjs', text }]), 1, `must see: ${text}`);
  }
  assert.equal(countConsumers('prReviews', [{ file: 'a.mjs', text: 'const r = await vcs.prReviews;' }]), 0,
    'only a CALL counts — a property read is not a consumer of the verb');
  assert.equal(countConsumers('prReviews', [{ file: 'a.mjs', text: 'await vcs.prReviewsExtra({});' }]), 0,
    'and the verb still ends where it ends — prReviewsExtra is a different verb');
});

// ── A file that said nothing is not a file that said `recorded` ─────────────
// Round 3's blocker, and the mirror of a rule the code already had. It guarded
// `unreadable` — "a file we could not read is not a file that said none" — and
// left the symmetric case open: the fold read "no derived flag" as `recorded`,
// the STRONGEST category, so an empty `_provenance` claimed to be a recording.

test('#336: an empty or absent _provenance is UNDECLARED, never recorded', () => {
  assert.equal(foldProvenance([{}]), 'undeclared',
    'no evidence is not the best evidence — this returned `recorded` before round 3');
  assert.equal(foldProvenance([{ note: 'why this exists' }]), 'undeclared',
    'a note explains; it does not record');
  assert.equal(classifyProvenance({ endpoint: 'GET /x' }), 'recorded', 'an endpoint IS a recording');
  assert.equal(classifyProvenance({ recorded: '2026-07-30' }), 'recorded');
  assert.equal(classifyProvenance({ live_verified: true }), 'recorded');
  assert.equal(classifyProvenance({ derived: true, endpoint: 'GET /x' }), 'derived',
    'derived wins over an endpoint it was derived FROM — the flag is the author speaking');
});

test('#336: the weakest fixture decides the verb — a verb is only as good as its worst evidence', () => {
  assert.equal(foldProvenance([{ endpoint: 'GET /x' }, {}]), 'undeclared',
    'one undeclared fixture makes the verb undeclared, not mixed and certainly not recorded');
  assert.equal(foldProvenance([{ endpoint: 'GET /x' }, { unreadable: true }]), 'unreadable',
    'and unreadable still dominates undeclared — we could not even look');
});
