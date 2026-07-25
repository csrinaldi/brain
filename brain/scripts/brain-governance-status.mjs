#!/usr/bin/env node
// brain-governance-status.mjs — Report the current state of all three governance layers.
//
// Reads vcs.provider and project.slug from brain.config.json, probes the VCS
// provider's capability API, and prints a per-consumer status table.
//
// USAGE: npm run brain:governance-status
//
// Output example:
//
//   brain:governance status — owner/repo (github)
//
//     hooks       ON  [universal]
//     brain:audit ON  [universal]
//     platform    available  (branch protection APIs accessible)
//
// The script performs NO action on import — the report runs only when invoked as a
// CLI (the guard at the bottom). Importing this module is side-effect-free.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from './vcs/lib/exec.mjs';
import { detectSubstrate } from './vcs/substrate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

function repoFileExists(relPath) {
  return existsSync(resolve(REPO_ROOT, relPath));
}

// ── Real substrate probes (production wiring — design §1) ──────────────────────
//
// These are thin I/O wrappers around `gh api` / filesystem presence, mirroring
// github.mjs's capabilities()/branchProtect() convention: not unit-tested
// directly (no live gh/network call belongs in `node --test`), but exercised
// end-to-end via detectSubstrate()'s already-tested pure orchestration
// (substrate.test.mjs) and reportGovernanceStatus()'s print logic below, which
// IS unit-tested — always via injected `probes` overrides, never these real
// implementations. Called only when the caller does not inject an override.

/**
 * Rung 1 — finer branch-protection read: 200+contexts / 404 / 403. Dispatches
 * on `config.vcs.provider` (issue #244 A4, mirrors realBrainWritesReviewedProbe
 * :78-111). GitLab reads the PER-BRANCH protected-branch endpoint inline
 * (parity with how the GitHub branch below inlines its `gh` read — NOT
 * `capabilities()`, which false-positives 'available' on an empty
 * protected_branches COLLECTION, contradicting the CP-A2b mirror evidence,
 * memory #565) PLUS the new `projectMergeSettings` verb — read off `vcs`
 * (the already-resolved providerModule detectSubstrate threads through,
 * exactly like every other injected probe override in this file's tests), not
 * a fresh dynamic import.
 */
async function realBranchProtectionProbe({ config, vcs }) {
  const provider = config?.vcs?.provider;
  const project = config?.project?.slug;
  const branch = config?.project?.defaultBranch ?? 'main';
  if (!project) return { status: undefined, contexts: [] };

  if (provider === 'gitlab') {
    const enc = encodeURIComponent(project);
    const rb = run('glab', ['api', `projects/${enc}/protected_branches/${encodeURIComponent(branch)}`]);
    let status;
    if (rb.ok) status = 200;
    else if (rb.stderr.includes(': 404')) status = 404;
    else if (rb.stderr.includes(': 401') || rb.stderr.includes(': 403')) status = 403;
    const { onlyAllowMergeIfPipelineSucceeds } = await vcs.projectMergeSettings({ project });
    return { status, contexts: [], pipelineMustSucceed: onlyAllowMergeIfPipelineSucceeds };
  }

  const r = run('gh', ['api', `repos/${project}/branches/${branch}/protection`]);
  if (r.ok) {
    let contexts = [];
    try {
      contexts = JSON.parse(r.stdout)?.required_status_checks?.contexts ?? [];
    } catch {
      contexts = [];
    }
    return { status: 200, contexts };
  }
  if (r.stderr.includes('404')) return { status: 404, contexts: [] };
  if (r.stderr.includes('403') || /upgrade.*pro/i.test(r.stderr)) return { status: 403, contexts: [] };
  return { status: r.status ?? undefined, contexts: [] };
}

/** Rung 2 — release-gate presence: release.yml or config.governance.releaseGate. */
async function realReleaseGateProbe({ config }) {
  if (config?.governance?.releaseGate === true) return true;
  return repoFileExists('.github/workflows/release.yml');
}

/** Rung 3 — post-merge CI presence: governance-postmerge.yml or env.GITHUB_ACTIONS. */
async function realPostMergeCiProbe({ config, env }) {
  if (env?.GITHUB_ACTIONS === 'true') return true;
  return repoFileExists('.github/workflows/governance-postmerge.yml');
}

