// local-overlay.test.mjs — #883: the drawer shows a linked worktree's uncommitted
// change dir below the served change, read-only, on real git fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as realFs from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdirSync, symlinkSync, truncateSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { buildSnapshot } from '../status/snapshot.mjs';
import { countTasks } from '../lib/tasks-list.mjs';
import { buildChangeView, DOCUMENT_CAP, DOCUMENT_READ_LIMIT } from './change-route.mjs';
import { gitRun } from './git-run.mjs';
import { gitBlobHash, classifyLocalDocument, readLocalBlocks } from './local-overlay.mjs';
import { maskNonCode } from '../lib/mask-non-code.mjs';
import { RESUME_INVALID, RESUME_VALID } from './test-support/git-remote-fixture.mjs';
import { git, makeWorktreeRepo } from './test-support/git-worktree-fixture.mjs';

/** A stub forge: the given issue numbers are open, no PRs, nothing closed. */
export function stubVcs(open = []) {
  return {
    issueList: async ({ state }) => (state === 'open' ? open.map((number) => ({ number, title: `issue ${number}`, labels: [], state: 'open', body: '' })) : []),
    issueView: async ({ number }) => ({ number, body: '' }),
    mrList: async () => [],
    prReviews: async () => [],
  };
}

export async function snapshotOf(root, open) {
  return buildSnapshot({ root, now: '2026-10-03T00:00:00Z', vcs: stubVcs(open), project: 'example/repo' });
}

test('R883-6: an untracked proposal in a linked worktree shows as uncommitted: new when main has no change dir', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-7-x', { 'openspec/changes/issue-7-x/proposal.md': '# proposal\nUNCOMMITTED-BODY\n' });

  const snapshot = await snapshotOf(repo.root, [7]);
  const view = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) });

  assert.equal(view.ok, true);
  const proposal = view.value.local[0].documents.proposal;
  assert.equal(proposal.overlay, 'new');
  assert.equal(proposal.uncommitted, true);
});

const view = async (repo, issue = 7) => {
  const snapshot = await snapshotOf(repo.root, [issue]);
  return buildChangeView({ root: repo.root, issue, snapshot, _run: gitRun(repo.root) }).value;
};
const put = (dir, files) => { for (const [p, text] of Object.entries(files)) { mkdirSync(join(dir, dirname(p)), { recursive: true }); writeFileSync(join(dir, p), text); } };
const D7 = 'openspec/changes/issue-7-x';
const hashObject = (bytes) => execFileSync('git', ['hash-object', '--stdin'], { input: bytes, encoding: 'utf8' }).trim();

test('R883-6: gitBlobHash equals `git hash-object` for an empty, a text and a non-UTF-8 byte string', () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from('hello\n'), Buffer.from([0xff, 0x00, 0x41, 0xc3])]) {
    assert.equal(gitBlobHash(bytes), hashObject(bytes));
  }
});

test('R883-6: the four states and their order — same-as-main first, then new, modified, committed; resume is never same-as-main', () => {
  const entry = { sha: 'h' };
  assert.equal(classifyLocalDocument({ hash: 'm', headEntry: undefined, mainBlob: 'm' }), 'same-as-main', 'identical to main wins over uncommitted');
  assert.equal(classifyLocalDocument({ hash: 'm', headEntry: entry, mainBlob: 'm' }), 'same-as-main', 'and over modified');
  assert.equal(classifyLocalDocument({ hash: 'x', headEntry: undefined, mainBlob: 'm' }), 'new');
  assert.equal(classifyLocalDocument({ hash: 'x', headEntry: undefined, mainBlob: null }), 'new');
  assert.equal(classifyLocalDocument({ hash: 'x', headEntry: entry, mainBlob: 'm' }), 'modified');
  assert.equal(classifyLocalDocument({ hash: 'h', headEntry: entry, mainBlob: 'm' }), 'committed');
  assert.equal(classifyLocalDocument({ hash: 'm', headEntry: undefined, mainBlob: 'm', isResume: true }), 'new', 'main has no resume reader');
});

