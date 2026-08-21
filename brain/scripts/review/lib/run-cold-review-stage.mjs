// run-cold-review-stage.mjs — the cold review, run as a stage (#682 slice 3, B.5).
//
// Resolve the engine → build the role → make the directory → spawn → check that
// the artifact is actually there. That last step is the one that earns its place,
// and the reason is a fold rather than a crash:
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
import { mkdirSync, existsSync } from 'node:fs';

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

  const result = await runStage({
    stage: COLD_REVIEW_STAGE,
    prompt: buildColdReviewPrompt({ prNumber, baseRef, headRef }),
    model: routing.model,
    engine: routing.engine,
    cwd: root,
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
