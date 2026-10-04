// git-run.test.mjs — the one default `git` runner of the UI server, and the
// one rule for turning its failure into a reason line (#1218 R4).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gitRun, gitRunAsync, gitErrorLine, FETCH_TIMEOUT_MS } from './git-run.mjs';
import { testTmp } from '../lib/test-tmp.mjs';

const fail = (stderr, message = 'Command failed: git x') => Object.assign(new Error(message), stderr === undefined ? {} : { stderr });

test('#1218 R1218-10: the cause line is the first fatal: or error: line, even after earlier lines', () => {
  assert.equal(gitErrorLine(fail('fatal: Needed a single revision\n')), 'fatal: Needed a single revision');
  assert.equal(gitErrorLine(fail('hint: something\nfatal: bad revision\nhint: more')), 'fatal: bad revision');
  assert.equal(gitErrorLine(fail('warning: x\nerror: first\nfatal: second')), 'error: first');
});

test('#1218 R1218-10: without a fatal or error line the first non-empty stderr line is used', () => {
  assert.equal(gitErrorLine(fail('\n\nwarning: first\nsecond\n')), 'warning: first');
});

test('#1218 R1218-10: without stderr the first message line is used, trimmed', () => {
  assert.equal(gitErrorLine(new Error('  boom\nsecond line')), 'boom');
  assert.equal(gitErrorLine(fail('', 'Command failed: git y\nsomething')), 'Command failed: git y');
});

test('#1218 R1218-10: the line is capped at 200 characters with an ellipsis, and 200 exactly is kept', () => {
  const cut = gitErrorLine(fail('x'.repeat(500)));
  assert.equal(cut.length, 200);
  assert.ok(cut.endsWith('…'));
  assert.equal(gitErrorLine(fail('y'.repeat(200))), 'y'.repeat(200));
  assert.equal(gitErrorLine(fail('z'.repeat(500)), 20).length, 20);
});

test('#1218 R1218-10: the reason never contains a newline, and a Buffer stderr is read', () => {
  for (const err of [fail('a\r\nb'), fail('fatal: x\r\ny'), fail(Buffer.from('fatal: from a buffer\nmore'))]) {
    assert.doesNotMatch(gitErrorLine(err), /[\r\n]/);
  }
  assert.equal(gitErrorLine(fail(Buffer.from('fatal: from a buffer\nmore'))), 'fatal: from a buffer');
});

test('#1218 R1218-9: a failing command exposes git\'s own message on err.stderr', () => {
  const run = gitRun(testTmp('git-run-'));
  assert.throws(() => run('git', ['rev-parse', '--verify', 'no-such-rev^{commit}']), (err) => /fatal|error|not a git repository/.test(err.stderr ?? ''));
});

test('#1218 R1218-9: in a real repository the missing-revision failure reads fatal: Needed a single revision', async () => {
  const { execFileSync } = await import('node:child_process');
  const root = testTmp('git-run-repo-');
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  const run = gitRun(root);
  assert.throws(() => run('git', ['rev-parse', '--verify', 'nope^{commit}']), (err) => {
    assert.match(err.stderr, /fatal: Needed a single revision/);
    assert.equal(gitErrorLine(err), 'fatal: Needed a single revision');
    return true;
  });
});

test('#1218 R1218-9: a maxBuffer option is passed through and the output is returned as text', () => {
  const root = testTmp('git-run-out-');
  const run = gitRun(root);
  assert.equal(typeof run('git', ['--version'], { maxBuffer: 1024 * 1024 }), 'string');
});

// ── #1201 D39: the asynchronous runner behind the fetch ──────────────────────

/** Sized for a CI runner (about 3x a local run): a killed child must reject well inside this, or the kill did not work. */
const FETCH_TIMEOUT_TEST_BOUND_MS = 5000;
const CHILD_TIMEOUT_MS = 200;
const TICK_MS = 20;

test('#1201 D39: FETCH_TIMEOUT_MS is 20 seconds', () => {
  assert.equal(FETCH_TIMEOUT_MS, 20000);
});

test('#1201 D39: gitRunAsync resolves with stdout, and rejects with an error that carries .stderr so gitErrorLine works unchanged', async () => {
  const run = gitRunAsync(testTmp('async-run-'));
  assert.equal(await run(process.execPath, ['-e', 'process.stdout.write("out")']), 'out');
  await assert.rejects(
    () => run(process.execPath, ['-e', 'console.error("fatal: Could not resolve host"); process.exit(3)']),
    (err) => { assert.match(err.stderr, /Could not resolve host/); assert.equal(gitErrorLine(err), 'fatal: Could not resolve host'); return true; },
  );
});

test('#1201 D39: GIT_TERMINAL_PROMPT=0 reaches the child without mutating the server\'s own environment', async () => {
  const before = process.env.GIT_TERMINAL_PROMPT;
  const run = gitRunAsync(testTmp('async-env-'));
  assert.equal(await run(process.execPath, ['-e', 'process.stdout.write(String(process.env.GIT_TERMINAL_PROMPT))']), '0');
  assert.equal(process.env.GIT_TERMINAL_PROMPT, before);
});

test('#1201 D39: a child that never exits is killed with SIGKILL at the timeout, and the event loop keeps ticking meanwhile', async (t) => {
  const run = gitRunAsync(testTmp('async-kill-'));
  let ticks = 0;
  const interval = setInterval(() => { ticks += 1; }, TICK_MS);
  t.after(() => clearInterval(interval));
  const started = Date.now();
  await assert.rejects(
    () => run(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], { timeout: CHILD_TIMEOUT_MS }),
    (err) => { assert.equal(err.killed, true); assert.equal(err.signal, 'SIGKILL'); return true; },
  );
  const elapsed = Date.now() - started;
  t.diagnostic(`killed after ${elapsed} ms, ${ticks} ticks of ${TICK_MS} ms`);
  assert.ok(elapsed < FETCH_TIMEOUT_TEST_BOUND_MS, `killed within the bound (${elapsed} ms)`);
  assert.ok(ticks >= 2, `the event loop stayed responsive while the child hung (${ticks} ticks)`);
});

test('#1276 D91: `opts.input` is piped to git\'s stdin, and a call without it still has no stdin', async () => {
  const { execFileSync } = await import('node:child_process');
  const root = testTmp('git-run-input-');
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  const run = gitRun(root);
  const expected = execFileSync('git', ['hash-object', '--stdin'], { cwd: root, input: 'hello\n', encoding: 'utf8' });
  assert.equal(run('git', ['hash-object', '--stdin'], { input: 'hello\n' }), expected);
  assert.equal(run('git', ['hash-object', '--stdin']), execFileSync('git', ['hash-object', '--stdin'], { cwd: root, input: '', encoding: 'utf8' }), 'no input: stdin is closed and git reads an empty one');
});
