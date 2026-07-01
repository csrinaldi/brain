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

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectSubstrate } from './substrate.mjs';
import { checkContexts } from './governance-checks.mjs';

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
