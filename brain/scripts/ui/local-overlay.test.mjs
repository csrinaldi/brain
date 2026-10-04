// local-overlay.test.mjs — #883: the drawer shows a linked worktree's uncommitted
// change dir below the served change, read-only, on real git fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSnapshot } from '../status/snapshot.mjs';
import { buildChangeView } from './change-route.mjs';
import { gitRun } from './git-run.mjs';
import { makeWorktreeRepo } from './test-support/git-worktree-fixture.mjs';

/** A stub forge: the given issue numbers are open, no PRs, nothing closed. */
export function stubVcs(open = []) {
  return {
    issueList: async ({ state }) => (state === 'open' ? open.map((number) => ({ number, title: `issue ${number}`, labels: [], state: 'open', body: '' })) : []),
    issueView: async ({ number }) => ({ number, body: '' }),
    mrList: async () => [],
    prReviews: async () => [],
  };
}

export async function snapshotOf(root, open) {
  return buildSnapshot({ root, now: '2026-10-03T00:00:00Z', vcs: stubVcs(open), project: 'example/repo' });
}

test('R883-6: an untracked proposal in a linked worktree shows as uncommitted: new when main has no change dir', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-7-x', { 'openspec/changes/issue-7-x/proposal.md': '# proposal\nUNCOMMITTED-BODY\n' });

  const snapshot = await snapshotOf(repo.root, [7]);
  const view = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) });

  assert.equal(view.ok, true);
  const proposal = view.value.local[0].documents.proposal;
  assert.equal(proposal.overlay, 'new');
  assert.equal(proposal.uncommitted, true);
});
