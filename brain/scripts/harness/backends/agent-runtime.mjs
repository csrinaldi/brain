// brain/scripts/harness/backends/agent-runtime.mjs — generic AI-agent-runtime
// probe for the ecosystem step of `brain:day:start` (issue #123).
//
// ADR-0005 is the constraint: brain is harness-agnostic, so this is NOT
// "update claude". It is "ask the harness the repo DECLARES which runtime it
// needs, read that runtime's version, and say something true about it". Each
// platform backend owns one `AGENT_RUNTIME` descriptor; this module knows the
// descriptor shape and nothing else. Adding a fourth platform tomorrow means
// exporting one more descriptor — no edit here, no edit in day-start.mjs.
//
// Notify, never auto-update. `probeAgentRuntime` executes exactly two things:
// the descriptor's version command and its latest-version command. It never
// executes `updateHint` — that string is printed for a human to run, mirroring
// the brain-tag check's stance (ADR-0006 and
// brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md).
//
// Every failure keeps its own name. `absent` (the binary is not installed),
// `unreadable` (it is installed but would not say which version),
// `unknown-latest` (the installed version is known, the newest one is not) and
// `unresolved` (the backend module itself could not be loaded) are four
// different facts and are never collapsed into one another — a reader that
// answers "nothing" to both "there is nothing" and "I could not look" reports
// a silence it never measured.

import { spawnSync } from 'node:child_process';

import { compareSemver } from '../../lib/installer.mjs';
import { resolvePlatform } from '../cli.mjs';

/**
 * The states `probeAgentRuntime`/`agentRuntimeReport` can return, each a
 * distinct fact about the configured runtime.
 */
export const RUNTIME_STATES = Object.freeze([
  'not-declared',    // the backend declares no runtime to check (e.g. plain)
  'unresolved',      // the backend module could not be loaded — we did not look
  'absent',          // the runtime binary is not installed
  'unreadable',      // the binary answered, but not with a version
  'unknown-latest',  // installed version known; newest version could not be read
  'up-to-date',      // installed >= latest
  'update-available',// installed < latest
]);

const SEMVER_RE = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

/** First semver-looking token in a command's stdout, or null. */
function parseVersion(stdout) {
  const m = SEMVER_RE.exec(String(stdout ?? ''));
  return m ? m[1] : null;
}

/** Short, non-empty description of why a command produced no version. */
function failureDetail(result) {
  const parts = [
    result?.error?.message,
    String(result?.stderr ?? '').trim(),
    String(result?.stdout ?? '').trim(),
  ].filter(Boolean);
  const detail = parts.join(' — ').split('\n')[0];
  return detail || `exited with status ${result?.status ?? 'unknown'}`;
}

function defaultRun(cmd, args) {
  return spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' });
}

/**
 * Reads the state of one declared agent runtime. Pure apart from the injected
 * `_run` seam; never throws.
 *
 * @param {object|null} descriptor A backend's `AGENT_RUNTIME`:
 *   `{ name, bin, versionArgs, latest: { cmd, args } | null, updateHint }`.
 * @param {{ _run?: (cmd: string, args: string[]) => object }} [opts]
 * @returns {{ state: string, name: string|null, bin: string|null,
 *   installed: string|null, latest: string|null, updateHint: string|null,
 *   detail: string|null }}
 */
export function probeAgentRuntime(descriptor, { _run = defaultRun } = {}) {
  const base = {
    name: descriptor?.name ?? null,
    bin: descriptor?.bin ?? null,
    installed: null,
    latest: null,
    updateHint: descriptor?.updateHint ?? null,
    detail: null,
  };

  if (!descriptor) return { ...base, state: 'not-declared' };

  let versionResult;
  try {
    versionResult = _run(descriptor.bin, descriptor.versionArgs ?? []);
  } catch (err) {
    return { ...base, state: 'absent', detail: err.message };
  }

  if (versionResult?.error || versionResult?.status !== 0) {
    return { ...base, state: 'absent', detail: failureDetail(versionResult) };
  }

  const installed = parseVersion(versionResult.stdout);
  if (!installed) {
    // The binary is here and answered — it just did not answer with a version.
    return { ...base, state: 'unreadable', detail: failureDetail(versionResult) };
  }

  if (!descriptor.latest) {
    return {
      ...base,
      state: 'unknown-latest',
      installed,
      detail: 'the backend declares no latest-version probe',
    };
  }

  let latestResult;
  try {
    latestResult = _run(descriptor.latest.cmd, descriptor.latest.args ?? []);
  } catch (err) {
    return { ...base, state: 'unknown-latest', installed, detail: err.message };
  }

  if (latestResult?.error || latestResult?.status !== 0) {
    return { ...base, state: 'unknown-latest', installed, detail: failureDetail(latestResult) };
  }

  const latest = parseVersion(latestResult.stdout);
  if (!latest) {
    return { ...base, state: 'unknown-latest', installed, detail: failureDetail(latestResult) };
  }

  return {
    ...base,
    state: compareSemver(latest, installed) > 0 ? 'update-available' : 'up-to-date',
    installed,
    latest,
  };
}

