// brain/scripts/harness/backends/settings-hooks.test.mjs — unit tests for the
// one shared settings-hooks compiler (issue #315).
//
// What was measured before unifying (see the PR): the two former compilers
// were 28 lines each, 27 of them byte-identical — the ONLY differing line was
// the function's own name. Their OUTPUT was byte-identical (md5
// 7d4dcb282df653b2121e98228e6ac569 — 776 characters, 777 bytes in UTF-8).
// The emit paths never lived in
// the compilers at all; they are separate exported constants and STAY
// per-backend. So the shared compiler takes no arguments: there was nothing
// varying to inject.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  NO_VERIFY_GUARD_COMMAND,
  compileSettingsHooksJson,
} from './settings-hooks.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── the payload ──────────────────────────────────────────────────────────────

test('compileSettingsHooksJson() emits the PreToolUse blocker and the SessionStart loader', () => {
  const parsed = JSON.parse(compileSettingsHooksJson());

  assert.equal(parsed.hooks.PreToolUse[0].matcher, 'Bash');
  assert.equal(parsed.hooks.PreToolUse[0].hooks[0].type, 'command');
  assert.equal(parsed.hooks.PreToolUse[0].hooks[0].command, NO_VERIFY_GUARD_COMMAND);
  assert.equal(parsed.hooks.SessionStart[0].hooks[0].command, 'npm run brain:session:start');
});

test('compileSettingsHooksJson() is deterministic and pretty-printed with a trailing newline', () => {
  const a = compileSettingsHooksJson();
  assert.equal(a, compileSettingsHooksJson());
  assert.ok(a.endsWith('\n'));
  assert.equal(a, JSON.stringify(JSON.parse(a), null, 2) + '\n');
});

// ── the guard string is executable, not just present ─────────────────────────
//
// This is the line the issue calls security-relevant. Asserting it *matches a
// regex* would pass on a guard that no longer blocks anything, so these run it.

/**
 * Runs the guard string through a shell, as the harness does, with the hook
 * JSON on stdin. Stdin is redirected from a real file rather than piped: the
 * guard opens `/dev/stdin`, which is ENXIO against a spawn pipe.
 */
function runGuard(command) {
  const payload = join(tmpdir(), `brain-315-hook-${process.pid}-${count++}.json`);
  writeFileSync(payload, JSON.stringify({ tool_input: { command } }), 'utf8');
  try {
    return spawnSync('sh', ['-c', `${NO_VERIFY_GUARD_COMMAND} < ${payload}`], { encoding: 'utf8' });
  } finally {
    rmSync(payload, { force: true });
  }
}
let count = 0;

test('the guard BLOCKS --no-verify with exit 2 and an explanatory message', () => {
  const r = runGuard('git commit --no-verify -m "skip the hooks"');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /BLOCKED/);
});

test('the guard BLOCKS `git commit -n`', () => {
  assert.equal(runGuard('git commit -n -m wip').status, 2);
});

test('the guard LETS an ordinary command through', () => {
  const r = runGuard('git commit -m "an honest commit"');
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
});

// ── one copy, enforced ───────────────────────────────────────────────────────

/** Every .mjs under backends/, RECURSIVELY — a copy one directory down is a copy. */
function backendSources(dir = HERE, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) backendSources(full, acc);
    else if (entry.name.endsWith('.mjs') && !entry.name.endsWith('.test.mjs')) acc.push(full);
  }
  return acc;
}

// Fingerprints of the guard ITSELF, derived from the real command so the test
// cannot drift from it. Scanning for the payload's structural key (`PreToolUse`)
// instead — the first version of this test — protected a word, not the guard: a
// hand-rolled second guard under a different key passed, and a backend comment
// merely MENTIONING the key failed. Both measured.
const GUARD_FINGERPRINTS = [
  NO_VERIFY_GUARD_COMMAND.match(/--[a-z]+-verify/)[0],
  '[brain:hook] BLOCKED',
];

test('no backend re-declares the commit-bypass guard — settings-hooks.mjs is the only copy', () => {
  const scanned = backendSources();

  // Evidence floor: an empty or mis-rooted scan finds no offenders and would
  // pass vacuously — "there are no copies" must not be indistinguishable from
  // "I read nothing". This is the evidence-reader-empty-on-failure class, and
  // the first version of this test had it.
  assert.ok(scanned.length >= 4, `the scan read ${scanned.length} files — it is not looking where it thinks`);
  for (const known of ['claude.mjs', 'antigravity.mjs', 'settings-hooks.mjs']) {
    assert.ok(
      scanned.some((p) => p.endsWith(known)),
      `the scan never read ${known}; a scan that reads nothing proves nothing`,
    );
  }

  const offenders = scanned
    .filter((p) => !p.endsWith('settings-hooks.mjs'))
    .filter((p) => {
      const src = readFileSync(p, 'utf8');
      return GUARD_FINGERPRINTS.some((f) => src.includes(f));
    })
    .map((p) => relative(HERE, p));

  assert.deepEqual(
    offenders,
    [],
    `these files carry their own copy of the commit-bypass guard: ${offenders.join(', ')}. ` +
      'A second copy is exactly what #315 removed — import compileSettingsHooksJson instead.',
  );
});

// ── what legitimately stays per-backend ──────────────────────────────────────

test('both backends emit the SAME content to DIFFERENT paths', async () => {
  const claude = await import('./claude.mjs');
  const antigravity = await import('./antigravity.mjs');

  const written = [];
  await claude.init({
    _writeClaudeSettings: (relPath, content) => written.push({ relPath, content }),
    _repoRoot: '/fake/repo',
  });
  await antigravity.init({
    _readDoc: () => 'stub',
    _writeAgents: () => {},
    _writeGeminiSettings: (relPath, content) => written.push({ relPath, content }),
    _repoRoot: '/fake/repo',
  });

  const settings = written.filter((w) => w.relPath.endsWith('settings.json'));
  assert.equal(settings.length, 2);
  // The paths are the one thing that really differs — and they differ.
  assert.equal(settings[0].relPath, claude.CLAUDE_SETTINGS_EMIT_PATH);
  assert.equal(settings[1].relPath, antigravity.GEMINI_SETTINGS_EMIT_PATH);
  assert.notEqual(settings[0].relPath, settings[1].relPath);
  // The content is the one thing that never did.
  assert.equal(settings[0].content, settings[1].content);
  assert.equal(settings[0].content, compileSettingsHooksJson());
});
