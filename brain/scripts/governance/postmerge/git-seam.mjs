// git-seam.mjs — the ONE git primitive the platform-neutral core is built
// on. A throw-only boolean seam cannot express git's own tri-states (e.g.
// `ls-remote --exit-code` 0/2/other, `diff --quiet` 0/1/128); this seam
// returns the raw status instead, so callers map every code explicitly. An
// unmapped status is uncomputable, never a verdict (design §4).

import { execFileSync } from 'node:child_process';

/**
 * Run `git <argv>`, capturing status/stdout/stderr. NEVER throws on a
 * non-zero exit. A genuine spawn failure (e.g. missing binary) collapses to
 * status -1 — still distinguishable from every real git exit code.
 */
export function gitTry(argv, { cwd = process.cwd() } = {}) {
  try {
    const stdout = execFileSync('git', argv, {
      cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      status: typeof err.status === 'number' ? err.status : -1,
      stdout: typeof err.stdout === 'string' ? err.stdout : '',
      stderr: typeof err.stderr === 'string' ? err.stderr : String(err.message ?? ''),
    };
  }
}

/** Run `git <argv>`; return stdout on status 0, throw (`.status` attached) otherwise. */
export function gitOrThrow(argv, opts = {}) {
  const result = gitTry(argv, opts);
  if (result.status !== 0) {
    const err = new Error(`git ${argv.join(' ')} exited ${result.status}: ${result.stderr.trim()}`);
    err.status = result.status;
    err.stdout = result.stdout;
    err.stderr = result.stderr;
    throw err;
  }
  return result.stdout;
}
