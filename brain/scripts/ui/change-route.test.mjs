// change-route.test.mjs — GET /api/change/{issue}'s IO composition (#881,
// PR 3 / B1, D8/D11-D14). `buildChangeView` is exercised directly here
// (server.test.mjs covers the HTTP route + parity); this file is the
// fixture matrix cold review round 1-7 of #971 taught this project to build
// FIRST, before code (lessons: `sdd/issue-881-ui-server-canvas/review-lessons`).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildChangeView, REMOTE_DRAWER_CAP, REVIEWS_SOURCE_NOTE } from './change-route.mjs';
import { documentWording } from './lib/drawer-model.mjs';
import { fakeGit } from './test-support/fake-git.mjs';
import { execFileSync } from 'node:child_process';
import { testTmp } from '../lib/test-tmp.mjs';

const ISSUE = 881;
const CHANGE_DIR = 'openspec/changes/issue-881-ui-server-canvas';
const BRANCH = 'feat/issue-881-slice-3-lib';
const TASKS_PATH = `${CHANGE_DIR}/tasks.md`;
const RESUME_PATH = `${CHANGE_DIR}/resume.md`; // the writer's path (#1201 R2), never the branch root

const SPEC_TEXT = [
  '### R881-8: the inspector drawer, four tabs, every value sourced',
  '#### Scenario: full drawer for a change with a spec and tasks',
  "- **WHEN** a node's issue has a change dir",
  '- **THEN** the Spec tab shows its cards',
].join('\n');

const TASKS_TEXT = ['## Phase 1', '- [x] ship layout.mjs', '- [ ] ship change-route.mjs'].join('\n');

const BLAME_PORCELAIN = [
  'abc1234abc1234abc1234abc1234abc1234abc1 1 2 1',
  'author csrinaldi',
  'author-mail <c@example.com>',
  'author-time 1694700000',
  'author-tz +0000',
  'committer csrinaldi',
  'committer-mail <c@example.com>',
  'committer-time 1694700000',
  'committer-tz +0000',
  'summary ship layout.mjs',
  'filename tasks.md',
  '\t- [x] ship layout.mjs',
  'def5678def5678def5678def5678def5678def5 2 3',
  '\t- [ ] ship change-route.mjs',
].join('\n');

const RESUME_TEXT = ['---', 'next_action: ship change-route.mjs', 'current_slice: 3', 'blockers:', '---', 'prose'].join('\n');

const HEAD = 'abc1234'.padEnd(40, '0');
const BRANCH_TIP = 'def5678'.padEnd(40, '0');

/**
 * The repo every test reads, as an in-memory git (#1198): `spec.md` and
 * `tasks.md` are COMMITTED at HEAD, never read from a working tree. `branch`
 * is a ref carrying `resume.md` (null = the ref exists with no resume.md);
 * `branches` adds refs for the `git branch --list` cases.
 */
function gitFor({ spec = SPEC_TEXT, tasks = TASKS_TEXT, files = {}, branches = {}, resume, blame = BLAME_PORCELAIN, fail } = {}) {
  const committed = { ...files };
  if (spec !== null) committed[`${CHANGE_DIR}/spec.md`] = spec;
  if (tasks !== null) committed[`${CHANGE_DIR}/tasks.md`] = tasks;
  const refs = { ...branches };
  if (resume !== undefined) refs[BRANCH] = { commit: BRANCH_TIP, files: resume === null ? {} : { [RESUME_PATH]: resume } };
  return fakeGit({ files: committed, head: HEAD, branches: refs, blame, fail });
}

function makeSnapshot({
  changes = [{ id: 'issue-881-ui-server-canvas', issue: ISSUE, slug: 'ui-server-canvas', dir: CHANGE_DIR }],
  prs = [], reviews = [], records = { ok: true, value: { records: [], duplicates: { ids: 0 } } }, localWorktrees,
} = {}) {
  return {
    ...(localWorktrees ? { localWorktrees } : {}),
    changes: { ok: true, value: changes },
    prs: { ok: true, value: prs },
    reviews: { ok: true, value: reviews },
    records,
  };
}

// ── 1. a change dir and an open PR ──────────────────────────────────────────

test('#881: a change dir + an open PR resolves the branch from the PR, never calling `git branch --list`', () => {
  const snapshot = makeSnapshot({ prs: [{ number: 957, title: 'x', headBranch: BRANCH, issue: ISSUE }] });
  const run = gitFor({ resume: RESUME_TEXT });
  const result = buildChangeView({ issue: ISSUE, snapshot, project: 'o/r', _run: run });
  assert.equal(result.ok, true);
  assert.equal(result.value.issue, ISSUE);
  assert.equal(result.value.changeDir, CHANGE_DIR);
  assert.equal(result.value.spec.ok, true);
  assert.equal(result.value.spec.value.length, 1);
  assert.equal(result.value.workingMemory.ok, true);
  assert.deepEqual(result.value.workingMemory.value.next_action, { ok: true, value: 'ship change-route.mjs', source: { path: `${BRANCH}:${RESUME_PATH}` } });
  assert.deepEqual(result.value.workingMemory.value.blockers, { ok: true, value: [], source: { path: `${BRANCH}:${RESUME_PATH}` } });
  assert.ok(!run.calls.some((args) => args[0] === 'branch'), 'a PR headBranch is authoritative — no branch listing needed');
  assert.ok(!run.calls.some((args) => args[0] === 'show'), 'resume.md is read as a blob at the resolved commit, never `git show <branch>:`');
});

// ── 2. a change dir, no PR, exactly one matching branch ─────────────────────

test('#881: no PR but exactly one */issue-<N>[-*] branch resolves working memory from it', () => {
  const snapshot = makeSnapshot({ prs: [] });
  const run = gitFor({ resume: RESUME_TEXT });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.workingMemory.ok, true);
  assert.equal(result.value.workingMemory.value.current_slice.value, '3'); // parseFrontmatter scalars are always strings — resume-frontmatter.mjs does no type coercion
  assert.deepEqual(run.calls.find((args) => args[0] === 'branch'), ['branch', '--list', `*/issue-${ISSUE}`, `*/issue-${ISSUE}-*`]);
});

test('#883 R883-15: a fix/ branch, with or without a slug, resolves working memory like a feat/ one', () => {
  for (const name of ['fix/issue-881-x', 'chore/issue-881']) {
    const run = gitFor({ branches: { [name]: { commit: BRANCH_TIP, files: { [RESUME_PATH]: RESUME_TEXT } }, 'feat/issue-8810-other': { commit: BRANCH_TIP, files: {} } } });
    const result = buildChangeView({ issue: ISSUE, snapshot: makeSnapshot({ prs: [] }), _run: run });
    assert.equal(result.value.workingMemory.ok, true, name);
    assert.equal(result.value.workingMemory.value.current_slice.source.path.startsWith(`${name}:`), true);
  }
});

// ── 3. two matching branches ─────────────────────────────────────────────────

