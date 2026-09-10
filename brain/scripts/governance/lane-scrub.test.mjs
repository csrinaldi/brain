// lane-scrub.test.mjs — unit suite for evaluateLaneScrub + the CLI wrapper
// (#905, spec.md "lane-scrub is a required, non-waivable secret check",
// design.md A5/A6/C1). RED until brain/scripts/governance/lane-scrub.mjs
// exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { evaluateLaneScrub, main } from './lane-scrub.mjs';

const LANE_SCRUB_PATH = fileURLToPath(new URL('./lane-scrub.mjs', import.meta.url));

// Swallows console.log for the duration of `fn` — no test in this file
// inspects the printed text, only the returned exit code, so there is no
// `logs` array/`args` param to keep alive here.
async function captureLog(fn) {
  const orig = console.log;
  console.log = () => {};
  try { return await fn(); } finally { console.log = orig; }
}

// ── evaluateLaneScrub — the pure core (C1: fail-closed, no line leaked) ─────

test('evaluateLaneScrub: a planted ghp_ token in an added record fails closed, output has pattern+lineNumber, never the matched line', () => {
  const files = {
    '.memory/records/a.jsonl': 'line one\n{"token":"ghp_ABCDEFGHIJ0123456789ZZ"}\nline three',
  };
  const result = evaluateLaneScrub({
    addedFiles: ['.memory/records/a.jsonl'],
    config: {},
    readFile: (path) => files[path],
  });
  assert.equal(result.pass, false);
  assert.match(result.reason, /pattern/);
  assert.match(result.reason, /lineNumber.*2/);
  assert.doesNotMatch(result.reason, /ghp_ABCDEFGHIJ0123456789ZZ/, 'the matched secret must never appear in the output');
});

test('evaluateLaneScrub: memorySecretAllowPatterns honoured — an allow-listed pattern does not fail', () => {
  const files = {
    '.memory/records/a.jsonl': '{"token":"ghp_ABCDEFGHIJ0123456789ZZ"}',
  };
  const result = evaluateLaneScrub({
    addedFiles: ['.memory/records/a.jsonl'],
    config: { governance: { memorySecretAllowPatterns: ['ghp_ABCDEFGHIJ0123456789ZZ'] } },
    readFile: (path) => files[path],
  });
  assert.equal(result.pass, true);
});

test('evaluateLaneScrub: no added record path → pass, "nothing to scan"', () => {
  const result = evaluateLaneScrub({
    addedFiles: ['src/index.mjs', '.memory/index.jsonl'],
    config: {},
    readFile: () => { throw new Error('must not be called — no record path was added'); },
  });
  assert.equal(result.pass, true);
  assert.match(result.reason, /nothing to scan/);
});

test('main: a feat/* branch (not a lane) with a planted secret in an added record still fails — design A6, lane-scrub consults no lane input at all', async () => {
  const files = { '.memory/records/a.jsonl': 'line one\n{"token":"ghp_ABCDEFGHIJ0123456789ZZ"}\nline three' };
  const exitCode = await captureLog(() =>
    main({
      ctx: { sourceBranch: 'feat/some-feature' },
      diffNameOnlyAdded: () => ['.memory/records/a.jsonl'],
      readConfig: () => ({}),
      readFile: (path) => files[path],
    })
  );
  assert.equal(exitCode, 1, 'a feature branch gets NO exemption from lane-scrub — the same secret fails it identically to a lane branch');
});

test('evaluateLaneScrub: a clean added record (no secret) → pass', () => {
  const files = { '.memory/records/a.jsonl': '{"type":"decision","content":"nothing sensitive"}' };
  const result = evaluateLaneScrub({
    addedFiles: ['.memory/records/a.jsonl'],
    config: {},
    readFile: (path) => files[path],
  });
  assert.deepEqual(result, { pass: true });
});

// ── SOURCE GUARD (C1's non-waivability as a property of the code) ──────────

