// postmerge/resolution.mjs — revert-resolution proved by TREE EFFECT, never by
// a message (design §3). This is the entire security thesis of the change: an
// offender is resolved automatically iff every path it touched is, at the tip,
// byte-identical to its pre-offender state. A commit trailer, ancestry
// (`merge-base --is-ancestor`), an author, a signature, or a branch name are
// NEVER consulted — they are free text or forgeable, and the tree is not. The
// only other resolution path is the recorded human gate (cursor.mjs accept),
// which lives outside this module by design (§2.4, §3.5).

import { gitTry, gitOrThrow } from './git-seam.mjs';

/** Build the injectable git seam bound to `cwd` (parity with cursor.mjs). */
export function makeGit(cwd = process.cwd()) {
  return { try: (argv) => gitTry(argv, { cwd }), orThrow: (argv) => gitOrThrow(argv, { cwd }) };
}

// The set of paths differing between two revs. `--no-renames` so a rename
// yields BOTH names (never a half-tracked path); `-z` so a path containing a
// newline cannot lie — entries are NUL-terminated, split on NUL. `git diff`
// exits 0 whether or not paths differ; a non-zero status is a real error (bad
// rev), so `orThrow` fails closed rather than returning a vacuous empty set.
function diffPaths(git, a, b) {
  const out = git.orThrow(['diff', '--no-renames', '--name-only', '-z', a, b]);
  return new Set(out.split('\0').filter(Boolean));
}

/**
 * The set of paths a single commit touched: `git diff <rev>^1 <rev>`. For a
 * merge (the `--first-parent --merges` offenders brain-audit tracks), `^1` is
 * the first parent, so this is exactly the merge's contribution to main.
 */
export function changedPaths(rev, { git }) {
  return diffPaths(git, `${rev}^1`, rev);
}

/**
 * Is `offender` resolved at `tip`? (design §3.2)
 *   P = changedPaths(offender)
 *   if P is EMPTY → { resolved: false, reason: 'offender has no changed paths' }
 *                   ◄── EXPLICIT anti-vacuity guard, the FIRST branch. An empty
 *                       path set makes every set-theoretic test trivially true;
 *                       it is refused, loudly, never a vacuous pass.
 *   D = paths differing between <offender>^1 and <tip>
 *   resolved ⟺ P ∩ D = ∅   (every path the offender touched is byte-identical
 *                            at the tip to its pre-offender state — the payload
 *                            is gone). Reads NO commit body.
 */
export function isResolvedAt(offender, tip, { git }) {
  const P = changedPaths(offender, { git });
  if (P.size === 0) return { resolved: false, reason: 'offender has no changed paths' };

  const D = diffPaths(git, `${offender}^1`, tip);
  for (const path of P) {
    if (D.has(path)) return { resolved: false };
  }
  return { resolved: true };
}

/**
 * Is `candidate` the reverter of `offender`? (design §3.3) — reuses the SAME
 * tree-effect predicate, no new mechanism, no forgeable signal:
 *   isResolvedAt(offender, candidate)   is TRUE   ← payload absent at candidate
 *   AND isResolvedAt(offender, candidate^1) is FALSE ← payload present at its
 *                                                       parent ⇒ candidate is
 *                                                       demonstrably what removed it.
 * Closes the revert-of-revert loop (an auto-revert of an adrPresence offender
 * would itself re-trigger the XOR) without reading any message.
 */
export function isReverterOf(offender, candidate, { git }) {
  if (!isResolvedAt(offender, candidate, { git }).resolved) return false;
  return isResolvedAt(offender, `${candidate}^1`, { git }).resolved === false;
}
