// local-worktrees.test.mjs — #883 R883-1..R883-4 (D69-D72): the localWorktrees
// section, from one listing and metadata-only reads, on an in-memory filesystem.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';

import { parseWorktrees } from '../memory/lane/collect.mjs';
import { readLocalWorktrees, LOCAL_DRAWER_CAP, LOCAL_DOCUMENT_FILES } from './local-worktrees.mjs';

const ROOT = '/srv/main';
const stanza = (path, branch, head = 'b'.repeat(40), extra = []) => [`worktree ${path}`, `HEAD ${head}`, branch ? `branch refs/heads/${branch}` : 'detached', ...extra, ''].join('\n');
const listing = (...stanzas) => [stanza(ROOT, 'main', 'a'.repeat(40)), ...stanzas].join('\n');
const openGraph = (...numbers) => ({ ok: true, value: { nodes: numbers.map((number) => ({ number })) } });

function fakeFs(nodes) {
  const err = (code, p) => Object.assign(new Error(`${code}: ${p}`), { code });
  const node = (p) => { if (!(p in nodes)) throw err('ENOENT', p); return nodes[p]; };
  const stat = (n) => ({
    isSymbolicLink: () => n.symlink === true, isDirectory: () => n === 'dir', isFile: () => typeof n === 'object' && n.symlink !== true,
    size: n.size ?? 0, mtimeMs: n.mtimeMs ?? 0,
  });
  return {
    nodes,
    readdirSync(p) {
      if (node(p) !== 'dir') throw err('ENOTDIR', p);
      return Object.keys(nodes).filter((k) => dirname(k) === p).map((k) => {
        const n = nodes[k];
        return { name: k.slice(p.length + 1), isDirectory: () => n === 'dir', isSymbolicLink: () => n.symlink === true };
      });
    },
    lstatSync: (p) => stat(node(p)),
    realpathSync: (p) => { const n = node(p); return (n && n.real) ?? p; },
  };
}

/** A worktree with a change dir for `issue`, its documents given as {file: {size, mtimeMs}}. */
function worktreeNodes(path, issue, docs = {}, slug = 'x') {
  const changes = `${path}/openspec/changes`;
  const dir = `${changes}/issue-${issue}-${slug}`;
  return {
    [path]: 'dir', [`${path}/openspec`]: 'dir', [changes]: 'dir', [dir]: 'dir',
    ...Object.fromEntries(Object.entries(docs).map(([file, meta]) => [`${dir}/${file}`, { size: 10, mtimeMs: 1000, ...meta }])),
  };
}

const recorder = (out) => { const calls = []; const run = (file, args) => { calls.push(args); if (out instanceof Error) throw out; return out; }; run.calls = calls; return run; };
const FS_ROOT = { [ROOT]: 'dir' };
const build = ({ out, nodes = {}, graph = openGraph(11, 12, 13), root = ROOT } = {}) => {
  const run = recorder(out);
  return { run, section: readLocalWorktrees({ run, root, graph, _fs: fakeFs({ ...FS_ROOT, ...nodes }) }) };
};

test('R883-1: parseWorktrees returns head, branch and detached, and its old fields unchanged', () => {
  const out = [
    stanza('/a', 'feat/issue-1-a', '1'.repeat(40)),
    stanza('/b', null, '2'.repeat(40)),
    ['worktree /c', 'bare', ''].join('\n'),
    stanza('/d', 'feat/issue-4-d', '4'.repeat(40), ['prunable gitdir file points to non-existent location']),
  ].join('\n');
  assert.deepEqual(parseWorktrees(out), [
    { path: '/a', bare: false, prunable: false, head: '1'.repeat(40), branch: 'feat/issue-1-a', detached: false },
    { path: '/b', bare: false, prunable: false, head: '2'.repeat(40), branch: null, detached: true },
    { path: '/c', bare: true, prunable: false, head: null, branch: null, detached: false },
    { path: '/d', bare: false, prunable: true, head: '4'.repeat(40), branch: 'feat/issue-4-d', detached: false },
  ]);
});

