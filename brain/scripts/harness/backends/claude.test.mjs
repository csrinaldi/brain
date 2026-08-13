// scripts/harness/backends/claude.test.mjs — unit tests for claude platform backend (issue #305).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLAUDE_SETTINGS_EMIT_PATH, init } from './claude.mjs';
import { compileSettingsHooksJson } from './settings-hooks.mjs';

test('CLAUDE_SETTINGS_EMIT_PATH === ".claude/settings.json"', () => {
  assert.equal(CLAUDE_SETTINGS_EMIT_PATH, '.claude/settings.json');
});

test('compileSettingsHooksJson() emits valid JSON with SessionStart and PreToolUse hooks', () => {
  const jsonStr = compileSettingsHooksJson();
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
  assert.equal(writeCalls[0].content, compileSettingsHooksJson());
});

// ── agent runtime descriptor (issue #123) ────────────────────────────────────

test('AGENT_RUNTIME declares a probeable claude runtime with an update hint', async () => {
  const { AGENT_RUNTIME } = await import('./claude.mjs');

  assert.equal(AGENT_RUNTIME.bin, 'claude');
  assert.ok(Array.isArray(AGENT_RUNTIME.versionArgs));
  assert.ok(AGENT_RUNTIME.versionArgs.length > 0);
  assert.equal(AGENT_RUNTIME.latest.cmd, 'npm');
  assert.ok(AGENT_RUNTIME.latest.args.includes('@anthropic-ai/claude-code'));
  assert.match(AGENT_RUNTIME.updateHint, /@anthropic-ai\/claude-code/);
});

test('AGENT_RUNTIME probes cleanly through the generic prober', async () => {
  const { AGENT_RUNTIME } = await import('./claude.mjs');
  const { probeAgentRuntime } = await import('./agent-runtime.mjs');

  const calls = [];
  const _run = (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    return { status: 0, stdout: '1.0.0\n', stderr: '' };
  };

  assert.equal(probeAgentRuntime(AGENT_RUNTIME, { _run }).state, 'up-to-date');
  // The descriptor's own update hint is never executed by the probe.
  assert.ok(!calls.some(c => c === AGENT_RUNTIME.updateHint || /install|update/.test(c.split(' ').slice(0, 2).join(' '))));
});
