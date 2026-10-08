import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildDrawerModel, TAB_IDS, sourceLabel, NO_CHANGE_BRANCH, LOCAL_STATE_WORDING, localChangedFor } from './drawer-model.mjs';
import { SUMMARY_MISSING } from './memory-model.mjs';
import { NO_TEXT } from '../../memory/lib/record-summary.mjs';

const view = (over = {}) => ({
  ok: true,
  value: {
    issue: 881,
    changeDir: 'openspec/changes/issue-881-ui',
    spec: { ok: true, value: [] },
    sdd: { ok: true, value: [] },
    tasks: { ok: true, value: [] },
    workingMemory: { ok: true, value: {} },
    reviews: { ok: true, value: [], unreadable: [], sourceNote: 'forge comments until #880 lands' },
    records: { ok: true, value: [] },
    ...over,
  },
});
test("#1009 cold review round 3: a verdict word outside APPROVE|REVISE|STOP is called out as unrecognised, never rendered like an ordinary REVISE", () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: true,
      sourceNote: 'forge comments until #880 lands',
      unreadable: [],
      value: [{ pr: 971, rev: 2, verdict: 'MAYBE', author: 'bob', findings: [], findingCount: 0, head_sha: 'abc1234', source: { url: 'https://github.com/o/r/pull/971#c2' } }],
    },
  }));
  const [round] = model.value.tabs[4].entries;
  assert.equal(round.title, '#971 rev 2 — MAYBE', 'the verdict word is kept verbatim, never normalised away');
  assert.match(round.detail, /unrecognised verdict/, 'the drawer must say the word is outside the protocol enum');
});


/** Every leaf the drawer will show, tab by tab — the A3 property walks this. */
function leaves(model) {
  const out = [];
  for (const tab of model.value.tabs) for (const entry of tab.entries) { out.push(entry); for (const child of entry.children ?? []) out.push(child); }
  return out;
}

test('#881 R881-8: a change view that failed is a stated reason, not four empty tabs', () => {
  assert.deepEqual(buildDrawerModel({ ok: false, reason: 'issue must be a positive integer' }), { ok: false, reason: 'issue must be a positive integer' });
  assert.match(buildDrawerModel(null).reason, /no change view/);
});

test('#998 R998-6: the drawer has exactly six tabs, in the design\'s order', () => {
  const model = buildDrawerModel(view());
  assert.deepEqual(model.value.tabs.map((t) => t.id), TAB_IDS);
  assert.deepEqual(model.value.tabs.map((t) => t.label), ['Spec', 'SDD', 'Tasks', 'Working memory', 'Reviews', 'Records']);
  assert.equal(model.value.issue, 881);
});

test('#881 R881-8: Spec cards carry their requirement, their scenarios and the file path with the line', () => {
  const model = buildDrawerModel(view({
    spec: {
      ok: true,
      value: [{
        id: 'R881-6', title: 'every open issue is a node', line: 121, source: { path: 'openspec/changes/issue-881-ui/spec.md', line: 121 },
        scenarios: [
          { name: 'no node is filtered away', when: 'the graph has 90 open issues', then: 'the canvas renders 90 nodes', complete: true, source: { path: 'openspec/changes/issue-881-ui/spec.md', line: 133 } },
          { name: 'half written', when: 'something', then: null, complete: false, source: { path: 'openspec/changes/issue-881-ui/spec.md', line: 140 } },
        ],
      }],
    },
  }));
  const [spec] = model.value.tabs;
  assert.equal(spec.ok, true);
  assert.equal(spec.entries.length, 1);
  assert.equal(spec.entries[0].title, 'R881-6 — every open issue is a node');
  assert.equal(spec.entries[0].source, 'openspec/changes/issue-881-ui/spec.md:121');
  assert.equal(spec.entries[0].children.length, 2);
  assert.match(spec.entries[0].children[0].detail, /WHEN the graph has 90 open issues/);
  assert.match(spec.entries[0].children[0].detail, /THEN the canvas renders 90 nodes/);
  assert.equal(spec.entries[0].children[1].pending, true, 'a scenario with no THEN is shown as incomplete, not hidden');
});

test('#881 R881-8 S2: no change dir states the expected path in the tab AND as its source', () => {
  const noDir = { ok: false, reason: 'no change dir at openspec/changes/issue-881-*', source: { path: 'openspec/changes/issue-881-*' } };
  const model = buildDrawerModel(view({ changeDir: null, spec: noDir, tasks: noDir }));
  const specAndTasks = [model.value.tabs.find((t) => t.id === 'spec'), model.value.tabs.find((t) => t.id === 'tasks')];
  for (const tab of specAndTasks) {
    assert.equal(tab.ok, false);
    assert.equal(tab.reason, 'no change dir at openspec/changes/issue-881-*');
    assert.equal(tab.source, 'openspec/changes/issue-881-*');
    assert.deepEqual(tab.entries, []);
  }
});

test('#1199 R1199-4: the Tasks tab header names the count and its source', () => {
  const tab = (progress) => buildDrawerModel(view({ tasks: { ok: true, value: [], progress } })).value.tabs[2];
  assert.equal(tab({ ok: true, value: { done: 2, total: 5 } }).header, '2 / 5 tasks done · at HEAD');
  assert.equal(tab({ ok: false, code: 'truncated', reason: 'x' }).header, 'tasks.md is truncated; no total is shown · at HEAD');
  assert.equal(tab({ ok: false, code: 'no-items', reason: 'x' }).header, 'tasks.md has no checklist items · at HEAD');
});

test('#881 R881-8: Tasks show done/pending, the file line, and attribution — a blame failure is said per row, never dropped', () => {
  const model = buildDrawerModel(view({
    tasks: {
      ok: true,
      value: [
        { line: 10, text: 'T1. write the failing test', done: true, actor: 'alice', ts: '2026-09-15T10:00:00Z', source: { path: 'tasks.md', line: 10 }, attribution: { ok: true, value: { actor: 'alice', ts: '2026-09-15T10:00:00Z' } } },
        { line: 11, text: 'T2. implement', done: false, actor: 'unknown', ts: null, source: { path: 'tasks.md', line: 11 }, attribution: { ok: false, reason: 'git blame failed: not a git repository' } },
      ],
    },
  }));
  const tasks = model.value.tabs[2];
  assert.equal(tasks.entries[0].title, 'T1. write the failing test');
  assert.equal(tasks.entries[0].done, true);
  assert.match(tasks.entries[0].detail, /alice/);
  assert.equal(tasks.entries[1].done, false);
  assert.equal(tasks.entries[1].pending, true);
  assert.match(tasks.entries[1].detail, /attribution unavailable: git blame failed/);
  assert.equal(tasks.entries[1].source, 'tasks.md:11');
});

