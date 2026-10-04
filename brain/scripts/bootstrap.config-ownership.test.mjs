// bootstrap.config-ownership.test.mjs — env:init and WHO MAY WRITE WHAT (ADR-0040, issue #1263 slice 2).
//
// The REAL bootstrap.sh in the hermetic box (lib/hermetic-box.mjs): a temp BRAIN_HOME inside the box, never the developer's
// real home. Two cases, decided ONCE and early by the creator of brain.config.json (`ensure --founding-file`):
//   - a FOUNDING run creates the file: it declares the team defaults for every axis (memory only with a TTY answer);
//   - an EXISTING repo: env:init NEVER writes brain.config.json. A personal choice goes to the user layer (BRAIN_HOME), and a
//     team axis nobody declared is refused with the named fix.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { testTmp } from './lib/test-tmp.mjs';
import { git, installBrain, hermeticEnv } from './lib/hermetic-box.mjs';
import { readUserConfig } from './lib/user-config.mjs';
import { validateAxisConfig } from './lib/axis-config.mjs';

const NODE = process.execPath;

function fixture(name, { origin = false } = {}) {
  const root = testTmp(`bootstrap-own-${name}-`);
  const repo = join(root, 'repo');
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 't@example.com');
  git(repo, 'config', 'user.name', 't');
  installBrain(repo);
  writeFileSync(join(repo, 'notes.txt'), 'a\n');
  git(repo, 'add', 'notes.txt');
  git(repo, 'commit', '-qm', 'seed');
  if (origin) git(repo, 'remote', 'add', 'origin', 'https://example.invalid/o/r.git');
  return { root, repo, home: join(root, 'brain-home') };
}

const env = (root, extra = {}) => hermeticEnv(root, { env: { BRAIN_HOME: join(root, 'brain-home'), ...extra } });

