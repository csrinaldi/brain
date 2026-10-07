// tab-source.test.mjs — #1276: the Spec, SDD and Tasks tabs follow the lookup order
// (main, then the local worktree, then origin) instead of staying on the served HEAD.
// Real git fixtures; no network, no forge, no timers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { buildSnapshot } from '../status/snapshot.mjs';
import { buildChangeView, buildSourcedSddTab } from './change-route.mjs';
import { gitRun } from './git-run.mjs';
import { recordingGit } from './test-support/recording-git.mjs';
import { git, makeWorktreeRepo } from './test-support/git-worktree-fixture.mjs';

/** A stub forge: the given issue numbers are open, no PRs, nothing closed. */
function stubVcs(open = []) {
  return {
    issueList: async ({ state }) => (state === 'open' ? open.map((number) => ({ number, title: `issue ${number}`, labels: [], state: 'open', body: '' })) : []),
    issueView: async ({ number }) => ({ number, body: '' }),
    mrList: async () => [],
    prReviews: async () => [],
  };
}

const snapshotOf = (root, open) => buildSnapshot({ root, now: '2026-10-03T00:00:00Z', vcs: stubVcs(open), project: 'example/repo' });
const D7 = 'openspec/changes/issue-7-x';
/** Main holds a change of ANOTHER issue, so the served root has a `changes` directory with no row for #7. */
const MAIN_OTHER = { 'openspec/changes/issue-1-other/proposal.md': '# other\n' };
const repoWith = (mainFiles = MAIN_OTHER) => makeWorktreeRepo({ mainFiles });

test('R1276-1: a worktree-only change feeds the SDD tab and says where it came from', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-7-x', {
    [`${D7}/spec.md`]: '# spec\n\n### R7-1: Title\nBody.\n',
    [`${D7}/tasks.md`]: '- [ ] 1.1 first\n',
  });
  const snapshot = await snapshotOf(repo.root, [7]);

  const { value } = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) });

  assert.equal(value.tabSource.kind, 'worktree');
  assert.equal(value.sdd.ok, true);
  const present = Object.fromEntries(value.sdd.value.map((row) => [row.stage, row.present]));
  assert.equal(present.spec, true);
  assert.equal(present.tasks, true);
  assert.equal(present.proposal, false);
  assert.match(value.sdd.from, /^from worktree /);
});

const viewOf = async (repo, { run = gitRun(repo.root), vcs } = {}) => {
  const snapshot = await buildSnapshot({ root: repo.root, now: '2026-10-03T00:00:00Z', vcs: vcs ?? stubVcs([7]), project: 'example/repo' });
  return buildChangeView({ root: repo.root, issue: 7, snapshot, _run: run }).value;
};
const put = (dir, files) => { for (const [p, text] of Object.entries(files)) { mkdirSync(join(dir, dirname(p)), { recursive: true }); writeFileSync(join(dir, p), text); } };
const SPEC_ONE = '### R7-1: Title\n#### Scenario: s\n- **WHEN** w\n- **THEN** t\n';

// ── R1276-3: the tie-break ───────────────────────────────────────────────────

test('R1276-3: two worktrees that hold the change are refused on all three tabs, naming both and reading neither', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const a = repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  const b = repo.addWorktree('fix/issue-7-y', { 'openspec/changes/issue-7-y/spec.md': SPEC_ONE });

  const v = await viewOf(repo);

  assert.equal(v.tabSource.kind, 'refused');
  for (const tab of [v.spec, v.sdd, v.tasks]) {
    assert.equal(tab.ok, false);
    assert.match(tab.reason, new RegExp(`${basename(a.path)}, ${basename(b.path)}`));
    assert.match(tab.reason, /the tabs read none of them/);
    assert.equal(tab.from, undefined);
  }
});

test('R1276-3: a worktree of the same issue with no change dir does not count, so the other is the source', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const a = repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  repo.addWorktree('fix/issue-7-y', {});

  const v = await viewOf(repo);

  assert.equal(v.tabSource.kind, 'worktree');
  assert.equal(v.tabSource.leaf, basename(a.path));
  assert.equal(v.spec.ok, true);
});

// ── R1276-7: the Spec tab ────────────────────────────────────────────────────

