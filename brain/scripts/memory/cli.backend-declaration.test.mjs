// cli.backend-declaration.test.mjs — issue #1165, end to end.
//
// The defect: MEMORY_BACKEND lived only in the untracked `.env`. A second
// checkout (a teammate, CI, a FRESH CLONE) has no `.env`, so it silently ran the
// hard-coded default (engram) while the team used plainfiles, and died with
// "engram.search() failed — 'search' is not a cli verb for the 'engram' backend".
//
// So this does not lift a snippet: it builds a real origin, a real FRESH CLONE
// that carries a copy of the brain under test (memory/cli.mjs resolves its repo
// root from its own module location, so a symlink would read the developer's
// checkout), and drives the real cli.mjs in a child process.
//
// Hermetic: PATH is a dir holding only git and which — no engram, so a run that
// reaches the engram adapter fails loudly instead of depending on the host — and
// ENGRAM_DATA_DIR points at a temp dir should one ever be found.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRecord, serializeRecord } from './lib/format.mjs';
import { testTmp } from '../lib/test-tmp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const which = (n) => execFileSync('sh', ['-c', `command -v ${n}`], { encoding: 'utf8' }).trim();
const MARKER = 'plainfiles-team-marker-1165';

let BIN;
let ORIGIN;
let SCRATCH;

function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], {
    cwd, encoding: 'utf8', env: { PATH: BIN, HOME: SCRATCH, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

/** Origin whose tracked tree is a plainfiles consumer: the brain, a config, one record. */
before(() => {
  SCRATCH = testTmp('backend-declaration-');
  BIN = join(SCRATCH, 'bin');
  mkdirSync(BIN);
  symlinkSync(which('git'), join(BIN, 'git'));
  symlinkSync(which('which'), join(BIN, 'which'));

  ORIGIN = join(SCRATCH, 'origin.git');
  git(SCRATCH, 'init', '-q', '--bare', '-b', 'main', ORIGIN);
  const seed = join(SCRATCH, 'seed');
  git(SCRATCH, 'clone', '-q', ORIGIN, seed);
  cpSync(join(REPO, 'brain'), join(seed, 'brain'), {
    recursive: true,
    filter: (src) => !src.includes('node_modules') && !/\.test\.mjs$/.test(src),
  });
  cpSync(join(REPO, 'package.json'), join(seed, 'package.json'));
  mkdirSync(join(seed, '.memory', 'records'), { recursive: true });
  const rec = buildRecord({
    ts: '2026-09-30T12:00:00Z', actor: '@test', actorKind: 'human', type: 'decision', project: 'brain',
    content: `a record only the plainfiles backend can search: ${MARKER}`,
  });
  writeFileSync(join(seed, '.memory', 'records', '2026-09-30.jsonl'), serializeRecord(rec) + '\n');
  writeFileSync(join(seed, '.gitignore'), '.env\n.engram\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qm', 'seed');
  git(seed, 'push', '-q', 'origin', 'HEAD:main');
});

/** A FRESH CLONE of the origin: tracked files only, so no `.env`. `config` is the tracked brain.config.json. */
let n = 0;
function freshClone(config) {
  const dir = join(SCRATCH, `clone-${n++}`);
  git(SCRATCH, 'clone', '-q', ORIGIN, dir);
  if (config !== undefined) writeFileSync(join(dir, 'brain.config.json'), JSON.stringify(config));
  return dir;
}

function run(dir, args, env = {}) {
  return spawnSync(process.execPath, [join(dir, 'brain/scripts/memory/cli.mjs'), ...args], {
    cwd: dir, encoding: 'utf8',
    env: { PATH: BIN, HOME: SCRATCH, ENGRAM_DATA_DIR: join(SCRATCH, 'engram-data'), ...env },
  });
}

test('#1165 (a) a fresh clone with NO .env resolves plainfiles from tracked config: pull and search work', () => {
  const dir = freshClone({ memory: { backend: 'plainfiles' } });
  const pull = run(dir, ['pull']);
  assert.equal(pull.status, 0, pull.stderr);
  assert.doesNotMatch(pull.stderr, /engram/i);
  const search = run(dir, ['search', MARKER]);
  assert.equal(search.status, 0, search.stderr);
  assert.match(search.stdout, new RegExp(MARKER));
  assert.doesNotMatch(search.stderr, /not a cli verb/);
});

test('#1165 (b) the process env beats config, and .env beats config', () => {
  const dir = freshClone({ memory: { backend: 'plainfiles' } });
  const viaEnv = run(dir, ['search', MARKER], { MEMORY_BACKEND: 'engram' });
  assert.equal(viaEnv.status, 1, 'env engram overrides the team plainfiles');
  assert.match(viaEnv.stderr, /engram\.search\(\) failed/);

  writeFileSync(join(dir, '.env'), 'MEMORY_BACKEND=engram\n');
  const viaDotenv = run(dir, ['search', MARKER]);
  assert.equal(viaDotenv.status, 1, '.env engram overrides the team plainfiles');
  assert.match(viaDotenv.stderr, /engram\.search\(\) failed/);

  const envOverDotenv = run(dir, ['search', MARKER], { MEMORY_BACKEND: 'plainfiles' });
  assert.equal(envOverDotenv.status, 0, 'process env beats .env');
  assert.match(envOverDotenv.stdout, new RegExp(MARKER));
});

test('#1165 (c) nothing declared anywhere is a REFUSAL that names the fix, not engram', () => {
  for (const config of [{ memory: { backend: '' } }, { memory: {} }, {}]) {
    const dir = freshClone(config);
    for (const args of [['pull'], ['search', MARKER], ['import'], ['heal-duplicates']]) {
      const r = run(dir, args);
      assert.equal(r.status, 1, `${args[0]} must refuse: ${r.stdout}${r.stderr}`);
      assert.match(r.stderr, /memory\.backend/, 'names the config key');
      assert.match(r.stderr, /brain:config -- set memory\.backend/, 'names the command that fixes it');
      assert.doesNotMatch(r.stderr, /engram binary not found|not a cli verb|substituted|records-only `plainfiles` backend instead/,
        'must not have guessed engram');
    }
  }
});

test('#1165 (c) an undeclared consumer can still do backend-free work (reindex needs no backend)', () => {
  const dir = freshClone({});
  const r = run(dir, ['reindex']);
  assert.equal(r.status, 0, r.stderr);
});

test('#1165 (c) an INVALID declaration is refused as a typo, never coerced', () => {
  const dir = freshClone({ memory: { backend: 'plainfile' } });
  const r = run(dir, ['pull']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /'plainfile'/);
  assert.match(r.stderr, /engram \| plainfiles/);
});

test('#1165 (d) an existing consumer with only .env (config has no memory.backend key) is unchanged', () => {
  const dir = freshClone({ project: { name: 'x' } });
  writeFileSync(join(dir, '.env'), 'MEMORY_BACKEND=plainfiles\n');
  const pull = run(dir, ['pull']);
  assert.equal(pull.status, 0, pull.stderr);
  const search = run(dir, ['search', MARKER]);
  assert.equal(search.status, 0, search.stderr);
  assert.match(search.stdout, new RegExp(MARKER));
});

test('#1165 the tracked config the fixture carries is not mutated by a read', () => {
  const dir = freshClone({ memory: { backend: 'plainfiles' } });
  const before = readFileSync(join(dir, 'brain.config.json'), 'utf8');
  run(dir, ['search', MARKER]);
  assert.equal(readFileSync(join(dir, 'brain.config.json'), 'utf8'), before);
});
