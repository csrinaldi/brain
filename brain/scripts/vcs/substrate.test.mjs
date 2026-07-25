// substrate.test.mjs — Tests for the capability-aware substrate detector (PR2a).
//
// detectSubstrate() generalizes brain-protect.mjs's {enforced, reason, remedy} shape
// to all of governance and reports the highest ARMED rung (1=merge, 2=release,
// 3=auto-correct, 4=floor). Every probe is injected via `probes` so these tests run
// fully offline: no network, no git state, no ambient env/fs coupling. `env` is
// ALWAYS passed explicitly (never defaulted to process.env) so this suite behaves
// identically locally and inside GitHub Actions (where GITHUB_ACTIONS=true would
// otherwise silently flip rung-3 detection — see CI fragility note in apply-progress).
//
// Run with: npm test (node --test)

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { detectSubstrate } from './substrate.mjs';
import { checkContexts } from './governance-checks.mjs';
import { setSpawn } from './lib/exec.mjs';
import * as gitlab from './providers/gitlab.mjs';

afterEach(() => setSpawn(spawnSync));

// ── Floor fallback (no probes/config) ───────────────────────────────────────────

test('detectSubstrate: no probes/config/vcs degrades to rung 4 (floor), never crashes', async () => {
  const result = await detectSubstrate({ env: {} });

  assert.equal(result.rung, 4);
  assert.equal(result.enforced, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0, 'reason must be a non-empty string');
  assert.ok(typeof result.remedy === 'string' && result.remedy.length > 0, 'remedy must be a non-empty string');
  assert.ok(result.rungs && typeof result.rungs === 'object', 'rungs must be present');
});

test('detectSubstrate: called with no arguments at all never throws (default env)', async () => {
  // Only assert it resolves without throwing — deliberately does not assert `rung`,
  // since a bare call falls back to the REAL process.env/fs, which is only
  // acceptable for "does it crash", never for a deterministic rung assertion.
  await assert.doesNotReject(async () => detectSubstrate());
});

// ── Rung 3 — auto-correct (post-merge CI presence) ──────────────────────────────

test('detectSubstrate: rung 3 armed when the postMergeCi probe returns true', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      postMergeCi: async () => true,
    },
  });

  assert.equal(result.rung, 3);
  assert.equal(result.enforced, true);
  assert.equal(result.rungs[3].active, true);
});

test('detectSubstrate: rung 3 inactive when the postMergeCi probe returns false', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      postMergeCi: async () => false,
    },
  });

  assert.equal(result.rung, 4);
  assert.equal(result.rungs[3].active, false);
  assert.ok(typeof result.rungs[3].reason === 'string' && result.rungs[3].reason.length > 0);
  assert.ok(typeof result.rungs[3].remedy === 'string' && result.rungs[3].remedy.length > 0);
});

// ── Rung 2 — release (release-gate presence) ────────────────────────────────────

test('detectSubstrate: rung 2 armed when the releaseGate probe returns true (rung 3 absent)', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      releaseGate: async () => true,
    },
  });

  assert.equal(result.rung, 2);
  assert.equal(result.enforced, true);
  assert.equal(result.rungs[2].active, true);
  // Below rung 1 (no branchProtection probe wired here), so the top-level
  // reason/remedy surface rung 1's blocker — the actionable next step to climb.
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
  assert.ok(typeof result.remedy === 'string' && result.remedy.length > 0);
});

test('detectSubstrate: rung 2 wins over rung 3 when both are armed (higher rung takes priority)', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      releaseGate: async () => true,
      postMergeCi: async () => true,
    },
  });

  assert.equal(result.rung, 2);
});

// ── Rung 1 — merge (finer branch-protection read, beyond capabilities()) ────────
//
// capabilities() (github.mjs:96-100) maps BOTH 200 and 404 to 'available' — correct
// for "can I call brain:protect?" but it cannot distinguish armed (rung 1 active)
// from available-but-unset. detectSubstrate adds that distinction itself, via the
// injected branchProtection probe's raw { status, contexts } read (design §1 "why
// finer than capabilities()"). checkContexts() (not hardcoded) defines "our
// required contexts" so this test tracks REQUIRED_JOBS without duplicating it.

const OUR_CONTEXTS = checkContexts();

