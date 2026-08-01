// governance-tiers.mjs — Pure doctrine-tier resolver (Q5, issue #358, design §8).
// No I/O at import, mirroring substrate.mjs's discipline: everything here is
// data + pure functions over that data. The only I/O this file ever performs
// is inside the CLI guard at the bottom (bash consumers only), never at
// module-eval time.
//
// Two axes, never conflated (REQ-TIER-4): the TIER (`governance.tier`) is
// DECLARED — a team's statement about its own operating model. The RUNG
// (substrate.mjs#detectSubstrate) is DETECTED — what the platform can
// structurally enforce. Neither may substitute for the other, and no code
// path here reads a probe, an env var, or a platform capability.
//
// Two tiering MECHANISMS (design §2), deliberately kept distinct:
//   - Position tiering  — a gate's exit POLICY moves between `required` and
//     `detection`. Reserved for proportionality (REQ-TIER-7): per-change
//     ceremony whose benefit scales with team size (memory-gate, phase-order).
//   - Evidence tiering  — the gate stays `required` at every tier; WHAT
//     satisfies it changes (REQ-TIER-5). Reserved for the never-tiered core
//     (REQ-TIER-2) when one evidence form is structurally unsatisfiable at a
//     tier's operating model (actor-check, brain-writes-reviewed, decision-gate).
//
// STAGED ROLLOUT — READ BEFORE TOUCHING PENDING_PROMOTION (issue #358 phases):
// GATE_MATRIX below encodes the FULL, ratified END-STATE doctrine from
// design.md §2 verbatim — including `actor-check` and `brain-writes-reviewed`
// resolving to `required` at every tier (REQ-TIER-2's never-tiered core) and
// `phase-order` resolving to `required` at standard/regulated (design §2.B).
// That end state is NOT yet safe to WIRE into branch protection:
//   - `actor-check`/`brain-writes-reviewed`'s CHECKER CODE still runs the
//     pre-tier "distinct actor" / "APPROVED human review" evidence
//     unconditionally — their REQ-L5-1'/REQ-L6-1' tiered evidence forms are
//     Phase 4 work, explicitly BLOCKED on #328 (design §4).
//   - `phase-order`'s promotion carries its OWN precondition (fail-closing its
//     uncomputable-diff branch first, ADR-0015) — Phase 5, not yet done.
// Wiring `resolveGatePolicy`'s raw 'required' straight into a consumer's
// required-check list TODAY would flip these into branch-protection-required
// contexts before any repo without a second distinct human approver could
// satisfy them — reproducing #329 the moment this ships (including brain's
// own repo, until Phase 4/5 land). `requiredJobs()` therefore filters the
// matrix's raw policy through `PENDING_PROMOTION`: gates named there resolve
// to `detection` in the DERIVED, CONSUMER-FACING surface regardless of what
// GATE_MATRIX declares, until a follow-up change (Phase 5, tasks.md) removes
// them from this list. `resolveGatePolicy`/`resolveGateEvidence` still report
// the matrix's raw (target) values unfiltered — a caller that needs "is this
// gate ACTUALLY enforced today" must go through `requiredJobs()`, never
// `resolveGatePolicy()` directly.
//
// This split is what keeps REQ-TIER-2's unit test ("never-tiered core always
// resolves to `required`") true — a doctrine fact — while REQ-TIER-10's
// no-op-migration guarantee ("standard reproduces today's exact behaviour")
// also holds — an operational safety fact. Both are ratified requirements;
// this module satisfies both by keeping "what the doctrine says" and "what is
// safe to enforce today" as two distinct, separately-testable functions.

import { fileURLToPath } from 'node:url';
import { loadBrainConfig } from '../lib/brain-config.mjs';

export const TIERS = Object.freeze(['lite', 'standard', 'regulated']);

/**
 * REQ-TIER-2 — the never-tiered core, enumerated in code (never inferred).
 * `resolveGatePolicy(gate, tier)` MUST return `'required'` for every gate here
 * at every tier — position never tiers down for these six. (Evidence MAY
 * still tier — REQ-TIER-5.)
 *
 * @type {string[]}
 */
