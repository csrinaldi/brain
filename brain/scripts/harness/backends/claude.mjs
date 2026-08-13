#!/usr/bin/env node
// brain/scripts/harness/backends/claude.mjs — claude platform backend (issue #305).
//
// Implements the harness verb contract for Claude Code platform backend.
// Emits .claude/settings.json deterministically with workspace hooks.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileSettingsHooksJson } from './settings-hooks.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Repo-root-relative path for Claude Code native settings hooks (issue #305). */
export const CLAUDE_SETTINGS_EMIT_PATH = '.claude/settings.json';

// The settings-hooks payload itself is NOT claude-specific and no longer lives
// here (issue #315): it was byte-identical to antigravity's copy. What is
// claude-specific is CLAUDE_SETTINGS_EMIT_PATH above — the only thing that ever
// differed. See settings-hooks.mjs.

function _defaultWriteFile(relPath, content, root) {
  const fullPath = join(root, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
}

/**
 * Compiles and writes .claude/settings.json hooks. Never throws.
 *
 * @param {object} [opts] Injectable seams.
 * @param {(relPath: string, content: string) => void} [opts._writeClaudeSettings]
 *   Writes the compiled .claude/settings.json content.
 * @param {string} [opts._repoRoot] Repo root used by the default seams.
 * @returns {Promise<void>}
 */
export async function init({
  _writeClaudeSettings,
  _repoRoot = repoRoot,
} = {}) {
  const writeClaudeSettings = _writeClaudeSettings ?? ((relPath, content) => _defaultWriteFile(relPath, content, _repoRoot));

  const settingsContent = compileSettingsHooksJson();
  try {
    writeClaudeSettings(CLAUDE_SETTINGS_EMIT_PATH, settingsContent);
  } catch (err) {
    console.warn(`  harness: claude could not write ${CLAUDE_SETTINGS_EMIT_PATH} — ${err.message}`);
  }
}
