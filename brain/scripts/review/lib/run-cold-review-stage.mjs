// run-cold-review-stage.mjs — the cold review, run as a stage (#682 slice 3, B.5).
//
// Resolve the engine → build the role → make the directory → CLEAR THE PREVIOUS
// ARTIFACT → spawn in the cold worktree → check that the artifact is there.
//
// The clearing step and the check are ONE mechanism, added at different times:
// the check landed in B.5 and the clearing in D.5, after #682's own cold review
// found that without it the check could not tell "the engine wrote this" from
// "a previous round left it here" (judgment:cold-1). Read them together — the
// check is what the clearing is for, and the clearing is what makes the check
// mean anything on the second review of a PR, which is the normal case.
//
// The check earns its place because the failure it catches is a fold rather
// than a crash:
//
//   An engine that exits 0 and writes nothing leaves no artifact. One layer down,
//   `makeArtifactGenerate` reads "no artifact" as `null`, the caller supplies no
//   `generate`, and the verdict says "enabled but no transport is configured" —
//   WORD FOR WORD what a repo that never routed the stage is told. So a silent
//   no-op engine and a repo that opted out render identically, and the operator
//   who configured the stage is told they did not.
//
//   That is #552's fold — "it broke" collapsed into "there was nothing to do" —
//   re-created one layer up by a producer instead of a runner. It is checked HERE
//   because here is the only layer that knows the stage was asked to run at all.
//
// IT TOUCHES GIT ZERO TIMES, and that is REQ-S3-3's second half. Committing the
// artifact would move the head the verdict binds itself to, and §10 would then
// make the verdict stale against its own commit — a review that invalidates
// itself by recording that it happened. The guarantee is structural (this module
// imports nothing that can commit) but "it performs no git operations" is a claim
// about an ABSENCE, and an absence asserted in a comment is not checked. So the
// test runs the whole thing inside a real git repository and reads
// `git status --porcelain` afterwards: exactly one entry, untracked, at the
// artifact's path, with HEAD and the index unmoved.
//
// THERE IS NO DEFAULT `runStage`, DELIBERATELY. Defaulting to the `claude`
// backend would mean a repo routing `sdd.map['cold-review'].engine` to anything
// else gets claude anyway — a silent degradation, which is precisely what B.6
// exists to forbid. Rather than ship that for one commit and forbid it in the
// next, the seam is required and the resolution lands in B.6 with its refusal.

import { join, dirname } from 'node:path';
import { mkdirSync, existsSync, rmSync } from 'node:fs';

import { COLD_REVIEW_STAGE, resolveStageEngine } from '../../lib/stage-engine.mjs';
import { buildColdReviewPrompt } from './cold-review-prompt.mjs';
import { artifactPathFor } from './findings-artifact.mjs';

/**
 * runColdReviewStage() — runs the cold review for one PR.
 *
 * @param {{config: object, prNumber: number|string, baseRef?: string|null,
 *          headRef?: string|null, root?: string,
 *          deps?: {runStage: Function, mkdir?: Function, exists?: Function}}} args
 * @returns {Promise<{routed: false} | {routed: true, ok: false, reason: string}
 *                  | {routed: true, ok: true, artifactPath: string}>}
 * @throws {Error} when `sdd.map` names the stage unreadably (resolveStageEngine),
 *   when the PR number is not one, or when no `runStage` seam was supplied
 */
