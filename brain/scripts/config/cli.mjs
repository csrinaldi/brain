#!/usr/bin/env node
// config/cli.mjs — issue #823: `brain:config`, the thin I/O half of the ONE
// config verb (Compuerta 4). Reads brain.config.json at the working root,
// hands EVERYTHING to the pure planner, writes atomically (tmp + rename in
// the same directory), and reports. All rules live in `config-verb.mjs` —
// this file owns exit codes and the write, nothing else.

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { planConfigWrite, resolvePath } from './config-verb.mjs';
import { parseEnvFile } from '../lib/env-read.mjs';
import { AXES, readAxis } from '../lib/axis-config.mjs';
import { resolveAxisMigrationContext } from '../lib/axis-migration-context.mjs';

const USAGE = `Usage: npm run brain:config -- get <path>
       npm run brain:config -- set <path> <value>
       npm run brain:config -- default <axis>
       npm run brain:config -- resolve <platform|sdd>
  <path> is dot-separated (e.g. docs.language, sdd.map.cold-review).
  <value> parses as JSON first, bare string on failure.
  default <axis> prints the axis default (${AXES.join('|')}): the ADR-0038 shape, else the legacy key;
  an empty line when undeclared.
  resolve <platform|sdd> runs the real resolver (process env, .env, config, default) and prints
  "<run> <repo> <source>": the value this run uses, the value the repo states (the process env is
  per-invocation and never the repo's), and where that repo value comes from (.env|config|default).`;

function fail(msg) {
  console.error(`brain:config: ${msg}`);
  process.exit(1);
}

/**
 * The migration context every non-upgrade caller uses: config and today's defaults ONLY. A process-env or
 * `.env` value is per-machine, and only `brain:upgrade` may promote one into tracked config (it prints the
 * source, ADR-0038 section 7). At runtime nothing changes: `.env` still wins by precedence.
 */
export function axisContextFor(config, root) {
  return resolveAxisMigrationContext({ config, env: {}, root, envSources: false });
}

export async function main(argv = process.argv.slice(2), root = process.cwd()) {
  const [op, path, value] = argv;
  if (op !== 'get' && op !== 'set' && op !== 'default' && op !== 'resolve') fail(`unknown op '${op ?? ''}'.\n${USAGE}`);
  if (!path || (op === 'set' && value === undefined)) fail(`missing argument.\n${USAGE}`);

  const configPath = join(root, 'brain.config.json');
  if (!existsSync(configPath)) {
    fail(`brain.config.json not found in ${root} — run from the repo root, or run env:init first.`);
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  if (op === 'default') {
    // The one reader for shell callers (install-tools.sh, bootstrap.sh): they must not hand-parse JSON.
    if (!AXES.includes(path)) fail(`unknown axis '${path}' — one of ${AXES.join(', ')}.`);
    console.log(readAxis(config, path).default);
    return;
  }

  if (op === 'resolve') {
    // The shell must not compose its own precedence (#1114 S3.3 review): this is the code the runtime runs.
    if (path !== 'platform' && path !== 'sdd') fail(`unknown axis '${path}' — resolve takes platform or sdd.`);
    const { resolvePlatform } = await import('../harness/platform.mjs');
    const { resolveEngine } = await import('../harness/cli.mjs');
    const resolver = path === 'platform' ? resolvePlatform : resolveEngine;
    const dotenvPath = join(root, '.env');
    const envVars = existsSync(dotenvPath) ? parseEnvFile(readFileSync(dotenvPath, 'utf8')) : {};
    const run = resolver({ env: process.env, envVars, config });
    const repo = resolver({ env: {}, envVars, config });
    const bare = resolver({ env: {}, envVars: {}, config });
    const source = repo !== bare ? '.env' : readAxis(config, path).default !== '' ? 'config' : 'default';
    console.log(`${run} ${repo} ${source}`);
    return;
  }

  if (op === 'get') {
    // NOT validated against deriveKnownPaths, on purpose (#823 cold review,
    // judgment:cold-2): the verb itself writes `schemaVersion`, which no
    // migration's defaults declare — a schema-validated get would refuse to
    // read a key the verb wrote. Reads report what IS; writes gate what MAY
    // BE. The shared half is the SAFETY rule: resolvePath refuses hostile
    // segments and reads own-keys only, so nothing arrives via the prototype
    // chain through either op.
    const resolved = resolvePath(config, path);
    if (resolved === undefined) fail(`'${path}' is not set (undefined).`);
    console.log(JSON.stringify(resolved, null, 2));
    return;
  }

  // The migrations and the target version come from the INSTALLED package —
  // the same two inputs brain-upgrade hands migrateConfig, resolved here once
  // and passed in, so the planner stays pure.
  const here = dirname(fileURLToPath(import.meta.url));
  const { migrations } = await import(join(here, '../../core/config-migrations.mjs'));
  const targetVersion = JSON.parse(readFileSync(join(here, '../../../package.json'), 'utf8')).version;

  // The ADR-0038 migration (1.11.1) needs a context; this verb gives it config and today's defaults only (see axisContextFor).
  const axisContext = axisContextFor(config, root);
  const { next, migrationsApplied, refusal } = planConfigWrite({ config, path, value, migrations, targetVersion, axisContext });
  if (refusal) fail(refusal);

  // Atomic: same-directory tmp + rename, so a crash mid-write never leaves a
  // half-file where every other verb reads its config.
  const tmp = `${configPath}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
  renameSync(tmp, configPath);

  const migrated = migrationsApplied.length > 0
    ? ` (migrations applied first: ${migrationsApplied.join(', ')})`
    : ' (no pending migrations)';
  console.log(`brain:config: ✓ set ${path}${migrated}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
