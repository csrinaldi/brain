import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDrawerModel, TAB_IDS, sourceLabel } from './drawer-model.mjs';

const view = (over = {}) => ({
  ok: true,
  value: {
    issue: 881,
    changeDir: 'openspec/changes/issue-881-ui',
    spec: { ok: true, value: [] },
    tasks: { ok: true, value: [] },
    workingMemory: { ok: true, value: {} },
    reviews: { ok: true, value: [], unreadable: [], sourceNote: 'forge comments until #880 lands' },
    ...over,
  },
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

test('#881 R881-8: the drawer has exactly four tabs, in the spec\'s order', () => {
  const model = buildDrawerModel(view());
  assert.deepEqual(model.value.tabs.map((t) => t.id), TAB_IDS);
  assert.deepEqual(model.value.tabs.map((t) => t.label), ['Spec', 'Tasks', 'Working memory', 'Reviews']);
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
  for (const tab of model.value.tabs.slice(0, 2)) {
    assert.equal(tab.ok, false);
    assert.equal(tab.reason, 'no change dir at openspec/changes/issue-881-*');
    assert.equal(tab.source, 'openspec/changes/issue-881-*');
    assert.deepEqual(tab.entries, []);
  }
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
  const tasks = model.value.tabs[1];
  assert.equal(tasks.entries[0].title, 'T1. write the failing test');
  assert.equal(tasks.entries[0].done, true);
  assert.match(tasks.entries[0].detail, /alice/);
  assert.equal(tasks.entries[1].done, false);
  assert.equal(tasks.entries[1].pending, true);
  assert.match(tasks.entries[1].detail, /attribution unavailable: git blame failed/);
  assert.equal(tasks.entries[1].source, 'tasks.md:11');
});

test('#881 R881-8 S3: an absent committed resume.md keeps the tab\'s own reason, which names slice 5', () => {
  const model = buildDrawerModel(view({ workingMemory: { ok: false, reason: 'no committed resume.md on feat/issue-881-x; the local overlay arrives in slice 5 (#883)' } }));
  const wm = model.value.tabs[2];
  assert.equal(wm.ok, false);
  assert.match(wm.reason, /slice 5 \(#883\)/);
});

test('#881 R881-8: Working memory shows the three fields, each with its branch-qualified source, a missing one said', () => {
  const source = { path: 'feat/issue-881-x:resume.md' };
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
  const wm = model.value.tabs[2];
  assert.deepEqual(wm.entries.map((e) => e.title), ['next_action', 'current_slice', 'blockers']);
  assert.equal(wm.entries[0].detail, 'ship PR 4');
  assert.equal(wm.entries[0].source, 'feat/issue-881-x:resume.md');
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
  const reviews = model.value.tabs[3];
  assert.equal(reviews.note, 'forge comments until #880 lands');
  assert.deepEqual(reviews.entries.map((e) => e.title), ['#971 rev 1 — REVISE', '#971 rev 2 — APPROVE']);
  assert.match(reviews.entries[0].detail, /bob/);
  assert.match(reviews.entries[0].detail, /2 finding/);
  assert.equal(reviews.entries[0].source, 'https://github.com/o/r/pull/971#c1');
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
  const [round] = model.value.tabs[3].entries;
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
  const [round] = model.value.tabs[3].entries;
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
  const [round] = model.value.tabs[3].entries;
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
  const [round] = model.value.tabs[3].entries;
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
  const reviews = model.value.tabs[3];
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
  const reviews = model.value.tabs[3];
  assert.equal(reviews.entries.length, 2);
  assert.equal(reviews.entries[1].pending, true, 'the unreadable thread comes after the rounds that were read');
});

test('#881 A3: every leaf the drawer renders carries a non-empty source label', () => {
  const model = buildDrawerModel(view({
    spec: { ok: true, value: [{ id: 'R1', title: 't', line: 1, source: { path: 'spec.md', line: 1 }, scenarios: [{ name: 's', when: 'w', then: 't', complete: true, source: { path: 'spec.md', line: 3 } }] }] },
    tasks: { ok: true, value: [{ line: 2, text: 'do it', done: false, actor: 'a', ts: null, source: { path: 'tasks.md', line: 2 }, attribution: { ok: true, value: { actor: 'a', ts: null } } }] },
    workingMemory: { ok: true, value: { next_action: { ok: true, value: 'x', source: { path: 'b:resume.md' } }, current_slice: { ok: false, reason: 'none', source: { path: 'b:resume.md' } }, blockers: { ok: true, value: 'none', source: { path: 'b:resume.md' } } } },
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
  const [, , , reviews] = model.value.tabs;
  assert.equal(reviews.entries[0].sourceStamp.href, 'https://github.com/o/r/pull/971#c1');
  assert.equal(reviews.entries[0].sourceStamp.kind, 'forge');
  assert.equal(reviews.entries[0].sourceStamp.label, '[forge: #971]');
});
