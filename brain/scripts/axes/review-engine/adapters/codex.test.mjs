import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runStage } from './codex.mjs';
import { defaultRun } from '../../lib/agent-runtime.mjs';

function makePaths(t) {
  const root = mkdtempSync(join(tmpdir(), 'codex-backend-'));
  const candidate = join(root, 'candidate');
  const outputDir = join(root, 'host-output');
  const home = join(root, 'home');
  const codexHome = join(home, '.codex');
  mkdirSync(candidate);
  mkdirSync(outputDir);
  mkdirSync(codexHome, { recursive: true });
  writeFileSync(join(codexHome, 'auth.json'), '{"access_token":"oauth-secret"}\n', { mode: 0o600 });
  t.after(() => import('../../../__fixtures__/tmp-tree.mjs').then(({ removeTempTree }) => removeTempTree(root)));
  return {
    root, candidate, home, codexHome,
    tempPath: join(outputDir, 'last-message.md'), artifactPath: join(outputDir, 'cold-review.md'),
  };
}

function output(paths) {
  return { mode: 'final-message', tempPath: paths.tempPath, artifactPath: paths.artifactPath };
}

const BASE_ENV = {
  PATH: process.env.PATH ?? '',
  SAFE_VALUE: 'kept',
  BRAIN_REVIEWER_TOKEN: 'secret',
  GH_TOKEN: 'secret',
};

function testEnv(paths, extra = {}) {
  return { ...BASE_ENV, HOME: paths.home, ...extra };
}

test('runs exact read-only gpt-5.5 argv with scrubbed environment and isolated writable CODEX_HOME', async (t) => {
  const paths = makePaths(t);
  let seen;
  const result = await runStage({
    stage: 'cold-review',
    prompt: 'return the review artifact',
    model: 'gpt-5.5',
    cwd: paths.candidate,
    credentialEnv: ['BRAIN_REVIEWER_TOKEN'],
    forgeConfigDir: join(paths.root, 'forge-shadow'),
    output: output(paths),
    _env: testEnv(paths),
    _run: (bin, args, opts) => {
      seen = { bin, args, opts };
      assert.equal(readFileSync(join(opts.env.CODEX_HOME, 'auth.json'), 'utf8'), '{"access_token":"oauth-secret"}\n');
      assert.equal(statSync(opts.env.CODEX_HOME).mode & 0o777, 0o700);
      assert.equal(statSync(join(opts.env.CODEX_HOME, 'auth.json')).mode & 0o777, 0o600);
      writeFileSync(paths.tempPath, '```brain-findings/1\n[]\n```\n');
      return { status: 0 };
    },
  });

  assert.deepEqual(result.ok, true);
  assert.equal(seen.bin, 'codex');
  assert.deepEqual(seen.args, [
    'exec', '--model', 'gpt-5.5', '--sandbox', 'read-only', '--cd', paths.candidate,
    '--skip-git-repo-check', '--ephemeral', '--ignore-user-config',
    '--output-last-message', paths.tempPath, 'return the review artifact',
  ]);
  assert.equal(seen.opts.cwd, paths.candidate);
  assert.equal(seen.opts.env.SAFE_VALUE, 'kept');
  assert.equal(seen.opts.env.BRAIN_REVIEWER_TOKEN, undefined);
  assert.equal(seen.opts.env.GH_TOKEN, undefined);
  assert.equal(seen.opts.env.GH_CONFIG_DIR, join(paths.root, 'forge-shadow'));
  assert.equal(seen.opts.env.GLAB_CONFIG_DIR, join(paths.root, 'forge-shadow'));
  assert.notEqual(seen.opts.env.CODEX_HOME, paths.codexHome);
  assert.ok(!existsSync(seen.opts.env.CODEX_HOME), 'the per-run Codex home is removed after the result is captured');
});

test('prefers auth.json from CODEX_HOME over the HOME fallback and copies no other config', async (t) => {
  const paths = makePaths(t);
  const configuredHome = join(paths.root, 'configured-codex-home');
  mkdirSync(configuredHome);
  writeFileSync(join(configuredHome, 'auth.json'), '{"access_token":"configured-oauth"}\n', { mode: 0o644 });
  writeFileSync(join(configuredHome, 'config.toml'), 'untrusted config must not travel\n');
  let seenHome;

  const result = await runStage({
    stage: 'cold-review', prompt: 'p', model: 'gpt-5.5', cwd: paths.candidate,
    output: output(paths), _env: testEnv(paths, { CODEX_HOME: configuredHome }),
    _run: (_bin, _args, opts) => {
      seenHome = opts.env.CODEX_HOME;
      assert.equal(readFileSync(join(seenHome, 'auth.json'), 'utf8'), '{"access_token":"configured-oauth"}\n');
      assert.equal(existsSync(join(seenHome, 'config.toml')), false);
      writeFileSync(paths.tempPath, 'ok');
      return { status: 0 };
    },
  });

  assert.equal(result.ok, true);
  assert.ok(!existsSync(seenHome));
});