test('R883-1: worktrees on feat/ and fix/ branches of open issues join, with their branch, head and issue', () => {
  const nodes = { ...worktreeNodes('/srv/a', 11), ...worktreeNodes('/srv/b', 12) };
  const { section } = build({ out: listing(stanza('/srv/a', 'feat/issue-11-a', '1'.repeat(40)), stanza('/srv/b', 'fix/issue-12-b', '2'.repeat(40))), nodes });
  assert.equal(section.ok, true);
  assert.equal(section.value.tier, 'working-tree');
  assert.deepEqual(section.value.entries.map((e) => [e.issue, e.branch, e.head, e.leaf]), [[11, 'feat/issue-11-a', '1'.repeat(40), 'a'], [12, 'fix/issue-12-b', '2'.repeat(40), 'b']]);
  assert.deepEqual(Object.keys(section.value.entries[0]).sort(), ['branch', 'capped', 'dir', 'dirState', 'fingerprint', 'head', 'headCommitAt', 'issue', 'leaf', 'path', 'reason', 'touchedAt'].sort());
  assert.equal(section.value.entries[0].dir, 'openspec/changes/issue-11-x');
  assert.equal(section.value.entries[0].dirState, 'present');
});

test('R883-1: the served root is hidden by real path, so a server run from a linked worktree hides itself', () => {
  const nodes = { ...worktreeNodes('/srv/linked', 13), '/srv/alias': { symlink: true, real: '/srv/linked' } };
  const { section } = build({ root: '/srv/alias', out: listing(stanza('/srv/linked', 'feat/issue-13-c')), nodes });
  assert.equal(section.value.entries.length, 0);
  assert.equal(section.value.hidden.served, 1);
});

test('R883-1: a detached, a spike/x, a bare and a prunable worktree are hidden and counted by cause', () => {
  const out = listing(
    stanza('/srv/d', null), stanza('/srv/s', 'spike/x'), ['worktree /srv/bare', 'bare', ''].join('\n'),
    stanza('/srv/gone', 'feat/issue-11-a', 'c'.repeat(40), ['prunable gitdir file points to non-existent location']),
  );
  const { section } = build({ out, nodes: { '/srv/d': 'dir', '/srv/s': 'dir' } });
  assert.equal(section.ok, true);
  assert.deepEqual(section.value.entries, []);
  assert.deepEqual(section.value.hidden, { served: 1, bare: 1, prunable: 1, detached: 1, notIssue: 1, closed: 0 });
});

test('R883-1: discovery costs exactly one git spawn, `worktree list --porcelain`', () => {
  const wts = [1, 2, 3, 4, 5].map((n) => `/srv/w${n}`);
  const nodes = Object.assign({}, ...wts.map((p, i) => worktreeNodes(p, 11 + (i % 2))));
  const { run } = build({ out: listing(...wts.map((p, i) => stanza(p, `feat/issue-${11 + (i % 2)}-x`))), nodes });
  assert.deepEqual(run.calls, [['worktree', 'list', '--porcelain']]);
});

test('R883-2: a listing of only the served root is an ok section with zero entries; a failed listing is uncomputable with its reason', () => {
  const empty = build({ out: listing() }).section;
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.value.entries, []);
  const failed = build({ out: Object.assign(new Error('boom'), { stderr: 'fatal: not a git repository' }) }).section;
  assert.equal(failed.ok, false);
  assert.equal(failed.pending, undefined);
  assert.match(failed.reason, /fatal: not a git repository/);
});

test('R883-3: only open issues are kept; a closed issue is counted in hidden.closed', () => {
  const nodes = { ...worktreeNodes('/srv/a', 11), ...worktreeNodes('/srv/z', 40) };
  const { section } = build({ out: listing(stanza('/srv/a', 'feat/issue-11-a'), stanza('/srv/z', 'feat/issue-40-z')), nodes });
  assert.deepEqual(section.value.entries.map((e) => e.issue), [11]);
  assert.equal(section.value.hidden.closed, 1);
});

test('R883-3: a pending graph gives a pending section, an uncomputable graph an uncomputable one naming R6; neither lists a worktree', () => {
  const nodes = worktreeNodes('/srv/a', 11);
  const out = listing(stanza('/srv/a', 'feat/issue-11-a'));
  const loading = build({ out, nodes, graph: { ok: false, pending: true, reason: 'loading open issues from the forge…' } }).section;
  assert.deepEqual(loading, { ok: false, pending: true, reason: 'loading open issues from the forge…' });
  const down = build({ out, nodes, graph: { ok: false, reason: 'the issue list could not be read: 503' } }).section;
  assert.equal(down.ok, false);
  assert.equal(down.pending, undefined);
  assert.match(down.reason, /R6/);
  assert.match(down.reason, /open-issue/);
  assert.match(down.reason, /503/);
});

test('R883-3: a graph that is not ready spawns no git at all', () => {
  const run = recorder(listing());
  readLocalWorktrees({ run, root: ROOT, graph: { ok: false, pending: true, reason: 'loading' }, _fs: fakeFs(FS_ROOT) });
  assert.deepEqual(run.calls, []);
});