test('detectSubstrate: rung 1 armed on 200 + our required contexts present', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      branchProtection: async () => ({ status: 200, contexts: OUR_CONTEXTS }),
    },
  });

  assert.equal(result.rung, 1);
  assert.equal(result.enforced, true);
  assert.equal(result.reason, null);
  assert.equal(result.remedy, null);
});

test('detectSubstrate: rung 1 NOT armed on 200 without our required contexts (falls through)', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      branchProtection: async () => ({ status: 200, contexts: ['some-other-check'] }),
    },
  });

  assert.notEqual(result.rung, 1);
  assert.equal(result.rungs[1].active, false);
});

test('detectSubstrate: rung 1 NOT armed on 404 (available but unset) — falls to rung 4', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      branchProtection: async () => ({ status: 404, contexts: [] }),
    },
  });

  assert.equal(result.rung, 4);
  assert.equal(result.rungs[1].available, true, 'branch protection API is reachable — capability is available');
  assert.equal(result.rungs[1].active, false, 'but not yet configured — not armed');
  assert.ok(/unset|not configured|not armed/i.test(result.rungs[1].reason));
});

test('detectSubstrate: rung 1 NOT armed on 403/tier-locked — unavailable, not just unset', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      branchProtection: async () => ({ status: 403, contexts: [] }),
    },
  });

  assert.equal(result.rung, 4);
  assert.equal(result.rungs[1].available, false, 'tier-locked means the capability itself is unavailable');
  assert.equal(result.rungs[1].active, false);
  assert.ok(typeof result.rungs[1].remedy === 'string' && result.rungs[1].remedy.length > 0);
});

test('detectSubstrate: rung 1 armed via self-hosted pre-receive floor, bypassing the probe entirely', async () => {
  const result = await detectSubstrate({
    config: { vcs: { selfHostedPreReceive: true } },
    env: {},
    probes: {
      // If this were called, the self-hosted override would still have to win —
      // but self-hosted arms WITHOUT needing the probe at all.
      branchProtection: async () => ({ status: 403, contexts: [] }),
    },
  });

  assert.equal(result.rung, 1);
  assert.equal(result.enforced, true);
});

// ── GitLab rung-1 sub-gates (issue #244 A4) ─────────────────────────────────────
//
// GitLab rung-1 splits into three honestly-reported sub-gates —
// pipelineMustSucceed (load-bearing, verifiable:true), protectedBranches
// (complementary, verifiable:true), preReceive (config-declared,
// verifiable:false) — OR-composed. This replaces the selfHostedPreReceive
// short-circuit (:98-100). The no-provider (GitHub) cases above MUST stay
// green with ZERO assertion changes (behavior-preservation, Phase 3).

test('detectSubstrate: GitLab rung-1 — pipelineMustSucceed alone arms rung 1 (CP-A2b mirror state)', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'gitlab' } },
    env: {},
    probes: {
      branchProtection: async () => ({ status: 404, contexts: [], pipelineMustSucceed: true }),
    },
  });

  const gates = result.rungs[1].gates;
  assert.equal(gates.pipelineMustSucceed.active, true, 'pipelineMustSucceed must arm rung-1 alone — presence-alone would wrongly report absent here');
  assert.equal(gates.pipelineMustSucceed.verifiable, true);
  assert.equal(gates.pipelineMustSucceed.mechanism, 'branch-merge-gate-api');
  assert.equal(gates.protectedBranches.active, false, 'no protected branches configured on the mirror — honestly inactive');
  assert.equal(result.rung, 1);
  assert.equal(result.rungs[1].active, true);
});

test('detectSubstrate: GitLab rung-1 — neither sub-gate armed → rung-1 inactive with a remedy', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'gitlab' } },
    env: {},
    probes: {
      branchProtection: async () => ({ status: 404, contexts: [], pipelineMustSucceed: false }),
    },
  });

  assert.equal(result.rungs[1].active, false);
  assert.notEqual(result.rung, 1);
  assert.ok(typeof result.rungs[1].remedy === 'string' && result.rungs[1].remedy.length > 0);
});

test('detectSubstrate: GitLab rung-1 — protectedBranches alone arms rung 1 (per-branch push gate present)', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'gitlab' } },
    env: {},
    probes: {
      branchProtection: async () => ({ status: 200, contexts: [], pipelineMustSucceed: false }),
    },
  });

  const gates = result.rungs[1].gates;
  assert.equal(gates.protectedBranches.active, true);
  assert.equal(gates.protectedBranches.verifiable, true);
  assert.equal(gates.protectedBranches.mechanism, 'protected-branch-api');
  assert.equal(gates.pipelineMustSucceed.active, false);
  assert.equal(result.rung, 1);
});

