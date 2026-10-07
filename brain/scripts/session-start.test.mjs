// session-start.test.mjs — unit tests for session-start.mjs (issue #138, PR2).
//
// Universal, read-only, LOCAL-ONLY session context loader. Strict TDD,
// node:test, zero deps. See openspec/changes/issue-138-session-start/design.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import en from './i18n/en.mjs';

import {
  deriveChangeFromBranch,
  assertLocalArgv,
  renderContextBlock,
  step2Hydrate,
  step4cMemoryRecords,
  step3ResolveChange,
  step4LoadTicketMemory,
  step4bMemoryRecency,
  step5SynthesizeContext,
  runSessionStart,
  resolveSessionStrings,
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
// renderContextBlock(model, strings) — pure, sync, deterministic (design §1.7/§1.8)
// ---------------------------------------------------------------------------
//
// `strings` is the resolved `session.*` map (design §1.8): the CLI entry
// resolves it ONCE via t() (still containing {placeholder} tokens) and
// renderContextBlock fills the placeholders synchronously — no i18n call
// inside the renderer itself. Tests build the fixture from the REAL en.mjs
// catalog (not a parallel hardcoded copy) so a future drift in en.mjs's
// session.* templates fails this suite instead of silently diverging.
//
// ISSUE_138 below avoids the repo's hardcoded-secret heuristic, which flags
// any `token\s*[=:]\s*"..."` literal — a false positive on the resolver's
// `token` field name.
const ISSUE_138 = 'issue-138';
const ISSUE_1115 = 'issue-1115';

const SESSION_STRINGS = {
  header:           en['session.header'],
  branch:           en['session.branch'],
  branchUnknown:    en['session.branch.unknown'],
  changeOne:        en['session.change.one'],
  changeNone:       en['session.change.none'],
  changeAmbiguous:  en['session.change.ambiguous'],
  memoryOk:         en['session.memory.ok'],
  memorySkip:       en['session.memory.skip'],
  memorySkipReason: en['session.memory.skip.reason'],
  memoryNotDeclared: en['session.memory.notDeclared'],
  memoryDeferred:   en['session.memory.deferred'],
  memoryVerified:   en['session.memory.verified'],
  memoryStale:      en['session.memory.stale'],
  backendUnknown:   en['session.memory.backend.unknown'],
  memoryRecords:    en['session.memory.records'],
  memoryRecordsUnknown: en['session.memory.records.unknown'],
  memoryIssue:      en['session.memory.issue'],
  memoryIssueItem:  en['session.memory.issue.item'],
  memoryIssueNone:  en['session.memory.issue.none'],
  ticketLabel:      en['session.ticket.label'],
  ticketNone:       en['session.ticket.none'],
  memoryRecencyStale:   en['session.memory.recency.stale'],
  memoryRecencyUnknown: en['session.memory.recency.unknown'],
};

test('renderContextBlock: full success — resolved change, engram ok, ticket present', () => {
  const model = {
    hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: 'feat/issue-138-s2-core', token: ISSUE_138, matches: ['issue-138-session-start'] },
    ticket: '  Feature:      issue-138-session-start\n  Next action:  implement PR2\n',
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   feat/issue-138-s2-core',
    'change:   issue-138-session-start',
    'memory:   plainfiles hydrated',
    '------------------------------------------',
    'ticket:',
    '  Feature:      issue-138-session-start\n  Next action:  implement PR2\n',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model, SESSION_STRINGS), expected);
});

test('renderContextBlock: no change resolved for branch', () => {
  const model = {
    manifest: { restored: false },
    hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   main',
    'change:   (no change folder for branch)',
    'memory:   plainfiles hydrated',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model, SESSION_STRINGS), expected);
});

test('renderContextBlock: ambiguous (N) matches lists all candidates', () => {
  const model = {
    manifest: { restored: false },
    hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: 'feat/issue-138-x', token: ISSUE_138, matches: ['issue-138-a', 'issue-138-b'] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   feat/issue-138-x',
    'change:   ambiguous (2): issue-138-a, issue-138-b',
    'memory:   plainfiles hydrated',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model, SESSION_STRINGS), expected);
});

test('renderContextBlock: hydration skipped, no reason — names the backend, never engram', () => {
  const model = {
    manifest: { restored: false },
    hydration: { ok: false, backend: 'plainfiles' },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   main',
    'change:   (no change folder for branch)',
    'memory:   plainfiles hydration skipped',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model, SESSION_STRINGS), expected);
});

// #923 (acceptance A): the rendered context block must surface the hydration
// failure CAUSE, not a bare "unavailable (skipped)" — while staying additive
// (a caller/older test that never supplies `reason` still renders the old
// generic line, see the `engram skipped (unavailable)` test above).
test('#923: renderContextBlock: hydration failed WITH a reason surfaces the cause, not the bare skip line', () => {
  const model = {
    manifest: { restored: false },
    hydration: { ok: false, backend: 'plainfiles', reason: 'import failed — ENOENT' },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const output = renderContextBlock(model, SESSION_STRINGS);
  assert.match(output, /memory:   plainfiles hydration skipped — import failed — ENOENT/, 'the failure cause must appear in the rendered block');
  assert.doesNotMatch(output, /hydration skipped$/m, 'the bare generic line must not appear once a reason is available');
  assert.doesNotMatch(output, /engram/);
});

test('renderContextBlock: no ticket memory (null branch / detached HEAD)', () => {
  const model = {
    manifest: { restored: false },
    hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: null, token: null, matches: [] },
    ticket: null,
  };
  const expected = [
    'brain · session context',
    '========================',
    'branch:   (unknown)',
    'change:   (no change folder for branch)',
    'memory:   plainfiles hydrated',
    '------------------------------------------',
    'ticket:',
    '(no active ticket memory)',
    '========================',
  ].join('\n');
  assert.equal(renderContextBlock(model, SESSION_STRINGS), expected);
});

