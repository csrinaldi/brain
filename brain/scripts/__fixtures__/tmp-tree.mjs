// __fixtures__/tmp-tree.mjs — the ONE way tests dispose of a temp tree (issue #800).
//
// The failure this exists to stop: `test/review-regulated/regulated-review.e2e.test.mjs`
// tore down its fixture with `rmSync(fx.base, { recursive: true, force: true })`. That
// passed on this exact commit, then failed on a re-run of the SAME commit with:
//
//   ENOTEMPTY: directory not empty, rmdir '.../consumer/.git/objects'
//
// `force: true` ONLY suppresses ENOENT — "the path is already gone" — because that is
// the one case `rmSync` documents as safe to swallow unconditionally. It has never
// covered ENOTEMPTY, EBUSY, or any of the other errnos a concurrent writer to the
// same tree can produce. Node's actual answer to "something else touched this
// directory mid-delete, retry" is `maxRetries` + `retryDelay`: with `recursive: true`,
// `rmSync` retries EBUSY, EMFILE, ENFILE, ENOTEMPTY and EPERM up to `maxRetries` times,
// waiting `retryDelay` ms between attempts. No call site in this repo passed either
// option before this file existed — `rg 'maxRetries|retryDelay'` returned zero hits.
//
// The race itself is UNIDENTIFIED. Every git invocation in the fixture and in the
// review CLI under test is `execFileSync` — synchronous — so no *direct* child of the
// test process can be racing the rmdir. Something else is touching `.git/objects`
// during teardown, and this file does not claim to know what. That is why the fix
// here is a structural guard, not a targeted one: retry a bounded number of times,
// and if the tree still won't go, give up WITHOUT taking the test down with it.
//
// That "give up without failing" part is the actual point, and it holds regardless
// of whether the retry ever helps: teardown runs after the test's assertions have
// already passed. A directory that outlives a test run costs disk, nothing else — a
// REQUIRED branch-protection gate reporting failure for a leaked temp dir costs
// everyone's trust in the gate. So this never throws. But "never throws" must not
// mean "never tells anyone" — an accumulating leak is a real bug in its own right,
// just a slower one, so a give-up is reported to stderr via `onLeak` rather than
// swallowed twice.
//
// `_rm` and `onLeak` are injectable purely as test seams (this repo's convention —
// see e.g. `harness/backends/claude.mjs`'s `_run`/`_env`): they let the test suite
// drive the ENOTEMPTY/other-errno/give-up paths deterministically, without waiting
// on a real race to reproduce.

import { rmSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';

function defaultOnLeak(dir, err) {
  process.stderr.write(
    `tmp-tree: giving up on removing "${dir}" (${err?.code ?? 'unknown error'}: ${err?.message ?? err}) — ` +
    `leaving it on disk. This is not a test failure; see issue #800.\n`,
  );
}

// A `dir` that is not a string, is relative, or resolves to `/`, `/tmp`, or a
// bare drive root is not a "the tree resisted deletion" problem — it is a
// CALLER BUG: nobody meant to hand this function the whole filesystem.
// Catching it here, before `_rm` is ever called, matters because `rmSync`
// with `recursive: true, force: true, maxRetries: N` does not fail loudly on
// a path like `/`: it deletes everything the process can reach, retries the
// final `rmdir` (EBUSY is on Node's retry list), then hands the leftover
// error to `onLeak`, which reports it as an ordinary, ignorable leak. That
// would make a catastrophic path silently pass through the exact mechanism
// meant to keep teardown from failing an already-passed test. So this check
// throws — loudly, and deliberately not swallowed by `onLeak` — because
// nothing has been deleted yet, so nothing that already passed can be
// sabotaged by refusing early.
function assertRemovableDir(dir) {
  if (typeof dir !== 'string' || dir.length === 0) {
    throw new TypeError(`removeTempTree: dir must be a non-empty string, got ${JSON.stringify(dir)}`);
  }
  if (!isAbsolute(dir)) {
    throw new TypeError(`removeTempTree: dir must be an absolute path, got ${JSON.stringify(dir)}`);
  }
  const resolved = resolve(dir);
  const segments = resolved.split(sep).filter(Boolean);
  if (segments.length < 2) {
    throw new TypeError(
      `removeTempTree: dir resolves to "${resolved}", which has fewer than two path segments — ` +
      `refusing to recursively remove a filesystem root or near-root path`,
    );
  }
}

/**
 * Removes a temp tree built for a test.
 *
 * The "never throws" guarantee here covers exactly one failure mode: the
 * tree resisted removal (a lingering handle, a concurrent writer, any errno
 * `_rm` can raise once it has actually tried to delete something). Teardown
 * is not an assertion, so THAT kind of failure may not fail a test that
 * already passed — it is reported via `onLeak` instead, and `onLeak` itself
 * is guarded so a failure inside the reporter (e.g. `process.stderr.write`
 * throwing `EPIPE` because the reading end closed early) cannot escape
 * either.
 *
 * It does NOT cover a caller bug in `dir` itself (not a string, relative, or
 * resolving to `/`, `/tmp`, or similar). That is a programming error caught
 * before any filesystem call is made — nothing has been deleted, so nothing
 * that already passed is at risk — and it throws on purpose. Do not
 * "simplify" that throw away to make the never-throws guarantee absolute:
 * doing so would let a bad path silently `rm -rf` a filesystem root and
 * report it as an ordinary, ignorable leak.
 *
 * @param {string} dir Root of the temp tree to remove. Must be an absolute
 *   path resolving to at least two path segments.
 * @param {object} [opts]
 * @param {number} [opts.maxRetries=10] Forwarded to `rmSync`; retries EBUSY,
 *   EMFILE, ENFILE, ENOTEMPTY, EPERM.
 * @param {number} [opts.retryDelay=100] Milliseconds between retries.
 * @param {(dir: string, err: unknown) => void} [opts.onLeak] Called when `_rm`
 *   still fails after retries — the leak-visibility seam. Defaults to a
 *   stderr report naming the path and the errno. Guaranteed not to bring
 *   down `removeTempTree` even if it itself throws.
 * @param {(dir: string, options: object) => void} [opts._rm] Test seam for
 *   `rmSync` — never overridden in production.
 * @throws {TypeError} If `dir` is not a non-empty absolute string resolving
 *   to at least two path segments — a caller bug, not a cleanup failure.
 */
export function removeTempTree(dir, { maxRetries = 10, retryDelay = 100, onLeak = defaultOnLeak, _rm = rmSync } = {}) {
  assertRemovableDir(dir);
  try {
    _rm(dir, { recursive: true, force: true, maxRetries, retryDelay });
  } catch (err) {
    try {
      onLeak(dir, err);
    } catch {
      // The reporter itself failed while reporting a removal failure. This
      // is a last-ditch effort at visibility, not a new place for a cleanup
      // failure to escape — swallow it so "never throws" stays true for the
      // one failure mode it is meant to cover.
    }
  }
}
