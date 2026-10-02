// remote-changes.test.mjs — #1201 R1201-1/3/4/5/8/12: what the snapshot says
// about teammates' branches, read from `refs/remotes/origin/*` alone. Real git
// over a local bare remote (test-support/git-remote-fixture.mjs): nothing here
// fetches from a network.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readRemoteChanges } from './remote-changes.mjs';
import { gitRun } from '../ui/git-run.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { featureCheckpoint } from '../axes/memory/adapters/engram.mjs';
import { makeRemoteFixture, git, RESUME_VALID } from '../ui/test-support/git-remote-fixture.mjs';
import { recordingGit } from '../ui/test-support/recording-git.mjs';
import { testTmp } from '../lib/test-tmp.mjs';

const noPrs = { ok: true, value: [] };
const names = (list) => list.map((e) => e.branch);

function build(fx, opts = {}) {
  return readRemoteChanges({ run: gitRun(fx.served), prs: noPrs, ...opts });
}

// ── listing and classification (3.2) ────────────────────────────────────────

test('#1201 AC1: two grammar branches are listed with {branch, sha}, from remote-tracking refs alone', () => {
  const fx = makeRemoteFixture();
  const section = build(fx);
  assert.equal(section.ok, true, JSON.stringify(section));
  const { branches } = section.value;
  assert.deepEqual(names(branches), ['feat/issue-11-a', 'feat/issue-12-b']);
  assert.equal(branches[0].sha, fx.shas['feat/issue-11-a']);
  assert.equal(branches[1].sha, fx.shas['feat/issue-12-b']);
  assert.deepEqual(branches.map((e) => e.kind), ['grammar', 'grammar']);
  assert.deepEqual(branches.map((e) => e.issue), [11, 12]);
});

test('#1201 R1201-3: lane branches memory/* and auto-archive/* are hidden and counted, never listed', () => {
  const fx = makeRemoteFixture();
  const { value } = build(fx);
  const all = [...value.branches, ...value.unjoined].map((e) => e.branch);
  assert.ok(!all.some((b) => b.startsWith('memory/') || b.startsWith('auto-archive/')), all.join());
  assert.equal(value.hidden.lane, 2);
});

test('#1201 R1201-3: a merged branch and an empty branch at the base tip are hidden as merged', () => {
  const fx = makeRemoteFixture();
  const { value } = build(fx);
  const all = [...value.branches, ...value.unjoined].map((e) => e.branch);
  assert.ok(!all.includes('feat/issue-15-m'), 'merged by fast-forward');
  assert.ok(!all.includes('feat/issue-13-c'), 'created at main tip, no commit of its own');
  assert.equal(value.hidden.merged, 2);
});

test('#1201 R6: an open PR wins over merged, matched by headBranch; a merged branch with no open PR stays hidden', () => {
  const fx = makeRemoteFixture();
  const prs = { ok: true, value: [{ number: 9, title: 'taken', headBranch: 'feat/issue-15-m', issue: 15 }] };
  const { value } = build(fx, { prs });
  const shown = value.branches.find((e) => e.branch === 'feat/issue-15-m');
  assert.ok(shown, 'shown despite being an ancestor of main');
  assert.deepEqual(shown.pr, { number: 9, title: 'taken' });
  assert.equal(value.hidden.merged, 1, 'only feat/issue-13-c remains hidden');
  assert.equal(build(fx).value.branches.some((e) => e.branch === 'feat/issue-15-m'), false, 'a closed PR is not in the open list: hidden');
});

test('#1201 R1201-3: a branch outside the grammar is unjoined, and hidden carries counts per rule', () => {
  const fx = makeRemoteFixture();
  const { value } = build(fx);
  assert.deepEqual(names(value.unjoined), ['spike/x']);
  assert.equal(value.unjoined[0].kind, 'unjoined');
  assert.equal(value.unjoined[0].issue, null);
  assert.deepEqual(value.hidden, { base: 2, lane: 2, merged: 2 });
  assert.equal(value.base, 'origin/main');
  assert.equal(value.prsApplied, true);
});

test('#1201 D33: with the PR list uncomputable, merged branches are hidden and prsApplied carries the reason', () => {
  const fx = makeRemoteFixture();
  const { value } = build(fx, { prs: { ok: false, reason: 'the PR list could not be read: offline' } });
  assert.equal(value.hidden.merged, 2);
  assert.deepEqual(value.prsApplied, { ok: false, reason: 'the PR list could not be read: offline' });
});

