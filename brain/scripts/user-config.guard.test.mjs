// user-config.guard.test.mjs — no test may ever read a developer's real home (ADR-0040 ratified point 1, issue #1263 slice 1).
//
// The user layer is `<BRAIN_HOME>/config.json`, else `<os.homedir()>/.brain`. A test that reaches it without BRAIN_HOME would read
// (and, from slice 2, be changed by) the machine it runs on. Five layers, each covering what the others cannot, none of them a
// promise to remember:
//   1. RUNTIME (lib/user-config.mjs): under `node --test`, the real-home fallback THROWS. It catches the in-process call and any
//      child that inherited NODE_TEST_CONTEXT, at the exact call that would have read the home. (user-config.test.mjs pins it.)
//   2. PRELOAD (`npm test` runs `node --import lib/test-brain-home.mjs`): every test process starts with BRAIN_HOME on an EMPTY
//      temp dir, so the common path needs no per-test line. Pinned below.
//   3. SCAN: `homedir` is read in ONE place. A second reader is a second way to reach the real home, whatever it is for.
//   4. SCAN: a test that hands a child the REAL `HOME` (an explicit-env spawn has no NODE_TEST_CONTEXT, so layer 1 cannot see it)
//      must also hand it a BRAIN_HOME. A test that calls the reader directly must name BRAIN_HOME or inject `homedir`.
//   5. The hermetic box sets BRAIN_HOME inside its own root. Pinned below.
// Why scans AND a runtime guard: a scan sees syntax, not behaviour (a helper can reach the reader), and the runtime guard sees
// behaviour only where the env carries NODE_TEST_CONTEXT. Neither alone is the rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, globSync, rmSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { maskNonCode } from './lib/mask-non-code.mjs';
import { hermeticEnv } from './lib/hermetic-box.mjs';
import { testTmp } from './lib/test-tmp.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = (p) => relative(repoRoot, p).split(sep).join('/');
const files = (...globs) => globs.flatMap((g) => globSync(g, { cwd: repoRoot })).map((f) => join(repoRoot, f)).filter((f) => !f.includes('node_modules'));

/** Where `os.homedir()` may be read, and why. A new entry is a new way to reach the real home: it needs a reason. */
const HOMEDIR_ALLOWED = new Map([
  ['brain/scripts/lib/user-config.mjs', 'the ONE reader of the user layer (the fallback when BRAIN_HOME is unset)'],
  ['brain/scripts/lib/user-config.test.mjs', 'passes an injected `homedir` seam: never the real home'],
  ['brain/scripts/axes/review-engine/adapters/gemini.mjs', "the Gemini CLI's own config dir, not the brain user layer"],
  ['brain/scripts/axes/memory/adapters/engram.heal.integration.test.mjs', 'asserts its sandbox is never the real ~/.engram'],
]);

test('guard 3: `homedir` is read in ONE place (plus the named exceptions, each with its reason)', () => {
  const hits = [];
  for (const f of files('brain/scripts/**/*.mjs', 'test/**/*.mjs')) {
    if (/\bhomedir\b/.test(maskNonCode(readFileSync(f, 'utf8')))) hits.push(rel(f));
  }
  const unexpected = hits.filter((h) => !HOMEDIR_ALLOWED.has(h));
  assert.deepEqual(unexpected, [], `these files read the home directory outside readUserConfig — use lib/user-config.mjs, or add an entry to HOMEDIR_ALLOWED with a reason: ${unexpected.join(', ')}`);
  const stale = [...HOMEDIR_ALLOWED.keys()].filter((k) => !hits.includes(k));
  assert.deepEqual(stale, [], `HOMEDIR_ALLOWED entries that no longer read the home directory: ${stale.join(', ')}`);
  assert.ok(hits.includes('brain/scripts/lib/user-config.mjs'), 'the scan found the reader: it is looking at the right files');
});

test('guard 4a: a test that hands a child the real HOME hands it a BRAIN_HOME too', () => {
  const offenders = [];
  let seen = 0;
  for (const f of files('brain/scripts/**/*.test.mjs', 'test/**/*.test.mjs')) {
    if (rel(f) === 'brain/scripts/user-config.guard.test.mjs') continue;
    const raw = readFileSync(f, 'utf8');
    if (!/process\.env\.HOME\b/.test(maskNonCode(raw))) continue;
    seen += 1;
    if (!/\bBRAIN_HOME\b/.test(raw)) offenders.push(rel(f));
  }
  assert.ok(seen >= 8, `the scan saw ${seen} files that pass the real HOME through: it is looking at the wrong files`);
  assert.deepEqual(offenders, [], `these tests pass the real HOME to a child without BRAIN_HOME (ADR-0040): ${offenders.join(', ')}`);
});

