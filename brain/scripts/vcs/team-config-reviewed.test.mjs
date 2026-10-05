// team-config-reviewed.test.mjs — the owner gate over the TEAM config (#1263 slice 4, ADR-0040).
// Plain-data fakes injected via `deps`: no test spawns git or touches a forge.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateTeamConfigReviewed,
  gatherTeamConfigReviewedInputs,
  runTeamConfigReviewedCheck,
  main,
  TEAM_CONFIG_PATH,
  diffNameOnlyArgs,
} from './team-config-reviewed.mjs';
import { GATE_MATRIX, resolveGatePolicy } from './governance-tiers.mjs';

const touched = [TEAM_CONFIG_PATH, 'README.md'];
const HEAD = 'HEAD';
const ok = (author, commitId = HEAD) => ({ state: 'APPROVED', author, commitId });
const ev = (o) => evaluateTeamConfigReviewed({ headSha: HEAD, ...o });

// ── pure evaluator: the decision table ────────────────────────────────────────

test('not touching brain.config.json passes at every tier, whatever the owners and reviews', () => {
  for (const tier of ['lite', 'standard', 'regulated']) {
    const r = ev({ changedFiles: ['README.md', 'sub/brain.config.json'], reviews: [], author: 'alice', owners: [], tier });
    assert.equal(r.level, 'pass', tier);
    assert.match(r.reason, /does not touch/i);
  }
});

test('touched + approved by an owner who is not the author passes (bare login, case-insensitive)', () => {
  const r = ev({ changedFiles: touched, reviews: [ok('BOB')], author: 'alice', owners: ['alice', 'bob'], tier: 'standard' });
  assert.equal(r.level, 'pass');
  assert.match(r.reason, /BOB/);
  assert.equal(r.soloMaintainer, undefined);
});

test('touched + approved only by the author (an owner) fails at standard', () => {
  const r = ev({ changedFiles: touched, reviews: [ok('alice')], author: 'Alice', owners: ['alice', 'bob'], tier: 'standard' });
  assert.equal(r.level, 'fail');
  assert.match(r.reason, /owner/i);
});

test('touched + approved by a non-owner fails at standard and regulated', () => {
  for (const tier of ['standard', 'regulated']) {
    const r = ev({ changedFiles: touched, reviews: [ok('carol')], author: 'alice', owners: ['alice', 'bob'], tier });
    assert.equal(r.level, 'fail', tier);
  }
});

test('only an APPROVED review counts: a COMMENTED or CHANGES_REQUESTED owner review does not', () => {
  const r = ev({
    changedFiles: touched,
    reviews: [{ state: 'COMMENTED', author: 'bob' }, { state: 'CHANGES_REQUESTED', author: 'bob' }],
    author: 'alice', owners: ['alice', 'bob'], tier: 'regulated',
  });
  assert.equal(r.level, 'fail');
});

test('no reviews at all fails (absent evidence is not a pass: this gate does not warn-and-pass)', () => {
  assert.equal(ev({ changedFiles: touched, reviews: [], author: 'alice', owners: ['alice', 'bob'], tier: 'standard' }).level, 'fail');
});

test('solo maintainer at lite: one owner, who is the author, passes and is LABELLED the exception, never independent review', () => {
  const r = ev({ changedFiles: touched, reviews: [], author: 'Alice', owners: ['alice'], tier: 'lite' });
  assert.equal(r.level, 'pass');
  assert.equal(r.soloMaintainer, true);
  assert.match(r.reason, /solo-maintainer exception/i);
  assert.match(r.reason, /not independent review/i);
});

test('the solo exception is lite-only: the same shape fails at standard and regulated', () => {
  for (const tier of ['standard', 'regulated']) {
    const r = ev({ changedFiles: touched, reviews: [], author: 'alice', owners: ['alice'], tier });
    assert.equal(r.level, 'fail', tier);
    assert.equal(r.soloMaintainer, undefined);
  }
});

test('the solo exception needs EXACTLY one owner, and that owner is the author', () => {
  // two owners at lite: no exception; lite is detection so the unmet requirement is a warning, not a pass
  const two = ev({ changedFiles: touched, reviews: [], author: 'alice', owners: ['alice', 'bob'], tier: 'lite' });
  assert.equal(two.level, 'warn');
  assert.equal(two.soloMaintainer, undefined);
  // one owner who is NOT the author: no exception
  const other = ev({ changedFiles: touched, reviews: [], author: 'mallory', owners: ['alice'], tier: 'lite' });
  assert.equal(other.level, 'warn');
  assert.equal(other.soloMaintainer, undefined);
});