test('R883-6: a served document carries its blob id, the one the local read compares against', async (t) => {
  const repo = makeWorktreeRepo({ mainFiles: { [`${D7}/design.md`]: '# design\n' } });
  t.after(() => repo.dispose());
  const v = await view(repo);
  assert.equal(v.documents.design.blob, hashObject('# design\n'));
  assert.equal(v.documents.proposal.blob, null, 'a missing document has no blob');
});

test('R883-6: an edited committed tasks.md is modified with its own task count; a committed spec not on main is committed, not uncommitted', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/tasks.md`]: '- [ ] a\n- [ ] b\n', [`${D7}/spec.md`]: '# spec\n' }, { commit: true });
  put(wt.path, { [`${D7}/tasks.md`]: '- [x] a\n- [ ] b\n' });
  const block = (await view(repo)).local[0];
  assert.equal(block.state, 'read');
  assert.equal(block.documents.tasks.overlay, 'modified');
  assert.equal(block.documents.tasks.uncommitted, true);
  assert.deepEqual(block.documents.tasks.progress, countTasks('- [x] a\n- [ ] b\n'));
  assert.equal(block.documents.spec.overlay, 'committed');
  assert.equal(block.documents.spec.uncommitted, false);
  assert.equal(block.documents.spec.text, '# spec\n');
});

test('R883-6: an untracked design equal to main is same-as-main with no body, though it is also untracked', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', {});
  put(repo.root, { [`${D7}/design.md`]: '# shared\n' });
  git(repo.root, ['add', '-A']);
  git(repo.root, ['commit', '-q', '-m', 'main gains a design']);
  put(wt.path, { [`${D7}/design.md`]: '# shared\n', [`${D7}/proposal.md`]: '# only here\n' });
  const { documents } = (await view(repo)).local[0];
  assert.equal(documents.design.overlay, 'same-as-main');
  assert.equal(documents.design.text, null);
  assert.equal(documents.design.uncommitted, false);
  assert.equal(documents.proposal.overlay, 'new');
});

test('R883-5: all seven documents are looked up; an absent one is no row and is named once', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const all = Object.fromEntries(['proposal', 'spec', 'design', 'tasks', 'apply-progress', 'verify-report', 'resume'].map((n) => [`${D7}/${n}.md`, `# ${n}\n`]));
  repo.addWorktree('feat/issue-7-x', all);
  const full = (await view(repo)).local[0];
  assert.deepEqual(Object.keys(full.documents), ['proposal', 'spec', 'design', 'tasks', 'apply', 'verify', 'resume']);
  assert.deepEqual(full.absent, []);

  const two = makeWorktreeRepo();
  t.after(() => two.dispose());
  two.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n' });
  const partial = (await view(two)).local[0];
  assert.deepEqual(Object.keys(partial.documents), ['proposal']);
  assert.deepEqual(partial.absent, ['spec.md', 'design.md', 'tasks.md', 'apply-progress.md', 'verify-report.md', 'resume.md']);
});

test('R883-5: a worktree with no change dir is listed as such; two change dirs are unreadable and named', async (t) => {
  const none = makeWorktreeRepo();
  t.after(() => none.dispose());
  none.addWorktree('feat/issue-7-x', { 'notes.txt': 'x\n' });
  const a = (await view(none)).local[0];
  assert.equal(a.state, 'no-change-dir');
  assert.equal(a.reason, 'no change dir in this worktree');
  assert.equal(a.documents, null);

  const two = makeWorktreeRepo();
  t.after(() => two.dispose());
  two.addWorktree('feat/issue-7-x', { 'openspec/changes/issue-7-one/proposal.md': '1\n', 'openspec/changes/issue-7-two/proposal.md': '2\n' });
  const b = (await view(two)).local[0];
  assert.equal(b.state, 'unreadable');
  assert.match(b.reason, /issue-7-one/);
  assert.match(b.reason, /issue-7-two/);
});

