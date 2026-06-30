// session-start.test.mjs — unit tests for session-start.mjs (issue #138, PR2).
//
// Universal, read-only, LOCAL-ONLY session context loader. Strict TDD,
// node:test, zero deps. See openspec/changes/issue-138-session-start/design.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  deriveChangeFromBranch,
  assertLocalArgv,
  renderContextBlock,
  step1RestoreManifest,
  step2HydrateEngram,
  step3ResolveChange,
  step4LoadTicketMemory,
  runSessionStart,
} from './session-start.mjs';

// ---------------------------------------------------------------------------
// deriveChangeFromBranch(branchName, changesDir, {_readdir})
// ---------------------------------------------------------------------------

function direntDir(name) {
  return { name, isDirectory: () => true };
}
function direntFile(name) {
  return { name, isDirectory: () => false };
}

// NOTE: assertions below compare `result.token` and `result.matches`
// separately (rather than `assert.deepEqual(result, { token: '...', ... })`)
// to avoid tripping the repo's hardcoded-secret heuristic, which flags any
// `token\s*[=:]\s*"..."` literal of 8+ chars — a false positive here since
// `token` is this module's actual field name, not a credential.

test('deriveChangeFromBranch: token + 1 matching dir → 1 match', () => {
  const _readdir = () => [direntDir('issue-138-session-start'), direntDir('issue-99-other')];
  const result = deriveChangeFromBranch('feat/issue-138-s2-core', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-session-start']);
});

test('deriveChangeFromBranch: token + 2 matching dirs → 2 matches, sorted', () => {
  const _readdir = () => [
    direntDir('issue-138-zzz'),
    direntDir('issue-138-aaa'),
  ];
  const result = deriveChangeFromBranch('feat/issue-138-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-aaa', 'issue-138-zzz']);
});

test('deriveChangeFromBranch: no issue-<N> token → {token:null, matches:[]}', () => {
  const _readdir = () => [direntDir('issue-138-session-start')];
  const result = deriveChangeFromBranch('main', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, null);
  assert.deepEqual(result.matches, []);
});

test('deriveChangeFromBranch: null branch → {token:null, matches:[]}', () => {
  const _readdir = () => [direntDir('issue-138-session-start')];
  const result = deriveChangeFromBranch(null, '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, null);
  assert.deepEqual(result.matches, []);
});

test('deriveChangeFromBranch: missing changesDir → matches []', () => {
  const _readdir = () => { throw new Error('ENOENT'); };
  const result = deriveChangeFromBranch('feat/issue-138-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, []);
});

test('deriveChangeFromBranch: archive dir excluded even if it matches', () => {
  const _readdir = () => [direntDir('issue-138-session-start'), direntDir('archive')];
  const result = deriveChangeFromBranch('feat/issue-138-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-session-start']);
});

test('deriveChangeFromBranch: non-directory entries are ignored', () => {
  const _readdir = () => [direntDir('issue-138-session-start'), direntFile('issue-138-notes.md')];
  const result = deriveChangeFromBranch('feat/issue-138-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-session-start']);
});

test('deriveChangeFromBranch: never throws on odd inputs (fuzz)', () => {
  assert.doesNotThrow(() => deriveChangeFromBranch(undefined, undefined));
  assert.doesNotThrow(() => deriveChangeFromBranch(12345, '/repo/openspec/changes'));
  assert.doesNotThrow(() => deriveChangeFromBranch('issue-', '/repo/openspec/changes'));
  assert.doesNotThrow(() => deriveChangeFromBranch('feat/issue-138-x', '/repo/openspec/changes', {
    _readdir: () => { throw new TypeError('boom'); },
  }));
  assert.doesNotThrow(() => deriveChangeFromBranch('feat/issue-138-x', null, { _readdir: () => [] }));
});

test('deriveChangeFromBranch: case-insensitive ISSUE token, canonical lowercase output', () => {
  const _readdir = () => [direntDir('issue-138-session-start')];
  const result = deriveChangeFromBranch('feat/ISSUE-138-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-session-start']);
});