test('R1276-7: cards from an untracked worktree spec.md cite the worktree and say it is uncommitted: new', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  const leaf = basename(wt.path);

  const v = await viewOf(repo);

  assert.equal(v.spec.ok, true);
  assert.equal(v.spec.value[0].id, 'R7-1');
  assert.equal(v.spec.value[0].scenarios.length, 1);
  assert.equal(v.spec.value[0].scenarios[0].complete, true);
  assert.equal(v.spec.value[0].source.path.startsWith(`worktree ${leaf}:`), true);
  assert.equal(v.spec.value[0].scenarios[0].source.path.startsWith(`worktree ${leaf}:`), true);
  assert.equal(v.spec.from, `from worktree ${leaf} · uncommitted: new`);
});

test('R1276-7: a spec.md that is not in the worktree fails the Spec tab with that said, and the tab still names its source', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/tasks.md`]: '- [ ] 1.1 a\n' });
  const leaf = basename(wt.path);

  const v = await viewOf(repo);

  assert.equal(v.spec.ok, false);
  assert.equal(v.spec.reason, `spec.md is not in worktree ${leaf}`);
  assert.equal(v.spec.from, `from worktree ${leaf} · not in this worktree`);
});

// ── R1276-8: the SDD rows ────────────────────────────────────────────────────

test('R1276-8: a design.md deleted from the working tree is not present and says so; archive is never read there', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/design.md`]: '# d\n', [`${D7}/tasks.md`]: '- [ ] 1.1 a\n' }, { commit: true });
  rmSync(join(wt.path, D7, 'design.md'));

  const v = await viewOf(repo);

  const rows = Object.fromEntries(v.sdd.value.map((r) => [r.stage, r]));
  assert.equal(rows.design.present, false);
  assert.equal(rows.design.detail, 'uncommitted: deleted (committed on feat/issue-7-x, missing from the working tree)');
  assert.equal(rows.tasks.present, true);
  assert.equal(rows.archive.present, false);
  assert.equal(rows.archive.detail, 'not read outside the served root');
  assert.equal(rows.proposal.detail, 'missing');
  assert.equal(v.sdd.from, `from worktree ${basename(wt.path)} · feat/issue-7-x`);
});

test('R1276-8: the slice plan is parsed from the worktree tasks.md text', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const plan = '- [ ] 1.1 a\n\n```brain-slice-scope/1\n{"slice": 1, "claims": ["R7-1"], "terminal_pr": "x"}\n```\n';
  repo.addWorktree('feat/issue-7-x', { [`${D7}/tasks.md`]: plan });

  const v = await viewOf(repo);

  assert.equal(v.sdd.slices.ok, true);
  assert.deepEqual(v.sdd.slices.value.map((s) => [s.slice, s.claims]), [[1, ['R7-1']]]);
});

// ── R1276-9: the Tasks tab, on real git ──────────────────────────────────────

const THREE = '- [ ] 1.1 a\n- [ ] 1.2 b\n- [ ] 1.3 c\n';

test('R1276-9: a box ticked in a committed tasks.md says "no blame" on that row only, and the other rows keep the author', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/tasks.md`]: THREE }, { commit: true });
  put(wt.path, { [`${D7}/tasks.md`]: THREE.replace('- [ ] 1.2', '- [x] 1.2') });
  const leaf = basename(wt.path);

  const v = await viewOf(repo);

  assert.equal(v.tasks.ok, true);
  const rows = Object.fromEntries(v.tasks.value.map((r) => [r.text.slice(0, 3), r]));
  assert.equal(rows['1.2'].done, true);
  assert.deepEqual(rows['1.2'].attribution, { ok: false, reason: `uncommitted in worktree ${leaf}: no blame` });
  assert.equal(rows['1.1'].attribution.ok, true);
  assert.equal(rows['1.1'].attribution.value.actor, 'Fixture');
  assert.equal(rows['1.3'].attribution.value.actor, 'Fixture');
  assert.equal(v.tasks.progressSource, 'working tree');
  assert.equal(v.tasks.from, `from worktree ${leaf} · uncommitted: modified`);
});

test('R1276-9: an untracked tasks.md spawns no blame and every row says it is uncommitted', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/tasks.md`]: THREE });
  const run = recordingGit(gitRun(repo.root));

  const v = await viewOf(repo, { run });

  assert.equal(run.calls.some((args) => args[0] === 'blame'), false);
  assert.equal(v.tasks.value.length, 3);
  for (const row of v.tasks.value) assert.deepEqual(row.attribution, { ok: false, reason: `uncommitted in worktree ${basename(wt.path)}: no blame` });
});

