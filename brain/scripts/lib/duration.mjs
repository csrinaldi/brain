// duration.mjs — the stage wall clock, and how to say it. ONE number, in a
// place both axes may read (#682 slice 3, judgment:cold-6 and cold-7 of the
// fourth cold review).
//
// TWO FINDINGS, ONE CAUSE. `stage-timeout.mjs` declared
// `TIMEOUT_IN_FORCE_TODAY = 10 * 60_000` with the docstring "kept here so the
// default is one number rather than one per backend", while `claude.mjs` kept
// its own `STAGE_TIMEOUT_MS = 10 * 60_000` and used it as `runStage`'s
// parameter default. Measured: those were the only two occurrences in the
// non-test sources and no import linked them. **So the default WAS one number
// per backend, which is what the docstring said it was not** — a claim its own
// module contradicted, in the ticket whose recurring defect is exactly that.
//
// It mattered more than a duplicated constant usually does, because of the
// blocker beside it: with `timeoutMs` dropped at the seam, `claude.mjs`'s copy
// was the one actually in force while the operator's config was validated
// against the other.
//
// AND THE FIX FOR THE SECOND FINDING IS THE SAME MOVE. `claude.mjs` — a harness
// backend — imported `formatDuration` from `review/lib/stage-timeout.mjs`, a
// module whose job is resolving a REVIEW-port config key. `platform.mjs` exists
// in this same change to stop a backend importing the dispatcher, and ADR-0005
// keeps the harness axis independent of the reviewer; that edge pointed the
// wrong way for a twelve-line formatter. No cycle resulted, measured — which is
// how a layering edge survives review.
//
// So both live HERE, under `scripts/lib/`, which neither axis owns. The harness
// reads the default and the formatter; the review port reads the same default
// and resolves the operator's override against it. Neither imports the other.

/**
 * The stage wall clock a backend gets when nobody configures one.
 *
 * TEN MINUTES IS NOT AN ARGUED NUMBER — it is the value that shipped, kept so
 * the default does not move on one data point. The first real cold review took
 * 8m 32s against it: MARGINAL, not absurd, which is worse, because the first
 * attempt died at it and the second did not. Moving it needs a distribution,
 * not an anecdote; `reviewer.stageTimeoutMs` is how a repo that already knows
 * its own answer says so today.
 */
export const DEFAULT_STAGE_TIMEOUT_MS = 10 * 60_000;

/**
 * Human-facing duration, for the messages an operator acts on. Pure.
 *
 * Never renders a number it was not given: an absent or nonsensical input reads
 * as "an unknown time" rather than `NaNms`, because a run reporting a duration
 * it did not measure is the shape this ticket keeps removing.
 */
export function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return 'an unknown time';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 90) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}
