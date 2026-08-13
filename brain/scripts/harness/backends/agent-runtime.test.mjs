// brain/scripts/harness/backends/agent-runtime.test.mjs — unit tests for the
// generic agent-runtime probe (issue #123).
//
// The probe is harness-agnostic by construction (ADR-0005): it knows only the
// descriptor shape, never a specific AI CLI. These tests exercise it with
// synthetic descriptors, so a backend rename can never make them pass by luck.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  probeAgentRuntime,
  formatRuntimeNotice,
  agentRuntimeReport,
  platformEnvVars,
  platformConfig,
} from './agent-runtime.mjs';
import { resolvePlatform } from '../cli.mjs';

// A synthetic descriptor — deliberately not any real backend's.
const DESC = Object.freeze({
  name: 'fake-agent',
  bin: 'fakeagent',
  versionArgs: ['--version'],
  latest: { cmd: 'npm', args: ['view', '@fake/agent', 'version'] },
  updateHint: 'npm install -g @fake/agent@latest',
});

/** Builds a recording `_run` seam from a per-command reply table. */
function runner(replies) {
  const calls = [];
  const _run = (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    const key = [cmd, ...args].join(' ');
    return replies[key] ?? { status: 127, stdout: '', stderr: `no such command: ${key}` };
  };
  return { _run, calls };
}

const VERSION_CALL = 'fakeagent --version';
const LATEST_CALL = 'npm view @fake/agent version';

// ── state machine ────────────────────────────────────────────────────────────

test('probeAgentRuntime: no descriptor → not-declared, and nothing is executed', () => {
  const { _run, calls } = runner({});
  for (const empty of [null, undefined]) {
    const status = probeAgentRuntime(empty, { _run });
    assert.equal(status.state, 'not-declared');
    assert.equal(status.installed, null);
    assert.equal(status.latest, null);
  }
  assert.deepEqual(calls, []);
});

test('probeAgentRuntime: binary absent → absent, with the failure detail preserved', () => {
  const { _run, calls } = runner({
    [VERSION_CALL]: { status: null, stdout: '', stderr: '', error: new Error('spawn fakeagent ENOENT') },
  });
  const status = probeAgentRuntime(DESC, { _run });

  assert.equal(status.state, 'absent');
  assert.equal(status.installed, null);
  // The reason must survive — "absent" without a detail is an unreadable verdict.
  assert.match(status.detail, /ENOENT/);
  // A binary that is not there is never interrogated for a latest version.
  assert.deepEqual(calls, [VERSION_CALL]);
});

test('probeAgentRuntime: binary present but version illegible → unreadable, NOT absent', () => {
  const { _run } = runner({
    [VERSION_CALL]: { status: 0, stdout: 'fakeagent (development build)\n', stderr: '' },
  });
  const status = probeAgentRuntime(DESC, { _run });

  // The distinction this whole state machine exists for: "the CLI is not here"
  // and "the CLI is here but would not say which version" are different facts.
  assert.equal(status.state, 'unreadable');
  assert.notEqual(status.state, 'absent');
  assert.equal(status.installed, null);
  assert.match(status.detail, /development build/);
});

test('probeAgentRuntime: latest lookup fails → unknown-latest, never up-to-date', () => {
  const { _run } = runner({
    [VERSION_CALL]: { status: 0, stdout: '1.2.3\n', stderr: '' },
    [LATEST_CALL]: { status: 1, stdout: '', stderr: 'npm ERR! network unreachable' },
  });
  const status = probeAgentRuntime(DESC, { _run });

  assert.equal(status.state, 'unknown-latest');
  assert.equal(status.installed, '1.2.3');
  assert.equal(status.latest, null);
  assert.match(status.detail, /network unreachable/);
});

test('probeAgentRuntime: descriptor declares no latest probe → unknown-latest, installed still reported', () => {
  const { _run, calls } = runner({
    [VERSION_CALL]: { status: 0, stdout: '1.2.3\n', stderr: '' },
  });
  const status = probeAgentRuntime({ ...DESC, latest: null }, { _run });

  assert.equal(status.state, 'unknown-latest');
  assert.equal(status.installed, '1.2.3');
  assert.deepEqual(calls, [VERSION_CALL]);
});

test('probeAgentRuntime: latest > installed → update-available with both versions', () => {
  const { _run, calls } = runner({
    [VERSION_CALL]: { status: 0, stdout: '1.2.3 (Fake Agent)\n', stderr: '' },
    [LATEST_CALL]: { status: 0, stdout: '1.3.0\n', stderr: '' },
  });
  const status = probeAgentRuntime(DESC, { _run });

  assert.equal(status.state, 'update-available');
  assert.equal(status.installed, '1.2.3');
  assert.equal(status.latest, '1.3.0');
  assert.equal(status.updateHint, DESC.updateHint);
  assert.deepEqual(calls, [VERSION_CALL, LATEST_CALL]);
});

