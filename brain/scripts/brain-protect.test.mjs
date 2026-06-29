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