test('#881 R881-8 S3: an absent committed resume.md keeps the tab\'s own reason, whatever it says', () => {
  const model = buildDrawerModel(view({ workingMemory: { ok: false, reason: 'no committed resume.md on feat/issue-881-x; an uncommitted one is on this machine, below' } }));
  const wm = model.value.tabs[3];
  assert.equal(wm.ok, false);
  assert.match(wm.reason, /on this machine/);
});

test('#881 R881-8: Working memory shows the three fields, each with its branch-qualified source, a missing one said', () => {
  const source = { path: 'feat/issue-881-x:openspec/changes/issue-881-x/resume.md' };
  const model = buildDrawerModel(view({
    workingMemory: {
      ok: true,
      value: {
        next_action: { ok: true, value: 'ship PR 4', source },
        current_slice: { ok: true, value: '4', source },
        blockers: { ok: false, reason: 'resume.md on feat/issue-881-x has no blockers', source },
      },
    },
  }));
  const wm = model.value.tabs[3];
  assert.deepEqual(wm.entries.map((e) => e.title), ['next_action', 'current_slice', 'blockers']);
  assert.equal(wm.entries[0].detail, 'ship PR 4');
  assert.equal(wm.entries[0].source, 'feat/issue-881-x:openspec/changes/issue-881-x/resume.md');
  assert.equal(wm.entries[2].pending, true);
  assert.match(wm.entries[2].detail, /has no blockers/);
});

test('#881 R881-8 S4: Reviews list every round with its URL and state their source', () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: true,
      sourceNote: 'forge comments until #880 lands',
      unreadable: [],
      value: [
        { pr: 971, rev: 1, verdict: 'REVISE', author: 'bob', findings: [
          { id: 'F-1', severity: 'blocker', evidenceExcerpt: 'bad thing', cites: 'ADR-1' },
          { id: 'F-2', severity: 'minor', evidenceExcerpt: 'small thing', cites: null },
        ], findingCount: 2, head_sha: 'abc', malformed: [], source: { url: 'https://github.com/o/r/pull/971#c1' } },
        { pr: 971, rev: 2, verdict: 'APPROVE', author: 'bob', findings: [], findingCount: 0, head_sha: 'def', malformed: [], source: { url: 'https://github.com/o/r/pull/971#c2' } },
      ],
    },
  }));
  const reviews = model.value.tabs[4];
  assert.equal(reviews.note, 'forge comments until #880 lands');
  assert.deepEqual(reviews.entries.map((e) => e.title), ['#971 rev 1 — REVISE', '#971 rev 2 — APPROVE']);
  assert.match(reviews.entries[0].detail, /bob/);
  assert.match(reviews.entries[0].detail, /2 finding/);
  assert.equal(reviews.entries[0].source, 'https://github.com/o/r/pull/971#c1');
});

test('#1009 cold review round 2: a STOP round\'s title carries the verdict word and its detail names the human escalation, distinct from an ordinary REVISE/APPROVE round', () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: true,
      sourceNote: 'forge comments until #880 lands',
      unreadable: [],
      value: [{ pr: 971, rev: 3, verdict: 'STOP', author: 'bob', findings: [], findingCount: 0, head_sha: 'abc', malformed: [], source: { url: 'https://github.com/o/r/pull/971#c3' } }],
    },
  }));
  const [round] = model.value.tabs[4].entries;
  assert.equal(round.title, '#971 rev 3 — STOP');
  assert.match(round.detail, /human escalation/, 'a STOP round\'s detail must name the escalation, the same word app.js renders');
});

test('#998 R998-5: a round\'s findings become one child entry each, severity and id in the title, excerpt/cites in the detail; a finding with no file/line falls back to the round\'s own source', () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: true,
      sourceNote: 'forge comments until #880 lands',
      unreadable: [],
      value: [{ pr: 971, rev: 1, verdict: 'REVISE', author: 'bob', findings: [
        { id: 'F-1', severity: 'blocker', evidenceExcerpt: 'bad thing', cites: 'ADR-1', file: null, line: null },
        { id: 'F-2', severity: 'minor', evidenceExcerpt: 'small thing', cites: null, file: null, line: null },
      ], findingCount: 2, head_sha: 'abc', malformed: [], source: { url: 'https://github.com/o/r/pull/971#c1' } }],
    },
  }));
  const [round] = model.value.tabs[4].entries;
  assert.equal(round.children.length, 2);
  assert.equal(round.children[0].title, 'blocker — F-1');
  assert.match(round.children[0].detail, /bad thing/);
  assert.match(round.children[0].detail, /ADR-1/);
  assert.equal(round.children[0].source, 'https://github.com/o/r/pull/971#c1', "no file/line on this finding — it falls back to the round's own source");
  assert.equal(round.children[1].title, 'minor — F-2');
});

test('#998 R998-5: a finding carrying file/line (a real per-finding anchor — D14 amended, one DOES exist) renders its own [repo: path:line] stamp, not the round\'s URL', () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: true,
      sourceNote: 'forge comments until #880 lands',
      unreadable: [],
      value: [{ pr: 971, rev: 1, verdict: 'REVISE', author: 'bob', findings: [
        { id: 'F-1', severity: 'blocker', evidenceExcerpt: 'bad thing', cites: 'ADR-1', file: 'brain/scripts/governance/run-check.mjs', line: 556 },
      ], findingCount: 1, head_sha: 'abc', malformed: [], source: { url: 'https://github.com/o/r/pull/971#c1' } }],
    },
  }));
  const [round] = model.value.tabs[4].entries;
  assert.equal(round.children[0].source, 'brain/scripts/governance/run-check.mjs:556');
  assert.deepEqual(round.children[0].sourceStamp, { label: '[repo: brain/scripts/governance/run-check.mjs:556]', href: null, kind: 'repo' });
});

test('#998 R998-5: the detail\'s finding count reads findingCount, not findings.length — a malformed verdict keeps it null, never 0', () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: true,
      sourceNote: 'forge comments until #880 lands',
      unreadable: [],
      value: [{ pr: 971, rev: 1, verdict: 'REVISE', author: 'bob', findings: [], findingCount: null, head_sha: 'abc', malformed: ['findings'], source: { url: 'https://github.com/o/r/pull/971#c1' } }],
    },
  }));
  const [round] = model.value.tabs[4].entries;
  assert.match(round.detail, /unknown finding count/, 'findingCount null (malformed/uncomputable) is said, never silently read as 0');
  assert.deepEqual(round.children, []);
});

