import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { makeSnapshotFixture as makeFixture } from '../__fixtures__/snapshot-tree.mjs';
import {
  buildSnapshot, roadmapState, aggregateActors, projectRecord, readChanges, readRecordRows, reviewRows,
  issueOfBranch, renderSnapshotText, PLANNED, IN_FLIGHT, DONE,
} from './snapshot.mjs';

const NOW = '2026-09-13T00:00:00Z';

const VERDICT = (sha, rev, verdict) => `Round ${rev}\n\n\`\`\`yaml\nprotocol: brain-review/2\nhead_sha: ${sha}\nrev: ${rev}\nverdict: ${verdict}\nfindings: []\n\`\`\`\n`;

/** A port whose every write verb throws — "read-only" proved, not promised. */
function readOnlyPort(reads) {
  const port = {};
  for (const w of ['mrCreate', 'mrAutoMerge', 'issueCreate', 'issueUpdate', 'prReviewComment', 'issueComment', 'labelAdd', 'labelRemove', 'branchProtect']) {
    port[w] = async () => { throw new Error(`write verb ${w} called by a read model`); };
  }
  return Object.assign(port, reads);
}

function snapshotTree(root) {
  const out = [];
  const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); const s = statSync(p); out.push(`${p}:${s.isDirectory() ? 'd' : s.size}:${s.mtimeMs}`); if (s.isDirectory()) walk(p); } };
  walk(root);
  return out.sort();
}

// ── R879-2: fresh clone, no forge ───────────────────────────────────────────

test('#879: with no port the forge sections say why, the tree sections are computed, nothing is written', async () => {
  const root = makeFixture();
  const before = snapshotTree(root);
  const s = await buildSnapshot({ root, now: NOW });
  assert.equal(s.generatedAt, '2026-09-13T00:00:00.000Z');
  assert.equal(s.tier, 'committed');
  assert.deepEqual(s.governanceTier, { ok: true, value: 'lite' });
  for (const k of ['graph', 'prs', 'reviews']) {
    assert.equal(s[k].ok, false, k);
    assert.match(s[k].reason, /no VCS port/);
  }
  assert.equal(s.changes.ok, true);
  assert.equal(s.records.ok, true);
  assert.equal(s.adrs.ok, true);
  assert.equal(s.antiPatterns.ok, true);
  assert.equal(s.actors.ok, true);
  assert.equal(s.releaseDebt.ok, true);
  assert.equal(s.drift.ok, true);
  assert.deepEqual(snapshotTree(root), before, 'the snapshot wrote nothing');
});

test('#879: a missing records dir is a reason on records AND actors, never []', async () => {
  const s = await buildSnapshot({ root: makeFixture({ records: false }), now: NOW });
  assert.equal(s.records.ok, false);
  assert.match(s.records.reason, /\.memory\/records is absent/);
  assert.equal(s.actors.ok, false);
  assert.equal(readRecordRows({ root: '/nowhere' }).ok, false);
});

test('#879: drift names the ADR HOME.md lists that has no readable file, by path', async () => {
  const s = await buildSnapshot({ root: makeFixture(), now: NOW });
  assert.deepEqual(s.drift.value, {
    homeOnly: [{ number: 2, path: 'brain/project/decisions/adr-0002-b.md' }],
    filesOnly: [],
    unreadable: [],
  });
  assert.match(renderSnapshotText(s), /⚠ adr drift.*\n.*ADR-0002 brain\/project\/decisions\/adr-0002-b\.md/);
});

// ── R879-8: changes through the accessor ────────────────────────────────────

test('#879: changes read tasks, slice scopes and missing artefacts; an absent tasks.md is a reason', () => {
  const root = makeFixture();
  const c = readChanges({ root, tier: 'lite' });
  assert.equal(c.ok, true);
  assert.deepEqual(c.value.map((x) => x.id), ['issue-1-a', 'issue-2-no-tasks'], 'archive/ is not a change');
  const [a, b] = c.value;
  assert.deepEqual(a.tasks, { checked: { ok: true, value: 1 }, open: { ok: true, value: 1 }, next: { ok: true, value: 'next one' } });
  assert.deepEqual(a.sliceScopes, { ok: true, value: [{ slice: 1, claims: ['R1-1'], terminal_pr: 'this PR -> main' }] });
  assert.deepEqual(a.missing, { ok: true, value: [] });
  assert.equal(b.tasks.checked.ok, false);
  assert.match(b.tasks.checked.reason, /issue-2-no-tasks\/tasks\.md could not be read/);
  assert.deepEqual(b.missing.value, [], 'at lite only spec.md is required, and it is there');
  assert.deepEqual(readChanges({ root, tier: 'standard' }).value[1].missing.value, ['proposal.md', 'design.md', 'tasks.md'], 'the tier decides the required set');
  assert.equal(readChanges({ root: '/nowhere', tier: 'lite' }).ok, false);
  const unresolved = readChanges({ root, tier: null });
  assert.equal(unresolved.value[0].missing.ok, false, 'no tier → the required set cannot be resolved, and that is said');
});

// ── R879-5: roadmap ─────────────────────────────────────────────────────────

