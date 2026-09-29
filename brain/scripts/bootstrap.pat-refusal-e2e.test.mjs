// bootstrap.pat-refusal-e2e.test.mjs — issue #1112, cold-review round 3,
// should-fix 2: a refused PAT write must not be a clean exit, proven by
// running the REAL bootstrap.sh, not an extracted fragment.
//
// `bootstrap.pat-secret-guard.test.mjs` and `bootstrap.required-failure.test.mjs`
// already prove the write-gate and the REQUIRED_FAILURES/exit-code mechanism
// each in isolation, against lifted fragments (#340). What neither proves is
// that the WHOLE SCRIPT, run for real, actually reaches the write gate with a
// real operator-typed token and actually exits non-zero at the end — that
// needs a genuine interactive run: §3's PAT prompt only fires when `[ -t 0 ]`
// is true, and piped (non-tty) stdin takes the "no TTY" branch instead,
// never reaching the write gate at all. So this test drives bootstrap.sh
// under a REAL pseudo-tty (`__fixtures__/pty-drive.py` — python3 is already a
// required base dependency; Node has no built-in pty) and answers its two
// prompts (open-browser: no; paste-PAT: a fake token) exactly as a human
// would.
//
// SAFETY: everything lives under the OS temp dir (mkdtemp), never under this
// worktree. HOME and ENGRAM_DATA_DIR are redirected into the fixture's own
// temp tree so `gentle-ai install`/engram calls never touch the real
// account's config. GH_CONFIG_DIR is pointed at a nonexistent path and
// GH_TOKEN/GITHUB_TOKEN are cleared, as best-effort isolation for the VCS
// CLI's own `gh auth status` call. The fixture has no `origin` remote at all.
//
// KNOWN RESIDUAL (documented, not a test bug): under a REAL pty specifically
// — not a plain piped subprocess, where the same env vars work as expected —
// `gh auth status` in this sandbox still reports the ambient session's real
// login, despite GH_CONFIG_DIR/GH_TOKEN/GITHUB_TOKEN all being overridden.
// Measured directly: `node vcs/cli.mjs auth-check` returns `false` when
// invoked as a plain child process with these env vars, and `true` when the
// exact same env vars reach it via this pty path. The cause was not fully
// isolated (something in the auth backend behaves differently once attached
// to a real tty — a session bus / keyring lookup outside GH_CONFIG_DIR's
// reach is the leading guess) and is read-only either way (no push, no
// repo write, no token used) — this test asserts nothing about that one
// line and does not depend on its outcome.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { removeTempTree } from './lib/tmp-tree.mjs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = join(HERE, '..', '..');
const PTY_DRIVE = join(HERE, '__fixtures__', 'pty-drive.py');

const PASTED_PAT_VALUE = 'ghp_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE';

/** Copies what a consumer carries after `brain init`: brain/scripts + brain/core, no tests. */
function copyBrain(dest) {
  const keep = (src) => !src.endsWith('.test.mjs') && basename(src) !== '__fixtures__' && basename(src) !== 'node_modules';
  cpSync(join(SOURCE_ROOT, 'brain', 'scripts'), join(dest, 'brain', 'scripts'), { recursive: true, filter: keep });
  cpSync(join(SOURCE_ROOT, 'brain', 'core'), join(dest, 'brain', 'core'), { recursive: true, filter: keep });
}

/**
 * A real consumer fixture with `.env` already TRACKED — the write-gate's
 * refusal scenario blocker 2 covers — and everything else pre-seeded so the
 * ONLY interactive prompts bootstrap.sh reaches are the two the PAT section
 * asks (open-browser, paste-PAT): `brain.config.json` exists (skips the
 * VCS-provider-override prompt, which only fires on a freshly-created
 * config) and `.env` already states `MEMORY_BACKEND` (skips that prompt).
 */