test('#1201 R1201-1: a clone with no remote-tracking refs is uncomputable, never an empty list', () => {
  const dir = testTmp('no-remote-');
  git(dir, ['init', '-q', '-b', 'main']);
  const section = readRemoteChanges({ run: gitRun(dir), prs: noPrs });
  assert.equal(section.ok, false);
  assert.match(section.reason, /no refs\/remotes\/origin\/\* in this clone/);
});

test('#1201 R1201-1: a throwing for-each-ref is uncomputable with a one-line reason', () => {
  const run = () => { throw Object.assign(new Error('Command failed'), { stderr: 'fatal: not a git repository\n' }); };
  const section = readRemoteChanges({ run, prs: noPrs });
  assert.equal(section.ok, false);
  assert.match(section.reason, /fatal: not a git repository/);
  assert.doesNotMatch(section.reason, /\n/);
});

test('#1201 D32: the base is origin/HEAD\'s symref, falls back to origin/main, and neither present is uncomputable', () => {
  const fx = makeRemoteFixture();
  // origin/HEAD points at a different integration branch.
  fx.addBranch('integration', { 'i.txt': 'i\n' });
  fx.refresh();
  git(fx.served, ['remote', 'set-head', 'origin', 'integration']);
  assert.equal(build(fx).value.base, 'origin/integration');
  // No origin/HEAD: origin/main.
  git(fx.served, ['remote', 'set-head', 'origin', '-d']);
  assert.equal(build(fx).value.base, 'origin/main');
  // Neither.
  git(fx.served, ['update-ref', '-d', 'refs/remotes/origin/main']);
  const section = build(fx);
  assert.equal(section.ok, false);
  assert.match(section.reason, /no base/);
});

test('#1201 R1201-1: the base read is two for-each-ref spawns and nothing that fetches or writes', () => {
  const fx = makeRemoteFixture({ standard: false });
  const run = recordingGit(gitRun(fx.served));
  readRemoteChanges({ run, prs: noPrs });
  assert.equal(run.spawns, 2);
  assert.ok(run.calls.every((a) => a[0] === 'for-each-ref'), JSON.stringify(run.calls));
});

// ── ordering and the PR collapse (3.4) ──────────────────────────────────────

test('#1201 D34 R1201-5: branches sort by issue then branch; unjoined by tipAt newest first, then branch; a 400-day-old branch is still listed', () => {
  const fx = makeRemoteFixture({ standard: false });
  fx.addBranch('feat/issue-20-b', { 'a.txt': '1' });
  fx.addBranch('feat/issue-9-a', { 'a.txt': '2' });
  fx.addBranch('feat/issue-20-a', { 'a.txt': '3' });
  fx.addBranch('wip/new', { 'a.txt': '4' }, { ageDays: 1 });
  fx.addBranch('wip/mid-b', { 'a.txt': '5' }, { ageDays: 30, exact: true });
  fx.addBranch('wip/mid-a', { 'a.txt': '6' }, { ageDays: 30, exact: true });
  fx.addBranch('wip/stale', { 'a.txt': '7' }, { ageDays: 400 });
  fx.refresh();
  const { value } = build(fx);
  assert.deepEqual(names(value.branches), ['feat/issue-9-a', 'feat/issue-20-a', 'feat/issue-20-b']);
  assert.deepEqual(names(value.unjoined), ['wip/new', 'wip/mid-a', 'wip/mid-b', 'wip/stale']);
});

test('#1201 R1201-4: a branch with an open PR is ONE entry carrying the PR, never two', () => {
  const fx = makeRemoteFixture();
  const prs = { ok: true, value: [{ number: 31, title: 'eleven', headBranch: 'feat/issue-11-a', issue: 11 }] };
  const { value } = build(fx, { prs });
  const mine = [...value.branches, ...value.unjoined].filter((e) => e.branch === 'feat/issue-11-a');
  assert.equal(mine.length, 1);
  assert.deepEqual(mine[0].pr, { number: 31, title: 'eleven' });
  assert.equal(value.branches.find((e) => e.branch === 'feat/issue-12-b').pr, null, 'a branch with no PR stands alone');
});

// ── blob metadata, never text (3.5) ─────────────────────────────────────────

const entryOf = (section, branch) => [...section.value.branches, ...section.value.unjoined].find((e) => e.branch === branch);
const DIR_11 = 'openspec/changes/issue-11-a';