test('#1009 cold review finding 1: a malformed findings block is one entry saying its block is unreadable, naming the malformed keys, never conflated with a clean zero-findings round', () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: true,
      sourceNote: 'forge comments until #880 lands',
      unreadable: [],
      value: [{ pr: 971, rev: 3, verdict: 'REVISE', author: 'bob', findings: [], findingCount: null, malformed: ['findings'], head_sha: 'abc', source: { url: 'https://github.com/o/r/pull/971#c3' } }],
    },
  }));
  const [round] = model.value.tabs[4].entries;
  assert.match(round.detail, /findings block unreadable/, 'a malformed findings block must be said by name, not folded into a generic "unknown" count');
  assert.match(round.detail, /findings/, 'the said text must name which keys were malformed');
  assert.deepEqual(round.children, []);
});

test('#881 R881-9: a review thread that could not be read is listed with its reason and its PR URL, never skipped', () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: false,
      reason: 'every review thread of this issue is unreadable: #971 (rate limited)',
      sourceNote: 'forge comments until #880 lands',
      unreadable: [{ pr: 971, ok: false, reason: 'rate limited', source: { url: 'https://github.com/o/r/pull/971' } }],
      value: undefined,
    },
  }));
  const reviews = model.value.tabs[4];
  assert.equal(reviews.ok, false);
  assert.match(reviews.reason, /every review thread of this issue is unreadable/);
  assert.equal(reviews.entries.length, 1, 'an unreadable thread is still an entry — skipping it reads as "no rounds were ever posted"');
  assert.equal(reviews.entries[0].pending, true);
  assert.match(reviews.entries[0].detail, /rate limited/);
  assert.equal(reviews.entries[0].source, 'https://github.com/o/r/pull/971');
});

test('#881 R881-9: a readable round and an unreadable thread coexist — both are shown', () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: true,
      sourceNote: 'forge comments until #880 lands',
      unreadable: [{ pr: 972, ok: false, reason: 'rate limited', source: { url: 'https://github.com/o/r/pull/972' } }],
      value: [{ pr: 971, rev: 1, verdict: 'APPROVE', author: 'bob', findings: [], findingCount: 0, head_sha: 'abc', malformed: [], source: { url: 'https://github.com/o/r/pull/971#c1' } }],
    },
  }));
  const reviews = model.value.tabs[4];
  assert.equal(reviews.entries.length, 2);
  assert.equal(reviews.entries[1].pending, true, 'the unreadable thread comes after the rounds that were read');
});

// ── #998 R998-6: the door's two new tabs, sdd and records ───────────────────

test('#998 R998-6: the sdd tab lists the seven stages as done/pending, each sourced to the change dir', () => {
  const model = buildDrawerModel(view({
    sdd: {
      ok: true,
      value: [
        { stage: 'proposal', present: true, source: { path: 'openspec/changes/issue-881-ui' } },
        { stage: 'spec', present: true, source: { path: 'openspec/changes/issue-881-ui' } },
        { stage: 'archive', present: false, source: { path: 'openspec/changes/issue-881-ui' } },
      ],
    },
  }));
  const sdd = model.value.tabs.find((t) => t.id === 'sdd');
  assert.equal(sdd.ok, true);
  assert.deepEqual(sdd.entries.map((e) => e.title), ['proposal', 'spec', 'archive']);
  assert.equal(sdd.entries[0].done, true);
  assert.equal(sdd.entries[2].done, false);
  assert.equal(sdd.entries[2].pending, true);
  assert.equal(sdd.entries[0].source, 'openspec/changes/issue-881-ui');
});

test('#998 R998-6: the records tab lists this issue\'s own records, each sourced to its own file', () => {
  const model = buildDrawerModel(view({
    records: {
      ok: true,
      value: [
        { id: 'rec-b', ts: '2026-09-16T10:00:00Z', actor: 'claude', actorKind: 'agent', type: 'bugfix', supersedes: 'rec-a', source: { path: '.memory/records/rec-b.jsonl' } },
      ],
    },
  }));
  const records = model.value.tabs.find((t) => t.id === 'records');
  assert.equal(records.ok, true);
  assert.equal(records.entries.length, 1);
  assert.equal(records.entries[0].title, 'bugfix — rec-b');
  assert.match(records.entries[0].detail, /claude/);
  assert.match(records.entries[0].detail, /agent/);
  assert.match(records.entries[0].detail, /supersedes rec-a/);
  assert.equal(records.entries[0].source, '.memory/records/rec-b.jsonl');
});

test('#1373 R1373-1/2: a records entry carries the record id and its summary for the page to draw', () => {
  const ok = { ok: true, title: 'Poller holds one timer', excerpt: 'arm() keeps one handle', truncated: false };
  const model = buildDrawerModel(view({
    records: {
      ok: true,
      value: [
        { id: 'rec-a', ts: '2026-09-16T10:00:00Z', actor: 'x', actorKind: 'human', type: 'decision', summary: ok, source: { path: '.memory/records/rec-a.jsonl' } },
        { id: 'rec-b', ts: '2026-09-15T10:00:00Z', actor: 'x', actorKind: 'human', type: 'bugfix', summary: { ok: false, reason: NO_TEXT }, source: { path: '.memory/records/rec-b.jsonl' } },
        { id: 'rec-c', ts: '2026-09-14T10:00:00Z', actor: 'x', actorKind: 'human', type: 'bugfix', source: { path: '.memory/records/rec-c.jsonl' } },
        { id: 'rec-d', ts: '2026-09-13T10:00:00Z', actor: 'x', actorKind: 'human', type: 'bugfix', summary: { ok: true, title: 7 }, source: { path: '.memory/records/rec-d.jsonl' } },
      ],
    },
  }));
  const [a, b, c, d] = model.value.tabs.find((t) => t.id === 'records').entries;
  assert.deepEqual(a.record, { id: 'rec-a', type: 'decision', summary: ok });
  assert.deepEqual(b.record.summary, { ok: false, reason: NO_TEXT }, 'the Memory ledger\'s own wording for an absent content');
  assert.deepEqual(c.record.summary, { ok: false, reason: SUMMARY_MISSING }, 'a row with no summary says so, once');
  assert.deepEqual(d.record.summary, { ok: false, reason: SUMMARY_MISSING }, 'a malformed summary is the same stated gap');
});

