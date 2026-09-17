// Gemini transport for the repository-owned cold-review stage.
//
// This backend is deliberately only a producer: it accepts a host-owned output
// descriptor, runs Gemini against the detached candidate in read-only mode, and
// returns a bounded transport result. The review layer owns snapshots, parser,
// challenger, and publication.

import { existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { assertRoutableStage } from '../../lib/stage-engine.mjs';
import { credentialEnvNames, withoutCredentials } from '../../lib/credential-env.mjs';
import { withForgeConfigDir } from '../producer-forge-reach.mjs';
import { DEFAULT_STAGE_TIMEOUT_MS, formatDuration } from '../../lib/duration.mjs';
import { defaultRun } from './agent-runtime.mjs';

export const GEMINI_MODEL = 'gemini-2.5-pro';

function tail(result, secrets, max = 300) {
  const text = String(result?.stderr ?? '').trim() || String(result?.stdout ?? '').trim();
  if (!text) return '';
  let safe = text;
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length > 0) safe = safe.split(secret).join('[redacted]');
  }
  const last = safe.split('\n').filter(Boolean).slice(-2).join(' / ');
  return ` — the engine last said: ${last.length > max ? `${last.slice(0, max)}…` : last}`;
}

function canonicalPath(path) {
  const unresolved = [];
  let current = resolve(path);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    unresolved.unshift(current.slice(parent.length + 1));
    current = parent;
  }
  const base = existsSync(current) ? realpathSync(current) : current;
  return resolve(base, ...unresolved);
}

function isWithin(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function validateOutput(output, cwd) {
  if (output?.mode !== 'final-message' || typeof output.tempPath !== 'string' || typeof output.artifactPath !== 'string') {
    return 'the Gemini transport needs a host-owned final-message output descriptor';
  }
  if (!isAbsolute(output.tempPath) || !isAbsolute(output.artifactPath)) {
    return 'the host-owned final-message paths must be absolute';
  }
  let candidate;
  let tempPath;
  let artifactPath;
  try {
    candidate = canonicalPath(cwd);
    tempPath = canonicalPath(output.tempPath);
    artifactPath = canonicalPath(output.artifactPath);
  } catch (err) {
    return `the host-owned final-message path cannot be resolved safely — ${err?.message ?? String(err)}`;
  }
  if (isWithin(candidate, tempPath) || isWithin(candidate, artifactPath)) {
    return 'the host-owned final-message output must be outside the candidate';
  }
  if (tempPath === artifactPath) return 'the Gemini temporary output and final artifact paths must differ';
  return null;
}

/**
 * Run Gemini as an untrusted producer against a read-only candidate.
 *
 * @returns {Promise<{ok: boolean, elapsedMs?: number, reason?: string}>}
 */
export async function runStage({
  stage,
  prompt,
  model = GEMINI_MODEL,
  cwd = process.cwd(),
  timeoutMs = DEFAULT_STAGE_TIMEOUT_MS,
  credentialEnv = null,
  forgeConfigDir = null,
  output,
  routed = undefined,
  _env = process.env,
  _run = defaultRun,
  _now = Date.now,
} = {}) {
  assertRoutableStage(stage, { routed });
  if (typeof prompt !== 'string' || prompt.trim() === '') {
    return { ok: false, reason: `no prompt for stage "${stage}" — an engine with nothing to do is not a run` };
  }
  const outputFailure = validateOutput(output, cwd);
  if (outputFailure) return { ok: false, reason: outputFailure };

  const hasApiKey = typeof _env?.GEMINI_API_KEY === 'string' && _env.GEMINI_API_KEY.trim() !== '';
  const hasGoogleCreds = typeof _env?.GOOGLE_APPLICATION_CREDENTIALS === 'string' && _env.GOOGLE_APPLICATION_CREDENTIALS.trim() !== '';
  if (!hasApiKey && !hasGoogleCreds) {
    return {
      ok: false,
      reason: 'Gemini authentication is unavailable: neither GEMINI_API_KEY nor GOOGLE_APPLICATION_CREDENTIALS is set in environment.',
    };
  }

  const scrubNames = Array.isArray(credentialEnv)
    ? credentialEnvNames({ extra: credentialEnv })
    : credentialEnvNames();
  const scrubbed = withoutCredentials(_env, scrubNames);
  const env = forgeConfigDir ? withForgeConfigDir(scrubbed, forgeConfigDir) : scrubbed;
  const secrets = scrubNames.map((name) => _env?.[name]).filter(Boolean);

  const startedAt = _now();
  const elapsed = () => _now() - startedAt;

  const args = [
    '--model', model,
    '--output', output.tempPath,
    prompt,
  ];

  let result;
  try {
    result = _run('gemini', args, { cwd, timeoutMs, env });
  } catch (err) {
    return { ok: false, elapsedMs: elapsed(), reason: `the Gemini engine could not be spawned — ${err?.message ?? String(err)}` };
  }

  if (result?.spawnError) {
    return { ok: false, elapsedMs: elapsed(), reason: `the Gemini engine could not be spawned — ${result.spawnError?.message ?? String(result.spawnError)}` };
  }
  if (result?.error) {
    const timedOut = result.error.code === 'ETIMEDOUT';
    return {
      ok: false,
      elapsedMs: elapsed(),
      reason: (timedOut ? `the Gemini engine did not finish within ${formatDuration(timeoutMs)}` : `the Gemini engine failed to run — ${result.error.message}`) + tail(result, secrets),
    };
  }
  if (result?.status !== 0) {
    return {
      ok: false,
      elapsedMs: elapsed(),
      reason: `the Gemini engine exited with status ${result?.status ?? 'unknown'}` + tail(result, secrets),
    };
  }
  if (!existsSync(output.tempPath)) {
    return { ok: false, elapsedMs: elapsed(), reason: 'the Gemini engine exited cleanly but wrote no final message' };
  }

  try {
    if (!statSync(output.tempPath).isFile()) throw new Error('the final-message path is not a regular file');
    return { ok: true, elapsedMs: elapsed() };
  } catch (err) {
    return { ok: false, elapsedMs: elapsed(), reason: `the Gemini final message cannot be read — ${err?.message ?? String(err)}` };
  }
}
