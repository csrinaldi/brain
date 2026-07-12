#!/usr/bin/env node
// brain/scripts/harness/backends/antigravity.mjs — antigravity harness backend
// (issue #256, Track B / B2 Half 1).
//
// Implements the harness verb contract for Antigravity (design.md §"init()
// shape"). Antigravity reads AGENTS.md — the multi-harness standard file
// (measured, Exp 1, #604) — never a hand-authored file. This backend
// COMPILES that file from brain's canonical source docs (Fork 5: compile,
// never `@path` memport) so every standard reader (Gemini, Codex, Claude-as-
// observer) sees the same self-contained content.
//
// Exported functions are called by brain/scripts/harness/cli.mjs; callers
// should never invoke Antigravity directly. Zero cli.mjs change — the
// dispatcher is already backend-agnostic (plain.mjs/gentle-ai.mjs are the
// n=2 precedent this extends to n=3).
//
// Verbs:
//   init() — reads the 5 SOURCE_DOCS, compiles AGENTS.md via compileAgentsMd(),
//            writes it to AGENTS_EMIT_PATH. Never throws.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

// ---------------------------------------------------------------------------
// Frozen contract: canonical source docs (design's exact list and order) +
// the emitted file's repo-root-relative path (MEASURED target, Exp 1).
// ---------------------------------------------------------------------------

/** The 5 canonical brain/ docs AGENTS.md is compiled from, in this exact order. */
export const SOURCE_DOCS = Object.freeze([
  'brain/HOME.md',
  'brain/core/methodology/agent-authorities.md',   // Tier table VERBATIM (Exp 4)
  'brain/core/methodology/harness-contract.md',     // verb table
  'brain/core/methodology/sdd-layout.md',           // layout summary
  'brain/core/methodology/workflow-governance.md',  // gate list + skip labels (Fork B)
]);

/** Repo-root-relative path Antigravity reads (measured, Exp 1). */
export const AGENTS_EMIT_PATH = 'AGENTS.md';

const REGENERATE_HINT = 'SDD_HARNESS=antigravity npm run brain:env:init';

// ---------------------------------------------------------------------------
// Pure compiler — fs-free by design (design's "one coherent unit" rationale):
// the same function is exercised by the unit test AND the drift-guard, so a
// non-deterministic compiler would make byte-equality flaky by construction.
// ---------------------------------------------------------------------------

/**
 * Compiles the self-contained AGENTS.md content from an injected docs map.
 * Splices each SOURCE_DOCS entry's content UNMODIFIED (no re-summarization —
 * REQ-B2-2 binds the outcome, not the mechanism) behind a provenance banner.
 *
 * @param {{ [relPath: string]: string }} docs Keyed by SOURCE_DOCS relative path.
 * @returns {string} The compiled AGENTS.md content.
 */
export function compileAgentsMd(docs) {
  const banner =
    `<!-- generated from ${SOURCE_DOCS.join(', ')} — do not edit.\n` +
    `     Regenerate: ${REGENERATE_HINT}\n` +
    `     Drift-guarded by antigravity.drift.test.mjs — hand-edits fail CI. -->`;

  const sections = SOURCE_DOCS.map(
    (relPath) => `<!-- source: ${relPath} -->\n\n${docs[relPath] ?? ''}`,
  );

  return [banner, ...sections].join('\n\n---\n\n') + '\n';
}

// ---------------------------------------------------------------------------
// Default injectable implementations
// ---------------------------------------------------------------------------

function _defaultReadDoc(relPath, root) {
  return readFileSync(join(root, relPath), 'utf8');
}

function _defaultWriteAgents(relPath, content, root) {
  writeFileSync(join(root, relPath), content, 'utf8');
}

// ---------------------------------------------------------------------------
// Verb: init
// ---------------------------------------------------------------------------

/**
 * Compiles and writes AGENTS.md from the 5 canonical SOURCE_DOCS. Never
 * throws — a failing read is warned and treated as empty content for that
 * source; a failing write is warned; neither aborts the other step.
 *
 * @param {object} [opts] Injectable seams.
 * @param {(relPath: string) => string} [opts._readDoc]
 *   Reads one source doc's content. Defaults to real readFileSync from _repoRoot.
 * @param {(relPath: string, content: string) => void} [opts._writeAgents]
 *   Writes the compiled content to relPath. Defaults to real writeFileSync
 *   against _repoRoot.
 * @param {string} [opts._repoRoot] Repo root used by the default seams.
 * @returns {Promise<void>}
 */
export async function init({
  _readDoc,
  _writeAgents,
  _repoRoot = repoRoot,
} = {}) {
  const readDoc = _readDoc ?? ((relPath) => _defaultReadDoc(relPath, _repoRoot));
  const writeAgents = _writeAgents ?? ((relPath, content) => _defaultWriteAgents(relPath, content, _repoRoot));

  const docs = {};
  for (const relPath of SOURCE_DOCS) {
    try {
      docs[relPath] = readDoc(relPath);
    } catch (err) {
      console.warn(`  harness: antigravity could not read ${relPath} — ${err.message}`);
      docs[relPath] = '';
    }
  }

  const content = compileAgentsMd(docs);

  try {
    writeAgents(AGENTS_EMIT_PATH, content);
  } catch (err) {
    console.warn(`  harness: antigravity could not write ${AGENTS_EMIT_PATH} — ${err.message}`);
  }
}
