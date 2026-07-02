// brain-upgrade.test.mjs — Unit tests for the brain:upgrade self-host guard.
//
// Issue #180: a pre-v0.8.0 vendored upgrader plain-copied the consumer's
// package.json, clobbering `name` to "brain" (also version/description/
// license). That used to trip a hard guard here
// (`ownPkg.name === 'brain'`) and permanently lock the consumer out of all
// future upgrades — the exact repo that most needs to upgrade (to get the
// v0.8.0+ specialMerge fix) could never run brain:upgrade again.
//
// The fix: a `.brain-source` marker file at the brain SOURCE repo root is
// the authoritative self-host signal (reliable regardless of what
// package.json says). The old name-based check becomes a non-fatal
// recovery-awareness warning.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const BRAIN_UPGRADE_SCRIPT = new URL('./brain-upgrade.mjs', import.meta.url).pathname;

function runBrainUpgrade(dir, args = []) {
  return spawnSync('node', [BRAIN_UPGRADE_SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
}

function makeTmpDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

// ── .brain-source marker guard ─────────────────────────────────────────────

test('brain:upgrade: refuses to run when .brain-source marker is present (source repo)', (t) => {
  const dir = makeTmpDir('brain-upgrade-marker-');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  writeFileSync(join(dir, '.brain-source'), '# marker\n');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'my-consumer', version: '1.0.0' }));

  const r = runBrainUpgrade(dir, ['--no-install']);

  assert.notEqual(r.status, 0, `expected non-zero exit, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /SOURCE repo/i, `expected the die message to mention the source repo:\n${r.stderr}`);
  assert.match(r.stderr, /\.brain-source/, `expected the die message to reference the .brain-source marker:\n${r.stderr}`);
});

test('brain:upgrade: --force overrides the .brain-source marker guard', (t) => {
  const dir = makeTmpDir('brain-upgrade-marker-force-');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  writeFileSync(join(dir, '.brain-source'), '# marker\n');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'my-consumer', version: '1.0.0' }));

  const r = runBrainUpgrade(dir, ['--no-install', '--force']);

  // --force must get past the marker guard entirely — that die message must
  // never appear. It is expected to fail LATER for an unrelated reason
  // (no node_modules/brain fixture in this minimal test dir).
  assert.doesNotMatch(r.stderr, /SOURCE repo/i,
    `--force must bypass the .brain-source guard; the source-repo die message must be absent:\n${r.stderr}`);
  assert.match(r.stderr, /node_modules\/brain not found/,
    `expected the script to get past the guard and fail at the node_modules\\/brain check:\n${r.stderr}`);
});

// ── Soft warning: package.json name === 'brain' without a .brain-source marker ──

test('brain:upgrade: package.json name === "brain" without a marker is a soft warning, not a die', (t) => {
  const dir = makeTmpDir('brain-upgrade-soft-warn-');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // No .brain-source marker — simulates a consumer whose package.json name
  // was clobbered to "brain" by a pre-v0.8.0 upgrade (issue #180).
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'brain', version: '0.1.0' }));

  const r = runBrainUpgrade(dir, ['--no-install']);

  // The OLD hard-guard die message must never appear — this is the
  // regression this test protects against (the lockout bug).
  assert.doesNotMatch(r.stderr, /this looks like the brain repo itself/,
    `the old hard self-host guard must be removed:\n${r.stderr}`);
  assert.doesNotMatch(r.stderr, /SOURCE repo/i,
    `no .brain-source marker exists — the marker guard must not fire:\n${r.stderr}`);

  // The soft recovery-awareness warning must be printed instead.
  assert.match(r.stderr, /may have clobbered your project name/,
    `expected the soft warning about a possibly-clobbered project name:\n${r.stderr}`);

  // It must have proceeded PAST the guard — failing later (no node_modules/brain
  // fixture in this minimal test dir) is fine and proves it got past the guard.
  assert.match(r.stderr, /node_modules\/brain not found/,
    `expected the script to proceed past the guard and fail at the node_modules\\/brain check:\n${r.stderr}`);
});

test('brain:upgrade: no warning printed when package.json name is not "brain"', (t) => {
  const dir = makeTmpDir('brain-upgrade-no-warn-');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'my-consumer', version: '1.0.0' }));

  const r = runBrainUpgrade(dir, ['--no-install']);

  assert.doesNotMatch(r.stderr, /may have clobbered your project name/,
    `no warning expected for a normal consumer package.json name:\n${r.stderr}`);
});