// ── R883-7: safe reads, through the `_fs` seam ──────────────────────────────

const fsSeam = (over = {}) => ({
  lstatSync: realFs.lstatSync, realpathSync: realFs.realpathSync, openSync: realFs.openSync,
  readSync: realFs.readSync, fstatSync: realFs.fstatSync, closeSync: realFs.closeSync, ...over,
});
/** The drawer's local blocks of issue 7, read through `_fs`, from the real section of a real snapshot. */
const blocksOf = async (repo, _fs, issue = 7) => {
  const snapshot = await snapshotOf(repo.root, [issue]);
  return readLocalBlocks({ run: gitRun(repo.root), snapshot, issue, mainDocuments: {}, _fs });
};

test('R883-7: a symlinked document is unreadable with a symlink reason and its target is never opened', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n' });
  put(repo.base, { 'outside/secret.txt': 'SECRET-TARGET\n' });
  symlinkSync(join(repo.base, 'outside/secret.txt'), join(wt.path, D7, 'spec.md'));
  const opened = [];
  const { local } = await blocksOf(repo, fsSeam({ openSync: (p, ...rest) => { opened.push(p); return realFs.openSync(p, ...rest); } }));
  assert.equal(local[0].documents.spec.state, 'unreadable');
  assert.match(local[0].documents.spec.reason, /symbolic link/);
  assert.ok(!JSON.stringify(local).includes('SECRET-TARGET'));
  assert.ok(!opened.some((p) => p.endsWith('spec.md')), 'the link was never opened');
  assert.equal(local[0].documents.proposal.state, 'present', 'one failure does not affect another document');
});

test('R883-7: a change dir symlinked outside the worktree is refused and nothing under it is opened', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', {});
  put(repo.base, { 'outside/issue-7-x/proposal.md': 'OUTSIDE-BODY\n' });
  mkdirSync(join(wt.path, 'openspec/changes'), { recursive: true });
  symlinkSync(join(repo.base, 'outside/issue-7-x'), join(wt.path, D7));
  const opened = [];
  const { local } = await blocksOf(repo, fsSeam({ openSync: (p, ...rest) => { opened.push(p); return realFs.openSync(p, ...rest); } }));
  assert.equal(local[0].state, 'unreadable');
  assert.match(local[0].reason, /symbolic link/);
  assert.deepEqual(opened, []);
  assert.ok(!JSON.stringify(local).includes('OUTSIDE-BODY'));
});

test('R883-7: a section that went stale — a dir now a symlink — is still refused by the reader itself', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n' });
  const snapshot = await snapshotOf(repo.root, [7]);
  realFs.renameSync(join(wt.path, D7), join(wt.path, 'openspec/changes/moved'));
  put(repo.base, { 'outside/proposal.md': 'OUTSIDE-BODY\n' });
  symlinkSync(join(repo.base, 'outside'), join(wt.path, D7));
  const { local } = readLocalBlocks({ run: gitRun(repo.root), snapshot, issue: 7, mainDocuments: {}, _fs: fsSeam() });
  assert.equal(local[0].state, 'unreadable');
  assert.ok(!JSON.stringify(local).includes('OUTSIDE-BODY'));
});

test('R883-7: a FIFO and a file over DOCUMENT_READ_LIMIT are unreadable and never opened; the others are read', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n', [`${D7}/design.md`]: 'x' });
  execFileSync('mkfifo', [join(wt.path, D7, 'spec.md')]);
  truncateSync(join(wt.path, D7, 'design.md'), DOCUMENT_READ_LIMIT + 1);
  const opened = [];
  const { local } = await blocksOf(repo, fsSeam({ openSync: (p, ...rest) => { opened.push(p); return realFs.openSync(p, ...rest); } }));
  assert.match(local[0].documents.spec.reason, /not a regular file/);
  assert.match(local[0].documents.design.reason, new RegExp(`exceeds the read limit of ${DOCUMENT_READ_LIMIT}`));
  assert.deepEqual(opened.map((p) => p.slice(p.lastIndexOf('/') + 1)), ['proposal.md']);
});

