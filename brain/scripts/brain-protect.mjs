#!/usr/bin/env node
// brain-protect.mjs — One-time operator command to activate branch protection on main.
//
// Reads vcs.provider and project.slug from brain.config.json, then calls the
// provider's branchProtect verb with the current governance check contexts.
//
// USAGE: npm run brain:protect
//
// IMPORTANT: This script is a one-time ADMIN action, not a per-developer step.
// Run it ONCE after S3 merges to the tracker branch, after all open non-compliant
// branches have been merged, rebased, or explicitly documented as exceptions.
// See ADR-0014 and brain/core/methodology/workflow-governance.md.
//
// The command is idempotent — re-running refreshes protection without side effects.
// It performs NO action on import — the activation runs only when invoked as a CLI
// (the guard at the bottom). Importing this module is side-effect-free.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkContexts } from './vcs/governance-checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Activate branch protection on main via the configured VCS provider.
 * Side-effecting (network) — only ever called from the CLI guard below.
 */
export async function activateProtection() {
  const configPath = resolve(__dirname, '..', '..', 'brain.config.json');
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error(`brain:protect: cannot read brain.config.json — ${e.message}`);
    process.exit(1);
  }

  const provider = config?.vcs?.provider;
  const project = config?.project?.slug;

  if (!provider) {
    console.error('brain:protect: vcs.provider not set in brain.config.json');
    process.exit(1);
  }
  if (!project) {
    console.error('brain:protect: project.slug not set in brain.config.json');
    process.exit(1);
  }

  let providerModule;
  try {
    providerModule = await import(`./vcs/providers/${provider}.mjs`);
  } catch (e) {
    console.error(`brain:protect: cannot load provider "${provider}" — ${e.message}`);
    process.exit(1);
  }

  if (typeof providerModule.branchProtect !== 'function') {
    console.error(`brain:protect: provider "${provider}" does not implement branchProtect`);
    process.exit(1);
  }

  const checks = checkContexts();
  console.log(`Activating branch protection on ${project} (provider: ${provider})`);
  console.log(`  Required checks: ${checks.join(', ')}`);

  let result;
  try {
    result = await providerModule.branchProtect({ project, checks });
  } catch (e) {
    // branchProtect should not throw in the v2 adapter, but guard against
    // unexpected runtime errors (e.g. network timeout, unhandled edge case).
    console.error(`brain:protect failed unexpectedly: ${e.message}`);
    process.exit(1);
  }

  if (result.enforced) {
    console.log('Branch protection activated successfully.');
  } else {
    console.log('Branch protection could not be enforced.');
    console.log(`  Reason : ${result.reason ?? 'unknown'}`);
    if (result.remedy) console.log(`  Remedy : ${result.remedy}`);
    // Exit 0 — {enforced:false} is a known, non-error outcome (e.g. tier limitation).
    // Reserve exit 1 for configuration errors and unexpected failures above.
  }
}

// CLI guard — the activation runs ONLY when this file is invoked directly
// (`node brain/scripts/brain-protect.mjs` / `npm run brain:protect`), NEVER on import.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await activateProtection();
}
