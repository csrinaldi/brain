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
//
// Phase 5 (tasks.md) PROMOTED all three gates: their preconditions are now
// met —
//   - `actor-check`/`brain-writes-reviewed`'s REQ-L5-1'/REQ-L6-1' tiered
//     evidence forms shipped in Phase 4 (commits `21cc250`, `732b243`),
//     unblocked by #328 (PR #370).
//   - `phase-order`'s uncomputable-diff branch now fails closed at this gate's
//     `required` tiers (standard/regulated) — ADR-0015's recorded
//     precondition. At `lite` (this gate's `detection` tier) it still exits 0
//     with a `::warning::` naming the tier, per REQ-TIER-3 (`phase-order-check.mjs`'s
//     `runPhaseOrderCheck`, wired through `run-check.mjs`'s
//     `mapDetectionToWarning` — issue #358 Q5 finding A).
// `PENDING_PROMOTION` is therefore empty: `requiredJobs()` no longer filters
// any gate out of the matrix's raw policy. Before Phase 5, wiring
// `resolveGatePolicy`'s raw 'required' straight into a consumer's
// required-check list would have flipped these into branch-protection-required
// contexts before any repo without a second distinct human approver (or a
// fail-closed phase-order evaluator) could satisfy them — reproducing #329.
// `resolveGatePolicy`/`resolveGateEvidence` always reported the matrix's raw
// (target) values, unfiltered; `requiredJobs()` is the one surface that used
// to differ from them during the staged rollout — a caller that needs "is
// this gate ACTUALLY enforced today" should still prefer `requiredJobs()`
// over `resolveGatePolicy()` directly, since a FUTURE promotion may re-use
// this same list.
//
// This split is what kept REQ-TIER-2's unit test ("never-tiered core always
// resolves to `required`") true — a doctrine fact — while REQ-TIER-10's
// no-op-migration guarantee ("standard reproduces today's exact behaviour")
// also held — an operational safety fact, during the staged rollout. Both are
// ratified requirements; this module satisfied both by keeping "what the
// doctrine says" and "what is safe to enforce today" as two distinct,
// separately-testable functions. Adding a gate to `PENDING_PROMOTION` again in
// the future (a new gate, not yet evidence-ready) remains the sanctioned
// pattern for staging a promotion.

import { fileURLToPath } from 'node:url';
import { loadBrainConfig } from '../lib/brain-config.mjs';
import { artefactFiles } from '../lib/sdd-layout.mjs';

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
 * Empty as of Q5 Phase 5: `actor-check` and `brain-writes-reviewed` promoted
 * (REQ-L5-1'/REQ-L6-1' evidence forms shipped, Phase 4) and `phase-order`
 * promoted (uncomputable-diff branch fail-closed, ADR-0015 precondition met).
 *
 * @type {string[]}
 */
const PENDING_PROMOTION = Object.freeze([]);

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
    // Position-tiered by proportionality (design §2.B). Promoted to `required`
    // at standard/regulated in Phase 5, gated on fail-closing the
    // uncomputable-diff branch first (ADR-0015 precondition, met —
    // phase-order-check.mjs's runPhaseOrderCheck now returns `fail` instead of
    // `warn` when the diff is uncomputable). `lite` stays `detection` by
    // design (proportionality), not by PENDING_PROMOTION.
    lite: Object.freeze({ policy: 'detection', evidence: 'artefact-presence' }),
    standard: Object.freeze({ policy: 'required', evidence: 'artefact-presence' }),
    regulated: Object.freeze({ policy: 'required', evidence: 'artefact-presence' }),
  }),
  'actor-check': Object.freeze({
    // Never-tiered by position (REQ-TIER-2); evidence tiers (REQ-TIER-5,
    // REQ-L5-1'). Promoted to `required` at every tier in Phase 5 — the
    // tiered evidence forms shipped in Phase 4 (commit `21cc250`), unblocked
    // by #328 (PR #370).
    lite: Object.freeze({ policy: 'required', evidence: 'distinct-act' }),
    standard: Object.freeze({ policy: 'required', evidence: 'distinct-act+distinct-actor' }),
    regulated: Object.freeze({ policy: 'required', evidence: 'distinct-act+distinct-actor+no-commit-on-branch' }),
  }),
  'brain-writes-reviewed': Object.freeze({
    // Never-tiered by position (REQ-TIER-2); evidence tiers (REQ-TIER-5,
    // REQ-L6-1'). Promoted to `required` at every tier in Phase 5 — the
    // tiered evidence forms shipped in Phase 4 (commit `732b243`), unblocked
    // by #328 (PR #370).
    lite: Object.freeze({ policy: 'required', evidence: 'agent-authorship-exclusion' }),
    standard: Object.freeze({ policy: 'required', evidence: 'human-approved-review' }),
    regulated: Object.freeze({ policy: 'required', evidence: 'human-approved-review+codeowners-rung1' }),
  }),
});