test('R883-7: a 300 KiB document is cut at DOCUMENT_CAP with its note, and its state comes from the full bytes', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const big = `${'a'.repeat(300 * 1024 - 1)}\n`;
  repo.addWorktree('feat/issue-7-x', { [`${D7}/design.md`]: big }, { commit: true });
  const { local } = await blocksOf(repo, fsSeam());
  const doc = local[0].documents.design;
  assert.equal(doc.state, 'truncated');
  assert.ok(Buffer.byteLength(doc.text) <= DOCUMENT_CAP);
  assert.match(doc.note, /truncated at 262144 bytes/);
  assert.equal(doc.overlay, 'committed', 'hashing the cut text would read modified');
  assert.equal(doc.blob, hashObject(big));
  assert.equal(doc.bytes, 300 * 1024);
});

test('R883-7: a torn read is re-read once, then said unreadable; the other documents are unaffected', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n', [`${D7}/spec.md`]: '# s\n' });
  const fds = new Map();
  const opens = [];
  const seam = fsSeam({
    openSync: (p, ...rest) => { const fd = realFs.openSync(p, ...rest); fds.set(fd, p); opens.push(p); return fd; },
    fstatSync: (fd) => { const st = realFs.fstatSync(fd); return fds.get(fd).endsWith('spec.md') ? { size: st.size + 1, isFile: () => true } : st; },
  });
  const { local } = await blocksOf(repo, seam);
  assert.equal(local[0].documents.spec.state, 'unreadable');
  assert.match(local[0].documents.spec.reason, /changed while it was read/);
  assert.equal(opens.filter((p) => p.endsWith('spec.md')).length, 2, 'one re-read, not a loop');
  assert.equal(local[0].documents.proposal.state, 'present');
});

// ── R883-13 / R883-14 / R883-8: bounded, forge-free, read-only, served root untouched ──

const WRITE_VERBS = new Set(['add', 'commit', 'status', 'stash', 'checkout', 'switch', 'reset', 'push', 'fetch', 'pull', 'merge', 'rebase', 'update-ref', 'update-index', 'clean', 'restore', 'gc', 'prune', 'apply']);
const GLOBAL_PATH_OPTIONS = ['-C', '--git-dir', '--work-tree'];
const verbOf = (args) => args.find((a) => !a.startsWith('-') && !['--literal-pathspecs'].includes(a));

/** The real runner, recording every call and refusing every write verb — and saying which it was asked for, since a caller may swallow the throw. */
function guardedGit(root) {
  const real = gitRun(root);
  const calls = [];
  const attempted = [];
  const run = (file, args, opts) => {
    calls.push({ file, args });
    const verb = verbOf(args);
    if (WRITE_VERBS.has(verb) || (verb === 'worktree' && args.some((a) => ['add', 'remove', 'prune', 'move', 'lock'].includes(a)))) {
      attempted.push(args);
      throw new Error(`guardedGit: forbidden git ${args.join(' ')}`);
    }
    return real(file, args, opts);
  };
  return Object.assign(run, { calls, attempted });
}

/** Four worktrees on issue 7, each with its own commit and a change dir, `touchedAt` fixed by utimes: w1 oldest. */
function fourWorktrees(repo) {
  return [1, 2, 3, 4].map((n) => {
    const wt = repo.addWorktree(`feat/issue-7-w${n}`, { [`${D7}/proposal.md`]: `# proposal ${n}\n`, [`${D7}/tasks.md`]: '- [ ] a\n' }, { commit: true });
    const at = new Date(Date.UTC(2026, 9, 1, n));
    for (const f of ['', '/proposal.md', '/tasks.md']) utimesSync(join(wt.path, `${D7}${f}`), at, at);
    return wt;
  });
}