test('#881: two matching */issue-<N>[-*] branches renders none, listing both, and never calls `git show`', () => {
  const snapshot = makeSnapshot({ prs: [] });
  const run = gitFor({ branches: { [`feat/issue-${ISSUE}-a`]: { commit: BRANCH_TIP, files: {} }, [`feat/issue-${ISSUE}-b`]: { commit: BRANCH_TIP, files: {} } } });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.workingMemory.ok, false);
  assert.match(result.value.workingMemory.reason, new RegExp(`feat/issue-${ISSUE}-a`));
  assert.match(result.value.workingMemory.reason, new RegExp(`feat/issue-${ISSUE}-b`));
  assert.ok(!run.calls.some((args) => args[0] === 'show'), 'ambiguous branch resolution must never guess which one to read');
});

const localEntry = (branch, dirState = 'present') => ({ path: `/wt/${branch.replace(/\//g, '-')}`, leaf: branch.replace(/\//g, '-'), branch, head: BRANCH_TIP, issue: ISSUE, dirState, dir: dirState === 'present' ? CHANGE_DIR : null, capped: false });
const localSection = (...entries) => ({ ok: true, value: { entries, hidden: {}, tier: 'working-tree' } });

test('#883 W2: several matching branches resolve to the one a kept worktree holding the change dir has checked out', () => {
  const feat = `feat/issue-${ISSUE}-x`;
  const tracker = `feature/issue-${ISSUE}-y`;
  const run = gitFor({ branches: { [feat]: { commit: BRANCH_TIP, files: { [RESUME_PATH]: RESUME_TEXT } }, [tracker]: { commit: BRANCH_TIP, files: {} } } });
  const snapshot = makeSnapshot({ prs: [], localWorktrees: localSection(localEntry(feat), localEntry(tracker, 'missing')) });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.workingMemory.ok, true);
  assert.equal(result.value.workingMemory.value.current_slice.source.path.startsWith(`${feat}:`), true);
});

test('#883 W2: several matching branches each held by a kept worktree with the change dir refuse, naming the worktrees', () => {
  const a = `feat/issue-${ISSUE}-x`;
  const b = `feature/issue-${ISSUE}-y`;
  const run = gitFor({ branches: { [a]: { commit: BRANCH_TIP, files: {} }, [b]: { commit: BRANCH_TIP, files: {} } } });
  const snapshot = makeSnapshot({ prs: [], localWorktrees: localSection(localEntry(a), localEntry(b)) });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.workingMemory.ok, false);
  assert.match(result.value.workingMemory.reason, /more than one \*\/issue-881 branch/);
  assert.match(result.value.workingMemory.reason, /feat-issue-881-x/);
  assert.match(result.value.workingMemory.reason, /feature-issue-881-y/);
  assert.ok(!run.calls.some((args) => args[0] === 'show'));
});

// ── 4. no change dir ─────────────────────────────────────────────────────────

test('#881: no change dir — Spec and Tasks both say so, naming the expected glob as their source', () => {
  const snapshot = makeSnapshot({ changes: [] });
  const run = gitFor({ spec: null, tasks: null });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.changeDir, null);
  assert.deepEqual(result.value.spec, { ok: false, reason: `no change dir at openspec/changes/issue-${ISSUE}-*`, source: { path: `openspec/changes/issue-${ISSUE}-*` } });
  assert.deepEqual(result.value.tasks, { ok: false, reason: `no change dir at openspec/changes/issue-${ISSUE}-*`, source: { path: `openspec/changes/issue-${ISSUE}-*` } });
});

// ── 5. unreadable spec.md ────────────────────────────────────────────────────

test('#881/#1198: a change dir with tasks.md but no committed spec.md — Spec says it is not committed at HEAD, Tasks is unaffected', () => {
  const snapshot = makeSnapshot();
  const run = gitFor({ spec: null });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.spec.ok, false);
  assert.match(result.value.spec.reason, /spec\.md is not committed at HEAD \(abc123400000\)/);
  assert.doesNotMatch(result.value.spec.reason, /could not be read/, 'missing and unreadable never share wording');
  assert.deepEqual(result.value.spec.source, { path: `${CHANGE_DIR}/spec.md` });
  assert.equal(result.value.tasks.ok, true);
  assert.equal(result.value.tasks.value.length, 2);
});

// ── 6. tasks.md present but blame throws ─────────────────────────────────────

test('#881: tasks.md present but `git blame` throws — the checklist still renders in full, attribution said false per row, never dropped', () => {
  const snapshot = makeSnapshot();
  const run = gitFor({ fail: { blame: "fatal: no such path 'tasks.md' in HEAD" } });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.tasks.ok, true);
  assert.equal(result.value.tasks.value.length, 2);
  for (const item of result.value.tasks.value) {
    assert.equal(item.attribution.ok, false);
    assert.match(item.attribution.reason, /no such path/);
    assert.equal(item.actor, 'unknown', 'never dropped — tasks-list.mjs\'s own "unknown" default still renders');
  }
  const blameCall = run.calls.find((args) => args[0] === 'blame');
  assert.deepEqual(blameCall, ['blame', '--porcelain', 'HEAD', '--', TASKS_PATH]);
});

// ── #1199 R1199-4: the tab counts its own HEAD text ─────────────────────────

test('#1199 R1199-4: the Tasks tab carries the count of the HEAD text, not the working tree', () => {
  const snapshot = makeSnapshot();
  const head = ['- [x] a', '- [x] b', '- [ ] c', '- [ ] d', '- [ ] e'].join('\n');
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: gitFor({ tasks: head }) });
  assert.deepEqual(result.value.tasks.progress, { ok: true, value: { done: 2, total: 5 } });
});

test('#1199 R1199-4: a tasks.md with no checkboxes carries the no-items reason', () => {
  const result = buildChangeView({ issue: ISSUE, snapshot: makeSnapshot(), _run: gitFor({ tasks: '# Tasks\nprose' }) });
  assert.equal(result.value.tasks.progress.code, 'no-items');
});

test('#1199 R1199-4: a truncated tasks.md has no total, and its items still render', () => {
  const big = `- [x] first\n- [ ] second\n${'a'.repeat(300000)}`;
  const result = buildChangeView({ issue: ISSUE, snapshot: makeSnapshot(), _run: gitFor({ tasks: big }) });
  assert.equal(result.value.tasks.ok, true);
  assert.equal(result.value.tasks.progress.ok, false);
  assert.equal(result.value.tasks.progress.code, 'truncated');
  assert.match(result.value.tasks.progress.reason, /larger than 262144 bytes/);
  assert.equal(result.value.tasks.value.length, 2);
});

// ── 7. resume.md absent on the branch ────────────────────────────────────────

test('#881: a resolved branch with no committed resume.md — the tab says so, and no longer promises a later slice (#883)', () => {
  const snapshot = makeSnapshot({ prs: [{ number: 5, title: 'x', headBranch: BRANCH, issue: ISSUE }] });
  const run = gitFor({ resume: null });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.deepEqual(result.value.workingMemory, {
    ok: false,
    reason: `no committed resume.md on ${BRANCH}`,
  });
});

// ── 8. resume.md present ─────────────────────────────────────────────────────