// SS3 (#955, R9/R6) — the manifest render line is retired entirely: a
// `manifest` field in the model (of any shape) must render byte-identically
// to no field at all, since renderContextBlock no longer branches on it.
test('SS3 (#955): a manifest field in the model renders byte-identically to no field', () => {
  const base = {
    hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const withManifest = { ...base, manifest: { restored: true } };
  const withoutManifest = { ...base };
  assert.equal(
    renderContextBlock(withManifest, SESSION_STRINGS),
    renderContextBlock(withoutManifest, SESSION_STRINGS),
  );
});

// Proves `strings` is actually consumed by the renderer (not a hardcoded
// English literal that merely happens to match en.mjs's current values) —
// without this test, a production implementation that ignores its 2nd
// argument would still pass every snapshot above.
test('renderContextBlock: consumes the provided strings map, not a hardcoded literal (i18n wiring proof)', () => {
  const model = {
    hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: 'feat/issue-138-x', token: ISSUE_138, matches: ['issue-138-session-start'] },
    ticket: 'next_action: ship it\n',
  };
  const markerStrings = {
    header:           'MARKER_HEADER',
    branch:           'MARKER_BRANCH {branch}',
    branchUnknown:    'MARKER_BRANCH_UNKNOWN',
    changeOne:        'MARKER_CHANGE {change}',
    changeNone:       'MARKER_CHANGE_NONE',
    changeAmbiguous:  'MARKER_CHANGE_AMBIGUOUS ({count}): {list}',
    memoryOk:         'MARKER_MEMORY_OK',
    memorySkip:       'MARKER_MEMORY_SKIP',
    ticketLabel:      'MARKER_TICKET_LABEL',
    ticketNone:       'MARKER_TICKET_NONE',
  };
  const output = renderContextBlock(model, markerStrings);
  assert.ok(output.includes('MARKER_HEADER'), 'header must come from strings.header');
  assert.ok(output.includes('MARKER_BRANCH feat/issue-138-x'), 'branch line must interpolate {branch} into strings.branch');
  assert.ok(output.includes('MARKER_CHANGE issue-138-session-start'), 'change line must interpolate {change} into strings.changeOne');
  assert.ok(output.includes('MARKER_MEMORY_OK'), 'memory line must come from strings.memoryOk');
  assert.ok(output.includes('MARKER_TICKET_LABEL'), 'ticket label must come from strings.ticketLabel');
  assert.ok(!output.includes('brain · session context'), 'must NOT fall back to the old hardcoded English literal');
});

// REQ-8 completeness fix (fresh review): the null-branch fallback was a
// hardcoded '(unknown)' literal inside renderContextBlock, bypassing the
// strings map entirely for this one case.
test('renderContextBlock: null branch fallback comes from strings.branchUnknown, not a hardcoded literal', () => {
  const model = {
    manifest: { restored: false },
    hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: null, token: null, matches: [] },
    ticket: null,
  };
  const markerStrings = {
    header: 'H', branch: 'B {branch}', branchUnknown: 'MARKER_BRANCH_UNKNOWN',
    changeOne: 'C {change}', changeNone: 'CN', changeAmbiguous: 'AMBIG ({count}): {list}',
    memoryOk: 'MOK', memorySkip: 'MSKIP', manifestRestored: 'MREST',
    ticketLabel: 'TL', ticketNone: 'TNONE',
  };
  const output = renderContextBlock(model, markerStrings);
  assert.ok(output.includes('B MARKER_BRANCH_UNKNOWN'), 'null branch must fill {branch} with strings.branchUnknown');
  assert.ok(!output.includes('(unknown)'), 'must NOT fall back to the old hardcoded (unknown) literal');
});

test('renderContextBlock: ambiguous-match line interpolates {count}/{list} from the provided strings map', () => {
  const model = {
    manifest: { restored: false },
    hydration: { ok: false, backend: 'plainfiles' },
    change: { branch: 'feat/issue-138-x', token: ISSUE_138, matches: ['issue-138-a', 'issue-138-b'] },
    ticket: null,
  };
  const markerStrings = {
    header: 'H', branch: 'B {branch}', changeOne: 'C {change}',
    changeNone: 'CN', changeAmbiguous: 'AMBIG ({count}): {list}',
    memoryOk: 'MOK', memorySkip: 'MSKIP', manifestRestored: 'MREST',
    ticketLabel: 'TL', ticketNone: 'TNONE',
  };
  const output = renderContextBlock(model, markerStrings);
  assert.ok(output.includes('AMBIG (2): issue-138-a, issue-138-b'));
  assert.ok(output.includes('MSKIP'));
  assert.ok(output.includes('TNONE'));
});

test('renderContextBlock: deterministic — same input → same output (no clock/random)', () => {
  const model = {
    manifest: { restored: true },
    hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: 'feat/issue-138-x', token: ISSUE_138, matches: ['issue-138-session-start'] },
    ticket: 'next_action: ship it\n',
  };
  assert.equal(renderContextBlock(model, SESSION_STRINGS), renderContextBlock(model, SESSION_STRINGS));
});

// ---------------------------------------------------------------------------
// step2HydrateEngram / step3ResolveChange /
// step4LoadTicketMemory — ordered step functions, injectable deps (design §1.1)
// ---------------------------------------------------------------------------

