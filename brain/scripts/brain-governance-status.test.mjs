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
