// upstream-records.test.mjs — unit tests for the issue #701 predicate module.
// Pure (`parseLsTree`) and seam-injected (`resolveUpstreamRef`,
// `upstreamRecordEntries`) — no test spawns a real git process (mirrors
// `backend-selection.test.mjs`'s `_spawn` seam discipline).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseLsTree, resolveUpstreamRef, upstreamRecordEntries } from './upstream-records.mjs';

const entry = (mode, oid, path) => `${mode} blob ${oid}\t${path}`;

// ---------------------------------------------------------------------------
// parseLsTree — pure, fixture strings (task 1.4)
// ---------------------------------------------------------------------------

test('parseLsTree: a per-record name lands its id in byId and its path in byPath', () => {
  const text = entry('100644', 'aaaa1111', '.memory/records/2026-08-rec-0123456789abcdef.jsonl');
  const { byId, byPath, unnamed } = parseLsTree(text);
  assert.equal(byId.get('rec-0123456789abcdef'), 'aaaa1111');
  assert.equal(byPath.get('.memory/records/2026-08-rec-0123456789abcdef.jsonl'), 'aaaa1111');
  assert.deepEqual(unnamed, []);
});

test('parseLsTree: a month file (pre-#677 shape) lands in unnamed, not byId', () => {
  const text = entry('100644', 'bbbb2222', '.memory/records/2026-08.jsonl');
  const { byId, unnamed } = parseLsTree(text);
  assert.equal(byId.size, 0);
  assert.deepEqual(unnamed, ['.memory/records/2026-08.jsonl']);
});

test('parseLsTree: a nested path still extracts the id from its basename', () => {
  const text = entry('100644', 'cccc3333', '.memory/records/legacy/2026-08-rec-fedcba9876543210.jsonl');
  const { byId } = parseLsTree(text);
  assert.equal(byId.get('rec-fedcba9876543210'), 'cccc3333');
});

test('parseLsTree: an empty tree yields empty maps and no unnamed entries', () => {
  const { byId, byPath, unnamed } = parseLsTree('');
  assert.equal(byId.size, 0);
  assert.equal(byPath.size, 0);
  assert.deepEqual(unnamed, []);
});

test('parseLsTree: garbage input never throws and yields nothing', () => {
  assert.doesNotThrow(() => parseLsTree('not\tls-tree\0output\0\0garbage'));
  const { byId, unnamed } = parseLsTree('garbage-with-no-tab\0also garbage');
  assert.equal(byId.size, 0);
  assert.deepEqual(unnamed, []);
});

test('parseLsTree: multiple NUL-separated entries all parse', () => {
  const text = [
    entry('100644', 'aaaa', '.memory/records/2026-08-rec-1111111111111111.jsonl'),
    entry('100644', 'bbbb', '.memory/records/2026-08-rec-2222222222222222.jsonl'),
  ].join('\0') + '\0';
  const { byId } = parseLsTree(text);
  assert.equal(byId.size, 2);
  assert.equal(byId.get('rec-1111111111111111'), 'aaaa');
  assert.equal(byId.get('rec-2222222222222222'), 'bbbb');
});

// ---------------------------------------------------------------------------
// resolveUpstreamRef — seam-injected (task 1.5)
// ---------------------------------------------------------------------------

function fakeSpawn(resolvesFor) {
  return (bin, args) => {
    const ref = args[3]?.replace(/\^\{tree\}$/, '');
    return { status: resolvesFor.includes(ref) ? 0 : 1 };
  };
}

test('resolveUpstreamRef: env (level 1, stated) resolves — wins outright', () => {
  const r = resolveUpstreamRef({
    root: '/fake',
    env: { BRAIN_MEMORY_UPSTREAM_REF: 'origin/feature/x' },
    config: { memory: { upstreamRef: 'origin/other' } },
    _spawn: fakeSpawn(['origin/feature/x', 'origin/main']),
  });
  assert.deepEqual(r, { ref: 'origin/feature/x', stated: true, resolved: true });
});