test('R1276-9: a blame that fails is said per row with git\'s reason and the checklist still renders in full', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/tasks.md`]: THREE }, { commit: true });
  put(wt.path, { [`${D7}/tasks.md`]: THREE.replace('- [ ] 1.2', '- [x] 1.2') });
  const real = gitRun(repo.root);
  const run = (file, args, opts) => {
    if (args[0] === 'blame') throw Object.assign(new Error('Command failed'), { stderr: 'fatal: --contents and --reverse do not blend well.\n' });
    return real(file, args, opts);
  };

  const v = await viewOf(repo, { run });

  assert.equal(v.tasks.ok, true);
  assert.equal(v.tasks.value.length, 3);
  for (const row of v.tasks.value) {
    assert.equal(row.attribution.ok, false);
    assert.match(row.attribution.reason, /fatal: --contents and --reverse/);
  }
});

// ── R1276-10: read-only, forge-free, bounded ─────────────────────────────────

/** Every file under `dir` (recursively) with its content hash, in path order. */
function digest(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = join(d, e.name);
      if (e.isDirectory()) walk(abs); else out.push([abs, createHash('sha1').update(readFileSync(abs)).digest('hex')]);
    }
  };
  walk(dir);
  return out;
}

test('R1276-10: a worktree-sourced read never touches the forge, never names a worktree path to git and leaves every byte as it was', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/tasks.md`]: THREE, [`${D7}/spec.md`]: SPEC_ONE }, { commit: true });
  put(wt.path, { [`${D7}/tasks.md`]: THREE.replace('- [ ] 1.1', '- [x] 1.1') });
  const snapshot = await snapshotOf(repo.root, [7]);
  const adminDir = join(repo.root, '.git', 'worktrees');
  const before = [digest(wt.path), digest(adminDir)];
  const forge = new Proxy({}, { get: () => { throw new Error('the forge was touched'); } });
  const run = recordingGit(gitRun(repo.root));

  const { value } = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: run, project: 'example/repo', vcs: forge });

  assert.equal(value.tasks.ok, true);
  const flat = run.calls.flat();
  for (const banned of ['-C', '--git-dir', '--work-tree']) assert.equal(flat.includes(banned), false, banned);
  assert.equal(flat.some((a) => String(a).startsWith(wt.path)), false, 'no argument names a path under the worktree');
  const blames = run.calls.filter((args) => args[0] === 'blame');
  assert.deepEqual(blames, [['blame', '--porcelain', '--contents', '-', wt.head, '--', `${D7}/tasks.md`]]);
  assert.deepEqual([digest(wt.path), digest(adminDir)], before);
  assert.equal(git(wt.path, ['rev-parse', 'HEAD']).trim(), wt.head);
});

test('R1276-10: a hostile worktree leaf stays text in the source line the route builds', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  const snapshot = await snapshotOf(repo.root, [7]);
  const hostile = 'wt-<img src=x onerror=alert(1)>';
  snapshot.localWorktrees.value.entries[0].leaf = hostile;

  const { value } = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) });

  assert.equal(value.sdd.from, `from worktree ${hostile} · feat/issue-7-x`);
  assert.equal(wt.branch, 'feat/issue-7-x');
});

// ── R1276-2: main holding the change leaves the tabs unchanged ───────────────

test('R1276-2: a change on main keeps the three tabs as the served HEAD builds them, whatever a worktree beside it holds', async (t) => {
  const D11 = 'openspec/changes/issue-11-a';
  const repo = makeWorktreeRepo({ mainFiles: { [`${D11}/spec.md`]: SPEC_ONE, [`${D11}/tasks.md`]: THREE } });
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-11-a', { [`${D11}/tasks.md`]: '- [x] 1.1 a\n- [ ] 1.2 b\n- [ ] 1.3 c\n' });
  const snapshot = await snapshotOf(repo.root, [11]);
  const alone = { ...snapshot };
  delete alone.localWorktrees;
  const read = (snap) => buildChangeView({ root: repo.root, issue: 11, snapshot: snap, _run: gitRun(repo.root) }).value;

  const withWorktree = read(snapshot);
  const headOnly = read(alone);

  assert.equal(withWorktree.tabSource.kind, 'head');
  for (const tab of ['spec', 'sdd', 'tasks']) {
    assert.deepEqual(withWorktree[tab], headOnly[tab], tab);
    assert.equal('from' in withWorktree[tab], false, `${tab} carries no from line`);
  }
  assert.equal('progressSource' in withWorktree.tasks, false);
  assert.equal(withWorktree.tasks.value[0].done, false, 'the served HEAD text, not the worktree edit');
  assert.equal(withWorktree.local[0].documents.tasks.overlay, 'modified', 'the edit appears only in the on-this-machine block');
  assert.equal(wt.branch, 'feat/issue-11-a');
});