test('probeAgentRuntime: latest === installed → up-to-date', () => {
  const { _run } = runner({
    [VERSION_CALL]: { status: 0, stdout: '1.3.0\n', stderr: '' },
    [LATEST_CALL]: { status: 0, stdout: '1.3.0\n', stderr: '' },
  });
  assert.equal(probeAgentRuntime(DESC, { _run }).state, 'up-to-date');
});

test('probeAgentRuntime: installed ahead of latest → up-to-date (never a downgrade notice)', () => {
  const { _run } = runner({
    [VERSION_CALL]: { status: 0, stdout: '2.0.0\n', stderr: '' },
    [LATEST_CALL]: { status: 0, stdout: '1.3.0\n', stderr: '' },
  });
  assert.equal(probeAgentRuntime(DESC, { _run }).state, 'up-to-date');
});

// ── notify, never auto-update (the load-bearing constraint of #123) ──────────

test('probeAgentRuntime: NEVER executes the update command, even when one is available', () => {
  const { _run, calls } = runner({
    [VERSION_CALL]: { status: 0, stdout: '1.2.3\n', stderr: '' },
    [LATEST_CALL]: { status: 0, stdout: '9.9.9\n', stderr: '' },
  });
  probeAgentRuntime(DESC, { _run });

  assert.deepEqual(calls, [VERSION_CALL, LATEST_CALL]);
  for (const call of calls) {
    assert.doesNotMatch(call, /install|update|upgrade/);
  }
});

test('formatRuntimeNotice: update-available warns, names both versions, and says it was not applied', () => {
  const notice = formatRuntimeNotice({
    state: 'update-available',
    name: 'fake-agent',
    installed: '1.2.3',
    latest: '1.3.0',
    updateHint: 'npm install -g @fake/agent@latest',
    detail: null,
  });

  assert.equal(notice.level, 'warn');
  assert.match(notice.message, /fake-agent/);
  assert.match(notice.message, /1\.2\.3/);
  assert.match(notice.message, /1\.3\.0/);
  assert.match(notice.hint, /npm install -g @fake\/agent@latest/);
  // Mirrors the brain-tag stance: the notice must state that nothing was applied.
  assert.match(notice.hint, /not applied automatically/i);
});

test('formatRuntimeNotice: unreadable and absent produce DIFFERENT operator text', () => {
  const base = { name: 'fake-agent', installed: null, latest: null, updateHint: 'x', bin: 'fakeagent' };
  const absent = formatRuntimeNotice({ ...base, state: 'absent', detail: 'ENOENT' });
  const unreadable = formatRuntimeNotice({ ...base, state: 'unreadable', detail: 'development build' });

  assert.notEqual(absent.message, unreadable.message);
  assert.match(unreadable.message, /version/i);
});

test('formatRuntimeNotice: unknown-latest is not reported as up to date', () => {
  const notice = formatRuntimeNotice({
    state: 'unknown-latest',
    name: 'fake-agent',
    installed: '1.2.3',
    latest: null,
    updateHint: 'x',
    detail: 'offline',
  });
  assert.doesNotMatch(notice.message, /up to date/i);
  assert.match(notice.message, /1\.2\.3/);
});

// ── report: resolve the CONFIGURED platform, never a hardcoded one ───────────

test('agentRuntimeReport: probes the descriptor of the CONFIGURED platform', async () => {
  const loaded = [];
  const _loadBackend = async (platform) => {
    loaded.push(platform);
    return { AGENT_RUNTIME: { ...DESC, name: `runtime-of-${platform}` } };
  };
  const { _run } = runner({
    [VERSION_CALL]: { status: 0, stdout: '1.2.3\n', stderr: '' },
    [LATEST_CALL]: { status: 0, stdout: '1.2.3\n', stderr: '' },
  });

  const report = await agentRuntimeReport({
    env: { AGENT_PLATFORM: 'some-other-harness' },
    _loadBackend,
    _run,
  });

  assert.deepEqual(loaded, ['some-other-harness']);
  assert.equal(report.platform, 'some-other-harness');
  assert.equal(report.status.name, 'runtime-of-some-other-harness');
  assert.equal(report.status.state, 'up-to-date');
});

test('agentRuntimeReport: a backend declaring no runtime → not-declared, no execution', async () => {
  const { _run, calls } = runner({});
  const report = await agentRuntimeReport({
    env: { AGENT_PLATFORM: 'plain' },
    _loadBackend: async () => ({ AGENT_RUNTIME: null }),
    _run,
  });

  assert.equal(report.status.state, 'not-declared');
  assert.match(report.notice.message, /plain/);
  assert.deepEqual(calls, []);
});