test('#998 R998-6: a failing records tab carries only its own reason — the other five tabs are untouched', () => {
  const model = buildDrawerModel(view({
    records: { ok: false, reason: '.memory/index.jsonl is unreadable' },
    spec: { ok: true, value: [{ id: 'R1', title: 't', line: 1, source: { path: 'spec.md', line: 1 }, scenarios: [] }] },
  }));
  assert.deepEqual(model.value.tabs.map((t) => t.id), TAB_IDS);
  assert.equal(model.value.tabs.length, 6);
  const records = model.value.tabs.find((t) => t.id === 'records');
  assert.equal(records.ok, false);
  assert.equal(records.reason, '.memory/index.jsonl is unreadable');
  const spec = model.value.tabs.find((t) => t.id === 'spec');
  assert.equal(spec.ok, true);
  assert.equal(spec.entries.length, 1);
});

test('#881 A3: every leaf the drawer renders carries a non-empty source label', () => {
  const model = buildDrawerModel(view({
    spec: { ok: true, value: [{ id: 'R1', title: 't', line: 1, source: { path: 'spec.md', line: 1 }, scenarios: [{ name: 's', when: 'w', then: 't', complete: true, source: { path: 'spec.md', line: 3 } }] }] },
    tasks: { ok: true, value: [{ line: 2, text: 'do it', done: false, actor: 'a', ts: null, source: { path: 'tasks.md', line: 2 }, attribution: { ok: true, value: { actor: 'a', ts: null } } }] },
    workingMemory: { ok: true, value: { next_action: { ok: true, value: 'x', source: { path: 'b:openspec/changes/issue-1-b/resume.md' } }, current_slice: { ok: false, reason: 'none', source: { path: 'b:openspec/changes/issue-1-b/resume.md' } }, blockers: { ok: true, value: 'none', source: { path: 'b:openspec/changes/issue-1-b/resume.md' } } } },
    reviews: { ok: true, sourceNote: 'n', unreadable: [], value: [{ pr: 1, rev: 1, verdict: 'APPROVE', author: 'a', findings: [], findingCount: 0, head_sha: 'h', malformed: [], source: { url: 'https://f/pull/1' } }] },
  }));
  const all = leaves(model);
  assert.ok(all.length >= 6, `expected leaves from every tab, got ${all.length}`);
  for (const leaf of all) {
    assert.equal(typeof leaf.source, 'string');
    assert.ok(leaf.source.length > 0, `"${leaf.title}" has no source — A3 requires the path or the URL beside every value`);
  }
});

test('#881 A3: a value whose source was lost says so instead of rendering a blank', () => {
  assert.equal(sourceLabel({ path: 'a.md', line: 4 }), 'a.md:4');
  assert.equal(sourceLabel({ path: 'a.md' }), 'a.md');
  assert.equal(sourceLabel({ url: 'https://f/pull/1' }), 'https://f/pull/1');
  assert.equal(sourceLabel(null), 'no source was recorded for this value');
  assert.equal(sourceLabel({}), 'no source was recorded for this value');
});

// ── #998 R998-2: every entry also carries the design's stamp, alongside the
// unchanged sourceLabel string (R998-1's byte-identical page stays byte
// identical; the stamp is additive, for the redesigned screens) ──────────

test('#998 R998-2: every entry carries a sourceStamp beside its unchanged source string', () => {
  const model = buildDrawerModel(view({
    spec: {
      ok: true,
      value: [{
        id: 'R881-6', title: 'every open issue is a node', line: 121, source: { path: 'openspec/changes/issue-881-ui/spec.md', line: 121 },
        scenarios: [],
      }],
    },
  }));
  const [spec] = model.value.tabs;
  assert.equal(spec.entries[0].source, 'openspec/changes/issue-881-ui/spec.md:121', 'sourceLabel is unchanged');
  assert.deepEqual(spec.entries[0].sourceStamp, { label: '[repo: openspec/changes/issue-881-ui/spec.md:121]', href: null, kind: 'repo' });
});

test('#998 R998-2: a review entry\'s stamp carries an href for a forge URL', () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: true,
      sourceNote: 'forge comments until #880 lands',
      unreadable: [],
      value: [{ pr: 971, rev: 1, verdict: 'APPROVE', author: 'bob', findings: [], findingCount: 0, head_sha: 'abc', malformed: [], source: { url: 'https://github.com/o/r/pull/971#c1' } }],
    },
  }));
  const [, , , , reviews] = model.value.tabs;
  assert.equal(reviews.entries[0].sourceStamp.href, 'https://github.com/o/r/pull/971#c1');
  assert.equal(reviews.entries[0].sourceStamp.kind, 'forge');
  assert.equal(reviews.entries[0].sourceStamp.label, '[forge: #971]');
});

// ── #1059 region 08: the SDD tab is the design's numbered strip ───────────
// The design draws seven numbered stages in order — "1 proposal ✓ … 5 apply
// 14/18 … 7 archive —" — not an unordered list of names. The number is the
// stage's position in the lifecycle, which is information: it is what makes a
// gap in the middle visible.
test('#1059 region 08: each SDD entry carries its position in the lifecycle and its mark', () => {
  const model = buildDrawerModel(view({
    sdd: { ok: true, value: [
      { stage: 'proposal', present: true, source: { path: 'openspec/changes/x' } },
      { stage: 'spec', present: false, source: { path: 'openspec/changes/x' } },
    ] },
  }));

  const sdd = model.value.tabs.find((t) => t.id === 'sdd');
  assert.equal(sdd.entries.length, 2);
  assert.equal(sdd.entries[0].position, 1, 'the first stage is 1, as the design numbers it');
  assert.equal(sdd.entries[0].mark, '✓', 'a present stage is ticked');
  assert.equal(sdd.entries[1].position, 2);
  assert.equal(sdd.entries[1].mark, '—', 'a stage that is not there is a dash, never a blank');
});

test('#1059 region 08: the slice plan rides the sdd tab, each slice saying what it claims', () => {
  const model = buildDrawerModel(view({
    sdd: {
      ok: true,
      value: [{ stage: 'proposal', present: true, source: { path: 'd' } }],
      slices: { ok: true, note: 'declared in tasks.md — what each PR did with its slice is not read', value: [
        { slice: 1, claims: ['R1-1', 'R1-2'], terminalPr: 'this PR -> main', source: { path: 'd' } },
      ] },
    },
  }));

  const sdd = model.value.tabs.find((t) => t.id === 'sdd');
  assert.equal(sdd.slices.ok, true);
  assert.equal(sdd.slices.entries.length, 1);
  assert.match(sdd.slices.entries[0].title, /slice 1/i);
  assert.match(sdd.slices.entries[0].detail, /R1-1, R1-2/, 'a slice is named by what it claims');
  assert.deepEqual(sdd.slices.entries[0].sourceStamp, { label: '[repo: d]', href: null, kind: 'repo' });
});