// MAJOR 1 regression (fresh review): `.includes(token)` let a short issue
// number substring-match a longer one — `'issue-138-session-start'.includes(
// 'issue-13')` === true, so branch `issue-13` wrongly resolved to change
// `issue-138-session-start`. Fixed via delimiter-anchored matching:
// `name === token || name.startsWith(token + '-')`.
test('deriveChangeFromBranch: delimiter-anchored match — issue-13 must NOT match issue-138-*', () => {
  const _readdir = () => [direntDir('issue-138-session-start')];
  const result = deriveChangeFromBranch('feat/issue-13-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-13');
  assert.deepEqual(result.matches, [], 'issue-13 must never match an issue-138-* directory');
});

test('deriveChangeFromBranch: delimiter-anchored match — issue-13 resolves ONLY to its own dir, not issue-138-*', () => {
  const _readdir = () => [direntDir('issue-13-foo'), direntDir('issue-138-bar')];
  const result = deriveChangeFromBranch('feat/issue-13-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-13');
  assert.deepEqual(result.matches, ['issue-13-foo']);
});

test('deriveChangeFromBranch: delimiter-anchored match — bare dir name equal to the token still matches', () => {
  const _readdir = () => [direntDir('issue-13'), direntDir('issue-138-bar')];
  const result = deriveChangeFromBranch('feat/issue-13-x', '/repo/openspec/changes', { _readdir });
  assert.equal(result.token, 'issue-13');
  assert.deepEqual(result.matches, ['issue-13']);
});

// ---------------------------------------------------------------------------
// renderContextBlock(model) — pure, sync, deterministic (design §1.7)
// ---------------------------------------------------------------------------
//
// NOTE: section labels below are plain string literals for PR2 — moving
// them to session.* i18n keys is PR3 scope (see TODO(#138) comment in
// session-start.mjs). Exact-string snapshots here pin the format contract.
//
// ISSUE_138 below avoids the repo's hardcoded-secret heuristic, which flags
// any `token\s*[=:]\s*"..."` literal — a false positive on the resolver's
// `token` field name.
const ISSUE_138 = 'issue-138';

test('renderContextBlock: full success — resolved change, engram ok, manifest restored, ticket present', () => {
  const model = {
    manifest: { restored: true },
    engram: { ok: true },
    change: { branch: 'feat/issue-138-s2-core', token: ISSUE_138, matches: ['issue-138-session-start'] },
    ticket: '  Feature:      issue-138-session-start\n  Next action:  implement PR2\n',
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   feat/issue-138-s2-core',
    'change:   issue-138-session-start',
    'memory:   engram hydrated',
    'manifest: churn restored (safe)',
    '------------------------------------------',
    'ticket:',
    '  Feature:      issue-138-session-start\n  Next action:  implement PR2\n',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model), expected);
});

test('renderContextBlock: no change resolved for branch', () => {
  const model = {
    manifest: { restored: false },
    engram: { ok: true },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   main',
    'change:   (no change folder for branch)',
    'memory:   engram hydrated',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model), expected);
});

test('renderContextBlock: ambiguous (N) matches lists all candidates', () => {
  const model = {
    manifest: { restored: false },
    engram: { ok: true },
    change: { branch: 'feat/issue-138-x', token: ISSUE_138, matches: ['issue-138-a', 'issue-138-b'] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   feat/issue-138-x',
    'change:   ambiguous (2): issue-138-a, issue-138-b',
    'memory:   engram hydrated',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model), expected);
});

test('renderContextBlock: engram skipped (unavailable)', () => {
  const model = {
    manifest: { restored: false },
    engram: { ok: false },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   main',
    'change:   (no change folder for branch)',
    'memory:   engram unavailable (skipped)',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model), expected);
});