test('guard 4b: a test that calls the user-layer reader directly names BRAIN_HOME or injects `homedir`', () => {
  const offenders = [];
  let seen = 0;
  for (const f of files('brain/scripts/**/*.test.mjs', 'test/**/*.test.mjs')) {
    if (rel(f) === 'brain/scripts/user-config.guard.test.mjs') continue;
    const raw = readFileSync(f, 'utf8');
    if (!/\b(readUserConfig|userConfigDir)\s*\(/.test(maskNonCode(raw))) continue;
    seen += 1;
    if (!/\bBRAIN_HOME\b|\bhomedir\b/.test(raw)) offenders.push(rel(f));
  }
  assert.ok(seen >= 1, 'the scan found no direct reader call: it is looking at the wrong files');
  assert.deepEqual(offenders, [], `these tests read the user layer without BRAIN_HOME or an injected homedir: ${offenders.join(', ')}`);
});

/** Files that name a PATH key without a child's env: a data fixture, not a spawn. Each needs a reason. */
const PATH_ENV_NOT_A_SPAWN = new Map([
  ['brain/scripts/review/lib/run-cold-review-stage.test.mjs', 'the PATH env is an input to a stubbed engine runner, never the environment of a real child'],
]);

test('guard 4c: a test that spawns with an explicit env (a PATH key) names HOME or BRAIN_HOME, or inherits process.env', () => {
  // `os.homedir()` follows $HOME, so a child with an explicit env and NO HOME falls back to the passwd entry: the developer's REAL home.
  // That is the one explicit-env shape neither the runtime guard (no NODE_TEST_CONTEXT in the child) nor scan 4a (no process.env.HOME) sees.
  const offenders = [];
  for (const f of files('brain/scripts/**/*.test.mjs', 'test/**/*.test.mjs')) {
    const name = rel(f);
    if (name === 'brain/scripts/user-config.guard.test.mjs') continue;
    const code = maskNonCode(readFileSync(f, 'utf8'));
    if (!/\b(spawn|spawnSync|execFile|execFileSync|fork)\s*\(/.test(code) || !/\bPATH\s*:/.test(code)) continue;
    if (/\bHOME\b|\bBRAIN_HOME\b|\bhermeticEnv\b|\.\.\.process\.env/.test(code)) continue;
    if (!PATH_ENV_NOT_A_SPAWN.has(name)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `these tests spawn with an explicit env that names neither HOME nor BRAIN_HOME (the child would read the real home): ${offenders.join(', ')}`);
});

test('guard 2: `npm test` preloads the BRAIN_HOME setup into every test process', () => {
  const script = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).scripts.test;
  assert.match(script, /--import \.\/brain\/scripts\/lib\/test-brain-home\.mjs\b/, script);
});

test('guard 2: the preload gives an unset BRAIN_HOME an empty temp dir, and leaves a set one alone', async () => {
  const saved = process.env.BRAIN_HOME;
  const made = [];
  try {
    delete process.env.BRAIN_HOME;
    await import(`./lib/test-brain-home.mjs?unset=${Date.now()}`);
    const got = process.env.BRAIN_HOME;
    made.push(got);
    assert.ok(got && got.startsWith(tmpdir()), `BRAIN_HOME must be a temp dir, got ${got}`);
    assert.notEqual(got, process.env.HOME);

    const mine = testTmp('guard-brain-home-');
    process.env.BRAIN_HOME = mine;
    await import(`./lib/test-brain-home.mjs?set=${Date.now()}`);
    assert.equal(process.env.BRAIN_HOME, mine);
  } finally {
    if (saved === undefined) delete process.env.BRAIN_HOME; else process.env.BRAIN_HOME = saved;
    for (const d of made) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort: the run root removes it at exit */ } }
  }
});

test('guard 5: the hermetic box carries a BRAIN_HOME inside its own root, never the real home', () => {
  const root = testTmp('guard-box-');
  const env = hermeticEnv(root);
  assert.equal(env.BRAIN_HOME, join(root, 'brain-home'));
  assert.ok(!env.BRAIN_HOME.startsWith(process.env.HOME ?? '\0'), 'BRAIN_HOME must not sit under the developer HOME');
  assert.equal(hermeticEnv(root, { env: { BRAIN_HOME: '/seeded' } }).BRAIN_HOME, '/seeded', 'a scenario may seed its own user layer');
});