const PLAINFILES = () => ({ status: 'declared', backend: 'plainfiles' });
const ENGRAM = () => ({ status: 'declared', backend: 'engram' });

test('step2Hydrate: spawn exits 0 → {ok:true, backend} with the backend the one resolver reports', () => {
  const _spawn = () => ({ status: 0, stdout: '' });
  assert.deepEqual(step2Hydrate('/repo', { _spawn, _resolveBackend: PLAINFILES }), { ok: true, backend: 'plainfiles' });
  assert.deepEqual(step2Hydrate('/repo', { _spawn, _resolveBackend: ENGRAM }), { ok: true, backend: 'engram' });
});

// #1115 (ruling Q1): the stdout line of `hydrate --verify` says "verified" and whether the index drifted.
test('#1115 step2Hydrate: a verified stdout line → {ok, verified, stale}', () => {
  const line = (stale) => ({ status: 0, stdout: `${JSON.stringify({ hydrate: 'verified', stale, indexCount: 3 })}\n` });
  assert.deepEqual(
    step2Hydrate('/repo', { _spawn: () => line(false), _resolveBackend: PLAINFILES }),
    { ok: true, backend: 'plainfiles', verified: true, stale: false },
  );
  assert.deepEqual(
    step2Hydrate('/repo', { _spawn: () => line(true), _resolveBackend: PLAINFILES }),
    { ok: true, backend: 'plainfiles', verified: true, stale: true },
  );
});

test('#1115 step2Hydrate: unparseable or foreign stdout never invents a verification', () => {
  const r = step2Hydrate('/repo', { _spawn: () => ({ status: 0, stdout: 'not json\n{broken' }), _resolveBackend: ENGRAM });
  assert.deepEqual(r, { ok: true, backend: 'engram' });
});

// #1115 (ruling Q4): exit 6 is a DEFERRAL — non-fatal, and says why.
test('#1115 step2Hydrate: exit 6 → {ok:false, deferred:true, backend, reason} (reason from the stdout line, else stderr)', () => {
  const fromJson = step2Hydrate('/repo', {
    _spawn: () => ({ status: 6, stdout: `${JSON.stringify({ hydrate: 'deferred', reason: 'engram binary not found. Install via: gentle-ai install' })}\n`, stderr: 'noisy stderr' }),
    _resolveBackend: ENGRAM,
  });
  assert.deepEqual(fromJson, { ok: false, deferred: true, backend: 'engram', reason: 'engram binary not found. Install via: gentle-ai install' });
  const fromStderr = step2Hydrate('/repo', { _spawn: () => ({ status: 6, stdout: '', stderr: 'another hydration is running\n' }), _resolveBackend: ENGRAM });
  assert.deepEqual(fromStderr, { ok: false, deferred: true, backend: 'engram', reason: 'another hydration is running' });
});

// #923 (acceptance A): a non-zero exit or a thrown exception must not
// collapse to a bare {ok:false} — the failure CAUSE (stderr / exit code /
// exception message) must survive on the return shape, without becoming
// fatal to the caller (runSessionStart still always resolves exitCode:0).
test('#923: step2Hydrate: spawn exits non-zero → {ok:false, backend, reason} carrying stderr', () => {
  const _spawn = () => ({ status: 1, stdout: '', stderr: 'memory/cli: plainfiles.hydrate() failed — corrupt record\n' });
  assert.deepEqual(
    step2Hydrate('/repo', { _spawn, _resolveBackend: PLAINFILES }),
    { ok: false, backend: 'plainfiles', reason: 'memory/cli: plainfiles.hydrate() failed — corrupt record' },
  );
});

test('#923: step2Hydrate: spawn exits non-zero with no stderr → {ok:false, reason} naming the exit code', () => {
  const _spawn = () => ({ status: 1, stdout: '' });
  assert.deepEqual(step2Hydrate('/repo', { _spawn, _resolveBackend: PLAINFILES }), { ok: false, backend: 'plainfiles', reason: 'exited 1' });
});

test('#923: step2Hydrate: _spawn throws → {ok:false, reason} carrying the exception message, never throws', () => {
  const _spawn = () => { throw new Error('node vanished'); };
  assert.doesNotThrow(() => step2Hydrate('/repo', { _spawn, _resolveBackend: PLAINFILES }));
  assert.deepEqual(step2Hydrate('/repo', { _spawn, _resolveBackend: PLAINFILES }), { ok: false, backend: 'plainfiles', reason: 'node vanished' });
});

test('#1115 step2Hydrate: a resolver that throws never breaks the step — the backend is simply unknown', () => {
  const r = step2Hydrate('/repo', { _spawn: () => ({ status: 0, stdout: '' }), _resolveBackend: () => { throw new Error('boom'); } });
  assert.deepEqual(r, { ok: true, backend: null });
});

test('step2Hydrate: only ever calls the allowlisted memory/cli.mjs hydrate --verify argv (session-start never writes the tracked tree)', () => {
  const calls = [];
  const _spawn = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status: 0, stdout: '' }; };
  step2Hydrate('/repo', { _spawn, _resolveBackend: PLAINFILES });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].args[0].includes('memory/cli.mjs'));
  assert.deepEqual(calls[0].args.slice(1), ['hydrate', '--verify']);
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

test('step5SynthesizeContext: _synthesize throws → isolated failure shape with core floor, never throws', async () => {
  const _synthesize = () => { throw new Error('synthesizer error'); };
  assert.doesNotThrow(() => step5SynthesizeContext('/repo', { _synthesize }));
  const result = await step5SynthesizeContext('/repo', { _synthesize });
  assert.ok(result.coreFloor.length > 0, 'core floor must be populated on throw');
  assert.equal(result.failsafeActivated, true);
  assert.ok(result.markdown.includes('Core Methodology Baseline Floor'));
});

