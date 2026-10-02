// brain/scripts/harness/platform.mjs — the platform axis, as a LEAF.
//
// WHY THIS FILE EXISTS: it breaks an ESM cycle that deadlocked the shipped
// bootstrap path (#682 slice 3, judgment:cold-1 of the cold review on `2149cd1`).
//
// The cycle was one edge long, and every hop in it was reasonable on its own:
//
//   harness/cli.mjs            top-level `await dispatch(platform, op, …)`
//     → dynamic import         axes/platform/adapters/claude.mjs        (chosen by the platform)
//       → static import        axes/lib/agent-runtime.mjs (for `defaultRun`)
//         → static import      harness/cli.mjs            (for `resolvePlatform`)
//
// The last hop re-enters a module that is STILL EVALUATING — it is suspended at
// its own top-level await — so the graph never settles. Node reports
// `Detected unsettled top-level await` and exits 13.
//
// MEASURED, on one tree, one environment variable apart:
//
//   node harness/cli.mjs init                        → exit 0
//   AGENT_PLATFORM=claude node harness/cli.mjs init  → exit 13, nothing written
//
// The first resolved to `antigravity` (the default until #1125), whose backend
// closes no cycle, so the defect is invisible unless the platform is the one
// that does. Since #1125 the unset path resolves `claude`, so the plain
// `node harness/cli.mjs init` now walks exactly the edge this file cut. `bootstrap.sh`
// runs exactly this command, so a consumer configuring `claude` — which is every
// repo that would route this slice's stage — got no `.claude/settings.json`.
//
// A STATIC IMPORT OF `claude.mjs` RESOLVES FINE, and that is the trap: ESM does
// tolerate cycles, handing out a partially-initialised namespace. What it cannot
// do is settle a cycle re-entered THROUGH a suspended top-level await. So the
// obvious probe — importing the backend on its own — reports health, and the
// only reproduction is the real dispatch path. A cold review refuted this
// finding on exactly that evidence, having run the command without the platform
// set and read `antigravity` in its own output.
//
// THE RULE THIS ENCODES: a backend may not import the dispatcher. `cli.mjs`
// chooses backends; anything a backend needs from it is not dispatch logic and
// belongs here, where both can reach it and neither depends on the other.
// `cli.mjs` re-exports `resolvePlatform` so its own importers are unaffected.

import { AGENT_PLATFORMS, SDD_ENGINES, resolveAxis } from '../lib/axis-config.mjs';
// The two memberships are declared in lib/axis-config.mjs (#1114 S3.1) and re-exported here, so
// every importer of this file is unaffected.
export { AGENT_PLATFORMS, SDD_ENGINES };

// There is NO default platform and NO default engine (#1114 S2, ADR-0038 section 3): `claude` (ADR-0024 Amendment 2)
// and `gentle-ai` are not chosen by the code any more. An axis nothing declares is REFUSED by `resolveAxis`, with the
// fix named. `bootstrap.sh` declares them for a NEW consumer, in tracked config, where they are visible.

/**
 * Resolves the active agent platform: a thin caller of `resolveAxis` (process env > `.env` > `platform.default` >
 * the legacy flat key and `SDD_HARNESS`, one minor version).
 *
 * @param {{ env?: object, envVars?: object, config?: object }} [opts]  `envVars` is the parsed `.env`
 * @returns {string}
 * @throws {import('../lib/axis-config.mjs').AxisRefusal} when nothing declares a platform
 */
export function resolvePlatform({ env = process.env, envVars = {}, config = {} } = {}) {
  return resolveAxis('platform', { env, dotenv: envVars, config }).value;
}
