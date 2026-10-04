// inflight-model.test.mjs — #1284 R1284-1..8, R1284-13 (D95-D98, D103): the in-flight list,
// pure, over snapshot sections shaped like the 2026-10-04 measurement.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildInflight, STALE_DAYS } from './inflight-model.mjs';

const DAY = 86400000;
const NOW = Date.parse('2026-10-04T12:00:00Z');

const ok = (value) => ({ ok: true, value });
const hierarchy = (states) => ok({ issues: Object.entries(states).map(([n, state]) => [Number(n), { state, children: [] }]), divergences: [], closedUnresolved: [], closedRead: { ok: true } });
const change = (issue, lastCommit = { ok: true, at: '2026-09-30T00:00:00Z', author: 'dev' }) => ({ issue, archived: false, id: `issue-${issue}-x`, lastCommit });
const archived = (issue) => ({ issue, archived: true, id: String(issue), lastCommit: { ok: false, reason: 'not read for archived dirs' } });
const wt = (issue, over = {}) => ({ issue, leaf: `w${issue}-${Math.random().toString(36).slice(2, 6)}`, dirState: 'present', touchedAt: null, headCommitAt: null, ...over });
const br = (issue, over = {}) => ({ kind: 'grammar', issue, branch: `feat/issue-${issue}-${Math.random().toString(36).slice(2, 6)}`, author: 'ana', tipAt: '2026-10-01T00:00:00Z', ...over });

function sections(over = {}) {
  return {
    changes: ok([]), localWorktrees: ok({ entries: [] }), remoteChanges: ok({ branches: [] }), prs: ok([]),
    hierarchy: hierarchy({}), graph: ok({ nodes: [] }), ...over,
  };
}
const build = (over, nowMs = NOW) => buildInflight(sections(over), { nowMs });
const ids = (list) => list.map((r) => r.issue);