test('#881: a resolved branch with a committed resume.md shapes all three ruling-3 fields, sourced to <branch>:resume.md', () => {
  const snapshot = makeSnapshot({ prs: [{ number: 5, title: 'x', headBranch: BRANCH, issue: ISSUE }] });
  const run = gitFor({ resume: RESUME_TEXT });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.workingMemory.ok, true);
  const { next_action: nextAction, current_slice: currentSlice, blockers } = result.value.workingMemory.value;
  assert.deepEqual(nextAction, { ok: true, value: 'ship change-route.mjs', source: { path: `${BRANCH}:${RESUME_PATH}` } });
  assert.deepEqual(currentSlice, { ok: true, value: '3', source: { path: `${BRANCH}:${RESUME_PATH}` } }); // parseFrontmatter scalars are always strings
  assert.deepEqual(blockers, { ok: true, value: [], source: { path: `${BRANCH}:${RESUME_PATH}` } });
});

test('#1243 R1243-6: a stray blob named like a change id beside the change dir does not hide resume.md', () => {
  const snapshot = makeSnapshot({ prs: [{ number: 5, title: 'x', headBranch: BRANCH, issue: ISSUE }] });
  const stray = `openspec/changes/issue-${ISSUE}-notes.md`;
  const run = fakeGit({
    files: { [`${CHANGE_DIR}/spec.md`]: SPEC_TEXT, [`${CHANGE_DIR}/tasks.md`]: TASKS_TEXT }, head: HEAD, blame: BLAME_PORCELAIN,
    branches: { [BRANCH]: { commit: BRANCH_TIP, files: { [RESUME_PATH]: RESUME_TEXT, [stray]: 'n' } } },
  });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.workingMemory.ok, true);
});

// ── 9. reviews with two rounds ───────────────────────────────────────────────

test('#881: two review rounds on the issue\'s PR render oldest first, each sourced to the PR URL, with the D14 caveat note', () => {
  const snapshot = makeSnapshot({
    prs: [{ number: 957, title: 'x', headBranch: BRANCH, issue: ISSUE }],
    reviews: [{
      pr: 957,
      ok: true,
      verdicts: [
        { pr: 957, head_sha: 'aaa1111', rev: 1, verdict: 'request-changes', author: 'reviewer-a', findings: 2, malformed: [] },
        { pr: 957, head_sha: 'bbb2222', rev: 2, verdict: 'approve', author: 'reviewer-a', findings: 0, malformed: [] },
      ],
      latest: null,
    }],
  });
  const run = gitFor({ resume: RESUME_TEXT });
  const result = buildChangeView({ issue: ISSUE, snapshot, project: 'o/r', _run: run });
  assert.equal(result.value.reviews.ok, true);
  assert.equal(result.value.reviews.sourceNote, REVIEWS_SOURCE_NOTE);
  assert.equal(result.value.reviews.value.length, 2);
  assert.equal(result.value.reviews.value[0].rev, 1, 'oldest first');
  assert.equal(result.value.reviews.value[1].rev, 2);
  for (const round of result.value.reviews.value) assert.deepEqual(round.source, { url: 'https://github.com/o/r/pull/957' });
});

// ── 10. an issue not in the graph at all ─────────────────────────────────────

test('#881: an issue absent from snapshot.graph still gets a full view — the route never depends on graph membership', () => {
  const snapshot = {
    ...makeSnapshot({ prs: [{ number: 957, title: 'x', headBranch: BRANCH, issue: ISSUE }] }),
    graph: { ok: true, value: { nodes: [{ number: 999, state: 'open' }], edges: [] } }, // 881 is nowhere in here
  };
  const run = gitFor({ resume: RESUME_TEXT });
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.ok, true);
  assert.equal(result.value.changeDir, CHANGE_DIR);
  assert.equal(result.value.spec.ok, true);
  assert.equal(result.value.tasks.ok, true);
});

// ── top-level guards ─────────────────────────────────────────────────────────

test('#881: a non-positive-integer issue is a said failure, never a thrown error', () => {
  assert.equal(buildChangeView({ root: '/x', issue: 0, snapshot: makeSnapshot() }).ok, false);
  assert.equal(buildChangeView({ root: '/x', issue: -1, snapshot: makeSnapshot() }).ok, false);
  assert.equal(buildChangeView({ root: '/x', issue: 1.5, snapshot: makeSnapshot() }).ok, false);
});

test('#881: no snapshot supplied is a said failure, never a thrown error', () => {
  const result = buildChangeView({ root: '/x', issue: ISSUE, snapshot: null });
  assert.equal(result.ok, false);
  assert.ok(result.reason.length > 0);
});

// ── pre-push review of slice 3, blocker: an unreadable review thread is said ──
//
// `reviewRows` in status/snapshot.mjs fails PER PR while the outer list still
// resolves: a row is `{pr, ok:false, reason}`. Skipping it left the tab
// `ok:true` with an empty list — the same reading as "no rounds ever posted"
// (`evidence-reader-empty-on-failure.md`, R881-9).

test('#881: one readable and one unreadable review thread — the rounds render and the unreadable PR is said with its reason and URL', () => {
  const snapshot = makeSnapshot({
    prs: [{ number: 957, title: 'x', headBranch: BRANCH, issue: ISSUE }, { number: 958, title: 'y', headBranch: 'feat/other', issue: ISSUE }],
    reviews: [
      { pr: 957, ok: true, verdicts: [{ pr: 957, head_sha: 'aaa1111', rev: 1, verdict: 'approve', author: 'reviewer-a', findings: 0, malformed: [] }], latest: null },
      { pr: 958, ok: false, reason: 'thread unreadable: rate limited' },
    ],
  });
  const run = gitFor({ resume: RESUME_TEXT });
  const reviews = buildChangeView({ issue: ISSUE, snapshot, project: 'o/r', _run: run }).value.reviews;
  assert.equal(reviews.ok, true);
  assert.equal(reviews.value.length, 1, 'the readable round is still there');
  assert.deepEqual(reviews.unreadable, [{ pr: 958, ok: false, reason: 'thread unreadable: rate limited', source: { url: 'https://github.com/o/r/pull/958' } }]);
});

// ── #998 R998-6: the records tab — this issue's own memory records ──────────

test('#998 R998-6: two records filed against this issue and one against another render newest first, sourced to their own file', () => {
  const records = {
    ok: true,
    value: {
      records: [
        { id: 'rec-a', ts: '2026-09-15T10:00:00Z', actor: 'csrinaldi', actorKind: 'human', type: 'decision', issue: ISSUE, file: '.memory/records/rec-a.jsonl' },
        { id: 'rec-b', ts: '2026-09-16T10:00:00Z', actor: 'claude', actorKind: 'agent', type: 'bugfix', issue: ISSUE, supersedes: 'rec-a', file: '.memory/records/rec-b.jsonl' },
        { id: 'rec-c', ts: '2026-09-16T11:00:00Z', actor: 'csrinaldi', actorKind: 'human', type: 'decision', issue: 999, file: '.memory/records/rec-c.jsonl' },
      ],
      duplicates: { ids: 0 },
    },
  };
  const snapshot = makeSnapshot({ records });
  const run = gitFor();
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.records.ok, true);
  assert.deepEqual(result.value.records.value.map((r) => r.id), ['rec-b', 'rec-a'], 'newest first, and the other issue\'s record is excluded');
  assert.deepEqual(result.value.records.value[0], {
    id: 'rec-b', ts: '2026-09-16T10:00:00Z', actor: 'claude', actorKind: 'agent', type: 'bugfix', supersedes: 'rec-a',
    source: { path: '.memory/records/rec-b.jsonl' },
  });
});

