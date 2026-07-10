// run-check.test.mjs — Unit tests for the thin run-check.mjs runner (REQ-L3-1, REQ-L3-2)
//
// CI FRAGILITY: never let these tests read real git state or the real cwd's
// .memory/ — always inject the fakes. The memory-gate is records-only as of
// C4/D4 (REQ-C4-4): the #227 transitional chunks/records union is retired, so
// the gate no longer accepts a `readChunks` dep at all. Memory-gate tests
// inject `readRecords` — never rely on a default that reads the real world
// (finding #10 — a fail-expecting test broke once real records/ existed).
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runCheck, main } from './run-check.mjs';

async function captureLog(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { await fn(); } finally { console.log = orig; }
  return logs;
}

// ── memory-gate — records-only (C4/D4, REQ-C4-4) ────────────────────────────
//
// The #227 transitional chunks/records union is retired: the gate computes
// its observation set from `records/` ALONE. `readChunkObservations` is no
// longer imported by run-check.mjs at all. `readRecords` is injectable so
// these tests never touch the real filesystem.

test('runCheck: memory-gate — records has session_summary → pass', () => {
  const result = runCheck('memory-gate', {
    readRecords: () => [{ type: 'session_summary', title: 'x' }],
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: memory-gate — records have no session_summary → fail with reason', () => {
  const result = runCheck('memory-gate', {
    readRecords: () => [{ type: 'decision' }],
  });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('runCheck: memory-gate — records empty → fail with reason', () => {
  const result = runCheck('memory-gate', {
    readRecords: () => [],
  });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('runCheck: memory-gate — readRecords receives the injected cwd (uses injected reader, never a raw fs read)', () => {
  let receivedCwd;
  runCheck('memory-gate', {
    cwd: '/fake/cwd',
    readRecords: (cwd) => {
      receivedCwd = cwd;
      return [{ type: 'session_summary' }];
    },
  });
  assert.equal(receivedCwd, '/fake/cwd');
});

test('runCheck: memory-gate — only chunks has session_summary (records empty) → FAIL (chunks are no longer read, #227 union retired)', () => {
  const result = runCheck('memory-gate', {
    readChunks: () => [{ type: 'session_summary' }],
    readRecords: () => [],
  });
  assert.equal(result.pass, false, 'a readChunks dep, even if passed, must never be consulted — records/ alone decides the verdict');
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

// ── decision-gate ────────────────────────────────────────────────────────────

test('runCheck: decision-gate — injected diff has HOME.md but no ADR file → fail with reason', () => {
  const result = runCheck('decision-gate', {
    diffNameOnly: () => ['brain/HOME.md', 'src/other.mjs'],
  });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('runCheck: decision-gate — injected diff has ADR file and HOME.md → pass', () => {
  const result = runCheck('decision-gate', {
    diffNameOnly: () => ['brain/project/decisions/adr-0099-foo.md', 'brain/HOME.md'],
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: decision-gate — injected diff touches neither ADR nor HOME.md → pass (non-architectural PR)', () => {
  const result = runCheck('decision-gate', { diffNameOnly: () => ['src/whatever.mjs'] });
  assert.deepEqual(result, { pass: true });
});

// ── decision-gate fail-closed when the diff cannot be computed ──────────────
//
// A REQUIRED gate must never silently pass just because its input could not
// be computed (missing BASE_SHA/HEAD_SHA env, or the git command throwing).
// diffNameOnly() throwing MUST fail the gate closed, not degrade to `[]`
// (which adrPresence would otherwise treat as a harmless empty diff → pass).

test('runCheck: decision-gate — diffNameOnly throws (diff uncomputable) → fail closed with reason', () => {
  const result = runCheck('decision-gate', {
    diffNameOnly: () => { throw new Error('BASE_SHA/HEAD_SHA not set'); },
  });
  assert.equal(result.pass, false);
  assert.match(result.reason, /cannot compute diff — failing closed/i);
});

test('runCheck: decision-gate — diffNameOnly throws → reason includes the underlying error message', () => {
  const result = runCheck('decision-gate', {
    diffNameOnly: () => { throw new Error('git exited with status 128'); },
  });
  assert.equal(result.pass, false);
  assert.match(result.reason, /git exited with status 128/);
});

// ── unknown check ────────────────────────────────────────────────────────────

test('runCheck: unknown check name throws', () => {
  assert.throws(() => runCheck('not-a-real-check', {}), /unknown check/i);
});

// ── ci-context seam wiring (ADR-0016) — decision-gate reads ctx.baseSha/headSha ─
//
// The default diff-computation path now sources baseSha/headSha from an
// injected `deps.ctx` (built by ci-context.mjs's loadContext() at the CLI
// entrypoint) instead of reading process.env.BASE_SHA/HEAD_SHA directly.
// `deps.diffNameOnly` still overrides everything (existing tests above never
// pass `ctx` and are unaffected).

function withEnv(overrides, fn) {
  const saved = {};
  for (const k of Object.keys(overrides)) saved[k] = process.env[k];
  Object.assign(process.env, overrides);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(overrides)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('runCheck: decision-gate — deps.ctx.baseSha/headSha take precedence over process.env.BASE_SHA/HEAD_SHA (ci-context seam)', () => {
  withEnv({ BASE_SHA: 'this-is-not-a-real-sha-xyz', HEAD_SHA: 'this-is-not-a-real-sha-abc' }, () => {
    const result = runCheck('decision-gate', { ctx: { baseSha: 'HEAD', headSha: 'HEAD' } });
    assert.deepEqual(result, { pass: true }, 'ctx.baseSha/headSha ("HEAD") must win over the bogus env values');
  });
});

test('runCheck: decision-gate — deps.ctx signaling null baseSha/headSha fails closed even when process.env.BASE_SHA/HEAD_SHA are set', () => {
  withEnv({ BASE_SHA: 'HEAD', HEAD_SHA: 'HEAD' }, () => {
    const result = runCheck('decision-gate', { ctx: { baseSha: null, headSha: null } });
    assert.equal(result.pass, false);
    assert.match(result.reason, /cannot compute diff — failing closed/i);
  });
});

// ── main() — exit-code + printed-reason smoke test ───────────────────────────

test('main: memory-gate passing → returns 0, prints nothing', async () => {
  let code;
  const logs = await captureLog(() => {
    code = main('memory-gate', { readRecords: () => [{ type: 'session_summary' }] });
  });
  assert.equal(code, 0);
  assert.deepEqual(logs, []);
});

test('main: memory-gate failing → returns 1, prints the reason', async () => {
  let code;
  const logs = await captureLog(() => {
    code = main('memory-gate', { readRecords: () => [] });
  });
  assert.equal(code, 1);
  assert.ok(logs.length === 1 && logs[0].length > 0);
});

test('main: decision-gate failing → returns 1, prints the reason', async () => {
  let code;
  const logs = await captureLog(() => {
    code = main('decision-gate', { diffNameOnly: () => ['brain/HOME.md'] });
  });
  assert.equal(code, 1);
  assert.ok(logs.length === 1 && logs[0].length > 0);
});

test('main: decision-gate passing (non-architectural PR) → returns 0, prints nothing', async () => {
  let code;
  const logs = await captureLog(() => {
    code = main('decision-gate', { diffNameOnly: () => ['src/foo.mjs'] });
  });
  assert.equal(code, 0);
  assert.deepEqual(logs, []);
});

test('main: decision-gate — diff uncomputable → returns 1, prints fail-closed reason', async () => {
  let code;
  const logs = await captureLog(() => {
    code = main('decision-gate', {
      diffNameOnly: () => { throw new Error('no BASE_SHA/HEAD_SHA'); },
    });
  });
  assert.equal(code, 1);
  assert.ok(logs.length === 1);
  assert.match(logs[0], /cannot compute diff — failing closed/i);
});

test('neutrality source-scan (REQ-NEUTRALITY-2): run-check.mjs source contains no .claude or SKILL.md literal', () => {
  const srcPath = fileURLToPath(new URL('./run-check.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.equal(src.includes('.claude'), false, 'source must not reference .claude');
  assert.equal(src.includes('SKILL.md'), false, 'source must not reference SKILL.md');
});