test('R1284-1: only open issues are rows; closed-issue dirs and branches are not, whichever source names them', () => {
  const h = hierarchy({ 267: 'open', 284: 'open', 864: 'open', 100: 'closed', 101: 'closed' });
  const r = build({
    hierarchy: h,
    changes: ok([change(267), change(284), change(864), change(100), archived(5)]),
    remoteChanges: ok({ branches: [br(101), br(864)] }),
    localWorktrees: ok({ entries: [wt(100)] }),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(ids([...r.value.rows, ...r.value.unknown, ...r.value.stale]).sort((a, b) => a - b), [267, 284, 864]);
});

test('R1284-1: a worktree whose change dir is missing still makes its issue in flight; an archived dir names nothing', () => {
  const r = build({
    hierarchy: hierarchy({ 1273: 'open', 1283: 'open', 7: 'open' }),
    localWorktrees: ok({ entries: [wt(1273, { dirState: 'missing' }), wt(1283, { dirState: 'missing' })] }),
    changes: ok([archived(7)]),
  });
  assert.deepEqual(ids([...r.value.rows, ...r.value.unknown, ...r.value.stale]).sort((a, b) => a - b), [1273, 1283]);
});

test('R1284-2: one row per issue aggregates its worktrees, branches, PRs and change dir with counts', () => {
  const r = build({
    hierarchy: hierarchy({ 1114: 'open', 1263: 'open', 978: 'open' }),
    localWorktrees: ok({ entries: [...Array.from({ length: 6 }, () => wt(1114)), ...Array.from({ length: 5 }, () => wt(1263))] }),
    remoteChanges: ok({ branches: Array.from({ length: 7 }, () => br(978)) }),
    prs: ok([{ number: 55, issue: 978 }, { number: 56, issue: null }]),
    changes: ok([change(978)]),
  });
  const all = [...r.value.rows, ...r.value.unknown, ...r.value.stale];
  assert.equal(all.length, 3, 'one row per issue');
  const by = Object.fromEntries(all.map((x) => [x.issue, x]));
  assert.equal(by[1114].worktrees.length, 6);
  assert.equal(by[1263].worktrees.length, 5);
  assert.equal(by[978].branches.length, 7);
  assert.deepEqual(by[978].prs, [55]);
  assert.equal(by[978].changeDir, 'issue-978-x');
  assert.equal(by[1114].onThisMachine, true);
  assert.equal(by[978].onThisMachine, false);
});

test('R1284-2/D97: an author is named from a branch tip; worktrees invent no name; a hostile author stays a literal', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const r = build({
    hierarchy: hierarchy({ 500: 'open', 501: 'open', 502: 'open' }),
    remoteChanges: ok({ branches: [br(500, { author: 'ana' }), br(500, { author: 'ana' }), br(502, { author: hostile })] }),
    localWorktrees: ok({ entries: [wt(501)] }),
  });
  const by = Object.fromEntries([...r.value.rows, ...r.value.unknown, ...r.value.stale].map((x) => [x.issue, x]));
  assert.deepEqual(by[500].authors, ['ana']);
  assert.deepEqual(by[500].authorLines, ['last commit by ana']);
  assert.deepEqual(by[501].authors, []);
  assert.equal(by[501].onThisMachine, true);
  assert.deepEqual(by[502].authors, [hostile]);
});

test('R1284-2/D97: a change-dir-only row names the last committer of its dir', () => {
  const r = build({ hierarchy: hierarchy({ 267: 'open' }), changes: ok([change(267, { ok: true, at: '2026-10-03T00:00:00Z', author: 'cris' })]) });
  assert.deepEqual(r.value.rows[0].authors, ['cris']);
});

test('D97: a row states its facts as text — the machine, the branches, the PRs, the authors — and never a name it could not read', () => {
  const r = build({
    hierarchy: hierarchy({ 1114: 'open', 978: 'open' }),
    localWorktrees: ok({ entries: [wt(1114), wt(1114)] }),
    remoteChanges: ok({ branches: [br(978, { author: 'ana' }), br(978, { author: 'bo' })] }),
    prs: ok([{ number: 55, issue: 978 }]),
  });
  const by = Object.fromEntries([...r.value.rows, ...r.value.unknown].map((x) => [x.issue, x]));
  assert.deepEqual(by[1114].facts, ['2 worktrees on this machine']);
  assert.deepEqual(by[978].facts, ['2 branches on origin', 'PR #55', 'last commit by ana', 'last commit by bo']);
});

test('R1284-3: a null-state issue is kept and marked state unknown; an issue the hierarchy does not list is not open (D96)', () => {
  const r = build({
    hierarchy: ok({ issues: [[700, { state: null, children: [] }]], divergences: [], closedUnresolved: [], closedRead: { ok: true } }),
    localWorktrees: ok({ entries: [wt(700), wt(701)] }),
  });
  const all = [...r.value.rows, ...r.value.unknown, ...r.value.stale];
  assert.deepEqual(ids(all), [700]);
  assert.equal(all[0].state, 'unknown');
});

test('titles come from the graph and are empty when the graph has none', () => {
  const r = build({ hierarchy: hierarchy({ 1: 'open', 2: 'open' }), localWorktrees: ok({ entries: [wt(1), wt(2)] }), graph: ok({ nodes: [{ number: 1, title: 'one' }] }) });
  const by = Object.fromEntries([...r.value.rows, ...r.value.unknown].map((x) => [x.issue, x]));
  assert.equal(by[1].title, 'one');
  assert.equal(by[2].title, '');
});

test('R1284-4: the latest of touchedAt and tipAt wins', () => {
  const r = build({
    hierarchy: hierarchy({ 900: 'open' }),
    localWorktrees: ok({ entries: [wt(900, { touchedAt: '2026-10-01T00:00:00Z' })] }),
    remoteChanges: ok({ branches: [br(900, { tipAt: '2026-10-03T00:00:00Z' })] }),
  });
  assert.equal(r.value.rows[0].activityAt, '2026-10-03T00:00:00Z');
  assert.equal(r.value.rows[0].activityFrom, 'branch tip');
});

test('R1284-4: a change-dir-only row uses lastCommit.at; a missing-dir worktree row uses its head commit time (D103)', () => {
  const r = build({
    hierarchy: hierarchy({ 267: 'open', 1273: 'open' }),
    changes: ok([change(267, { ok: true, at: '2026-09-30T00:00:00Z', author: 'a' })]),
    localWorktrees: ok({ entries: [wt(1273, { dirState: 'missing', headCommitAt: '2026-10-02T00:00:00Z' })] }),
  });
  const by = Object.fromEntries([...r.value.rows, ...r.value.stale].map((x) => [x.issue, x]));
  assert.equal(by[267].activityAt, '2026-09-30T00:00:00Z');
  assert.equal(by[267].activityFrom, 'change dir last commit');
  assert.equal(by[1273].activityAt, '2026-10-02T00:00:00Z');
  assert.equal(by[1273].activityFrom, 'worktree head commit');
});

test('R1284-4: a failed last-commit read is activity unknown, after every dated row, and never stale', () => {
  const r = build({
    hierarchy: hierarchy({ 284: 'open', 1: 'open', 2: 'open' }),
    changes: ok([change(284, { ok: false, reason: 'the change-dir log could not be read: x' })]),
    remoteChanges: ok({ branches: [br(1, { tipAt: '2026-10-03T00:00:00Z' }), br(2, { tipAt: '2026-01-01T00:00:00Z' })] }),
  });
  assert.deepEqual(ids(r.value.rows), [1]);
  assert.deepEqual(ids(r.value.unknown), [284]);
  assert.equal(r.value.unknown[0].activityAt, null);
  assert.equal(r.value.unknown[0].activityFrom, 'activity unknown');
  assert.deepEqual(ids(r.value.stale), [2], 'only the dated old row is stale');
});

test('R1284-5: newest first, ties by issue ascending', () => {
  const r = build({
    hierarchy: hierarchy({ 1: 'open', 2: 'open', 3: 'open', 4: 'open' }),
    remoteChanges: ok({ branches: [br(1, { tipAt: '2026-10-01T00:00:00Z' }), br(2, { tipAt: '2026-10-04T00:00:00Z' }), br(3, { tipAt: '2026-10-02T00:00:00Z' }), br(4, { tipAt: '2026-10-02T00:00:00Z' })] }),
  });
  assert.deepEqual(ids(r.value.rows), [2, 3, 4, 1]);
});

test('R1284-5: exactly STALE_DAYS is stale and just under is not; the group is newest first and counted', () => {
  assert.equal(STALE_DAYS, 7);
  const at = (ms) => new Date(NOW - ms).toISOString();
  const r = build({
    hierarchy: hierarchy({ 1: 'open', 2: 'open', 3: 'open', 4: 'open' }),
    remoteChanges: ok({ branches: [br(1, { tipAt: at(7 * DAY) }), br(2, { tipAt: at(7 * DAY - 1) }), br(3, { tipAt: at(30 * DAY) }), br(4, { tipAt: at(8 * DAY) })] }),
  });
  assert.deepEqual(ids(r.value.rows), [2]);
  assert.deepEqual(ids(r.value.stale), [1, 4, 3]);
});

test('R1284-6/D95: each non-ready source is named, pending worded apart from failed; the model never returns ok:false', () => {
  const r = build({
    remoteChanges: { ok: false, pending: true, reason: 'loading remote branches…' },
    prs: { ok: false, reason: 'rate limited' },
    localWorktrees: ok({ entries: [wt(5)] }),
    hierarchy: hierarchy({ 5: 'open' }),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.missingSources, [
    { name: 'remoteChanges', state: 'pending', reason: 'loading remote branches…' },
    { name: 'prs', state: 'failed', reason: 'rate limited' },
  ]);
  assert.deepEqual(ids(r.value.rows.concat(r.value.unknown, r.value.stale)), [5], 'rows from ready sources are provisional, not withheld');
  assert.equal(r.value.empty, null);
  assert.match(r.value.notices.join('\n'), /remoteChanges.*still loading/);
  assert.match(r.value.notices.join('\n'), /prs.*rate limited/);
});

test('R1284-6/D96: while hierarchy is not ready no row is drawn; the candidate count and the reason are carried', () => {
  const r = build({
    hierarchy: { ok: false, reason: 'rate limited' },
    changes: ok([change(1), change(2)]),
    localWorktrees: ok({ entries: [wt(2), wt(3)] }),
  });
  assert.equal(r.ok, true);
  assert.deepEqual([r.value.rows, r.value.unknown, r.value.stale], [[], [], []]);
  assert.equal(r.value.candidates, 3);
  assert.deepEqual(r.value.missingSources, [{ name: 'hierarchy', state: 'failed', reason: 'rate limited' }]);
  assert.match(r.value.notices.join('\n'), /3 candidate issue\(s\); their open\/closed state is not read yet \(hierarchy: could not be read — rate limited\)/);
  assert.equal(r.value.empty, null, 'never "nothing in flight" while a source is missing');
});

test('R1284-7: empty is stated only when every source is ready', () => {
  const r = build({ hierarchy: hierarchy({ 1: 'closed' }), changes: ok([change(1)]) });
  assert.deepEqual(r.value.missingSources, []);
  assert.deepEqual(r.value.notices, []);
  assert.equal(r.value.empty, 'no open issue is in flight');
  const partial = build({ prs: { ok: false, pending: true, reason: 'loading' } });
  assert.equal(partial.value.empty, null);
  const missing = buildInflight({ changes: ok([]) }, { nowMs: NOW });
  assert.equal(missing.value.missingSources.length, 4, 'a section that was never given is failed, not ready');
  assert.equal(missing.value.empty, null);
});

test('R1284-7: stale rows alone are not empty', () => {
  const r = build({ hierarchy: hierarchy({ 1: 'open' }), remoteChanges: ok({ branches: [br(1, { tipAt: '2026-01-01T00:00:00Z' })] }) });
  assert.equal(r.value.empty, null);
  assert.equal(r.value.stale.length, 1);
});

test('R1284-13: the model imports no I/O module and reads no clock', () => {
  const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'inflight-model.mjs'), 'utf8');
  assert.doesNotMatch(text, /from\s+['"]node:(fs|child_process|net|http|https)/);
  assert.doesNotMatch(text, /\bDate\.now\s*\(/);
  assert.doesNotMatch(text, /\bfetch\s*\(/);
});
