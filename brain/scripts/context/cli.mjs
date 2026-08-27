#!/usr/bin/env node
// cli.mjs — CLI entrypoint for the Intelligent Context Synthesizer (REQ-CTX-4).
//
// Unlike `brain:session:start`, this verb IS allowed to ask git what changed:
// it is an explicit, interactive invocation, not the local-only session loader
// whose `assertLocalArgv` allowlist deliberately excludes `git diff`.
//
// The base used to be the literal `origin/feature/v2.0.0`, a branch that no
// longer exists in this repository. `git diff` against a missing ref exits
// non-zero, the catch swallowed it, and every run therefore synthesized from
// ZERO touched files — i.e. the core floor and nothing else, on every repo,
// forever. A hardcoded integration branch cannot be right for consumers either:
// this file ships to every repo that adopts brain.

import { execFileSync } from 'node:child_process';

import { synthesizeContext } from './synthesizer.mjs';

/** Run a git command, returning trimmed stdout or null. Never throws. */
function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/**
 * The files this branch changed, best-effort and in descending order of
 * fidelity: the merge-base with the default branch, then the working tree.
 *
 * Falling back to the working tree rather than to nothing is the point: on a
 * detached HEAD, a fresh clone with no `origin`, or a repo whose default branch
 * is named something else, "what am I editing right now" is still a better
 * answer than "no files", which is what the previous version returned always.
 */
function changedFiles() {
  const head = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  for (const ref of ['origin/HEAD', 'origin/main', 'main']) {
    const base = git(['merge-base', 'HEAD', ref]);
    if (!base) continue;
    const diff = git(['diff', '--name-only', `${base}...HEAD`]);
    if (diff) return { files: diff.split('\n').filter(Boolean), base: ref, head };
  }
  const dirty = git(['diff', '--name-only', 'HEAD']);
  return { files: dirty ? dirty.split('\n').filter(Boolean) : [], base: null, head };
}

/** The issue number this branch is about, or null. Same shape brain uses everywhere. */
function issueFromBranch(branch) {
  const m = typeof branch === 'string' ? branch.match(/issue-(\d+)/i) : null;
  return m ? Number(m[1]) : null;
}

async function main() {
  const { files, head } = changedFiles();
  const result = await synthesizeContext({
    touchedFiles: files,
    issue: issueFromBranch(head),
  });
  console.log(result.markdown);
}

main().catch(err => {
  console.error('brain:context:compile error:', err);
  process.exit(1);
});