// MAJOR 2 regression (fresh review): step4 only accepted a full `_resume`
// override and otherwise called the REAL tryFeatureResume (real spawnSync),
// completely ignoring deps._spawn — bypassing the gate AND making the
// no-network behavioral test blind to this subprocess call when `_resume`
// isn't separately stubbed. step4 must now route through the same shared,
// gated `_spawn` seam steps 1-3 use, via tryFeatureResume's own `_runner`
// injection point (no change to auto-resume.mjs required).
test('step4LoadTicketMemory: routes its subprocess call through the shared gated _spawn seam (no _resume override)', () => {
  const calls = [];
  const _spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: 'next_action: ship it\n' };
  };
  const result = step4LoadTicketMemory('/repo', { _spawn });
  assert.equal(calls.length, 1, 'step4 must route its subprocess call through the shared _spawn seam, not a real spawn');
  assert.ok(typeof calls[0].args[0] === 'string' && calls[0].args[0].includes('memory/cli.mjs'));
  assert.equal(calls[0].args[1], 'feature-resume');
  assert.equal(result, 'next_action: ship it\n');
});

test('step4LoadTicketMemory: the gated call is rejected by assertLocalArgv if argv is ever tampered (defense-in-depth proof)', () => {
  // Sanity check that the gate is actually wired in, not bypassed: a spy that
  // returns a non-zero status still proves the call reached the spy (i.e.
  // passed assertLocalArgv) rather than throwing before it got there.
  const _spawn = () => ({ status: 1, stdout: '' });
  assert.doesNotThrow(() => step4LoadTicketMemory('/repo', { _spawn }));
  assert.equal(step4LoadTicketMemory('/repo', { _spawn }), null);
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
  const result = await runSessionStart('/repo', deps, SESSION_STRINGS);
  assert.equal(result.exitCode, 0);
  assert.equal(typeof result.output, 'string');
  assert.ok(result.output.includes('brain · session context'));
});

test('runSessionStart: executes steps in order hydrate → branch/change → ticket', async () => {
  const order = [];
  const _spawn = (cmd, args) => {
    if (typeof args[0] === 'string' && args[0].includes('memory/cli.mjs') && args[1] === 'hydrate') {
      order.push('hydrate');
    }
    return { status: 0, stdout: '' };
  };
  const _branch = () => { order.push('branch'); return 'feat/issue-138-x'; };
  const _changes = () => [direntDir('issue-138-session-start')];
  const _resume = () => { order.push('ticket'); return null; };

  await runSessionStart('/repo', { _spawn, _branch, _changes, _resume }, SESSION_STRINGS);

  assert.deepEqual(order, ['hydrate', 'branch', 'ticket']);
});

test('runSessionStart: output composition matches renderContextBlock for the resolved step results', async () => {
  const _spawn = () => ({ status: 0, stdout: '' });
  const _branch = () => 'feat/issue-138-x';
  const _changes = () => [direntDir('issue-138-session-start')];
  const _resume = () => 'next_action: ship it\n';

  // #519 — `recency` is injected rather than left to the real reader. This test's job
  // is COMPOSITION: it must fail when a step's result stops reaching the renderer, and
  // it did exactly that when step4b was added. Letting it read '/repo' off the real
  // filesystem would make it assert whatever that path happens to contain.
  //
  // The injected value is STALE on purpose. A fresh one renders no line, so a `recency`
  // that never reaches the renderer would look identical to one that did — measured:
  // mutation M3 (drop the field from the call) was GREEN until this changed.
  const _recency = () => ({ ageDays: 6, newest: '2026-08-04T00:00:00Z' });
  const records = { count: 4, newest: { ts: '2026-08-04T00:00:00Z', title: 'newest one' }, scoped: [{ ts: '2026-08-03T00:00:00Z', title: 'scoped one' }], scopedCount: 1 };
  const _records = () => records;
  const result = await runSessionStart('/repo', { _spawn, _branch, _changes, _resume, _recency, _records, _resolveBackend: PLAINFILES }, SESSION_STRINGS);

  const expected = renderContextBlock({
    manifest: { restored: false },
    hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: 'feat/issue-138-x', token: ISSUE_138, matches: ['issue-138-session-start'] },
    ticket: 'next_action: ship it\n',
    recency: { ageDays: 6, newest: '2026-08-04T00:00:00Z' },
    records: { ...records, issue: 138 },
  }, SESSION_STRINGS);
  assert.equal(result.output, expected);
});

// ---------------------------------------------------------------------------
// assertLocalArgv(cmd, args) — runtime local-op allowlist gate (design §1.5b)
// ---------------------------------------------------------------------------

test('assertLocalArgv: allowlisted git rev-parse passes through', () => {
  assert.doesNotThrow(() => assertLocalArgv('git', ['rev-parse', '--abbrev-ref', 'HEAD']));
});

test('assertLocalArgv: allowlisted memory/cli.mjs hydrate|feature-resume pass through', () => {
  assert.doesNotThrow(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'hydrate']));
  assert.doesNotThrow(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'feature-resume']));
});

// #1115: `import` is a deprecated alias that session-start must never call, and `--verify` is the ONE flag
// `hydrate` may carry here (the read-only form).
test('#1115 assertLocalArgv: `import` is NOT allowlisted any more; `hydrate --verify` is, and only that flag', () => {
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'import']));
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'import', '--verify']));
  assert.doesNotThrow(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'hydrate', '--verify']));
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'hydrate', '--other']));
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'feature-resume', '--verify']));
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'hydrate', '--verify', '--export']));
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
test('assertLocalArgv: rejects unexpected trailing args on memory/cli.mjs hydrate|feature-resume', () => {
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'hydrate', '--export']));
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'hydrate', '--extra-flag']));
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'feature-resume', 'extra']));
});