export const NEVER_TIERED = Object.freeze([
  'issue-link',
  'local-checks',
  'decision-gate',
  'diff-size',
  'actor-check',
  'brain-writes-reviewed',
]);

/**
 * Gates whose GATE_MATRIX-declared policy is the ratified TARGET doctrine but
 * whose promotion into the CONSUMER-FACING `requiredJobs()` surface is
 * explicitly deferred — see the STAGED ROLLOUT note above. Removing a name
 * from this list is the Phase 5 "promote" action (tasks.md); it is a
 * deliberate, reviewed data change, never automatic.
 *
 * @type {string[]}
 */
const PENDING_PROMOTION = Object.freeze(['actor-check', 'brain-writes-reviewed', 'phase-order']);

/**
 * §2 — the gate distribution matrix (design.md §2, verbatim). One row per
 * `GOVERNANCE_JOBS` name (governance-checks.mjs). REQ-TIER-8's drift-guard
 * (governance-tiers.test.mjs) asserts this key set equals GOVERNANCE_JOBS
 * exactly, in both directions.
 *
 * Row order intentionally mirrors GOVERNANCE_JOBS / governance.yml's job
 * order (REQUIRED jobs, then DETECTION jobs) so `requiredJobs()` — which
 * iterates `Object.keys(GATE_MATRIX)` — preserves that same order.
 *
 * @type {Record<string, Record<'lite'|'standard'|'regulated', {policy: 'required'|'detection', evidence: string}>>}
 */
export const GATE_MATRIX = Object.freeze({
  'issue-link': Object.freeze({
    lite: Object.freeze({ policy: 'required', evidence: 'approved-label' }),
    standard: Object.freeze({ policy: 'required', evidence: 'approved-label' }),
    regulated: Object.freeze({ policy: 'required', evidence: 'approved-label' }),
  }),
  'diff-size': Object.freeze({
    // Position never tiers (REQ-TIER-2); the BUDGET and the size:exception
    // waiver tier instead — see tierParams()/§2.C. Same evidence form
    // (line-count against a budget) at every tier.
    lite: Object.freeze({ policy: 'required', evidence: 'line-count-budget' }),
    standard: Object.freeze({ policy: 'required', evidence: 'line-count-budget' }),
    regulated: Object.freeze({ policy: 'required', evidence: 'line-count-budget' }),
  }),
  'local-checks': Object.freeze({
    lite: Object.freeze({ policy: 'required', evidence: 'test-suite' }),
    standard: Object.freeze({ policy: 'required', evidence: 'test-suite' }),
    regulated: Object.freeze({ policy: 'required', evidence: 'test-suite' }),
  }),
  'memory-gate': Object.freeze({
    // Position-tiered by proportionality (design §2.B / §6): team-continuity
    // discipline scales with team size, so `lite` demotes to detection — the
    // one real, already-safe loss brain accepts by declaring `lite` (design §5).
    lite: Object.freeze({ policy: 'detection', evidence: 'coverage-report' }),
    standard: Object.freeze({ policy: 'required', evidence: 'issue-linked-record' }),
    regulated: Object.freeze({ policy: 'required', evidence: 'issue-linked-session-summary' }),
  }),
  'decision-gate': Object.freeze({
    // Never-tiered by position; evidence tiers (design §2.A). NOTE (design §9
    // open risk): the shipped adr-presence.mjs check is UNCONDITIONAL and does
    // not yet implement the standard/regulated evidence deltas below — these
    // tags record the ratified TARGET evidence, not yet wired into the
    // checker. Flagged for a separate follow-up, not implemented here.
    lite: Object.freeze({ policy: 'required', evidence: 'adr-home-cooccurrence' }),
    standard: Object.freeze({ policy: 'required', evidence: 'adr-home-cooccurrence+decision-label-hard' }),
    regulated: Object.freeze({
      policy: 'required',
      evidence: 'adr-home-cooccurrence+decision-label-hard+recorded-signature',
    }),
  }),
  'phase-order': Object.freeze({
    // Position-tiered by proportionality (design §2.B), BUT promotion at
    // standard/regulated is Phase 5 work gated on a separate precondition
    // (fail-closing the uncomputable-diff branch, ADR-0015) — see
    // PENDING_PROMOTION. The raw policy below is the ratified target.
    lite: Object.freeze({ policy: 'detection', evidence: 'artefact-presence' }),
    standard: Object.freeze({ policy: 'required', evidence: 'artefact-presence' }),
    regulated: Object.freeze({ policy: 'required', evidence: 'artefact-presence' }),
  }),
  'actor-check': Object.freeze({
    // Never-tiered by position (REQ-TIER-2); evidence tiers (REQ-TIER-5,
    // REQ-L5-1'). Actual promotion is PENDING_PROMOTION-gated on #328 (Phase 4).
    lite: Object.freeze({ policy: 'required', evidence: 'distinct-act' }),
    standard: Object.freeze({ policy: 'required', evidence: 'distinct-act+distinct-actor' }),
    regulated: Object.freeze({ policy: 'required', evidence: 'distinct-act+distinct-actor+no-commit-on-branch' }),
  }),
  'brain-writes-reviewed': Object.freeze({
    // Never-tiered by position (REQ-TIER-2); evidence tiers (REQ-TIER-5,
    // REQ-L6-1'). Actual promotion is PENDING_PROMOTION-gated on #328 (Phase 4).
    lite: Object.freeze({ policy: 'required', evidence: 'agent-authorship-exclusion' }),
    standard: Object.freeze({ policy: 'required', evidence: 'human-approved-review' }),
    regulated: Object.freeze({ policy: 'required', evidence: 'human-approved-review+codeowners-rung1' }),
  }),
});