/** rungs[1].gates.brainWritesReviewed — per-provider L6 rung-1 sub-probe. */
async function realBrainWritesReviewedProbe({ config }) {
  const provider = config?.vcs?.provider;

  if (provider === 'github') {
    const project = config?.project?.slug;
    const branch = config?.project?.defaultBranch ?? 'main';
    const codeownersPresent = repoFileExists('.github/CODEOWNERS');
    if (!project) return { requireCodeOwnerReviews: false, codeownersPresent };

    const r = run('gh', ['api', `repos/${project}/branches/${branch}/protection`]);
    let requireCodeOwnerReviews = false;
    if (r.ok) {
      try {
        requireCodeOwnerReviews = Boolean(
          JSON.parse(r.stdout)?.required_pull_request_reviews?.require_code_owner_reviews,
        );
      } catch {
        // leave false — an unparsable response is honestly "not confirmed"
      }
    }
    return { requireCodeOwnerReviews, codeownersPresent };
  }

  if (provider === 'gitlab') {
    // No generic GitLab tier probe wired yet — report honestly as not confirmed
    // rather than guessing; the evidence-based checker remains the guarantee.
    return { premiumOrHigher: false };
  }

  // Bitbucket / unset: substrate.mjs never calls this probe for these
  // providers (nit-a fix), so this branch is unreachable in practice — kept
  // only as a defensive fallback.
  return undefined;
}

const RUNG_GUARANTEE = {
  1: 'merge is blocked until governance checks pass (branch protection armed with required contexts)',
  2: 'the release/tag path fails closed on brain:audit violations before publish',
  3: 'post-merge CI auto-corrects violations after merge (auto-revert)',
};

/**
 * Prints the governance substrate ladder report (REQ-HONESTY-1, REQ-HONESTY-2).
 * Pure w.r.t. I/O — takes the already-computed `substrate` result and only
 * writes to console.log, so it is trivially covered by the caller's tests.
 * @param {Awaited<ReturnType<typeof detectSubstrate>>} substrate
 */
function printSubstrateReport(substrate) {
  console.log('  --- governance substrate ---');

  if (substrate.rung === 4) {
    // REQ-HONESTY-2: never a bare "ok" — this is a release-blocking-visible
    // concern, not a passing/neutral status.
    console.log('  RUNG 4 — DETECTION ONLY, no enforcing guarantee');
    console.log(
      '              violations are reported but nothing blocks merge, release, or post-merge',
    );
  } else {
    console.log(`  RUNG ${substrate.rung} — ${RUNG_GUARANTEE[substrate.rung]}`);
  }

  // REQ-HONESTY-1: remedy to climb higher, suppressed only at the ceiling (rung 1).
  if (substrate.rung !== 1 && substrate.remedy) {
    console.log(`              remedy: ${substrate.remedy}`);
  }

  // Rung-1 sub-gate breakdown (issue #244 A4, REQ-A4-2). Driven SOLELY by
  // gates.*.active/verifiable — never a hardcoded independent branch. An
  // API-verified gate (verifiable:true) renders as DETECTED; a config-declared,
  // non-remotely-verifiable gate (verifiable:false) renders the honest caveat —
  // never the word "verified". Data (substrate.mjs) and this rendering change
  // together (the honesty contract).
  const gates = substrate.rungs?.[1]?.gates ?? {};
  if (gates.pipelineMustSucceed?.active) {
    console.log('  merge gate     armed  [only_allow_merge_if_pipeline_succeeds / required checks]');
  }
  if (gates.protectedBranches?.active) {
    console.log('  push gate      armed  [protected branch — direct pushes blocked]');
  }
  if (gates.preReceive?.active) {
    // preReceive is ALWAYS verifiable:false (evalPreReceiveGate, substrate.mjs)
    // — no endpoint can ever confirm a bare-repo server hook is installed. A4's
    // entire point is to never claim detection/verification that can't happen,
    // so there is deliberately no "verified" branch here to keep in sync.
    console.log(
      '  pre-receive    armed (config-declared) — not remotely detectable; verify via install runbook (npm run brain:protect-server)',
    );
  }

  const brainWritesGate = substrate.rungs?.[1]?.gates?.brainWritesReviewed;
  if (brainWritesGate && brainWritesGate.active === false) {
    console.log(
      `  brain-writes-reviewed enforced at evidence rung; CODEOWNERS rung-1 enhancement unavailable: ${brainWritesGate.reason}`,
    );
  }

  console.log('');
}

