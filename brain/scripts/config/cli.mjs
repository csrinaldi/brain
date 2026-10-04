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
import { AXES, readAxis, diagnoseAxes, tryResolveAxis } from '../lib/axis-config.mjs';
import { readCodeowners } from '../lib/codeowners-drift.mjs';
import { readUserConfig, setUserDefault, UserConfigWriteError } from '../lib/user-config.mjs';
import { t } from '../i18n/t.mjs';
import { detectInstalled } from '../lib/axis-installed.mjs';
import { resolveAxisMigrationContext } from '../lib/axis-migration-context.mjs';

const USAGE = `Usage: npm run brain:config -- get <path>
       npm run brain:config -- set <path> <value>
       npm run brain:config -- default <axis>
       npm run brain:config -- resolve <${AXES.join('|')}>
       npm run brain:config -- diagnose
       npm run brain:config -- user-set <axis>.default <name>
  <path> is dot-separated (e.g. docs.language, sdd.map.cold-review).
  <value> parses as JSON first, bare string on failure.
  default <axis> prints the axis default (${AXES.join('|')}): the ADR-0038 shape, else the legacy key;
  an empty line when undeclared.
  resolve <axis> runs the real resolver (resolveAxis: process env, .env, config, legacy alias; no default) and prints
  "<run> <repo> <run-where> <repo-where>": the value this run uses, the value the repo states (the process env is
  per-invocation and never the repo's; "-" when only the process env states one), and where each comes from
  (process-env|dotenv|config|runtime). Exit 3 when nothing declares the axis, 4 when a declared value is refused.
  user-set writes YOUR user config (BRAIN_HOME or ~/.brain, ADR-0040) and never brain.config.json: <axis> is platform, memory or
  sdd. It refuses a team-locked axis whose team value differs (exit 4), and a memory/sdd axis the team has not declared (exit 3);
  platform is free. The ONE write path of env:init to a person's own layer.
  diagnose prints the axis findings as JSON: [{ axis, code, severity, message, fix }]. Findings, never
  failures: it exits 0. It names selector keys only and never prints .env.`;

/** `resolve` exit codes (bootstrap.sh reads them): nothing declared, and a declared value that is refused. */
export const EXIT_UNDECLARED = 3;
export const EXIT_REFUSED = 4;

function fail(msg) {
  console.error(`brain:config: ${msg}`);
  process.exit(1);
}

/**
 * The migration context every non-upgrade caller uses: config and today's defaults ONLY. A process-env or
 * `.env` value is per-machine, and only `brain:upgrade` may promote one into tracked config (it prints the
 * source, ADR-0038 section 7). An axis a per-machine value states is written UNDECLARED, never as today's default
 * (#1114 S3.4); at runtime nothing changes: `.env` still wins by precedence.
 */
export function axisContextFor(config, root) {
  return resolveAxisMigrationContext({ config, env: process.env, root, envSources: false });
}

