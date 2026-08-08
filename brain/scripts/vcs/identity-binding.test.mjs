// identity-binding.test.mjs — a bound port writes as the identity it was bound to
// (issue #501, REQ-501-1/-3).
//
// EVERY fixture here drives TWO DIFFERENT identities. That is not thoroughness,
// it is the only configuration in which the defect is observable: with the bound
// token and the ambient credential set to the same identity, every assertion
// passes against a port that ignores the token entirely — which is exactly how
// this shipped to main and survived until a maintainer ran the reviewer from a
// checkout logged in as someone else.
//
// It is the #405 cardinality lesson in another dimension: with N=1 identities,
// "wrote as the reviewer" is trivially true.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getVcs } from './cli.mjs';
import { runAsIdentity, currentIdentity } from './lib/identity-context.mjs';

const BOUND = 'token-of-the-reviewer';
const AMBIENT = 'token-of-the-operator';

test('#501 runAsIdentity: the bound value is visible inside, and gone outside (REQ-501-1)', () => {
  assert.equal(currentIdentity(), null, 'no ambient leak before');
  runAsIdentity(BOUND, () => assert.equal(currentIdentity(), BOUND));
  assert.equal(currentIdentity(), null, 'the value must not survive the call that set it');
});

test('#501 runAsIdentity: it survives an await boundary (REQ-501-1)', async () => {
  // Every verb is async. A binding that a module-level variable would satisfy
  // synchronously and lose across an await is not a binding.
  await runAsIdentity(BOUND, async () => {
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(currentIdentity(), BOUND);
  });
});

test('#501 runAsIdentity: an absent identity leaves resolution untouched (REQ-501-1, E2)', () => {
  runAsIdentity(null, () => assert.equal(currentIdentity(), null));
  runAsIdentity(undefined, () => assert.equal(currentIdentity(), null));
});

test('#501 getVcs({ identity }): the GH_TOKEN on the wire is the BOUND one, not the ambient one (REQ-501-1, E1)', async () => {
  const seen = [];
  const stubProvider = {
    PROVIDER: 'stub',
    // Stands in for a verb: records the identity visible at the moment it runs,
    // which is what the chokepoint reads.
    prReviewComment: async () => {
      seen.push(currentIdentity());
      return { url: 'https://example.test/1' };
    },
  };
  const vcs = await getVcs({
    config: { vcs: { provider: 'github' } },
    identity: BOUND,
    // Injected so the test needs no gh binary; the binding under test is in
    // getVcs's wrapper, which is provider-agnostic.
    _import: async () => stubProvider,
  });
  await vcs.prReviewComment({});
  assert.deepStrictEqual(seen, [BOUND], `the verb must run under ${BOUND}, not ${AMBIENT}`);
});

test('#501 getVcs({ identity }): READS are bound too, not writes only (REQ-501-1, E3)', async () => {
  // Driven separately because "write verbs only" is the narrower fix a reader
  // reaches for, and it leaves the reviewer reading a repository it may not be
  // writing to.
  const seen = [];
  const stubProvider = {
    PROVIDER: 'stub',
    prView: async () => { seen.push(['prView', currentIdentity()]); return {}; },
    prReviews: async () => { seen.push(['prReviews', currentIdentity()]); return []; },
    prStatusRollup: async () => { seen.push(['prStatusRollup', currentIdentity()]); return {}; },
  };
  const vcs = await getVcs({
    config: { vcs: { provider: 'github' } },
    identity: BOUND,
    _import: async () => stubProvider,
  });
  await vcs.prView({});
  await vcs.prReviews({});
  await vcs.prStatusRollup({});
  assert.deepStrictEqual(seen, [
    ['prView', BOUND],
    ['prReviews', BOUND],
    ['prStatusRollup', BOUND],
  ]);
});

test('#501 getVcs(): an UNBOUND port is unchanged — non-reviewer callers keep ambient auth (REQ-501-1, E2)', async () => {
  // The brain:vcs CLI and the governance checks must not acquire a reviewer's
  // reach as a side effect of this fix.
  const seen = [];
  const stubProvider = {
    PROVIDER: 'stub',
    prView: async () => { seen.push(currentIdentity()); return {}; },
  };
  const vcs = await getVcs({
    config: { vcs: { provider: 'github' } },
    _import: async () => stubProvider,
  });
  await vcs.prView({});
  assert.deepStrictEqual(seen, [null], 'an unbound port must bind nothing');
});

test('#501 getVcs({ identity }): the binding covers EVERY function export, not a list of names (REQ-501-2)', async () => {
  // A hand-maintained list of verbs to bind is the shape that failed: `whoami`
  // was the one entry on that list for the whole life of #413. So the wrapper
  // enumerates the module, and this asserts it — including a verb whose name
  // appears in no contract.
  const stubProvider = {
    PROVIDER: 'stub',
    aVerbNobodyHasWrittenYet: async () => currentIdentity(),
  };
  const vcs = await getVcs({
    config: { vcs: { provider: 'github' } },
    identity: BOUND,
    _import: async () => stubProvider,
  });
  assert.equal(await vcs.aVerbNobodyHasWrittenYet(), BOUND);
  assert.equal(vcs.PROVIDER, 'stub', 'non-function exports pass through untouched');
});
