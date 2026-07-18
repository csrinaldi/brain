#!/usr/bin/env node
// cli.mjs — REQ-H1-5, REQ-H1-7, REQ-H1-8, REQ-H1-9, REQ-H1-10, REQ-H1-11:
// `brain:review` CLI. Wires identity → cold-boot → mode derivation (R6) →
// the tranche/checkpoint/ruling evaluator → verdict → the poster. `ruling`
// (H1-4, Option B — issue #266 comment 5009584044) NEVER auto-rules; a
// well-formed `## FORK` always escalates. `queue`/`board` dispatch land in
// H1-5 (design.md §9).

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { loadBrainConfig } from '../lib/brain-config.mjs';
import { loadContext } from '../vcs/ci-context.mjs';
import { gatherIdentity } from './identity.mjs';
import { gatherColdBoot } from './cold-boot.mjs';
import { buildVerdict, renderVerdict } from './verdict.mjs';
import { deriveMode } from './mode.mjs';
import { evaluateTranche, gatherTrancheInputs } from './evaluators/tranche.mjs';
import { evaluateCheckpoint, gatherCheckpointInputs } from './evaluators/checkpoint.mjs';
import { evaluateRuling, gatherRulingInputs } from './evaluators/ruling.mjs';
import { postVerdict } from './poster.mjs';
import { gatherQueue } from './queue.mjs';
import { runBoard } from './board.mjs';

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

/** `queue` subcommand (H1-5b, task 13.3): dispatches to queue.mjs's
 * gatherQueue, prints the review queue + the escalation inbox. Read-only. */
async function runQueueCommand(deps, log) {
  const project = deps.project ?? loadBrainConfig().project?.slug;
  const { reviewQueue, escalations } = await gatherQueue({
    project,
    provider: deps.provider,
    deps: deps.queueDeps ?? {},
  });

  log(`brain:review:queue — ${reviewQueue.length} PR(s) awaiting review (oldest first, by number):`);
  for (const pr of reviewQueue) log(`  #${pr.number} ${pr.title}`);

  log(`brain:review:queue — ${escalations.length} pending escalation(s) (needs-decision):`);
  for (const pr of escalations) log(`  #${pr.number} ${pr.title}`);

  return 0;
}

/** `board` subcommand (H1-5c, task 13.3b): dispatches to board.mjs's
 * runBoard, reconciles the seq:* and reviewed:* label namespaces across
 * every open PR. */
async function runBoardCommand(deps, log) {
  const project = deps.project ?? loadBrainConfig().project?.slug;
  const results = await runBoard({ project, provider: deps.provider, deps: deps.boardDeps ?? {} });

  for (const r of results) {
    if (r.toAdd.length > 0 || r.toRemove.length > 0) {
      log(`brain:review:board — #${r.number}: +[${r.toAdd.join(', ')}] -[${r.toRemove.join(', ')}]`);
    }
  }
  log(`brain:review:board — reconciled ${results.length} open PR(s).`);

  return 0;
}

