#!/usr/bin/env node
// brain-upgrade.mjs — Install/update the brain core in a consumer repo.
// Usage: npm run brain:upgrade -- <tag> [--dry-run] [--no-install] [--force]
//
// What it does (ADR-0006):
//   1. Installs the requested tag:  npm i -D git+https://github.com/csrinaldi/brain.git#<tag>
//      (skip with --no-install if node_modules/brain is already the right tag).
//   2. Copies ONLY the managed paths (brain/core/**, scripts/**, .gitattributes)
//      from node_modules/brain/ into this repo, overwriting them.
//   3. Migrates brain.config.json additively — new keys are added, existing
//      values are never overwritten.
//
// What it NEVER does: touch brain/project/**, brain.config.json values, .env,
// openspec/changes/**, or .memory/**. core is read-only in the consumer
// (ADR-0003). The upgrade is NOT auto-applied anywhere — you run it on purpose
// (anti-pattern: instaladores-autoactualizantes-no-inocuos).

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { copyManaged, migrateConfig, installSpec } from './lib/installer.mjs';
import { detectPM } from './lib/pm.mjs';

const ROOT = process.cwd();
const PM = detectPM(ROOT).name;

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', red: '\x1b[31m',
};
const ok = (m) => console.log(`  ${C.green}✓${C.reset} ${m}`);
const warn = (m) => console.warn(`  ${C.yellow}⚠${C.reset} ${m}`);
const info = (m) => console.log(`  ${C.cyan}ℹ${C.reset}  ${m}`);
const die = (m) => { console.error(`  ${C.red}✗${C.reset} ${m}`); process.exit(1); };

// ── Parse args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const tag = args.find((a) => !a.startsWith('--'));
const dryRun = flags.has('--dry-run');
const noInstall = flags.has('--no-install');
const force = flags.has('--force');

if (!tag && !noInstall) {
  die(`missing <tag>. Usage: ${PM} run brain:upgrade -- v0.1.0 [--dry-run] [--no-install] [--force]`);
}

// ── Self-host guard ──────────────────────────────────────────────────────────
// Running this inside the brain repo itself would copy node_modules/brain over
// the working tree — almost never what you want. Refuse unless --force.
const ownPkgPath = join(ROOT, 'package.json');
if (existsSync(ownPkgPath)) {
  try {
    const ownPkg = JSON.parse(readFileSync(ownPkgPath, 'utf8'));
    if (ownPkg.name === 'brain' && !force) {
      die(
        'this looks like the brain repo itself (package.json name === "brain").\n' +
        '    brain:upgrade is for CONSUMER repos. Use --force only if you really mean it.',
      );
    }
  } catch { /* unreadable package.json — let the install step report it */ }
}

console.log(`\n${C.bold}brain:upgrade${C.reset} ${tag ? `→ ${C.cyan}${tag}${C.reset}` : ''}${dryRun ? `  ${C.dim}(dry run)${C.reset}` : ''}\n`);

// ── 1. Install the tag ─────────────────────────────────────────────────────────
// Derive the install specifier from the currently installed brain's package.json
// repository.url (always normalized to git+https://…) so HTTPS-only consumers
// (CI, containers without an SSH key) can install the private repo reliably.
// Falls back to the canonical constant when the file/field is absent.
const spec = installSpec(ROOT, tag);
const pm = detectPM(ROOT);
if (!noInstall) {
  if (dryRun) {
    info(`would run: ${[...pm.installArgs, spec].join(' ')}`);
  } else {
    info(`Installing ${spec} ...`);
    const r = spawnSync(pm.installArgs[0], [...pm.installArgs.slice(1), spec], { stdio: 'inherit', cwd: ROOT });
    if (r.status !== 0) die(`${pm.name} install failed — check repo access and that the tag exists.`);
    ok('Package installed.');
  }
}

// ── 2. Copy managed paths ───────────────────────────────────────────────────────
const pkgRoot = join(ROOT, 'node_modules', 'brain');
if (!existsSync(pkgRoot)) {
  die(`node_modules/brain not found — install brain first (drop --no-install).`);
}

const { managed, local } = await import(join(pkgRoot, 'brain', 'core', 'managed-paths.mjs'));
const { copied, skipped } = copyManaged({ srcRoot: pkgRoot, destRoot: ROOT, managed, local, dryRun });

if (dryRun) {
  info(`would copy ${copied.length} managed file(s):`);
  for (const f of copied) console.log(`      ${C.dim}${f}${C.reset}`);
} else {
  ok(`Copied ${copied.length} managed file(s) (brain/core, scripts, .gitattributes).`);
}
if (skipped.length) {
  warn(`Skipped ${skipped.length} path(s) that overlap local ownership (local wins):`);
  for (const f of skipped) console.log(`      ${C.dim}${f}${C.reset}`);
}

// ── 3. Migrate brain.config.json (additive) ─────────────────────────────────────
const configPath = join(ROOT, 'brain.config.json');
const { migrations } = await import(join(pkgRoot, 'brain', 'core', 'config-migrations.mjs'));
const installedVersion = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')).version;

if (!existsSync(configPath)) {
  warn(`brain.config.json not found — skipping migration. Create it and re-run, or run env:init.`);
} else {
  const current = JSON.parse(readFileSync(configPath, 'utf8'));
  const { config: migrated, applied } = migrateConfig(current, migrations, installedVersion);
  if (dryRun) {
    info(applied.length
      ? `would apply config migration(s): ${applied.join(', ')}`
      : 'config already up to date — no migrations pending.');
  } else if (applied.length) {
    writeFileSync(configPath, JSON.stringify(migrated, null, 2) + '\n');
    ok(`Applied config migration(s): ${applied.join(', ')} (schemaVersion → ${migrated.schemaVersion}).`);
  } else {
    // Still persist schemaVersion bump if it advanced without key changes.
    if (migrated.schemaVersion !== current.schemaVersion) {
      writeFileSync(configPath, JSON.stringify(migrated, null, 2) + '\n');
    }
    ok('Config already up to date — no migrations pending.');
  }
}

console.log(`\n${C.green}Done.${C.reset} Review the diff and commit. ${C.dim}core is read-only — improvements go upstream.${C.reset}`);
console.log(`${C.dim}Tip:${C.reset} run ${C.cyan}npm run env:init${C.reset} to (re)configure git hooks (${C.dim}core.hooksPath${C.reset} is per-clone, not committed) and the environment. ${C.dim}day:start also self-heals it.${C.reset}\n`);