test('owners empty or absent: "no owner declared" is a failure at standard/regulated and detection (warn) at lite', () => {
  for (const owners of [[], undefined, null]) {
    for (const tier of ['standard', 'regulated']) {
      const r = ev({ changedFiles: touched, reviews: [ok('bob')], author: 'alice', owners, tier });
      assert.equal(r.level, 'fail', tier);
      assert.match(r.reason, /no owner declared/i);
    }
    const lite = ev({ changedFiles: touched, reviews: [ok('bob')], author: 'alice', owners, tier: 'lite' });
    assert.equal(lite.level, 'warn');
    assert.match(lite.reason, /no owner declared/i);
    assert.match(lite.reason, /detection/i);
  }
});

test('owners normalise: a leading @ and non-string entries are tolerated on read', () => {
  const r = ev({ changedFiles: touched, reviews: [ok('bob')], author: 'alice', owners: ['@Bob', 42, null, ''], tier: 'standard' });
  assert.equal(r.level, 'pass');
});

test('lite is detection: a real violation is a warning that names the tier, never a bare pass or a fail', () => {
  const r = ev({ changedFiles: touched, reviews: [ok('carol')], author: 'alice', owners: ['alice', 'bob'], tier: 'lite' });
  assert.equal(r.level, 'warn');
  assert.match(r.reason, /lite/);
});

test('an unknown author fails closed where the policy is required', () => {
  const r = ev({ changedFiles: touched, reviews: [ok('bob')], author: undefined, owners: ['bob'], tier: 'standard' });
  assert.equal(r.level, 'pass', 'an owner approval with no known author is still an owner approval');
  const solo = ev({ changedFiles: touched, reviews: [], author: undefined, owners: ['bob'], tier: 'lite' });
  assert.equal(solo.level, 'warn', 'no author, so no solo exception');
});

// ── tier mapping ──────────────────────────────────────────────────────────────

test('GATE_MATRIX: detection at lite, required at standard and regulated', () => {
  assert.equal(resolveGatePolicy('team-config-reviewed', 'lite'), 'detection');
  assert.equal(resolveGatePolicy('team-config-reviewed', 'standard'), 'required');
  assert.equal(resolveGatePolicy('team-config-reviewed', 'regulated'), 'required');
  assert.ok(GATE_MATRIX['team-config-reviewed']);
});

// ── gather: owners and tier come from the BASE, never the head ────────────────

const baseConfig = (obj) => JSON.stringify(obj);

test('owners are read from the BASE ref: gitShow is asked for baseSha:brain.config.json and never for the head', async () => {
  const asked = [];
  const inputs = await gatherTeamConfigReviewedInputs({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'mallory',
    deps: {
      diffNameOnly: () => touched,
      fetchReviews: async () => [ok('mallory')],
      gitShow: (ref, path) => { asked.push([ref, path]); return baseConfig({ governance: { owners: ['alice'], tier: 'standard' } }); },
    },
  });
  assert.deepEqual(asked, [['BASE', 'brain.config.json']]);
  assert.deepEqual(inputs.owners, ['alice']);
  assert.equal(inputs.tier, 'standard');
});

test('a PR that adds its own author to governance.owners and self-approves still FAILS: the head config is never consulted', async () => {
  // base declares owners [alice]; the PR (head) would declare [alice, mallory], but only the base is read.
  const result = await runTeamConfigReviewedCheck({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'mallory', cwd: '/nonexistent',
    diffNameOnly: () => touched,
    fetchReviews: async () => [ok('mallory')],
    gitShow: (ref) => {
      assert.equal(ref, 'BASE', 'only the base ref may be read');
      return baseConfig({ governance: { owners: ['alice'], tier: 'standard' } });
    },
  });
  assert.equal(result.level, 'fail');
});

test('the tier is read from the base too: a PR cannot demote itself to lite to dodge the gate', async () => {
  const result = await runTeamConfigReviewedCheck({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'mallory',
    diffNameOnly: () => touched,
    fetchReviews: async () => [],
    gitShow: () => baseConfig({ governance: { owners: ['alice'], tier: 'regulated' } }),
  });
  assert.equal(result.level, 'fail');
});

