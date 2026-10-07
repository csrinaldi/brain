// user-config.test.mjs — the ONE reader of the user layer (ADR-0040 section 1, #1263 slice 1).
// Every call here names BRAIN_HOME (a temp dir) or injects `homedir`: no test reads a real home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { readUserConfig, userConfigDir, USER_CONFIG_FILE, UserHomeUnderTestError, writeUserConfig, setUserDefault, UserConfigWriteError } from './user-config.mjs';
import { testTmp } from './test-tmp.mjs';

const home = (config) => {
  const dir = testTmp('user-config-');
  if (config !== undefined) writeFileSync(join(dir, USER_CONFIG_FILE), config);
  return dir;
};

test('readUserConfig: a missing file is an EMPTY layer, not an error', () => {
  const dir = home();
  assert.deepEqual(readUserConfig({ env: { BRAIN_HOME: dir } }), { userConfig: {}, userPath: join(dir, 'config.json'), userError: null });
});

test('readUserConfig: reads the ADR-0038 shape from BRAIN_HOME/config.json', () => {
  const body = { platform: { default: 'antigravity', providers: { antigravity: { version: '1.4.0' } } } };
  const dir = home(JSON.stringify(body));
  assert.deepEqual(readUserConfig({ env: { BRAIN_HOME: dir } }), { userConfig: body, userPath: join(dir, 'config.json'), userError: null });
});

test('readUserConfig: invalid JSON is reported as userError with the path, never an empty layer in silence', () => {
  const dir = home('{ not json');
  const r = readUserConfig({ env: { BRAIN_HOME: dir } });
  assert.deepEqual(r.userConfig, {});
  assert.ok(r.userError?.startsWith(join(dir, 'config.json')), r.userError);
});

test('readUserConfig: a top level that is not an object is reported', () => {
  for (const body of ['[]', '"x"', 'null', '3']) {
    const r = readUserConfig({ env: { BRAIN_HOME: home(body) } });
    assert.match(r.userError ?? '', /top level must be a JSON object/, body);
  }
});

test('readUserConfig: an unreadable file (a directory in its place) is reported, not treated as absent', () => {
  const dir = home();
  mkdirSync(join(dir, 'config.json'));
  assert.match(readUserConfig({ env: { BRAIN_HOME: dir } }).userError ?? '', /EISDIR/);
});

test('userConfigDir: BRAIN_HOME wins and is resolved; otherwise <homedir>/.brain on every OS', () => {
  assert.equal(userConfigDir({ env: { BRAIN_HOME: 'rel/dir' } }), resolve('rel/dir'));
  const savedHome = process.env.BRAIN_HOME;
  delete process.env.BRAIN_HOME;
  try {
    assert.equal(userConfigDir({ env: {}, homedir: () => '/h/me' }), join('/h/me', '.brain'));
    assert.equal(userConfigDir({ env: { BRAIN_HOME: '   ' }, homedir: () => '/h/me' }), join('/h/me', '.brain'), 'blank is unset');
  } finally {
    if (savedHome !== undefined) process.env.BRAIN_HOME = savedHome;
  }
});

test('guard: under node --test, reaching the real-home fallback THROWS (a test that forgot BRAIN_HOME fails there)', () => {
  const saved = process.env.NODE_TEST_CONTEXT;
  const savedHome = process.env.BRAIN_HOME;
  process.env.NODE_TEST_CONTEXT = 'child-v8';
  delete process.env.BRAIN_HOME;
  try {
    assert.throws(() => readUserConfig({ env: {} }), UserHomeUnderTestError);
    assert.throws(() => userConfigDir({ env: { BRAIN_HOME: '' } }), UserHomeUnderTestError);
    // BRAIN_HOME set, or an injected homedir (not the real one): fine
    assert.doesNotThrow(() => readUserConfig({ env: { BRAIN_HOME: home() } }));
    assert.doesNotThrow(() => userConfigDir({ env: {}, homedir: () => '/nowhere' }));
    // an injected env without BRAIN_HOME falls back to the PROCESS's BRAIN_HOME (the preload's temp dir under `npm test`)
    process.env.BRAIN_HOME = home();
    assert.equal(readUserConfig({ env: {} }).userError, null);
  } finally {
    if (saved === undefined) delete process.env.NODE_TEST_CONTEXT; else process.env.NODE_TEST_CONTEXT = saved;
    if (savedHome === undefined) delete process.env.BRAIN_HOME; else process.env.BRAIN_HOME = savedHome;
  }
});