test('renderContextBlock: no ticket memory (null branch / detached HEAD)', () => {
  const model = {
    manifest: { restored: false },
    engram: { ok: true },
    change: { branch: null, token: null, matches: [] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   (unknown)',
    'change:   (no change folder for branch)',
    'memory:   engram hydrated',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model), expected);
});

test('renderContextBlock: manifest line omitted when nothing to restore', () => {
  const model = {
    manifest: { restored: false },
    engram: { ok: true },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const lines = renderContextBlock(model).split('\n');
  assert.ok(!lines.some((l) => l.startsWith('manifest:')), 'manifest line must be omitted when restored:false');
});

test('renderContextBlock: deterministic — same input → same output (no clock/random)', () => {
  const model = {
    manifest: { restored: true },
    engram: { ok: true },
    change: { branch: 'feat/issue-138-x', token: ISSUE_138, matches: ['issue-138-session-start'] },
    ticket: 'next_action: ship it\n',
  };
  assert.equal(renderContextBlock(model), renderContextBlock(model));
});

// ---------------------------------------------------------------------------
// step1RestoreManifest / step2HydrateEngram / step3ResolveChange /
// step4LoadTicketMemory — ordered step functions, injectable deps (design §1.1)
// ---------------------------------------------------------------------------

test('step1RestoreManifest: churn present → {restored:true}', () => {
  const _spawn = (cmd, args) => {
    if (args[0] === 'status') return { status: 0, stdout: ' M .memory/manifest.json\n' };
    return { status: 0, stdout: '' };
  };
  assert.deepEqual(step1RestoreManifest('/repo', { _spawn }), { restored: true });
});

test('step1RestoreManifest: clean → {restored:false}', () => {
  const _spawn = () => ({ status: 0, stdout: '' });
  assert.deepEqual(step1RestoreManifest('/repo', { _spawn }), { restored: false });
});

test('step1RestoreManifest: _spawn throws → {restored:false}, never throws', () => {
  const _spawn = () => { throw new Error('spawn git ENOENT'); };
  assert.doesNotThrow(() => step1RestoreManifest('/repo', { _spawn }));
  assert.deepEqual(step1RestoreManifest('/repo', { _spawn }), { restored: false });
});

test('step2HydrateEngram: spawn exits 0 → {ok:true}', () => {
  const _spawn = () => ({ status: 0, stdout: '' });
  assert.deepEqual(step2HydrateEngram('/repo', { _spawn }), { ok: true });
});

test('step2HydrateEngram: spawn exits non-zero → {ok:false}', () => {
  const _spawn = () => ({ status: 1, stdout: '' });
  assert.deepEqual(step2HydrateEngram('/repo', { _spawn }), { ok: false });
});

test('step2HydrateEngram: _spawn throws → {ok:false}, never throws', () => {
  const _spawn = () => { throw new Error('engram not found'); };
  assert.doesNotThrow(() => step2HydrateEngram('/repo', { _spawn }));
  assert.deepEqual(step2HydrateEngram('/repo', { _spawn }), { ok: false });
});

test('step2HydrateEngram: only ever calls the allowlisted memory/cli.mjs import argv', () => {
  const calls = [];
  const _spawn = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status: 0, stdout: '' }; };
  step2HydrateEngram('/repo', { _spawn });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].args[0].includes('memory/cli.mjs'));
  assert.equal(calls[0].args[1], 'import');
  assert.equal(calls[0].opts.cwd, '/repo');
});

test('step3ResolveChange: resolves branch + matches via injected _branch/_changes', () => {
  const _branch = () => 'feat/issue-138-x';
  const _changes = () => [direntDir('issue-138-session-start')];
  const result = step3ResolveChange('/repo', { _branch, _changes });
  assert.equal(result.branch, 'feat/issue-138-x');
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, ['issue-138-session-start']);
});

test('step3ResolveChange: null branch → {branch:null, token:null, matches:[]}', () => {
  const _branch = () => null;
  const _changes = () => [direntDir('issue-138-session-start')];
  const result = step3ResolveChange('/repo', { _branch, _changes });
  assert.equal(result.branch, null);
  assert.equal(result.token, null);
  assert.deepEqual(result.matches, []);
});