test('R1276-2 (S1): the three tabs of a change on main are byte-equal to what the code before #1276 built, with a worktree beside it', async (t) => {
  const D11 = 'openspec/changes/issue-11-a';
  const repo = makeWorktreeRepo({ mainFiles: { [`${D11}/proposal.md`]: '# p\n', [`${D11}/spec.md`]: SPEC_ONE, [`${D11}/tasks.md`]: THREE } });
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-11-a', { [`${D11}/tasks.md`]: '- [x] 1.1 a\n- [ ] 1.2 b\n- [ ] 1.3 c\n', [`${D11}/design.md`]: '# d\n' });
  const snapshot = await snapshotOf(repo.root, [11]);

  const { value } = buildChangeView({ root: repo.root, issue: 11, snapshot, _run: gitRun(repo.root) });

  // Recorded from origin/main (53c78854, before #1276) with the same fixture: a regression here is a tab that moved.
  const golden = readFileSync(new URL('./test-support/golden/tab-source-main-change.golden.json', import.meta.url), 'utf8');
  assert.equal(JSON.stringify({ spec: value.spec, sdd: value.sdd, tasks: value.tasks }, null, 2), golden.trimEnd());
});

// ── R1276-1 / R1276-5: precedence and the unread step ────────────────────────

/** An origin entry the remote reader would have kept, holding the change at `sha`. */
const originEntry = (branch, sha) => ({ branch, sha, tipAt: '2026-10-01T00:00:00Z', author: 'Ada Lovelace', kind: 'grammar', issue: 7, pr: null, change: { ok: true, value: { dir: D7, artefacts: {} } }, resume: { state: 'missing' } });
const withOrigin = (snapshot, entries) => ({ ...snapshot, remoteChanges: { ok: true, value: { base: 'origin/main', branches: entries, unjoined: [], hidden: { base: 0, lane: 0, merged: 0 }, prsApplied: true, deferred: 0 } } });

test('R1276-1: a worktree that holds the change wins over an origin branch that holds it too', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  const mainHead = git(repo.root, ['rev-parse', 'HEAD']).trim();
  const snapshot = withOrigin(await snapshotOf(repo.root, [7]), [originEntry('feat/issue-7-x', mainHead)]);

  const { value } = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) });

  assert.equal(value.tabSource.kind, 'worktree');
  assert.equal(value.spec.ok, true);
  assert.match(value.spec.from, /^from worktree /);
});

test('R1276-5: a worktree section that could not be read stops the walk, and no tab reads the origin branch', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  const base = withOrigin(await snapshotOf(repo.root, [7]), [originEntry('feat/issue-7-x', git(repo.root, ['rev-parse', 'HEAD']).trim())]);

  for (const localWorktrees of [{ ok: false, reason: 'the worktree list could not be read: fatal: boom' }, { ok: false, pending: true, reason: 'loading open issues from the forge…' }]) {
    const { value } = buildChangeView({ root: repo.root, issue: 7, snapshot: { ...base, localWorktrees }, _run: gitRun(repo.root) });
    assert.equal(value.tabSource.kind, 'none');
    for (const tab of [value.spec, value.sdd, value.tasks]) {
      assert.equal(tab.ok, false);
      assert.equal(tab.reason, `this machine's worktrees were not read, so the tabs cannot fall back past them: ${localWorktrees.reason}`);
    }
  }
});

test('R1276-5: a holding worktree whose change dir cannot be read is said with its reason, never skipped', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  const snapshot = await snapshotOf(repo.root, [7]);
  rmSync(join(wt.path, D7), { recursive: true });

  const { value } = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) });

  assert.equal(value.tabSource.kind, 'none');
  for (const tab of [value.spec, value.sdd, value.tasks]) {
    assert.match(tab.reason, new RegExp(`^the change dir in worktree ${basename(wt.path)} could not be read: `));
  }
});

test('R1276-5: a served changes section that could not be read for any other reason than being absent keeps today\'s reason, whatever lies below it', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  const snapshot = await snapshotOf(repo.root, [7]);
  snapshot.changes = { ok: false, reason: 'openspec/changes could not be listed: EACCES: permission denied, scandir' };

  const { value } = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) });

  assert.equal(value.tabSource.kind, 'none');
  assert.equal(value.spec.reason, 'no change dir at openspec/changes/issue-7-*');
});