test('#998 R998-6: an unreadable records section is the tab\'s own reason, never an empty list read as "no records"', () => {
  const snapshot = makeSnapshot({ records: { ok: false, reason: '.memory/index.jsonl is unreadable' } });
  const run = gitFor();
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.deepEqual(result.value.records, { ok: false, reason: '.memory/index.jsonl is unreadable' });
});

// ── #998 R998-6: the sdd tab — this issue's own seven-stage presence ────────

test('#998 R998-6/#1059: the sdd tab names each stage\'s FILE and sources the row to that file, not to the directory all seven share', () => {
  const changes = [{ id: 'issue-881-ui-server-canvas', issue: ISSUE, slug: 'ui-server-canvas', dir: CHANGE_DIR, artefacts: { proposal: true, spec: true, design: false, tasks: true, apply: false, verify: false, archive: false } }];
  const snapshot = makeSnapshot({ changes });
  const run = gitFor();
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.equal(result.value.sdd.ok, true);
  // The maintainer, clicking a ticket: "SDD no está listando los files".
  // Seven rows carried the same `{path: CHANGE_DIR}` stamp, so the tab said a
  // stage was present without ever naming the file that made it present, and
  // the provenance — the thing every value on this page is supposed to carry
  // — pointed all seven readers at one directory.
  assert.deepEqual(result.value.sdd.value, [
    { stage: 'proposal', file: 'proposal.md', present: true, source: { path: `${CHANGE_DIR}/proposal.md` } },
    { stage: 'spec', file: 'spec.md', present: true, source: { path: `${CHANGE_DIR}/spec.md` } },
    { stage: 'design', file: 'design.md', present: false, source: { path: `${CHANGE_DIR}/design.md` } },
    { stage: 'tasks', file: 'tasks.md', present: true, source: { path: `${CHANGE_DIR}/tasks.md` } },
    { stage: 'apply', file: 'apply-progress.md', present: false, source: { path: `${CHANGE_DIR}/apply-progress.md` } },
    { stage: 'verify', file: 'verify-report.md', present: false, source: { path: `${CHANGE_DIR}/verify-report.md` } },
    { stage: 'archive', file: 'archive-report.md', present: false, source: { path: `${CHANGE_DIR}/archive-report.md` } },
  ]);

  // A stage that is MISSING still names the file it would be, because "design
  // is missing" is only actionable if the reader knows what to create.
  const design = result.value.sdd.value.find((row) => row.stage === 'design');
  assert.equal(design.present, false);
  assert.equal(design.file, 'design.md', 'an absent stage names the file it would be written to');
});

test('#998 R998-6: no change dir for this issue is the sdd tab\'s own said reason — the exact noChangeDirTab reason, the same fact the spec/tasks tabs already share for this cause, never a second wording for it', () => {
  const snapshot = makeSnapshot({ changes: [] });
  const run = gitFor();
  const result = buildChangeView({ issue: ISSUE, snapshot, _run: run });
  assert.deepEqual(result.value.sdd, {
    ok: false,
    reason: `no change dir at openspec/changes/issue-${ISSUE}-*`,
    source: { path: `openspec/changes/issue-${ISSUE}-*` },
  });
});

test('#881: when every review thread of the issue is unreadable the tab is ok:false and names them — never an empty list', () => {
  const snapshot = makeSnapshot({
    prs: [{ number: 957, title: 'x', headBranch: BRANCH, issue: ISSUE }],
    reviews: [{ pr: 957, ok: false, reason: 'thread unreadable: rate limited' }],
  });
  const run = gitFor({ resume: RESUME_TEXT });
  const reviews = buildChangeView({ issue: ISSUE, snapshot, project: 'o/r', _run: run }).value.reviews;
  assert.equal(reviews.ok, false);
  assert.match(reviews.reason, /957.*rate limited/);
  assert.equal(reviews.unreadable.length, 1);
  assert.equal(reviews.sourceNote, REVIEWS_SOURCE_NOTE);
});

// ── #1059 region 08: the panel's SDD tab carries the slice plan ───────────
// The design puts the slice plan under the stage strip, in the same tab. The
// plan is DECLARED in tasks.md and read into `sliceScopes`; what a PR actually
// did with it is not read, and the tab says so rather than implying it.
test('#1059 region 08: the sdd tab carries the declared slice plan beside the stages', () => {
  const snapshot = {
    changes: { ok: true, value: [{
      issue: 881, dir: 'openspec/changes/issue-881-ui', artefacts: { proposal: true, spec: true },
      sliceScopes: { ok: true, value: [
        { slice: 1, claims: ['R881-1', 'R881-2'], terminal_pr: 'this PR -> main' },
        { slice: 2, claims: ['R881-3'], terminal_pr: null },
      ] },
    }] },
  };

  const view = buildChangeView({ _run: gitFor(), snapshot, issue: 881, project: 'o/r' });
  const sdd = view.value.sdd;

  assert.equal(sdd.ok, true);
  assert.ok(Array.isArray(sdd.value), 'the stages stay an array, so every existing reader keeps working');
  assert.equal(sdd.slices.ok, true);
  assert.equal(sdd.slices.value.length, 2);
  assert.deepEqual(sdd.slices.value[0].claims, ['R881-1', 'R881-2'], 'a slice is judged against what it claims');
  assert.match(sdd.slices.note, /not read/i, 'what a PR did with the plan is not read, and the tab says so');
});

test('#1059 region 08: a change with no declared plan says so, and an unreadable one passes its reason through', () => {
  const none = buildChangeView({ _run: gitFor(), snapshot: { changes: { ok: true, value: [{ issue: 5, dir: 'd', artefacts: {} }] } }, issue: 5 });
  assert.equal(none.value.sdd.slices.ok, false);
  assert.match(none.value.sdd.slices.reason, /no slice plan/i);

  const broken = buildChangeView({ _run: gitFor(), snapshot: { changes: { ok: true, value: [{ issue: 5, dir: 'd', artefacts: {}, sliceScopes: { ok: false, reason: 'the block would not parse' } }] } }, issue: 5 });
  assert.equal(broken.value.sdd.slices.reason, 'the block would not parse');
});

// ── #1198 phase 4: the seven documents, read from the object store ──────────

const DOC_FILES = { proposal: 'proposal.md', spec: 'spec.md', design: 'design.md', tasks: 'tasks.md', apply: 'apply-progress.md', verify: 'verify-report.md' };
const docPath = (key) => `${CHANGE_DIR}/${DOC_FILES[key]}`;
const SIX = Object.keys(DOC_FILES);

function allArtifacts(overrides = {}) {
  return Object.fromEntries(SIX.map((k) => [docPath(k), overrides[k] ?? `# ${k}\n\nbody of ${k}\n`]));
}