test('resolveUpstreamRef: env (level 1, stated) does NOT resolve — does not fall through to config', () => {
  const r = resolveUpstreamRef({
    root: '/fake',
    env: { BRAIN_MEMORY_UPSTREAM_REF: 'origin/does-not-exist' },
    config: { memory: { upstreamRef: 'origin/other' } },
    _spawn: fakeSpawn(['origin/other', 'origin/main']),
  });
  assert.deepEqual(r, { ref: 'origin/does-not-exist', stated: true, resolved: false });
});

test('resolveUpstreamRef: config (level 2, stated) resolves when env is unset', () => {
  const r = resolveUpstreamRef({
    root: '/fake',
    env: {},
    config: { memory: { upstreamRef: 'origin/other' } },
    _spawn: fakeSpawn(['origin/other']),
  });
  assert.deepEqual(r, { ref: 'origin/other', stated: true, resolved: true });
});

test('resolveUpstreamRef: config (level 2, stated) does NOT resolve — does not fall through to origin/HEAD', () => {
  const r = resolveUpstreamRef({
    root: '/fake',
    env: {},
    config: { memory: { upstreamRef: 'origin/other' } },
    _spawn: fakeSpawn(['origin/HEAD', 'origin/main']),
  });
  assert.deepEqual(r, { ref: 'origin/other', stated: true, resolved: false });
});

test('resolveUpstreamRef: no stated ref — origin/HEAD (level 3, derived) resolves', () => {
  const r = resolveUpstreamRef({
    root: '/fake',
    env: {},
    config: {},
    _spawn: fakeSpawn(['origin/HEAD', 'origin/main']),
  });
  assert.deepEqual(r, { ref: 'origin/HEAD', stated: false, resolved: true });
});

test('resolveUpstreamRef: no stated ref — origin/HEAD fails through to origin/main (level 4, derived)', () => {
  const r = resolveUpstreamRef({
    root: '/fake',
    env: {},
    config: {},
    _spawn: fakeSpawn(['origin/main']),
  });
  assert.deepEqual(r, { ref: 'origin/main', stated: false, resolved: true });
});

test('resolveUpstreamRef: nothing resolves — reports origin/main, unresolved', () => {
  const r = resolveUpstreamRef({
    root: '/fake',
    env: {},
    config: {},
    _spawn: fakeSpawn([]),
  });
  assert.deepEqual(r, { ref: 'origin/main', stated: false, resolved: false });
});

// ---------------------------------------------------------------------------
// upstreamRecordEntries — seam-injected (task 1.6)
// ---------------------------------------------------------------------------

