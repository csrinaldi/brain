// session-start-config.test.mjs — config wiring tests for session:start
// (issue #138, PR3). Validates the two static config artifacts task 3.5/3.7
// require: package.json's `session:start` script, and `.claude/settings.json`'s
// merged `SessionStart` hook beside the pre-existing `PreToolUse` hook
// (design §1.6). Strict TDD, node:test, zero deps — no dynamic execution of
// `npm run session:start` here (that's the manual smoke test, task 3.6);
// this file only asserts the static JSON shape is correct.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------------------------------------------------------------------------
// package.json — "session:start" script (REQ-1, task 3.5)
// ---------------------------------------------------------------------------

test('package.json: has a session:start script invoking session-start.mjs', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts?.['session:start'], 'node ./brain/scripts/session-start.mjs');
});

// ---------------------------------------------------------------------------
// .claude/settings.json — merged SessionStart hook (design §1.6, task 3.7/3.8)
// ---------------------------------------------------------------------------

test('.claude/settings.json: is valid JSON', () => {
  const raw = readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8');
  assert.doesNotThrow(() => JSON.parse(raw));
});

// NOTE: this test deliberately does NOT assert the PreToolUse command's exact
// flag content as a source literal — doing so would trip check-refs.mjs's
// `no-verify-bypass` governance rule (the same string the hook itself guards
// against), which would otherwise force an exemption edit to
// brain/project/check-refs-rules.mjs (a brain/-owned file — out of bounds for
// an agent per agent-authorities Tier 2). The guard's actual *behavior* is
// already covered by check-refs.test.mjs and installer.test.mjs; this test
// only proves the SessionStart merge left PreToolUse structurally intact
// (still present, still a non-empty command hook) — config-shape coverage,
// not a re-test of the governance rule itself.
test('.claude/settings.json: PreToolUse hook survives the SessionStart merge (structural, no governance-rule literal)', () => {
  const settings = JSON.parse(readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const preToolUse = settings.hooks?.PreToolUse;
  assert.ok(Array.isArray(preToolUse) && preToolUse.length > 0, 'PreToolUse hook array must be present');
  const matcher = preToolUse[0];
  assert.equal(matcher.matcher, 'Bash');
  assert.equal(matcher.hooks?.[0]?.type, 'command');
  assert.equal(typeof matcher.hooks[0].command, 'string');
  assert.ok(matcher.hooks[0].command.length > 0, 'PreToolUse command must be a non-empty string');
});

test('.claude/settings.json: SessionStart hook is present, merged beside PreToolUse', () => {
  const settings = JSON.parse(readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const sessionStart = settings.hooks?.SessionStart;
  assert.ok(Array.isArray(sessionStart) && sessionStart.length > 0, 'SessionStart hook array must be present');
  assert.deepEqual(sessionStart, [
    {
      hooks: [
        { type: 'command', command: 'npm run session:start' },
      ],
    },
  ]);
});

test('.claude/settings.json: SessionStart hook command is exactly "npm run session:start" — zero logic in the JSON (ADR-0002)', () => {
  const settings = JSON.parse(readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const command = settings.hooks?.SessionStart?.[0]?.hooks?.[0]?.command;
  assert.equal(command, 'npm run session:start');
});