test('refuses before spawning with a clear OAuth diagnostic when no auth.json is available', async (t) => {
  const paths = makePaths(t);
  let spawned = false;
  let madeHome = false;
  const result = await runStage({
    stage: 'cold-review', prompt: 'p', model: 'gpt-5.5', cwd: paths.candidate,
    output: output(paths), _env: { ...BASE_ENV, HOME: join(paths.root, 'empty-home') },
    _makeCodexHome: () => { madeHome = true; return join(paths.root, 'should-not-exist'); },
    _run: () => { spawned = true; return { status: 0 }; },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /OAuth authentication is unavailable/i);
  assert.match(result.reason, /auth\.json.*\$CODEX_HOME.*\$HOME\/\.codex/i);
  assert.match(result.reason, /codex login/i);
  assert.equal(madeHome, false);
  assert.equal(spawned, false);
});

test('refuses unsafe output paths inside the candidate before spawning', async (t) => {
  const paths = makePaths(t);
  let spawned = false;
  const result = await runStage({
    stage: 'cold-review', prompt: 'p', model: 'gpt-5.5', cwd: paths.candidate,
    output: { mode: 'final-message', tempPath: join(paths.candidate, 'result.md'), artifactPath: paths.artifactPath },
    _env: testEnv(paths),
    _run: () => { spawned = true; return { status: 0 }; },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /outside the candidate/i);
  assert.equal(spawned, false);
});

test('fails closed for timeout, non-zero exit, and missing final-message output', async (t) => {
  const paths = makePaths(t);
  const cases = [
    { name: 'timeout', run: () => ({ error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }) }), expected: /did not finish/i },
    { name: 'non-zero', run: () => ({ status: 2, stderr: 'authentication unavailable' }), expected: /exited with status 2/i },
    { name: 'missing output', run: () => ({ status: 0 }), expected: /wrote no final message/i },
  ];

  for (const entry of cases) {
    const result = await runStage({
      stage: 'cold-review', prompt: 'p', model: 'gpt-5.5', cwd: paths.candidate,
      output: output(paths), _env: testEnv(paths), _run: entry.run,
    });
    assert.equal(result.ok, false, entry.name);
    assert.match(result.reason, entry.expected, entry.name);
  }
});