test('#1201 D31 AC1: a grammar entry carries per-stage {state, blob, bytes} of its OWN change dir, and the section holds no document text', () => {
  const fx = makeRemoteFixture();
  const section = build(fx);
  const a = entryOf(section, 'feat/issue-11-a');
  assert.equal(a.change.ok, true, JSON.stringify(a.change));
  assert.equal(a.change.value.dir, DIR_11);
  const { artefacts } = a.change.value;
  assert.deepEqual(Object.keys(artefacts), ['proposal', 'spec', 'design', 'tasks', 'apply', 'verify']);
  assert.equal(artefacts.proposal.state, 'present');
  assert.match(artefacts.proposal.blob, /^[0-9a-f]{40}$/);
  assert.equal(artefacts.proposal.bytes, Buffer.byteLength('# A\nPROPOSAL-BODY-A\n'));
  assert.equal(artefacts.design.state, 'missing');
  const b = entryOf(section, 'feat/issue-12-b');
  assert.equal(b.change.value.dir, 'openspec/changes/issue-12-b', 'documents come from the branch\'s own dir only');
  assert.equal(b.change.value.artefacts.spec.state, 'missing');
  const json = JSON.stringify(section);
  for (const text of ['PROPOSAL-BODY-A', 'SPEC-BODY-A', 'PROPOSAL-BODY-B', 'no next_action']) assert.ok(!json.includes(text), `document text leaked: ${text}`);
});

