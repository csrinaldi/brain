// Codex readiness: the deterministic local prerequisites of a cold-review route to codex.
//
// Dispatched by `harness/readiness.mjs` through the codex descriptor (`readiness: true`),
// which also resolves the route and enforces the pinned model (#1129). This leaf holds only
// what is codex's own: the version floor and the install and login diagnostics.

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export const MIN_CODEX_VERSION = Object.freeze([0, 154, 0]);

function versionAtLeast(actual, minimum = MIN_CODEX_VERSION) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] !== minimum[index]) return actual[index] > minimum[index];
  }
  return true;
}

function parseVersion(output) {
  const match = String(output ?? '').match(/\b(\d+)\.(\d+)\.(\d+)\b/);
  return match ? match.slice(1).map(Number) : null;
}

function resultText(result) {
  return String(result?.stdout ?? '').trim() || String(result?.stderr ?? '').trim();
}

function defaultCommandExists(bin) {
  return process.env.PATH?.split(':').some((dir) => existsSync(join(dir, bin))) ?? false;
}

function defaultRun(bin, args) {
  try {
    return spawnSync(bin, args, { encoding: 'utf8', timeout: 10_000 });
  } catch (error) {
    return { error, status: null };
  }
}

/**
 * Check only deterministic local prerequisites. A real review invocation still
 * validates model entitlement, network, an isolated writable CODEX_HOME, and
 * the read-only sandbox against its immutable candidate.
 */
export function checkReadiness(route, {
  commandExists = defaultCommandExists,
  run = defaultRun,
} = {}) {
  if (!commandExists('codex')) {
    return {
      ready: false,
      required: true,
      diagnostic: 'Codex is required by cold-review:codex/gpt-5.5 but is not installed; run npm install -g @openai/codex.',
    };
  }
  const versionResult = run('codex', ['--version']);
  const version = parseVersion(resultText(versionResult));
  if (versionResult?.status !== 0 || version === null || !versionAtLeast(version)) {
    return {
      ready: false,
      required: true,
      diagnostic: `Codex cold-review requires Codex CLI ${MIN_CODEX_VERSION.join('.')} or newer; update @openai/codex.`,
    };
  }
  const authResult = run('codex', ['login', 'status']);
  if (authResult?.status !== 0) {
    return {
      ready: false,
      required: true,
      diagnostic: 'Codex is installed but not authenticated; run codex login before cold review. Credentials are never stored in brain.config.json.',
    };
  }
  return {
    ready: true,
    required: true,
    diagnostic: `Codex ${version.join('.')} is authenticated for ${route.identity}; the review run verifies model access, network, writable isolated state, and the read-only sandbox.`,
  };
}
