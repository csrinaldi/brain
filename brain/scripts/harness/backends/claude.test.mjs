// scripts/harness/backends/claude.test.mjs — unit tests for claude platform backend (issue #305).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLAUDE_SETTINGS_EMIT_PATH, compileClaudeSettingsJson, init } from './claude.mjs';

test('CLAUDE_SETTINGS_EMIT_PATH === ".claude/settings.json"', () => {
  assert.equal(CLAUDE_SETTINGS_EMIT_PATH, '.claude/settings.json');
});

test('compileClaudeSettingsJson() emits valid JSON with SessionStart and PreToolUse hooks', () => {
  const jsonStr = compileClaudeSettingsJson();
  const parsed = JSON.parse(jsonStr);

  assert.ok(parsed.hooks);
  assert.ok(Array.isArray(parsed.hooks.PreToolUse));
  assert.ok(Array.isArray(parsed.hooks.SessionStart));

  const sessionStartHook = parsed.hooks.SessionStart[0].hooks[0].command;
  assert.equal(sessionStartHook, 'npm run brain:session:start');

  const preToolUseHook = parsed.hooks.PreToolUse[0].hooks[0].command;
  assert.match(preToolUseHook, /--no-verify/);
});

test('init() calls _writeClaudeSettings with CLAUDE_SETTINGS_EMIT_PATH and valid JSON', async () => {
  const writeCalls = [];
  const _writeClaudeSettings = (relPath, content) => writeCalls.push({ relPath, content });

  await init({ _writeClaudeSettings, _repoRoot: '/fake/repo' });

  assert.equal(writeCalls.length, 1);
  assert.equal(writeCalls[0].relPath, CLAUDE_SETTINGS_EMIT_PATH);
  assert.equal(writeCalls[0].content, compileClaudeSettingsJson());
});
