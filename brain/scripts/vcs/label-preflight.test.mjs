// label-preflight.test.mjs — unit tests for labelPreflight (issue #334,
// vcs-label-preflight spec). Root-cause guard, run BEFORE a mutating write
// (mrCreateFn): the two providers disagree on an unknown label — `gh pr
// create --label` hard-errors, GitLab's MR-create payload SILENTLY CREATES
// it, polluting the project taxonomy (design A2). labelPreflight converts
// both into one uniform, local, actionable, NEVER-THROWING refusal.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { labelPreflight } from './label-preflight.mjs';

test('labelPreflight: label exists in the remote set → { exists: true }', async () => {
  const result = await labelPreflight({
    provider: 'github',
    project: 'x/y',
    label: 'type:bug',
    labelListFn: async () => ['type:bug', 'type:feature'],
  });
  assert.deepEqual(result, { exists: true });
});

test('labelPreflight: label absent from the remote set → { exists: false }, no error (a real result, not a failure)', async () => {
  const result = await labelPreflight({
    provider: 'github',
    project: 'x/y',
    label: 'type:missing',
    labelListFn: async () => ['type:bug'],
  });
  assert.equal(result.exists, false);
  assert.equal(result.error, undefined, 'a clean "not found" result must not carry an error key');
});

test('labelPreflight: exact case-sensitive match — differing case does not match', async () => {
  const result = await labelPreflight({
    provider: 'github',
    project: 'x/y',
    label: 'type:bug',
    labelListFn: async () => ['Type:Bug'],
  });
  assert.equal(result.exists, false, 'label matching must be exact and case-sensitive');
});

test('labelPreflight: NEVER throws — a labelListFn rejection resolves to { exists: false, error }, fail CLOSED', async () => {
  const result = await labelPreflight({
    provider: 'github',
    project: 'x/y',
    label: 'type:bug',
    labelListFn: async () => { throw new Error('network down'); },
  });
  assert.equal(result.exists, false, 'an uncomputable lookup must fail CLOSED — never a fabricated exists:true');
  assert.equal(typeof result.error, 'string');
  assert.match(result.error, /network down/);
});

test('labelPreflight: no caching — two calls invoke labelListFn twice (every call re-checks the remote)', async () => {
  let calls = 0;
  const labelListFn = async () => { calls += 1; return ['type:bug']; };
  await labelPreflight({ provider: 'github', project: 'x/y', label: 'type:bug', labelListFn });
  await labelPreflight({ provider: 'github', project: 'x/y', label: 'type:bug', labelListFn });
  assert.equal(calls, 2, 'labelPreflight must never cache — every call re-checks the remote (deliberately unlike capabilities())');
});

test('labelPreflight: gitlab provider — same never-throws, exact-match contract', async () => {
  const found = await labelPreflight({
    provider: 'gitlab',
    project: 'g/p',
    label: 'type::bug',
    labelListFn: async () => ['type::bug', 'status::approved'],
  });
  assert.deepEqual(found, { exists: true });

  const notFound = await labelPreflight({
    provider: 'gitlab',
    project: 'g/p',
    label: 'type::missing',
    labelListFn: async () => ['type::bug'],
  });
  assert.equal(notFound.exists, false);
});

test('labelPreflight: an unsupported provider fails CLOSED rather than throwing', async () => {
  const result = await labelPreflight({ provider: 'bitbucket', project: 'x/y', label: 'type:bug' });
  assert.equal(result.exists, false);
  assert.equal(typeof result.error, 'string');
});