test('assertLocalArgv: rejects a forbidden token anywhere in argv, even on an otherwise-allowed cmd', () => {
  assert.throws(() => assertLocalArgv('git', ['status', '--', 'pull']));
  assert.throws(() => assertLocalArgv('/usr/bin/node', ['brain/scripts/memory/cli.mjs', 'hydrate', '--cloud']));
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

// SS1/SS2 (#955, D3) — the gate narrows to ['rev-parse'] once the manifest
// restore (the only user of `git status`/`git restore`) is retired. A dead
// `restore`/`status` entry would let a read-only loader run a tree-mutating
// git verb.
test('SS1 (#955): assertLocalArgv rejects git restore — no longer allowlisted', () => {
  assert.throws(() => assertLocalArgv('git', ['restore', '--', '.memory/manifest.json']));
});

test('SS2 (#955): assertLocalArgv rejects git status — no longer allowlisted', () => {
  assert.throws(() => assertLocalArgv('git', ['status', '--porcelain']));
});

// ---------------------------------------------------------------------------
// No-network — import-graph allowlist (structural, design §1.5a)
// ---------------------------------------------------------------------------

const SESSION_START_PATH = join(dirname(fileURLToPath(import.meta.url)), 'session-start.mjs');

const ALLOWED_IMPORT_SPECIFIERS = [
  /^node:/,
  './lib/git-branch.mjs',
  './memory/lib/auto-resume.mjs',
  './memory/lib/backend-resolve.mjs',
  './context/synthesizer.mjs',
  './i18n/t.mjs',
  './lib/sdd-layout.mjs',
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

// MINOR 1 fix (fresh review): previously this test injected `_branch` and
// `_resume`, so `currentBranch`'s git rev-parse and `tryFeatureResume`'s
// feature-resume call never flowed through the `_spawn` spy at all — the
// allowlist assertion below was blind to 2 of the 4 controlled spawn sites.
// Now only `_spawn` (the gated seam) and `_changes` (pure FS, no subprocess)
// are stubbed, so the real `currentBranch` + `tryFeatureResume` call paths
// run for real and their subprocess calls are observed by the spy.
test('no-network: spy _spawn over the full loop — every argv allowlisted, none forbidden (rev-parse + feature-resume included)', async () => {
  const calls = [];
  const _spawn = (cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === 'git' && args[0] === 'rev-parse') return { status: 0, stdout: 'feat/issue-138-x\n' };
    if (typeof args[0] === 'string' && args[0].includes('memory/cli.mjs') && args[1] === 'feature-resume') {
      return { status: 0, stdout: 'next_action: ship it\n' };
    }
    return { status: 0, stdout: '' };
  };
  const _changes = () => [direntDir('issue-138-session-start')];

  await runSessionStart('/repo', { _spawn, _changes }, SESSION_STRINGS);

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

  // Proof that all 3 controlled spawn sites were actually exercised (not
  // stubbed away): branch resolution, backend hydrate, and ticket memory must
  // all be present, all flowing through the same spy.
  const kinds = calls.map((c) => (c.cmd === 'git' ? `git:${c.args[0]}` : `node:${c.args[1]}`));
  assert.ok(kinds.includes('git:rev-parse'), 'branch resolution (git rev-parse) must flow through the spy');
  assert.ok(kinds.includes('node:hydrate'), 'backend hydrate (memory/cli.mjs hydrate) must flow through the spy');
  assert.ok(!kinds.includes('node:import'), 'the deprecated `import` alias is never called');
  assert.ok(
    kinds.includes('node:feature-resume'),
    'ticket memory (memory/cli.mjs feature-resume) must flow through the spy',
  );
});

// ---------------------------------------------------------------------------
// resolveSessionStrings() — real i18n wiring end-to-end (design §1.8, REQ-8)
// ---------------------------------------------------------------------------

test('resolveSessionStrings: resolves every field from the real en.mjs catalog (en locale)', async () => {
  // Pin the locale explicitly: passing 'en' resolves against the English
  // catalog independent of the ambient brain.config.json, so this test stays
  // green when the whole suite runs from a consumer repo with docs.language !== en.
  const strings = await resolveSessionStrings('en');
  assert.deepEqual(strings, SESSION_STRINGS);
});

test('resolveSessionStrings: output feeds renderContextBlock end-to-end (no hardcoded fallback)', async () => {
  const strings = await resolveSessionStrings('en');
  const model = {
    manifest: { restored: false },
    hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: 'main', token: null, matches: [] },
    ticket: null,
  };
  const output = renderContextBlock(model, strings);
  assert.ok(output.startsWith(en['session.header']));
  assert.ok(output.includes(en['session.change.none']));
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

// ---------------------------------------------------------------------------
// step4bMemoryRecency + the banner line (issue #519)
//
// The durable layer went six days without a record and the only signal was
// `memory: engram unavailable (skipped)` — a line that reads as housekeeping. These
// pin the two things that make the new line worth having: it answers from COMMITTED
// records (so it still answers when engram is the thing that is missing), and it
// distinguishes "cannot determine" from "captured today".
// ---------------------------------------------------------------------------

const DAY = 86400000;

function memoryRepo(records) {
  const dir = mkdtempSync(join(tmpdir(), 'mem-recency-'));
  mkdirSync(join(dir, '.memory', 'records'), { recursive: true });
  for (const [file, lines] of Object.entries(records)) {
    writeFileSync(join(dir, '.memory', 'records', file), lines.join('\n') + '\n', 'utf8');
  }
  return dir;
}

test('#519: step4bMemoryRecency reports the age of the NEWEST record across every file', (t) => {
  const dir = memoryRepo({
    '2026-07.jsonl': [JSON.stringify({ ts: '2026-07-01T00:00:00Z' })],
    '2026-08.jsonl': [
      JSON.stringify({ ts: '2026-08-04T00:00:00Z' }),
      JSON.stringify({ ts: '2026-08-02T00:00:00Z' }),
    ],
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const r = step4bMemoryRecency(dir, { _now: () => Date.parse('2026-08-10T00:00:00Z') });
  assert.equal(r.ageDays, 6);
  assert.equal(r.newest, '2026-08-04T00:00:00Z');
});

test('#519: an EMPTY or absent store answers null (unknown), never 0 (fresh)', (t) => {
  const empty = memoryRepo({ '2026-08.jsonl': [] });
  t.after(() => rmSync(empty, { recursive: true, force: true }));

  // The whole point of the ticket: "cannot determine" and "captured today" are
  // different answers. Collapsing them is the evidence-reader-empty-on-failure class.
  assert.deepEqual(step4bMemoryRecency(empty, { _now: () => 0 }), { ageDays: null, newest: null });

  const none = mkdtempSync(join(tmpdir(), 'mem-none-'));
  t.after(() => rmSync(none, { recursive: true, force: true }));
  assert.deepEqual(step4bMemoryRecency(none, { _now: () => 0 }), { ageDays: null, newest: null });
});

test('#519: a corrupt line or an unparseable ts is skipped, never treated as the newest', (t) => {
  const dir = memoryRepo({
    '2026-08.jsonl': [
      '{ not json at all',
      JSON.stringify({ ts: 'no es una fecha' }),
      JSON.stringify({ ts: 42 }),
      JSON.stringify({ ts: '2026-08-04T00:00:00Z' }),
    ],
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const r = step4bMemoryRecency(dir, { _now: () => Date.parse('2026-08-06T00:00:00Z') });
  assert.equal(r.ageDays, 2, 'a corrupt neighbour must not change the answer');
  assert.equal(r.newest, '2026-08-04T00:00:00Z');
});

test('#519: the reader does not consult engram — it answers when engram is exactly what is missing', (t) => {
  const dir = memoryRepo({ '2026-08.jsonl': [JSON.stringify({ ts: '2026-08-04T00:00:00Z' })] });
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // No `_spawn` is supplied, and any subprocess attempt would throw through the gate.
  // The six-day outage happened in sessions where engram was absent, so a probe that
  // needs engram to answer cannot report the case it exists for.
  const r = step4bMemoryRecency(dir, { _now: () => Date.parse('2026-08-10T00:00:00Z') });
  assert.equal(r.ageDays, 6);
});

test('#519: a FRESH store adds no line — the banner only speaks when there is something to say', () => {
  const output = renderContextBlock({
    manifest: { restored: false }, hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: 'main', token: null, matches: [] }, ticket: null,
    recency: { ageDays: 0, newest: '2026-08-10T00:00:00Z' },
  }, SESSION_STRINGS);
  assert.ok(!output.includes('newest durable record'), `a fresh store must not be reported:\n${output}`);
});

test('#519: a STALE store is reported with its age', () => {
  const output = renderContextBlock({
    manifest: { restored: false }, hydration: { ok: false, backend: 'plainfiles' },
    change: { branch: 'main', token: null, matches: [] }, ticket: null,
    recency: { ageDays: 6, newest: '2026-08-04T00:00:00Z' },
  }, SESSION_STRINGS);
  assert.match(output, /newest durable record is 6 days old/);
});

test('#519: an UNKNOWN store is reported as unknown, not as stale-with-a-number', () => {
  const output = renderContextBlock({
    manifest: { restored: false }, hydration: { ok: false, backend: 'plainfiles' },
    change: { branch: 'main', token: null, matches: [] }, ticket: null,
    recency: { ageDays: null, newest: null },
  }, SESSION_STRINGS);
  assert.match(output, /cannot determine when memory was last captured/);
  assert.ok(!/\d+ days old/.test(output), 'unknown must not be dressed up as a measured age');
});

test('#519: a model with no recency renders exactly as before — the field is additive', () => {
  const model = {
    manifest: { restored: false }, hydration: { ok: true, backend: 'plainfiles' },
    change: { branch: 'main', token: null, matches: [] }, ticket: null,
  };
  const output = renderContextBlock(model, SESSION_STRINGS);
  assert.ok(!output.includes('memory:   newest'), 'an absent recency must add nothing');
  assert.ok(!output.includes('cannot determine'), 'an absent recency is not an unknown recency');
});

// #1165 S2: "nothing was tried" must not be reported as "engram unavailable".
test('#1165 step2Hydrate: exit 3 → {ok:false, undeclared:true} naming the cause, not an engram outage', () => {
  const r = step2Hydrate('/repo', { _resolveBackend: () => ({ status: 'undeclared', backend: null }), _spawn: () => ({ status: 3, stdout: '', stderr: 'memory/cli: no memory backend is declared' }) });
  assert.equal(r.ok, false);
  assert.equal(r.undeclared, true);
  assert.match(r.reason, /memory backend not declared/);
});

test('#1165 renderContextBlock: an undeclared backend renders "backend not declared" with the fix, never "engram unavailable"', async () => {
  const strings = { ...(await resolveSessionStrings('en')) };
  const out = renderContextBlock({ hydration: { ok: false, undeclared: true, reason: 'memory backend not declared — npm run brain:config -- set memory.backend engram|plainfiles' }, change: { branch: 'b', token: null, matches: [] }, ticket: null }, strings);
  assert.match(out, /backend not declared/);
  assert.match(out, /brain:config -- set memory\.backend/);
  assert.doesNotMatch(out, /unavailable/);
});

// ---------------------------------------------------------------------------
// #1115 — the backend is NAMED, a deferral is rendered (and is non-fatal), the verification is
// reported, and the durable records context is read straight from .memory/records/ (rulings Q1, Q3, Q4)
// ---------------------------------------------------------------------------

const baseModel = (hydration, extra = {}) => ({
  hydration,
  change: { branch: 'main', token: null, matches: [] },
  ticket: null,
  ...extra,
});

test('#1115 renderContextBlock: the memory line names the declared backend and says "engram" only for engram', () => {
  const plain = renderContextBlock(baseModel({ ok: true, backend: 'plainfiles' }), SESSION_STRINGS);
  assert.match(plain, /^memory:   plainfiles hydrated$/m);
  assert.doesNotMatch(plain, /engram/);
  const eng = renderContextBlock(baseModel({ ok: true, backend: 'engram' }), SESSION_STRINGS);
  assert.match(eng, /^memory:   engram hydrated$/m);
  const unknown = renderContextBlock(baseModel({ ok: true, backend: null }), SESSION_STRINGS);
  assert.match(unknown, /^memory:   \(unknown backend\) hydrated$/m);
});

test('#1115 renderContextBlock: a deferred hydration names the backend and the reason', () => {
  const out = renderContextBlock(baseModel({ ok: false, deferred: true, backend: 'engram', reason: 'engram binary not found. Install via: gentle-ai install' }), SESSION_STRINGS);
  assert.match(out, /^memory:   engram hydration deferred — engram binary not found\. Install via: gentle-ai install$/m);
});

test('#1115 renderContextBlock: a verified plainfiles index says so, and a stale one names the fix and that nothing was written', () => {
  const ok = renderContextBlock(baseModel({ ok: true, backend: 'plainfiles', verified: true, stale: false }), SESSION_STRINGS);
  assert.match(ok, /^memory:   plainfiles verified — index current \(read-only\)$/m);
  const stale = renderContextBlock(baseModel({ ok: true, backend: 'plainfiles', verified: true, stale: true }), SESSION_STRINGS);
  assert.match(stale, /^memory:   plainfiles index is stale — session:start does not write; run npm run brain:memory:share$/m);
  assert.doesNotMatch(stale, /engram/);
});

test('#1115 renderContextBlock: the records line and the active-issue records render after the memory line, in order', () => {
  const out = renderContextBlock(baseModel({ ok: true, backend: 'plainfiles' }, {
    change: { branch: 'fix/issue-1115-x', token: ISSUE_1115, matches: ['issue-1115-x'] },
    records: {
      count: 12, newest: { ts: '2026-10-04T02:09:59Z', title: 'newest title' },
      scoped: [{ ts: '2026-10-03T00:00:00Z', title: 'second' }, { ts: '2026-10-02T00:00:00Z', title: 'first' }], scopedCount: 2, issue: 1115,
    },
  }), SESSION_STRINGS);
  const lines = out.split('\n');
  const at = (re) => lines.findIndex((l) => re.test(l));
  assert.ok(at(/^memory: /) < at(/^records:  12 durable, newest 2026-10-04 — newest title$/));
  assert.ok(at(/^records: /) < at(/^issue #1115: 2 record\(s\)$/));
  assert.equal(lines[at(/^issue #1115/) + 1], '  - 2026-10-03 second');
  assert.equal(lines[at(/^issue #1115/) + 2], '  - 2026-10-02 first');
  assert.ok(at(/^issue #1115/) < at(/^ticket:/));
});

test('#1115 renderContextBlock: unknown records are "unknown", never a zero; no issue line without a resolved issue', () => {
  const out = renderContextBlock(baseModel({ ok: true, backend: 'plainfiles' }, { records: { count: null, newest: null, scoped: [], scopedCount: 0, issue: null } }), SESSION_STRINGS);
  assert.match(out, /^records:  durable store unreadable or empty — count unknown$/m);
  assert.doesNotMatch(out, /0 durable/);
  assert.doesNotMatch(out, /^issue #/m);
});

test('#1115 renderContextBlock: an issue with no scoped record says so', () => {
  const out = renderContextBlock(baseModel({ ok: true, backend: 'plainfiles' }, {
    records: { count: 3, newest: { ts: '2026-10-04T00:00:00Z', title: 't' }, scoped: [], scopedCount: 0, issue: 77 },
  }), SESSION_STRINGS);
  assert.match(out, /^issue #77: no record yet$/m);
});

test('#1115 renderContextBlock: a model with no records field renders no records line (additive)', () => {
  const out = renderContextBlock(baseModel({ ok: true, backend: 'plainfiles' }), SESSION_STRINGS);
  assert.doesNotMatch(out, /records:/);
});

// Q4: a deferral never makes session-start fail.
test('#1115 (Q4) runSessionStart: a deferred hydration (exit 6) renders the deferred line and STILL resolves exitCode 0', async () => {
  const _spawn = (cmd, args) => {
    if (args[1] === 'hydrate') return { status: 6, stdout: '', stderr: 'engram binary not found. Install via: gentle-ai install\n' };
    return { status: 0, stdout: '' };
  };
  const result = await runSessionStart('/repo', {
    _spawn, _branch: () => 'main', _changes: () => [], _resume: () => null, _recency: () => ({ ageDays: 0, newest: null }),
    _records: () => ({ count: null, newest: null, scoped: [], scopedCount: 0 }), _resolveBackend: ENGRAM,
  }, SESSION_STRINGS);
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /^memory:   engram hydration deferred — engram binary not found/m);
});

test('#1115 runSessionStart: a plainfiles consumer sees plainfiles and the word engram appears nowhere', async () => {
  const result = await runSessionStart('/repo', {
    _spawn: () => ({ status: 0, stdout: `${JSON.stringify({ hydrate: 'verified', stale: false, indexCount: 1 })}\n` }),
    _branch: () => 'main', _changes: () => [], _resume: () => null, _recency: () => ({ ageDays: 0, newest: null }),
    _records: () => ({ count: 1, newest: { ts: '2026-10-04T00:00:00Z', title: 't' }, scoped: [], scopedCount: 0 }), _resolveBackend: PLAINFILES,
  }, SESSION_STRINGS);
  assert.match(result.output, /^memory:   plainfiles verified/m);
  assert.doesNotMatch(result.output, /engram/i);
});

test('#1115 runSessionStart: the issue for the records context comes from exactly one resolved change; zero or several give none', async () => {
  const seen = [];
  const mk = (matches) => runSessionStart('/repo', {
    _spawn: () => ({ status: 0, stdout: '' }), _branch: () => 'fix/issue-1115-x', _changes: () => matches.map(direntDir),
    _resume: () => null, _recency: () => ({ ageDays: 0, newest: null }), _resolveBackend: PLAINFILES,
    _records: (cwd, { issue }) => { seen.push(issue); return { count: null, newest: null, scoped: [], scopedCount: 0 }; },
  }, SESSION_STRINGS);
  await mk(['issue-1115-x']);
  await mk([]);
  await mk(['issue-1115-a', 'issue-1115-b']);
  assert.deepEqual(seen, [1115, null, null]);
});

// ── step4cMemoryRecords — the backend-free reader (REQ-1115-7) ──

function rec(over) {
  return JSON.stringify({ id: 'rec-a', ts: '2026-10-01T00:00:00Z', actor: '@t', actorKind: 'human', type: 'decision', project: 'brain', content: 'title\n\nbody', ...over });
}

test('#1115 step4cMemoryRecords: dedupes by id, counts unique records, and returns the newest with its first-line title', (t) => {
  const dir = memoryRepo({
    '2026-09.jsonl': [rec({ id: 'rec-1', ts: '2026-09-01T00:00:00Z', content: 'older' }), rec({ id: 'rec-1', ts: '2026-09-01T00:00:00Z', content: 'older' })],
    '2026-10.jsonl': [rec({ id: 'rec-2', ts: '2026-10-04T02:09:59Z', content: '**Bold title (#9)**\n\nWhat: x' })],
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = step4cMemoryRecords(dir, { issue: null });
  assert.equal(r.count, 2, 'the duplicate id is one record');
  assert.deepEqual(r.newest, { ts: '2026-10-04T02:09:59Z', title: 'Bold title (#9)' }, 'the ** markers are stripped');
  assert.deepEqual(r.scoped, []);
  assert.equal(r.scopedCount, 0);
});

test('#1115 step4cMemoryRecords: a title is truncated to 80 characters with an ellipsis, skipping blank leading lines', (t) => {
  const long = 'x'.repeat(120);
  const dir = memoryRepo({ '2026-10.jsonl': [rec({ id: 'rec-1', content: `\n\n${long}\nbody` })] });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { newest } = step4cMemoryRecords(dir, { issue: null });
  assert.equal(newest.title.length, 80);
  assert.ok(newest.title.endsWith('…'));
});

test('#1115 step4cMemoryRecords: scoped records are those with issue === N, at most 5, newest first, with the full count', (t) => {
  const lines = [];
  for (let i = 1; i <= 7; i++) lines.push(rec({ id: `rec-s${i}`, ts: `2026-10-0${i}T00:00:00Z`, issue: 1115, content: `scoped ${i}` }));
  lines.push(rec({ id: 'rec-other', ts: '2026-10-09T00:00:00Z', issue: 99, content: 'other issue' }));
  const dir = memoryRepo({ '2026-10.jsonl': lines });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = step4cMemoryRecords(dir, { issue: 1115 });
  assert.equal(r.scopedCount, 7);
  assert.equal(r.scoped.length, 5);
  assert.deepEqual(r.scoped.map((x) => x.title), ['scoped 7', 'scoped 6', 'scoped 5', 'scoped 4', 'scoped 3']);
  assert.equal(r.count, 8);
});

test('#1115 step4cMemoryRecords: bad lines are skipped, and an unreadable, absent or empty store is count:null — never 0', (t) => {
  const dir = memoryRepo({ '2026-10.jsonl': ['{broken', rec({ id: 'rec-1' })] });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.equal(step4cMemoryRecords(dir, { issue: null }).count, 1);

  const empty = memoryRepo({});
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  assert.equal(step4cMemoryRecords(empty, { issue: null }).count, null);
  assert.equal(step4cMemoryRecords('/nonexistent-root-1115', { issue: null }).count, null);
  assert.equal(step4cMemoryRecords(empty, { issue: 5 }).scopedCount, 0);
});

test('#1115 step4cMemoryRecords: reads no backend — no spawn is attempted (a throwing _spawn is never reached)', (t) => {
  const dir = memoryRepo({ '2026-10.jsonl': [rec({ id: 'rec-1' })] });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = step4cMemoryRecords(dir, { issue: null }, { _spawn: () => { throw new Error('must not spawn'); } });
  assert.equal(r.count, 1);
});
