#!/usr/bin/env node
// cli.mjs — brain:approve, a read-confirm-post signature over the CURRENT
// diff (issue #473, design.md §F).
//
// Usage: npm run brain:approve -- [<pr-number>]
//
//   1. Refuses on a non-TTY, before anything is read from the network.
//   2. Resolves the caller's identity via `whoami` on AMBIENT credentials —
//      the SAME credentials the post will use (design.md §F3: no new token
//      env var, no port-shape change). Refuses if that identity is
//      registered in `governance.reviewActors` (deny-before-allow, the
//      write-side twin of L5's read rule 15).
//   3. Resolves the PR's head commit and composes a `brain-decision/1
//      APPROVE` block (review/lib/decision-block.mjs's renderDecision).
//   4. Shows the human exactly what they are signing and requires a TYPED
//      confirmation — the literal word SIGN, never a single letter.
//   5. Re-reads the head immediately before posting; refuses if it moved
//      (anti-stale, same seam shape as review/poster.mjs's `reResolveHead`).
//   6. Posts via the EXISTING `prReviewComment` verb — no `event`, no
//      `comments`, no label writes. No new port verb exists (ADR-0020
//      Locks 1-3 stay intact; VERBS in vcs/cli.mjs is untouched).
//   7. Post-then-verify: re-reads `prReviews()` and confirms the LANDED
//      review's author equals the block's declared `actor` before ever
//      printing a success marker or the PR url.
//
// ─────────────────────────────────────────────────────────────────────────────
// Four structural locks, drift-guarded by approve/locks.test.mjs (mirrors
// brain-promote.locks.test.mjs's shapes — design.md §F2, reused PATTERN):
//   1. Refuses on a non-TTY, before anything is read or written.
//   2. No auto-accept option and no environment read exists — every
//      option-shaped token is a hard abort, not a silent no-op.
//   3. Writes ZERO labels, and never passes an `event` key to
//      `prReviewComment` — the write surface stays exactly what ADR-0020
//      already allows.
//   4. The confirmation is one exact literal word: SIGN.
// ─────────────────────────────────────────────────────────────────────────────

import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { getVcs } from '../vcs/cli.mjs';
import { loadBrainConfig } from '../lib/brain-config.mjs';
import { currentBranch } from '../lib/git-branch.mjs';
import { renderDecision } from '../review/lib/decision-block.mjs';
import { originIdentity } from '../vcs/lib/repo.mjs';
import { gitlabApiConfig } from '../vcs/ci-context.mjs';

// ── Frozen contract ──────────────────────────────────────────────────────────

/** The literal word the human must type. Lock 4.
 * NOT 'APPROVE' — the repo's own review-posting guards scan for that literal
 * around review-posting code (vcs.contract.test.mjs:1670-1737); a confirmation
 * TOKEN spelled the same way invites exactly the false-positive/false-negative
 * confusion that scan exists to prevent (design.md §F4). `SIGN` also names the
 * act correctly: the human signs a diff, the block carries the decision. */
export const CONFIRMATION_WORD = 'SIGN';

/**
 * Parses the verb's arguments. At most ONE positional (a PR number); EVERY
 * option-shaped token is a hard abort. Lock 2 lives here, same shape as
 * brain-promote.mjs's parseArgs.
 *
 * @param {string[]} argv
 * @returns {{ok:true, number:number|null}|{ok:false, error:string}}
 */
export function parseArgs(argv) {
  const options = argv.filter((a) => a.startsWith('-'));
  if (options.length > 0) {
    return {
      ok: false,
      error:
        `brain:approve takes no options — got ${options.join(', ')}.\n` +
        '  There is deliberately no way to skip the confirmation. The typed word IS the gate;\n' +
        '  an option that bypasses it would be a doctrine change requiring an ADR.',
    };
  }
  const positionals = argv.filter((a) => !a.startsWith('-'));
  if (positionals.length > 1) {
    return {
      ok: false,
      error:
        'Usage: npm run brain:approve -- [<pr-number>]\n' +
        `  Expected at most one PR number, got ${positionals.length}.`,
    };
  }
  if (positionals.length === 1 && !/^\d+$/.test(positionals[0])) {
    return {
      ok: false,
      error:
        'Usage: npm run brain:approve -- [<pr-number>]\n' +
        `  "${positionals[0]}" is not a PR number.`,
    };
  }
  return { ok: true, number: positionals.length === 1 ? Number(positionals[0]) : null };
}