/** The team config an EXISTING repo carries: `ensure` writes the file, the test then states what the team declared. */
function existingTeam({ root, repo }, declare) {
  const r = spawnSync(NODE, ['brain/scripts/lib/brain-config.mjs', 'ensure'], { cwd: repo, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'], env: env(root) });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  const path = join(repo, 'brain.config.json');
  const cfg = JSON.parse(readFileSync(path, 'utf8'));
  declare(cfg);
  writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`);
  git(repo, 'add', 'brain.config.json');
  git(repo, 'commit', '-qm', 'team config');
  return readFileSync(path, 'utf8');
}
const declareAxis = (cfg, axis, name, extra = {}) => { cfg[axis] = { ...(cfg[axis] ?? {}), default: name, providers: { ...(cfg[axis]?.providers ?? {}), [name]: {} }, ...extra }; };

function bootstrap({ root, repo }, { extraEnv = {}, tty = null } = {}) {
  let cmd = 'bash';
  let args = ['brain/scripts/bootstrap.sh'];
  let stdio = ['ignore', 'pipe', 'pipe'];
  let fd = null;
  if (tty !== null) { // a real pty: `[ -t 0 ]` is true; the answers are read from a FILE
    const answers = join(root, 'answers.txt');
    writeFileSync(answers, tty);
    fd = openSync(answers, 'r');
    cmd = '/usr/bin/script';
    args = ['-qec', 'bash brain/scripts/bootstrap.sh', '/dev/null'];
    stdio = [fd, 'pipe', 'pipe'];
  }
  try {
    const r = spawnSync(cmd, args, { cwd: repo, encoding: 'utf8', stdio, timeout: 240000, env: env(root, extraEnv) });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

const cliOut = (box, ...args) => spawnSync(NODE, ['brain/scripts/config/cli.mjs', ...args], { cwd: box.repo, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'], env: env(box.root) });
const teamFile = (box) => readFileSync(join(box.repo, 'brain.config.json'), 'utf8');
const userFile = (box) => join(box.home, 'config.json');

test('#1263 existing repo, platform: env:init leaves brain.config.json BYTE-IDENTICAL and writes the person\'s platform to the user layer', () => {
  const box = fixture('platform');
  const before = existingTeam(box, (c) => { declareAxis(c, 'memory', 'plainfiles'); declareAxis(c, 'sdd', 'gentle-ai'); });
  const r = bootstrap(box);
  assert.equal(teamFile(box), before, `brain.config.json must not change in an existing repo:\n${r.out.slice(-1500)}`);
  const { userConfig, userError } = readUserConfig({ env: { BRAIN_HOME: box.home } });
  assert.equal(userError, null);
  assert.equal(userConfig.platform?.default, 'claude');
  const resolved = cliOut(box, 'resolve', 'platform');
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.match(resolved.stdout, /^claude - user -$/m, 'resolveAxis resolves the person\'s value from the user layer; the repo states none');
  assert.match(r.out, /user config/i);
});

test('#1263 existing repo, undeclared sdd and memory: refused with the named fix, no team write and no user write', () => {
  const box = fixture('undeclared');
  const before = existingTeam(box, (c) => { declareAxis(c, 'platform', 'claude'); });
  const r = bootstrap(box);
  assert.equal(teamFile(box), before);
  assert.equal(existsSync(userFile(box)), false, 'no user write for a team axis');
  assert.match(r.out, /the team has not declared sdd; ask an owner, or propose it with `npm run brain:config -- set sdd\.default <name>` in a PR/);
  assert.match(r.out, /the team has not declared memory; ask an owner, or propose it with `npm run brain:config -- set memory\.default <name>` in a PR/);
});

test('#1263 existing repo, undeclared memory on a TTY: still NO prompt and NO team write', () => {
  const box = fixture('nottyprompt');
  const before = existingTeam(box, (c) => { declareAxis(c, 'platform', 'claude'); declareAxis(c, 'sdd', 'gentle-ai'); });
  const r = bootstrap(box, { tty: 'plainfiles\nplainfiles\n', extraEnv: {} });
  assert.equal(teamFile(box), before, r.out.slice(-1500));
  assert.match(r.out, /the team has not declared memory/);
});

test('#1263 existing repo, LOCKED memory: a differing override is refused and nothing is written to either layer', () => {
  const box = fixture('locked');
  const before = existingTeam(box, (c) => { declareAxis(c, 'platform', 'claude'); declareAxis(c, 'sdd', 'gentle-ai'); declareAxis(c, 'memory', 'plainfiles', { locked: true }); c.memory.providers.engram = {}; });
  const r = bootstrap(box, { extraEnv: { MEMORY_BACKEND: 'engram' } });
  assert.equal(teamFile(box), before);
  assert.equal(existsSync(userFile(box)), false);
  assert.match(r.out, /memory backend 'engram' \(from shell\)[^\n]*memory setup skipped/, 'the override is refused, not run');
  const resolved = spawnSync(NODE, ['brain/scripts/config/cli.mjs', 'resolve', 'memory'], { cwd: box.repo, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'], env: env(box.root, { MEMORY_BACKEND: 'engram' }) });
  assert.equal(resolved.status, 4);
  assert.match(resolved.stderr, /locked by the team/, 'the resolver names the lock and its fix');
  const refused = cliOut(box, 'user-set', 'memory.default', 'engram');
  assert.equal(refused.status, 4);
  assert.equal(existsSync(userFile(box)), false);
});

test('#1263 founding run WITHOUT a TTY: every axis but memory is declared in the team config; memory stays undeclared and diagnose says so (error)', () => {
  const box = fixture('founding-notty');
  const r = bootstrap(box);
  assert.ok(existsSync(join(box.repo, 'brain.config.json')), r.out.slice(-1500));
  const cfg = JSON.parse(teamFile(box));
  assert.equal(cfg.platform.default, 'claude');
  assert.equal(cfg.sdd.default, 'gentle-ai');
  assert.equal(cfg.memory.default, '', 'nothing is guessed (ADR-0004 Amendment 3, ADR-0040)');
  assert.equal(existsSync(userFile(box)), false, 'a founding run declares the TEAM, not the person');
  const d = JSON.parse(cliOut(box, 'diagnose').stdout);
  const f = d.filter((x) => x.axis === 'memory' && x.code === 'axis-undeclared');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'error');
});

test('#1263 founding run WITH a TTY: every axis is declared in the team config', () => {
  const box = fixture('founding-tty', { origin: true });
  writeFileSync(join(box.repo, '.env'), 'VCS_TOKEN=dummy-token-for-the-test\n'); // no PAT prompt: the PAT step is not under test
  const r = bootstrap(box, { tty: 'github\nplainfiles\n' });
  const cfg = JSON.parse(teamFile(box));
  for (const axis of ['vcs', 'memory', 'platform', 'sdd']) assert.notEqual(cfg[axis].default, '', `${axis} must be declared:\n${r.out.slice(-2000)}`);
  assert.equal(cfg.memory.default, 'plainfiles');
  assert.equal(cfg.vcs.default, 'github');
});

// ── slice 3: the foundation names its owner and locks what the team owns (ADR-0040 sections 3-5, ratified points 4 and 6) ──
const lockState = (cfg) => ({ memory: cfg.memory.locked, sdd: cfg.sdd.locked, platform: cfg.platform.locked === true });

test('#1263 founding WITH a TTY and a resolvable login: governance.owners holds the BARE login; memory and sdd are locked, platform is free', () => {
  const box = fixture('found-owner', { origin: true });
  writeFileSync(join(box.repo, '.env'), 'VCS_TOKEN=dummy-token-for-the-test\n');
  git(box.repo, 'config', '--local', 'brain.actor', '@Alice'); // brain.actor is @login; the owner is the login, which is what actor-check compares
  const r = bootstrap(box, { tty: 'github\nplainfiles\n' });
  const cfg = JSON.parse(teamFile(box));
  assert.deepEqual(cfg.governance.owners, ['Alice'], r.out.slice(-2000));
  assert.deepEqual(lockState(cfg), { memory: true, sdd: true, platform: false });
  assert.equal(cfg.memory.default, 'plainfiles');
  assert.equal(diagnoseCodes(box).includes('governance:owners-undeclared'), false);
});

test('#1263 founding WITHOUT a TTY: memory is LOCKED and undeclared, and that config is valid and resolves as undeclared', () => {
  const box = fixture('found-notty-locked');
  const r = bootstrap(box);
  const cfg = JSON.parse(teamFile(box));
  assert.equal(cfg.memory.locked, true, r.out.slice(-1500));
  assert.equal(cfg.memory.default, '');
  assert.equal(cfg.sdd.locked, true);
  assert.equal(validateAxisConfig(cfg).ok, true, JSON.stringify(validateAxisConfig(cfg).errors));
  const resolved = cliOut(box, 'resolve', 'memory');
  assert.equal(resolved.status, 3, 'undeclared, not a lock refusal (4)');
  assert.equal(diagnoseCodes(box).includes('memory:locked-override-refused'), false);
});

test('#1263 founding WITHOUT a login: governance.owners stays [] and diagnose reports owners-undeclared with the fix', () => {
  const box = fixture('found-nologin');
  const r = bootstrap(box);
  const cfg = JSON.parse(teamFile(box));
  assert.deepEqual(cfg.governance.owners, []);
  assert.match(r.out, /governance\.owners is empty/);
  assert.match(r.out, /brain:config -- set governance\.owners <login>/);
  const f = JSON.parse(cliOut(box, 'diagnose').stdout).find((x) => x.code === 'owners-undeclared');
  assert.equal(f.severity, 'warning');
  assert.match(f.fix, /brain:config -- set governance\.owners <login>/);
});

test('#1263 an EXISTING repo is never seeded: with a resolvable login the team config stays byte-identical', () => {
  const box = fixture('existing-noseed');
  const before = existingTeam(box, (c) => { declareAxis(c, 'platform', 'claude'); declareAxis(c, 'sdd', 'gentle-ai'); declareAxis(c, 'memory', 'plainfiles'); });
  git(box.repo, 'config', '--local', 'brain.actor', '@alice');
  bootstrap(box);
  assert.equal(teamFile(box), before);
  assert.equal(Object.hasOwn(JSON.parse(teamFile(box)).governance ?? {}, 'owners') && JSON.parse(teamFile(box)).governance.owners.length > 0, false);
});

function diagnoseCodes(box) {
  return JSON.parse(cliOut(box, 'diagnose').stdout).map((f) => `${f.axis}:${f.code}`);
}
