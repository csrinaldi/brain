// Codex transport for the repository-owned cold-review stage.
//
// This backend is deliberately only a producer: it accepts a host-owned output
// descriptor, runs non-interactive Codex against the detached candidate, and
// returns a bounded transport result. The review layer owns snapshots, parser,
// challenger, and publication.

import { chmodSync, copyFileSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { assertRoutableStage } from '../../../lib/stage-engine.mjs';
import { credentialEnvNames, withoutCredentials } from '../../../lib/credential-env.mjs';
import { withForgeConfigDir } from '../../../harness/producer-forge-reach.mjs';
import { DEFAULT_STAGE_TIMEOUT_MS, formatDuration } from '../../../lib/duration.mjs';
import { defaultRun } from '../../lib/agent-runtime.mjs';
import { engineTail, secretValues, validateFinalMessageOutput } from '../../lib/stage-output.mjs';
import { DESCRIPTOR } from './codex.descriptor.mjs';

// The pinned model is declared ONCE, in the descriptor (#1129); this export keeps the importers valid.
export const CODEX_MODEL = DESCRIPTOR.stage.model.id;
export const CODEX_HOME_MODE = 0o700;
export const CODEX_AUTH_MODE = 0o600;

function makeCodexHome() {
  const home = mkdtempSync(join(tmpdir(), 'brain-codex-'));
  chmodSync(home, CODEX_HOME_MODE);
  return home;
}

function resolveAuthSource(env) {
  const homes = [];
  if (typeof env?.CODEX_HOME === 'string' && env.CODEX_HOME.trim() !== '') {
    homes.push(env.CODEX_HOME);
  }
  if (typeof env?.HOME === 'string' && env.HOME.trim() !== '') {
    homes.push(join(env.HOME, '.codex'));
  }

  for (const home of homes) {
    const authPath = join(home, 'auth.json');
    try {
      if (statSync(authPath).isFile()) return authPath;
    } catch {
      // This location is not a usable Codex OAuth cache; try the fallback.
    }
  }
  return null;
}

function copyAuth(source, destination) {
  copyFileSync(source, destination);
}

/**
 * Run Codex as an untrusted producer against a read-only candidate.
 *
 * @returns {Promise<{ok: boolean, elapsedMs?: number, reason?: string}>}
 */
export async function runStage({
  stage, prompt, model = null, cwd = process.cwd(), timeoutMs = DEFAULT_STAGE_TIMEOUT_MS,
  credentialEnv = null, forgeConfigDir = null, output, routed = undefined,
  _env = process.env, _run = defaultRun, _now = Date.now,
  _makeCodexHome = makeCodexHome, _removeCodexHome = (home) => rmSync(home, { recursive: true, force: true }),
  _copyAuth = copyAuth,
} = {}) {
  assertRoutableStage(stage, { routed });
  if (typeof prompt !== 'string' || prompt.trim() === '') {
    return { ok: false, reason: `no prompt for stage "${stage}" — an engine with nothing to do is not a run` };
  }
  if (model !== CODEX_MODEL) {
    return { ok: false, reason: `the Codex cold-review transport requires model ${CODEX_MODEL}` };
  }
  const outputFailure = validateFinalMessageOutput(output, cwd, { engine: DESCRIPTOR.name });
  if (outputFailure) return { ok: false, reason: outputFailure };

  const scrubNames = Array.isArray(credentialEnv)
    ? credentialEnvNames({ extra: credentialEnv })
    : credentialEnvNames();
  const scrubbed = withoutCredentials(_env, scrubNames);
  const env = forgeConfigDir ? withForgeConfigDir(scrubbed, forgeConfigDir) : scrubbed;
  const secrets = secretValues(_env, scrubNames);
  const authSource = resolveAuthSource(_env);
  if (authSource === null) {
    return {
      ok: false,
      reason: 'Codex OAuth authentication is unavailable: auth.json was not found in $CODEX_HOME or $HOME/.codex; run codex login before cold review.',
    };
  }

  let codexHome;
  try {
    codexHome = _makeCodexHome();
    if (typeof codexHome !== 'string' || codexHome.trim() === '' || !existsSync(codexHome) || !statSync(codexHome).isDirectory()) {
      return { ok: false, reason: 'the isolated writable CODEX_HOME could not be created' };
    }
    chmodSync(codexHome, CODEX_HOME_MODE);
  } catch (err) {
    return { ok: false, reason: `the isolated writable CODEX_HOME could not be prepared — ${err?.message ?? String(err)}` };
  }

  const startedAt = _now();
  const elapsed = () => _now() - startedAt;
  let answer;
  try {
    try {
      const isolatedAuth = join(codexHome, 'auth.json');
      _copyAuth(authSource, isolatedAuth);
      if (!statSync(isolatedAuth).isFile()) throw new Error('the copied auth.json is not a regular file');
      chmodSync(isolatedAuth, CODEX_AUTH_MODE);
    } catch (err) {
      answer = {
        ok: false,
        elapsedMs: elapsed(),
        reason: `the isolated CODEX_HOME OAuth authentication could not be prepared — ${err?.message ?? String(err)}`,
      };
    }

    if (answer === undefined) {
      let result;
      try {
        const args = [
          'exec', '--model', model, '--sandbox', 'read-only', '--cd', cwd,
          '--skip-git-repo-check', '--ephemeral', '--ignore-user-config',
          '--output-last-message', output.tempPath, prompt,
        ];
        result = _run('codex', args, { cwd, timeoutMs, env: { ...env, CODEX_HOME: codexHome }, discardStdout: true });
      } catch (err) {
        result = { spawnError: err };
      }

      if (result?.spawnError) {
        answer = { ok: false, elapsedMs: elapsed(), reason: `the Codex engine could not be spawned — ${result.spawnError?.message ?? String(result.spawnError)}` };
      } else if (result?.error) {
        const timedOut = result.error.code === 'ETIMEDOUT';
        answer = {
          ok: false,
          elapsedMs: elapsed(),
          reason: (timedOut ? `the Codex engine did not finish within ${formatDuration(timeoutMs)}` : `the Codex engine failed to run — ${result.error.message}`) + engineTail(result, secrets),
        };
      } else if (result?.status !== 0) {
        answer = {
          ok: false,
          elapsedMs: elapsed(),
          reason: `the Codex engine exited with status ${result?.status ?? 'unknown'}` + engineTail(result, secrets),
        };
      } else if (!existsSync(output.tempPath)) {
        answer = { ok: false, elapsedMs: elapsed(), reason: 'the Codex engine exited cleanly but wrote no final message' };
      } else {
        try {
          if (!statSync(output.tempPath).isFile()) throw new Error('the final-message path is not a regular file');
          answer = { ok: true, elapsedMs: elapsed() };
        } catch (err) {
          answer = { ok: false, elapsedMs: elapsed(), reason: `the Codex final message cannot be read — ${err?.message ?? String(err)}` };
        }
      }
    }
  } finally {
    try {
      _removeCodexHome(codexHome);
    } catch (err) {
      answer = { ok: false, elapsedMs: elapsed(), reason: `the isolated CODEX_HOME cleanup failed — ${err?.message ?? String(err)}` };
    }
  }
  return answer;
}