test('R883-13: four worktrees on one issue cost exactly three ls-tree calls in the drawer, never -C, --git-dir or --work-tree, and only git is spawned', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wts = fourWorktrees(repo);
  const snapshot = await snapshotOf(repo.root, [7]);
  assert.deepEqual(snapshot.localWorktrees.value.entries.map((e) => [e.branch, e.capped]), [['feat/issue-7-w4', false], ['feat/issue-7-w3', false], ['feat/issue-7-w2', false], ['feat/issue-7-w1', true]]);
  const run = guardedGit(repo.root);
  const out = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: run });
  assert.equal(out.ok, true);
  const heads = new Set(wts.map((w) => w.head));
  const localTrees = run.calls.filter((c) => c.args.includes('ls-tree') && c.args.some((a) => heads.has(a)));
  assert.equal(localTrees.length, 3);
  assert.ok(!localTrees.some((c) => c.args.includes(wts[0].head)), 'the capped worktree is never read');
  assert.ok(run.calls.every((c) => c.file === 'git'));
  assert.ok(run.calls.every((c) => !c.args.some((a) => GLOBAL_PATH_OPTIONS.includes(a))));
  assert.deepEqual(out.value.local.map((b) => [b.branch, b.state]), [['feat/issue-7-w4', 'read'], ['feat/issue-7-w3', 'read'], ['feat/issue-7-w2', 'read'], ['feat/issue-7-w1', 'capped']]);
  assert.match(out.value.localNote, /3 of 4/);
});

test('R883-13: the section adds exactly one git spawn and no forge call', async (t) => {
  const none = makeWorktreeRepo();
  t.after(() => none.dispose());
  const many = makeWorktreeRepo();
  t.after(() => many.dispose());
  fourWorktrees(many);
  const forgeCalls = (log) => ({ ...stubVcs([7]), issueList: async (a) => { log.push(`issueList:${a.state}`); return stubVcs([7]).issueList(a); }, mrList: async () => { log.push('mrList'); return []; } });
  const logs = [[], []];
  const spawns = [];
  for (const [i, repo] of [none, many].entries()) {
    const run = guardedGit(repo.root);
    await buildSnapshot({ root: repo.root, now: '2026-10-03T00:00:00Z', vcs: forgeCalls(logs[i]), project: 'example/repo', _run: run });
    spawns.push(run.calls.filter((c) => c.args[0] === 'worktree').map((c) => c.args));
  }
  assert.deepEqual(logs[1], logs[0], 'four worktrees add no forge call');
  assert.deepEqual(spawns[1], [['worktree', 'list', '--porcelain']]);
});

const digestOf = (path) => { try { return createHash('sha1').update(realFs.readFileSync(path)).digest('hex'); } catch { return 'absent'; } };
function treeDigest(dir) {
  const out = {};
  for (const name of realFs.readdirSync(dir, { recursive: true })) {
    const abs = join(dir, name);
    if (realFs.lstatSync(abs).isFile()) out[abs] = digestOf(abs);
  }
  return out;
}

test('R883-14: a drawer read leaves every worktree, its admin index and HEAD, and the served index byte-identical, and attempts no write verb', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wts = fourWorktrees(repo).slice(0, 2);
  put(wts[0].path, { [`${D7}/tasks.md`]: '- [x] a\n', [`${D7}/design.md`]: '# untracked\n', 'scratch.txt': 'dirty\n' });
  const admin = realFs.readdirSync(join(repo.root, '.git/worktrees')).flatMap((id) => ['index', 'HEAD'].map((f) => join(repo.root, '.git/worktrees', id, f)));
  const snap = () => ({
    trees: wts.map((w) => treeDigest(w.path)),
    admin: Object.fromEntries(admin.map((p) => [p, digestOf(p)])),
    servedIndex: digestOf(join(repo.root, '.git/index')), servedHead: digestOf(join(repo.root, '.git/HEAD')),
  });
  const before = snap();
  const run = guardedGit(repo.root);
  const snapshot = await buildSnapshot({ root: repo.root, now: '2026-10-03T00:00:00Z', vcs: stubVcs([7]), project: 'example/repo', _run: run });
  buildChangeView({ root: repo.root, issue: 7, snapshot, _run: run });
  assert.deepEqual(run.attempted, []);
  assert.deepEqual(snap(), before);
});