test('a base with no brain.config.json (gitShow -> null) is the ADOPTION PR: no owners, founding, and the new-consumer tier lite — never standard', async () => {
  const inputs = await gatherTeamConfigReviewedInputs({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    deps: { diffNameOnly: () => touched, fetchReviews: async () => [], gitShow: () => null, isShallow: () => false, lastTouchSha: () => '' },
  });
  assert.deepEqual(inputs.owners, []);
  assert.equal(inputs.founding, true);
  assert.equal(inputs.tier, 'lite');
  assert.equal(inputs.headSha, 'HEAD');
});

test('the founding PR passes, labelled — not "no owner declared", and not independent review — even though its own head declares tier standard', async () => {
  const r = await runTeamConfigReviewedCheck({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    diffNameOnly: () => touched, fetchReviews: async () => [],
    gitShow: () => null, isShallow: () => false, lastTouchSha: () => '',
  });
  assert.equal(r.level, 'pass');
  assert.equal(r.founding, true);
  assert.match(r.reason, /adoption PR — the founding decision; no owners can exist yet/);
  assert.match(r.reason, /NOT independent review/);
  assert.equal(r.soloMaintainer, undefined);
});

test('a founding PR that does not touch the config is just "not touched"', () => {
  assert.match(ev({ changedFiles: ['README.md'], founding: true, tier: 'lite' }).reason, /does not touch/);
});

// ── the approval must be CURRENT and the owner's LATEST ───────────────────────

test('an approval on an OLDER head (a commit was pushed after) is stale: fail at standard/regulated, warn at lite', () => {
  const reviews = [ok('bob', 'OLD')];
  for (const tier of ['standard', 'regulated']) {
    const r = ev({ changedFiles: touched, reviews, author: 'alice', owners: ['alice', 'bob'], tier });
    assert.equal(r.level, 'fail', tier);
    assert.match(r.reason, /stale|older commit/i);
  }
  assert.equal(ev({ changedFiles: touched, reviews, author: 'alice', owners: ['alice', 'bob'], tier: 'lite' }).level, 'warn');
});

test('an approval on the CURRENT head passes, and an older approval by someone else does not matter', () => {
  const r = ev({ changedFiles: touched, reviews: [ok('carol', 'OLD'), ok('bob', HEAD)], author: 'alice', owners: ['alice', 'bob', 'carol'], tier: 'standard' });
  assert.equal(r.level, 'pass');
  assert.match(r.reason, /bob/);
});

test('approve, then a LATER CHANGES_REQUESTED by the same owner: only the latest counts, so it fails', () => {
  const reviews = [ok('bob'), { state: 'CHANGES_REQUESTED', author: 'bob', commitId: HEAD }];
  assert.equal(ev({ changedFiles: touched, reviews, author: 'alice', owners: ['alice', 'bob'], tier: 'standard' }).level, 'fail');
});

test('approve, then a later DISMISSED by the same owner: fails; but approve-after-request-changes passes', () => {
  assert.equal(ev({ changedFiles: touched, reviews: [ok('bob'), { state: 'DISMISSED', author: 'bob', commitId: HEAD }], author: 'alice', owners: ['alice', 'bob'], tier: 'standard' }).level, 'fail');
  assert.equal(ev({ changedFiles: touched, reviews: [{ state: 'CHANGES_REQUESTED', author: 'bob', commitId: 'OLD' }, ok('BOB')], author: 'alice', owners: ['alice', 'bob'], tier: 'standard' }).level, 'pass');
});

test('a later COMMENTED review does not cancel an approval (it decides nothing)', () => {
  const reviews = [ok('bob'), { state: 'COMMENTED', author: 'bob', commitId: HEAD }];
  assert.equal(ev({ changedFiles: touched, reviews, author: 'alice', owners: ['alice', 'bob'], tier: 'standard' }).level, 'pass');
});

test('commitId null (the forge cannot say, e.g. GitLab): fail closed at standard/regulated naming the limitation, warn at lite', () => {
  const reviews = [ok('bob', null)];
  for (const tier of ['standard', 'regulated']) {
    const r = ev({ changedFiles: touched, reviews, author: 'alice', owners: ['alice', 'bob'], tier });
    assert.equal(r.level, 'fail', tier);
    assert.match(r.reason, /commitId is null/);
    assert.match(r.reason, /GitLab/);
  }
  assert.equal(ev({ changedFiles: touched, reviews, author: 'alice', owners: ['alice', 'bob'], tier: 'lite' }).level, 'warn');
});