test('R1276-5: a served root with no openspec/changes directory is main holding no change dir, so a worktree change still shows (#1276 W1)', async (t) => {
  const repo = makeWorktreeRepo({ mainFiles: {} });
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-7-x', {
    [`${D7}/spec.md`]: SPEC_ONE,
    [`${D7}/tasks.md`]: '- [ ] 1.1 first\n',
  });
  const snapshot = await snapshotOf(repo.root, [7]);

  const { value } = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) });

  assert.deepEqual(snapshot.changes, { ok: true, value: [], archiveSkipped: [] });
  assert.equal(value.tabSource.kind, 'worktree');
  assert.equal(value.spec.ok, true);
  assert.equal(value.sdd.ok, true);
});

test('R1276-1: with no source anywhere each tab keeps today\'s no-change-dir reason', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());

  const v = await viewOf(repo);

  assert.equal(v.tabSource.kind, 'none');
  for (const tab of [v.spec, v.sdd, v.tasks]) assert.equal(tab.reason, 'no change dir at openspec/changes/issue-7-*');
});

// ── R1282: an unreadable document is never present and says why ──────────────

/** A branch holding D7 with a committed `design.md` symlink, its worktree removed so only the sha is left; returns that sha. */
function originShaWithSymlinkDesign(repo) {
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  symlinkSync('spec.md', join(wt.path, D7, 'design.md'));
  git(wt.path, ['add', '-A']);
  git(wt.path, ['commit', '-q', '-m', 'work']);
  const sha = git(wt.path, ['rev-parse', 'HEAD']).trim();
  git(repo.root, ['worktree', 'remove', '--force', wt.path]);
  return sha;
}

test('R1282-1: a worktree document that cannot be read is neither present nor done, and its row says why', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  symlinkSync('spec.md', join(wt.path, D7, 'design.md'));

  const v = await viewOf(repo);

  const rows = Object.fromEntries(v.sdd.value.map((r) => [r.stage, r]));
  assert.equal(rows.design.present, false);
  assert.match(rows.design.detail, /could not be read: .*design\.md is a symbolic link/);
  assert.equal(rows.spec.present, true);
});

test('R1282-2: an origin entry that cannot be read (a symlink) is not present and says why', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  const sha = originShaWithSymlinkDesign(repo);
  const snapshot = withOrigin(await snapshotOf(repo.root, [7]), [originEntry('feat/issue-7-x', sha)]);

  const { value } = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) });

  assert.equal(value.tabSource.kind, 'origin');
  const rows = Object.fromEntries(value.sdd.value.map((r) => [r.stage, r]));
  assert.equal(rows.design.present, false);
  assert.match(rows.design.detail, /could not be read: .*design\.md is a symlink/);
  assert.equal(rows.spec.present, true);
  assert.equal(rows.spec.detail, undefined);
});

test('R1282-3: when the origin tree cannot be listed, no stage is present and each says the reason', async (t) => {
  const repo = repoWith();
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: SPEC_ONE });
  const snapshot = withOrigin(await snapshotOf(repo.root, [7]), [originEntry('feat/issue-7-x', 'f'.repeat(40))]);
  // drop the worktree so the walk reaches origin
  const noWt = { ...snapshot, localWorktrees: { ok: true, value: { entries: [] } } };

  const { value } = buildChangeView({ root: repo.root, issue: 7, snapshot: noWt, _run: gitRun(repo.root) });

  assert.equal(value.tabSource.kind, 'origin');
  const rows = value.sdd.value.filter((r) => r.stage !== 'archive');
  for (const row of rows) {
    assert.equal(row.present, false, row.stage);
    assert.match(row.detail, /^could not be read: /);
    // #1298: the detail carries the git reason, not the fallback the same prefix would also match.
    assert.doesNotMatch(row.detail, /no reason was given/, row.stage);
    assert.ok(row.detail.length > 'could not be read: '.length, row.stage);
  }
});

test('R1342-1: a document state that is not readable is not present (allow-list, #1298)', () => {
  const doc = (state) => ({ path: 'x.md', state, text: state === 'present' || state === 'truncated' ? 'x' : null });
  const source = {
    kind: 'origin', ref: 'origin/x', sha: 'a'.repeat(40), dir: 'openspec/changes/issue-7-x',
    documents: { proposal: doc('present'), spec: doc('truncated'), design: doc('refused-new-kind'), tasks: doc('unreadable'), apply: doc('missing'), verify: doc('deleted') },
  };
  const rows = Object.fromEntries(buildSourcedSddTab(source).value.map((r) => [r.stage, r.present]));
  assert.equal(rows.proposal, true);
  assert.equal(rows.spec, true);
  assert.equal(rows.design, false, 'an unknown state must not read as present');
  assert.equal(rows.tasks, false);
  assert.equal(rows.apply, false);
  assert.equal(rows.verify, false);
});