/** Reads `governance.reviewActors` (issue #375's DENY list) — the SAME key
 * L5's read side denies against (actor-check.mjs rule 15). Read via
 * `loadBrainConfig`, matching identity.mjs's own config access. Never
 * throws: an unreadable/missing config denies nobody. */
function defaultReadDenyActors() {
  try {
    const config = loadBrainConfig();
    return Array.isArray(config?.governance?.reviewActors) ? config.governance.reviewActors : [];
  } catch {
    return [];
  }
}

/**
 * Runs the read-confirm-post flow (design.md §F1).
 *
 * @param {object} ctx
 * @param {string[]} ctx.argv
 * @param {boolean} ctx.isTTY
 * @param {string} ctx.project           owner/repo (or group/path) slug.
 * @param {string} [ctx.provider]
 * @param {Function} [ctx.getVcsFn]      async ({provider}) => vcs
 * @param {Function} [ctx.readDenyActorsFn]  () => string[]
 * @param {Function} [ctx.branchFn]      () => string|null — current branch, only consulted when no PR number is given.
 * @param {Function} ctx.readLineFn      async () => string|null|undefined — reads the typed confirmation.
 * @param {Function} [ctx.nowFn]         () => string ISO-8601, for the block's `at` field.
 * @param {Function} [ctx.write]         (chunk) => void
 * @returns {Promise<{exitCode:number, output:string, url?:string}>}
 */
