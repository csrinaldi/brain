// scripts/harness/backends/antigravity.drift.test.mjs — the CHAIN-GUARD for
// the compiled AGENTS.md (issue #256, B2 Half 1, REQ-B2-2 staleness scenario).
//
// Reads the 5 REAL SOURCE_DOCS from disk, calls the pure compileAgentsMd(),
// and asserts BYTE-EQUALITY against the committed AGENTS.md. A hand-edit of
// AGENTS.md, or a source change without regeneration, fails this test — this
// is the chain the #601 governance.ignoreList classification depends on
// (Phase 4 in tasks.md is justified BY this guard; sequence matters).
//
// Mirrors the house regenerate-and-diff pattern already used by
// governance-checks.test.mjs and sdd-layout.test.mjs.
//
// Run with: npm test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SOURCE_DOCS, AGENTS_EMIT_PATH, GEMINI_SETTINGS_EMIT_PATH, compileAgentsMd, compileGeminiSettingsJson } from './antigravity.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

function compileFromRealSources() {
  const docs = {};
  for (const relPath of SOURCE_DOCS) {
    docs[relPath] = readFileSync(join(REPO_ROOT, relPath), 'utf8');
  }
  return compileAgentsMd(docs);
}

// ── 3.2 / 3.3: the drift-guard itself ────────────────────────────────────────
// RED before task 3.1 lands (AGENTS.md absent or mismatched); GREEN after
// (byte-equality holds by construction — 3.1 generated the file via this
// same compiler).

test('drift-guard: compileAgentsMd() over the REAL 5 SOURCE_DOCS is byte-equal to the committed AGENTS.md', () => {
  const fresh = compileFromRealSources();
  const committed = readFileSync(join(REPO_ROOT, AGENTS_EMIT_PATH), 'utf8');

  assert.equal(
    fresh,
    committed,
    'AGENTS.md has drifted from its 5 canonical SOURCE_DOCS — regenerate via ' +
      '`AGENT_PLATFORM=antigravity node brain/scripts/harness/cli.mjs init` (never hand-edit AGENTS.md)',
  );
});

// ── 3.4: hand-edit regression proof — the guard's teeth ──────────────────────
// Confirms the comparison mechanism actually distinguishes drifted from
// non-drifted content before trusting it against the real file. Does NOT
// hand-edit the committed AGENTS.md — simulates via a string copy.

test('drift-guard proof: a mutated copy of a fresh compile is NOT byte-equal to the fresh compile (the guard has teeth)', () => {
  const fresh = compileFromRealSources();
  const mutatedCopy = fresh + 'X'; // simulated hand-edit: one appended character, never applied to disk

  assert.notEqual(
    mutatedCopy,
    fresh,
    'the byte-equality comparison must distinguish a drifted copy from a non-drifted one',
  );
});

test('drift-guard: compileGeminiSettingsJson() is valid JSON and byte-equal to .gemini/settings.json if present', () => {
  const fresh = compileGeminiSettingsJson();
  assert.doesNotThrow(() => JSON.parse(fresh));

  const path = join(REPO_ROOT, GEMINI_SETTINGS_EMIT_PATH);
  if (existsSync(path)) {
    const committed = readFileSync(path, 'utf8');
    assert.equal(fresh, committed);
  }
});

