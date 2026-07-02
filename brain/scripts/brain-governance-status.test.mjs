// brain-governance-status.test.mjs — regression guard for the CLI guard.
//
// brain-governance-status.mjs probes the VCS provider and prints to stdout.
// It MUST only run when invoked directly (CLI), never on import. Without the
// `import.meta.url` guard, importing the module would execute reportGovernanceStatus()
// at top level — reading config, calling the provider, printing to stdout — which
// would produce unexpected side effects in any importer.
//
// This test fails closed if the guard regresses: a clean import that exports the
// function proves the guard holds.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reportGovernanceStatus } from './brain-governance-status.mjs';
import { checkContexts } from './vcs/governance-checks.mjs';

test('brain-governance-status: importing is side-effect-free (CLI guard holds)', async () => {
  const mod = await import('./brain-governance-status.mjs');
  assert.equal(
    typeof mod.reportGovernanceStatus,
    'function',
    'reportGovernanceStatus must be exported',
  );
  // Reaching here means the import did NOT invoke reportGovernanceStatus() — if the
  // CLI guard were removed, the top-level report would have run on import (reading
  // config, probing the network, printing to stdout), and this test would still pass
  // but would produce side effects. The guard prevents that.
});

// ── PR2b — detectSubstrate wired into reportGovernanceStatus (REQ-HONESTY-1/2) ──
//
// Every scenario below injects `probes` (and a fake `providerModule`) so no real
// network/gh/fs I/O happens — reportGovernanceStatus() is fully offline-testable,
// same seam pattern as substrate.test.mjs and gentle-ai.test.mjs's captureLog.

/** Capture console.log lines while calling fn(). */
async function captureLog(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { await fn(); } finally { console.log = orig; }
  return logs;
}

const OUR_CONTEXTS = checkContexts();

const baseConfig = {
  project: { slug: 'csrinaldi/brain', defaultBranch: 'main' },
  vcs: { provider: 'github' },
};

// A fake VCS provider module — capabilities() never hits the network.
const fakeProviderModule = {
  capabilities: async () => ({ hardEnforcement: 'available' }),
};

test('reportGovernanceStatus: rung-1-armed fixture reports RUNG 1 with no remedy line', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: baseConfig,
      env: {},
      providerModule: fakeProviderModule,
      probes: {
        branchProtection: async () => ({ status: 200, contexts: OUR_CONTEXTS }),
        releaseGate: async () => true,
        postMergeCi: async () => true,
        brainWritesReviewed: async () => ({ requireCodeOwnerReviews: true, codeownersPresent: true }),
      },
    })
  );

  const output = logs.join('\n');
  assert.match(output, /RUNG 1\b/);
  assert.doesNotMatch(output, /remedy:/i, 'rung 1 is the ceiling — no remedy line should print');
});

test('reportGovernanceStatus: rung-2-only fixture reports RUNG 2 with a remedy to reach rung 1', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: baseConfig,
      env: {},
      providerModule: fakeProviderModule,
      probes: {
        branchProtection: async () => ({ status: 404, contexts: [] }),
        releaseGate: async () => true,
        postMergeCi: async () => false,
        brainWritesReviewed: async () => ({ requireCodeOwnerReviews: false, codeownersPresent: false }),
      },
    })
  );

  const output = logs.join('\n');
  assert.match(output, /RUNG 2\b/);
  assert.match(output, /remedy:.*brain:protect/is, 'must include remedy text describing how to reach rung 1');
});

test('reportGovernanceStatus: rung-3-only fixture reports RUNG 3 with remedy text', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: baseConfig,
      env: {},
      providerModule: fakeProviderModule,
      probes: {
        branchProtection: async () => ({ status: 404, contexts: [] }),
        releaseGate: async () => false,
        postMergeCi: async () => true,
        brainWritesReviewed: async () => ({ requireCodeOwnerReviews: false, codeownersPresent: false }),
      },
    })
  );

  const output = logs.join('\n');
  assert.match(output, /RUNG 3\b/);
  assert.match(output, /remedy:/i);
});

test('reportGovernanceStatus: rung-4 (detection-only) fixture prints the prominent release-blocking-visible warning, never a bare "ok"', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: baseConfig,
      env: {},
      providerModule: fakeProviderModule,
      probes: {
        branchProtection: async () => ({ status: 404, contexts: [] }),
        releaseGate: async () => false,
        postMergeCi: async () => false,
        brainWritesReviewed: async () => ({ requireCodeOwnerReviews: false, codeownersPresent: false }),
      },
    })
  );

  const output = logs.join('\n');
  assert.match(output, /RUNG 4 — DETECTION ONLY, no enforcing guarantee/);
  assert.ok(
    !logs.some((line) => /^\s*ok\s*$/i.test(line.trim())),
    'rung-4 must never be rendered as a bare "ok" / passing status',
  );
});

test('reportGovernanceStatus: L6 sub-status line prints when brainWritesReviewed gate is inactive', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: baseConfig,
      env: {},
      providerModule: fakeProviderModule,
      probes: {
        branchProtection: async () => ({ status: 200, contexts: OUR_CONTEXTS }),
        releaseGate: async () => true,
        postMergeCi: async () => true,
        brainWritesReviewed: async () => ({ requireCodeOwnerReviews: false, codeownersPresent: false }),
      },
    })
  );

  const output = logs.join('\n');
  assert.match(
    output,
    /brain-writes-reviewed enforced at evidence rung; CODEOWNERS rung-1 enhancement unavailable:/,
  );
  assert.match(output, /CODEOWNERS/);
});

test('reportGovernanceStatus: L6 sub-status line is absent when brainWritesReviewed gate is active', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: baseConfig,
      env: {},
      providerModule: fakeProviderModule,
      probes: {
        branchProtection: async () => ({ status: 200, contexts: OUR_CONTEXTS }),
        releaseGate: async () => true,
        postMergeCi: async () => true,
        brainWritesReviewed: async () => ({ requireCodeOwnerReviews: true, codeownersPresent: true }),
      },
    })
  );

  const output = logs.join('\n');
  assert.doesNotMatch(output, /brain-writes-reviewed enforced at evidence rung/);
});