test('#1201 R1201-6: a grammar branch without its change dir is missing and stays listed; an ambiguous dir is unreadable', () => {
  const fx = makeRemoteFixture({ standard: false });
  fx.addBranch('feat/issue-30-nodir', { 'x.txt': '1' });
  fx.addBranch('feat/issue-31-amb', { 'openspec/changes/issue-31-a/proposal.md': 'a', 'openspec/changes/issue-31-b/proposal.md': 'b' });
  fx.refresh();
  const section = build(fx);
  const none = entryOf(section, 'feat/issue-30-nodir');
  assert.deepEqual(none.change, { ok: false, state: 'missing', reason: 'no change dir for #30 on origin/feat/issue-30-nodir' });
  assert.equal(none.resume.state, 'missing');
  const amb = entryOf(section, 'feat/issue-31-amb');
  assert.equal(amb.change.ok, false);
  assert.equal(amb.change.state, 'unreadable');
  assert.match(amb.change.reason, /more than one change dir carries #31/);
  assert.equal(amb.resume.state, 'unreadable');
});

test('#1201 D31 R1201-12: an unjoined entry carries the grammar-less shape and its tree is never read', () => {
  const fx = makeRemoteFixture();
  const run = recordingGit(gitRun(fx.served));
  const section = readRemoteChanges({ run, prs: noPrs });
  const spike = entryOf(section, 'spike/x');
  assert.deepEqual(spike.change, { ok: false, reason: 'outside the branch grammar: no issue to look a change dir up by' });
  assert.equal(spike.resume, null);
  assert.ok(!run.calls.some((a) => a.includes(fx.shas['spike/x'])), 'no git call named the unjoined sha');
});

test('#1201 D30: the section carries no fetch state and is byte-identical across two builds over unchanged refs', () => {
  const fx = makeRemoteFixture();
  const one = JSON.stringify(build(fx));
  const two = JSON.stringify(build(fx));
  assert.equal(one, two);
  assert.doesNotMatch(one, /lastFetch|refsAsOf|lastOkAt|fetchedAt/);
});

test('#1201 D31: the entry carries the tip author as a name only, no email, and nothing session-shaped', () => {
  const fx = makeRemoteFixture();
  const e = entryOf(build(fx), 'feat/issue-11-a');
  assert.equal(e.author, 'Ada Lovelace');
  assert.deepEqual(Object.keys(e).sort(), ['author', 'branch', 'change', 'issue', 'kind', 'pr', 'resume', 'sha', 'tipAt']);
  assert.doesNotMatch(JSON.stringify(e), /@example\.com|session/i);
});

// ── resume states (3.6) ─────────────────────────────────────────────────────

/** The text the REAL featureCheckpoint writes for a change dir, so the fixture is never hand-typed. */
async function realResumeText(feature) {
  const root = testTmp('checkpoint-');
  mkdirSync(join(root, 'openspec/changes', feature), { recursive: true });
  const log = console.log;
  console.log = () => {};
  try {
    await featureCheckpoint(feature, { root, getTimestamp: () => '2026-09-30T00:00:00.000Z', getHostname: () => 'host', getBranch: () => `feat/${feature}`, _doEngramEnrich: () => {} });
  } finally { console.log = log; }
  return readFileSync(join(root, 'openspec/changes', feature, 'resume.md'), 'utf8');
}

test('#1201 R1201-8: present — a real featureCheckpoint file yields state present with the five fields', async () => {
  const fx = makeRemoteFixture({ standard: false });
  const text = await realResumeText('issue-40-w');
  fx.addBranch('feat/issue-40-w', { 'openspec/changes/issue-40-w/proposal.md': 'p', 'openspec/changes/issue-40-w/resume.md': text });
  fx.refresh();
  const { resume } = entryOf(build(fx), 'feat/issue-40-w');
  assert.equal(resume.state, 'present', JSON.stringify(resume));
  assert.equal(resume.path, 'openspec/changes/issue-40-w/resume.md');
  assert.deepEqual(Object.keys(resume.fields).sort(), ['blockers', 'checkpointed_at', 'checkpointed_from', 'current_slice', 'next_action']);
  assert.equal(resume.fields.checkpointed_from, 'host/feat/issue-40-w');
});

test('#1201 R1201-8: missing, invalid (no frontmatter / no next_action) are distinct, and one bad resume does not affect another', () => {
  const fx = makeRemoteFixture();
  fx.addBranch('feat/issue-41-m', { 'openspec/changes/issue-41-m/proposal.md': 'p' });
  fx.addBranch('feat/issue-42-n', { 'openspec/changes/issue-42-n/resume.md': 'just prose, no frontmatter\n' });
  fx.refresh();
  const section = build(fx);
  assert.equal(entryOf(section, 'feat/issue-41-m').resume.state, 'missing');
  assert.equal(entryOf(section, 'feat/issue-41-m').resume.fields, null);
  const noFm = entryOf(section, 'feat/issue-42-n').resume;
  assert.equal(noFm.state, 'invalid');
  assert.match(noFm.reason, /frontmatter/);
  const bad = entryOf(section, 'feat/issue-12-b').resume;
  assert.equal(bad.state, 'invalid');
  assert.match(bad.reason, /next_action/);
  assert.equal(entryOf(section, 'feat/issue-11-a').resume.state, 'present', 'the valid one is unaffected');
  assert.ok(section.value.branches.length >= 4, 'every one of them is still listed');
});

test('#1201 R1201-8: unreadable — not a regular blob, over RESUME_READ_LIMIT, or a read that throws; one line of at most 200 chars', () => {
  const fx = makeRemoteFixture({ standard: false });
  fx.addBranch('feat/issue-43-t', { 'openspec/changes/issue-43-t/resume.md/inner.txt': 'x' });
  fx.addBranch('feat/issue-44-o', { 'openspec/changes/issue-44-o/resume.md': 'x'.repeat(65537) });
  fx.addBranch('feat/issue-45-r', { 'openspec/changes/issue-45-r/resume.md': '---\nnext_action: a\n---\n' });
  fx.refresh();
  const throwing = (file, args, opts) => {
    if (args[0] === 'cat-file') throw Object.assign(new Error('Command failed: git cat-file'), { stderr: `fatal: ${'bad object '.repeat(40)}\n` });
    return gitRun(fx.served)(file, args, opts);
  };
  const section = readRemoteChanges({ run: throwing, prs: noPrs });
  const tree = entryOf(section, 'feat/issue-43-t').resume;
  assert.equal(tree.state, 'unreadable');
  assert.match(tree.reason, /is a tree, not a file/);
  const big = entryOf(section, 'feat/issue-44-o').resume;
  assert.equal(big.state, 'unreadable');
  assert.match(big.reason, /exceeds the read limit of 65536/);
  const thrown = entryOf(section, 'feat/issue-45-r').resume;
  assert.equal(thrown.state, 'unreadable');
  assert.ok(thrown.reason.length <= 200 && !/\n/.test(thrown.reason), thrown.reason);
  assert.notEqual(tree.reason, big.reason);
});

// ── budget, cache, deferral (4.1) ───────────────────────────────────────────

const BRANCHES_OVER_BUDGET = 30;
const BUDGET = 24;
const MAX_SPAWNS_PER_BRANCH = 3;
const BASE_SPAWNS = 2;

/** `count` unmerged grammar branches, each with a change dir and a valid resume, aged one day apart so "newest first" is unambiguous. */
function manyBranches(count) {
  const fx = makeRemoteFixture({ standard: false });
  for (let i = 1; i <= count; i += 1) {
    fx.addBranch(`feat/issue-${100 + i}-x`, {
      [`openspec/changes/issue-${100 + i}-x/proposal.md`]: `p${i}\n`,
      [`openspec/changes/issue-${100 + i}-x/resume.md`]: RESUME_VALID,
    }, { ageDays: i });
  }
  fx.refresh();
  return fx;
}

test('#1201 R1201-12: 30 grammar branches on a cold cache cost at most 74 spawns, read 24 newest-first, and defer 6', () => {
  const fx = manyBranches(BRANCHES_OVER_BUDGET);
  const run = recordingGit(gitRun(fx.served));
  const { value } = readRemoteChanges({ run, prs: noPrs, cache: new Map(), budget: BUDGET });
  assert.ok(run.spawns <= BASE_SPAWNS + BUDGET * MAX_SPAWNS_PER_BRANCH, `spawns ${run.spawns}`);
  assert.equal(run.spawns, BASE_SPAWNS + BUDGET * MAX_SPAWNS_PER_BRANCH, 'every read branch had a dir and a resume: exactly 3 each');
  const deferred = value.branches.filter((e) => e.change.state === 'deferred');
  assert.equal(deferred.length, 6);
  assert.equal(value.deferred, 6);
  assert.deepEqual(deferred.map((e) => e.issue).sort((a, b) => a - b), [125, 126, 127, 128, 129, 130], 'the oldest six (ageDays 25..30)');
  for (const e of deferred) {
    assert.equal(e.resume.state, 'deferred');
    assert.notEqual(e.change.state, 'unreadable');
    assert.ok(e.branch && e.sha && e.tipAt && e.author, 'a deferred branch keeps its provenance');
  }
});

test('#1201 R1201-12: 30 unjoined branches and no grammar branch cost exactly the two base spawns', () => {
  const fx = makeRemoteFixture({ standard: false });
  for (let i = 0; i < 30; i += 1) fx.addBranch(`wip/b${i}`, { 'a.txt': `${i}` }, { ageDays: i + 1 });
  fx.refresh();
  const run = recordingGit(gitRun(fx.served));
  const { value } = readRemoteChanges({ run, prs: noPrs, cache: new Map() });
  assert.equal(run.spawns, 2);
  assert.equal(value.unjoined.length, 30);
});

test('#1201 R1201-12: a warm cache costs exactly 2 spawns and deep-equals a cold unlimited-budget build', () => {
  const fx = manyBranches(12);
  const cache = new Map();
  readRemoteChanges({ run: gitRun(fx.served), prs: noPrs, cache });
  const run = recordingGit(gitRun(fx.served));
  const warm = readRemoteChanges({ run, prs: noPrs, cache });
  assert.equal(run.spawns, 2);
  const cold = readRemoteChanges({ run: gitRun(fx.served), prs: noPrs, cache: null, budget: Infinity });
  assert.deepEqual(warm, cold);
});

test('#1201 R1201-12: a moved tip misses the cache; a thrown read is never cached; vanished SHAs are evicted', () => {
  const fx = manyBranches(3);
  const cache = new Map();
  readRemoteChanges({ run: gitRun(fx.served), prs: noPrs, cache });
  assert.equal(cache.size, 3);
  const before = [...cache.keys()];

  // moved tip: the branch advances, the old key is evicted and the new one read
  fx.addBranch('feat/issue-101-x', { 'openspec/changes/issue-101-x/proposal.md': 'moved\n', 'openspec/changes/issue-101-x/resume.md': RESUME_VALID }, { ageDays: 0.5 });
  fx.refresh();
  const run = recordingGit(gitRun(fx.served));
  readRemoteChanges({ run, prs: noPrs, cache });
  assert.equal(run.spawns, BASE_SPAWNS + MAX_SPAWNS_PER_BRANCH, 'only the moved branch was read again');
  assert.ok(!cache.has(before.find((k) => k.endsWith(':101'))), 'the old sha:issue key left the cache');
  assert.equal(cache.size, 3);

  // vanished: the branch is pruned, its key goes with it
  fx.deleteRemoteBranch('feat/issue-102-x');
  fx.refresh();
  readRemoteChanges({ run: gitRun(fx.served), prs: noPrs, cache });
  assert.equal(cache.size, 2);
  assert.ok(![...cache.keys()].some((k) => k.endsWith(':102')));

  // thrown: nothing is cached for a branch whose read threw
  const empty = new Map();
  const failing = (file, args, opts) => {
    if (args[0] === 'ls-tree') throw new Error('fatal: boom');
    return gitRun(fx.served)(file, args, opts);
  };
  const result = readRemoteChanges({ run: failing, prs: noPrs, cache: empty });
  assert.equal(empty.size, 0);
  assert.ok(result.value.branches.every((e) => e.change.state === 'unreadable'));
});