/**
 * Read brain.config.json and report governance layer status.
 * Side-effecting (may probe the network) — only ever called from the CLI guard
 * with no overrides, so it hits the real config file, VCS provider, and
 * substrate probes. Tests MUST always pass `config`, `providerModule`, and
 * `probes` overrides to stay fully offline.
 *
 * @param {object} [opts]
 * @param {object} [opts.config]         brain.config.json contents (overrides disk read)
 * @param {object} [opts.env]            environment variables (defaults to process.env)
 * @param {object} [opts.providerModule] pre-resolved VCS provider module (overrides dynamic import)
 * @param {object} [opts.probes]         substrate probe overrides (see substrate.mjs)
 */
export async function reportGovernanceStatus({
  config: configOverride,
  env = process.env,
  providerModule: providerModuleOverride,
  probes: probeOverrides,
} = {}) {
  let config = configOverride;
  if (!config) {
    const configPath = resolve(REPO_ROOT, 'brain.config.json');
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.error(`brain:governance-status: cannot read brain.config.json — ${e.message}`);
      process.exit(1);
    }
  }

  const provider = config?.vcs?.provider ?? 'unknown';
  const project = config?.project?.slug ?? 'unknown';

  console.log(`\nbrain:governance status — ${project} (${provider})\n`);
  // Hooks and brain:audit are always ON regardless of provider tier.
  console.log('  hooks       ON  [universal]');
  console.log('  brain:audit ON  [universal]');
  // pre-receive is NOT universal — it is a rung-1 mechanism, armed only when
  // config-declared (config.vcs.selfHostedPreReceive). Rendered per-gate below,
  // in printSubstrateReport's rung-1 sub-gate breakdown (issue #244 A4).

  // The platform capability section is independent of the substrate ladder
  // below — it never early-returns anymore, so the substrate report (which
  // must print even with no VCS provider wired, per REQ-HONESTY-2) always runs.
  let providerModule = providerModuleOverride;
  let platformKnown = true;

  if (!config?.vcs?.provider) {
    console.log('  platform    UNKNOWN (vcs.provider not configured)');
    platformKnown = false;
  } else if (!providerModule) {
    try {
      providerModule = await import(`./vcs/providers/${provider}.mjs`);
    } catch (e) {
      console.log(`  platform    UNKNOWN (cannot load provider "${provider}": ${e.message})`);
      platformKnown = false;
    }
  }

  if (platformKnown && typeof providerModule?.capabilities !== 'function') {
    console.log(`  platform    UNKNOWN (provider "${provider}" does not implement capabilities())`);
    platformKnown = false;
  }

  if (platformKnown) {
    const branch = config?.project?.defaultBranch ?? 'main';
    const cap = await providerModule.capabilities({ project, branch });

    if (cap.hardEnforcement === 'available') {
      console.log('  platform    available  (branch protection APIs accessible)');
    } else if (cap.hardEnforcement === 'unavailable') {
      console.log('  platform    UNAVAILABLE');
      if (cap.remedy) console.log(`              → ${cap.remedy}`);
    } else {
      console.log('  platform    unknown');
      if (cap.detail) console.log(`              (${cap.detail})`);
    }
  }
  console.log('');

  const probes = {
    branchProtection: probeOverrides?.branchProtection ?? realBranchProtectionProbe,
    releaseGate: probeOverrides?.releaseGate ?? realReleaseGateProbe,
    postMergeCi: probeOverrides?.postMergeCi ?? realPostMergeCiProbe,
    brainWritesReviewed: probeOverrides?.brainWritesReviewed ?? realBrainWritesReviewedProbe,
  };

  const substrate = await detectSubstrate({ config, vcs: providerModule, env, probes });
  printSubstrateReport(substrate);
}

// CLI guard — the report runs ONLY when this file is invoked directly
// (`node brain/scripts/brain-governance-status.mjs` / `npm run brain:governance-status`),
// NEVER on import.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await reportGovernanceStatus();
}
