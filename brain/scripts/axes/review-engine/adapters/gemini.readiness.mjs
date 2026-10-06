// Gemini readiness: the deterministic local prerequisites of a cold-review route to gemini.
//
// Dispatched by `harness/readiness.mjs` through the gemini descriptor (`readiness: true`),
// which also resolves the route and its default model (#1129).

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { hasAgyAuth } from './gemini.mjs';

function defaultCommandExists(bin, env = process.env) {
  return env?.PATH?.split(':').some((dir) => existsSync(join(dir, bin))) ?? false;
}

/**
 * Check only deterministic local prerequisites for Gemini.
 */
export function checkReadiness(route, {
  commandExists = defaultCommandExists,
  env = process.env,
  agyAuthCheck = hasAgyAuth,
} = {}) {
  const hasAgy = commandExists('agy', env) && agyAuthCheck(env);
  const hasGemini = commandExists('gemini', env);
  const hasApiKey = typeof env?.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim() !== '';
  const hasGoogleCreds = typeof env?.GOOGLE_APPLICATION_CREDENTIALS === 'string' && env.GOOGLE_APPLICATION_CREDENTIALS.trim() !== '';

  if (!hasAgy && !hasGemini) {
    return {
      ready: false,
      required: true,
      diagnostic: 'Gemini is required by cold-review:gemini but neither agy (authenticated via Antigravity CLI for Google AI Pro subscriptions) nor gemini CLI is installed.',
    };
  }

  if (!hasAgy && !hasApiKey && !hasGoogleCreds) {
    return {
      ready: false,
      required: true,
      diagnostic: 'Gemini CLI is installed but not authenticated; set GEMINI_API_KEY or GOOGLE_APPLICATION_CREDENTIALS before cold review.',
    };
  }

  const runner = hasAgy
    ? 'agy (Google AI Pro subscription)'
    : (hasApiKey ? 'gemini (API key)' : 'gemini (ADC)');
  return {
    ready: true,
    required: true,
    diagnostic: `Gemini runner ${runner} is available for ${route.identity}; the review run verifies model access, network, and the read-only sandbox.`,
  };
}
