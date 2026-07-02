// home-index-adapter.test.mjs — File assertion for install-home-scaffold REQ-5:
// the Claude adapter (.claude/commands/project-bootstrap-adrs.md) Phase 4 MUST
// delegate to the home-index.mjs helper instead of describing the HOME.md-patch
// algorithm (locate heading / bound section / find last link line) in prose.
//
// This guards against regression: any future edit that reintroduces step-by-step
// patch mechanics into adapter prose fails this test, even though the file is
// markdown, not code under test elsewhere.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ADAPTER_PATH = join(REPO_ROOT, '.claude', 'commands', 'project-bootstrap-adrs.md');

const adapterText = readFileSync(ADAPTER_PATH, 'utf8');

test('adapter Phase 4 invokes the home-index.mjs helper', () => {
  assert.match(
    adapterText,
    /node brain\/scripts\/lib\/home-index\.mjs insert/,
    'Phase 4 must call the home-index.mjs CLI to patch HOME.md',
  );
});

test('adapter Phase 4 contains no step-by-step patch-location/append prose (REQ-5)', () => {
  assert.doesNotMatch(
    adapterText,
    /Locate the insertion point \(fail-safe\)/,
    'the old "Locate the insertion point" subsection heading must not remain',
  );
  assert.doesNotMatch(
    adapterText,
    /Append the links/,
    'the old "Append the links" subsection heading must not remain',
  );
  assert.doesNotMatch(
    adapterText,
    /find the \*\*last\*\* line that matches the pattern/,
    'prose describing how to locate the last ADR link line must not remain',
  );
  assert.doesNotMatch(
    adapterText,
    /Search for the heading `### Architecture decisions`/,
    'prose describing how to search for the heading must not remain',
  );
});

test('adapter Phase 4 preserves the Tier-2 confirmation prompt', () => {
  assert.match(
    adapterText,
    /Tier 2 confirmation required — brain\/HOME\.md patch/,
    'the pre-write Tier-2 confirmation prompt must remain unchanged',
  );
});

test('adapter Phase 4 preserves the post-write brain:nav recommendation', () => {
  assert.match(
    adapterText,
    /Recommended: run 'npm run brain:nav'/,
    'the post-write brain:nav verification recommendation must remain unchanged',
  );
});
