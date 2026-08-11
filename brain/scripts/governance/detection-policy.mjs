// detection-policy.mjs — the shared tier-aware detection/required mapping
// (issue #358 Q5, design §8), extracted from run-check.mjs (issue #535,
// Requirement 6).
//
// WHY THIS LIVES OUTSIDE run-check.mjs: run-check.mjs is a multiplexer entry
// point, and per-subcommand port-reach resolution (workflow-auth.mjs,
// Requirement 3) is only sound if nothing outside run-check.mjs's own
// dispatch imports and reuses its internals under a different port-reach
// profile — "entry point, never a library" is a standing invariant
// (Requirement 6), not a comment. `mapDetectionToWarning` was previously
// importable from run-check.mjs (phase-order-check.mjs did exactly that),
// which made the invariant fiction. It has no port dependency of its own —
// it only needs `resolveGatePolicy` (vcs/governance-tiers.mjs, which itself
// only imports lib/brain-config.mjs — port-free) — so it belongs in its own
// port-free module, not co-located with a multiplexer.

import { resolveGatePolicy } from '../vcs/governance-tiers.mjs';

/**
 * Maps a check result to its tier-appropriate exit shape (issue #358 Q5,
 * design §8, REQ-TIER-3): when a gate's policy at the resolved tier is
 * `detection` (position-tiered, e.g. `memory-gate` at `lite`), a genuine
 * VIOLATION (`pass:false`, NOT `uncomputable`) is downgraded to `pass:true`
 * with a `::warning::`-annotated reason naming the tier — never a bare,
 * unexplained pass (REQ-TIER-3: "never absent, never silent"). An
 * `uncomputable` result is NEVER downgraded — an infra failure is infra
 * failure regardless of tier position. A `required`-policy gate at this tier
 * passes through unchanged.
 *
 * ONE shared helper, not per-job logic (design §8) — every run-check.mjs case
 * and every other tier-aware gate wrapper is meant to route its result
 * through this before returning.
 *
 * @param {{ pass: boolean, reason?: string, uncomputable?: boolean }} result
 * @param {'lite'|'standard'|'regulated'} tier
 * @param {string} gate
 * @returns {{ pass: boolean, reason?: string, uncomputable?: boolean }}
 */
export function mapDetectionToWarning(result, tier, gate) {
  if (!result || result.pass !== false || result.uncomputable) return result;
  if (resolveGatePolicy(gate, tier) !== 'detection') return result;
  return {
    ...result,
    pass: true,
    reason: `::warning::${gate}: ${result.reason} (tier: ${tier})`,
  };
}