function withTrackedEnvConsumer(fn) {
  const base = mkdtempSync(join(tmpdir(), 'brain-1112-pat-e2e-'));
  const repo = join(base, 'repo');
  try {
    execFileSync('git', ['init', '-q', '-b', 'main', repo]);
    execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', repo, 'config', 'user.name', 'test']);
    copyBrain(repo);
    writeFileSync(
      join(repo, 'package.json'),
      JSON.stringify(
        {
          name: 'pat-e2e-consumer',
          version: '1.0.0',
          private: true,
          scripts: {
            'brain:memory:pull': 'node ./brain/scripts/memory/cli.mjs pull',
            'brain:memory:index': 'node ./brain/scripts/memory/cli.mjs index',
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(repo, 'brain.config.json'),
      JSON.stringify(
        {
          schemaVersion: '0.9.0',
          vcs: { provider: 'github' },
          project: { name: '', slug: 'testowner/pat-e2e-consumer', gitHost: 'github.com', gitProjectId: '', owner: '' },
          governance: {},
        },
        null,
        2,
      ),
    );
    writeFileSync(join(repo, '.env'), 'MEMORY_BACKEND=plainfiles\nAGENT_PLATFORM=claude\nSDD_ENGINE=gentle-ai\n');
    execFileSync('git', ['-C', repo, 'add', 'package.json', 'brain.config.json', '.env', 'brain']);
    execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'chore: seed fixture (tracked .env, on purpose)']);
    return fn(repo, base);
  } finally {
    removeTempTree(base);
  }
}

/** Every file under `root`, recursively — for the "the token is nowhere" scan. */
function allFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === '.git') continue; // git objects are content-addressed blobs, not plaintext greppable the same way; the working tree is what matters
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(root);
  return out;
}

function runBootstrapE2e(repo, base) {
  const homeDir = join(base, 'home');
  const engramDataDir = join(base, 'engram-data');
  const ghConfigDir = join(base, 'gh-config-nonexistent');
  const steps = JSON.stringify([
    ['Open the browser', Buffer.from('n\n').toString('base64')],
    ['Paste your PAT', Buffer.from(`${PASTED_PAT_VALUE}\n`).toString('base64')],
  ]);
  return spawnSync('python3', [PTY_DRIVE, 'bash', 'brain/scripts/bootstrap.sh'], {
    cwd: repo,
    encoding: 'utf8',
    timeout: 100_000,
    env: {
      PATH: process.env.PATH,
      HOME: homeDir,
      ENGRAM_DATA_DIR: engramDataDir,
      GH_CONFIG_DIR: ghConfigDir,
      GH_TOKEN: '',
      GITHUB_TOKEN: '',
      PTY_STEPS: steps,
      PTY_TIMEOUT: '90',
    },
  });
}

test('#1112 e2e: env:init refuses a tracked .env, never writes the token, names the refusal, and exits non-zero', () => {
  withTrackedEnvConsumer((repo, base) => {
    const result = runBootstrapE2e(repo, base);

    assert.notEqual(
      result.status,
      0,
      `env:init must exit non-zero when the PAT write was refused; combined output:\n${result.stdout}\n--- stderr ---\n${result.stderr}`,
    );

    // The refusal itself, and the final summary naming it as a required failure.
    assert.match(result.stdout, /NOT written/, `expected the write-gate's refusal; got:\n${result.stdout}`);
    assert.match(result.stdout, /git rm --cached/, 'the tracked-.env remedy must be named');
    assert.match(result.stdout, /Required step\(s\) failed/, 'the final summary must name the required failure');
    assert.match(result.stdout, /VCS_TOKEN not saved/, 'the summary must name which token was not saved');

    // The fake token must never land anywhere on disk in the fixture — not
    // just in .env (the direct write-gate target), but nowhere at all.
    for (const file of allFiles(repo)) {
      // 'latin1' — byte-preserving, so this never throws on a binary file;
      // the fake token is plain ASCII, so a latin1 decode still finds it
      // byte-for-byte if it is there.
      const content = readFileSync(file, 'latin1');
      assert.doesNotMatch(
        content,
        new RegExp(PASTED_PAT_VALUE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `the fake token must never be written to ${file}`,
      );
    }

    // .env itself is exactly what was seeded — MEMORY_BACKEND/AGENT_PLATFORM/
    // SDD_ENGINE are non-secret and env:init may rewrite those; VCS_TOKEN
    // must never appear.
    const envContent = readFileSync(join(repo, '.env'), 'utf8');
    assert.doesNotMatch(envContent, /VCS_TOKEN=/, '.env must never gain a VCS_TOKEN line');
  });
});