test('agentRuntimeReport: a backend that fails to load is unresolved, NOT silently not-declared', async () => {
  const report = await agentRuntimeReport({
    env: { AGENT_PLATFORM: 'nonexistent' },
    _loadBackend: async () => { throw new Error('backend not found at ./backends/nonexistent.mjs'); },
    _run: () => { throw new Error('must not run'); },
  });

  // "Could not read the backend" must never be reported as "this backend has
  // no runtime" — that is the evidence-reader-empty-on-failure class.
  assert.equal(report.status.state, 'unresolved');
  assert.notEqual(report.status.state, 'not-declared');
  assert.match(report.status.detail, /backend not found/);
  assert.equal(report.notice.level, 'warn');
});

// ── review follow-ups (PR #594) ──────────────────────────────────────────────

test('probeAgentRuntime: binary PRESENT but exiting non-zero is unreadable, not absent', () => {
  // spawnSync reports a MISSING binary through `error` (ENOENT). A binary that
  // is installed and merely fails has no `error` — those are different facts,
  // and "not installed. Install it with: …" is wrong advice for the second.
  const { _run } = runner({
    [VERSION_CALL]: { status: 1, stdout: '', stderr: 'panic: config corrupt' },
  });
  const status = probeAgentRuntime(DESC, { _run });

  assert.equal(status.state, 'unreadable');
  assert.notEqual(status.state, 'absent');
  assert.match(status.detail, /config corrupt/);
});

test('probeAgentRuntime: only a spawn error (ENOENT) means absent', () => {
  const { _run } = runner({
    [VERSION_CALL]: { status: null, stdout: '', stderr: '', error: new Error('spawn fakeagent ENOENT') },
  });
  assert.equal(probeAgentRuntime(DESC, { _run }).state, 'absent');
});

test('probeAgentRuntime: two versions it cannot order are unknown-latest, never up-to-date', () => {
  // compareSemver ignores prerelease suffixes, so 2.0.0-alpha.3 vs 2.0.0 ranks
  // equal. Reporting "up to date" there states an ordering that was not measured.
  const { _run } = runner({
    [VERSION_CALL]: { status: 0, stdout: '2.0.0-alpha.3\n', stderr: '' },
    [LATEST_CALL]: { status: 0, stdout: '2.0.0\n', stderr: '' },
  });
  const status = probeAgentRuntime(DESC, { _run });

  assert.equal(status.state, 'unknown-latest');
  assert.equal(status.installed, '2.0.0-alpha.3');
  assert.match(status.detail, /2\.0\.0/);
});

test('defaultRun: a hung command is cut off, it does not block day:start forever', async () => {
  const { defaultRun, RUN_TIMEOUT_MS } = await import('./agent-runtime.mjs');
  assert.ok(RUN_TIMEOUT_MS > 0 && RUN_TIMEOUT_MS <= 30_000, `implausible timeout: ${RUN_TIMEOUT_MS}`);

  const started = Date.now();
  const r = defaultRun(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], { timeoutMs: 300 });
  const elapsed = Date.now() - started;

  assert.ok(elapsed < 5_000, `defaultRun waited ${elapsed}ms — no timeout is being passed to spawnSync`);
  assert.ok(r.error || r.signal, 'a timed-out spawn must surface as error/signal, not as a clean exit');
});

test('platformEnvVars: BOTH axis keys reach resolvePlatform, not just AGENT_PLATFORM', () => {
  // ADR-0024 keeps SDD_HARNESS as the legacy fallback; a repo declaring only
  // SDD_HARNESS=claude must not silently resolve to the antigravity default.
  const seen = [];
  const read = (key) => { seen.push(key); return key === 'SDD_HARNESS' ? 'claude' : null; };
  const envVars = platformEnvVars(read);

  assert.ok(seen.includes('AGENT_PLATFORM'), 'AGENT_PLATFORM must be read');
  assert.ok(seen.includes('SDD_HARNESS'), 'SDD_HARNESS must be read');
  assert.equal(resolvePlatform({ env: {}, envVars }), 'claude');
});

test('platformConfig: a harness section of the WRONG shape degrades to {}, never to a crash', () => {
  // resolvePlatform reads config.platform / config.harness; a consumer writing
  // "harness": "claude" passes a STRING where an object is expected.
  assert.deepEqual(platformConfig({ harness: 'claude' }), { harness: 'claude' });
  assert.deepEqual(platformConfig({ harness: { platform: 'claude' } }), { platform: 'claude' });
  assert.deepEqual(platformConfig({}), {});
  assert.deepEqual(platformConfig(null), {});
  assert.equal(resolvePlatform({ env: {}, envVars: {}, config: platformConfig({ harness: 'claude' }) }), 'claude');
});