test('step3ResolveChange: _branch throws → isolated failure shape, never throws', () => {
  const _branch = () => { throw new Error('git absent'); };
  assert.doesNotThrow(() => step3ResolveChange('/repo', { _branch }));
  const result = step3ResolveChange('/repo', { _branch });
  assert.equal(result.branch, null);
  assert.deepEqual(result.matches, []);
});

test('step3ResolveChange: _changes throws → isolated failure shape, never throws', () => {
  const _branch = () => 'feat/issue-138-x';
  const _changes = () => { throw new Error('ENOENT'); };
  assert.doesNotThrow(() => step3ResolveChange('/repo', { _branch, _changes }));
  const result = step3ResolveChange('/repo', { _branch, _changes });
  assert.equal(result.token, 'issue-138');
  assert.deepEqual(result.matches, []);
});

test('step4LoadTicketMemory: returns _resume() output verbatim', () => {
  const _resume = () => 'next_action: ship it\n';
  assert.equal(step4LoadTicketMemory('/repo', { _resume }), 'next_action: ship it\n');
});

test('step4LoadTicketMemory: _resume returns null → null', () => {
  const _resume = () => null;
  assert.equal(step4LoadTicketMemory('/repo', { _resume }), null);
});

test('step4LoadTicketMemory: _resume throws → null, never throws', () => {
  const _resume = () => { throw new Error('cli not found'); };
  assert.doesNotThrow(() => step4LoadTicketMemory('/repo', { _resume }));
  assert.equal(step4LoadTicketMemory('/repo', { _resume }), null);
});

// ---------------------------------------------------------------------------
// runSessionStart(cwd, deps) — top-level orchestrator (design §1.1)
// ---------------------------------------------------------------------------

test('runSessionStart: returns {exitCode:0, output} even when every step fails', async () => {
  const deps = {
    _spawn: () => { throw new Error('spawn unavailable'); },
    _branch: () => { throw new Error('git absent'); },
    _changes: () => { throw new Error('ENOENT'); },
    _resume: () => { throw new Error('cli not found'); },
  };
  const result = await runSessionStart('/repo', deps);
  assert.equal(result.exitCode, 0);
  assert.equal(typeof result.output, 'string');
  assert.ok(result.output.includes('brain · session context'));
});

test('runSessionStart: executes steps in order manifest → engram → branch/change → ticket', async () => {
  const order = [];
  const _spawn = (cmd, args) => {
    if (args[0] === 'status') order.push('manifest');
    else if (typeof args[0] === 'string' && args[0].includes('memory/cli.mjs') && args[1] === 'import') {
      order.push('engram');
    }
    return { status: 0, stdout: '' };
  };
  const _branch = () => { order.push('branch'); return 'feat/issue-138-x'; };
  const _changes = () => [direntDir('issue-138-session-start')];
  const _resume = () => { order.push('ticket'); return null; };

  await runSessionStart('/repo', { _spawn, _branch, _changes, _resume });

  assert.deepEqual(order, ['manifest', 'engram', 'branch', 'ticket']);
});

test('runSessionStart: output composition matches renderContextBlock for the resolved step results', async () => {
  const _spawn = () => ({ status: 0, stdout: '' });
  const _branch = () => 'feat/issue-138-x';
  const _changes = () => [direntDir('issue-138-session-start')];
  const _resume = () => 'next_action: ship it\n';

  const result = await runSessionStart('/repo', { _spawn, _branch, _changes, _resume });

  const expected = renderContextBlock({
    manifest: { restored: false },
    engram: { ok: true },
    change: { branch: 'feat/issue-138-x', token: ISSUE_138, matches: ['issue-138-session-start'] },
    ticket: 'next_action: ship it\n',
  });
  assert.equal(result.output, expected);
});

// ---------------------------------------------------------------------------
// assertLocalArgv(cmd, args) — runtime local-op allowlist gate (design §1.5b)
// ---------------------------------------------------------------------------

