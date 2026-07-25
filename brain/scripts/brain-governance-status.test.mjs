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

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import { reportGovernanceStatus } from './brain-governance-status.mjs';
import { checkContexts } from './vcs/governance-checks.mjs';
import { setSpawn } from './vcs/lib/exec.mjs';

afterEach(() => setSpawn(spawnSync));

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

// ── GitLab rung-1 ladder awareness (issue #244 A4) ──────────────────────────────
//
// realBranchProtectionProbe dispatches on config.vcs.provider, mirroring
// realBrainWritesReviewedProbe. These tests exercise the REAL (non-injected)
// probe — no `probes.branchProtection` override — via the shared `setSpawn`
// seam (vcs/lib/exec.mjs), fully offline. GitHub stays UNCHANGED (regression
// guard); GitLab reads the per-branch protected-branch endpoint PLUS the new
// projectMergeSettings verb (injected via `providerModule`, mirroring how
// `capabilities()` is already injected in every test above).

test('realBranchProtectionProbe: GitHub branch is UNCHANGED — same gh api read, same {status,contexts} shape, no pipelineMustSucceed field added', async () => {
  setSpawn((cmd, args) => {
    if (cmd === 'gh' && args[0] === 'api' && args[1] === 'repos/csrinaldi/brain/branches/main/protection') {
      return { status: 0, stdout: JSON.stringify({ required_status_checks: { contexts: OUR_CONTEXTS } }), stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected call: ' + cmd + ' ' + args.join(' ') };
  });

  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: baseConfig,
      env: {},
      providerModule: fakeProviderModule,
      probes: {
        releaseGate: async () => true,
        postMergeCi: async () => true,
        brainWritesReviewed: async () => ({ requireCodeOwnerReviews: true, codeownersPresent: true }),
        // branchProtection intentionally NOT overridden — exercises the real GitHub probe.
      },
    })
  );

  assert.match(logs.join('\n'), /RUNG 1\b/, 'the real GitHub probe must still arm rung 1 on 200+our contexts');
});

const fakeGitlabProviderModule = {
  capabilities: async () => ({ hardEnforcement: 'available' }),
  projectMergeSettings: async () => ({ onlyAllowMergeIfPipelineSucceeds: true }),
};

const gitlabConfig = {
  project: { slug: 'csrinaldi/brain', defaultBranch: 'main' },
  vcs: { provider: 'gitlab' },
};

test('realBranchProtectionProbe: GitLab dispatch reuses the sanctioned config path — per-branch read + injected projectMergeSettings, no direct process.env read', async () => {
  setSpawn((cmd, args) => {
    if (cmd === 'glab' && args[0] === 'api' && args[1] === 'projects/csrinaldi%2Fbrain/protected_branches/main') {
      return { status: 1, stdout: '', stderr: 'GET .../protected_branches/main: 404\n{"message":"404 Not Found"}' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected call: ' + cmd + ' ' + args.join(' ') };
  });

  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: gitlabConfig,
      env: {},
      providerModule: fakeGitlabProviderModule,
      probes: {
        releaseGate: async () => false,
        postMergeCi: async () => false,
        brainWritesReviewed: async () => ({ premiumOrHigher: false }),
        // branchProtection intentionally NOT overridden — exercises the real GitLab probe.
      },
    })
  );

  // pipelineMustSucceed armed (fakeGitlabProviderModule.projectMergeSettings → true),
  // protectedBranches not (404) — rung 1 armed via pipelineMustSucceed alone.
  assert.match(logs.join('\n'), /RUNG 1\b/);
});