function viewOf(run, snapshot = makeSnapshot({ prs: [{ number: 5, title: 'x', headBranch: BRANCH, issue: ISSUE }] })) {
  return buildChangeView({ issue: ISSUE, snapshot, _run: run }).value;
}

const fakeWith = (o) => gitFor({ spec: null, tasks: null, resume: RESUME_TEXT, ...o });

test('#1198 R1198-1: seven committed artifacts give exactly seven present documents and no archive entry', () => {
  const { documents } = viewOf(fakeWith({ files: allArtifacts() }));
  assert.deepEqual(Object.keys(documents).sort(), ['apply', 'design', 'proposal', 'resume', 'spec', 'tasks', 'verify']);
  for (const [key, doc] of Object.entries(documents)) {
    assert.equal(doc.state, 'present', key);
    assert.ok(doc.text.length > 0, key);
  }
  assert.ok(!('archive' in documents));
});

test('#1198 R1198-2: a zero-byte committed tasks.md is present with empty text, never missing', () => {
  const { documents } = viewOf(fakeWith({ files: allArtifacts({ tasks: '' }) }));
  assert.equal(documents.tasks.state, 'present');
  assert.equal(documents.tasks.text, '');
});

test('#1198 R1198-2/5: an absent file is missing, names the path it looked for and carries no invented commit', () => {
  const files = allArtifacts();
  delete files[docPath('design')];
  const { documents } = viewOf(fakeWith({ files }));
  assert.equal(documents.design.state, 'missing');
  assert.equal(documents.design.path, docPath('design'));
  assert.equal(documents.design.commit, null);
  assert.equal(documents.design.text, null);
});

test('#1198 R1198-2: a failing rev-parse or ls-tree makes all six unreadable with the reason, and never a body', () => {
  for (const sub of ['rev-parse', 'ls-tree']) {
    const { documents } = viewOf(fakeWith({ files: allArtifacts(), fail: { [sub]: `fatal: ${sub} exploded` } }));
    for (const key of SIX) {
      assert.equal(documents[key].state, 'unreadable', `${sub}/${key}`);
      assert.match(documents[key].reason, new RegExp(`${sub} exploded`));
      assert.equal(documents[key].text, null);
      assert.equal(documents[key].commit, null);
    }
  }
});

test('#1198 R1198-2: a failing cat-file makes only that document unreadable, with the reason', () => {
  const { documents } = viewOf(fakeWith({ files: allArtifacts(), fail: { [`cat-file:${docPath('design')}`]: 'fatal: bad object' } }));
  assert.equal(documents.design.state, 'unreadable');
  assert.match(documents.design.reason, /bad object/);
  assert.equal(documents.proposal.state, 'present');
});

test('#1198 R1198-2: a tree or a symlink in the artifact slot is unreadable, and missing and unreadable are worded differently', () => {
  const run = fakeGit({ files: allArtifacts(), head: HEAD, modes: { [docPath('design')]: '120000' }, trees: [docPath('verify')], branches: { [BRANCH]: { commit: BRANCH_TIP, files: { [RESUME_PATH]: RESUME_TEXT } } }, blame: '' });
  const { documents } = viewOf(run);
  assert.equal(documents.design.state, 'unreadable');
  assert.match(documents.design.reason, /symlink/);
  assert.equal(documents.verify.state, 'unreadable');
  assert.match(documents.verify.reason, /tree/);
  const missing = allArtifacts();
  delete missing[docPath('spec')];
  assert.notEqual(viewOf(fakeWith({ files: missing })).documents.spec.reason, documents.design.reason);
});

test('#1198: without a change dir the six stage documents are null', () => {
  const { documents } = viewOf(gitFor({ spec: null, tasks: null, resume: RESUME_TEXT }), makeSnapshot({ changes: [], prs: [{ number: 5, title: 'x', headBranch: BRANCH, issue: ISSUE }] }));
  for (const key of SIX) assert.equal(documents[key], null, key);
  assert.equal(documents.resume.state, 'present');
});

// ── caps (R1198-3) ──────────────────────────────────────────────────────────

test('#1198 R1198-3: a 300000-byte design is truncated at 262144 bytes and says so', () => {
  const { documents } = viewOf(fakeWith({ files: allArtifacts({ design: 'a'.repeat(300000) }) }));
  assert.equal(documents.design.state, 'truncated');
  assert.equal(documents.design.truncated, true);
  assert.equal(documents.design.truncatedAt, 262144);
  assert.ok(Buffer.byteLength(documents.design.text) <= 262144);
  assert.equal(documents.design.bytes, 300000);
  assert.equal(documents.design.note, 'truncated at 262144 bytes');
});

test('#1198 R1198-3: exactly 262144 bytes is present, whole, with no truncation', () => {
  const { documents } = viewOf(fakeWith({ files: allArtifacts({ design: 'a'.repeat(262144) }) }));
  assert.equal(documents.design.state, 'present');
  assert.equal(documents.design.truncated, false);
  assert.equal(documents.design.text.length, 262144);
});

test('#1198 R1198-3: a cut that lands inside a multibyte character backs up and invents no U+FFFD', () => {
  const text = 'a'.repeat(262143) + 'é' + 'tail'; // é is 2 bytes: bytes 262143 and 262144
  const { documents } = viewOf(fakeWith({ files: allArtifacts({ design: text }) }));
  assert.equal(documents.design.state, 'truncated');
  assert.ok(!documents.design.text.includes('�'));
  assert.equal(documents.design.truncatedAt, 262143);
  assert.equal(documents.design.text, 'a'.repeat(262143));
});

test('#1198 R1198-3: a 2 MB document is read with maxBuffer = size + 4096 and is truncated, not unreadable', () => {
  const run = fakeWith({ files: allArtifacts({ design: 'a'.repeat(2 * 1024 * 1024) }) });
  const { documents } = viewOf(run);
  assert.equal(documents.design.state, 'truncated');
  const idx = run.calls.findIndex((a) => a[0] === 'cat-file' && run.opts[run.calls.indexOf(a)]?.maxBuffer === 2 * 1024 * 1024 + 4096);
  assert.ok(idx >= 0, 'cat-file ran with the size-derived maxBuffer');
});

test('#1198 R1198-3: a blob above the 8 MiB read limit is unreadable with its size, and is never read', () => {
  const run = fakeGit({ files: allArtifacts(), head: HEAD, sizes: { [docPath('design')]: 9 * 1024 * 1024 }, branches: {}, blame: '' });
  const { documents } = viewOf(run);
  assert.equal(documents.design.state, 'unreadable');
  assert.match(documents.design.reason, /9437184 bytes exceeds the read limit/);
  const designBlobReads = run.opts.filter((o, i) => run.calls[i][0] === 'cat-file' && o?.maxBuffer > 9 * 1024 * 1024);
  assert.equal(designBlobReads.length, 0);
});

// ── seam and one read path (R1198-4) ────────────────────────────────────────