test('detectSubstrate: GitLab rung-1 — selfHostedPreReceive arms via the preReceive sub-gate, not a short-circuit', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'gitlab', selfHostedPreReceive: true } },
    env: {},
    probes: {
      branchProtection: async () => ({ status: 403, contexts: [], pipelineMustSucceed: false }),
    },
  });

  const gates = result.rungs[1].gates;
  assert.equal(gates.preReceive.active, true);
  assert.equal(gates.preReceive.verifiable, false, 'THE honesty flag — no endpoint reports a bare-repo hook');
  assert.equal(gates.preReceive.mechanism, 'pre-receive-config-declared');
  assert.equal(result.rung, 1, 'the short-circuit is gone — the preReceive sub-gate arms rung-1 itself');
  assert.equal(result.enforced, true);
});

test('detectSubstrate: GitLab rung-1 — pipelineMustSucceed uncomputable (undefined) reports available:false honestly, never a fabricated "not armed"', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'gitlab' } },
    env: {},
    probes: {
      branchProtection: async () => ({ status: 404, contexts: [] }), // no pipelineMustSucceed field — uncomputable
    },
  });

  const gate = result.rungs[1].gates.pipelineMustSucceed;
  assert.equal(gate.available, false, 'uncomputable must surface as available:false, not silently "not configured"');
  assert.equal(gate.active, false);
  assert.ok(typeof gate.remedy === 'string' && gate.remedy.length > 0);
});

// ── Propagation proof: the REAL gitlab.mjs#projectMergeSettings null-coercion
// fix survives end-to-end into evalPipelineMustSucceedGate (fresh-context
// review MAJOR — issue #244 A4). Wires the ACTUAL provider function (not a
// hand-rolled fixture returning `null`) as the branchProtection probe, via the
// shared `setSpawn` seam. `GET /projects/:id` succeeds (200, parseable) but
// the body OMITS `only_allow_merge_if_pipeline_succeeds` — a case distinct
// from a failed/unreachable read. Before the null-coercion fix, gitlab.mjs's
// `Boolean(undefined)` fabricated `false` here, which evalPipelineMustSucceedGate
// would have reported as `available:true` ("readable, not configured"),
// masking the honesty violation completely. This test fails if that coercion
// regresses, independent of the providers.test.mjs unit test on gitlab.mjs alone.

test('propagation proof: null from the REAL gitlab.mjs#projectMergeSettings (field absent from a successful read) reaches evalPipelineMustSucceedGate as available:false, never fabricated as "not configured"', async () => {
  setSpawn((cmd, args) => {
    if (cmd === 'glab' && args[0] === 'api' && args[1] === 'projects/csrinaldi%2Fbrain') {
      // 200, parseable, but only_allow_merge_if_pipeline_succeeds is absent.
      return { status: 0, stdout: JSON.stringify({ id: 1, path_with_namespace: 'csrinaldi/brain', default_branch: 'main' }), stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected call: ' + cmd + ' ' + args.join(' ') };
  });

  const result = await detectSubstrate({
    config: { vcs: { provider: 'gitlab' } },
    env: {},
    probes: {
      // Mirrors realBranchProtectionProbe's GitLab normalization, but calls
      // the REAL gitlab.mjs function under test (not a fixture double).
      branchProtection: async () => {
        const { onlyAllowMergeIfPipelineSucceeds } = await gitlab.projectMergeSettings({ project: 'csrinaldi/brain' });
        return { status: 404, contexts: [], pipelineMustSucceed: onlyAllowMergeIfPipelineSucceeds };
      },
    },
  });

  const gate = result.rungs[1].gates.pipelineMustSucceed;
  assert.equal(gate.available, false, 'the real function\'s null must survive as available:false — a fabricated false would have reported available:true');
  assert.equal(gate.active, false);
  assert.match(gate.reason, /uncomputable/i);
  assert.doesNotMatch(gate.reason, /is not set/i, 'must not be the "readable, not configured" reason — that would mean null was coerced to false');
  assert.notEqual(result.rung, 1);
});

// ── rungs[1].gates.brainWritesReviewed — per-provider L6 rung-1 sub-probe ───────
//
// Rung 1 is not monolithic: L6 "required code-owner review" is platform-specific.
// GitHub needs branch protection require_code_owner_reviews AND .github/CODEOWNERS;
// GitLab needs Premium+; Bitbucket has no such capability at all. The evidence
// checker (brain-writes-reviewed.mjs, PR6a) is the actual enforcement — this is
// only an OPTIONAL rung-1 enhancement, reported honestly when unavailable.

test('detectSubstrate: brainWritesReviewed armed on GitHub with require_code_owner_reviews + CODEOWNERS', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'github' } },
    env: {},
    probes: {
      brainWritesReviewed: async () => ({ requireCodeOwnerReviews: true, codeownersPresent: true }),
    },
  });

  const gate = result.rungs[1].gates.brainWritesReviewed;
  assert.equal(gate.available, true);
  assert.equal(gate.active, true);
});

