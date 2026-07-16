#!/usr/bin/env node
// cli.mjs — REQ-H1-5: `brain:review` CLI skeleton. Wires
// identity → cold-boot → (H1-1 skeleton verdict) → print. H1-1 has NO poster
// yet (H1-2) — every run makes zero write calls, dry-run or not.
// `queue`/`board` dispatch land in H1-5 (design.md §9).

import { pathToFileURL } from 'node:url';

import { loadBrainConfig } from '../lib/brain-config.mjs';
import { gatherIdentity } from './identity.mjs';
import { gatherColdBoot } from './cold-boot.mjs';
import { buildVerdict, renderVerdict } from './verdict.mjs';

/** @returns {{ pr: number|null, mode: string, dryRun: boolean }} */
export function parseArgs(argv) {
  const args = { pr: null, mode: 'auto', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pr') args.pr = Number(argv[++i]);
    else if (argv[i] === '--mode') args.mode = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

/** `deps`: `argv`, `log`, `error`, `project`, `provider`, `identityDeps` (→
 * identity.mjs), `coldBootDeps` (→ cold-boot.mjs). `writeVerbs` is accepted
 * only so tests can assert it is NEVER called — H1-1 has no poster. */
export async function main(deps = {}) {
  const log = deps.log ?? console.log;
  const error = deps.error ?? console.error;
  const args = parseArgs(deps.argv ?? process.argv.slice(2));
  const project = deps.project ?? loadBrainConfig().project?.slug;

  const identity = await gatherIdentity({ deps: deps.identityDeps ?? {} });
  if (!identity.ok) {
    error(`brain:review: refusing to run — env var "${identity.missingVar}" is not set.`);
    error(`  Get a token: ${identity.patSetupUrl}`);
    error(`  Setup doc: ${identity.setupDocPath}`);
    return 1;
  }

  const boot = await gatherColdBoot({
    project,
    number: args.pr,
    provider: deps.provider,
    reviewerHandle: identity.handle,
    deps: deps.coldBootDeps ?? {},
  });

  if (boot.abstain) {
    log(`brain:review: abstaining — ${boot.reason}`);
    return 0;
  }

  // H1-1 skeleton: tranche/checkpoint/ruling evaluators land in H1-2..H1-4.
  const verdict = buildVerdict({
    headSha: boot.headSha,
    conclusion: 'REVISE',
    priorRevCount: boot.doctrine.priorVerdicts.length,
    findings: [],
    conditions: ['H1-1 skeleton run — tranche/checkpoint/ruling evaluators land in H1-2..H1-4'],
  });

  log(renderVerdict(verdict));
  if (!args.dryRun) log('brain:review: no poster wired yet (H1-2) — nothing was posted.');

  return 0;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  process.exit(await main());
}