test('R883-8: an untracked apply-progress.md in the served root appears nowhere in the drawer, and no block names the served root', async (t) => {
  const repo = makeWorktreeRepo({ mainFiles: { [`${D7}/proposal.md`]: '# served\n' } });
  t.after(() => repo.dispose());
  put(repo.root, { [`${D7}/apply-progress.md`]: 'STRAY-SERVED-ROOT-BODY\n' });
  const v = await view(repo);
  assert.equal(v.documents.apply.state, 'missing');
  assert.deepEqual(v.local, []);
  assert.ok(!JSON.stringify(v).includes('STRAY-SERVED-ROOT-BODY'));
});

test('R883-8: when the served root is itself a linked worktree, its untracked document appears nowhere and no block names it', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const served = repo.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# served\n' }, { commit: true });
  put(served.path, { [`${D7}/apply-progress.md`]: 'STRAY-LINKED-SERVED-BODY\n' });
  const snapshot = await snapshotOf(served.path, [7]);
  assert.deepEqual(snapshot.localWorktrees.value.entries.filter((e) => e.path === served.path), [], 'the served root is hidden even though it is a kept-looking issue branch');
  const v = buildChangeView({ root: served.path, issue: 7, snapshot, _run: gitRun(served.path) }).value;
  assert.equal(v.documents.apply.state, 'missing');
  assert.deepEqual(v.local.filter((b) => b.path === served.path || b.branch === 'feat/issue-7-x'), []);
  assert.ok(!JSON.stringify(v).includes('STRAY-LINKED-SERVED-BODY'));
});

test('R883-9: the block carries its resume outcome through the same reader the remote blocks use', async (t) => {
  const valid = makeWorktreeRepo();
  t.after(() => valid.dispose());
  valid.addWorktree('feat/issue-7-x', { [`${D7}/resume.md`]: RESUME_VALID });
  const ok = (await view(valid)).local[0].resume;
  assert.equal(ok.state, 'present');
  assert.equal(ok.view.next_action.value, 'ship the reader');
  assert.equal(ok.document.overlay, 'new');

  const bad = makeWorktreeRepo();
  t.after(() => bad.dispose());
  bad.addWorktree('feat/issue-7-x', { [`${D7}/resume.md`]: RESUME_INVALID });
  assert.equal((await view(bad)).local[0].resume.state, 'invalid');

  const none = makeWorktreeRepo();
  t.after(() => none.dispose());
  none.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n' });
  assert.equal((await view(none)).local[0].resume.state, 'missing');
});

test('R883-8: local-overlay.mjs never joins a path onto the served root, and opens nothing for writing', async () => {
  const src = realFs.readFileSync(new URL('./local-overlay.mjs', import.meta.url), 'utf8');
  const code = maskNonCode(src);
  assert.doesNotMatch(code, /\broot\b/, 'the module has no served-root identifier to join onto');
  assert.doesNotMatch(code, /\b(?:writeFileSync|appendFileSync|createWriteStream|mkdirSync|renameSync|unlinkSync|rmSync|utimesSync|O_WRONLY|O_RDWR|O_CREAT)\b/);
  assert.doesNotMatch(code, /\breadFileSync\b/, 'every read goes through the lstat-then-O_NOFOLLOW path');
});

// ── R883-9 / R883-15: precedence and the Working memory wording ─────────────