test('#1059 region 08: a change with no declared plan carries the reason, not an empty list', () => {
  const model = buildDrawerModel(view({
    sdd: { ok: true, value: [], slices: { ok: false, reason: 'no slice plan is declared in this change\'s tasks.md' } },
  }));
  const sdd = model.value.tabs.find((t) => t.id === 'sdd');
  assert.equal(sdd.slices.ok, false);
  assert.match(sdd.slices.reason, /no slice plan/i);
});

// ── #1067 cold review, finding cold-1 ──────────────────────────────────────
// `parseSpecCards` learned to collect a WHEN or THEN that attaches to no
// scenario, so it would stop being dropped silently. The reviewer measured
// that `orphans` was read NOWHERE outside the parser: the line was still
// invisible on the page, and the defect was fixed only where tests could see
// it. A reader that collects a fact and never shows it has not fixed
// empty-on-failure, it has moved it one module along.
test('#1067: an orphan WHEN or THEN reaches the spec tab, so the page can say the line exists', () => {
  const model = buildDrawerModel(view({
    spec: {
      ok: true,
      value: [{ id: 'R1-1', title: 'a requirement', source: { path: 'spec.md', line: 1 }, scenarios: [] }],
      orphans: [
        { line: 3, text: '- **WHEN** something happens', source: { path: 'spec.md', line: 3 }, reason: 'this WHEN belongs to no scenario — a scenario opens with a `#### Scenario: <name>` heading' },
      ],
    },
  }));

  assert.equal(model.ok, true);
  const spec = model.value.tabs.find((t) => t.id === 'spec');
  assert.ok(Array.isArray(spec.orphans), 'the spec tab carries the lines the grammar could not attach');
  assert.equal(spec.orphans.length, 1);
  assert.match(spec.orphans[0].title, /WHEN/, 'the line itself is shown, not only a count');
  assert.match(spec.orphans[0].detail, /Scenario/, 'with what it was missing');
  assert.equal(spec.orphans[0].sourceStamp.label, '[repo: spec.md:3]', 'sourced to the line, so the author can go straight to it');
});

test('#1067: a spec with nothing orphaned carries an empty list, never an absent field a renderer has to guard', () => {
  const model = buildDrawerModel(view());
  const spec = model.value.tabs.find((t) => t.id === 'spec');
  assert.deepEqual(spec.orphans, []);
});

// ── #1198: the seven documents ride the SDD tab's rows ──────────────────────

const DIR = 'openspec/changes/issue-881-ui';
const H = 'abc1234'.padEnd(40, '0');
const present = (file, text, extra = {}) => ({ path: `${DIR}/${file}`, ref: 'HEAD', commit: H, state: 'present', text, bytes: text.length, truncated: false, truncatedAt: null, reason: null, note: null, ...extra });
const stageRows = ['proposal', 'spec', 'design', 'tasks', 'apply', 'verify', 'archive'].map((stage) => ({ stage, file: `${stage}.md`, present: true, source: { path: `${DIR}/${stage}.md` } }));
const docsView = (documents, items = stageRows) => buildDrawerModel(view({ sdd: { ok: true, value: items }, documents })).value.tabs.find((t) => t.id === 'sdd');

test('#1198 R1198-1/5: each stage row carries its document view with the path @ commit12 stamp; archive carries none', () => {
  const documents = {
    proposal: present('proposal.md', '# P'), spec: present('spec.md', '# S'), design: present('design.md', '# D'),
    tasks: present('tasks.md', '# T'), apply: present('apply-progress.md', '# A'), verify: present('verify-report.md', '# V'),
  };
  const sdd = docsView(documents);
  assert.deepEqual(sdd.entries.map((e) => e.document?.key ?? null), ['proposal', 'spec', 'design', 'tasks', 'apply', 'verify', null]);
  const proposal = sdd.entries[0].document;
  assert.equal(proposal.state, 'present');
  assert.equal(proposal.stamp, `${DIR}/proposal.md @ abc123400000`);
  assert.equal(proposal.text, '# P');
  assert.equal(proposal.wording, null);
  assert.equal(sdd.entries[6].document, null, 'archive is a stage, not a document');
});

test('#1198 R1198-2: missing and unreadable are worded differently, name the file and the ref, and never carry a body', () => {
  const documents = {
    design: { path: `${DIR}/design.md`, ref: 'HEAD', commit: null, state: 'missing', text: null, reason: null },
    tasks: { path: `${DIR}/tasks.md`, ref: 'HEAD', commit: null, state: 'unreadable', text: null, reason: 'fatal: bad object' },
  };
  const sdd = docsView(documents);
  const design = sdd.entries.find((e) => e.title === 'design').document;
  const tasks = sdd.entries.find((e) => e.title === 'tasks').document;
  assert.equal(design.wording, 'design.md is not committed at HEAD');
  assert.equal(tasks.wording, 'tasks.md could not be read at HEAD: fatal: bad object');
  assert.notEqual(design.wording, tasks.wording);
  assert.equal(design.text, null);
  assert.equal(tasks.text, null);
  assert.equal(design.stamp, `${DIR}/design.md`, 'no invented commit');
});

test('#1198 R1198-3: a truncated document carries the note and still has its text', () => {
  const sdd = docsView({ design: present('design.md', 'xx', { state: 'truncated', truncated: true, truncatedAt: 2, note: 'truncated at 262144 bytes' }) });
  const design = sdd.entries.find((e) => e.title === 'design').document;
  assert.equal(design.state, 'truncated');
  assert.equal(design.note, 'truncated at 262144 bytes');
  assert.equal(design.text, 'xx');
});

test('#1198 D10: the unnumbered resume row is appended after the seven stages only when documents.resume exists', () => {
  assert.equal(docsView(undefined).entries.length, 7, 'no documents: the seven stages only');
  const RESUME = 'openspec/changes/issue-1-x/resume.md';
  const documents = { resume: { path: RESUME, ref: 'feat/x', commit: 'f'.repeat(40), state: 'present', text: '---\nnext_action: go\n---\nbody', reason: null, note: null } };
  const sdd = docsView(documents);
  assert.equal(sdd.entries.length, 8);
  const row = sdd.entries[7];
  assert.equal(row.title, 'working memory — resume.md');
  assert.equal(row.position, undefined, 'unnumbered');
  assert.equal(row.document.key, 'resume');
  assert.equal(row.document.stamp, `${RESUME} @ ffffffffffff`);
  assert.equal(row.source, `feat/x:${RESUME}`, 'sourced to the writer\'s path on the branch (#1201 R2)');
  const missing = docsView({ resume: { path: RESUME, ref: 'feat/x', commit: null, state: 'missing', text: null, reason: null } }).entries[7].document;
  assert.equal(missing.wording, 'resume.md is not committed at feat/x');
});