/**
 * Renders one probe result as operator-facing text. Pure.
 *
 * Strings are English literals rather than `t()` keys: the i18n catalogs live
 * in `brain/scripts/i18n/**`, outside this change's file claim. See the PR.
 *
 * @param {object} status A `probeAgentRuntime` result.
 * @param {string} [platform] The configured platform name, for the states that
 *   describe the backend rather than the runtime.
 * @returns {{ level: 'ok'|'info'|'warn', message: string, hint: string|null }}
 */
export function formatRuntimeNotice(status, platform = null) {
  const who = status?.name ?? platform ?? 'agent runtime';
  const detail = status?.detail ? ` (${status.detail})` : '';

  switch (status?.state) {
    case 'not-declared':
      return {
        level: 'info',
        message: `harness '${platform ?? who}' declares no agent runtime to check.`,
        hint: null,
      };
    case 'unresolved':
      return {
        level: 'warn',
        message: `agent runtime not checked — harness '${platform ?? who}' could not be loaded${detail}.`,
        hint: 'Check AGENT_PLATFORM / brain.config.json — the configured harness has no backend.',
      };
    case 'absent':
      return {
        level: 'info',
        message: `${who} is not installed${detail}.`,
        hint: status?.updateHint ? `Install it with: ${status.updateHint}` : null,
      };
    case 'unreadable':
      return {
        level: 'warn',
        message: `${who} is installed but did not report a version${detail}.`,
        hint: 'Version check skipped — brain will not guess which version is running.',
      };
    case 'unknown-latest':
      return {
        level: 'info',
        message: `${who} ${status.installed} — latest version unknown${detail}.`,
        hint: null,
      };
    case 'update-available':
      return {
        level: 'warn',
        message: `New ${who} version available: ${status.installed} → ${status.latest}`,
        hint: `${status.updateHint ?? 'update it with your package manager'} — not applied automatically.`,
      };
    case 'up-to-date':
      return {
        level: 'ok',
        message: `${who} up to date (${status.installed}).`,
        hint: null,
      };
    default:
      return {
        level: 'warn',
        message: `${who}: unrecognized runtime state '${status?.state}'.`,
        hint: null,
      };
  }
}

async function defaultLoadBackend(platform) {
  return import(new URL(`./${platform}.mjs`, import.meta.url));
}

/**
 * Resolves the CONFIGURED platform, reads its declared runtime, and returns the
 * probe result plus the text to print. Never throws, never auto-updates.
 *
 * @param {object} [opts]
 * @param {object} [opts.env]     Process env (for AGENT_PLATFORM).
 * @param {object} [opts.envVars] Parsed .env vars.
 * @param {object} [opts.config]  brain.config.json's harness section.
 * @param {(platform: string) => Promise<object>} [opts._loadBackend]
 * @param {(cmd: string, args: string[]) => object} [opts._run]
 * @returns {Promise<{ platform: string, status: object, notice: object }>}
 */
export async function agentRuntimeReport({
  env = process.env,
  envVars = {},
  config = {},
  _loadBackend = defaultLoadBackend,
  _run = defaultRun,
} = {}) {
  const platform = resolvePlatform({ env, envVars, config });

  let backend;
  try {
    backend = await _loadBackend(platform);
  } catch (err) {
    const status = {
      state: 'unresolved',
      name: null,
      bin: null,
      installed: null,
      latest: null,
      updateHint: null,
      detail: err.message,
    };
    return { platform, status, notice: formatRuntimeNotice(status, platform) };
  }

  const status = probeAgentRuntime(backend?.AGENT_RUNTIME ?? null, { _run });
  return { platform, status, notice: formatRuntimeNotice(status, platform) };
}