test('realBranchProtectionProbe: an unreachable GET /projects/:id degrades honestly — pipelineMustSucceed reports available:false, report completes without throwing', async () => {
  setSpawn((cmd, args) => {
    if (cmd === 'glab' && args[1] === 'projects/csrinaldi%2Fbrain/protected_branches/main') {
      return { status: 1, stdout: '', stderr: 'GET .../protected_branches/main: 404\n{"message":"404 Not Found"}' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected call: ' + cmd + ' ' + args.join(' ') };
  });

  const unreachableProviderModule = {
    capabilities: async () => ({ hardEnforcement: 'available' }),
    projectMergeSettings: async () => ({ onlyAllowMergeIfPipelineSucceeds: null }), // uncomputable, never fabricated false
  };

  await assert.doesNotReject(async () => {
    const logs = await captureLog(() =>
      reportGovernanceStatus({
        config: gitlabConfig,
        env: {},
        providerModule: unreachableProviderModule,
        probes: {
          releaseGate: async () => false,
          postMergeCi: async () => false,
          brainWritesReviewed: async () => ({ premiumOrHigher: false }),
        },
      })
    );
    assert.doesNotMatch(logs.join('\n'), /RUNG 1\b/, 'uncomputable merge-gate + unset protected branches must not falsely arm rung 1');
  });
});

// ── Propagation proof — the null-coercion fix survives end-to-end (fresh-context review MAJOR) ──
//
// Exercises the REAL (non-injected) gitlab.mjs — no `providerModule` override —
// so `projectMergeSettings`'s actual JSON.parse/typeof-guard runs for real.
// `GET /projects/:id` succeeds (200, parseable) but the response body simply
// OMITS `only_allow_merge_if_pipeline_succeeds` (GitLab permission-gates some
// project attributes) — a case DISTINCT from a failed/unreachable read. Before
// the fix, `Boolean(undefined)` fabricated `false` ("readable, not
// configured") and the report would have said "not set" / offered the
// brain:protect remedy. After the fix, the `null` (uncomputable) survives
// gitlab.mjs → realBranchProtectionProbe's pass-through normalization →
// evalPipelineMustSucceedGate's three-way ladder → the printed report.

test('propagation proof: GET /projects/:id succeeds but omits the field — null (uncomputable) survives end-to-end through the REAL gitlab.mjs, never fabricated as "not configured"', async () => {
  setSpawn((cmd, args) => {
    if (cmd !== 'glab' || args[0] !== 'api') {
      return { status: 1, stdout: '', stderr: 'unexpected call: ' + cmd + ' ' + args.join(' ') };
    }
    // capabilities()'s protected_branches COLLECTION read (platform section).
    if (args[1] === 'projects/csrinaldi%2Fbrain/protected_branches') {
      return { status: 0, stdout: '[]', stderr: '' };
    }
    // realBranchProtectionProbe's per-branch protected-branch read.
    if (args[1] === 'projects/csrinaldi%2Fbrain/protected_branches/main') {
      return { status: 1, stdout: '', stderr: 'GET .../protected_branches/main: 404\n{"message":"404 Not Found"}' };
    }
    // projectMergeSettings' GET /projects/:id — 200, parseable, field ABSENT.
    if (args[1] === 'projects/csrinaldi%2Fbrain') {
      return { status: 0, stdout: JSON.stringify({ id: 1, path_with_namespace: 'csrinaldi/brain', default_branch: 'main' }), stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected glab api call: ' + args.join(' ') };
  });

  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: gitlabConfig,
      env: {},
      // providerModule intentionally NOT overridden — dynamically imports the REAL gitlab.mjs.
      probes: {
        releaseGate: async () => false,
        postMergeCi: async () => false,
        brainWritesReviewed: async () => ({ premiumOrHigher: false }),
        // branchProtection intentionally NOT overridden — exercises the real GitLab probe.
      },
    })
  );

  const output = logs.join('\n');
  assert.doesNotMatch(output, /RUNG 1\b/, 'an uncomputable merge-gate + unset protected branches must not falsely arm rung 1');
  assert.doesNotMatch(output, /merge gate\s+armed/i, 'a null (uncomputable) read must never render as armed');
  // printSubstrateReport does not currently render inactive-gate reasons for
  // rung-1 sub-gates (only active ones) — the DATA-level distinction
  // (available:false vs available:true on an uncomputable read) is proven
  // directly against detectSubstrate's `gates` object in substrate.test.mjs
  // ("propagation proof" test, wiring the REAL gitlab.mjs#projectMergeSettings
  // as the branchProtection probe) — that is the strong regression guard for
  // this fix; this test only proves the CLI report path completes honestly
  // (no crash, no false arming) when fed the real function's `null`.
});

// ── Honesty rendering — caveat IFF verifiable:false, never "verified" (REQ-A4-2) ─

test('printSubstrateReport: an active preReceive sub-gate renders the config-declared caveat, never "verified"', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: { ...gitlabConfig, vcs: { provider: 'gitlab', selfHostedPreReceive: true } },
      env: {},
      providerModule: fakeGitlabProviderModule,
      probes: {
        branchProtection: async () => ({ status: 404, contexts: [], pipelineMustSucceed: false }),
        releaseGate: async () => false,
        postMergeCi: async () => false,
        brainWritesReviewed: async () => ({ premiumOrHigher: false }),
      },
    })
  );

  const output = logs.join('\n');
  assert.match(output, /not remotely detectable/i);
  assert.match(output, /verify via install runbook/i);
  assert.doesNotMatch(output, /pre-receive[^\n]*verified/i, 'pre-receive must never be rendered as "verified"');
  assert.doesNotMatch(output, /verified[^\n]*pre-receive/i);
});