test('#1198 R1198-4: no artifact is read from the working tree — change-route.mjs has no artifact filesystem read', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('./change-route.mjs', import.meta.url), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.doesNotMatch(code, /\b_read\s*\(|\breadFileSync\b|from 'node:fs'/, 'no working-tree reader remains');
});

test('#1198 R1198-4: a two-argument run stub still works (the third argument is optional)', () => {
  const calls = [];
  const full = fakeWith({ files: allArtifacts() });
  const twoArg = (file, args) => { calls.push(args); return full(file, args); };
  const { documents } = viewOf(twoArg);
  assert.equal(documents.proposal.state, 'present');
});

// ── stamps (R1198-5) ────────────────────────────────────────────────────────

test('#1198 R1198-5: a present document is stamped with its path and the commit it was read at', () => {
  const { documents } = viewOf(fakeWith({ files: allArtifacts() }));
  assert.equal(documents.proposal.path, docPath('proposal'));
  assert.equal(documents.proposal.commit, HEAD);
  assert.equal(documents.proposal.ref, 'HEAD');
});

test('#1198 R1198-5: pathspecs are literal — a `*` in a directory name is never globbed', () => {
  const run = fakeWith({ files: allArtifacts() });
  viewOf(run);
  const ls = run.calls.find((a) => a.includes('ls-tree'));
  assert.equal(ls[0], '--literal-pathspecs');
  assert.deepEqual(ls.slice(0, 6), ['--literal-pathspecs', 'ls-tree', '-l', '-z', HEAD, '--']);
  assert.equal(ls.length, 6 + SIX.length);
});

// ── resume at the branch tip (D7) ───────────────────────────────────────────

test('#1198 R1198-4/5: resume.md committed on the branch is present, stamped with the branch tip, read as a blob at the resolved tip', () => {
  const run = fakeWith({ files: allArtifacts() });
  const { documents } = viewOf(run);
  assert.equal(documents.resume.state, 'present');
  assert.equal(documents.resume.commit, BRANCH_TIP);
  assert.equal(documents.resume.ref, BRANCH);
  assert.equal(documents.resume.text, RESUME_TEXT);
  assert.ok(!run.calls.some((a) => a[0] === 'show'), 'no `git show` is run');
  assert.ok(run.calls.some((a) => a.includes('ls-tree') && a.includes(BRANCH_TIP)), 'the tree is listed at the resolved commit');
  assert.equal(documents.proposal.commit, HEAD, 'the six HEAD documents are unaffected');
});

test('#1198 cold-1: resume.md is stamped and read at ONE resolved commit, even when the branch advances between calls', () => {
  const TIP_A = 'a1'.padEnd(40, '0');
  const TIP_B = 'b2'.padEnd(40, '0');
  const TEXT_A = `${RESUME_TEXT}\nfrom A`;
  const TEXT_B = `${RESUME_TEXT}\nfrom B, a longer and different body`;
  const base = { files: allArtifacts(), head: HEAD, blame: '' };
  const before = fakeGit({ ...base, branches: { [BRANCH]: { commit: TIP_A, files: { [RESUME_PATH]: TEXT_A } }, [TIP_A]: { commit: TIP_A, files: { [RESUME_PATH]: TEXT_A } } } });
  const after = fakeGit({ ...base, branches: { [BRANCH]: { commit: TIP_B, files: { [RESUME_PATH]: TEXT_B } }, [TIP_A]: { commit: TIP_A, files: { [RESUME_PATH]: TEXT_A } }, [TIP_B]: { commit: TIP_B, files: { [RESUME_PATH]: TEXT_B } } } });
  const calls = [];
  let advanced = false;
  const run = (file, args, opts) => {
    calls.push(args);
    const out = (advanced ? after : before)(file, args, opts);
    if (args[0] === 'rev-parse' && args[2] === `${BRANCH}^{commit}`) advanced = true; // the branch moves right after it was resolved
    return out;
  };
  const { documents } = viewOf(run);
  assert.equal(documents.resume.state, 'present');
  assert.equal(documents.resume.commit, TIP_A);
  assert.equal(documents.resume.text, TEXT_A);
  assert.equal(documents.resume.bytes, Buffer.byteLength(TEXT_A));
  const resolvedAt = calls.findIndex((a) => a[0] === 'rev-parse' && a[2] === `${BRANCH}^{commit}`);
  const later = calls.slice(resolvedAt + 1).filter((a) => a.some((x) => x === BRANCH || x === `${BRANCH}:resume.md`));
  assert.deepEqual(later, [], 'after resolution no call may name the bare branch again');
});

test('#1198 D7: a branch without resume.md is missing; an unresolvable branch is unreadable with the reason', () => {
  const missing = viewOf(gitFor({ spec: null, tasks: null, resume: null, files: allArtifacts() })).documents.resume;
  assert.equal(missing.state, 'missing');
  assert.equal(missing.commit, null);
  const noBranch = viewOf(gitFor({ spec: null, tasks: null, files: allArtifacts() }), makeSnapshot()).documents.resume;
  assert.equal(noBranch.state, 'missing', '#1218 R3: no change branch is an absence, not a failure');
  assert.equal(noBranch.reason, 'no change branch in this clone');
});

test('#1218 R1218-8: a failing `git branch --list` and an ambiguous listing stay unreadable and carry their reason', () => {
  const failing = viewOf(gitFor({ files: allArtifacts(), fail: { branch: 'fatal: not a git repository' } }), makeSnapshot());
  assert.equal(failing.documents.resume.state, 'unreadable');
  assert.match(failing.documents.resume.reason, /git branch --list failed: fatal: not a git repository/);
  const two = viewOf(gitFor({ files: allArtifacts(), branches: { 'feat/issue-881-a': { commit: BRANCH_TIP, files: {} }, 'feat/issue-881-b': { commit: BRANCH_TIP, files: {} } } }), makeSnapshot());
  assert.equal(two.documents.resume.state, 'unreadable');
  assert.match(two.documents.resume.reason, /more than one \*\/issue-881 branch in this clone/);
});

test('#1218 R1218-8: an unresolved branch (ambiguous or git failed) says the branch could not be resolved, on the Working memory tab and the SDD row', () => {
  const failing = viewOf(gitFor({ files: allArtifacts(), fail: { branch: 'fatal: not a git repository' } }), makeSnapshot());
  const two = viewOf(gitFor({ files: allArtifacts(), branches: { 'feat/issue-881-a': { commit: BRANCH_TIP, files: {} }, 'feat/issue-881-b': { commit: BRANCH_TIP, files: {} } } }), makeSnapshot());
  for (const [view, reason] of [[failing, /git branch --list failed: fatal: not a git repository/], [two, /more than one \*\/issue-881 branch in this clone/]]) {
    assert.equal(view.documents.resume.state, 'unreadable');
    assert.match(view.workingMemory.reason, /^resume\.md: the change branch could not be resolved: /);
    assert.match(view.workingMemory.reason, reason);
    assert.doesNotMatch(view.workingMemory.reason, /could not be read at/);
    assert.equal(documentWording(view.documents.resume), view.workingMemory.reason);
  }
});

