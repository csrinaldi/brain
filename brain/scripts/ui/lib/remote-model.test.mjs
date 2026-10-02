// remote-model.test.mjs — #1201 R1201-2/3/4/5/8: what the page says about a
// teammate's branches. Pure: the clock is a number the caller passes.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { remoteBadges, remotePanel, authorLine } from './remote-model.mjs';

const NOW = Date.parse('2026-10-01T12:00:00Z');
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

const resume = (state, reason = null) => ({ state, path: null, reason, fields: null });
const grammar = (issue, over = {}) => ({
  branch: `feat/issue-${issue}-x`, sha: 'a'.repeat(40), tipAt: iso(2 * HOUR), author: 'Ada Lovelace', kind: 'grammar', issue, pr: null,
  change: { ok: true, value: { dir: `openspec/changes/issue-${issue}-x`, artefacts: {} } }, resume: resume('present'), ...over,
});
const unjoined = (name, msAgo, over = {}) => ({
  branch: name, sha: 'b'.repeat(40), tipAt: iso(msAgo), author: 'Linus T', kind: 'unjoined', issue: null, pr: null,
  change: { ok: false, reason: 'outside the branch grammar: no issue to look a change dir up by' }, resume: null, ...over,
});
const section = (branches = [], unjoinedList = [], extra = {}) => ({
  ok: true, value: { base: 'origin/main', branches, unjoined: unjoinedList, hidden: { base: 2, lane: 1, merged: 3 }, prsApplied: true, deferred: 0, ...extra },
});

// ── the card line ────────────────────────────────────────────────────────────

test('#1201 D42: a card line reads on origin: <branch> · PR #n · last commit by <author> · <age>; no PR drops the PR part', () => {
  const withPr = remoteBadges(section([grammar(11, { pr: { number: 31, title: 't' } })]), 11, NOW);
  assert.deepEqual(withPr.lines.map((l) => l.text), ['on origin: feat/issue-11-x · PR #31 · last commit by Ada Lovelace · 2 h ago']);
  const bare = remoteBadges(section([grammar(11)]), 11, NOW);
  assert.equal(bare.lines[0].text, 'on origin: feat/issue-11-x · last commit by Ada Lovelace · 2 h ago');
  assert.equal(bare.more, null);
});

test('#1201 D42: at most two lines per card, then "and N more"; another issue\'s branch is not on this card', () => {
  const entries = [grammar(11, { branch: 'feat/issue-11-a' }), grammar(11, { branch: 'feat/issue-11-b' }), grammar(11, { branch: 'feat/issue-11-c' }), grammar(12)];
  const badges = remoteBadges(section(entries), 11, NOW);
  assert.equal(badges.lines.length, 2);
  assert.equal(badges.more, 'and 1 more');
  assert.deepEqual(remoteBadges(section(entries), 99, NOW), { lines: [], more: null });
});

test('#1201 D42: a section that could not be read gives a card no lines (the sections band says why)', () => {
  assert.deepEqual(remoteBadges({ ok: false, reason: 'no refs' }, 11, NOW), { lines: [], more: null });
  assert.deepEqual(remoteBadges(undefined, 11, NOW), { lines: [], more: null });
});

test('#1201 R1201-8: the card line carries the resume wording only when the resume is not present', () => {
  assert.equal(remoteBadges(section([grammar(11)]), 11, NOW).lines[0].resume, null);
  assert.match(remoteBadges(section([grammar(11, { resume: resume('missing') })]), 11, NOW).lines[0].resume, /no resume was found/);
});

// ── the panel ────────────────────────────────────────────────────────────────

test('#1201 D42: the panel lists joined entries whose issue is not on the board, with the reason', () => {
  const panel = remotePanel(section([grammar(11), grammar(12)]), new Set([11]), NOW);
  assert.equal(panel.ok, true);
  const { remoteWork } = panel.value;
  assert.equal(remoteWork.count, 1);
  assert.equal(remoteWork.rows[0].branch, 'feat/issue-12-x');
  assert.match(remoteWork.rows[0].reason, /#12 is not an open ticket on the board/);
  assert.equal(remoteWork.rows[0].text, 'on origin: feat/issue-12-x · last commit by Ada Lovelace · 2 h ago');
});

test('#1201 R1201-5: the unjoined group is collapsed by default, headed by its count, sorted newest first, and shows a 400-day-old branch with its age', () => {
  const list = [unjoined('wip/mid', 30 * DAY), unjoined('wip/new', 2 * HOUR), unjoined('wip/stale', 400 * DAY)];
  const { unjoined: group } = remotePanel(section([], list), new Set(), NOW).value;
  assert.equal(group.collapsedByDefault, true);
  assert.equal(group.header, 'unjoined branches (3)');
  assert.deepEqual(group.rows.map((r) => r.branch), ['wip/new', 'wip/mid', 'wip/stale']);
  assert.deepEqual(group.rows.map((r) => r.age), ['2 h ago', '30 d ago', '400 d ago']);
  assert.equal(group.rows[2].text, 'wip/stale · last commit by Linus T · 400 d ago');
});

test('#1201 R1201-3: the panel states what it hides, as counts, never silence; and what is not read yet', () => {
  const panel = remotePanel(section([], [], { deferred: 4 }), new Set(), NOW).value;
  assert.equal(panel.hiddenNote, '6 hidden: 2 base, 1 lane, 3 merged');
  assert.equal(panel.deferredNote, '4 branches not read yet');
});

test('#1201 R1201-8: four unfavourable resume states say four different things, and a present one says nothing', () => {
  const states = ['missing', 'unreadable', 'invalid', 'deferred'];
  const words = states.map((s) => remoteBadges(section([grammar(11, { resume: resume(s, s === 'unreadable' || s === 'invalid' ? 'why' : null) })]), 11, NOW).lines[0].resume);
  assert.equal(new Set(words).size, 4, words.join(' | '));
  assert.ok(words.every((w) => typeof w === 'string' && w.length > 0));
  assert.match(words[1], /why/);
  assert.match(words[2], /why/);
});

test('#1201 R1201-2 R3: the author wording is exactly "last commit by <name>", with no handle and no email', () => {
  assert.equal(authorLine('Ada Lovelace'), 'last commit by Ada Lovelace');
  const out = JSON.stringify([remoteBadges(section([grammar(11)]), 11, NOW), remotePanel(section([grammar(11)], [unjoined('wip/x', DAY)]), new Set(), NOW)]);
  assert.doesNotMatch(out, /@|handle/);
});

test('#1201 AC3 D43: nothing the model returns names a session', () => {
  const s = section([grammar(11, { pr: { number: 1, title: 't' } }), grammar(12, { resume: resume('invalid', 'x') })], [unjoined('wip/x', DAY)], { deferred: 1 });
  const out = JSON.stringify([remoteBadges(s, 11, NOW), remoteBadges(s, 12, NOW), remotePanel(s, new Set([11]), NOW)]);
  assert.doesNotMatch(out, /session/i);
});

test('#1201 D42: an unreadable section gives the panel the reason, not an empty list', () => {
  assert.deepEqual(remotePanel({ ok: false, reason: 'no refs/remotes/origin/* in this clone' }, new Set(), NOW), { ok: false, reason: 'no refs/remotes/origin/* in this clone' });
});
