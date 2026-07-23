// brain-protect.test.mjs — regression guard for the CLI-guard incident.
//
// brain-protect.mjs performs a network branch-protection mutation. It MUST only
// run when invoked directly (CLI), never on import. Without the `import.meta.url`
// guard, importing the module executes activateProtection() at top level —
// reading config, dispatching to the provider, and (on failure) calling
// process.exit, which would crash any importer. This test fails closed if the
// guard regresses: a clean import that exports the function proves the guard holds.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { verifyArmedProtection, verifyAfterArm } from './brain-protect.mjs';

test('brain-protect: importing is side-effect-free (CLI guard holds)', async () => {
  const mod = await import('./brain-protect.mjs');
  assert.equal(
    typeof mod.activateProtection,
    'function',
    'activateProtection must be exported',
  );
  // Reaching here means the import did NOT invoke activateProtection() — if the
  // CLI guard were removed, the top-level activation would have run on import
  // (network mutation / process.exit), and this test would never get here.
});

// ── verifyArmedProtection (issue #203, deliverable 3 — arm-and-verify) ─────────
//
// Best-effort post-arm verification: warns (never fails) when a required check
// context has no matching check-run yet. The check-run query is injected via
// `listCheckRuns` — no real `gh` call, no config file read, no process.exit.

test('verifyArmedProtection: warns when a required context has no matching check-run', async () => {
  const logs = [];
  await verifyArmedProtection({
    checks: ['issue-link', 'diff-size'],
    project: 'acme/repo',
    listCheckRuns: async () => ['issue-link'],
    log: (msg) => logs.push(msg),
  });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /diff-size/);
});

test('verifyArmedProtection: no warning when all required contexts have matching check-runs', async () => {
  const logs = [];
  await verifyArmedProtection({
    checks: ['issue-link', 'diff-size'],
    project: 'acme/repo',
    listCheckRuns: async () => ['issue-link', 'diff-size', 'local-checks'],
    log: (msg) => logs.push(msg),
  });
  assert.deepEqual(logs, []);
});

test('verifyArmedProtection: zero check-runs emits a single unverifiable note, not N warnings', async () => {
  const logs = [];
  await verifyArmedProtection({
    checks: ['issue-link', 'diff-size', 'local-checks'],
    project: 'acme/repo',
    listCheckRuns: async () => [],
    log: (msg) => logs.push(msg),
  });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /unverifiable|no check-runs/i);
});

// ── verifyArmedProtection — F1: never crash activateProtection (issue #203 review) ─
//
// A future provider's checkRuns/listCheckRuns could throw (or reject) instead of
// swallowing its own errors the way github.mjs does today. That must degrade to
// the same "unverifiable" note, never propagate — armed protection already
// succeeded by the time this runs, and a verification-layer bug must not look
// like an armed-protection failure.

test('verifyArmedProtection: a throwing listCheckRuns resolves (unverifiable), never rejects', async () => {
  const logs = [];
  await assert.doesNotReject(() =>
    verifyArmedProtection({
      checks: ['issue-link'],
      project: 'acme/repo',
      listCheckRuns: async () => { throw new Error('boom'); },
      log: (msg) => logs.push(msg),
    })
  );
  assert.equal(logs.length, 1);
  assert.match(logs[0], /unverifiable|no check-runs/i);
});

test('verifyArmedProtection: a listCheckRuns that returns a rejected promise also resolves (unverifiable)', async () => {
  const logs = [];
  await assert.doesNotReject(() =>
    verifyArmedProtection({
      checks: ['issue-link'],
      project: 'acme/repo',
      listCheckRuns: () => Promise.reject(new Error('network timeout')),
      log: (msg) => logs.push(msg),
    })
  );
  assert.equal(logs.length, 1);
  assert.match(logs[0], /unverifiable|no check-runs/i);
});

// ── verifyAfterArm — F2: distinguish "unsupported" from "no runs yet" (issue #203) ─
//
// A provider without a checkRuns verb (e.g. a hypothetical GitLab provider) would
// otherwise get the misleading "no runs yet — unverifiable until the first PR
// runs" note, which implies it will self-resolve. It never will, because that
// provider has no run-based verb at all. That case must get a DISTINCT note.

test('verifyAfterArm: provider without checkRuns logs "unsupported", never the no-runs-yet note', async () => {
  const logs = [];
  await verifyAfterArm({
    checks: ['issue-link', 'diff-size'],
    project: 'acme/repo',
    branch: 'main',
    provider: 'gitlab',
    providerModule: {}, // no checkRuns function — simulates a provider without the verb
    log: (msg) => logs.push(msg),
  });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /not supported|unsupported/i);
  assert.doesNotMatch(logs[0], /no check-runs|unverifiable/i);
});

test('verifyAfterArm: provider WITH checkRuns still runs run-based verification (no-runs-yet note on zero runs)', async () => {
  const logs = [];
  await verifyAfterArm({
    checks: ['issue-link'],
    project: 'acme/repo',
    branch: 'main',
    provider: 'github',
    providerModule: { checkRuns: async () => [] },
    log: (msg) => logs.push(msg),
  });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /unverifiable|no check-runs/i);
});
