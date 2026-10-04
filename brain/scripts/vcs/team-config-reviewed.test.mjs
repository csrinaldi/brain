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
} from './team-config-reviewed.mjs';
import { GATE_MATRIX, resolveGatePolicy } from './governance-tiers.mjs';

const touched = [TEAM_CONFIG_PATH, 'README.md'];
const ok = (author) => ({ state: 'APPROVED', author });

// ── pure evaluator: the decision table ────────────────────────────────────────

test('not touching brain.config.json passes at every tier, whatever the owners and reviews', () => {
  for (const tier of ['lite', 'standard', 'regulated']) {
    const r = evaluateTeamConfigReviewed({ changedFiles: ['README.md', 'sub/brain.config.json'], reviews: [], author: 'alice', owners: [], tier });
    assert.equal(r.level, 'pass', tier);
    assert.match(r.reason, /does not touch/i);
  }
});

test('touched + approved by an owner who is not the author passes (bare login, case-insensitive)', () => {
  const r = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [ok('BOB')], author: 'alice', owners: ['alice', 'bob'], tier: 'standard' });
  assert.equal(r.level, 'pass');
  assert.match(r.reason, /BOB/);
  assert.equal(r.soloMaintainer, undefined);
});

test('touched + approved only by the author (an owner) fails at standard', () => {
  const r = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [ok('alice')], author: 'Alice', owners: ['alice', 'bob'], tier: 'standard' });
  assert.equal(r.level, 'fail');
  assert.match(r.reason, /owner/i);
});

test('touched + approved by a non-owner fails at standard and regulated', () => {
  for (const tier of ['standard', 'regulated']) {
    const r = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [ok('carol')], author: 'alice', owners: ['alice', 'bob'], tier });
    assert.equal(r.level, 'fail', tier);
  }
});

test('only an APPROVED review counts: a COMMENTED or CHANGES_REQUESTED owner review does not', () => {
  const r = evaluateTeamConfigReviewed({
    changedFiles: touched,
    reviews: [{ state: 'COMMENTED', author: 'bob' }, { state: 'CHANGES_REQUESTED', author: 'bob' }],
    author: 'alice', owners: ['alice', 'bob'], tier: 'regulated',
  });
  assert.equal(r.level, 'fail');
});

test('no reviews at all fails (absent evidence is not a pass: this gate does not warn-and-pass)', () => {
  assert.equal(evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [], author: 'alice', owners: ['alice', 'bob'], tier: 'standard' }).level, 'fail');
});

test('solo maintainer at lite: one owner, who is the author, passes and is LABELLED the exception, never independent review', () => {
  const r = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [], author: 'Alice', owners: ['alice'], tier: 'lite' });
  assert.equal(r.level, 'pass');
  assert.equal(r.soloMaintainer, true);
  assert.match(r.reason, /solo-maintainer exception/i);
  assert.match(r.reason, /not independent review/i);
});

test('the solo exception is lite-only: the same shape fails at standard and regulated', () => {
  for (const tier of ['standard', 'regulated']) {
    const r = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [], author: 'alice', owners: ['alice'], tier });
    assert.equal(r.level, 'fail', tier);
    assert.equal(r.soloMaintainer, undefined);
  }
});

test('the solo exception needs EXACTLY one owner, and that owner is the author', () => {
  // two owners at lite: no exception; lite is detection so the unmet requirement is a warning, not a pass
  const two = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [], author: 'alice', owners: ['alice', 'bob'], tier: 'lite' });
  assert.equal(two.level, 'warn');
  assert.equal(two.soloMaintainer, undefined);
  // one owner who is NOT the author: no exception
  const other = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [], author: 'mallory', owners: ['alice'], tier: 'lite' });
  assert.equal(other.level, 'warn');
  assert.equal(other.soloMaintainer, undefined);
});

test('owners empty or absent: "no owner declared" is a failure at standard/regulated and detection (warn) at lite', () => {
  for (const owners of [[], undefined, null]) {
    for (const tier of ['standard', 'regulated']) {
      const r = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [ok('bob')], author: 'alice', owners, tier });
      assert.equal(r.level, 'fail', tier);
      assert.match(r.reason, /no owner declared/i);
    }
    const lite = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [ok('bob')], author: 'alice', owners, tier: 'lite' });
    assert.equal(lite.level, 'warn');
    assert.match(lite.reason, /no owner declared/i);
    assert.match(lite.reason, /detection/i);
  }
});

test('owners normalise: a leading @ and non-string entries are tolerated on read', () => {
  const r = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [ok('bob')], author: 'alice', owners: ['@Bob', 42, null, ''], tier: 'standard' });
  assert.equal(r.level, 'pass');
});

test('lite is detection: a real violation is a warning that names the tier, never a bare pass or a fail', () => {
  const r = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [ok('carol')], author: 'alice', owners: ['alice', 'bob'], tier: 'lite' });
  assert.equal(r.level, 'warn');
  assert.match(r.reason, /lite/);
});

test('an unknown author fails closed where the policy is required', () => {
  const r = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [ok('bob')], author: undefined, owners: ['bob'], tier: 'standard' });
  assert.equal(r.level, 'pass', 'an owner approval with no known author is still an owner approval');
  const solo = evaluateTeamConfigReviewed({ changedFiles: touched, reviews: [], author: undefined, owners: ['bob'], tier: 'lite' });
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

test('a base with no brain.config.json (gitShow -> null) means no owners and the default tier (standard)', async () => {
  const inputs = await gatherTeamConfigReviewedInputs({
    baseSha: 'BASE', headSha: 'HEAD', prNumber: 7, repo: 'o/r', author: 'alice',
    deps: { diffNameOnly: () => touched, fetchReviews: async () => [], gitShow: () => null },
  });
  assert.deepEqual(inputs.owners, []);
  assert.equal(inputs.tier, 'standard');
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
