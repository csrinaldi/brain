// axis-migration-context.mjs — what the ADR-0038 migration needs from OUTSIDE the config (#1114 S3.2).
//
// The migration (brain/core/config-migrations.mjs, 1.11.1) must write into tracked config the
// value a consumer EFFECTIVELY runs today (ADR-0038 section 7). For `platform` and `sdd` that is
// a chain that leaves the config file: process env, then `.env`, then the flat keys, then the
// legacy `SDD_HARNESS`/`harness`, then a code default. This module walks that chain and reports
// the SOURCE of the winner, because the upgrade prints it: a per-machine `.env` value becomes the
// team's tracked default, and the reviewer of that commit must be able to see it.
//
// It mirrors `resolvePlatform` / `resolveEngine` exactly (same `??` semantics, an empty value
// stops the level and falls to the harness step), and axis-migration-context.test.mjs holds the
// two to a parity table. READ-ONLY: `.env` is read through the one reader and never edited, and
// no value other than the two axis selectors is ever returned.

import { resolveEnv } from './env-read.mjs';
import { AGENT_PLATFORMS, SDD_ENGINES, readAxis, legacyHarness } from './axis-config.mjs';
import { LIFECYCLE_STAGES } from './sdd-layout.mjs';
import { DEFAULT_PLATFORM, DEFAULT_ENGINE } from '../harness/platform.mjs';

const where = (res, key) => (res.source === 'shell' ? `process env ${key}` : `.env ${key}`);
const stated = (res) => res.value !== null && res.value !== undefined;

function effective({ axis, selectorKey, members, fallback, config, env, root }) {
  // 1. process env, then .env — a stated-but-empty value stops this level (the resolvers use `??`).
  const selector = resolveEnv(selectorKey, { env, root });
  if (stated(selector)) {
    if (selector.value) return { value: selector.value, source: where(selector, selectorKey) };
  } else {
    // 2. the config's own key: the flat legacy key (the shape is read too; a shaped axis is not migrated).
    const fromConfig = readAxis(config, axis, { harness: false });
    if (fromConfig.default) {
      const key = fromConfig.source === 'shape' ? `${axis}.default` : axis === 'sdd' ? 'engine' : axis;
      return { value: fromConfig.default, source: `brain.config.json ${key}` };
    }
  }
  // 3. the legacy harness, only when it names a member of THIS axis.
  const harness = resolveEnv('SDD_HARNESS', { env, root });
  if (stated(harness)) {
    if (harness.value && members.includes(harness.value)) return { value: harness.value, source: where(harness, 'SDD_HARNESS') };
  } else {
    const fromConfig = legacyHarness(config);
    if (fromConfig && members.includes(fromConfig)) return { value: fromConfig, source: 'brain.config.json harness' };
  }
  // 4. today's code default.
  return { value: fallback, source: "today's default" };
}

/**
 * @param {{config?: object, env?: object, root?: string}} args
 * @returns {{platform: {value: string, source: string}, sdd: {value: string, source: string}, lifecycleStages: string[]}}
 */
export function resolveAxisMigrationContext({ config = {}, env = process.env, root = process.cwd() } = {}) {
  return {
    platform: effective({ axis: 'platform', selectorKey: 'AGENT_PLATFORM', members: AGENT_PLATFORMS, fallback: DEFAULT_PLATFORM, config, env, root }),
    sdd: effective({ axis: 'sdd', selectorKey: 'SDD_ENGINE', members: SDD_ENGINES, fallback: DEFAULT_ENGINE, config, env, root }),
    lifecycleStages: [...LIFECYCLE_STAGES],
  };
}
