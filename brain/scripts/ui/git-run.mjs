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

export { gitErrorLine } from '../lib/git-tree.mjs';