test('#1198 R1198-1: the tab set is still the six, and a truncated spec or tasks tab note is shown', () => {
  const model = buildDrawerModel(view({ documents: {}, spec: { ok: true, value: [], note: 'truncated at 262144 bytes; cards cover the read part' }, tasks: { ok: true, value: [], note: 'truncated at 262144 bytes; items cover the read part' } }));
  assert.deepEqual(model.value.tabs.map((t) => t.id), TAB_IDS);
  assert.match(model.value.tabs[0].note, /cards cover the read part/);
  assert.match(model.value.tabs[2].note, /items cover the read part/);
});

// ── #1218 R3: a clone with no change branch is `missing`, said once ──

test('#1218 R1218-8: a missing resume.md with a reason reads as that reason, in the SDD row and the Working memory tab', () => {
  const resume = { path: 'resume.md', ref: null, commit: null, state: 'missing', text: null, reason: NO_CHANGE_BRANCH };
  const sdd = docsView({ resume }).entries[7].document;
  assert.equal(sdd.wording, 'resume.md: no change branch in this clone');
  assert.doesNotMatch(sdd.wording, /could not be read/);
  const model = buildDrawerModel(view({ documents: { resume }, workingMemory: { ok: false, reason: sdd.wording } }));
  assert.equal(model.value.tabs[3].reason, 'resume.md: no change branch in this clone');
  assert.equal(NO_CHANGE_BRANCH, 'no change branch in this clone');
});

test('#1218 R1218-8: an unresolved branch reads "the change branch could not be resolved" in the SDD row and the Working memory tab', () => {
  for (const reason of ['more than one */issue-881 branch in this clone: a, b', 'git branch --list failed: fatal: not a git repository']) {
    const resume = { path: 'resume.md', ref: null, commit: null, state: 'unreadable', text: null, reason };
    const sdd = docsView({ resume }).entries[7].document;
    assert.equal(sdd.wording, `resume.md: the change branch could not be resolved: ${reason}`);
    assert.doesNotMatch(sdd.wording, /could not be read at/);
    const model = buildDrawerModel(view({ documents: { resume }, workingMemory: { ok: false, reason: sdd.wording } }));
    assert.equal(model.value.tabs[3].reason, sdd.wording);
  }
});

test('#1218 R1218-8: the no-branch wording has one source — drawer-model.mjs — and change-route.mjs imports it', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const owners = ['drawer-model.mjs', join('..', 'change-route.mjs')].filter((f) => readFileSync(join(here, f), 'utf8').includes('no change branch in this clone'));
  assert.deepEqual(owners, ['drawer-model.mjs']);
  assert.match(readFileSync(join(here, '..', 'change-route.mjs'), 'utf8'), /NO_CHANGE_BRANCH[^;]*from '\.\/lib\/drawer-model\.mjs'/);
});

// ── #883: the "on this machine" blocks and the page's reload rule ───────────

const HEAD40 = 'a'.repeat(40);
const localDoc = (over = {}) => ({
  path: 'openspec/changes/issue-7-x/proposal.md', ref: 'worktree wt-1', commit: null, blob: 'b'.repeat(40), state: 'present', text: '# p\n', bytes: 4, truncated: false,
  truncatedAt: null, reason: null, note: null, overlay: 'new', uncommitted: true, marker: `4 B · ${'b'.repeat(12)}`, ...over,
});
const localBlock = (over = {}) => ({
  leaf: 'wt-1', branch: 'feat/issue-7-x', head: HEAD40, path: '/srv/wt-1', dir: 'openspec/changes/issue-7-x', label: 'worktree wt-1 · feat/issue-7-x',
  state: 'read', documents: { proposal: localDoc() }, absent: ['spec.md', 'resume.md'], resume: { state: 'missing', reason: null, document: null, view: null }, progress: null, ...over,
});
const localModel = (block) => buildDrawerModel(view({ local: [block] })).value.local[0];

test('#883 R883-6: the four document states have their own wording, and a block says why it shows no documents', () => {
  assert.equal(LOCAL_STATE_WORDING.new, 'uncommitted: new');
  assert.equal(LOCAL_STATE_WORDING.modified, 'uncommitted: modified');
  assert.equal(LOCAL_STATE_WORDING.committed('feat/issue-7-x'), 'committed on feat/issue-7-x, not on main');
  assert.equal(LOCAL_STATE_WORDING['same-as-main'], 'same as main');
  const row = (overlay, over = {}) => localModel(localBlock({ documents: { proposal: localDoc({ overlay, uncommitted: overlay === 'new' || overlay === 'modified', ...over }) } })).documents[0];
  assert.equal(row('new').detail, 'uncommitted: new');
  assert.equal(row('modified').detail, 'uncommitted: modified');
  assert.equal(row('committed').detail, 'committed on feat/issue-7-x, not on main');
  assert.equal(row('same-as-main', { text: null }).detail, 'same as main');
  const states = (state, extra = {}) => localModel(localBlock({ state, documents: null, ...extra }));
  assert.match(states('capped').wording, /at most 3 worktrees/);
  assert.equal(states('no-change-dir', { reason: 'no change dir in this worktree' }).wording, 'no change dir in this worktree');
  assert.match(states('unreadable', { reason: 'openspec/changes/issue-7-x is a symbolic link' }).wording, /could not be read: .*symbolic link/);
  assert.match(states('same-as-origin').wording, /same as origin/);
  assert.equal(localModel(localBlock()).wording, null, 'a read block carries no state wording');
});

test('#883 R883-6: a deleted row says it was committed on the branch and is missing from the working tree, and has no body', () => {
  assert.equal(LOCAL_STATE_WORDING.deleted('feat/issue-7-x'), 'uncommitted: deleted (committed on feat/issue-7-x, missing from the working tree)');
  const m = localModel(localBlock({ documents: { tasks: localDoc({ path: 'openspec/changes/issue-7-x/tasks.md', state: 'deleted', overlay: 'deleted', uncommitted: true, text: null, blob: null, marker: null }) } }));
  assert.equal(m.documents[0].detail, 'uncommitted: deleted (committed on feat/issue-7-x, missing from the working tree)');
  assert.equal(m.documents[0].document, null);
});