test('no headSha known: an approval cannot be proven current, so it fails closed', () => {
  assert.equal(evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [ok('bob')], author: 'alice', owners: ['bob'], tier: 'standard' }).level, 'fail');
});

test('reviews null (could not be fetched) is "evidence could not be fetched", never "no APPROVED review": fail at standard/regulated, warn at lite', () => {
  for (const tier of ['standard', 'regulated']) {
    const r = ev({ changedFiles: touched, reviews: null, author: 'alice', owners: ['alice', 'bob'], tier });
    assert.equal(r.level, 'fail', tier);
    assert.match(r.reason, /could not be fetched/);
  }
  const lite = ev({ changedFiles: touched, reviews: null, author: 'alice', owners: ['alice', 'bob'], tier: 'lite' });
  assert.equal(lite.level, 'warn');
  assert.match(lite.reason, /could not be fetched/);
});

test('the default fetchReviews keeps a null port result null (not []) end to end', async () => {
  const r = await runTeamConfigReviewedCheck({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    diffNameOnly: () => touched,
    getVcs: async () => ({ prReviews: async () => null }),
    gitShow: () => baseConfig({ governance: { owners: ['bob'], tier: 'standard' } }),
  });
  assert.equal(r.level, 'fail');
  assert.match(r.reason, /could not be fetched/);
});

test('reviews are fetched only when the config is touched', async () => {
  let fetched = 0;
  const r = await runTeamConfigReviewedCheck({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    diffNameOnly: () => ['README.md'],
    fetchReviews: async () => { fetched++; return []; },
    gitShow: () => baseConfig({ governance: { owners: ['alice'] } }),
  });
  assert.equal(r.level, 'pass');
  assert.equal(fetched, 0);
});

// ── run + main: fail closed ───────────────────────────────────────────────────

test('missing CI context (no shas / pr / repo / author) is a warn, like its sibling gates', async () => {
  const r = await runTeamConfigReviewedCheck({ ctx: {} });
  assert.equal(r.level, 'warn');
});

test('an unreadable base config fails closed at a required tier (cannot verify), and warns at a detection tier', async () => {
  const base = {
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    diffNameOnly: () => touched, fetchReviews: async () => [],
  };
  const bad = await runTeamConfigReviewedCheck({ ...base, gitShow: () => '{not json' });
  assert.equal(bad.level, 'fail');
  const liteThrow = await runTeamConfigReviewedCheck({ ...base, tier: 'lite', gitShow: () => { throw new Error('boom'); } });
  assert.equal(liteThrow.level, 'warn');
});

test('a fetchReviews failure fails closed at standard', async () => {
  const r = await runTeamConfigReviewedCheck({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    diffNameOnly: () => touched,
    fetchReviews: async () => { throw new Error('forge down'); },
    gitShow: () => baseConfig({ governance: { owners: ['bob'], tier: 'standard' } }),
  });
  assert.equal(r.level, 'fail');
  assert.match(r.reason, /forge down/);
});

test('main prints the verdict and returns 1 only on fail', async () => {
  const run = (level) => main({
    baseSha: 'B', headSha: 'H', prNumber: 1, repo: 'o/r', author: 'alice',
    diffNameOnly: () => touched, fetchReviews: async () => [],
    gitShow: () => baseConfig({ governance: { owners: ['alice'], tier: level } }),
  });
  const orig = console.log; console.log = () => {};
  try {
    assert.equal(await run('standard'), 1);
    assert.equal(await run('lite'), 0); // solo-maintainer exception
  } finally { console.log = orig; }
});

// ── the rename/delete bypass: any touch of the root file counts, and a removed config is not a founding ──────────

test('the diff is listed with rename detection OFF, so a rename away lists the deletion of brain.config.json', () => {
  const args = diffNameOnlyArgs('BASE', 'HEAD');
  assert.ok(args.includes('--no-renames'));
  assert.ok(args.includes('--name-only'));
  assert.ok(args.includes('BASE...HEAD'));
});

