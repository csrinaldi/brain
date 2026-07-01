// substrate.mjs — Capability-aware substrate detector (governance v3, design §1).
//
// Generalizes brain-protect.mjs's { enforced, reason, remedy } shape to ALL of
// governance and reports the highest ARMED rung of the fail-closed degradation
// ladder:
//
//   1 — merge          branch protection (or self-hosted pre-receive) active
//   2 — release        the publish/tag path runs brain:audit fail-closed
//   3 — auto-correct   post-merge brain:audit CI opens an auto-revert PR
//   4 — floor          detection + loud signal only, no enforcing guarantee
//
// detectSubstrate() is a PURE ORCHESTRATOR: it never touches the filesystem, git,
// or the network itself. All evidence comes through the injected `probes` (and the
// `vcs` adapter passed through to them) — mirroring how brain-audit.mjs separates
// pure checks/*.mjs from I/O wrappers (design §0). Callers (e.g.
// brain-governance-status.mjs, PR2b) are responsible for wiring real-world probes
// (fs presence checks, VCS API reads, env). No probes given -> no evidence -> the
// only honest answer is rung 4 (floor). This keeps the module fully unit-testable
// with zero dependencies and immune to CI-fragility (no ambient process.env / cwd
// git-state coupling — see apply-progress notes for issue-144-governance-v3).
//
// Contract (REQ-LADDER-1, REQ-LADDER-2):
//   detectSubstrate({ config, vcs, env, probes }) →
//     { rung: 1|2|3|4, enforced: boolean, reason: string|null, remedy: string|null, rungs }
//
// Never throws. Every probe call is wrapped in try/catch; a throwing probe
// degrades that rung to unavailable (never propagates, never crashes the caller).

import { checkContexts } from './governance-checks.mjs';

/**
 * Runs an injected probe defensively — never throws. Returns `undefined` on any
 * failure (missing probe, probe throws, probe rejects) so callers can treat that
 * uniformly as "no evidence available".
 * @param {Function|undefined} probeFn
 * @param {object} ctx
 * @returns {Promise<any>}
 */
async function safeProbe(probeFn, ctx) {
  if (typeof probeFn !== 'function') return undefined;
  try {
    return await probeFn(ctx);
  } catch {
    return undefined;
  }
}

// ── Rung 4 — floor ───────────────────────────────────────────────────────────────
// Always available and always active: the unconditional fallback so `rung` never
// has "no answer".
function evalRung4() {
  return { available: true, active: true, reason: null, remedy: null };
}

// ── Rung 3 — auto-correct ────────────────────────────────────────────────────────
// Armed when post-merge CI runs brain:audit and can open an auto-revert PR.
// Evidence: `probes.postMergeCi({ config, env })` — real wiring checks presence of
// .github/workflows/governance-postmerge.yml or env.GITHUB_ACTIONS === 'true'
// (design §1). The interpretation lives here so it stays unit-testable; the actual
// fs/env read is the caller's concern (see module doc).
async function evalRung3({ config, env, probes }) {
  const active = Boolean(await safeProbe(probes.postMergeCi, { config, env }));
  if (active) {
    return { available: true, active: true, reason: null, remedy: null };
  }
  return {
    available: true, // CI is always something the project can wire — never a tier block
    active: false,
    reason: 'no post-merge CI detected (no governance-postmerge.yml, not running in CI)',
    remedy: 'add .github/workflows/governance-postmerge.yml running brain:audit with auto-revert on failure',
  };
}

// ── Rung 2 — release ─────────────────────────────────────────────────────────────
// Armed when the publish/tag path runs brain:audit fail-closed. Evidence:
// `probes.releaseGate({ config, env })` — real wiring checks presence of
// .github/workflows/release.yml or config.governance.releaseGate === true.
async function evalRung2({ config, env, probes }) {
  const active = Boolean(await safeProbe(probes.releaseGate, { config, env }));
  if (active) {
    return { available: true, active: true, reason: null, remedy: null };
  }
  return {
    available: true, // the project always controls its own release path
    active: false,
    reason: 'no release-gate wired (no release.yml, governance.releaseGate not set)',
    remedy: 'add .github/workflows/release.yml running brain:audit fail-closed before tag, or set governance.releaseGate=true',
  };
}

// ── Rung selection ───────────────────────────────────────────────────────────────
// Highest-armed-rung wins: check 1, then 2, then 3; 4 is the guaranteed floor.
function selectRung(rungs) {
  for (const r of [1, 2, 3, 4]) {
    if (rungs[r]?.active) return r;
  }
  return 4;
}

/**
 * Detects the highest-armed rung of the governance substrate ladder.
 *
 * @param {object} [opts]
 * @param {object} [opts.config]  brain.config.json contents (or a fixture)
 * @param {object} [opts.vcs]     resolved VCS provider adapter (see vcs/cli.mjs getVcs())
 * @param {object} [opts.env]     environment variables (ALWAYS pass explicitly in
 *                                tests — defaulting to process.env is only safe for
 *                                real production callers)
 * @param {object} [opts.probes]  injectable evidence sources — see module doc
 * @returns {Promise<{ rung: 1|2|3|4, enforced: boolean, reason: string|null, remedy: string|null, rungs: object }>}
 */
export async function detectSubstrate({ config = {}, vcs, env = process.env, probes = {} } = {}) {
  const rungs = {};

  rungs[3] = await evalRung3({ config, env, probes });
  rungs[2] = await evalRung2({ config, env, probes });
  rungs[4] = evalRung4();

  const rung = selectRung(rungs);
  const enforced = rung <= 3;
  // At the ceiling (rung 1) there is nowhere higher to climb — no reason/remedy
  // needed. Below the ceiling, surface the nearest unattained rung's reason/remedy:
  // it is always the single, most actionable next step to climb the ladder.
  const blocker = rung === 1 ? null : rungs[rung - 1];

  return {
    rung,
    enforced,
    reason: blocker?.reason ?? null,
    remedy: blocker?.remedy ?? null,
    rungs,
  };
}