test('detectSubstrate: brainWritesReviewed unavailable on GitHub without CODEOWNERS (honest reason)', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'github' } },
    env: {},
    probes: {
      brainWritesReviewed: async () => ({ requireCodeOwnerReviews: true, codeownersPresent: false }),
    },
  });

  const gate = result.rungs[1].gates.brainWritesReviewed;
  assert.equal(gate.available, false);
  assert.ok(/CODEOWNERS/.test(gate.reason));
  assert.ok(typeof gate.remedy === 'string' && gate.remedy.length > 0);
});

test('detectSubstrate: brainWritesReviewed armed on GitLab Premium+', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'gitlab' } },
    env: {},
    probes: {
      brainWritesReviewed: async () => ({ premiumOrHigher: true }),
    },
  });

  const gate = result.rungs[1].gates.brainWritesReviewed;
  assert.equal(gate.available, true);
  assert.equal(gate.active, true);
});

test('detectSubstrate: brainWritesReviewed unavailable on GitLab below Premium', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'gitlab' } },
    env: {},
    probes: {
      brainWritesReviewed: async () => ({ premiumOrHigher: false }),
    },
  });

  const gate = result.rungs[1].gates.brainWritesReviewed;
  assert.equal(gate.available, false);
  assert.ok(/Premium/.test(gate.reason));
});

test('detectSubstrate: brainWritesReviewed reports n/a on Bitbucket (honest, no probe needed)', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'bitbucket' } },
    env: {},
    probes: {},
  });

  const gate = result.rungs[1].gates.brainWritesReviewed;
  assert.equal(gate.available, false);
  assert.ok(/Bitbucket/.test(gate.reason));
});

test('detectSubstrate: brainWritesReviewed degrades honestly when provider is unset', async () => {
  const result = await detectSubstrate({ env: {}, probes: {} });

  const gate = result.rungs[1].gates.brainWritesReviewed;
  assert.equal(gate.available, false);
  assert.ok(typeof gate.reason === 'string' && gate.reason.length > 0);
});

test('detectSubstrate: brainWritesReviewed probe throwing degrades to unavailable, never crashes', async () => {
  const result = await detectSubstrate({
    config: { vcs: { provider: 'github' } },
    env: {},
    probes: {
      brainWritesReviewed: async () => { throw new Error('network blip'); },
    },
  });

  const gate = result.rungs[1].gates.brainWritesReviewed;
  assert.equal(gate.available, false);
});

// PR2b nit (a) — the brainWritesReviewed probe is only meaningful for providers
// that actually have a rung-1 code-owner-review mechanism (GitHub, GitLab). For
// Bitbucket and an unset provider there is nothing to probe — calling it anyway
// is a wasted network/gh call. The probe call must live inside the
// github/gitlab branches only (or the function must early-return before it).

test('detectSubstrate: brainWritesReviewed probe is never invoked for Bitbucket (no such capability)', async () => {
  let called = false;
  const result = await detectSubstrate({
    config: { vcs: { provider: 'bitbucket' } },
    env: {},
    probes: {
      brainWritesReviewed: async () => { called = true; return {}; },
    },
  });

  assert.equal(called, false, 'Bitbucket has no rung-1 code-owner-review capability — the probe must not be called');
  assert.equal(result.rungs[1].gates.brainWritesReviewed.available, false);
});