test('rename away / delete: the deletion lists brain.config.json, so it is touched and needs an owner approval', () => {
  // with --no-renames, `git mv brain.config.json team.json` lists BOTH paths
  const r = ev({ changedFiles: [TEAM_CONFIG_PATH, 'team.json'], reviews: [], author: 'alice', owners: ['alice', 'bob'], tier: 'standard' });
  assert.equal(r.level, 'fail');
  assert.equal(ev({ changedFiles: [TEAM_CONFIG_PATH], reviews: [ok('bob')], author: 'alice', owners: ['alice', 'bob'], tier: 'standard' }).level, 'pass');
});

test('re-creating the config after a deletion is NOT a founding: the base once had it', async () => {
  const gather = (lastTouchSha) => gatherTeamConfigReviewedInputs({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    deps: { diffNameOnly: () => touched, fetchReviews: async () => [], gitShow: () => null, lastTouchSha, isShallow: () => false },
  });
  const genuine = await gather(() => '');
  assert.equal(genuine.founding, true);
  assert.equal(genuine.removed, false);
  const recreated = await gather(() => 'DEL');
  assert.equal(recreated.founding, false);
  assert.equal(recreated.removed, true);
});

test('the genuine founding still passes end to end', async () => {
  const r = await runTeamConfigReviewedCheck({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    diffNameOnly: () => touched, fetchReviews: async () => [], gitShow: () => null, lastTouchSha: () => '', isShallow: () => false,
  });
  assert.equal(r.founding, true);
});

// ── a REMOVED config: owners come from its last version; the normal approval rule applies ─────────────────────────

const removedRun = (over = {}) => runTeamConfigReviewedCheck({
  baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
  diffNameOnly: () => touched, fetchReviews: async () => [ok('bob')],
  isShallow: () => false, lastTouchSha: () => 'DEL',
  gitShow: (ref) => (ref === 'BASE' ? null : baseConfig({ governance: { owners: ['alice', 'bob'], tier: 'standard' } })),
  ...over,
});

test('removed then re-added: the owners are read from the version BEFORE the deleting commit (DEL^1, the mainline), and a previous owner\'s current approval passes', async () => {
  const asked = [];
  const r = await removedRun({
    gitShow: (ref) => { asked.push(ref); return ref === 'BASE' ? null : baseConfig({ governance: { owners: ['alice', 'bob'], tier: 'standard' } }); },
  });
  assert.deepEqual(asked, ['BASE', 'DEL^1']);
  assert.equal(r.level, 'pass');
  assert.equal(r.founding, undefined);
});

test('removed then re-added with NO approval fails at standard', async () => {
  assert.equal((await removedRun({ fetchReviews: async () => [] })).level, 'fail');
});

test('removed then re-added where the previous config had no owners: "no owner declared" — fail at standard, warn at lite', async () => {
  const std = await removedRun({ gitShow: (ref) => (ref === 'BASE' ? null : baseConfig({ governance: { tier: 'standard' } })) });
  assert.equal(std.level, 'fail');
  assert.match(std.reason, /no owner declared/);
  const lite = await removedRun({ gitShow: (ref) => (ref === 'BASE' ? null : baseConfig({ governance: { tier: 'lite' } })) });
  assert.equal(lite.level, 'warn');
});

test('removed: the approver must still be a previous owner, on the current head, and not the author', async () => {
  assert.equal((await removedRun({ fetchReviews: async () => [ok('carol')] })).level, 'fail');
  assert.equal((await removedRun({ fetchReviews: async () => [ok('bob', 'OLD')] })).level, 'fail');
  assert.equal((await removedRun({ fetchReviews: async () => [ok('alice')] })).level, 'fail');
});

// ── a shallow history can never classify a missing config as a founding ───────────────────────────────────────

test('a shallow repository never yields a founding pass: a missing config cannot be classified, so it is an evidence failure', async () => {
  const base = {
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    diffNameOnly: () => touched, fetchReviews: async () => [], gitShow: () => null, lastTouchSha: () => '', isShallow: () => true,
  };
  const std = await runTeamConfigReviewedCheck(base);
  assert.equal(std.level, 'fail');
  assert.equal(std.founding, undefined);
  assert.match(std.reason, /shallow/);
  const lite = await runTeamConfigReviewedCheck({ ...base, tier: 'lite' });
  assert.equal(lite.level, 'warn');
  assert.equal(lite.founding, undefined);
});

// ── ordering and the tier on failures ─────────────────────────────────────────────────────────────────────────

