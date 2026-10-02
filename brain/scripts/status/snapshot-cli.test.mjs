import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshot } from './snapshot.mjs';
import { parseArgs, main } from './snapshot-cli.mjs';
import { makeSnapshotFixture as makeFixture } from '../__fixtures__/snapshot-tree.mjs';
import { makeRemoteFixture } from '../ui/test-support/git-remote-fixture.mjs';
import { recordingGit } from '../ui/test-support/recording-git.mjs';
import { gitRun } from '../ui/git-run.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'snapshot-cli.mjs');
const NOW = '2026-09-13T00:00:00Z';

// ── R879-1: module and verb are ONE shape ───────────────────────────────────

test('#879: the spawned verb prints exactly what the in-process module returns', async () => {
  const root = makeFixture();
  const r = spawnSync(process.execPath, [CLI, '--json', '--now', NOW, '--root', root], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '', 'no git chatter beside the JSON');
  const fromVerb = JSON.parse(r.stdout);
  const fromModule = await buildSnapshot({ root, now: NOW });
  assert.deepEqual(fromVerb, JSON.parse(JSON.stringify(fromModule)));
  // Byte-identical across two runs on one tree: the clock is pinned, and the
  // rest is computed from the same files in the same order.
  const again = spawnSync(process.execPath, [CLI, '--json', '--now', NOW, '--root', root], { encoding: 'utf8' });
  assert.equal(again.stdout, r.stdout);
});

test('#879: text mode prints every section with its count or its reason, and exits 0 offline', async () => {
  const root = makeFixture();
  const lines = [];
  const code = await main(['--now', NOW, '--root', root], { say: (s) => lines.push(s) });
  assert.equal(code, 0, 'a report, not a gate');
  const out = lines.join('\n');
  for (const name of ['graph', 'changes', 'prs', 'reviews', 'records', 'adrs', 'anti-patterns', 'actors', 'release debt']) {
    assert.match(out, new RegExp(`^${name}\\s`, 'm'), name);
  }
  assert.match(out, /graph\s+not computed — no VCS port/);
  assert.match(out, /records\s+3 record\(s\)/);
  assert.match(out, /adr drift — 1 disagreement/);
});

test('#879: arguments — --json, --now needs an ISO date, unknown flags are refused with exit 2', async () => {
  assert.deepEqual(parseArgs(['--json']), { ok: true, json: true, now: undefined, root: undefined });
  assert.equal(parseArgs(['--now', 'yesterday']).ok, false);
  assert.equal(parseArgs(['--bogus']).ok, false);
  assert.equal(await main(['--bogus'], { say: () => {} }), 2);
});

// ── #1201: the remote section, one shape, and a snapshot that never fetches ──

test('#1201 R1201-1: on a clone with remote-tracking refs the verb and the module agree, remoteChanges is ok, and the CLI runs cold (two runs identical)', async () => {
  const fx = makeRemoteFixture();
  const r = spawnSync(process.execPath, [CLI, '--json', '--now', NOW, '--root', fx.served], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const fromVerb = JSON.parse(r.stdout);
  assert.equal(fromVerb.remoteChanges.ok, true, JSON.stringify(fromVerb.remoteChanges));
  assert.deepEqual(fromVerb.remoteChanges.value.branches.map((e) => e.branch), ['feat/issue-11-a', 'feat/issue-12-b']);
  assert.deepEqual(fromVerb, JSON.parse(JSON.stringify(await buildSnapshot({ root: fx.served, now: NOW }))));
  assert.equal(spawnSync(process.execPath, [CLI, '--json', '--now', NOW, '--root', fx.served], { encoding: 'utf8' }).stdout, r.stdout, 'no cache was passed: identical output');
  assert.doesNotMatch(r.stdout, /session/i);
});

test('#1201: text mode lists the remote section with its counts, or its reason', async () => {
  const fx = makeRemoteFixture();
  const lines = [];
  assert.equal(await main(['--now', NOW, '--root', fx.served], { say: (s) => lines.push(s) }), 0);
  assert.match(lines.join('\n'), /^remote\s+2 branch\(es\), 1 unjoined/m);
  const bare = [];
  await main(['--now', NOW, '--root', makeFixture()], { say: (s) => bare.push(s) });
  assert.match(bare.join('\n'), /^remote\s+not computed — /m);
});

test('#1201 R1201-1: the snapshot never fetches and never touches the forge for this section; a branch pushed after the last fetch is absent', async () => {
  const fx = makeRemoteFixture();
  fx.addBranch('feat/issue-77-late', { 'openspec/changes/issue-77-late/proposal.md': 'x' }); // pushed to origin, never fetched
  const run = recordingGit(gitRun(fx.served));
  const forgeCalls = [];
  const vcs = new Proxy({}, { get: (_t, name) => async () => { forgeCalls.push(String(name)); throw new Error('offline'); } });
  const snapshot = await buildSnapshot({ root: fx.served, now: NOW, vcs, project: 'o/r', _run: run });
  assert.equal(snapshot.remoteChanges.ok, true);
  assert.ok(!snapshot.remoteChanges.value.branches.some((e) => e.branch === 'feat/issue-77-late'));
  assert.ok(!run.calls.some((a) => ['fetch', 'pull', 'ls-remote', 'remote'].includes(a[0])), JSON.stringify(run.calls.map((a) => a[0])));
  assert.ok(forgeCalls.every((n) => ['issueList', 'issueView', 'mrList', 'prReviews'].includes(n)), forgeCalls.join());
  assert.equal(snapshot.remoteChanges.value.prsApplied.ok, false, 'the PR list failed: said, not hidden');
});
