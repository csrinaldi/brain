// Gemini transport for the repository-owned cold-review stage.
//
// This backend is deliberately only a producer: it accepts a host-owned output
// descriptor, runs Gemini against the detached candidate in read-only mode, and
// returns a bounded transport result. The review layer owns snapshots, parser,
// challenger, and publication.

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { assertRoutableStage } from '../../../lib/stage-engine.mjs';
import { credentialEnvNames, withoutCredentials } from '../../../lib/credential-env.mjs';
import { withForgeConfigDir } from '../../../harness/producer-forge-reach.mjs';
import { DEFAULT_STAGE_TIMEOUT_MS, formatDuration } from '../../../lib/duration.mjs';
import { defaultRun } from '../../lib/agent-runtime.mjs';
import { engineTail, secretValues, validateFinalMessageOutput } from '../../lib/stage-output.mjs';
import { DESCRIPTOR } from './gemini.descriptor.mjs';

// The default model is declared ONCE, in the descriptor (#1129); this export keeps the importers valid.
export const GEMINI_MODEL = DESCRIPTOR.stage.model.id;


export function hasAgyAuth(_env = process.env, _existsSync = existsSync) {
  const home = _env?.HOME ?? homedir();
  const cliDir = join(home, '.gemini', 'antigravity-cli');
  if (!_existsSync(cliDir)) return false;
  return (
    _existsSync(join(cliDir, 'settings.json')) ||
    _existsSync(join(cliDir, 'jetski_state.pbtxt')) ||
    _existsSync(join(cliDir, 'installation_id'))
  );
}

export function deduplicateFindingsBlocks(text) {
  if (typeof text !== 'string') return text;
  const regex = /```brain-findings\/1\s*([\s\S]*?)\s*```/g;
  const matches = [...text.matchAll(regex)];
  if (matches.length > 1) {
    const firstContent = matches[0][1].trim();
    const allIdentical = matches.every((m) => m[1].trim() === firstContent);
    if (allIdentical) {
      let seen = false;
      return text.replace(regex, (match) => {
        if (!seen) {
          seen = true;
          return match;
        }
        return '';
      }).replace(/\n{3,}/g, '\n\n').trim();
    }
  }
  return text;
}

function defaultCommandExists(bin, env = process.env) {
  return env?.PATH?.split(':').some((dir) => existsSync(join(dir, bin))) ?? false;
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
  _commandExists = defaultCommandExists,
  _hasAgyAuth = hasAgyAuth,
} = {}) {
  assertRoutableStage(stage, { routed });
  if (typeof prompt !== 'string' || prompt.trim() === '') {
    return { ok: false, reason: `no prompt for stage "${stage}" — an engine with nothing to do is not a run` };
  }
  const outputFailure = validateFinalMessageOutput(output, cwd, { engine: DESCRIPTOR.name });
  if (outputFailure) return { ok: false, reason: outputFailure };

  const hasAgy = _commandExists('agy', _env) && _hasAgyAuth(_env);
  const hasGemini = _commandExists('gemini', _env);
  const hasApiKey = typeof _env?.GEMINI_API_KEY === 'string' && _env.GEMINI_API_KEY.trim() !== '';
  const hasGoogleCreds = typeof _env?.GOOGLE_APPLICATION_CREDENTIALS === 'string' && _env.GOOGLE_APPLICATION_CREDENTIALS.trim() !== '';

  let runner = null;
  if (hasAgy) {
    runner = 'agy';
  } else if (hasGemini && (hasApiKey || hasGoogleCreds)) {
    runner = 'gemini';
  }

  if (!runner) {
    return {
      ok: false,
      reason: 'Gemini authentication is unavailable: neither agy (Antigravity CLI for Google AI Pro subscriptions) nor GEMINI_API_KEY / GOOGLE_APPLICATION_CREDENTIALS for gemini CLI is set or available.',
    };
  }

  const effectiveModel = (runner === 'agy' && (!model || model === 'gemini-2.5-pro' || model.startsWith('gpt-') || model.startsWith('claude-')))
    ? 'gemini-3.1-pro-high'
    : (model ?? GEMINI_MODEL);

  const baseScrub = Array.isArray(credentialEnv)
    ? credentialEnvNames({ extra: credentialEnv })
    : credentialEnvNames();
  const scrubNames = runner === 'agy'
    ? [...baseScrub, 'GEMINI_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS']
    : baseScrub;
  const scrubbed = withoutCredentials(_env, scrubNames);
  const env = forgeConfigDir ? withForgeConfigDir(scrubbed, forgeConfigDir) : scrubbed;
  const secrets = secretValues(_env, [...baseScrub, 'GEMINI_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS']);

  const startedAt = _now();
  const elapsed = () => _now() - startedAt;

  const args = runner === 'agy'
    ? ['-p', prompt, '--model', effectiveModel, '--sandbox', '--dangerously-skip-permissions', '--disable-slash-commands']
    : ['-p', prompt, '-m', effectiveModel, '--approval-mode', 'plan'];

  let result;
  try {
    result = _run(runner, args, { cwd, timeoutMs, env });
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
      reason: (timedOut ? `the Gemini engine did not finish within ${formatDuration(timeoutMs)}` : `the Gemini engine failed to run — ${result.error.message}`) + engineTail(result, secrets),
    };
  }
  if (result?.status !== 0) {
    return {
      ok: false,
      elapsedMs: elapsed(),
      reason: `the Gemini engine exited with status ${result?.status ?? 'unknown'}` + engineTail(result, secrets),
    };
  }

  if (!existsSync(output.tempPath) && typeof result?.stdout === 'string' && result.stdout.trim() !== '') {
    try {
      const content = deduplicateFindingsBlocks(result.stdout.trim());
      writeFileSync(output.tempPath, content, 'utf8');
    } catch (err) {
      return { ok: false, elapsedMs: elapsed(), reason: `the Gemini final message could not be written — ${err?.message ?? String(err)}` };
    }
  } else if (existsSync(output.tempPath)) {
    try {
      const raw = readFileSync(output.tempPath, 'utf8');
      const deduplicated = deduplicateFindingsBlocks(raw);
      if (deduplicated !== raw) {
        writeFileSync(output.tempPath, deduplicated, 'utf8');
      }
    } catch {
      // let subsequent checks handle stat/read errors
    }
  }

  if (!existsSync(output.tempPath)) {
    return { ok: false, elapsedMs: elapsed(), reason: 'the Gemini engine exited cleanly but wrote no final message' + engineTail(result, secrets) };
  }

  try {
    if (!statSync(output.tempPath).isFile()) throw new Error('the final-message path is not a regular file');
    return { ok: true, elapsedMs: elapsed() };
  } catch (err) {
    return { ok: false, elapsedMs: elapsed(), reason: `the Gemini final message cannot be read — ${err?.message ?? String(err)}` };
  }
}