function defaultGetChangedFiles({ cwd = process.cwd() } = {}) {
  return (baseSha, headSha) =>
    execFileSync('git', ['diff', '--name-only', `${baseSha}...${headSha}`], { cwd, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
}

/** `deps`: `argv`, `log`, `error`, `project`, `provider`, `identityDeps` (→
 * identity.mjs), `coldBootDeps` (→ cold-boot.mjs), `baseSha` (skips
 * `ci-context.mjs`'s CI-env resolution when injected), `loadCiContext`,
 * `getChangedFiles`, `trancheDeps` (→ evaluators/tranche.mjs), `checkpointDeps`
 * (→ evaluators/checkpoint.mjs — fed cli's one resolved `baseSha`; a
 * `checkpointDeps.baseSha` is a test-side override only, see checkpoint.mjs's
 * docstring), `rulingDeps` (→ evaluators/ruling.mjs), `posterDeps` (→
 * poster.mjs), `writeVerbs` (a spy/real VCS used as the poster's default
 * `getVcs` when `posterDeps.getVcs` is not separately injected), `queueDeps`
 * (→ queue.mjs, `queue` subcommand only), `boardDeps` (→ board.mjs, `board`
 * subcommand only). */
export async function main(deps = {}) {
  const log = deps.log ?? console.log;
  const error = deps.error ?? console.error;
  const rawArgv = deps.argv ?? process.argv.slice(2);

  // Positional subcommand dispatch (H1-5b, task 13.3, design.md §9): the
  // FIRST token, when it is `queue` or `board`, selects an entirely
  // different read path — neither reaches identity/cold-boot/the evaluators
  // below. Anything else (including no subcommand, or a leading `--flag`)
  // falls through to the existing single-PR review flow unchanged.
  if (rawArgv[0] === 'queue') return runQueueCommand(deps, log);
  if (rawArgv[0] === 'board') return runBoardCommand(deps, log);

  const args = parseArgs(rawArgv);
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

  // Mode is derived from repo state, NEVER declared (R6) — an explicit
  // --mode pins it for a manual run; changedFiles feeds both the derivation
  // (checkpoint-report.md detection) and the tranche evaluator's budget/
  // Tier-2 checks, resolved ONCE and shared (design.md §2, §4).
  const loadCiContext = deps.loadCiContext ?? loadContext;
  const ctx = deps.baseSha !== undefined ? null : await loadCiContext();
  // Precedence: an explicit injected deps.baseSha (tests) wins; then
  // ci-context.mjs's CI-env BASE_SHA; then the port's prView.baseRefOid
  // (ADR-0022 Decision 2) — the provider-agnostic default that ALSO serves
  // local runs, where ci-context is unset. `null` here is genuinely
  // uncomputable (no CI env, no port value) and still folds to tranche.mjs's
  // protocol §10 fail-closed rule — this widens the *reach* of the evidence,
  // never relaxes the rule. Closes H1-2C-BASE for the tranche path.
  const baseSha = deps.baseSha !== undefined ? deps.baseSha : ctx?.baseSha ?? boot.prView.baseRefOid ?? null;
  const getChangedFiles = deps.getChangedFiles ?? defaultGetChangedFiles();
  const changedFiles = baseSha ? getChangedFiles(baseSha, boot.headSha) : [];

  const mode = args.mode !== 'auto' ? args.mode : deriveMode({ labels: boot.prView.labels ?? [], changedFiles });

  let evalResult;
  if (mode === 'tranche') {
    const trancheInputs = await gatherTrancheInputs({
      project,
      number: args.pr,
      provider: deps.provider,
      headSha: boot.headSha,
      baseSha,
      changedFiles,
      prBody: boot.prView.body,
      deps: deps.trancheDeps ?? {},
    });
    evalResult = evaluateTranche(trancheInputs);
  } else if (mode === 'checkpoint') {
    const checkpointInputs = await gatherCheckpointInputs({
      project,
      number: args.pr,
      provider: deps.provider,
      headSha: boot.headSha,
      changedFiles,
      prBody: boot.prView.body,
      labels: boot.prView.labels ?? [],
      worktreePath: boot.worktreePath,
      doctrineRecords: boot.doctrine.records,
      // The resolved baseSha (ci-context → port prView.baseRefOid, ADR-0022) feeds
      // the checkpoint seam — takes §10.4 reversion live; checkpointDeps overrides.
      deps: { baseSha, ...(deps.checkpointDeps ?? {}) },
    });
    evalResult = evaluateCheckpoint(checkpointInputs);
  } else if (mode === 'ruling') {
    // ruling (H1-4, REQ-H1-11, Option (B) — issue #266 comment 5009584044):
    // the evaluator NEVER auto-rules; a well-formed ## FORK always
    // escalates to a human (STOP + escalate:'human'), a malformed one
    // REVISEs. No server round trip — the PR body is already cold-booted.
    const rulingInputs = await gatherRulingInputs({
      project,
      number: args.pr,
      prBody: boot.prView.body,
      deps: deps.rulingDeps ?? {},
    });
    evalResult = evaluateRuling(rulingInputs);
  } else {
    // Any other derived/explicit mode is not (yet) implemented. Explicit
    // stub — never a silent no-op or a guessed verdict.
    error(`brain:review: mode "${mode}" is not yet implemented — refusing to guess a verdict.`);
    return 1;
  }

  const verdict = buildVerdict({
    headSha: boot.headSha,
    conclusion: evalResult.conclusion,
    priorRevCount: boot.doctrine.priorVerdicts.length,
    gates: evalResult.gates,
    findings: evalResult.findings,
    conditions: evalResult.conditions,
    // undefined for tranche/checkpoint (they never set these) — buildVerdict's
    // own defaults (`pin` undefined, `escalate` null) apply unchanged, so this
    // is a no-op for those two modes.
    pin: evalResult.pin,
    escalate: evalResult.escalate,
  });

  const rendered = renderVerdict(verdict);
  log(rendered);

  if (args.dryRun) {
    log('brain:review: --dry-run — no write verb invoked.');
    return 0;
  }

  const posterDeps = deps.posterDeps ?? (deps.writeVerbs ? { getVcs: async () => deps.writeVerbs } : {});
  const postResult = await postVerdict({
    headSha: boot.headSha,
    project,
    number: args.pr,
    provider: deps.provider,
    mode,
    renderedBody: rendered,
    reviewerHandle: identity.handle,
    priorVerdicts: boot.doctrine.priorVerdicts,
    escalate: verdict.escalate,
    deps: posterDeps,
  });

  if (postResult.skipped) log(`brain:review: ${postResult.skipped} — nothing posted.`);

  return 0;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  process.exit(await main());
}