test('fails closed when isolated-home cleanup cannot be proved', async (t) => {
  const paths = makePaths(t);
  const result = await runStage({
    stage: 'cold-review', prompt: 'p', model: 'gpt-5.5', cwd: paths.candidate,
    output: output(paths), _env: testEnv(paths),
    _makeCodexHome: () => { const home = join(paths.root, 'isolated-home'); mkdirSync(home); return home; },
    _removeCodexHome: () => { throw new Error('cleanup denied'); },
    _run: () => { writeFileSync(paths.tempPath, 'ok'); return { status: 0 }; },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /cleanup/i);
  assert.match(result.reason, /cleanup denied/i);
});

test('cleans the isolated home when copying OAuth authentication fails', async (t) => {
  const paths = makePaths(t);
  const isolatedHome = join(paths.root, 'isolated-home');
  let spawned = false;
  const result = await runStage({
    stage: 'cold-review', prompt: 'p', model: 'gpt-5.5', cwd: paths.candidate,
    output: output(paths), _env: testEnv(paths),
    _makeCodexHome: () => { mkdirSync(isolatedHome); return isolatedHome; },
    _copyAuth: () => { throw new Error('copy denied'); },
    _run: () => { spawned = true; return { status: 0 }; },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /OAuth authentication could not be prepared/i);
  assert.match(result.reason, /copy denied/i);
  assert.equal(spawned, false);
  assert.equal(existsSync(isolatedHome), false);
});

// #1274 — Codex streams progress to stdout; with Node's 1 MiB spawnSync default the
// spawn died with ENOBUFS and the cold review was lost, although the verdict is
// read from --output-last-message, a file. The oracle is the REAL runner, because a
// spy would accept whatever defaultRun does with the options.

function fakeEngine(paths, body) {
  const script = join(paths.root, 'fake-codex.sh');
  writeFileSync(script, `#!/usr/bin/env bash\nout=""\nwhile [ $# -gt 0 ]; do\n  if [ "$1" = "--output-last-message" ]; then out="$2"; fi\n  shift\ndone\n${body}\n`);
  return script;
}

function realRun(script, paths) {
  const stdin = join(paths.root, 'stdin.txt');
  writeFileSync(stdin, '');
  // bash runs the fake engine; stdin comes from a file, never the terminal.
  return (_bin, args, opts) => defaultRun('bash', ['-c', 'exec bash "$0" "$@" < "$STDIN_FILE"', script, ...args], {
    ...opts, timeoutMs: 30_000, env: { ...opts.env, STDIN_FILE: stdin, BRAIN_HOME: join(paths.root, 'brain-home') },
  });
}

test('#1274 a 3 MiB stdout stream does not kill the engine: the verdict is read from the file', async (t) => {
  const paths = makePaths(t);
  const script = fakeEngine(paths, 'head -c 3000000 /dev/zero | tr "\\0" "x"\nprintf "verdict" > "$out"\nexit 0');
  const result = await runStage({
    stage: 'cold-review', prompt: 'p', model: 'gpt-5.5', cwd: paths.candidate,
    output: output(paths), _env: testEnv(paths), _run: realRun(script, paths),
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(readFileSync(paths.tempPath, 'utf8'), 'verdict');
});

test('#1274 a failing engine reports a bounded, printable stderr tail even after huge stdout', async (t) => {
  const paths = makePaths(t);
  const script = fakeEngine(paths, 'head -c 3000000 /dev/zero | tr "\\0" "x"\nhead -c 20000 /dev/zero | tr "\\0" "e" >&2\nprintf "\\001\\002 usage limit reached\\n" >&2\nexit 3');
  const result = await runStage({
    stage: 'cold-review', prompt: 'p', model: 'gpt-5.5', cwd: paths.candidate,
    output: output(paths), _env: testEnv(paths), _run: realRun(script, paths),
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /status 3/);
  assert.match(result.reason, /the engine last said: .*usage limit reached/);
  assert.doesNotMatch(result.reason, /[\u0000-\u0008\u000B-\u001F\u007F]/);
  assert.ok(result.reason.length < 1000, `reason is bounded (${result.reason.length})`);
});

test('#1274 defaultRun discardStdout drops stdout and keeps stderr; the default keeps both', () => {
  const kept = defaultRun('bash', ['-c', 'echo out; echo err >&2']);
  assert.equal(kept.stdout.trim(), 'out');
  const dropped = defaultRun('bash', ['-c', 'echo out; echo err >&2'], { discardStdout: true });
  assert.equal(dropped.stdout, null);
  assert.equal(dropped.stderr.trim(), 'err');
  const big = defaultRun('bash', ['-c', 'head -c 3000000 /dev/zero | tr "\\0" "x"']);
  assert.equal(big.error, undefined, 'the generic default survives >1 MiB of stdout');
  assert.equal(big.stdout.length, 3000000);
});

async function failWithStderr(t, stderr) {
  const paths = makePaths(t);
  return runStage({
    stage: 'cold-review', prompt: 'p', model: 'gpt-5.5', cwd: paths.candidate,
    credentialEnv: ['BRAIN_REVIEWER_TOKEN'], output: output(paths),
    _env: testEnv(paths, { BRAIN_REVIEWER_TOKEN: SECRET }), _run: () => ({ status: 3, stderr }),
  });
}

const SECRET = ['tok', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'].join('-');

function leaks(text) {
  for (let i = 0; i + 6 <= SECRET.length; i += 1) {
    if (text.includes(SECRET.slice(i, i + 6))) return SECRET.slice(i, i + 6);
  }
  return null;
}

test('#1274 a secret followed by carriage-return redraws is redacted before the tail is cut', async (t) => {
  const result = await failWithStderr(t, `auth ${SECRET}${'\r'.repeat(4078)} usage limit`);
  assert.equal(leaks(result.reason), null);
  assert.match(result.reason, /usage limit/);
});

test('#1274 a secret straddling the 4096-char boundary is redacted', async (t) => {
  for (const shift of [1, 10, 20, 30, 40]) {
    const tailPart = ' '.repeat(4096 - shift);
    const result = await failWithStderr(t, `x${SECRET}${tailPart}end`.replace(/ /g, '.'));
    assert.equal(leaks(result.reason), null, `shift ${shift}`);
  }
});
