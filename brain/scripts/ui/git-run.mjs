// git-run.mjs — the UI server's one default `git` runner, and the one rule for
// reading its failure (#1218 R4). Three copies of this lived in server.mjs,
// change-route.mjs and watcher.mjs, each spawning with stderr ignored: a failed
// read reached the reader as the command line ("Command failed: git rev-parse
// …") and never as git's own cause. Stderr is piped here, so `err.stderr`
// holds it.

import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * `(file, args, {maxBuffer, input}?) => stdout` run in `root`. `opts.maxBuffer` sizes a
 * document read's own buffer (#1198); `opts.input` is written to git's stdin (#1276 D91:
 * the bytes `git blame --contents -` reads). stdin is only a pipe when input is given.
 */
export function gitRun(root) {
  return (file, args, opts) => execFileSync(file, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: [opts?.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    ...(opts?.maxBuffer ? { maxBuffer: opts.maxBuffer } : {}),
    ...(opts?.input === undefined ? {} : { input: opts.input }),
  });
}

export { gitErrorLine } from '../lib/git-tree.mjs';

/** The one fetch's ceiling (#1201 D39): a hung ssh costs up to this off the event loop, never on it. */
export const FETCH_TIMEOUT_MS = 20000;
const execFileAsync = promisify(execFile);

/**
 * `(file, args, {timeout}?) => Promise<stdout>` run in `root` WITHOUT blocking the
 * event loop (#1201 D39): the fetch is the one slow git call, and a synchronous
 * one would stall SSE and HTTP for as long as the network does. `GIT_TERMINAL_PROMPT=0`
 * is set on a COPY of the environment, never on `process.env`. A rejection carries
 * `.stderr` (so `gitErrorLine` works unchanged), and a timeout is a `SIGKILL`.
 */
export function gitRunAsync(root) {
  return async (file, args, opts) => {
    const { stdout } = await execFileAsync(file, args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      killSignal: 'SIGKILL',
      ...(opts?.timeout ? { timeout: opts.timeout } : {}),
    });
    return stdout;
  };
}