test('R883-4: four worktrees on one issue order by touchedAt and the fourth is capped', () => {
  const mk = (n, mtimeMs) => worktreeNodes(`/srv/w${n}`, 11, { 'proposal.md': { mtimeMs } }, `s${n}`);
  const nodes = { ...mk(1, 1000), ...mk(2, 4000), ...mk(3, 3000), ...mk(4, 2000) };
  const { section } = build({ out: listing(...[1, 2, 3, 4].map((n) => stanza(`/srv/w${n}`, `feat/issue-11-s${n}`))), nodes });
  assert.equal(LOCAL_DRAWER_CAP, 3);
  assert.deepEqual(section.value.entries.map((e) => [e.leaf, e.capped]), [['w2', false], ['w3', false], ['w4', false], ['w1', true]]);
  assert.equal(section.value.entries[0].touchedAt, new Date(4000).toISOString());
});

test('R883-4: the cap counts within an issue, and an entry with no touchedAt sorts last', () => {
  const nodes = { ...worktreeNodes('/srv/a', 11, { 'proposal.md': { mtimeMs: 5000 } }), ...worktreeNodes('/srv/b', 12, { 'proposal.md': { mtimeMs: 1 } }), '/srv/c': 'dir' };
  const { section } = build({ out: listing(stanza('/srv/c', 'feat/issue-11-c'), stanza('/srv/b', 'feat/issue-12-b'), stanza('/srv/a', 'feat/issue-11-a')), nodes });
  assert.deepEqual(section.value.entries.map((e) => [e.issue, e.leaf, e.capped]), [[11, 'a', false], [11, 'c', false], [12, 'b', false]]);
  assert.equal(section.value.entries[1].touchedAt, null);
});

test('R883-5: a worktree with no change dir is kept with dirState missing and the wording "no change dir in this worktree"; two dirs are unreadable, naming both', () => {
  const none = build({ out: listing(stanza('/srv/a', 'feat/issue-11-a')), nodes: { '/srv/a': 'dir', '/srv/a/openspec': 'dir', '/srv/a/openspec/changes': 'dir' } }).section.value.entries[0];
  assert.equal(none.dirState, 'missing');
  assert.equal(none.reason, 'no change dir in this worktree');
  assert.equal(none.dir, null);
  const noChangesRoot = build({ out: listing(stanza('/srv/a', 'feat/issue-11-a')), nodes: { '/srv/a': 'dir' } }).section.value.entries[0];
  assert.equal(noChangesRoot.dirState, 'missing');
  const two = build({ out: listing(stanza('/srv/a', 'feat/issue-11-a')), nodes: { ...worktreeNodes('/srv/a', 11, {}, 'one'), '/srv/a/openspec/changes/issue-11-two': 'dir' } }).section.value.entries[0];
  assert.equal(two.dirState, 'unreadable');
  assert.match(two.reason, /issue-11-one/);
  assert.match(two.reason, /issue-11-two/);
});

test('R883-7: a change dir that is a symlink, or whose real path leaves the worktree, is unreadable and nothing under it is read', () => {
  const link = { '/srv/a': 'dir', '/srv/a/openspec': 'dir', '/srv/a/openspec/changes': 'dir', '/srv/a/openspec/changes/issue-11-a': { symlink: true, real: '/elsewhere/issue-11-a' } };
  const fs = fakeFs({ ...FS_ROOT, ...link });
  const run = recorder(listing(stanza('/srv/a', 'feat/issue-11-a')));
  const entry = readLocalWorktrees({ run, root: ROOT, graph: openGraph(11), _fs: fs }).value.entries[0];
  assert.equal(entry.dirState, 'unreadable');
  assert.match(entry.reason, /symbolic link/);
  // a plain dir whose real path escapes (a symlinked parent): lstat says dir, realpath says elsewhere.
  const parentLink = { ...worktreeNodes('/srv/a', 11) };
  parentLink['/srv/a/openspec/changes/issue-11-x'] = 'dir';
  const fsEscape = fakeFs({ ...FS_ROOT, ...parentLink });
  const realReal = fsEscape.realpathSync;
  fsEscape.realpathSync = (p) => (p === '/srv/a/openspec/changes/issue-11-x' ? '/elsewhere/issue-11-x' : realReal(p));
  const entry2 = readLocalWorktrees({ run: recorder(listing(stanza('/srv/a', 'feat/issue-11-a'))), root: ROOT, graph: openGraph(11), _fs: fsEscape }).value.entries[0];
  assert.equal(entry2.dirState, 'unreadable');
  assert.match(entry2.reason, /outside the worktree/);
});