export async function runApprove({
  argv,
  isTTY,
  project,
  provider,
  getVcsFn = getVcs,
  readDenyActorsFn = defaultReadDenyActors,
  branchFn,
  readLineFn,
  nowFn = () => new Date().toISOString(),
  write = () => {},
}) {
  let output = '';
  const say = (chunk) => {
    output += `${chunk}\n`;
    write(`${chunk}\n`);
  };
  const done = (exitCode, extra = {}) => ({ exitCode, output, ...extra });

  // ── LOCK 1 — before anything is read, before any network call ──────────────
  if (!isTTY) {
    say('✗ brain:approve requires an interactive terminal (stdin is not a TTY).');
    say('');
    say('  Signing a diff is a human act. This verb exists to remove the mechanics');
    say('  from that act, never the act itself, so it will not run unattended.');
    return done(2);
  }

  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    say(`✗ ${parsed.error}`);
    return done(2);
  }

  if (!project) {
    say('✗ could not resolve the repository (no git origin remote found).');
    return done(1);
  }

  const vcs = await getVcsFn({ provider });

  // Resolved ONCE, threaded into every vcs call below (issue #473 cold-review
  // round 1 finding: whoami and the post/verify calls must share ONE
  // credential source). `{ apiBase, token, proxyUrl }` are GitLab-only
  // transport config — harmless no-op params on the GitHub provider, same
  // pattern as identity.mjs's `defaultWhoami` / actor-check.mjs's
  // `defaultFetch*` helpers. Reading the environment is `gitlabApiConfig`'s
  // own module's business, not this one's — this file's environment-read
  // count (Lock 2, locks.test.mjs) stays at zero occurrences.
  const vcsConfig = gitlabApiConfig();

  // ── Identity — ambient credentials, verified before anything else ─────────
  let who;
  try {
    who = await vcs.whoami({ ...vcsConfig });
  } catch (err) {
    say(`✗ could not verify your identity: ${err.message}`);
    say('  Never proceed on an unverified identity.');
    return done(1);
  }
  const actor = who?.username || null;
  if (!actor) {
    say('✗ could not resolve your identity — whoami returned no login.');
    return done(1);
  }

  const denyActors = readDenyActorsFn();
  if (Array.isArray(denyActors) && denyActors.includes(actor)) {
    say(`✗ "${actor}" is registered in governance.reviewActors — a review identity may never sign an approval.`);
    say('  This is the write-side twin of L5 read rule 15 (design.md §E3).');
    return done(1);
  }

  // ── Resolve the PR number ───────────────────────────────────────────────
  let number = parsed.number;
  if (number == null) {
    const branch = (branchFn ?? (() => currentBranch(process.cwd())))();
    if (!branch) {
      say('✗ could not resolve the current branch, and no PR number was given.');
      say('  Usage: npm run brain:approve -- [<pr-number>]');
      return done(1);
    }
    const prs = await vcs.mrList({ project, state: 'open' });
    const match = Array.isArray(prs) ? prs.find((p) => p.headBranch === branch) : null;
    if (!match) {
      say(`✗ no open PR found for branch "${branch}". Pass the PR number explicitly.`);
      say('  Usage: npm run brain:approve -- <pr-number>');
      return done(1);
    }
    number = match.number;
  }

  // ── Compose: read the head, render the block ────────────────────────────
  const composedView = await vcs.prView({ project, number, ...vcsConfig });
  const headSha = composedView?.headRefOid || null;
  if (!headSha) {
    say(`✗ could not resolve the head commit for PR #${number}.`);
    return done(1);
  }

  const at = nowFn();
  const body = renderDecision({ decision: 'APPROVE', head_sha: headSha, actor, at });

  say('');
  say(`─── SIGNING PR #${number} ─────────────────────────────────────────────`);
  say(`  actor       ${actor}`);
  say(`  head_sha    ${headSha}`);
  say('');
  say(body);
  say('');
  say(`Type ${CONFIRMATION_WORD} to sign this diff. Anything else aborts — nothing is posted.`);

  const answer = await readLineFn();
  if (typeof answer !== 'string' || answer.trim() !== CONFIRMATION_WORD) {
    say('');
    say('✗ aborted — nothing was posted.');
    return done(1);
  }

  // ── Anti-stale: re-read the head immediately before posting ────────────
  const reRead = await vcs.prView({ project, number, ...vcsConfig });
  const currentHead = reRead?.headRefOid || null;
  if (currentHead !== headSha) {
    say('');
    say(`✗ the PR head moved (was ${headSha}, now ${currentHead ?? 'unresolvable'}) — refusing to sign a stale diff.`);
    say('  Run brain:approve again to sign the current head.');
    return done(1);
  }

  // ── Post: existing verb only, no event, no comments ─────────────────────
  const posted = await vcs.prReviewComment({ project, number, body, ...vcsConfig });
  if (!posted?.url) {
    say('');
    say(`✗ the review comment failed to post: ${posted?.error ?? 'unknown error'}.`);
    say('  No signature was recorded.');
    return done(1);
  }

  // ── Post-then-verify: the landed review must be authored by `actor` ────
  const reviews = await vcs.prReviews({ project, number, ...vcsConfig });
  const landed = Array.isArray(reviews) ? reviews.find((r) => r.body === body) : null;
  const landedAuthor = landed?.author ?? null;
  if (!landedAuthor || String(landedAuthor).toLowerCase() !== String(actor).toLowerCase()) {
    say('');
    say(
      `✗ posted, but the landed review's author ("${landedAuthor ?? 'unresolvable'}") does not match ` +
        `the signed actor ("${actor}").`,
    );
    say('  Ambient credentials may have changed mid-run — the signature will NOT be admitted as-is.');
    say(`  Delete the stray comment at ${posted.url} and re-run brain:approve.`);
    return done(1);
  }

  say('');
  say(`✓ signed — ${posted.url}`);
  return done(0, { url: posted.url });
}

// ── CLI entry point — the only I/O layer ─────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const { project } = originIdentity();
  const result = await runApprove({
    argv: process.argv.slice(2),
    isTTY: Boolean(process.stdin.isTTY),
    project,
    branchFn: () => currentBranch(root),
    readLineFn: async () => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return await new Promise((resolve) => rl.question('> ', resolve));
      } finally {
        rl.close();
      }
    },
    write: (chunk) => process.stdout.write(chunk),
  });
  process.exit(result.exitCode);
}