test('a PR that does not touch brain.config.json passes WITHOUT reading the base config: an unreadable base never blocks it', async () => {
  let shown = 0;
  const r = await runTeamConfigReviewedCheck({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    diffNameOnly: () => ['README.md'], fetchReviews: async () => [],
    gitShow: () => { shown++; throw new Error('boom'); },
  });
  assert.equal(r.level, 'pass');
  assert.equal(shown, 0);
});

test('a touching PR whose base config cannot be read or parsed has an unknown tier: fail closed "team config on base unreadable"', async () => {
  const base = { baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice', diffNameOnly: () => touched, fetchReviews: async () => [] };
  for (const gitShow of [() => '{not json', () => { throw new Error('boom'); }]) {
    const r = await runTeamConfigReviewedCheck({ ...base, gitShow });
    assert.equal(r.level, 'fail');
    assert.match(r.reason, /team config on base unreadable/);
  }
});

test('a gather failure with a READABLE base tier maps through GATE_MATRIX: warn at lite, fail at standard (no unconditional standard fallback)', async () => {
  const run = (tier) => runTeamConfigReviewedCheck({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    diffNameOnly: () => touched, gitShow: () => baseConfig({ governance: { owners: ['bob'], tier } }),
    fetchReviews: async () => { throw new Error('git timeout'); },
  });
  const lite = await run('lite');
  assert.equal(lite.level, 'warn');
  assert.match(lite.reason, /git timeout/);
  assert.equal((await run('standard')).level, 'fail');
  assert.equal((await run('regulated')).level, 'fail');
});

test('a diff failure (a git timeout) takes the tier from the base when it is readable: lite warns, standard fails; unreadable fails', async () => {
  const run = (gitShow) => runTeamConfigReviewedCheck({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    diffNameOnly: () => { throw new Error('git timeout'); }, fetchReviews: async () => [], gitShow,
  });
  assert.equal((await run(() => baseConfig({ governance: { tier: 'lite' } }))).level, 'warn');
  assert.equal((await run(() => baseConfig({ governance: { tier: 'standard' } }))).level, 'fail');
  assert.equal((await run(() => { throw new Error('boom'); })).level, 'fail');
});

test('main wires deps.tier: an injected tier decides the exit code of a gather failure', async () => {
  const run = (tier) => main({
    baseSha: 'B', headSha: 'H', prNumber: 1, repo: 'o/r', author: 'alice', tier,
    diffNameOnly: () => { throw new Error('git timeout'); },
  });
  const orig = console.log; console.log = () => {};
  try {
    assert.equal(await run('lite'), 0);
    assert.equal(await run('standard'), 1);
  } finally { console.log = orig; }
});

// ── PR author unresolvable (forge API failed): fail closed, never skip (#1263) ─

const prCtxNoAuthor = { baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: null };
const stdBase = (tier) => () => baseConfig({ governance: { owners: ['alice'], tier } });

test('author unresolved + PR context + config touched + standard tier: FAILS closed, naming the unresolved author', async () => {
  const r = await runTeamConfigReviewedCheck({ ...prCtxNoAuthor, diffNameOnly: () => touched, gitShow: stdBase('standard') });
  assert.equal(r.level, 'fail');
  assert.match(r.reason, /author could not be resolved/);
});

test('author unresolved + config touched + lite tier: warns (detection), does not fail', async () => {
  const r = await runTeamConfigReviewedCheck({ ...prCtxNoAuthor, diffNameOnly: () => touched, gitShow: stdBase('lite') });
  assert.equal(r.level, 'warn');
  assert.match(r.reason, /author could not be resolved/);
});

test('author unresolved + config touched + unreadable base: FAILS closed', async () => {
  const r = await runTeamConfigReviewedCheck({ ...prCtxNoAuthor, diffNameOnly: () => touched, gitShow: () => '{not json' });
  assert.equal(r.level, 'fail');
});

test('author unresolved + config NOT touched: not a failure, and the base is never read', async () => {
  const r = await runTeamConfigReviewedCheck({
    ...prCtxNoAuthor, diffNameOnly: () => ['src/a.mjs'],
    gitShow: () => { throw new Error('must not read the base'); },
  });
  assert.notEqual(r.level, 'fail');
});

test('no PR context at all (no shas / pr number) still takes the skip-warn', async () => {
  const r = await runTeamConfigReviewedCheck({ author: null, diffNameOnly: () => { throw new Error('must not diff'); } });
  assert.equal(r.level, 'warn');
  assert.match(r.reason, /skipping/);
});