test('detectSubstrate: brainWritesReviewed probe is never invoked when provider is unset', async () => {
  let called = false;
  const result = await detectSubstrate({
    env: {},
    probes: {
      brainWritesReviewed: async () => { called = true; return {}; },
    },
  });

  assert.equal(called, false, 'no provider configured — nothing to probe, the probe must not be called');
});

// ── Probe-throws-never-crashes: every rung's probe, not just gates ─────────────

test('detectSubstrate: a throwing branchProtection probe degrades rung 1 to inactive, never crashes', async () => {
  await assert.doesNotReject(async () => {
    const result = await detectSubstrate({
      env: {},
      probes: {
        branchProtection: async () => { throw new Error('gh api timeout'); },
      },
    });
    assert.equal(result.rungs[1].active, false);
    assert.notEqual(result.rung, 1);
  });
});

test('detectSubstrate: a throwing releaseGate probe degrades rung 2 to inactive, never crashes', async () => {
  await assert.doesNotReject(async () => {
    const result = await detectSubstrate({
      env: {},
      probes: {
        releaseGate: () => { throw new Error('fs read error'); },
      },
    });
    assert.equal(result.rungs[2].active, false);
  });
});

test('detectSubstrate: a throwing postMergeCi probe degrades rung 3 to inactive, never crashes', async () => {
  await assert.doesNotReject(async () => {
    const result = await detectSubstrate({
      env: {},
      probes: {
        postMergeCi: () => { throw new Error('boom'); },
      },
    });
    assert.equal(result.rungs[3].active, false);
  });
});

test('detectSubstrate: ALL probes throwing degrades all the way to rung 4, never crashes', async () => {
  await assert.doesNotReject(async () => {
    const result = await detectSubstrate({
      env: {},
      probes: {
        branchProtection: async () => { throw new Error('boom'); },
        releaseGate: async () => { throw new Error('boom'); },
        postMergeCi: async () => { throw new Error('boom'); },
        brainWritesReviewed: async () => { throw new Error('boom'); },
      },
    });
    assert.equal(result.rung, 4);
    assert.equal(result.enforced, false);
  });
});

// ── Highest-armed-rung selection across full combinations ──────────────────────

test('detectSubstrate: all rungs armed selects rung 1 (highest wins)', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      branchProtection: async () => ({ status: 200, contexts: OUR_CONTEXTS }),
      releaseGate: async () => true,
      postMergeCi: async () => true,
    },
  });
  assert.equal(result.rung, 1);
  assert.equal(result.enforced, true);
});

// PR2b nit (b) — rungs arm INDEPENDENTLY of which one is ultimately "selected".
// Locks in that rungs[2] and rungs[3] both report active:true in an "all rungs
// armed" fixture even though the top-level `rung` is 1 (highest wins for
// selection, but every rung's own evidence is still reported honestly).
test('detectSubstrate: all rungs armed — rungs[2] and rungs[3] are both independently active alongside selected rung 1', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      branchProtection: async () => ({ status: 200, contexts: OUR_CONTEXTS }),
      releaseGate: async () => true,
      postMergeCi: async () => true,
    },
  });
  assert.equal(result.rung, 1);
  assert.equal(result.rungs[2].active, true, 'rung 2 evidence arms independently of the selected rung');
  assert.equal(result.rungs[3].active, true, 'rung 3 evidence arms independently of the selected rung');
});

test('detectSubstrate: only rung 3 armed selects rung 3', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      branchProtection: async () => ({ status: 404, contexts: [] }),
      releaseGate: async () => false,
      postMergeCi: async () => true,
    },
  });
  assert.equal(result.rung, 3);
  assert.equal(result.enforced, true);
});

test('detectSubstrate: none armed selects rung 4 (detection-only)', async () => {
  const result = await detectSubstrate({
    env: {},
    probes: {
      branchProtection: async () => ({ status: 403, contexts: [] }),
      releaseGate: async () => false,
      postMergeCi: async () => false,
    },
  });
  assert.equal(result.rung, 4);
  assert.equal(result.enforced, false);
});

test('neutrality source-scan (REQ-NEUTRALITY-2): substrate.mjs source contains no .claude or SKILL.md literal', () => {
  const srcPath = fileURLToPath(new URL('./substrate.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.equal(src.includes('.claude'), false, 'source must not reference .claude');
  assert.equal(src.includes('SKILL.md'), false, 'source must not reference SKILL.md');
});
