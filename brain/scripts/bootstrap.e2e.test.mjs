// bootstrap.e2e.test.mjs — the REAL bootstrap.sh, run non-interactively, in a hermetic box (#1127).
//
// The coverage gap this closes: slice A made `memory pull` and `memory index` REQUIRED failures
// and every test around it lifted a snippet, so nothing ran the whole script in a HEALTHY
// environment. It would have exited 1 for a fresh install with the default engram backend and
// no engram binary, for plainfiles with no origin or no upstream, for a repo with no commits and
// for a new worktree branch. Those are usable environments; the failure must be by CAUSE.
//
// Hermetic: `stdin </dev/null`, a HOME and XDG_RUNTIME_DIR under the run's temp root,
// DBUS_SESSION_BUS_ADDRESS empty, and a PATH made ONLY of a curated shim dir — every host
// binary EXCEPT gh, glab, engram, gentle-ai, codex, gga, claude and grep (grep is a python3
// shim, so nothing depends on the host having one). The brain tree under test is COPIED into
// the fixture: `memory/cli.mjs` resolves its repo root from its own module location, so a
// symlink would make it pull in the developer's real checkout.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync, readFileSync, readdirSync, symlinkSync, chmodSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname as dn } from 'node:path';
import { testTmp } from './lib/test-tmp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const ABSENT = new Set(['gh', 'glab', 'engram', 'gentle-ai', 'codex', 'gga', 'claude', 'grep', 'egrep', 'fgrep']);

const GREP_SHIM = `#!/usr/bin/env python3
import re, sys
args = sys.argv[1:]
flags, pats, files = set(), [], []
i = 0
while i < len(args):
    a = args[i]
    if a == '-e': pats.append(args[i + 1]); i += 2; continue
    if a.startswith('-') and len(a) > 1: flags |= set(a[1:]); i += 1; continue
    (pats if not pats else files).append(a); i += 1
pat = pats[0]
if 'F' in flags: pat = re.escape(pat)
rx = re.compile(pat, re.I if 'i' in flags else 0)
data = [sys.stdin.read()] if not files else []
lines = []
for f in files:
    try: lines += open(f, errors='replace').read().splitlines()
    except OSError: sys.exit(2)
if not files: lines = data[0].splitlines()
hit = [l for l in lines if bool(rx.search(l)) != ('v' in flags)]
if 'q' not in flags:
    for l in hit: print(l)
sys.exit(0 if hit else 1)
`;

let sharedBin = null;
function shimBin() {
  if (sharedBin) return sharedBin;
  const bin = testTmp('bootstrap-e2e-bin-');
  for (const dir of ['/usr/bin', '/bin']) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (ABSENT.has(name) || existsSync(join(bin, name))) continue;
      try { symlinkSync(join(dir, name), join(bin, name)); } catch { /* swallow-ok: a duplicate or unlinkable name only means one fewer host tool in the shim dir; the run then fails loudly if it was needed */ }
    }
  }
  for (const name of ['node', 'npm']) {
    const found = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).stdout.trim();
    symlinkSync(found, join(bin, name));
  }
  writeFileSync(join(bin, 'grep'), GREP_SHIM);
  chmodSync(join(bin, 'grep'), 0o755);
  sharedBin = bin;
  return bin;
}

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { PATH: shimBin(), HOME: cwd, GIT_CONFIG_NOSYSTEM: '1' } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A fixture repo carrying a COPY of the brain under test. */
function fixture(name, { commit = true } = {}) {
  const root = testTmp(`bootstrap-e2e-${name}-`);
  const repo = join(root, 'repo');
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 't@example.com');
  git(repo, 'config', 'user.name', 't');
  installBrain(repo);
  if (commit) {
    writeFileSync(join(repo, 'notes.txt'), 'a\n');
    git(repo, 'add', 'notes.txt');
    git(repo, 'commit', '-qm', 'seed');
  }
  return { root, repo };
}

function installBrain(dir) {
  cpSync(join(REPO, 'brain'), join(dir, 'brain'), {
    recursive: true,
    filter: (src) => !src.includes('node_modules') && !/\.test\.mjs$/.test(src),
  });
  cpSync(join(REPO, 'package.json'), join(dir, 'package.json'));
}

