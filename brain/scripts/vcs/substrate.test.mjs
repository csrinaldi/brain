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