test('#879: roadmap is done / in-flight / planned, and uncomputable when the PR list was not read', () => {
  const prs = { ok: true, value: [{ number: 10, headBranch: 'feat/issue-5-x' }, { number: 11, headBranch: 'main' }] };
  const reviews = { ok: true, value: [{ pr: 10, ok: true, latest: { pr: 10, rev: 2, verdict: 'APPROVE' } }] };
  assert.deepEqual(roadmapState({ number: 5, state: 'closed' }, prs, reviews).value.state, DONE);
  const inFlight = roadmapState({ number: 5, state: 'open' }, prs, reviews);
  assert.equal(inFlight.value.state, IN_FLIGHT);
  assert.deepEqual(inFlight.value.evidence, { prs: [10], verdict: { pr: 10, rev: 2, verdict: 'APPROVE' } });
  assert.equal(roadmapState({ number: 6, state: 'open' }, prs, reviews).value.state, PLANNED);
  const unread = roadmapState({ number: 6, state: 'open' }, { ok: false, reason: 'offline' }, reviews);
  assert.equal(unread.ok, false);
  assert.match(unread.reason, /offline.*planned/);
  assert.equal(roadmapState({ number: 6, state: 'closed' }, { ok: false, reason: 'offline' }, reviews).value.state, DONE, 'closed needs no PR');
  assert.equal(issueOfBranch('fix/issue-42'), 42);
  assert.equal(issueOfBranch('issue-42'), null, 'the grammar needs a type');
});

// ── R879-6: actors ──────────────────────────────────────────────────────────

test('#879: actors is one aggregation over records, sorted, humans and agents in one shape', () => {
  const rows = aggregateActors([
    { actor: '@b', actorKind: 'agent', type: 'decision', ts: '2026-07-01T00:00:00Z' },
    { actor: '@a', actorKind: 'human', type: 'decision', ts: '2026-06-01T00:00:00Z' },
    { actor: '@a', actorKind: 'human', type: 'bugfix', ts: '2026-08-01T00:00:00Z' },
  ]);
  assert.deepEqual(rows, [
    { actor: '@a', actorKind: 'human', records: 2, byType: { bugfix: 1, decision: 1 }, first: '2026-06-01T00:00:00Z', last: '2026-08-01T00:00:00Z' },
    { actor: '@b', actorKind: 'agent', records: 1, byType: { decision: 1 }, first: '2026-07-01T00:00:00Z', last: '2026-07-01T00:00:00Z' },
  ]);
});

test('#879: a record is projected to its index metadata plus the file that holds it', () => {
  const r = projectRecord({ id: 'rec-0000000000000001', ts: '2026-06-01T00:00:00Z', actor: '@a', actorKind: 'human', type: 'decision', project: 'x', issue: 1, content: 'long' });
  assert.deepEqual(r, { id: 'rec-0000000000000001', ts: '2026-06-01T00:00:00Z', actor: '@a', actorKind: 'human', type: 'decision', issue: 1, file: '.memory/records/2026-06-rec-0000000000000001.jsonl' });
  assert.equal(projectRecord({ id: 'bad' }).file, null, 'an unnameable record is kept, with no pointer');
});

// ── R879-2 / D4: the forge, per section and per item ────────────────────────

test('#879: with a port the graph carries roadmap per node, and one unreadable thread does not take the others', async () => {
  const issues = [
    { number: 5, title: 'five', labels: ['status:approved'], assignees: [] },
    { number: 6, title: 'six', labels: [], assignees: null },
  ];
  const port = readOnlyPort({
    issueList: async () => issues,
    issueView: async ({ number }) => ({ body: number === 5 ? '```brain-graph/1\ntrack: UI\nblocks: []\nneeds: []\nfiles: []\n```' : '', assignees: null }),
    mrList: async () => [{ number: 10, title: 'pr', headBranch: 'feat/issue-5-x' }, { number: 11, title: 'pr', headBranch: 'feat/issue-6-y' }],
    prReviews: async ({ number }) => {
      if (number === 11) throw new Error('thread 11 timed out');
      return [{ state: 'COMMENTED', author: 'bot', body: VERDICT('abc', 1, 'REVISE') }, { state: 'COMMENTED', author: 'bot', body: VERDICT('def', 2, 'APPROVE') }];
    },
  });
  const s = await buildSnapshot({ root: makeFixture(), now: NOW, vcs: port, project: 'o/r' });
  assert.equal(s.graph.ok, true);
  assert.deepEqual(s.graph.value.tracks, { '?': [6], UI: [5] }, 'tracks is a plain object, JSON-safe');
  const n5 = s.graph.value.nodes.find((n) => n.number === 5);
  assert.deepEqual(n5.roadmap.value, { state: IN_FLIGHT, evidence: { prs: [10], verdict: { pr: 10, rev: 2, verdict: 'APPROVE' } } });
  assert.deepEqual(s.prs.value[0], { number: 10, title: 'pr', headBranch: 'feat/issue-5-x', issue: 5 });
  assert.equal(s.reviews.ok, true);
  const [t10, t11] = s.reviews.value;
  assert.equal(t10.verdicts.length, 2, 'every posted round, oldest first');
  assert.equal(t10.verdicts[0].verdict, 'REVISE');
  assert.equal(t10.latest.verdict, 'APPROVE');
  assert.deepEqual(t11, { pr: 11, ok: false, reason: 'thread 11 timed out' });
  // JSON-safe end to end: a Map or an undefined would not survive this.
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('#879: an issue list that fails takes only the graph; a PR list that fails takes prs and reviews', async () => {
  const port = readOnlyPort({
    issueList: async () => { throw new Error('rate limited'); },
    mrList: async () => { throw new Error('offline'); },
  });
  const s = await buildSnapshot({ root: makeFixture(), now: NOW, vcs: port, project: 'o/r' });
  assert.match(s.graph.reason, /rate limited/);
  assert.match(s.prs.reason, /offline/);
  assert.match(s.reviews.reason, /offline/);
});

test('#879: reviewRows keeps verdicts oldest first and marks a review with no block as no verdict', () => {
  const r = reviewRows(3, [{ body: 'just a comment', author: 'h' }, { body: VERDICT('a', 1, 'REVISE'), author: 'bot' }]);
  assert.equal(r.verdicts.length, 1);
  assert.equal(r.latest.rev, 1);
  assert.equal(reviewRows(4, []).latest, null);
});