test('upstreamRecordEntries: no git binary at the rev-parse step → ok:false', () => {
  const r = upstreamRecordEntries({
    root: '/fake',
    env: {},
    config: {},
    _spawn: () => { throw new Error('spawn git ENOENT'); },
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /no upstream ref resolved/);
});

test('upstreamRecordEntries: not a git repo (every rev-parse fails) → ok:false', () => {
  const r = upstreamRecordEntries({
    root: '/fake',
    env: {},
    config: {},
    _spawn: () => ({ status: 128 }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.stated, false);
});

test('upstreamRecordEntries: no remote (origin/main also fails to resolve) → ok:false, names the ref tried', () => {
  const r = upstreamRecordEntries({
    root: '/fake',
    env: {},
    config: {},
    _spawn: () => ({ status: 1 }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.ref, 'origin/main');
});

test('upstreamRecordEntries: ref resolves but ls-tree exits non-zero → ok:false', () => {
  const r = upstreamRecordEntries({
    root: '/fake',
    env: {},
    config: {},
    _spawn: (bin, args) => {
      if (args[0] === 'rev-parse') return { status: 0 };
      return { status: 128, stderr: 'fatal: bad object' };
    },
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /ls-tree exited/);
});

test('upstreamRecordEntries: resolves and ls-tree succeeds → ok:true with parsed entries', () => {
  const lsTreeOut = entry('100644', 'dead', '.memory/records/2026-08-rec-abcdefabcdefabcd.jsonl') + '\0';
  const r = upstreamRecordEntries({
    root: '/fake',
    env: {},
    config: {},
    _spawn: (bin, args) => {
      if (args[0] === 'rev-parse') return { status: 0 };
      return { status: 0, stdout: lsTreeOut };
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.ref, 'origin/HEAD');
  assert.equal(r.byId.get('rec-abcdefabcdefabcd'), 'dead');
});

// ---------------------------------------------------------------------------
// The config LEVEL, driven through the PRODUCTION entry point (cold review of
// #708).
//
// Every test above passes `config` EXPLICITLY, so all of them exercise the
// non-default branch and none of them can see whether the config is ever read
// from disk. That is how `upstreamRecordEntries`'s own `config = {}` default
// survived: `{}` is not nullish, so `config ?? _loadConfig(root)` never fired
// from any production caller and `memory.upstreamRef` stayed dead while the
// module's refusal text kept naming it.
//
// These tests therefore OMIT `config` and drive `upstreamRecordEntries` — the
// function `engram.mjs#dualWriteRecords` and `staged-records-check.mjs` both
// call — against a real tmpdir holding a real `brain.config.json`.
// ---------------------------------------------------------------------------

function tmpRoot(configText) {
  const dir = mkdtempSync(join(tmpdir(), 'brain-upstream-records-'));
  if (configText !== undefined) writeFileSync(join(dir, 'brain.config.json'), configText);
  return dir;
}

/** Resolves the named refs; answers `ls-tree` with one record entry. */
function fakeGit(resolvesFor, lsTreeSeen = []) {
  return (bin, args) => {
    if (args[0] === 'rev-parse') {
      const ref = args[3]?.replace(/\^\{tree\}$/, '');
      return { status: resolvesFor.includes(ref) ? 0 : 1 };
    }
    lsTreeSeen.push(args[4]); // `ls-tree -r -z --full-tree <ref> -- <path>`
    return { status: 0, stdout: entry('100644', 'dead', '.memory/records/2026-08-rec-abcdefabcdefabcd.jsonl') + '\0' };
  };
}

test('upstreamRecordEntries: memory.upstreamRef is read from root when config is OMITTED — and a stated ref that does not resolve never falls through', () => {
  const root = tmpRoot(JSON.stringify({ memory: { upstreamRef: 'origin/does-not-exist' } }));
  const r = upstreamRecordEntries({
    root,
    env: {},
    // no `config` — the production call shape (`_upstreamRecordIds({ root })`)
    _spawn: fakeGit(['origin/HEAD', 'origin/main']),
  });
  assert.equal(r.ok, false, 'a stated ref that does not resolve must stop resolution, not derive origin/HEAD');
  assert.equal(r.ref, 'origin/does-not-exist');
  assert.equal(r.stated, true);
  assert.match(r.reason, /the stated upstream ref 'origin\/does-not-exist' does not resolve/);
});

test('upstreamRecordEntries: a resolvable memory.upstreamRef read from root is the ref ls-tree is actually asked about', () => {
  const root = tmpRoot(JSON.stringify({ memory: { upstreamRef: 'origin/feature/x' } }));
  const lsTreeSeen = [];
  const r = upstreamRecordEntries({
    root,
    env: {},
    _spawn: fakeGit(['origin/feature/x', 'origin/HEAD', 'origin/main'], lsTreeSeen),
  });
  assert.equal(r.ok, true);
  assert.equal(r.ref, 'origin/feature/x');
  assert.equal(r.stated, true);
  // The over-refusal axis: honoring the config must not stop at the REPORT —
  // the stated ref has to be the one the id set is read from.
  assert.deepEqual(lsTreeSeen, ['origin/feature/x']);
});

test('upstreamRecordEntries: no brain.config.json at root — the derived candidates still take over', () => {
  const root = tmpRoot(undefined);
  const r = upstreamRecordEntries({ root, env: {}, _spawn: fakeGit(['origin/HEAD', 'origin/main']) });
  assert.equal(r.ok, true);
  assert.equal(r.ref, 'origin/HEAD');
  assert.equal(r.stated, false);
});

test('upstreamRecordEntries: a brain.config.json with no memory.upstreamRef — the derived candidates still take over', () => {
  const root = tmpRoot(JSON.stringify({ project: { slug: 'brain' } }));
  const r = upstreamRecordEntries({ root, env: {}, _spawn: fakeGit(['origin/HEAD', 'origin/main']) });
  assert.equal(r.ok, true);
  assert.equal(r.ref, 'origin/HEAD');
  assert.equal(r.stated, false);
});

test('upstreamRecordEntries: env still wins over a config read from root', () => {
  const root = tmpRoot(JSON.stringify({ memory: { upstreamRef: 'origin/from-config' } }));
  const r = upstreamRecordEntries({
    root,
    env: { BRAIN_MEMORY_UPSTREAM_REF: 'origin/from-env' },
    _spawn: fakeGit(['origin/from-env', 'origin/from-config', 'origin/HEAD']),
  });
  assert.equal(r.ok, true);
  assert.equal(r.ref, 'origin/from-env');
});

test('upstreamRecordEntries: _loadConfig is injectable at the layer production calls', () => {
  const r = upstreamRecordEntries({
    root: '/fake',
    env: {},
    _loadConfig: () => ({ memory: { upstreamRef: 'origin/injected' } }),
    _spawn: fakeGit(['origin/injected', 'origin/HEAD']),
  });
  assert.equal(r.ok, true);
  assert.equal(r.ref, 'origin/injected');
  assert.equal(r.stated, true);
});

// ---------------------------------------------------------------------------
// An UNPARSEABLE brain.config.json is "could not look", not "found nothing"
// (`evidence-reader-empty-on-failure`, cold review of #708).
// ---------------------------------------------------------------------------

test('upstreamRecordEntries: a malformed brain.config.json is surfaced — never silently downgraded to a derived ref', () => {
  const root = tmpRoot('{ "memory": { "upstreamRef": "origin/x" ');
  const r = upstreamRecordEntries({ root, env: {}, _spawn: fakeGit(['origin/HEAD', 'origin/main']) });
  assert.equal(r.ok, false, 'a config that could not be parsed must not become origin/HEAD with stated:false');
  assert.equal(r.stated, true);
  assert.equal(r.ref, 'brain.config.json#memory.upstreamRef');
  assert.match(r.reason, /is not valid JSON/);
});

test('upstreamRecordEntries: a brain.config.json that cannot be READ (a directory) is surfaced too', () => {
  const root = mkdtempSync(join(tmpdir(), 'brain-upstream-records-'));
  mkdirSync(join(root, 'brain.config.json'));
  const r = upstreamRecordEntries({ root, env: {}, _spawn: fakeGit(['origin/HEAD', 'origin/main']) });
  assert.equal(r.ok, false);
  assert.equal(r.stated, true);
  assert.match(r.reason, /could not be read/);
});

test('upstreamRecordEntries: a malformed brain.config.json does NOT disable the env escape hatch', () => {
  const root = tmpRoot('}}} not json');
  const r = upstreamRecordEntries({
    root,
    env: { BRAIN_MEMORY_UPSTREAM_REF: 'origin/from-env' },
    _spawn: fakeGit(['origin/from-env']),
  });
  assert.equal(r.ok, true, 'the env level is read before the config, so a broken config cannot block the workaround');
  assert.equal(r.ref, 'origin/from-env');
});

test('resolveUpstreamRef: an explicit `{}` config still means "no stated ref" — it does not trigger a read', () => {
  const root = tmpRoot(JSON.stringify({ memory: { upstreamRef: 'origin/from-config' } }));
  const r = resolveUpstreamRef({
    root,
    env: {},
    config: {},
    _spawn: fakeSpawn(['origin/HEAD', 'origin/main']),
  });
  assert.deepEqual(r, { ref: 'origin/HEAD', stated: false, resolved: true });
});
