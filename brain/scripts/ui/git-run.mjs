// git-run.mjs — the UI server's one default `git` runner, and the one rule for
// reading its failure (#1218 R4). Three copies of this lived in server.mjs,
// change-route.mjs and watcher.mjs, each spawning with stderr ignored: a failed
// read reached the reader as the command line ("Command failed: git rev-parse
// …") and never as git's own cause. Stderr is piped here, so `err.stderr`
// holds it.

import { execFileSync } from 'node:child_process';

/**
 * `(file, args, {maxBuffer}?) => stdout` run in `root`. `opts.maxBuffer` is the
 * only option a caller may pass: a document read sizes its own buffer (#1198).
 */
export function gitRun(root) {
  return (file, args, opts) => execFileSync(file, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(opts?.maxBuffer ? { maxBuffer: opts.maxBuffer } : {}),
  });
}

const CAUSE = /^(?:fatal|error):/;

/**
 * One line naming why a command failed: the first `fatal:`/`error:` line of
 * stderr, else its first non-empty line, else the first line of the message.
 * Trimmed, on one line, at most `cap` characters (`…` replaces the cut).
 */
export function gitErrorLine(err, cap = 200) {
  const lines = (text) => String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const stderr = lines(err?.stderr);
  const line = stderr.find((l) => CAUSE.test(l)) ?? stderr[0] ?? lines(err?.message ?? err)[0] ?? '';
  return line.length > cap ? `${line.slice(0, cap - 1)}…` : line;
}
