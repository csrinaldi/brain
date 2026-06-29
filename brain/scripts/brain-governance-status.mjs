#!/usr/bin/env node
// brain-governance-status.mjs — Report the current state of all three governance layers.
//
// Reads vcs.provider and project.slug from brain.config.json, probes the VCS
// provider's capability API, and prints a per-consumer status table.
//
// USAGE: npm run brain:governance-status
//
// Output example:
//
//   brain:governance status — owner/repo (github)
//
//     hooks       ON  [universal]
//     brain:audit ON  [universal]
//     platform    available  (branch protection APIs accessible)
//
// The script performs NO action on import — the report runs only when invoked as a
// CLI (the guard at the bottom). Importing this module is side-effect-free.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Read brain.config.json and report governance layer status.
 * Side-effecting (may probe the network) — only ever called from the CLI guard.
 */
export async function reportGovernanceStatus() {
  const configPath = resolve(__dirname, '..', '..', 'brain.config.json');
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error(`brain:governance-status: cannot read brain.config.json — ${e.message}`);
    process.exit(1);
  }

  const provider = config?.vcs?.provider ?? 'unknown';
  const project = config?.project?.slug ?? 'unknown';

  console.log(`\nbrain:governance status — ${project} (${provider})\n`);
  // Hooks and brain:audit are always ON regardless of provider tier.
  console.log('  hooks       ON  [universal]');
  console.log('  brain:audit ON  [universal]');
  console.log('  pre-receive available  [bypass-proof self-hosted hard gate — npm run brain:protect-server]');

  if (!config?.vcs?.provider) {
    console.log('  platform    UNKNOWN (vcs.provider not configured)');
    console.log('');
    return;
  }

  let providerModule;
  try {
    providerModule = await import(`./vcs/providers/${provider}.mjs`);
  } catch (e) {
    console.log(`  platform    UNKNOWN (cannot load provider "${provider}": ${e.message})`);
    console.log('');
    return;
  }

  if (typeof providerModule.capabilities !== 'function') {
    console.log(`  platform    UNKNOWN (provider "${provider}" does not implement capabilities())`);
    console.log('');
    return;
  }

  const branch = config?.project?.defaultBranch ?? 'main';
  const cap = await providerModule.capabilities({ project, branch });

  if (cap.hardEnforcement === 'available') {
    console.log('  platform    available  (branch protection APIs accessible)');
  } else if (cap.hardEnforcement === 'unavailable') {
    console.log('  platform    UNAVAILABLE');
    if (cap.remedy) console.log(`              → ${cap.remedy}`);
  } else {
    console.log('  platform    unknown');
    if (cap.detail) console.log(`              (${cap.detail})`);
  }
  console.log('');
}

// CLI guard — the report runs ONLY when this file is invoked directly
// (`node brain/scripts/brain-governance-status.mjs` / `npm run brain:governance-status`),
// NEVER on import.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await reportGovernanceStatus();
}