test('#1218 R1218-8: the Working memory tab and the resume document say the no-branch case in the same words', () => {
  const view = viewOf(gitFor({ files: allArtifacts() }), makeSnapshot());
  assert.equal(view.workingMemory.ok, false);
  assert.equal(view.workingMemory.reason, 'resume.md: no change branch in this clone');
  assert.doesNotMatch(view.workingMemory.reason, /could not be read/);
});

test('#1218 R1218-8: a change branch that was created and then deleted is missing, in a real repository', (t) => {
  const root = testTmp('no-branch-');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'init');
  git('branch', 'feat/issue-881-gone');
  git('branch', '-D', 'feat/issue-881-gone');
  const { documents } = buildChangeView({ root, issue: ISSUE, snapshot: makeSnapshot(), project: 'o/r' }).value;
  assert.equal(documents.resume.state, 'missing');
  assert.equal(documents.resume.reason, 'no change branch in this clone');
  assert.ok(t);
});

test('#1198 cold-2: the Working memory tab tells an unreadable resume.md from a missing one, in the SDD row\'s own words', () => {
  const unreadables = {
    symlink: fakeGit({ files: allArtifacts(), head: HEAD, modes: { [RESUME_PATH]: '120000' }, branches: { [BRANCH]: { commit: BRANCH_TIP, files: { [RESUME_PATH]: RESUME_TEXT } } }, blame: '' }),
    tree: fakeGit({ files: allArtifacts(), head: HEAD, trees: [RESUME_PATH], branches: { [BRANCH]: { commit: BRANCH_TIP, files: { [RESUME_PATH]: RESUME_TEXT } } }, blame: '' }),
    oversize: fakeGit({ files: allArtifacts(), head: HEAD, sizes: { [RESUME_PATH]: 9 * 1024 * 1024 }, branches: { [BRANCH]: { commit: BRANCH_TIP, files: { [RESUME_PATH]: RESUME_TEXT } } }, blame: '' }),
  };
  for (const [kind, run] of Object.entries(unreadables)) {
    const view = viewOf(run);
    assert.equal(view.documents.resume.state, 'unreadable', kind);
    assert.equal(view.workingMemory.ok, false, kind);
    assert.equal(view.workingMemory.reason, `resume.md could not be read at ${BRANCH}: ${view.documents.resume.reason}`, kind);
    assert.doesNotMatch(view.workingMemory.reason, /no committed resume\.md/, kind);
  }
  const missing = viewOf(gitFor({ spec: null, tasks: null, resume: null, files: allArtifacts() }));
  assert.match(missing.workingMemory.reason, /^no committed resume\.md on /);
});

test('#1198 D7: resolveBranch runs once per view, shared by the Working memory tab and the resume document', () => {
  const run = fakeWith({ files: allArtifacts() });
  viewOf(run, makeSnapshot());
  assert.equal(run.calls.filter((a) => a[0] === 'branch').length, 1);
});

// ── phase 5: spec and tasks from HEAD, one read (AC7) ───────────────────────

test('#1198 R1198-4: the spec tab shows HEAD, never a working-tree edit (three committed requirements stay three)', () => {
  const three = ['R1-1', 'R1-2', 'R1-3'].map((r) => `### ${r}: title ${r}\n#### Scenario: s ${r}\n- **WHEN** w\n- **THEN** t`).join('\n\n');
  const v = viewOf(gitFor({ spec: three, resume: RESUME_TEXT }));
  assert.equal(v.spec.ok, true);
  assert.equal(v.documents.spec.text, three);
  assert.equal(v.spec.value.length, 3);
});

test('#1198 R1198-4: the tasks tab counts the checkboxes committed at HEAD', () => {
  const v = viewOf(gitFor({ tasks: '- [x] one\n- [ ] two\n', resume: RESUME_TEXT }));
  assert.equal(v.tasks.value.filter((i) => i.done).length, 1);
  assert.equal(v.documents.tasks.text, '- [x] one\n- [ ] two\n');
});

test('#1198 R1198-4: spec and tasks tab wording names the path and HEAD for missing and for unreadable', () => {
  const missing = viewOf(gitFor({ spec: null, tasks: null, resume: RESUME_TEXT }));
  assert.equal(missing.spec.reason, `${CHANGE_DIR}/spec.md is not committed at HEAD (${HEAD.slice(0, 12)})`);
  assert.equal(missing.tasks.reason, `${CHANGE_DIR}/tasks.md is not committed at HEAD (${HEAD.slice(0, 12)})`);
  const broken = viewOf(gitFor({ resume: RESUME_TEXT, fail: { 'ls-tree': 'fatal: not a tree' } }));
  assert.equal(broken.spec.ok, false);
  assert.match(broken.spec.reason, /spec\.md could not be read at HEAD: fatal: not a tree/);
  assert.match(broken.tasks.reason, /tasks\.md could not be read at HEAD/);
});