test('R883-11: the fingerprint changes after a resize and after an mtime change, and not for an untouched worktree', () => {
  const at = (meta) => build({ out: listing(stanza('/srv/a', 'feat/issue-11-a')), nodes: worktreeNodes('/srv/a', 11, { 'tasks.md': meta }) }).section.value.entries[0].fingerprint;
  const base = at({ size: 10, mtimeMs: 1000 });
  assert.match(base, /^[0-9a-f]{16}$/);
  assert.equal(at({ size: 10, mtimeMs: 1000 }), base);
  assert.notEqual(at({ size: 11, mtimeMs: 1000 }), base);
  assert.notEqual(at({ size: 10, mtimeMs: 2000 }), base);
});

test('R883-1: the section reads names and lstat metadata only, never a file', () => {
  const nodes = worktreeNodes('/srv/a', 11, Object.fromEntries(Object.values(LOCAL_DOCUMENT_FILES).map((f) => [f, {}])));
  const fs = fakeFs({ ...FS_ROOT, ...nodes });
  const seen = [];
  for (const name of Object.keys(fs)) if (typeof fs[name] === 'function') { const orig = fs[name]; fs[name] = (...a) => { seen.push(name); return orig(...a); }; }
  readLocalWorktrees({ run: recorder(listing(stanza('/srv/a', 'feat/issue-11-a'))), root: ROOT, graph: openGraph(11), _fs: fs });
  assert.deepEqual([...new Set(seen)].sort(), ['lstatSync', 'readdirSync', 'realpathSync']);
});

// ── #1284 D103: a worktree with no change dir gets its head commit time ─────

const SHA_A = 'a1'.repeat(20);
const SHA_B = 'b2'.repeat(20);
const SHA_C = 'c3'.repeat(20);
function dispatchRun(listingOut, show) {
  const calls = [];
  const run = (file, args) => {
    calls.push(args);
    if (args[0] === 'worktree') return listingOut;
    if (args[0] === 'show') { if (show instanceof Error) throw show; return show; }
    throw new Error(`unexpected git ${args.join(' ')}`);
  };
  run.calls = calls;
  return run;
}
const withRun = (run, nodes) => readLocalWorktrees({ run, root: ROOT, graph: openGraph(11, 12, 13), _fs: fakeFs({ ...FS_ROOT, ...nodes }) });

test('#1284 D103: ONE git show over the head shas of missing-dir worktrees gives them headCommitAt', () => {
  const out = listing(stanza('/srv/m1', 'feat/issue-11-a', SHA_A), stanza('/srv/m2', 'feat/issue-12-b', SHA_B), stanza('/srv/p', 'feat/issue-13-c', SHA_C));
  const run = dispatchRun(out, '2026-10-02T09:00:00+00:00\n2026-10-03T09:00:00+00:00\n');
  const section = withRun(run, { '/srv/m1': 'dir', '/srv/m2': 'dir', ...worktreeNodes('/srv/p', 13) });
  const shows = run.calls.filter((a) => a[0] === 'show');
  assert.deepEqual(shows, [['show', '-s', '--format=%cI', SHA_A, SHA_B]], 'present-dir worktrees are not asked');
  const by = Object.fromEntries(section.value.entries.map((e) => [e.issue, e]));
  assert.equal(by[11].headCommitAt, '2026-10-02T09:00:00+00:00');
  assert.equal(by[12].headCommitAt, '2026-10-03T09:00:00+00:00');
  assert.equal(by[13].headCommitAt, null);
});

test('#1284 D103: a failing git show leaves the entries without a time, never a wrong one; no call when none qualifies', () => {
  const out = listing(stanza('/srv/m1', 'feat/issue-11-a', SHA_A));
  const failing = dispatchRun(out, new Error('boom'));
  const section = withRun(failing, { '/srv/m1': 'dir' });
  assert.equal(section.ok, true);
  assert.equal(section.value.entries[0].headCommitAt, null);
  const none = dispatchRun(listing(stanza('/srv/p', 'feat/issue-13-c', SHA_C)), '');
  withRun(none, worktreeNodes('/srv/p', 13));
  assert.equal(none.calls.filter((a) => a[0] === 'show').length, 0);
  const short = dispatchRun(out, '');
  assert.equal(withRun(short, { '/srv/m1': 'dir' }).value.entries[0].headCommitAt, null, 'an output that does not match the sha count assigns nothing');
});