export async function main(argv = process.argv.slice(2), root = process.cwd()) {
  const [op, path, value] = argv;
  if (op !== 'get' && op !== 'set' && op !== 'default' && op !== 'resolve' && op !== 'diagnose' && op !== 'user-set') fail(`unknown op '${op ?? ''}'.\n${USAGE}`);
  // user-set with no value is a USAGE error (exit 2) and writes nothing: String(undefined) is the valid-looking provider name "undefined" (#1263 slice 2 review).
  if (op === 'user-set' && (!path || value === undefined || String(value).trim() === '')) {
    console.error(`brain:config: user-set takes <axis>.default and a <name>, none was given.\n${USAGE}`);
    process.exit(2);
  }
  if ((!path && op !== 'diagnose') || (op === 'set' && value === undefined)) fail(`missing argument.\n${USAGE}`);

  const configPath = join(root, 'brain.config.json');
  if (!existsSync(configPath)) {
    fail(`brain.config.json not found in ${root} — run from the repo root, or run env:init first.`);
  }
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (e) { // surfaced: the shell readers keep this line as the cause of their refusal
    fail(`brain.config.json is not valid JSON or cannot be read (${e.message})`);
  }

  if (op === 'diagnose') {
    // The input of #1130's `brain:doctor`: the same findings `brain:governance-status` prints (ADR-0038 section 6).
    const dotenvPath = join(root, '.env');
    const dotenv = existsSync(dotenvPath) ? parseEnvFile(readFileSync(dotenvPath, 'utf8')) : {};
    console.log(JSON.stringify(diagnoseAxes({ config, env: process.env, dotenv, ...readUserConfig({ env: process.env }), installed: detectInstalled(), codeowners: readCodeowners(root) }), null, 2));
    return;
  }

  if (op === 'user-set') {
    // The person's own layer (ADR-0040): never brain.config.json. The team config is only READ, to apply `locked` and to refuse
    // an axis the team never declared (a team decision env:init may not make for them). Platform is free.
    const m = /^(memory|platform|sdd)\.default$/.exec(path);
    if (!m) fail(`user-set takes memory.default, platform.default or sdd.default (the user layer holds no other key), got '${path}'.\n${USAGE}`);
    const axis = m[1];
    const name = String(value).trim();
    const declared = readAxis(config, axis).default;
    if (config[axis]?.locked === true && declared !== '' && name !== declared) {
      const command = `npm run brain:config -- set ${axis}.default ${name}`;
      const { userPath } = readUserConfig({ env: process.env });
      console.error(`brain:config: ${await t('axes.refusal.locked', { axis, value: name, source: userPath })} (${command})`);
      process.exit(EXIT_REFUSED);
    }
    if (axis !== 'platform' && declared === '') {
      console.error(`brain:config: ${await t('bootstrap.axis.teamUndeclared', { axis })}`);
      process.exit(EXIT_UNDECLARED);
    }
    try {
      const { userPath } = setUserDefault(axis, name, { env: process.env });
      console.log(`brain:config: ✓ ${axis}.default = ${name} saved to ${userPath}`);
    } catch (e) {
      if (e instanceof UserConfigWriteError) fail(e.message);
      throw e;
    }
    return;
  }

  if (op === 'default') {
    // The one reader for shell callers (install-tools.sh, bootstrap.sh): they must not hand-parse JSON.
    if (!AXES.includes(path)) fail(`unknown axis '${path}' — one of ${AXES.join(', ')}.`);
    console.log(readAxis(config, path).default);
    return;
  }

  if (op === 'resolve') {
    // The shell must not compose its own precedence (#1114 S3.3 review): this is the code the runtime runs, `resolveAxis`.
    if (!AXES.includes(path)) fail(`unknown axis '${path}' — resolve takes ${AXES.join(', ')}.`);
    const dotenvPath = join(root, '.env');
    const dotenv = existsSync(dotenvPath) ? parseEnvFile(readFileSync(dotenvPath, 'utf8')) : {};
    // The USER layer (ADR-0040) is read once, through the one reader, and belongs to THIS run: the repo value below leaves it out.
    const run = tryResolveAxis(path, { env: process.env, dotenv, config, ...readUserConfig({ env: process.env }) });
    // The REPO value: what the repo states without this invocation's process env or this person's user layer.
    const repo = tryResolveAxis(path, { env: {}, dotenv, config, notice: () => {} });
    // A refusal prints its fix in the active locale; the exit status names the kind: 3 undeclared, 4 refused.
    if (!run.ok) {
      console.error(`brain:config: ${await t(run.refusal.key, run.refusal.params)}`);
      process.exit(run.refusal.code === 'undeclared' ? EXIT_UNDECLARED : EXIT_REFUSED);
    }
    // `<run> <repo> <run-where> <repo-where>`: where is process-env|dotenv|user|config|runtime. A repo that states nothing
    // of its own (only this run's process env does) prints `-` for both repo fields.
    console.log(`${run.value} ${repo.ok ? repo.value : '-'} ${run.where} ${repo.ok ? repo.where : '-'}`);
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
