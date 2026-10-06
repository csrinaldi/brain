// harness/readiness.mjs — is the cold-review engine this repo routed ready to run? (#1129)
//
// ONE verb for every engine. The engine's descriptor says whether it ships a readiness
// probe (`readiness: true` means `<name>.readiness.mjs`, beside the adapter, exports
// `checkReadiness`) and what its model policy is. This module resolves the route, enforces a
// pinned model, and dispatches. It names no engine: codex's version floor and gemini's runner
// check live in their own leaves, and `bootstrap.sh` and `install-tools.sh` call only this.
//
//   node harness/readiness.mjs --check     print the diagnostic; exit 1 when a required engine is not ready
//   node harness/readiness.mjs --required  yes | no  (does the route need a readiness probe?)
//   node harness/readiness.mjs --engine    the routed engine, or nothing

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { COLD_REVIEW_STAGE, resolveStageEngine } from '../lib/stage-engine.mjs';
import { RUNTIME_REGISTRY } from '../axes/lib/runtime-registry.mjs';

/**
 * Resolve the effective cold-review route and whether it makes a readiness probe a dependency.
 * An engine that declares no probe stays outside every check. A `pinned` model policy is
 * enforced here, before any readiness or inference.
 */
export function resolveStageRoute(config, { registry = RUNTIME_REGISTRY } = {}) {
  const routing = resolveStageEngine(config, COLD_REVIEW_STAGE);
  if (routing === null) return { required: false, stage: COLD_REVIEW_STAGE, engine: null, model: null };

  const descriptor = registry.descriptor(routing.engine);
  const policy = descriptor?.stage?.model;
  let model = routing.model;
  if (policy?.policy === 'pinned' && routing.model !== policy.id) {
    throw new Error(`Cold-review route requires model ${policy.id} for ${routing.engine}; received ${routing.model ?? 'none'}`);
  }
  if (policy?.policy === 'default') model = routing.model ?? policy.id;

  if (descriptor?.readiness !== true) {
    return { required: false, stage: COLD_REVIEW_STAGE, engine: routing.engine, model };
  }
  return {
    required: true,
    stage: COLD_REVIEW_STAGE,
    engine: routing.engine,
    model,
    identity: `${COLD_REVIEW_STAGE}:${routing.engine}/${model}`,
  };
}

/** Import `<name>.readiness.mjs` from the directory that holds the engine's descriptor. */
export async function loadReadiness(name, { registry = RUNTIME_REGISTRY } = {}) {
  const dir = registry.dirs[name];
  if (!dir) throw new Error(`no readiness probe: "${name}" has no descriptor`);
  return import(new URL(`${name}.readiness.mjs`, dir).href);
}

/**
 * @param {{required?: boolean, engine?: string|null}} route
 * @param {{load?: Function, seams?: object}} [opts] `seams` go to the engine's `checkReadiness` untouched.
 */
export async function checkRouteReadiness(route, { load = loadReadiness, seams = {} } = {}) {
  if (!route?.required) {
    const engine = route?.engine ?? 'no engine';
    return { ready: true, required: false, diagnostic: `cold-review is routed to ${engine}; it declares no readiness probe` };
  }
  const leaf = await load(route.engine);
  return leaf.checkReadiness(route, seams);
}

/** Lenient on purpose: a consumer with no `brain.config.json` has no routed engine. */
export function loadConfig(cwd) {
  const file = join(cwd, 'brain.config.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`could not resolve the cold-review route from ${file}: ${error.message}`);
  }
}

async function main(argv) {
  const mode = argv[0] ?? '--check';
  if (!['--check', '--required', '--engine'].includes(mode)) throw new Error(`unknown readiness mode: ${mode}`);
  const route = resolveStageRoute(loadConfig(process.cwd()));
  if (mode === '--required') {
    process.stdout.write(`${route.required ? 'yes' : 'no'}\n`);
    return;
  }
  if (mode === '--engine') {
    process.stdout.write(`${route.engine ?? ''}\n`);
    return;
  }
  const result = await checkRouteReadiness(route);
  process.stdout.write(`${result.diagnostic}\n`);
  if (!result.ready) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Cold-review readiness failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