/** The snapshot, with `origin` knowing `branch` at `sha` (the remote reader's own entry shape). */
const withOrigin = (snapshot, branch, sha) => ({
  ...snapshot,
  remoteChanges: { ok: true, value: { base: 'origin/main', branches: [{ branch, sha, tipAt: '2026-10-01T00:00:00Z', author: 'Ada Lovelace', kind: 'grammar', issue: 7, pr: null, change: { ok: false, state: 'missing', reason: 'no change dir' }, resume: { state: 'missing' } }], unjoined: [], hidden: { base: 0, lane: 0, merged: 0 }, prsApplied: true, deferred: 0 } },
});

test('R883-9/R1276-2: with the change dir on main, local sits beside remote and the tabs keep reading the served HEAD', async (t) => {
  const repo = makeWorktreeRepo({ mainFiles: { [`${D7}/proposal.md`]: '# served\n' } });
  t.after(() => repo.dispose());
  repo.addWorktree('feat/issue-7-x', { [`${D7}/spec.md`]: '### R7-1: a\n#### Scenario: s\n- **WHEN** w\n- **THEN** t\n' });
  const v = await view(repo);
  assert.deepEqual(Object.keys(v).filter((k) => ['remote', 'remoteNote', 'local', 'localNote'].includes(k)).sort(), ['local', 'localNote', 'remote', 'remoteNote']);
  assert.equal(v.spec.ok, false, 'the spec tab does not fall through to the worktree spec');
  assert.equal(v.documents.proposal.text, '# served\n');
});

test('R883-9: a block at its origin tip with nothing uncommitted is same-as-origin without documents; one uncommitted document keeps it read', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n' }, { commit: true });
  const snapshot = withOrigin(await snapshotOf(repo.root, [7]), 'feat/issue-7-x', wt.head);
  const clean = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) }).value.local[0];
  assert.equal(clean.state, 'same-as-origin');
  assert.equal(clean.documents, null);

  put(wt.path, { [`${D7}/proposal.md`]: '# p edited\n' });
  const dirty = buildChangeView({ root: repo.root, issue: 7, snapshot: withOrigin(await snapshotOf(repo.root, [7]), 'feat/issue-7-x', wt.head), _run: gitRun(repo.root) }).value.local[0];
  assert.equal(dirty.state, 'read');
  assert.equal(dirty.documents.proposal.overlay, 'modified');

  const other = buildChangeView({ root: repo.root, issue: 7, snapshot: withOrigin(await snapshotOf(repo.root, [7]), 'feat/issue-7-x', 'f'.repeat(40)), _run: gitRun(repo.root) }).value.local[0];
  assert.equal(other.state, 'read', 'a different origin sha is not the same as origin');
});

test('R1276-1: a same-as-origin block lists no documents, but hands the ones it read to the tab source', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n' }, { commit: true });
  const snapshot = withOrigin(await snapshotOf(repo.root, [7]), 'feat/issue-7-x', wt.head);

  const read = readLocalBlocks({ run: gitRun(repo.root), snapshot, issue: 7, mainDocuments: {} });

  assert.equal(read.local[0].state, 'same-as-origin');
  assert.equal(read.local[0].documents, null);
  assert.equal(read.held.get(wt.path).documents.proposal.text, '# p\n');
});

test('R883-9: at the origin tip, an unreadable document or a document deleted from the working tree keeps the block read, never same-as-origin', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n', [`${D7}/tasks.md`]: '- [ ] a\n' }, { commit: true });
  realFs.unlinkSync(join(wt.path, D7, 'proposal.md'));
  put(repo.base, { 'outside/p.md': 'OUTSIDE\n' });
  symlinkSync(join(repo.base, 'outside/p.md'), join(wt.path, D7, 'proposal.md'));
  realFs.unlinkSync(join(wt.path, D7, 'tasks.md'));
  const snapshot = withOrigin(await snapshotOf(repo.root, [7]), 'feat/issue-7-x', wt.head);
  const block = buildChangeView({ root: repo.root, issue: 7, snapshot, _run: gitRun(repo.root) }).value.local[0];
  assert.equal(block.state, 'read');
  assert.equal(block.documents.proposal.state, 'unreadable');
  assert.match(block.documents.proposal.reason, /symbolic link/);
  assert.ok(!JSON.stringify(block).includes('OUTSIDE'));
});