test('SOURCE GUARD: lane-scrub.mjs does not import governance-tiers.mjs — non-waivability cannot be softened by a tier edit', () => {
  const source = readFileSync(LANE_SCRUB_PATH, 'utf8');
  const importLines = source.split('\n').filter((line) => /^\s*import\b/.test(line));
  for (const line of importLines) {
    assert.doesNotMatch(line, /governance-tiers/, `lane-scrub.mjs must never import governance-tiers.mjs: ${line}`);
  }
});

// ── main() — the CLI wrapper (0/1/2 contract, runs on every PR) ────────────

test('main: a planted secret → exit 1', async () => {
  const files = { '.memory/records/a.jsonl': 'AKIA1234567890ABCDEF' };
  const exitCode = await captureLog(() =>
    main({
      ctx: {},
      diffNameOnlyAdded: () => ['.memory/records/a.jsonl'],
      readConfig: () => ({}),
      readFile: (path) => files[path],
    })
  );
  assert.equal(exitCode, 1);
});

test('main: no added record path → exit 0', async () => {
  const exitCode = await captureLog(() =>
    main({
      ctx: {},
      diffNameOnlyAdded: () => ['src/index.mjs'],
      readConfig: () => ({}),
      readFile: () => { throw new Error('must not be called'); },
    })
  );
  assert.equal(exitCode, 0);
});

test('main: an uncomputable added-diff → exit 2, failing closed (C1 is non-waivable)', async () => {
  const exitCode = await captureLog(() =>
    main({
      ctx: {},
      diffNameOnlyAdded: () => { throw new Error('BASE_SHA/HEAD_SHA not set'); },
      readConfig: () => ({}),
    })
  );
  assert.equal(exitCode, 2);
});

test('main: readFile throws for an added record (deleted before the run) → exit 2, failing closed as uncomputable — never a raw crash exiting 1', async () => {
  const exitCode = await captureLog(() =>
    main({
      ctx: {},
      diffNameOnlyAdded: () => ['.memory/records/a.jsonl'],
      readConfig: () => ({}),
      readFile: () => { throw new Error('ENOENT: no such file or directory, open \'.memory/records/a.jsonl\''); },
    })
  );
  assert.equal(exitCode, 2, 'an unreadable added record must fail closed as UNCOMPUTABLE (2), never as a violation (1)');
});

// cold-1 (PR #907 cold review): a single try/catch around evaluateLaneScrub
// previously misattributed a bad regex in the secret config (thrown by
// compilePatterns, secret-scrub.mjs:42-44) to the "cannot read an added
// record" reason. Patterns must be compiled OUTSIDE the read loop, with
// their own uncomputable reason.
test('main: an invalid secret pattern in config → exit 2 with a config-specific reason, never "cannot read"', async () => {
  const logs = [];
  const orig = console.log;
  console.log = (msg) => { logs.push(msg); };
  let exitCode;
  try {
    exitCode = await main({
      ctx: {},
      diffNameOnlyAdded: () => ['.memory/records/a.jsonl'],
      readConfig: () => ({ governance: { memorySecretPatterns: ['(unclosed'] } }),
      readFile: () => { throw new Error('must not be called — pattern compilation fails before any read'); },
    });
  } finally {
    console.log = orig;
  }
  assert.equal(exitCode, 2, 'an invalid secret pattern in config must fail closed as UNCOMPUTABLE (2)');
  assert.match(logs.join('\n'), /lane-scrub: invalid secret pattern in config — failing closed \(uncomputable\)/);
  assert.doesNotMatch(logs.join('\n'), /cannot read an added record/, 'a config error must never be misreported as a read failure');
});

test('main: runs and passes explicitly on a non-lane PR (a feature branch adding a clean record)', async () => {
  const files = { '.memory/records/a.jsonl': 'nothing sensitive here' };
  const exitCode = await captureLog(() =>
    main({
      ctx: { sourceBranch: 'feat/some-feature' },
      diffNameOnlyAdded: () => ['.memory/records/a.jsonl'],
      readConfig: () => ({}),
      readFile: (path) => files[path],
    })
  );
  assert.equal(exitCode, 0);
});