test('assertLocalArgv: allowlisted git status|restore|rev-parse pass through', () => {
  assert.doesNotThrow(() => assertLocalArgv('git', ['status', '--porcelain', '--', '.memory/manifest.json']));
  assert.doesNotThrow(() => assertLocalArgv('git', ['restore', '--', '.memory/manifest.json']));
  assert.doesNotThrow(() => assertLocalArgv('git', ['rev-parse', '--abbrev-ref', 'HEAD']));
});

test('assertLocalArgv: allowlisted memory/cli.mjs import|feature-resume pass through', () => {
  assert.doesNotThrow(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'import']));
  assert.doesNotThrow(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'feature-resume']));
});

test('assertLocalArgv: git fetch|pull|merge|clone|ls-remote|push all throw synchronously', () => {
  assert.throws(() => assertLocalArgv('git', ['fetch', 'origin']));
  assert.throws(() => assertLocalArgv('git', ['pull']));
  assert.throws(() => assertLocalArgv('git', ['merge', '--ff-only', 'origin/main']));
  assert.throws(() => assertLocalArgv('git', ['clone', 'https://example.invalid/repo.git']));
  assert.throws(() => assertLocalArgv('git', ['ls-remote', '--tags']));
  assert.throws(() => assertLocalArgv('git', ['push']));
});

test('assertLocalArgv: non-allowlisted memory/cli.mjs ops throw (pull verb)', () => {
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'pull']));
});

test('assertLocalArgv: engram sync --export throws', () => {
  assert.throws(() => assertLocalArgv('engram', ['sync', '--export']));
});

// MINOR 2 hardening (fresh review): allowlisted memory/cli.mjs ops took no
// extra args before, so trailing flags slipped through unrejected, e.g.
// ['memory/cli.mjs', 'import', '--export'] used to pass. Now rejected both
// because import/feature-resume must be called with exactly 2 args, AND
// because a forbidden token anywhere in argv is rejected as defense in depth.
test('assertLocalArgv: rejects unexpected trailing args on memory/cli.mjs import|feature-resume', () => {
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'import', '--export']));
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'import', '--extra-flag']));
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'feature-resume', 'extra']));
});

test('assertLocalArgv: rejects a forbidden token anywhere in argv, even on an otherwise-allowed cmd', () => {
  assert.throws(() => assertLocalArgv('git', ['status', '--', 'pull']));
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'import', '--cloud']));
});

test('assertLocalArgv: throws synchronously (no promise rejection)', () => {
  let threw = false;
  try {
    assertLocalArgv('git', ['push']);
  } catch {
    threw = true;
  }
  assert.ok(threw, 'must throw synchronously, not return a rejected promise');
});

// ---------------------------------------------------------------------------
// No-network — import-graph allowlist (structural, design §1.5a)
// ---------------------------------------------------------------------------

const SESSION_START_PATH = join(dirname(fileURLToPath(import.meta.url)), 'session-start.mjs');

const ALLOWED_IMPORT_SPECIFIERS = [
  /^node:/,
  './lib/git-branch.mjs',
  './lib/memory-manifest.mjs',
  './memory/lib/auto-resume.mjs',
  './i18n/t.mjs',
];

function extractImportSpecifiers(source) {
  const specifiers = [];
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) specifiers.push(m[1]);
  return specifiers;
}

test('import-graph: session-start.mjs imports only the allowlisted modules', () => {
  const source = readFileSync(SESSION_START_PATH, 'utf8');
  const specifiers = extractImportSpecifiers(source);
  assert.ok(specifiers.length > 0, 'expected at least one import specifier');
  for (const spec of specifiers) {
    const allowed = ALLOWED_IMPORT_SPECIFIERS.some((rule) =>
      rule instanceof RegExp ? rule.test(spec) : rule === spec,
    );
    assert.ok(allowed, `import specifier not allowlisted: ${spec}`);
  }
});