/**
 * §2.C — doctrine parameters (not CI jobs; design.md §2.C verbatim).
 *
 * @type {Record<'lite'|'standard'|'regulated', {
 *   diffBudget: number,
 *   artefacts: string[],
 *   honorSizeException: boolean,
 *   honorOverride: boolean,
 *   honorSkipMemoryGate: boolean,
 *   memoryAssertion: string,
 * }>}
 */
const TIER_PARAMS = Object.freeze({
  lite: Object.freeze({
    diffBudget: 1000,
    artefacts: Object.freeze(['spec']),
    honorSizeException: true,
    honorOverride: true,
    // memory-gate is `detection` at lite — skip:memory-gate has nothing to skip.
    honorSkipMemoryGate: false,
    memoryAssertion: 'coverage-report',
  }),
  standard: Object.freeze({
    diffBudget: 400,
    artefacts: Object.freeze(['proposal', 'spec', 'design', 'tasks']),
    honorSizeException: true,
    honorOverride: true,
    // design §9 open risk: documented in AGENTS.md but read by no code path
    // today (brain-metrics.mjs reports it raw, never subtracts it) — this
    // flag is honest metadata, not yet load-bearing anywhere.
    honorSkipMemoryGate: true,
    memoryAssertion: 'issue-linked-record',
  }),
  regulated: Object.freeze({
    diffBudget: 200,
    artefacts: Object.freeze(['proposal', 'spec', 'design', 'tasks', 'verification']),
    honorSizeException: false,
    honorOverride: false,
    honorSkipMemoryGate: false,
    memoryAssertion: 'issue-linked-session-summary',
  }),
});

/**
 * Resolves `governance.tier` from a brain.config.json-shaped object.
 * Defaults to `'standard'` when absent (REQ-TIER-10) — but an EXPLICIT,
 * unrecognized value fails closed rather than silently defaulting
 * (REQ-TIER-1): a typo in `governance.tier` must never quietly downgrade a
 * repo's doctrine.
 *
 * @param {{ governance?: { tier?: string } }} [config]
 * @returns {'lite'|'standard'|'regulated'}
 */
export function resolveTier(config) {
  const raw = config?.governance?.tier;
  if (raw === undefined || raw === null) return 'standard';
  if (!TIERS.includes(raw)) {
    throw new Error(
      `governance-tiers: unknown governance.tier "${raw}" — must be one of: ${TIERS.join(', ')}.`
    );
  }
  return raw;
}

