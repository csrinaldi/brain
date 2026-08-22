#!/usr/bin/env node
// brain/scripts/harness/backends/claude.mjs — claude platform backend (issue #305).
//
// Implements the harness verb contract for Claude Code platform backend.
// Emits .claude/settings.json deterministically with workspace hooks.

import { assertRoutableStage } from '../../lib/stage-engine.mjs';
import { defaultRun } from './agent-runtime.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileSettingsHooksJson } from './settings-hooks.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Repo-root-relative path for Claude Code native settings hooks (issue #305). */
export const CLAUDE_SETTINGS_EMIT_PATH = '.claude/settings.json';

/**
 * The AI agent runtime this platform needs, as data (issue #123).
 *
 * `brain:day:start` reads whatever the CONFIGURED platform declares here and
 * NOTIFIES — it never runs `updateHint`. Keeping the runtime as a descriptor is
 * what keeps ADR-0005 intact: day-start knows the shape, never the vendor.
 */
export const AGENT_RUNTIME = Object.freeze({
  name: 'claude',
  bin: 'claude',
  versionArgs: ['--version'],
  latest: Object.freeze({ cmd: 'npm', args: ['view', '@anthropic-ai/claude-code', 'version'] }),
  updateHint: 'npm install -g @anthropic-ai/claude-code@latest',
});

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

// ── run-stage — #682 slice B, ADR-0033 ───────────────────────────────────────

/** The wall clock a stage engine gets. A review reads a diff; it is not a build. */
export const STAGE_TIMEOUT_MS = 10 * 60_000;

/**
 * runStage() — spawn an engine to produce one stage's artifact.
 *
 * THE CONTRACT IS THE FILE, AND BRAIN DOES NOT PARSE STDOUT. The engine writes
 * the stage's artifact (`openspec/reviews/pr-NNN/` for `cold-review`) and brain
 * reads it afterwards with its own reader. Nothing here interprets what the
 * agent said, which is what keeps the boundary auditable: the only thing that
 * crosses is a file whose shape has its own tests.
 *
 * IT HOLDS NO VCS CREDENTIAL AND POSTS NOTHING. The poster keeps every one of
 * reviewer-protocol.md §2's three locks; a producer that could post would need
 * each of them re-proved on a second surface, and would need the credential
 * #604 proved cannot be trusted where the environment injects it.
 *
 * A NON-ZERO EXIT IS A FAILURE, never an empty result. `cli.mjs` refuses to post
 * on a failure rather than render a verdict declaring a control it never applied
 * — "the engine broke" and "the engine found nothing" are the two states #552
 * exists to keep apart, and this is the layer where they are easiest to fold.
 *
 * @param {{stage: string, prompt: string, model?: string|null, cwd?: string,
 *          timeoutMs?: number, _run?: Function}} args
 * @returns {Promise<{ok: true} | {ok: false, reason: string}>}
 */
export async function runStage({
  stage, prompt, model = null, cwd = process.cwd(),
  timeoutMs = STAGE_TIMEOUT_MS, _run = defaultRun,
} = {}) {
  assertRoutableStage(stage);

  if (typeof prompt !== 'string' || prompt.trim() === '') {
    return { ok: false, reason: `no prompt for stage "${stage}" — an engine with nothing to do is not a run` };
  }

  // The model rides as given. #323 ruled it an opaque pass-through, so brain
  // neither validates it nor supplies a default: an absent model means the
  // engine's own, which is the engine's business.
  const args = ['-p', prompt, ...(model ? ['--model', model] : [])];

  let r;
  try {
    r = _run('claude', args, { cwd, timeoutMs });
  } catch (err) {
    return { ok: false, reason: `the engine could not be spawned: ${err.message}` };
  }

  // spawnSync reports a timeout through `error`, not through `status`. Read both
  // or a hung engine returns `status: null` and reads as success.
  if (r?.error) return { ok: false, reason: `the engine failed to run: ${r.error.message}` };
  if (r?.status !== 0) {
    return {
      ok: false,
      reason: `the engine exited ${r?.status === null ? 'without a status (timed out?)' : `with status ${r?.status}`}` +
        `${r?.stderr ? ` — ${String(r.stderr).trim().split('\n')[0]}` : ''}`,
    };
  }

  return { ok: true };
}