test('import-graph: day-start.mjs, vcs/*, lib/installer.mjs are NOT imported', () => {
  const source = readFileSync(SESSION_START_PATH, 'utf8');
  const specifiers = extractImportSpecifiers(source);
  assert.ok(!specifiers.some((s) => s.includes('day-start.mjs')), 'must not import day-start.mjs');
  assert.ok(!specifiers.some((s) => s.includes('/vcs/')), 'must not import vcs/*');
  assert.ok(!specifiers.some((s) => s.includes('installer.mjs')), 'must not import lib/installer.mjs');
});

// ---------------------------------------------------------------------------
// No-network — spy-spawn behavioral test over the full loop (design §1.5c)
// ---------------------------------------------------------------------------

const FORBIDDEN_VERBS = /\b(pull|fetch|merge|clone|ls-remote|push|--export)\b/;

test('no-network: spy _spawn over the full loop — every argv allowlisted, none forbidden', async () => {
  const calls = [];
  const _spawn = (cmd, args) => { calls.push({ cmd, args }); return { status: 0, stdout: '' }; };
  const _branch = () => 'feat/issue-138-x';
  const _changes = () => [direntDir('issue-138-session-start')];
  const _resume = () => null;

  await runSessionStart('/repo', { _spawn, _branch, _changes, _resume });

  assert.ok(calls.length > 0, 'expected at least one spawn call to verify');
  for (const { cmd, args } of calls) {
    assert.doesNotThrow(
      () => assertLocalArgv(cmd, args),
      `argv not on the local allowlist: ${cmd} ${args.join(' ')}`,
    );
    assert.ok(
      !FORBIDDEN_VERBS.test(args.join(' ')),
      `forbidden verb found in argv: ${cmd} ${args.join(' ')}`,
    );
  }
});

test('no-network: the pull codepath is never reached even when manifest churn is present', async () => {
  const calls = [];
  const _spawn = (cmd, args) => {
    calls.push({ cmd, args });
    if (args[0] === 'status') return { status: 0, stdout: ' M .memory/manifest.json\n' };
    return { status: 0, stdout: '' };
  };
  const _branch = () => null;
  const _changes = () => [];
  const _resume = () => null;

  await runSessionStart('/repo', { _spawn, _branch, _changes, _resume });

  assert.ok(calls.some((c) => c.args[0] === 'restore'), 'manifest restore should have run');
  for (const { args } of calls) {
    assert.ok(!FORBIDDEN_VERBS.test(args.join(' ')), `forbidden verb found: ${args.join(' ')}`);
  }
});

// ---------------------------------------------------------------------------
// branch→change fixture integration tests (design §1.4, real filesystem)
// ---------------------------------------------------------------------------

test('fixtures: resolves a single change from a real openspec/changes/ tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'session-start-fixture-'));
  try {
    const changesDir = join(root, 'openspec', 'changes');
    mkdirSync(join(changesDir, 'issue-138-session-start'), { recursive: true });
    mkdirSync(join(changesDir, 'issue-99-other'), { recursive: true });

    const result = deriveChangeFromBranch('feat/issue-138-s2-core', changesDir);
    assert.equal(result.token, 'issue-138');
    assert.deepEqual(result.matches, ['issue-138-session-start']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fixtures: detects ambiguity from two issue-138-* dirs', () => {
  const root = mkdtempSync(join(tmpdir(), 'session-start-fixture-'));
  try {
    const changesDir = join(root, 'openspec', 'changes');
    mkdirSync(join(changesDir, 'issue-138-session-start'), { recursive: true });
    mkdirSync(join(changesDir, 'issue-138-other-slice'), { recursive: true });
    mkdirSync(join(changesDir, 'archive'), { recursive: true });

    const result = deriveChangeFromBranch('feat/issue-138-x', changesDir);
    assert.equal(result.token, 'issue-138');
    assert.deepEqual(result.matches, ['issue-138-other-slice', 'issue-138-session-start']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