/** Runs the real bootstrap.sh from `cwd`. */
function bootstrap(cwd, root) {
  const r = spawnSync('bash', ['brain/scripts/bootstrap.sh'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
    env: {
      PATH: shimBin(),
      HOME: join(root, 'home'),
      XDG_RUNTIME_DIR: join(root, 'xdg'),
      DBUS_SESSION_BUS_ADDRESS: '',
      ENGRAM_DATA_DIR: join(root, 'engram-data'),
      GIT_CONFIG_NOSYSTEM: '1',
    },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const useBackend = (repo, backend) => writeFileSync(join(repo, '.env'), `MEMORY_BACKEND=${backend}\n`);

function assertHealthy(r, nextStep) {
  assert.equal(r.code, 0, `a usable environment must exit 0:\n${r.out.slice(-1500)}`);
  assert.match(r.out, nextStep, `the optional next step must be printed:\n${r.out.slice(-1500)}`);
  assert.doesNotMatch(r.out, /did NOT complete successfully/, r.out.slice(-800));
}

test('#1127 e2e (a): fresh repo, no commits, no origin, engram declared, no engram binary -> exit 0 with the next step', () => {
  const { root, repo } = fixture('a', { commit: false });
  useBackend(repo, 'engram'); // #1165: engram is no longer a silent default — it must be declared
  const r = bootstrap(repo, root);
  assertHealthy(r, /brain:memory:pull/);
  assert.match(r.out, /brain:memory:index/);
});

test('#1127 e2e (b): plainfiles with no origin -> exit 0 with the next step', () => {
  const { root, repo } = fixture('b');
  useBackend(repo, 'plainfiles');
  assertHealthy(bootstrap(repo, root), /npm run brain:memory:pull/);
});

test('#1127 e2e (c): plainfiles with an origin but no upstream branch -> exit 0 with the next step', () => {
  const { root, repo } = fixture('c');
  const origin = join(root, 'origin.git');
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(repo, 'remote', 'add', 'origin', origin);
  useBackend(repo, 'plainfiles');
  assertHealthy(bootstrap(repo, root), /npm run brain:memory:pull/);
});

test('#1127 e2e (d): a new worktree branch with no upstream -> exit 0 with the next step', () => {
  const { root, repo } = fixture('d');
  useBackend(repo, 'plainfiles');
  const wt = join(root, 'wt');
  git(repo, 'worktree', 'add', '-q', wt, '-b', 'feature/x');
  installBrain(wt);
  assertHealthy(bootstrap(wt, root), /npm run brain:memory:pull/);
});

test('#1127 e2e (e): plainfiles with a REAL merge refusal is a required failure -> exit 1, said as such', () => {
  const { root, repo } = fixture('e');
  const origin = join(root, 'origin.git');
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', '-u', 'origin', 'main');
  // Someone else changes notes.txt upstream; the local checkout has an uncommitted edit to it.
  const other = join(root, 'other');
  git(root, 'clone', '-q', origin, other);
  git(other, 'config', 'user.email', 'o@example.com');
  git(other, 'config', 'user.name', 'o');
  writeFileSync(join(other, 'notes.txt'), 'b\n');
  git(other, 'commit', '-qam', 'upstream change');
  git(other, 'push', '-q', 'origin', 'main');
  writeFileSync(join(repo, 'notes.txt'), 'c\n');
  useBackend(repo, 'plainfiles');
  const r = bootstrap(repo, root);
  assert.equal(r.code, 1, r.out.slice(-1500));
  assert.match(r.out, /memory pull failed/);
  assert.match(r.out, /did NOT complete successfully/);
  assert.doesNotMatch(r.out, /pull failed[^\n]*non-blocking/i, 'a required failure must not call itself non-blocking');
});

// ── #1165: the team's backend is tracked config; nothing is guessed ─────────────────────────────

const declare = (repo, backend) => writeFileSync(join(repo, 'brain.config.json'), JSON.stringify({ memory: { backend } }));
const envText = (repo) => (existsSync(join(repo, '.env')) ? readFileSync(join(repo, '.env'), 'utf8') : '');

test('#1165 e2e: a FRESH checkout with no .env runs the backend the tracked config declares, and writes no .env line', () => {
  const { root, repo } = fixture('decl-config');
  declare(repo, 'plainfiles');
  const r = bootstrap(repo, root);
  assertHealthy(r, /npm run brain:memory:pull/);
  assert.match(r.out, /memory backend: plainfiles \(brain\.config\.json\)/, r.out.slice(-1500));
  assert.doesNotMatch(envText(repo), /MEMORY_BACKEND/, 'env:init must not re-create the per-machine drift');
  assert.equal(existsSync(join(repo, '.engram')), false, 'the engram setup must not have run');
});

test('#1165 e2e: nothing declared and no TTY -> nothing is guessed: no engram setup, no .env line, the fix is named', () => {
  const { root, repo } = fixture('decl-none');
  const r = bootstrap(repo, root);
  assert.equal(r.code, 0, r.out.slice(-1500));
  assert.match(r.out, /no memory backend is declared/, r.out.slice(-1500));
  assert.match(r.out, /brain:config -- set memory\.backend/);
  assert.doesNotMatch(envText(repo), /MEMORY_BACKEND/);
  assert.equal(existsSync(join(repo, '.engram')), false, 'engram must not have been guessed');
  assert.doesNotMatch(r.out, /memory backend: engram/);
});

test('#1165 e2e: an existing consumer with only .env keeps working unchanged, and is told the value is invisible to teammates', () => {
  const { root, repo } = fixture('decl-envonly');
  useBackend(repo, 'plainfiles');
  const r = bootstrap(repo, root);
  assertHealthy(r, /npm run brain:memory:pull/);
  assert.match(r.out, /memory backend: plainfiles \(\.env\)/);
  assert.match(r.out, /brain:config -- set memory\.backend plainfiles/, 'the move-to-team-config one-liner is printed');
  const cfg = JSON.parse(readFileSync(join(repo, 'brain.config.json'), 'utf8'));
  assert.ok(!cfg.memory?.backend, 'never migrated silently: a tracked-file edit is the operator\'s to make');
});

test('#1165 e2e: .env overriding a different team value is reported', () => {
  const { root, repo } = fixture('decl-shadow');
  declare(repo, 'engram');
  useBackend(repo, 'plainfiles');
  const r = bootstrap(repo, root);
  assert.equal(r.code, 0, r.out.slice(-1500));
  assert.match(r.out, /overrides brain\.config\.json memory\.backend \(engram\)/, r.out.slice(-1500));
});

test('#1165 e2e: the write env:init performs on a TTY (`config set memory.backend`) lands in tracked config and the resolver reads it', () => {
  const { root, repo } = fixture('decl-write');
  const env = { PATH: shimBin(), HOME: join(root, 'home') };
  writeFileSync(join(repo, 'brain.config.json'), JSON.stringify({ schemaVersion: '1.9.0' }));
  const set = spawnSync('node', ['brain/scripts/config/cli.mjs', 'set', 'memory.backend', 'plainfiles'], { cwd: repo, encoding: 'utf8', env });
  assert.equal(set.status, 0, set.stderr);
  const res = spawnSync('node', ['brain/scripts/memory/lib/backend-resolve.mjs', '--root', '.'], { cwd: repo, encoding: 'utf8', env });
  assert.equal(res.stdout, 'plainfiles config\n');
  assert.doesNotMatch(envText(repo), /MEMORY_BACKEND/);
});

test('#1165 cold-5 e2e: an unreadable brain.config.json is reported as unreadable, never as "no memory backend is declared"', () => {
  const { root, repo } = fixture('decl-badconfig');
  writeFileSync(join(repo, 'brain.config.json'), '{ not json');
  const r = bootstrap(repo, root);
  assert.match(r.out, /could not read brain\.config\.json/, r.out.slice(-1500));
  assert.doesNotMatch(r.out, /no memory backend is declared/);
});