export async function runColdReviewStage({
  config,
  prNumber,
  baseRef = null,
  headRef = null,
  root = process.cwd(),
  worktreePath = null,
  deps = {},
} = {}) {
  const { runStage } = deps;
  if (typeof runStage !== 'function') {
    throw new Error(
      'run-cold-review-stage: no runStage seam was supplied. There is no default on purpose — ' +
      'defaulting to one backend would hand it every engine a repo routes to, which is the ' +
      'silent degradation B.6 forbids.'
    );
  }
  const mkdir = deps.mkdir ?? ((abs) => mkdirSync(abs, { recursive: true }));
  const exists = deps.exists ?? ((abs) => existsSync(abs));
  // `force` so an absent file is not an error — the common case is a first run.
  // Everything else (a directory at the path, a permission failure) throws, and
  // the caller below turns that into a refusal rather than a silent pass.
  const remove = deps.remove ?? ((abs) => rmSync(abs, { force: true }));

  // Throws on an entry that exists and cannot be read; `null` when the repo
  // routed nothing. Unrouted is NOT a failure — the caller renders it as the
  // no-transport state that ships today.
  const routing = resolveStageEngine(config, COLD_REVIEW_STAGE);
  if (routing === null) return { routed: false };

  // Before the prompt, because `artifactPathFor` is the boundary that refuses a
  // PR number that is not one, and the prompt is built from its answer.
  const artifactPath = artifactPathFor(prNumber);

  // The engine is told to write a file; nothing guarantees its tooling creates
  // parents. Recursive, so an existing directory from a previous round is not an
  // error — re-running a review is normal, and #495's rev counter is what makes
  // rounds distinguishable, not the filesystem.
  mkdir(dirname(join(root, artifactPath)));

  // THE ARTIFACT IS REMOVED BEFORE THE SPAWN, AND THAT IS WHAT MAKES THE CHECK
  // BELOW MEAN ANYTHING (judgment:cold-1).
  //
  // The presence check was a bare `exists`, so it could not tell "the engine
  // wrote this" from "a previous round left it here". Re-review is the NORMAL
  // case — §7 counts revisions precisely because it happens, and the mkdir
  // above is recursive for the same reason — so on every review after the
  // first, an engine that exited 0 and wrote nothing passed, and the verdict
  // for the NEW head declared the judgment control applied over findings
  // produced against an older one. The guard only ever held on a fresh repo,
  // which is exactly the shape its own test used.
  //
  // Deleting is the cheap half of the fix and the honest one: after this line,
  // a file at that path was written by THIS run, with no clock, no mtime and no
  // resolution to trust. The cost is that a failed run leaves no artifact to
  // inspect — accepted, because the artifact is already ruled ephemeral (it is
  // `.gitignore`d, and the verdict posted on the PR is the durable record).
  //
  // A REMOVAL THAT FAILS IS A REFUSAL. Continuing would run the engine with the
  // stale file still there and land back in the state this exists to prevent —
  // and the operator would be told the engine wrote nothing, which would be a
  // lie about a file the engine never got the chance to replace.
  try {
    remove(join(root, artifactPath));
  } catch (err) {
    return {
      routed: true,
      ok: false,
      reason:
        `the stage could not clear the previous artifact at ${artifactPath} — ${err?.message ?? String(err)}. ` +
        'Refusing rather than running: with a stale file in place, an engine that wrote nothing would ' +
        'look exactly like one that did its job, and the verdict would declare a control it applied ' +
        'to findings from an older head.',
    };
  }

  // THE ENGINE READS THE COLD WORKTREE, AND REFUSING IS THE POINT (judgment:cold-3).
  //
  // ADR-0033 states the producer's load-bearing property as "the subagent reads
  // a cold worktree and writes a file", and design.md D6 says the generator
  // reads the diff from that worktree. It used to get `root` — the operator's
  // checked-out tree, an arbitrary branch with arbitrary uncommitted changes —
  // while the verdict bound itself to `headRef`. The divergence was SILENT
  // because `git diff BASE...HEAD` still resolves there: the range was right and
  // the file contents were whatever was on disk.
  //
  // Falling back to `root` when no worktree is supplied would re-create exactly
  // that, so this refuses instead. Same move as `assertRoutableStage`: a
  // property an ADR names is only as good as the thing that keeps it true.
  if (typeof worktreePath !== 'string' || worktreePath.trim() === '') {
    return {
      routed: true,
      ok: false,
      reason:
        'the cold-review stage was given no worktree to read. ADR-0033 makes reading a COLD ' +
        'checkout the producer\'s load-bearing property, and running in the operator\'s tree ' +
        'instead would review an arbitrary branch while the verdict binds itself to the head — ' +
        'silently, because the diff range still resolves. Refusing rather than reviewing the wrong tree.',
    };
  }

  const result = await runStage({
    stage: COLD_REVIEW_STAGE,
    // The artifact path renders ABSOLUTE, into `root`: the engine READS the cold
    // worktree and WRITES where the reader looks. A relative path would land the
    // findings inside the throwaway checkout, and the presence check below would
    // then report "wrote no artifact" about a file written perfectly.
    prompt: buildColdReviewPrompt({ prNumber, baseRef, headRef, artifactRoot: root }),
    model: routing.model,
    engine: routing.engine,
    cwd: worktreePath,
  });

  if (!result?.ok) {
    return {
      routed: true,
      ok: false,
      reason: result?.reason ?? 'the engine returned no result',
    };
  }

  // See the header: a clean exit with no artifact is the state that would
  // otherwise render as "you never configured this".
  if (!exists(join(root, artifactPath))) {
    return {
      routed: true,
      ok: false,
      reason:
        `the engine exited cleanly but wrote no artifact at ${artifactPath} — that is a ` +
        'transport that ran and produced nothing, and it must not render as a repo that ' +
        'never routed the stage.',
    };
  }

  return { routed: true, ok: true, artifactPath };
}