test('R883-6: a document committed on the branch and deleted from the working tree is overlay deleted: uncommitted, no body, and distinct from "not in this worktree"', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n', [`${D7}/tasks.md`]: '- [ ] a\n' }, { commit: true });
  realFs.unlinkSync(join(wt.path, D7, 'tasks.md'));
  const { local } = readLocalBlocks({ run: gitRun(repo.root), snapshot: await snapshotOf(repo.root, [7]), issue: 7, mainDocuments: {}, _fs: realFs });
  const tasks = local[0].documents.tasks;
  assert.equal(tasks.overlay, 'deleted');
  assert.equal(tasks.uncommitted, true);
  assert.equal(tasks.text, null);
  assert.equal(tasks.blob, null);
  assert.ok(!local[0].absent.includes('tasks.md'), 'a deleted document is not "not in this worktree"');
  assert.ok(local[0].absent.includes('spec.md'), 'a never-present one still is');
});

test('R883-6: a resume.md deleted from the working tree is a missing resume with its reason, never a parse of no text', async (t) => {
  const repo = makeWorktreeRepo();
  t.after(() => repo.dispose());
  const wt = repo.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n', [`${D7}/resume.md`]: 'x\n' }, { commit: true });
  realFs.unlinkSync(join(wt.path, D7, 'resume.md'));
  const { local } = readLocalBlocks({ run: gitRun(repo.root), snapshot: await snapshotOf(repo.root, [7]), issue: 7, mainDocuments: {}, _fs: realFs });
  assert.equal(local[0].documents.resume.overlay, 'deleted');
  assert.equal(local[0].resume.state, 'missing');
  assert.match(local[0].resume.reason, /deleted/);
});

test('R883-15: with no committed resume, the Working memory reason points at "on this machine" only when a local resume exists, and never says slice 5', async (t) => {
  const withLocal = makeWorktreeRepo();
  t.after(() => withLocal.dispose());
  withLocal.addWorktree('feat/issue-7-x', { [`${D7}/resume.md`]: RESUME_VALID });
  const a = (await view(withLocal)).workingMemory;
  assert.equal(a.ok, false);
  assert.match(a.reason, /on this machine/);
  assert.doesNotMatch(a.reason, /slice 5/);

  const without = makeWorktreeRepo();
  t.after(() => without.dispose());
  without.addWorktree('feat/issue-7-x', { [`${D7}/proposal.md`]: '# p\n' });
  const b = (await view(without)).workingMemory;
  assert.equal(b.reason, 'no committed resume.md on feat/issue-7-x');
});

test('R883-2: an ok section with no entry is no block and no note; a section that could not be read says so; a loading one says nothing yet', () => {
  const read = (localWorktrees) => readLocalBlocks({ run: () => { throw new Error('no git'); }, snapshot: { localWorktrees }, issue: 7, mainDocuments: {} });
  assert.deepEqual(read({ ok: true, value: { entries: [], hidden: {}, tier: 'working-tree' } }), { local: [], localNote: null, held: new Map() });
  const down = read({ ok: false, reason: 'the worktree list could not be read: fatal: boom' });
  assert.deepEqual(down.local, []);
  assert.equal(down.localNote, "this machine's worktrees were not read: the worktree list could not be read: fatal: boom");
  assert.deepEqual(read({ ok: false, pending: true, reason: 'loading open issues from the forge…' }), { local: [], localNote: null, held: new Map() });
  assert.deepEqual(read(undefined), { local: [], localNote: null, held: new Map() }, 'a snapshot from an older server has no section');
});