test('#1198 R1198-3/4: a truncated spec adds the tab note and its cards cover the read part', () => {
  const card = '### R1-1: title\n#### Scenario: s\n- **WHEN** w\n- **THEN** t\n\n';
  const spec = card.repeat(Math.ceil(300000 / card.length));
  const v = viewOf(gitFor({ spec, resume: RESUME_TEXT }));
  assert.equal(v.documents.spec.state, 'truncated');
  assert.equal(v.spec.ok, true);
  assert.match(v.spec.note, /truncated at 262144 bytes; cards cover the read part/);
  assert.equal(v.spec.value.length, v.documents.spec.text.match(/^### R/gm).length);
});

test('#1198 AC7: spec.md is read from the object store exactly once, and the cards come from the same string', () => {
  const run = gitFor({ resume: RESUME_TEXT });
  const v = viewOf(run);
  const specSha = run('git', ['--literal-pathspecs', 'ls-tree', '-l', '-z', HEAD, '--', `${CHANGE_DIR}/spec.md`]).split('\0')[0].split('\t')[0].trim().split(/\s+/)[2];
  assert.equal(run.calls.filter((a) => a[0] === 'cat-file' && a[2] === specSha).length, 1);
  assert.equal(v.spec.value.length, 1);
});

test('#1198 AC7: a failing spec read makes the document unreadable and the tab reports the same failure, never an empty card list', () => {
  const v = viewOf(gitFor({ resume: RESUME_TEXT, fail: { [`cat-file:${CHANGE_DIR}/spec.md`]: 'fatal: bad object' } }));
  assert.equal(v.documents.spec.state, 'unreadable');
  assert.equal(v.spec.ok, false);
  assert.match(v.spec.reason, /bad object/);
});

test('#1218 R1218-9/10: a headBranch that exists only as a remote ref is unreadable and the reason names git\'s cause', () => {
  const root = testTmp('remote-only-');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'init');
  git('update-ref', 'refs/remotes/origin/feat/issue-881-remote-only', 'HEAD');
  const snapshot = makeSnapshot({ prs: [{ number: 5, title: 'x', headBranch: 'feat/issue-881-remote-only', issue: ISSUE }] });
  const { documents, workingMemory } = buildChangeView({ root, issue: ISSUE, snapshot, project: 'o/r' }).value;
  assert.equal(documents.resume.state, 'unreadable');
  assert.match(documents.resume.reason, /fatal: Needed a single revision/);
  assert.doesNotMatch(documents.resume.reason, /[\r\n]/);
  assert.ok(documents.resume.reason.length <= 200);
  assert.doesNotMatch(documents.resume.reason, /^Command failed/);
  assert.match(workingMemory.reason, /fatal: Needed a single revision/);
});

// ── #1276 R1276-4: origin is the source only when main and every worktree hold nothing ──

const OR_ISSUE = 7;
const OR_DIR = 'openspec/changes/issue-7-x';
const OR_SHA = (n) => `${n}`.padStart(2, '0').padEnd(40, 'e');
const OR_SPEC = '### R7-1: Title\n#### Scenario: s\n- **WHEN** w\n- **THEN** t\n';
const OR_TASKS = '- [x] 1.1 a\n- [ ] 1.2 b\n';

function originEntry(n, branch = `feat/issue-7-r${n}`) {
  return {
    branch, sha: OR_SHA(n), tipAt: '2026-10-01T00:00:00Z', author: 'Ada Lovelace', kind: 'grammar', issue: OR_ISSUE, pr: null,
    change: { ok: true, value: { dir: OR_DIR, artefacts: {} } }, resume: { state: 'missing' },
  };
}

function originSnapshot(entries, { prs = [], localWorktrees } = {}) {
  return {
    ...(localWorktrees ? { localWorktrees } : {}),
    changes: { ok: true, value: [] },
    prs: { ok: true, value: prs }, reviews: { ok: true, value: [] },
    records: { ok: true, value: { records: [], duplicates: { ids: 0 } } },
    remoteChanges: { ok: true, value: { base: 'origin/main', branches: entries, unjoined: [], hidden: { base: 0, lane: 0, merged: 0 }, prsApplied: true, deferred: 0 } },
  };
}

function originGit(n, extra = {}) {
  const branches = {};
  for (let i = 1; i <= n; i += 1) branches[`origin/feat/issue-7-r${i}`] = { commit: OR_SHA(i), files: { [`${OR_DIR}/spec.md`]: OR_SPEC, [`${OR_DIR}/tasks.md`]: OR_TASKS, ...extra } };
  return fakeGit({ files: {}, head: HEAD, branches, blame: BLAME_PORCELAIN });
}

test('R1276-4: an origin-only change feeds the Spec, SDD and Tasks tabs, each saying so, with the blame at the origin sha', () => {
  const run = originGit(1);
  const { value } = buildChangeView({ issue: OR_ISSUE, snapshot: originSnapshot([originEntry(1)]), _run: run });

  const from = `from origin/feat/issue-7-r1 @ ${OR_SHA(1).slice(0, 12)}`;
  assert.equal(value.tabSource.kind, 'origin');
  assert.equal(value.spec.ok, true);
  assert.equal(value.spec.value[0].id, 'R7-1');
  assert.equal(value.spec.value[0].source.path, `origin/feat/issue-7-r1:${OR_DIR}/spec.md`);
  assert.equal(value.spec.from, from);
  assert.equal(value.sdd.from, from);
  assert.equal(value.tasks.from, from);
  assert.deepEqual(value.sdd.value.filter((r) => r.present).map((r) => r.stage), ['spec', 'tasks']);
  assert.equal(value.tasks.progressSource, 'at origin/feat/issue-7-r1');
  assert.deepEqual(run.calls.filter((a) => a[0] === 'blame'), [['blame', '--porcelain', OR_SHA(1), '--', `${OR_DIR}/tasks.md`]]);
});

test('R1276-4: several origin branches hold the change — the open PR\'s head branch is the source', () => {
  const run = originGit(2);
  const snapshot = originSnapshot([originEntry(1), originEntry(2)], { prs: [{ number: 9, title: 'x', headBranch: 'feat/issue-7-r2', issue: OR_ISSUE }] });

  const { value } = buildChangeView({ issue: OR_ISSUE, snapshot, _run: run });

  assert.equal(value.tabSource.kind, 'origin');
  assert.equal(value.tabSource.branch, 'feat/issue-7-r2');
  assert.equal(value.spec.from, `from origin/feat/issue-7-r2 @ ${OR_SHA(2).slice(0, 12)}`);
});

test('R1276-4: several origin branches and no open PR naming one of them are refused, naming the branches', () => {
  for (const prs of [[], [{ number: 9, title: 'x', headBranch: 'feat/issue-7-other', issue: OR_ISSUE }]]) {
    const { value } = buildChangeView({ issue: OR_ISSUE, snapshot: originSnapshot([originEntry(1), originEntry(2)], { prs }), _run: originGit(2) });
    assert.equal(value.tabSource.kind, 'refused');
    for (const tab of [value.spec, value.sdd, value.tasks]) {
      assert.equal(tab.reason, 'several origin branches hold the change dir for #7: feat/issue-7-r1, feat/issue-7-r2; no open PR names one of them, so the tabs read none');
    }
  }
});

test('R1276-4: the one holder past the drawer\'s read cap is said, and never read for the tabs', () => {
  const run = originGit(4);
  const entries = [1, 2, 3, 4].map((n) => originEntry(n));
  const snapshot = originSnapshot(entries, { prs: [{ number: 9, title: 'x', headBranch: 'feat/issue-7-r4', issue: OR_ISSUE }] });

  const { value } = buildChangeView({ issue: OR_ISSUE, snapshot, _run: run });

  assert.equal(value.tabSource.kind, 'none');
  assert.equal(value.spec.reason, `origin/feat/issue-7-r4 holds the change dir but is past the drawer's read cap of ${REMOTE_DRAWER_CAP}`);
  assert.equal(run.calls.some((a) => a.includes(OR_SHA(4)) && a[0] !== 'rev-parse'), false, 'the capped branch\'s documents were not read');
});

test('R1276-4: a change on main never consults origin', () => {
  const snapshot = { ...originSnapshot([originEntry(1)]), changes: { ok: true, value: [{ id: 'issue-7-x', issue: OR_ISSUE, slug: 'x', dir: OR_DIR }] } };
  const { value } = buildChangeView({ issue: OR_ISSUE, snapshot, _run: fakeGit({ files: { [`${OR_DIR}/spec.md`]: OR_SPEC }, head: HEAD, branches: {}, blame: '' }) });
  assert.equal(value.tabSource.kind, 'head');
  assert.equal(value.spec.from, undefined);
});

test('#1312 D150: a queued review thread is carried as pending, and a tab of only queued threads says "not read yet", not "unreadable"', () => {
  const snapshot = makeSnapshot({
    prs: [{ number: 957, title: 'x', headBranch: BRANCH, issue: ISSUE }],
    reviews: [{ pr: 957, ok: false, pending: true, reason: 'queued' }],
  });
  const run = gitFor({ resume: RESUME_TEXT });
  const reviews = buildChangeView({ issue: ISSUE, snapshot, project: 'o/r', _run: run }).value.reviews;
  assert.equal(reviews.ok, false);
  assert.equal(reviews.unreadable[0].pending, true);
  assert.doesNotMatch(reviews.reason, /unreadable/);
  assert.match(reviews.reason, /not read yet/);
});
