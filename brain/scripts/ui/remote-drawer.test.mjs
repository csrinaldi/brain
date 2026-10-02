// remote-drawer.test.mjs — #1201 R1201-6/7 (D37): the drawer reads a teammate's
// branch at its SHA through the SAME reader as the served HEAD, shows it BELOW
// the served change (never in place of it), caps the blocks, and never touches
// the working tree.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildChangeView, readHeadDocuments, REMOTE_DRAWER_CAP } from './change-route.mjs';
import { buildDrawerModel } from './lib/drawer-model.mjs';
import { fakeGit } from './test-support/fake-git.mjs';

const ISSUE = 881;
const DIR = 'openspec/changes/issue-881-ui-server-canvas';
const HEAD = 'a1'.padEnd(40, '0');
const RESUME = ['---', 'checkpointed_from: host/feat/issue-881-x', 'checkpointed_at: 2026-09-30T00:00:00.000Z', 'current_slice: 2', 'next_action: ship the reader', 'blockers:', '---', 'body'].join('\n');
const sha = (n) => `${n}`.padStart(2, '0').padEnd(40, 'f');

/** A remote branch tip: its own commit, carrying its own change dir. */
function remote(n, files = {}) {
  return { commit: sha(n), files: { [`${DIR}/proposal.md`]: `# remote ${n}\n`, [`${DIR}/resume.md`]: RESUME, ...files } };
}

function entryFor(n, extra = {}) {
  return {
    branch: `feat/issue-${ISSUE}-r${n}`, sha: sha(n), tipAt: `2026-09-${10 + n}T12:00:00Z`, author: 'Ada Lovelace', kind: 'grammar', issue: ISSUE, pr: null,
    change: { ok: true, value: { dir: DIR, artefacts: {} } }, resume: { state: 'present', path: `${DIR}/resume.md`, reason: null, fields: {} },
    ...extra,
  };
}

function snapshotWith(entries) {
  return {
    changes: { ok: true, value: [{ id: 'issue-881-ui-server-canvas', issue: ISSUE, slug: 'ui-server-canvas', dir: DIR }] },
    prs: { ok: true, value: [] }, reviews: { ok: true, value: [] },
    records: { ok: true, value: { records: [], duplicates: { ids: 0 } } },
    remoteChanges: { ok: true, value: { base: 'origin/main', branches: entries, unjoined: [], hidden: { base: 2, lane: 0, merged: 0 }, prsApplied: true, deferred: 0 } },
  };
}

function gitWith(n, headFiles = { [`${DIR}/proposal.md`]: '# served\n' }) {
  const branches = {};
  for (let i = 1; i <= n; i += 1) branches[`origin/feat/issue-${ISSUE}-r${i}`] = remote(i);
  return fakeGit({ files: headFiles, head: HEAD, branches, blame: '' });
}

// ── 6.1/6.2: readHeadDocuments({ref, label}) ────────────────────────────────

test('#1201 R1201-6: with no ref the reader reads HEAD and stamps "HEAD", exactly as before', () => {
  const run = gitWith(0);
  const { head, documents } = readHeadDocuments({ run, dir: DIR });
  assert.equal(head, HEAD);
  assert.equal(documents.proposal.ref, 'HEAD');
  assert.equal(documents.proposal.text, '# served\n');
});

test('#1201 R1201-6: with a remote SHA it returns that branch\'s documents, labelled, and runs only read commands', () => {
  const run = gitWith(1);
  const { head, documents } = readHeadDocuments({ run, dir: DIR, ref: sha(1), label: 'origin/feat/issue-881-r1' });
  assert.equal(head, sha(1));
  assert.equal(documents.proposal.text, '# remote 1\n');
  assert.equal(documents.proposal.ref, 'origin/feat/issue-881-r1');
  assert.equal(documents.proposal.commit, sha(1));
  assert.deepEqual([...new Set(run.calls.map((a) => a.find((x) => !x.startsWith('-'))))].sort(), ['cat-file', 'ls-tree', 'rev-parse']);
  assert.deepEqual(run.calls[0], ['rev-parse', '--verify', `${sha(1)}^{commit}`]);
});

test('#1201 R1201-6: a pruned or unknown SHA is unreadable with git\'s own reason, never an empty change', () => {
  const { head, documents } = readHeadDocuments({ run: gitWith(0), dir: DIR, ref: sha(9), label: 'origin/gone' });
  assert.equal(head, null);
  for (const doc of Object.values(documents)) {
    assert.equal(doc.state, 'unreadable');
    assert.match(doc.reason, /bad revision/);
    assert.equal(doc.ref, 'origin/gone');
  }
});

// ── 6.3/6.4: the drawer's remote blocks ─────────────────────────────────────

test('#1201 D37: the served change stays first and each remote entry of the issue is one block below it, labelled on origin/<branch> @ <sha12>', () => {
  const view = buildChangeView({ issue: ISSUE, snapshot: snapshotWith([entryFor(1), entryFor(2)]), _run: gitWith(2) }).value;
  assert.equal(view.documents.proposal.text, '# served\n', 'the served change is not replaced');
  assert.equal(view.remote.length, 2);
  const [first] = view.remote;
  assert.equal(first.label, `on origin/feat/issue-881-r1 @ ${sha(1).slice(0, 12)}`);
  assert.deepEqual(Object.keys(first).sort(), ['author', 'branch', 'dir', 'documents', 'label', 'pr', 'resume', 'sameAsServed', 'sha', 'state', 'tipAt'].sort());
  assert.equal(first.documents.proposal.text, '# remote 1\n');
  assert.equal(first.documents.proposal.ref, 'origin/feat/issue-881-r1');
  assert.equal(first.author, 'Ada Lovelace');
});