function requireGateRow(gate) {
  const row = GATE_MATRIX[gate];
  if (!row) {
    throw new Error(
      `governance-tiers: no matrix row for gate "${gate}" — add one to GATE_MATRIX (REQ-TIER-8).`
    );
  }
  return row;
}

function requireCell(gate, tier) {
  const row = requireGateRow(gate);
  const cell = row[tier];
  if (!cell) {
    throw new Error(
      `governance-tiers: gate "${gate}" has no matrix cell for tier "${tier}" — must be one of: ${TIERS.join(', ')}.`
    );
  }
  return cell;
}

/**
 * Resolves a gate's exit policy at a tier — the ratified DOCTRINE value from
 * GATE_MATRIX. See the STAGED ROLLOUT note: this is NOT automatically what
 * `requiredJobs()` enforces today for a `PENDING_PROMOTION` gate.
 *
 * @param {string} gate
 * @param {'lite'|'standard'|'regulated'} tier
 * @returns {'required'|'detection'}
 */
export function resolveGatePolicy(gate, tier) {
  return requireCell(gate, tier).policy;
}

/**
 * Resolves a gate's evidence-form tag at a tier.
 *
 * @param {string} gate
 * @param {'lite'|'standard'|'regulated'} tier
 * @returns {string}
 */
export function resolveGateEvidence(gate, tier) {
  return requireCell(gate, tier).evidence;
}

/**
 * Resolves the doctrine parameters for a tier (§2.C).
 *
 * @param {'lite'|'standard'|'regulated'} tier
 * @returns {{ diffBudget: number, artefacts: string[], honorSizeException: boolean, honorOverride: boolean, honorSkipMemoryGate: boolean, memoryAssertion: string }}
 */
export function tierParams(tier) {
  const params = TIER_PARAMS[tier];
  if (!params) {
    throw new Error(`governance-tiers: unknown tier "${tier}" — must be one of: ${TIERS.join(', ')}.`);
  }
  return params;
}

/**
 * Derives the ACTUALLY-ENFORCED required-job set for a tier — replaces the
 * old `REQUIRED_JOBS` constant (design §8, REQ-TIER-9). This is
 * `resolveGatePolicy`'s raw matrix value MINUS `PENDING_PROMOTION` (see the
 * STAGED ROLLOUT note at the top of this file): a gate whose evidence form
 * hasn't landed yet (Phase 4/5) never becomes an actually-required
 * branch-protection context through this function, no matter what the
 * ratified matrix says its target policy is.
 *
 * At `standard` this MUST equal (and today does equal) the pre-tiering
 * `REQUIRED_JOBS` literal exactly, in the same order — REQ-TIER-10's
 * no-op-migration guarantee.
 *
 * @param {'lite'|'standard'|'regulated'} tier
 * @returns {string[]}
 */
export function requiredJobs(tier) {
  return Object.keys(GATE_MATRIX).filter(
    gate => resolveGatePolicy(gate, tier) === 'required' && !PENDING_PROMOTION.includes(gate)
  );
}

// ── CLI printer (bash consumers — REQ-TIER-9: no second budget literal) ──────
//
// Mirrors approved-label.mjs's CLI-printer convention: a thin stdout-printing
// entrypoint so shell scripts (governance.yml, hooks/pre-push) never hardcode
// a tiered parameter themselves. Reads brain.config.json for real ONLY when
// invoked as a CLI (the guard below) — never at import (module stays pure).

function readConfigSafe() {
  try {
    return loadBrainConfig();
  } catch {
    return {};
  }
}

/**
 * Prints the tier-resolved diff-size budget for shell consumption.
 * Injectable `loadConfig` for tests; defaults to the real brain.config.json
 * reader. Propagates resolveTier's fail-closed throw on an unknown tier
 * (never silently prints a stale/default budget).
 *
 * @param {() => object} [loadConfig]
 * @returns {string}
 */
export function printDiffBudget(loadConfig = readConfigSafe) {
  const tier = resolveTier(loadConfig());
  return String(tierParams(tier).diffBudget);
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'diff-budget') {
    console.log(printDiffBudget());
  } else {
    console.error(`governance-tiers.mjs: unknown command "${cmd ?? ''}" (expected: diff-budget)`);
    process.exit(1);
  }
}
