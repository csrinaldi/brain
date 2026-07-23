#!/usr/bin/env node
// brain/scripts/harness/backends/claude.mjs — claude platform backend (issue #305).
//
// Implements the harness verb contract for Claude Code platform backend.
// Emits .claude/settings.json deterministically with workspace hooks.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Repo-root-relative path for Claude Code native settings hooks (issue #305). */
export const CLAUDE_SETTINGS_EMIT_PATH = '.claude/settings.json';

/**
 * Compiles .claude/settings.json content with native workspace hooks.
 * Pure, fs-free.
 *
 * @returns {string} The formatted JSON content.
 */
export function compileClaudeSettingsJson() {
  const obj = {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: "node -e \"const cmd = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).tool_input?.command ?? ''; if (/--no-verify/.test(cmd) || /\\bgit commit\\b[^|&\\n]*\\s+-n\\b/.test(cmd)) { process.stderr.write('\\n[brain:hook] BLOCKED: --no-verify / git commit -n bypasses governance hooks.\\nSee ADR-0014 §9. Fix the hook that is causing the false-positive instead.\\n'); process.exit(2); }\"",
            },
          ],
        },
      ],
      SessionStart: [
        {
          hooks: [
            {
              type: 'command',
              command: 'npm run brain:session:start',
            },
          ],
        },
      ],
    },
  };
  return JSON.stringify(obj, null, 2) + '\n';
}

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

  const settingsContent = compileClaudeSettingsJson();
  try {
    writeClaudeSettings(CLAUDE_SETTINGS_EMIT_PATH, settingsContent);
  } catch (err) {
    console.warn(`  harness: claude could not write ${CLAUDE_SETTINGS_EMIT_PATH} — ${err.message}`);
  }
}