test('printSubstrateReport: an active API-verified gate (protectedBranches) does NOT borrow the pre-receive caveat', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: gitlabConfig,
      env: {},
      providerModule: fakeGitlabProviderModule,
      probes: {
        branchProtection: async () => ({ status: 200, contexts: [], pipelineMustSucceed: false }),
        releaseGate: async () => false,
        postMergeCi: async () => false,
        brainWritesReviewed: async () => ({ premiumOrHigher: false }),
      },
    })
  );

  const output = logs.join('\n');
  assert.match(output, /RUNG 1\b/);
  assert.doesNotMatch(output, /not remotely detectable/i, 'an API-verified gate must not attach the non-detectability caveat');
});

// ── Offline governance-status fixtures — 4 injected-probe cases (Decision 5) ────

test('governance-status GitLab fixture: pipelineMustSucceed-armed — RUNG 1, merge gate armed, push gate inactive, NO pre-receive caveat', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: gitlabConfig,
      env: {},
      providerModule: fakeGitlabProviderModule,
      probes: {
        branchProtection: async () => ({ status: 404, contexts: [], pipelineMustSucceed: true }),
        releaseGate: async () => false,
        postMergeCi: async () => false,
        brainWritesReviewed: async () => ({ premiumOrHigher: false }),
      },
    })
  );

  const output = logs.join('\n');
  assert.match(output, /RUNG 1\b/);
  assert.match(output, /merge gate\s+armed/i);
  assert.doesNotMatch(output, /push gate\s+armed/i);
  assert.doesNotMatch(output, /not remotely detectable/i);
});

test('governance-status GitLab fixture: protectedBranches-armed — RUNG 1, push gate armed, merge gate inactive', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: gitlabConfig,
      env: {},
      providerModule: fakeGitlabProviderModule,
      probes: {
        branchProtection: async () => ({ status: 200, contexts: [], pipelineMustSucceed: false }),
        releaseGate: async () => false,
        postMergeCi: async () => false,
        brainWritesReviewed: async () => ({ premiumOrHigher: false }),
      },
    })
  );

  const output = logs.join('\n');
  assert.match(output, /RUNG 1\b/);
  assert.match(output, /push gate\s+armed/i);
  assert.doesNotMatch(output, /merge gate\s+armed/i);
});

test('governance-status GitLab fixture: preReceive-declared-only — RUNG 1, pre-receive caveat renders (verifiable:false), never "verified"', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: { ...gitlabConfig, vcs: { provider: 'gitlab', selfHostedPreReceive: true } },
      env: {},
      providerModule: fakeGitlabProviderModule,
      probes: {
        branchProtection: async () => ({ status: 404, contexts: [], pipelineMustSucceed: false }),
        releaseGate: async () => false,
        postMergeCi: async () => false,
        brainWritesReviewed: async () => ({ premiumOrHigher: false }),
      },
    })
  );

  const output = logs.join('\n');
  assert.match(output, /RUNG 1\b/);
  assert.match(output, /not remotely detectable/i);
  assert.doesNotMatch(output, /pre-receive[^\n]*verified/i);
});

test('governance-status GitLab fixture: none armed — rung falls below 1, no false arming', async () => {
  const logs = await captureLog(() =>
    reportGovernanceStatus({
      config: gitlabConfig,
      env: {},
      providerModule: fakeGitlabProviderModule,
      probes: {
        branchProtection: async () => ({ status: 404, contexts: [], pipelineMustSucceed: false }),
        releaseGate: async () => false,
        postMergeCi: async () => false,
        brainWritesReviewed: async () => ({ premiumOrHigher: false }),
      },
    })
  );

  const output = logs.join('\n');
  assert.doesNotMatch(output, /RUNG 1\b/);
});
