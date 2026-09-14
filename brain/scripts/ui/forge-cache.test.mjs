import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createForgeCache } from './forge-cache.mjs';

// ── D1: exactly the four read verbs `readForge` calls ──────────────────────

test('#881: forge-cache exposes exactly the four read verbs readForge calls', () => {
  const cache = createForgeCache();
  assert.deepEqual(Object.keys(cache.port).sort(), ['issueList', 'issueView', 'mrList', 'prReviews']);
});

// ── a cache miss throws, it never fetches ───────────────────────────────────

test('#881: a cache miss throws "the first forge poll has not completed"', async () => {
  const cache = createForgeCache();
  await assert.rejects(() => cache.port.issueList({ project: 'o/r', state: 'open' }), /the first forge poll has not completed/);
  await assert.rejects(() => cache.port.mrList({ project: 'o/r', state: 'open' }), /the first forge poll has not completed/);
  await assert.rejects(() => cache.port.issueView({ project: 'o/r', number: 5 }), /the first forge poll has not completed/);
  await assert.rejects(() => cache.port.prReviews({ project: 'o/r', number: 10 }), /the first forge poll has not completed/);
});

// ── a filled entry is served from the Map, with no re-fetch ────────────────

test('#881: a filled entry is served from the Map with no re-fetch', async () => {
  const cache = createForgeCache();
  const issues = [{ number: 5, title: 'five' }];
  const prs = [{ number: 10, title: 'pr' }];
  cache.setIssueList(issues);
  cache.setMrList(prs);
  cache.setIssueView(5, { body: 'x', assignees: [] });
  cache.setPrReviews(10, [{ state: 'COMMENTED' }]);

  assert.equal(await cache.port.issueList({ project: 'o/r' }), issues, 'the exact stored reference is served — proof of no re-fetch, not a copy');
  assert.equal(await cache.port.mrList({ project: 'o/r' }), prs);
  assert.deepEqual(await cache.port.issueView({ project: 'o/r', number: 5 }), { body: 'x', assignees: [] });
  assert.deepEqual(await cache.port.prReviews({ project: 'o/r', number: 10 }), [{ state: 'COMMENTED' }]);

  // a number that was never loaded still misses, even once the cache holds other entries
  await assert.rejects(() => cache.port.issueView({ project: 'o/r', number: 999 }), /the first forge poll has not completed/);
});