test('#883 R883-6: a same-as-main row has no document, an unreadable one says why, and the absent documents are named in one line', () => {
  const m = localModel(localBlock({ documents: { proposal: localDoc({ overlay: 'same-as-main', uncommitted: false, text: null }), spec: localDoc({ path: 'openspec/changes/issue-7-x/spec.md', state: 'unreadable', text: null, reason: 'x is a symbolic link', overlay: 'unreadable', uncommitted: false, marker: null }) } }));
  assert.equal(m.documents[0].document, null);
  assert.equal(m.documents[1].document.state, 'unreadable');
  assert.match(m.documents[1].document.wording, /symbolic link/);
  assert.equal(m.absentLine, 'not in this worktree: spec.md, resume.md');
  assert.equal(localModel(localBlock({ absent: [] })).absentLine, null);
});

test('#883 R883-12: a local stamp is <path> @ worktree <leaf> · <bytes> B · <blob12> and changes with one added line', () => {
  const a = localModel(localBlock({ documents: { proposal: localDoc({ marker: `4 B · ${'1'.repeat(12)}` }) } })).documents[0].document;
  const b = localModel(localBlock({ documents: { proposal: localDoc({ marker: `9 B · ${'2'.repeat(12)}` }) } })).documents[0].document;
  assert.equal(a.stamp, `openspec/changes/issue-7-x/proposal.md @ worktree wt-1 · 4 B · ${'1'.repeat(12)}`);
  assert.notEqual(a.stamp, b.stamp);
  assert.equal(a.text, '# p\n');
});

test('#883 R883-6: the tasks row carries its own count, said as read from the working tree', () => {
  const m = localModel(localBlock({ documents: { tasks: localDoc({ path: 'openspec/changes/issue-7-x/tasks.md', overlay: 'modified', progress: { ok: true, value: { done: 1, total: 2 } } }) } }));
  assert.equal(m.documents[0].detail, 'uncommitted: modified · 1 / 2 tasks done · working tree');
});

test('#883 R883-9: the model carries local blocks with the same shape the page draws, and none when the route sent none', () => {
  const m = localModel(localBlock());
  assert.deepEqual([m.key, m.label, m.leaf, m.branch, m.head12], [`wt-1@${'a'.repeat(12)}`, 'worktree wt-1 · feat/issue-7-x', 'wt-1', 'feat/issue-7-x', 'a'.repeat(12)]);
  assert.deepEqual(buildDrawerModel(view()).value.local, []);
  assert.equal(buildDrawerModel(view()).value.localNote, null);
  assert.equal(buildDrawerModel(view({ localNote: 'x' })).value.localNote, 'x');
});

test('#883 R883-11: localChangedFor is true for the selected issue\'s fingerprint, dirState or entry-set change, and false for another issue\'s', () => {
  const entry = (issue, over = {}) => ({ path: `/srv/w${issue}`, issue, fingerprint: 'f1', dirState: 'present', ...over });
  const section = (...entries) => ({ ok: true, value: { entries, hidden: {}, tier: 'working-tree' } });
  const base = section(entry(7), entry(8));
  assert.equal(localChangedFor(base, section(entry(7), entry(8)), 7), false);
  assert.equal(localChangedFor(base, section(entry(7, { fingerprint: 'f2' }), entry(8)), 7), true);
  assert.equal(localChangedFor(base, section(entry(7, { dirState: 'unreadable' }), entry(8)), 7), true);
  assert.equal(localChangedFor(base, section(entry(7), entry(8), entry(7, { path: '/srv/other' })), 7), true);
  assert.equal(localChangedFor(base, section(entry(7)), 7), false, 'issue 8 leaving does not concern issue 7');
  assert.equal(localChangedFor(base, section(entry(7), entry(8, { fingerprint: 'f2' })), 7), false, 'another issue only');
  assert.equal(localChangedFor({ ok: false, pending: true, reason: 'loading' }, base, 7), true, 'the section arriving with this issue\'s entries');
  assert.equal(localChangedFor({ ok: false, reason: 'x' }, { ok: false, reason: 'y' }, 7), false);
});

// ── #1276: the tabs say where their documents came from ─────────────────────

const FIVE = { ok: true, value: { done: 3, total: 5 } };

test('#1276 R1276-6: a worktree or origin source puts its from line on ok and failed tabs; a served-HEAD view has none', () => {
  const sourced = buildDrawerModel(view({
    spec: { ok: true, value: [], from: 'from worktree wt-a · uncommitted: new' },
    sdd: { ok: false, reason: 'boom', from: 'from worktree wt-a · feat/x' },
    tasks: { ok: true, value: [], progress: FIVE, from: 'from origin/feat/x @ aaaaaaaaaaaa' },
  }));
  const [spec, sdd, tasks] = sourced.value.tabs;
  assert.equal(spec.from, 'from worktree wt-a · uncommitted: new');
  assert.equal(sdd.from, 'from worktree wt-a · feat/x');
  assert.equal(sdd.ok, false);
  assert.equal(tasks.from, 'from origin/feat/x @ aaaaaaaaaaaa');

  const served = buildDrawerModel(view({ tasks: { ok: true, value: [], progress: FIVE } }));
  for (const tab of served.value.tabs) assert.equal('from' in tab, false, `${tab.id} has no from key`);
  assert.equal(served.value.tabs[2].header, '3 / 5 tasks done · at HEAD');
});

test('#1276 R1276-6: the tasks header names its source: working tree for a worktree, at origin/<branch> for origin', () => {
  const header = (progressSource) => buildDrawerModel(view({ tasks: { ok: true, value: [], progress: FIVE, progressSource } })).value.tabs[2].header;
  assert.equal(header('working tree'), '3 / 5 tasks done · working tree');
  assert.equal(header('at origin/feat/x'), '3 / 5 tasks done · at origin/feat/x');
});

test('#1276 R1276-8: an sdd row uses its own detail when the route sent one, and present/missing otherwise', () => {
  const rows = buildDrawerModel(view({
    sdd: { ok: true, value: [
      { stage: 'design', file: 'design.md', present: false, detail: 'uncommitted: deleted (committed on feat/x, missing from the working tree)', source: { path: 'a' } },
      { stage: 'spec', file: 'spec.md', present: true, source: { path: 'b' } },
      { stage: 'tasks', file: 'tasks.md', present: false, source: { path: 'c' } },
    ] },
  })).value.tabs[1].entries;
  assert.deepEqual(rows.map((r) => r.detail), ['uncommitted: deleted (committed on feat/x, missing from the working tree)', 'present', 'missing']);
});

test('#1276 D92: the model carries the tab source for the empty-state line, and null when the route sent none', () => {
  const tabSource = { kind: 'worktree', leaf: 'wt-a', branch: 'feat/x', dir: 'd', label: 'worktree wt-a' };
  assert.deepEqual(buildDrawerModel(view({ tabSource })).value.tabSource, tabSource);
  assert.equal(buildDrawerModel(view()).value.tabSource, null);
});

