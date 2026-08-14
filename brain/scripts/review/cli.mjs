#!/usr/bin/env node
// cli.mjs — REQ-H1-5, REQ-H1-7, REQ-H1-8, REQ-H1-9, REQ-H1-10, REQ-H1-11:
// `brain:review` CLI. Wires identity → cold-boot → mode derivation (R6) →
// the tranche/checkpoint/ruling evaluator → verdict → the poster. `ruling`
// (H1-4, Option B — issue #266 comment 5009584044) NEVER auto-rules; a
// well-formed `## FORK` always escalates. `queue`/`board` dispatch land in
// H1-5 (design.md §9). Reviewer protocol version (`brain-review/1` vs `/2`)
// is resolved from `governance.tier` (`resolveTier`/`tierParams`,
// governance-tiers.mjs) once per run, per issue #391 T2.3 §3/§5 and issue
// #394 M3 — `regulated` defaults to `/2` and runs its findings through
// `lib/causal-admission.mjs` (evidence_class/causal_disposition annotation +
// the lazy refuter, issue #284) before `buildVerdict`; `lite`/`standard`
// default to `/1`, unchanged from pre-#394 behavior.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { loadBrainConfig } from '../lib/brain-config.mjs';
import { loadContext } from '../vcs/ci-context.mjs';
import { getVcs } from '../vcs/cli.mjs';
import { resolveTier, tierParams, resolveReviewProtocol } from '../vcs/governance-tiers.mjs';
import { gatherIdentity } from './identity.mjs';
import { gatherColdBoot } from './cold-boot.mjs';
import { buildVerdict, renderVerdict } from './verdict.mjs';
import { deriveMode } from './mode.mjs';
import { evaluateTranche, gatherTrancheInputs } from './evaluators/tranche.mjs';
import { evaluateCheckpoint, gatherCheckpointInputs } from './evaluators/checkpoint.mjs';
import { evaluateRuling, gatherRulingInputs } from './evaluators/ruling.mjs';
import { applyCausalAdmission } from './lib/causal-admission.mjs';
import { needsBaseProbe, probeBase, BASE_REPRODUCIBLE_GATES } from './lib/base-comparison.mjs';
import { verdictsAtHead } from './lib/parse-verdict.mjs';
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
    // #477 — the report the ruling requires. An unreadable verdict normally has
    // NOTHING to add or remove (freezing the namespace is what stops the writes),
    // so it was the one case that printed nothing at all: the operator read
    // "reconciled N open PR(s)" and never learned a verdict was garbage. Emitted
    // separately from the line above, and unconditionally, because "no label
    // movement" and "no readable verdict" are different facts.
    if (r.unreadable?.length > 0) {
      // The freeze clause is CONDITIONAL. It used to be appended to every
      // report, so a verdict with an unreadable `findings` and a readable
      // `sequencing` printed its label moves and then claimed seq:* had been
      // left untouched — a report overstating its own caution, which fails in
      // the same reassuring direction as the defect this change exists to close.
      const froze = r.unreadable.includes('sequencing') ? ' — seq:* left untouched' : '';
      log(`brain:review:board — #${r.number}: UNREADABLE verdict fields [${r.unreadable.join(', ')}]` +
        `${froze} (protocol §10: never conclude on uncomputable evidence)`);
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
 * docstring), `rulingDeps` (→ evaluators/ruling.mjs), `tier` (test-side
 * override of `resolveTier(config)` — selects the `brain-review/1` vs `/2`
 * protocol via `tierParams(tier).reviewProtocol`, issue #391 T2.3/#394 M3),
 * `refuterRunner` (→ lib/causal-admission.mjs's `applyCausalAdmission`, only
 * consulted at `protocol === 'brain-review/2'`), `probeBase` (→
 * lib/base-comparison.mjs — a SYNCHRONOUS override of the base re-run; returning a
 * promise from it degrades silently to "probed, nothing failed", so the seam's
 * contract is sync and its callers are tested), `posterDeps` (→
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
  const config = loadBrainConfig();
  const project = deps.project ?? config.project?.slug;
  // Reviewer protocol version (issue #391 T2.3 §3, issue #394 M3): the TIER sets
  // the default, and since #442 `reviewer.protocol` in brain.config.json may
  // override it — the D5 middle path, which exists because brain cannot declare
  // `regulated` (at that tier `actor-check` is unsatisfiable at n=1, the #329
  // contradiction) and `/2` still had to be dogfooded rather than only tested.
  // `deps.tier` remains a TEST-only override (mirrors trancheDeps.tier's own
  // convention), never a production seam; the config override is the production one.
  // `resolveTier`/`resolveReviewProtocol` are pure (governance-tiers.mjs) — this is
  // still the ONE call site (design.md §2.2) that produces the `protocol`
  // `buildVerdict` receives below.
  //
  // BOTH resolutions can THROW on an explicit unknown value, and the refusal is
  // caught here rather than allowed to escape as a stack trace: a typo in the config
  // must refuse the run with a readable reason and post NOTHING (#382/#413's shape).
  // Falling back to a default would hand the operator a `/1` verdict while they
  // believed they had `/2` — silently dropping causal admission.
  let tier;
  let protocol;
  try {
    tier = deps.tier ?? resolveTier(config);
    protocol = resolveReviewProtocol(config, tier);
  } catch (err) {
    error(`brain:review: refusing to run — ${err.message}`);
    return 1;
  }

  const identity = await gatherIdentity({ deps: deps.identityDeps ?? {} });
  if (!identity.ok) {
    if (identity.missingVar) {
      error(`brain:review: refusing to run — env var "${identity.missingVar}" is not set.`);
      error(`  Get a token: ${identity.patSetupUrl}`);
      error(`  Setup doc: ${identity.setupDocPath}`);
    } else if (identity.ambientIdentity) {
      // #604 half 1: the negative control resolved. An invalid token produced
      // an identity, so credentials are injected upstream and `whoami({token})`
      // reports the ENVIRONMENT's login rather than the token's. Refused here
      // rather than as a `mismatch`, which is the shape that cost three token
      // rotations — the message must name the environment, not the token.
      error(`brain:review: refusing to run — this environment resolved a deliberately INVALID token to "${identity.ambientIdentity}".`);
      error('  Credentials are being injected upstream (a proxy, or an ambient CLI session), so a');
      error(`  token-scoped identity read cannot establish who ${identity.tokenEnv} belongs to (issue #604).`);
      error('  Rotating the token cannot fix this — the token is never what answers.');
      error('  Run brain:review where credentials are not injected: the maintainer machine, or CI with the PAT as a secret.');
    } else if (identity.controlError) {
      // #604: the control could not reach a verdict. Scoring that as "clean"
      // would be the reader-empty-on-failure defect the control exists to avoid.
      error(`brain:review: refusing to run — could not establish whether this environment honours the reviewer token: ${identity.controlError}`);
      error('  The negative control did not reach a verdict, and "could not establish" is not "established clean" (issue #604).');
    } else if (identity.mismatch) {
      // #413: the token's REAL login disagrees with the configured handle —
      // proceeding would run the §10 abstention and the anti-loop lock
      // against a claimed identity, which is exactly the forgery the ticket
      // reproduces (author token + bot handle → self-review passes).
      error(`brain:review: refusing to run — the reviewer token belongs to "${identity.mismatch.actual}", but reviewer.handle claims "${identity.mismatch.claimed}".`);
      error('  §10 abstention and the anti-loop lock would compare a claimed identity, not a real one (issue #413).');
      error(`  Point ${identity.tokenEnv} at the reviewer identity's token, or fix reviewer.handle.`);
    } else {
      // #413: whoami rejected — identity uncomputable. Same discipline as
      // §10's "uncomputable evidence": never proceed unverified.
      error(`brain:review: refusing to run — could not verify the reviewer identity against the token: ${identity.verifyError}`);
      error('  Never proceed on an unverified identity (§10 fail-closed, issue #413).');
    }
    return 1;
  }

  // §10 Self-review — FAIL CLOSED on an unset handle (issue #382).
  //
  // This was deliberately fail-open (a loud warning) while `reviewer.handle`
  // still shipped empty: pre-task-7.3 the reviewer ran under the operator's
  // own identity, so a strict guard would have abstained from everything.
  // Task 7.3 landed (#367 registered the reviewer identity; the config now
  // carries a handle), which retires that premise — an empty handle is now a
  // misconfiguration, not the expected state.
  //
  // Fail closed rather than abstain-silently: without a handle BOTH §10
  // self-review abstention and the anti-loop lock (poster.mjs compares
  // `lastVerdict.author` to the reviewer handle) are inert, so proceeding
  // would post an unbounded verdict under an unverifiable identity. Refusing
  // at boot mirrors the missing-token refusal above — same shape, same exit.
  if (!identity.handle) {
    error('brain:review: refusing to run — reviewer.handle is not configured.');
    error('  Without it the §10 self-review abstention and the anti-loop lock are both inert.');
    error('  Set reviewer.handle in brain.config.json to the reviewer identity (see ADR-0020).');
    return 1;
  }

  // #501: every server call this run makes — read AND write — goes through a port
  // BOUND to the token `gatherIdentity` just verified. The SAME value, threaded;
  // never a second read of the env var, because a second read is a second chance
  // to differ from the one that was checked.
  //
  // Before this the token reached `whoami` and nothing else. The reviewer verified
  // as `csrinaldibot` and posted as whoever `gh` was logged in as (measured on PR
  // #500, review 4887057484), so the two-key split was checked and not enforced —
  // and `poster.mjs`'s anti-loop lock then compared the verdict's author against a
  // handle that never reached the wire.
  //
  // Reads are bound too, deliberately: a port reading under one credential and
  // writing under another can report on a repository it is not writing to.
  const boundGetVcs = (opts = {}) => getVcs({ ...opts, identity: identity.token });

  const boot = await gatherColdBoot({
    project,
    number: args.pr,
    provider: deps.provider,
    reviewerHandle: identity.handle,
    deps: deps.coldBootDeps ?? { getVcs: boundGetVcs },
  });

  if (boot.abstain) {
    log(`brain:review: abstaining — ${boot.reason}`);
    return 0;
  }

  // #477 — the consumer of `doctrine.unreadableVerdicts`. Without this the field
  // was a name with no reader: an unreadable prior verdict behaved at runtime
  // exactly as before, which is the "flag nobody reads" outcome the ruling
  // refused. This run derives its rev count and its anti-loop decision from that
  // thread, so the operator reading this output is the one who needs to know a
  // member of it could not be read. Reported, never acted on automatically —
  // the verdict still counts as an iteration (see cold-boot.mjs).
  for (const v of boot.doctrine.unreadableVerdicts ?? []) {
    log(`brain:review: UNREADABLE prior verdict at head ${v.head_sha} by ${v.author ?? 'unknown'} — ` +
      `fields [${v.malformed.join(', ')}] could not be read; it still counts toward the §7 rev bound`);
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
      tier,   // #555: the artifact set is tier-resolved; cli.mjs already has it
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

  // brain-review/2 causal admission (issue #394 M3, completing #284): ONLY at
  // `protocol === 'brain-review/2'` (regulated tier's default, see above) do
  // findings get evidence_class/causal_disposition annotated and the refuter
  // run over them — a `brain-review/1` verdict (lite/standard's default)
  // renders neither field, exactly as before this wiring landed (renderVerdict
  // only emits `evidence_class`/`causal_disposition` `if (f.evidence_class)` /
  // `if (f.causal_disposition)` — never gated on protocol itself, so leaving
  // `/1` findings unannotated is what keeps `/1` output byte-for-byte
  // unchanged). See lib/causal-admission.mjs for why 'deterministic' /
  // 'introduced' are the safe defaults for tranche/checkpoint/ruling's
  // mechanically-derived findings.
  let { findings, escalate } = evalResult;
  let baseConditions = [];
  if (protocol === 'brain-review/2') {
    // #408 — the base probe is LAZY and it is expensive on purpose. It re-runs
    // `local-checks` in a worktree at base, which is the slowest thing the reviewer
    // can do, and it only happens when a gate it can speak to is ALREADY a blocker:
    // the PR is stopped and a human is about to be summoned, so paying ~a minute to
    // tell them "this is not your change's doing" is the cheap side of the trade. A
    // green PR never pays it, and neither does a PR blocked for any other reason.
    let baseProbe = null;
    let probeAttempted = false;
    if (needsBaseProbe(evalResult.findings)) {
      probeAttempted = true;
      const runProbe = deps.probeBase ?? probeBase;
      baseProbe = runProbe({
        baseSha,
        gates: BASE_REPRODUCIBLE_GATES,
      });
    }
    ({ findings, escalate, conditions: baseConditions } = await applyCausalAdmission({
      findings: evalResult.findings,
      escalate: evalResult.escalate,
      runner: deps.refuterRunner ?? null,
      baseProbe,
      probeAttempted,
    }));
  }

  const verdict = buildVerdict({
    headSha: boot.headSha,
    conclusion: evalResult.conclusion,
    protocol,
    // #506 — at THIS head, not over the PR's lifetime. One definition, shared with
    // the anti-loop lock in poster.mjs.
    priorRevCount: verdictsAtHead(boot.doctrine.priorVerdicts, boot.headSha).length,
    rulingAtHead: (boot.doctrine.priorDecisions ?? []).some(d => d?.head_sha === boot.headSha),
    gates: evalResult.gates,
    findings,
    // #408 — the base probe's own inability to run is a condition of THIS verdict,
    // appended to the evaluator's rather than replacing it: two different things
    // could not be computed and a reader needs to see both.
    conditions: [...evalResult.conditions, ...baseConditions],
    // undefined for tranche/checkpoint (they never set these) — buildVerdict's
    // own defaults (`pin` undefined, `escalate` null) apply unchanged, so this
    // is a no-op for those two modes.
    pin: evalResult.pin,
    escalate,
  });

  const rendered = renderVerdict(verdict);
  log(rendered);

  if (args.dryRun) {
    log('brain:review: --dry-run — no write verb invoked.');
    return 0;
  }

  // The poster gets the SAME bound port the cold boot read through (#501) — the
  // verdict is written under the identity that was verified, so the anti-loop
  // lock's `lastVerdict.author === reviewerHandle` becomes a true statement by
  // construction rather than by the two happening to be configured alike.
  const posterDeps =
    deps.posterDeps ??
    (deps.writeVerbs ? { getVcs: async () => deps.writeVerbs } : { getVcs: boundGetVcs });
  const postResult = await postVerdict({
    headSha: boot.headSha,
    project,
    number: args.pr,
    provider: deps.provider,
    mode,
    renderedBody: rendered,
    reviewerHandle: identity.handle,
    priorVerdicts: boot.doctrine.priorVerdicts,
    // #405: the BUILT verdict's `findings`, and DELIBERATELY not its `follow_ups`.
    //
    // Two exclusions, and they have different reasons. Evidence-less findings are
    // dropped by `buildVerdict` and never appear in the block at all, so anchoring
    // one would put text on the diff that the posted verdict does not support.
    //
    // `follow_ups` is the harder case, because those findings ARE in the block —
    // the round-4 cold review found this comment claiming otherwise. They are
    // excluded on their own merit: a follow-up is `pre-existing` or `base-only`,
    // which is precisely the claim that it is NOT this change's doing. Anchoring
    // one would put a comment on a line in THIS author's diff about a defect the
    // verdict itself says they did not introduce — the causal-admission rule
    // (reviewer-protocol §6.2) inverted at the point where a human reads it.
    // They stay in the summary block, where the annotation that makes them
    // non-blocking travels with them.
    findings: verdict.findings,
    escalate: verdict.escalate,
    deps: posterDeps,
  });

  if (postResult.skipped) log(`brain:review: ${postResult.skipped} — nothing posted.`);
  // REQ-405-4: the count has to reach a READER, not just the caller. An anchor
  // that is dropped, counted, and then never printed is the same silence the
  // requirement exists to break — the run would look identical to one that had
  // nothing to anchor in the first place.
  if (postResult.inlineDropped) {
    log(`brain:review: ${postResult.inlineDropped} inline comment(s) could not be anchored — the finding text is in the summary block above.`);
  }

  return 0;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  process.exit(await main());
}
