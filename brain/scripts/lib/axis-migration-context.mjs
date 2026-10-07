// axis-migration-context.mjs — what the ADR-0038 migration needs from OUTSIDE the config (#1114 S3.2).
//
// The migration (brain/core/config-migrations.mjs, 1.11.1) must write into tracked config the
// value a consumer EFFECTIVELY runs today (ADR-0038 section 7). For `platform` and `sdd` that is
// a chain that leaves the config file: process env, then `.env`, then the flat keys, then the
// legacy `SDD_HARNESS`/`harness`, then a code default. This module walks that chain and reports
// the SOURCE of the winner, because the upgrade prints it: a per-machine `.env` value becomes the
// team's tracked default, and the reviewer of that commit must be able to see it.
//
// Since #1114 S2 the chain is `resolveAxis`'s own (no second precedence here); this module adds only what the
// migration alone needs: today's default for an axis nothing declares, and the SOURCE label. READ-ONLY: `.env`
// is read through the one reader and never edited, and no value other than the two axis selectors is ever returned.

import { readDotenv } from './env-read.mjs';
import { tryResolveAxis } from './axis-config.mjs';
import { LIFECYCLE_STAGES } from './sdd-layout.mjs';

// What an EXISTING consumer ran before #1114 S2, when the resolvers defaulted in code (ADR-0024 Amendment 2 and
// `harness/cli.mjs`). The migration writes it into tracked config for a consumer that stated nothing, so no behaviour
// changes (ADR-0038 section 7). The resolvers hold NO default any more: this is the migration's own record.
const DEFAULT_PLATFORM = 'claude';
const DEFAULT_ENGINE = 'gentle-ai';

const perMachine = (source) => /^(process env|\.env)/.test(source);

/** The human label of where `resolveAxis` found a value: the file/key an upgrade prints next to it. */
function label(axis, r) {
  if (r.where === 'process-env') return `process env ${r.key}`;
  if (r.where === 'dotenv') return `.env ${r.key}`;
  if (r.source === 'legacy-harness') return 'brain.config.json harness';
  if (r.source === 'legacy-config') return `brain.config.json ${axis === 'sdd' ? 'engine' : axis}`;
  return `brain.config.json ${axis}.default`;
}

function effective(args) {
  const { envSources } = args;
  if (!envSources) {
    // INSPECT, never promote (#1114 S3.4, the S3.3 cold review): when the effective value comes from the process env or
    // `.env`, it is a per-machine choice and the team never made one, so the axis is left UNDECLARED. Writing today's
    // default instead would hand the team a value nobody chose. Only the SOURCE is read here; no value is copied.
    const full = resolveEffective({ ...args, envSources: true });
    if (perMachine(full.source)) {
      return { value: '', source: `${full.source} (per-machine, left undeclared)`, undeclared: true };
    }
  }
  return resolveEffective(args);
}

// The ONE resolver answers (`resolveAxis`); this adds only the migration's own question: what to write when it says
// "undeclared" (today's default, which is what ran before S2) or refuses a value (never copied into tracked config).
// `envSources: false` hands it neither the process env nor `.env`.
function resolveEffective({ axis, fallback, config, env, root, envSources }) {
  const r = tryResolveAxis(axis, {
    env: envSources ? env : {},
    dotenv: envSources ? readDotenv(root) : {},
    config,
    notice: () => {},
  });
  if (r.ok) return { value: r.value, source: label(axis, r) };
  if (r.refusal.code === 'invalid-value') {
    const where = r.refusal.where === 'process-env' ? 'process env' : r.refusal.where === 'dotenv' ? '.env' : 'brain.config.json';
    return { value: '', source: `${where} ${axis} value refused (not a ${axis} brain ships; left undeclared)`, undeclared: true };
  }
  return { value: fallback, source: "today's default" };
}

/**
 * `envSources: false` (every caller but `brain:upgrade`) declares from the config and today's defaults ONLY: a per-machine
 * value is promoted into tracked config by the upgrade, which prints its source (ADR-0038 section 7), and by nothing else.
 * An axis whose effective value IS per-machine comes back `{ value: '', undeclared: true }`: the env and `.env` are
 * inspected for the SOURCE, and no value from them ever enters the result.
 * @param {{config?: object, env?: object, root?: string, envSources?: boolean}} args
 * @returns {{platform: {value: string, source: string}, sdd: {value: string, source: string}, lifecycleStages: string[]}}
 */
export function resolveAxisMigrationContext({ config = {}, env = process.env, root = process.cwd(), envSources = true } = {}) {
  return {
    platform: effective({ axis: 'platform', fallback: DEFAULT_PLATFORM, config, env, root, envSources }),
    sdd: effective({ axis: 'sdd', fallback: DEFAULT_ENGINE, config, env, root, envSources }),
    lifecycleStages: [...LIFECYCLE_STAGES],
  };
}