/**
 * §2.C — doctrine parameters (not CI jobs; design.md §2.C verbatim).
 *
 * `reviewProtocol` (issue #391 T2.3 §3/§5, issue #394 M3): the tiered default
 * `brain-review` verdict protocol version — `cli.mjs`'s ONE seam for the
 * `buildVerdict({...protocol})` call. `lite`/`standard` default to `/1`
 * (single-engine deterministic checks, T2.3 design §5); `regulated` defaults
 * to `/2` (panel-consensus's enabling causal-admission vocabulary, Q5 §7).
 * Never forbids the other version at any tier (T2.3 design §3.4) — this is
 * only the DEFAULT `resolveReviewProtocol` would return, not a ceiling.
 *
 * @type {Record<'lite'|'standard'|'regulated', {
 *   diffBudget: number,
 *   artefacts: string[],
 *   honorSizeException: boolean,
 *   honorOverride: boolean,
 *   honorSkipMemoryGate: boolean,
 *   memoryAssertion: string,
 *   reviewProtocol: 'brain-review/1'|'brain-review/2',
 * }>}
 */
const TIER_PARAMS = Object.freeze({
  lite: Object.freeze({
    diffBudget: 1000,
    // #94: the platform's `required_approving_review_count`. ZERO at lite is not
    // laxity — `brain-writes-reviewed` already rules that a human author suffices
    // for a brain/core write here (REQ-L6-1'), so arming 1 would impose a
    // `standard` posture on a repo that declares `lite`. It is also unsatisfiable
    // at n=1: GitHub forbids a PR author approving their own PR.
    requiredReviews: 0,
    artefacts: Object.freeze(['spec']),
    honorSizeException: true,
    honorOverride: true,
    // memory-gate is `detection` at lite — skip:memory-gate has nothing to skip.
    honorSkipMemoryGate: false,
    memoryAssertion: 'coverage-report',
    reviewProtocol: 'brain-review/1',
  }),
  standard: Object.freeze({
    diffBudget: 400,
    // L6's human approver is `approvers.find(a => a !== author && !botAllowlist
    // .includes(a))` — a non-author human is the point of this tier.
    requiredReviews: 1,
    artefacts: Object.freeze(['proposal', 'spec', 'design', 'tasks']),
    honorSizeException: true,
    honorOverride: true,
    // design §9 open risk: documented in AGENTS.md but read by no code path
    // today (brain-metrics.mjs reports it raw, never subtracts it) — this
    // flag is honest metadata, not yet load-bearing anywhere.
    honorSkipMemoryGate: true,
    memoryAssertion: 'issue-linked-record',
    reviewProtocol: 'brain-review/1',
  }),
  regulated: Object.freeze({
    diffBudget: 200,
    // ONE, deliberately not two. ADR-0026's "panel >= 2, consensus-gated" row is
    // the REVIEWER VERDICT MODE, not the human approval count; reading it as an
    // approval count would be inventing doctrine (reviewer-protocol.md §5).
    requiredReviews: 1,
    artefacts: Object.freeze(['proposal', 'spec', 'design', 'tasks', 'verification']),
    honorSizeException: false,
    honorOverride: false,
    honorSkipMemoryGate: false,
    memoryAssertion: 'issue-linked-session-summary',
    reviewProtocol: 'brain-review/2',
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

/** The two `brain-review` verdict protocol versions. Not tiered — the tier picks a
 *  DEFAULT among them (T2.3 design §3.4: "never forbids the other version at any
 *  tier"). */
export const REVIEW_PROTOCOLS = Object.freeze(['brain-review/1', 'brain-review/2']);

/**
 * Resolves the reviewer protocol: an explicit `reviewer.protocol` wins, otherwise the
 * tier's default (issue #442, the D5 middle path).
 *
 * THE OVERRIDE EXISTS BECAUSE THE TIER CANNOT MOVE. `/2` is `regulated`'s default, and
 * brain cannot declare `regulated`: at that tier `actor-check` requires an approver
 * distinct from the author who authored no commit on the branch, which is structurally
 * unsatisfiable for a solo maintainer — the #329 contradiction ADR-0026 exists to
 * resolve. So the protocol had to become separable from the tier for `/2` to be
 * DOGFOODED rather than only tested. No new doctrine was needed: T2.3 §3.4 already
 * says the tier sets a default and not a ceiling, and this function is the one it
 * names.
 *
 * FAIL-CLOSED ON AN UNKNOWN VALUE, exactly like `resolveTier` above and for the same
 * reason: a typo in `reviewer.protocol` must never silently fall back to the tier
 * default. Silently downgrading `/2` to `/1` would drop causal admission — the
 * annotation, the base comparison, the refuter fork — while the operator believed they
 * had it, which is the #382/#413 boot-refusal shape.
 *
 * @param {{ reviewer?: { protocol?: string } }} [config]
 * @param {'lite'|'standard'|'regulated'} tier
 * @returns {'brain-review/1'|'brain-review/2'}
 */
export function resolveReviewProtocol(config, tier) {
  const raw = config?.reviewer?.protocol;
  if (raw === undefined || raw === null) return tierParams(tier).reviewProtocol;
  if (!REVIEW_PROTOCOLS.includes(raw)) {
    throw new Error(
      `governance-tiers: unknown reviewer.protocol "${raw}" — must be one of: ${REVIEW_PROTOCOLS.join(', ')}.`
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
 * @returns {{ diffBudget: number, artefacts: string[], honorSizeException: boolean, honorOverride: boolean, honorSkipMemoryGate: boolean, memoryAssertion: string, reviewProtocol: 'brain-review/1'|'brain-review/2' }}
 */
/**
 * The artifact FILENAMES a change dir must carry at `tier` — the single
 * resolution, and the only place the `.md` extension is applied (#555).
 *
 * There were two sets before this. This table honoured ADR-0026 and `phase-order`
 * read it (#358 Q5); a fixed `REQUIRED_ARTIFACTS` lived in `lib/sdd-layout.mjs`,
 * and its two consumers — `local-checks` via `check-refs.mjs` and the reviewer's
 * checkpoint — demanded all four at every tier. They differed in three ways at
 * once: contents, extension (`spec` vs `spec.md`), and fixed-versus-tiered. At
 * `lite`, the tier brain declares for ITSELF, doctrine said `spec` suffices and
 * two gates blocked. The same change passed one gate and failed the other.
 *
 * WHY HERE and not in `sdd-layout.mjs`, where the `.md` convention arguably
 * belongs: that module advertises "Pure ESM, no side effects at import" and a
 * fixture copies it ALONE into a tmp dir. Importing this module from there drags
 * in `brain-config` → `repo.mjs` + `installer.mjs` + `config-migrations.mjs` —
 * four modules into one that promises none. The first attempt at #555 did exactly
 * that and the fixture caught it. The tier table owns the resolution; `sdd-layout`
 * receives the answer.
 *
 * @param {string} tier  `lite` | `standard` | `regulated`.
 * @returns {string[]}   e.g. `['spec.md']` at `lite`.
 */
export function requiredArtifactsFor(tier) {
  return artefactFiles(tierParams(tier).artefacts);
}

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
 * hasn't landed yet never becomes an actually-required branch-protection
 * context through this function, no matter what the ratified matrix says its
 * target policy is. As of Q5 Phase 5, `PENDING_PROMOTION` is empty — every
 * gate's raw matrix policy is now also its enforced policy.
 *
 * Pre-Phase-5, `requiredJobs('standard')` equalled the pre-tiering
 * `REQUIRED_JOBS` literal exactly, in the same order — REQ-TIER-10's
 * no-op-migration guarantee, which held for the duration of the staged
 * rollout (Phases 1-4). Phase 5's promotions are a deliberate, ratified
 * departure from that guarantee (design §4.1) — `standard` now also requires
 * `phase-order`, `actor-check`, and `brain-writes-reviewed`.
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