test('#1201 D37: five remote entries give three blocks with documents; the other two are listed without them and the cap is stated', () => {
  const view = buildChangeView({ issue: ISSUE, snapshot: snapshotWith([1, 2, 3, 4, 5].map((n) => entryFor(n))), _run: gitWith(5) }).value;
  assert.equal(REMOTE_DRAWER_CAP, 3);
  assert.equal(view.remote.length, 5);
  assert.deepEqual(view.remote.map((b) => b.documents !== null), [true, true, true, false, false]);
  assert.deepEqual(view.remote.slice(3).map((b) => b.state), ['capped', 'capped']);
  assert.match(view.remoteNote, /3 of 5/);
  assert.ok(view.remote.slice(3).every((b) => b.branch && b.sha && b.author), 'a listed-only entry keeps its provenance');
});

test('#1201 D37: an entry whose sha equals the served head is sameAsServed and is not re-read', () => {
  const run = gitWith(1);
  const same = entryFor(1, { sha: HEAD });
  const view = buildChangeView({ issue: ISSUE, snapshot: snapshotWith([same]), _run: run }).value;
  assert.equal(view.remote[0].sameAsServed, true);
  assert.equal(view.remote[0].documents, null);
  assert.ok(!run.calls.some((a) => a.includes(`${HEAD}:${DIR}/proposal.md`)));
});

test('#1201 R1201-6: an entry of another issue, or one with no change dir, adds no document block', () => {
  const other = entryFor(1, { issue: 5, branch: 'feat/issue-5-x' });
  const noDir = entryFor(2, { change: { ok: false, state: 'missing', reason: 'no change dir for #881 on origin/feat/issue-881-r2' }, resume: { state: 'missing', path: null, reason: null, fields: null } });
  const view = buildChangeView({ issue: ISSUE, snapshot: snapshotWith([other, noDir]), _run: gitWith(2) }).value;
  assert.equal(view.remote.length, 1, 'the other issue is not this drawer\'s');
  assert.equal(view.remote[0].state, 'no-change-dir');
  assert.equal(view.remote[0].documents, null);
  assert.equal(view.remote[0].resume.state, 'missing');
});

test('#1201 R1201-7: a remote block\'s resume is read through readResumeAt at the entry\'s own sha, from the change dir', () => {
  const view = buildChangeView({ issue: ISSUE, snapshot: snapshotWith([entryFor(1)]), _run: gitWith(1) }).value;
  const { resume } = view.remote[0];
  assert.equal(resume.state, 'present');
  assert.equal(resume.document.path, `${DIR}/resume.md`);
  assert.equal(resume.document.commit, sha(1));
  assert.equal(resume.view.next_action.value, 'ship the reader');
  assert.equal(resume.view.next_action.source.path, `origin/feat/issue-881-r1:${DIR}/resume.md`);
});

test('#1201 R1201-8: an invalid remote resume is said as invalid, not missing', () => {
  const run = fakeGit({ files: { [`${DIR}/proposal.md`]: '# s\n' }, head: HEAD, branches: { 'origin/feat/issue-881-r1': remote(1, { [`${DIR}/resume.md`]: '---\ncurrent_slice: 1\n---\n' }) }, blame: '' });
  const { resume } = buildChangeView({ issue: ISSUE, snapshot: snapshotWith([entryFor(1)]), _run: run }).value.remote[0];
  assert.equal(resume.state, 'invalid');
  assert.match(resume.reason, /next_action/);
});

test('#1201 D37: the drawer model carries the remote blocks, with provenance stamps path @ sha12 and the origin ref', () => {
  const view = buildChangeView({ issue: ISSUE, snapshot: snapshotWith([entryFor(1)]), _run: gitWith(1) });
  const model = buildDrawerModel(view);
  assert.equal(model.ok, true);
  const [block] = model.value.remote;
  assert.equal(block.label, `on origin/feat/issue-881-r1 @ ${sha(1).slice(0, 12)}`);
  assert.equal(block.byline, 'last commit by Ada Lovelace');
  assert.equal(block.tipAt, '2026-09-11T12:00:00Z');
  const proposal = block.documents.find((d) => d.title === 'proposal');
  assert.equal(proposal.document.stamp, `${DIR}/proposal.md @ ${sha(1).slice(0, 12)}`);
  assert.equal(proposal.source, `origin/feat/issue-881-r1:${DIR}/proposal.md`);
  assert.equal(block.resume.state, 'present');
  assert.equal(model.value.remoteNote, null);
  assert.doesNotMatch(JSON.stringify(model), /session|@example\.com/i);
});

test('#1201 D37: a view with no remote entries has no remote blocks (the served drawer is unchanged)', () => {
  const view = buildChangeView({ issue: ISSUE, snapshot: { ...snapshotWith([]) }, _run: gitWith(0) });
  assert.deepEqual(view.value.remote, []);
  assert.equal(view.value.remoteNote, null);
  assert.deepEqual(buildDrawerModel(view).value.remote, []);
  const noSection = snapshotWith([]);
  delete noSection.remoteChanges;
  assert.deepEqual(buildChangeView({ issue: ISSUE, snapshot: noSection, _run: gitWith(0) }).value.remote, []);
});