test('#1312 D150: a queued thread is an entry that says "not read yet", an unreadable one still says "unreadable"', () => {
  const model = buildDrawerModel(view({
    reviews: {
      ok: true,
      sourceNote: 'n',
      unreadable: [
        { pr: 971, ok: false, pending: true, reason: 'queued', source: 'u1' },
        { pr: 972, ok: false, reason: 'HTTP 502', source: 'u2' },
      ],
      value: [],
    },
  }));
  const [q, u] = model.value.tabs[4].entries;
  assert.equal(q.title, '#971 — not read yet');
  assert.match(q.detail, /not been read yet: queued/);
  assert.equal(u.title, '#972 — unreadable');
  assert.match(u.detail, /could not be read: HTTP 502/);
});

// ── #1314 R1314-2: the header names the change dir and branch; a tab count is only ever a measured one ──

const counts = (model) => Object.fromEntries(model.value.tabs.map((t) => [t.id, t.count]));
const REVIEW_ROUND = { pr: 971, rev: 1, verdict: 'APPROVE', author: 'bob', findings: [], findingCount: 0, head_sha: 'abc1234', source: { url: 'https://github.com/o/r/pull/971#c1' } };

test('#1314 R1314-2: tabs carry counts measured from their own source, each with a title that names it', () => {
  const model = buildDrawerModel(view({
    spec: { ok: true, value: [{ id: 'R1-1', title: 'a', source: { path: 's.md', line: 1 }, scenarios: [] }, { id: 'R1-2', title: 'b', source: { path: 's.md', line: 2 }, scenarios: [] }] },
    sdd: { ok: true, value: [{ stage: 'proposal', present: true, source: { path: 'p.md' } }, { stage: 'spec', present: true, source: { path: 's.md' } }, { stage: 'design', present: false, source: { path: 'd.md' } }] },
    tasks: { ok: true, value: [], progress: { ok: true, value: { done: 14, total: 18 } } },
    reviews: { ok: true, value: [REVIEW_ROUND, { ...REVIEW_ROUND, rev: 2 }], unreadable: [] },
    records: { ok: true, value: [{ id: 'a', type: 'bugfix', summary: null }] },
  }));
  const c = counts(model);
  assert.deepEqual(c.spec, { text: '2', title: '2 requirement(s) read' });
  assert.deepEqual(c.sdd, { text: '2/3', title: '2 of 3 stages present' });
  assert.deepEqual(c.tasks, { text: '14/18', title: '14 / 18 tasks done · at HEAD' }, 'the title is the Tasks header: one wording for the count');
  assert.deepEqual(c.reviews, { text: '2', title: '2 review round(s) read' });
  assert.deepEqual(c.records, { text: '1', title: '1 record(s) for this issue' });
  assert.equal(c.workingMemory, null, 'a tab with nothing countable shows no number');
});

test('#1314 R1314-2: a count is never shown when its source was not fully read', () => {
  const noDir = { ok: false, reason: 'no change dir', source: { path: 'openspec/changes/issue-881-*' } };
  const failed = counts(buildDrawerModel(view({ changeDir: null, spec: noDir, sdd: noDir, tasks: noDir, records: noDir, reviews: noDir })));
  for (const id of ['spec', 'sdd', 'tasks', 'reviews', 'records']) assert.equal(failed[id], null, `${id}: a tab that failed has no count`);

  const truncated = counts(buildDrawerModel(view({ tasks: { ok: true, value: [], progress: { ok: false, code: 'truncated', reason: 'x' } } })));
  assert.equal(truncated.tasks, null, 'tasks.md truncated: no total, so no count');

  const pending = counts(buildDrawerModel(view({ reviews: { ok: true, value: [REVIEW_ROUND], unreadable: [{ pr: 972, pending: true, reason: 'queued', source: { url: 'u' } }] } })));
  assert.equal(pending.reviews, null, 'one thread is not read yet, so "1" would claim a total nobody measured');
});

test('#1314 R1314-2: a truncated spec.md prints no count; a stage row that could not be read blanks the stages count', () => {
  const card = { id: 'R1-1', title: 'a', source: { path: 's.md', line: 1 }, scenarios: [] };
  const cut = counts(buildDrawerModel(view({ spec: { ok: true, value: [card], truncated: true, note: 'truncated at 262144 bytes; cards cover the read part' } })));
  assert.equal(cut.spec, null, 'cards cover the read part only: no total');
  const whole = counts(buildDrawerModel(view({ spec: { ok: true, value: [card] } })));
  assert.deepEqual(whole.spec, { text: '1', title: '1 requirement(s) read' });

  const rows = (second) => ({ ok: true, value: [{ stage: 'proposal', present: true, source: { path: 'p.md' } }, { stage: 'spec', present: false, ...second, source: { path: 's.md' } }] });
  assert.equal(counts(buildDrawerModel(view({ sdd: rows({ unreadable: true, detail: 'could not be read: EIO' }) }))).sdd, null, 'an unreadable stage is not "absent": no x/y');
  assert.deepEqual(counts(buildDrawerModel(view({ sdd: rows({}) }))).sdd, { text: '1/2', title: '1 of 2 stages present' });
});

test('#1314 R1314-2: the header carries the change dir and the branch the tabs read; the served HEAD has no branch to name', () => {
  const head = buildDrawerModel(view({ tabSource: { kind: 'head', dir: 'openspec/changes/issue-881-ui' } })).value.header;
  assert.deepEqual(head, { changeDir: 'openspec/changes/issue-881-ui', branch: null, line: 'change dir: openspec/changes/issue-881-ui · served HEAD' });

  const wt = buildDrawerModel(view({ changeDir: null, tabSource: { kind: 'worktree', leaf: 'w', branch: 'feat/issue-881-ui', dir: 'openspec/changes/issue-881-ui', label: 'worktree w' } })).value.header;
  assert.deepEqual(wt, { changeDir: 'openspec/changes/issue-881-ui', branch: 'feat/issue-881-ui', line: 'change dir: openspec/changes/issue-881-ui · branch: feat/issue-881-ui' });

  const origin = buildDrawerModel(view({ changeDir: null, tabSource: { kind: 'origin', branch: 'feat/issue-881-ui', sha12: 'abcdef123456', dir: 'openspec/changes/issue-881-ui', label: 'origin/feat/issue-881-ui @ abcdef123456' } })).value.header;
  assert.equal(origin.branch, 'feat/issue-881-ui');

  const none = buildDrawerModel(view({ changeDir: null, tabSource: { kind: 'none', reason: 'x' } })).value.header;
  assert.deepEqual(none, { changeDir: null, branch: null, line: null }, 'no change dir: nothing is claimed');
});
