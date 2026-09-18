// lane-ship-invoker.e2e.test.mjs — the invoker guard (#1012) proven through
// the REAL callers, end to end: the SessionEnd hook chain, the day-start
// sweep chain, and the manual npm script. Every scenario here still goes
// through a FAKE vcs port (BRAIN_VCS_TEST_MODULE) and a fixture
// BRAIN_MEMORY_TEST_ROOT — never the real repo, never a real network call
// (same discipline as cli.ship.test.mjs's own header comment). What this
// file proves that no unit test can: that `session-end-ship.mjs` and
// `day-start-sweep.mjs` — spawned exactly the way SessionEnd and day:start
// spawn them — actually reach `cli.mjs ship` carrying their own `--invoker`
// marker, all the way through a real child process boundary.
//
// npm is spawned the way test/publish-allowlist.e2e.test.mjs:84 does it —
// execFileSync, never a hardcoded absolute path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

import { testTmp } from '../brain/scripts/lib/test-tmp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const CLI = join(REPO_ROOT, 'brain/scripts/memory/cli.mjs');
const FAKE_VCS_MODULE = join(REPO_ROOT, 'brain/scripts/memory/__fixtures__/fake-vcs-port.mjs');

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} (cwd=${cwd}): ${r.stderr}`);
  return r.stdout;
}

/** A bare origin + a `main` checkout with a candidate record — mirrors
 * cli.ship.test.mjs's own `fixtureRepo({ withCandidate: true })` (not
 * exported; duplicated deliberately, same as that file's own header notes
 * about its committed fixture). */
function fixtureRepo({ withCandidate = false } = {}) {
  const base = testTmp('e2e-ship-invoker-');
  const originDir = join(base, 'origin.git');
  const mainDir = join(base, 'main');
  git(base, 'init', '--bare', '-q', originDir);
  git(base, 'init', '-q', '-b', 'main', mainDir);
  git(mainDir, 'remote', 'add', 'origin', originDir);
  git(mainDir, 'config', 'user.email', 'test@example.invalid');
  git(mainDir, 'config', 'user.name', 'brain-test');
  git(mainDir, 'commit', '-q', '--allow-empty', '-m', 'root');
  git(mainDir, 'push', '-q', '-u', 'origin', 'main');
  git(mainDir, 'fetch', '-q', 'origin');
  if (withCandidate) {
    const recDir = join(mainDir, '.memory', 'records');
    mkdirSync(recDir, { recursive: true });
    writeFileSync(
      join(recDir, '2026-09-rec-1111111111111111.jsonl'),
      JSON.stringify({
        id: 'rec-1111111111111111', ts: '2026-09-09T00:00:00Z', actor: '@t',
        actorKind: 'agent', type: 'discovery', project: 'brain', content: 'x',
      }) + '\n',
      'utf8',
    );
  }
  return { mainDir, originDir };
}

function writeVcsScript(base, script) {
  const path = join(base, 'vcs-script.json');
  writeFileSync(path, JSON.stringify(script), 'utf8');
  return path;
}

/** Reads the JSON `ship` result line out of a SessionEnd log — the log
 * carries BOTH stdout (the --json result) and stderr (evidence lines) on
 * the same fd, so this scans for the one line that parses as an object
 * carrying `invoker`. */
function findResultLine(text) {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if ('invoker' in parsed) return parsed;
    } catch { /* not the JSON line — an evidence line, keep scanning */ }
  }
  return null;
}

async function pollLog(logPath, { timeoutMs = 30_000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(logPath)) {
      const text = readFileSync(logPath, 'utf8');
      const result = findResultLine(text);
      if (result) return { text, result };
    }
    await delay(intervalMs);
  }
  const text = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  throw new Error(`lane-ship-invoker.e2e: log at ${logPath} never carried a parseable ship result within ${timeoutMs}ms. Contents so far:\n${text}`);
}

// ── Scenario 1: hook chain reaches the fake port with --invoker hook ──────

test('#1012 (1) npm run brain:memory:session-end spawns cli.mjs ship --invoker hook; the fake port receives the call, pr.number:999', { skip: process.platform === 'win32' ? 'POSIX mode bits only (session-end-ship.mjs C7)' : false }, async () => {
  const { mainDir, originDir } = fixtureRepo({ withCandidate: true });
  const scriptPath = writeVcsScript(mainDir, { mrCreate: { url: 'https://example.invalid/pull/999' } });
  const tmpRoot = testTmp('e2e-ship-invoker-tmp-');

  const run = execFileSync('npm', ['run', 'brain:memory:session-end'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      BRAIN_MEMORY_TEST_ROOT: mainDir,
      MEMORY_BACKEND: 'no-such-backend',
      BRAIN_VCS_TEST_MODULE: FAKE_VCS_MODULE,
      BRAIN_VCS_TEST_SCRIPT: scriptPath,
      TMPDIR: tmpRoot,
      TEMP: tmpRoot,
    },
  });
  assert.doesNotMatch(run, /Error/i, `session-end launcher must exit clean: ${run}`);

  const uid = typeof process.getuid === 'function' ? process.getuid() : process.env.USER ?? process.env.USERNAME;
  const date = new Date().toISOString().slice(0, 10);
  const logPath = join(tmpRoot, `brain-lane-${uid}`, `brain-lane-ship-${hostname()}-${date}.log`);

  const { result } = await pollLog(logPath);
  assert.equal(result.invoker, 'hook');
  assert.equal(result.pr?.number, 999);

  const laneRefs = git(originDir, 'for-each-ref', '--format=%(refname)', 'refs/heads/memory/');
  assert.match(laneRefs, /refs\/heads\/memory\//, 'the lane ref must land on the local origin');
});

// ── Scenario 2: hook chain WITHOUT the fake port, non-git root: invokerUnderTest ──

test('#1012 (2) the same hook chain without the fake port and a non-git root logs invokerUnderTest — NODE_TEST_CONTEXT reaches the grandchild through env: process.env at every hop', { skip: process.platform === 'win32' ? 'POSIX mode bits only' : false }, async () => {
  const nonGitRoot = testTmp('e2e-ship-invoker-nongit-');
  mkdirSync(nonGitRoot, { recursive: true });
  const tmpRoot = testTmp('e2e-ship-invoker-tmp2-');

  execFileSync('npm', ['run', 'brain:memory:session-end'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      BRAIN_MEMORY_TEST_ROOT: nonGitRoot,
      MEMORY_BACKEND: 'no-such-backend',
      TMPDIR: tmpRoot,
      TEMP: tmpRoot,
    },
  });

  const uid = typeof process.getuid === 'function' ? process.getuid() : process.env.USER ?? process.env.USERNAME;
  const date = new Date().toISOString().slice(0, 10);
  const logPath = join(tmpRoot, `brain-lane-${uid}`, `brain-lane-ship-${hostname()}-${date}.log`);

  const deadline = Date.now() + 30_000;
  let text = '';
  while (Date.now() < deadline) {
    if (existsSync(logPath)) {
      text = readFileSync(logPath, 'utf8');
      if (text.includes('NODE_TEST_CONTEXT')) break;
    }
    await delay(200);
  }
  // The i18n message names NODE_TEST_CONTEXT (see memory.ship.invokerUnderTest
  // in en.mjs) rather than spelling the raw key — this is the refusal text a
  // human/log reader actually sees.
  assert.match(text, /NODE_TEST_CONTEXT/, `expected the invokerUnderTest refusal in the log; got:\n${text}`);
});

// ── Scenario 3: sweep chain ─────────────────────────────────────────────

test('#1012 (3) the sweep chain (runLaneSweep) spawns cli.mjs ship --invoker sweep and reaches the fake port', () => {
  const { mainDir } = fixtureRepo({ withCandidate: true });
  const scriptPath = writeVcsScript(mainDir, { mrCreate: { url: 'https://example.invalid/pull/998' } });

  // #1012 self-note (vcs-port-substituted, meta-test allowlist): this is a
  // real spawnSync of a brain/scripts/** entrypoint (cli.mjs ship), wrapped
  // by _spawnSync only to make the call visible to this eval's own return
  // value — it never changes the arguments the real spawnSync receives.
  const code = [
    "import { runLaneSweep } from '" + join(REPO_ROOT, 'brain/scripts/memory/day-start-sweep.mjs').replace(/\\/g, '\\\\') + "';",
    "import { spawnSync } from 'node:child_process';",
    'let capturedStderr = null;',
    'const outcome = runLaneSweep({',
    '  config: { memory: { lane: { enabled: true } } },',
    '  _spawnSync: (cmd, argv, opts) => {',
    '    const r = spawnSync(cmd, argv, { ...opts, encoding: "utf8" });',
    '    capturedStderr = r.stderr;',
    '    return r;',
    '  },',
    '});',
    'process.stdout.write(JSON.stringify({ outcome, capturedStderr }));',
  ].join('\n');

  const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      BRAIN_MEMORY_TEST_ROOT: mainDir,
      MEMORY_BACKEND: 'no-such-backend',
      BRAIN_VCS_TEST_MODULE: FAKE_VCS_MODULE,
      BRAIN_VCS_TEST_SCRIPT: scriptPath,
    },
  });
  assert.equal(run.status, 0, run.stderr);
  const { outcome } = JSON.parse(run.stdout);
  assert.equal(outcome.skipped, false);
  assert.equal(outcome.outcome?.invoker, 'sweep');
  assert.equal(outcome.outcome?.pr?.number, 998);
});

test('#1012 (3, no-port variant) the sweep chain without the fake port refuses: exit 1, invokerUnderTest', () => {
  const nonGitRoot = testTmp('e2e-ship-invoker-sweep-nongit-');
  mkdirSync(nonGitRoot, { recursive: true });

  const code = [
    "import { runLaneSweep } from '" + join(REPO_ROOT, 'brain/scripts/memory/day-start-sweep.mjs').replace(/\\/g, '\\\\') + "';",
    "import { spawnSync } from 'node:child_process';",
    'let capturedStderr = null;',
    'const outcome = runLaneSweep({',
    '  config: { memory: { lane: { enabled: true } } },',
    '  _spawnSync: (cmd, argv, opts) => {',
    '    const r = spawnSync(cmd, argv, { ...opts, encoding: "utf8" });',
    '    capturedStderr = r.stderr;',
    '    return r;',
    '  },',
    '});',
    'process.stdout.write(JSON.stringify({ outcome, capturedStderr }));',
  ].join('\n');

  const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      BRAIN_MEMORY_TEST_ROOT: nonGitRoot,
      MEMORY_BACKEND: 'no-such-backend',
    },
  });
  assert.equal(run.status, 0, run.stderr); // the node -e wrapper itself exits 0; the SPAWNED ship exited 1
  const { outcome, capturedStderr } = JSON.parse(run.stdout);
  assert.equal(outcome.status, 1);
  assert.match(capturedStderr, /NODE_TEST_CONTEXT/);
});

// ── Scenario 4: manual ship ─────────────────────────────────────────────

test('#1012 (4a) npm run brain:memory:ship -- --json returns invoker:\'manual\'', () => {
  const { mainDir } = fixtureRepo();
  const run = execFileSync('npm', ['run', 'brain:memory:ship', '--', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      BRAIN_MEMORY_TEST_ROOT: mainDir,
      MEMORY_BACKEND: 'no-such-backend',
      BRAIN_VCS_TEST_MODULE: FAKE_VCS_MODULE,
    },
  });
  const result = findResultLine(run);
  assert.ok(result, `expected a JSON result line in npm output:\n${run}`);
  assert.equal(result.invoker, 'manual');
});

test('#1012 (4b) npm run brain:memory:ship -- --dry-run --json works with no seam at all (--dry-run is the bypass)', () => {
  const { mainDir } = fixtureRepo();
  const run = execFileSync('npm', ['run', 'brain:memory:ship', '--', '--dry-run', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      BRAIN_MEMORY_TEST_ROOT: mainDir,
      MEMORY_BACKEND: 'no-such-backend',
    },
  });
  const result = findResultLine(run);
  assert.ok(result, `expected a JSON result line in npm output:\n${run}`);
  assert.equal(result.invoker, 'manual');
  assert.equal(result.dryRun, true);
});