test('guard: outside a test the fallback is the real home (the production path)', () => {
  const saved = process.env.NODE_TEST_CONTEXT;
  const savedHome = process.env.BRAIN_HOME;
  delete process.env.NODE_TEST_CONTEXT;
  delete process.env.BRAIN_HOME;
  try {
    assert.equal(userConfigDir({ env: {}, homedir: () => '/h/me' }), join('/h/me', '.brain'));
  } finally {
    if (saved !== undefined) process.env.NODE_TEST_CONTEXT = saved;
    if (savedHome !== undefined) process.env.BRAIN_HOME = savedHome;
  }
});

// ── the ONE writer (#1263 slice 2) ──────────────────────────────────────────
const mode = (p) => statSync(p).mode & 0o777;

test('writeUserConfig: creates the dir 0700 and the file 0600, atomically (no temp file left behind)', () => {
  const dir = join(testTmp('user-config-w-'), 'brain-home'); // does not exist yet
  const body = { platform: { default: 'claude', providers: { claude: {} } } };
  const r = writeUserConfig(body, { env: { BRAIN_HOME: dir } });
  assert.equal(r.userPath, join(dir, USER_CONFIG_FILE));
  assert.equal(mode(dir), 0o700);
  assert.equal(mode(r.userPath), 0o600);
  assert.deepEqual(JSON.parse(readFileSync(r.userPath, 'utf8')), body);
  assert.deepEqual(readdirSync(dir), [USER_CONFIG_FILE], 'the temp file was renamed away');
  assert.deepEqual(readUserConfig({ env: { BRAIN_HOME: dir } }).userConfig, body);
});

test('writeUserConfig: replaces an existing file in one rename and keeps it 0600', () => {
  const dir = home(JSON.stringify({ platform: { default: 'plain' } }));
  const next = { platform: { default: 'claude', providers: { claude: {} } } };
  writeUserConfig(next, { env: { BRAIN_HOME: dir } });
  assert.deepEqual(JSON.parse(readFileSync(join(dir, USER_CONFIG_FILE), 'utf8')), next);
  assert.equal(mode(join(dir, USER_CONFIG_FILE)), 0o600);
  assert.deepEqual(readdirSync(dir), [USER_CONFIG_FILE]);
});

test('writeUserConfig: REFUSES a locked key (a key of the team config only) and writes nothing', () => {
  const dir = join(testTmp('user-config-w-'), 'bh');
  assert.throws(() => writeUserConfig({ memory: { default: 'engram', locked: true } }, { env: { BRAIN_HOME: dir } }), (e) => e instanceof UserConfigWriteError && /locked/.test(e.message));
  assert.equal(existsSync(join(dir, USER_CONFIG_FILE)), false);
});

test('writeUserConfig: refuses a body that is not a plain object', () => {
  const dir = join(testTmp('user-config-w-'), 'bh');
  for (const bad of [null, [], 'x', 3]) assert.throws(() => writeUserConfig(bad, { env: { BRAIN_HOME: dir } }), UserConfigWriteError);
  assert.equal(existsSync(join(dir, USER_CONFIG_FILE)), false);
});

test('setUserDefault: sets <axis>.default and lists the provider, keeping everything else the person had', () => {
  const dir = home(JSON.stringify({ sdd: { default: 'plain', providers: { plain: { version: '1' } } } }));
  setUserDefault('platform', 'claude', { env: { BRAIN_HOME: dir } });
  assert.deepEqual(readUserConfig({ env: { BRAIN_HOME: dir } }).userConfig, {
    sdd: { default: 'plain', providers: { plain: { version: '1' } } },
    platform: { default: 'claude', providers: { claude: {} } },
  });
});

test('setUserDefault: refuses vcs (the user layer holds none), an unknown axis and a name that is not a provider name', () => {
  const dir = home();
  for (const [axis, name] of [['vcs', 'github'], ['nope', 'x'], ['platform', ''], ['platform', 'a b'], ['platform', 'ghp_' + 'x'.repeat(30) + '/..']]) {
    assert.throws(() => setUserDefault(axis, name, { env: { BRAIN_HOME: dir } }), UserConfigWriteError, `${axis} ${name}`);
  }
  assert.equal(existsSync(join(dir, USER_CONFIG_FILE)), false);
});

test('setUserDefault: never overwrites a user file it could not read (malformed JSON stays as it is)', () => {
  const dir = home('{ not json');
  assert.throws(() => setUserDefault('platform', 'claude', { env: { BRAIN_HOME: dir } }), UserConfigWriteError);
  assert.equal(readFileSync(join(dir, USER_CONFIG_FILE), 'utf8'), '{ not json');
});
