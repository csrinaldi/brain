// ship.mjs — the lane ship: one push, one PR, and a credential this module
// never holds (#888, ADR-0034 L1/L2/L5, following #887's collectLane()).
//
// shipLane() is an orchestration function with FOUR injected seams and no
// import of its own that touches the machine: `collect` (default
// collectLane), `git` (default the already-exported defaultGit,
// collect.mjs:44), a BOUND port object `vcs` (never three separate function
// parameters — see A2 in design.md), and `tier`. Everything it decides is
// decided from those four; everything it reports is derived from what they
// returned. The credential never enters here — the `ship` op on
// memory/cli.mjs reads BRAIN_MEMORY_TOKEN once, hands it to getVcs(), and
// passes this function the BOUND port plus `identityBound: boolean`, never
// the token (A5). See openspec/changes/issue-888-lane-ship/design.md,
// decisions A1-A7, for the exact rationale behind every branch below.

import { collectLane, defaultGit } from './collect.mjs';
import { tierParams } from '../../vcs/governance-tiers.mjs';

/** Run `git(argv, opts)`; parse its stdout as a non-negative integer count,
 * defaulting to 0 on anything unparseable (never throws — a survey read is
 * advisory, not load-bearing). */
function parseCount(result) {
  const n = Number.parseInt(String(result.stdout ?? '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * surveyRef() — A1 step 2 / A3. Determines whether the local ref is ahead of
 * and/or behind origin's matching ref, WITHOUT ever forcing a push decision
 * itself: git's own non-fast-forward refusal at push time is the safety net
 * (A3), this is only the honest pre-report.
 *
 * - no local ref at all           -> ahead:0, behind:0, remoteRefPresent:null
 *   (nothing has ever been collected here; the caller's own commit:null check
 *   is what actually decides "nothing to ship").
 * - local ref exists, remote ref absent (a create, not a divergence)
 *                                  -> behind:0, remoteRefPresent:false, ahead
 *                                     is the ref's own full commit count.
 * - local ref exists, fetch fails for any OTHER reason (offline/transport)
 *                                  -> degrades like collect's own baseFetched:
 *                                     behind:null (unknown), ahead:1 (a
 *                                     sentinel that never masks a real ship
 *                                     as "nothing to do" — the push attempt
 *                                     itself is the authoritative check, A3).
 * - local ref exists, fetch succeeds -> real ahead/behind via rev-list.
 */
function surveyRef({ git, root, ref, branch }) {
  const tipResult = git(['rev-parse', '--verify', '--quiet', ref], { cwd: root });
  if (tipResult.status !== 0) {
    return { ahead: 0, behind: 0, remoteRefPresent: null };
  }

  const remoteRef = `refs/remotes/origin/${branch}`;
  const fetchResult = git(['fetch', 'origin', `+refs/heads/${branch}:${remoteRef}`], { cwd: root });
  if (fetchResult.status !== 0) {
    if (/couldn't find remote ref/.test(fetchResult.stderr)) {
      const aheadAll = git(['rev-list', '--count', ref], { cwd: root });
      return { ahead: parseCount(aheadAll), behind: 0, remoteRefPresent: false };
    }
    return { ahead: 1, behind: null, remoteRefPresent: null };
  }

  const behindResult = git(['rev-list', '--count', `${ref}..${remoteRef}`], { cwd: root });
  const aheadResult = git(['rev-list', '--count', `${remoteRef}..${ref}`], { cwd: root });
  return { ahead: parseCount(aheadResult), behind: parseCount(behindResult), remoteRefPresent: true };
}

// A4: the branch's own grammar (ADR-0034 L1, adr-0034:49) — tolerating the
// planner's optional `-<n>` disambiguator suffix, which `lane/plan.mjs` does
// not emit today but the regex stays permissive for it regardless.
const BRANCH_GRAMMAR = /^memory\/(?<host>[a-z0-9][a-z0-9-]*)-(?<date>\d{4}-\d{2}-\d{2})(?:-\d+)?$/;

/**
 * buildTitleAndBody() — A4. `title`/body follow the ticket's own grammar
 * (task 0.1 of tasks.md — a delta from this same file's design.md, called out
 * there and in the PR body): `title` carries the record count, the body's
 * first line does not. `host`/`date` are PARSED FROM THE BRANCH, never taken
 * from the caller's raw params directly — `lane/plan.mjs`'s `slugifyHost()`
 * can rewrite `host` (lowercased, non-`[a-z0-9]` runs collapsed to `-`)
 * before it ever reaches the ref, so re-deriving from the branch is the only
 * way the title provably matches what the ref actually says (A4's own
 * "never a second clock read" rationale, applied to the slug too). `n` and
 * the path list come from ONE source — the three-dot diff against
 * `origin/main` — never `collected` (#887's own C1 lesson: `collected`
 * counts this run's additions, not the lane's).
 */
function buildTitleAndBody({ git, root, ref, branch }) {
  const m = BRANCH_GRAMMAR.exec(branch);
  const host = m ? m.groups.host : branch;
  const date = m ? m.groups.date : '';

  const diffResult = git(['diff', '--name-only', `origin/main...${ref}`], { cwd: root });
  const paths = String(diffResult.stdout ?? '').split('\n').filter(Boolean).sort();
  const n = paths.length;
  const title = `memory: ${host} ${date} (${n} records)`;
  const bodyLines = [`Memory lane: ${host} ${date}`, `Records: ${n}`, ...paths.map((p) => `- ${p}`)];
  return { title, body: `${bodyLines.join('\n')}\n` };
}

/** parsePrNumber() — A6/spec "PR number is derived, never guessed": the
 * trailing integer of the URL, covering both `.../pull/123` and
 * `.../-/merge_requests/12`. */
function parsePrNumber(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

/** findOrCreatePr() — A1 steps 4-5. `mrList` is the ONE port verb that
 * THROWS (design A6, measured: github.mjs:458/gitlab.mjs:614 call a JSON
 * runner that throws on non-zero exit, unlike mrCreate/mrAutoMerge which
 * each catch their own). Wrapped here so a lookup failure is tagged
 * `prLookupFailed` and fails the run closed — the precondition for a
 * mutating write (mrCreate) is unreadable, and creating blindly risks a
 * duplicate PR. */
async function findOrCreatePr({ vcs, project, branch, title, body }) {
  let list;
  try {
    list = await vcs.mrList({ project, state: 'open' });
  } catch (err) {
    const e = new Error(`memory.ship.prLookupFailed: mrList failed — ${err.message}`);
    e.prLookupFailed = true;
    throw e;
  }
  const found = list.find((m) => m.headBranch === branch);
  if (found) {
    // mrList's own shape (`{number, title, headBranch}`) carries no url —
    // this is the honest value for a re-run's idempotent find, not a gap.
    return { number: found.number, url: null };
  }

  const created = await vcs.mrCreate({ project, title, body, head: branch, base: 'main', labels: [] });
  if (!created.url) {
    const e = new Error(`memory.ship.prCreateFailed: mrCreate failed — ${created.error ?? 'unknown error'}`);
    e.prCreateFailed = true;
    throw e;
  }

  let number = parsePrNumber(created.url);
  if (number === null) {
    let rescan;
    try {
      rescan = await vcs.mrList({ project, state: 'open' });
    } catch (err) {
      const e = new Error(`memory.ship.prLookupFailed: the one-shot mrList re-scan failed — ${err.message}`);
      e.prLookupFailed = true;
      throw e;
    }
    const rescanFound = rescan.find((m) => m.headBranch === branch);
    number = rescanFound ? rescanFound.number : null;
  }
  return { number, url: created.url };
}

/**
 * shipLane() — the whole sequence (design A1's six steps, `resolve` folded
 * into step 1's own return): collect -> survey -> push -> find -> create ->
 * arm.
 *
 * @param {{
 *   root: string, project: string, tier: string, host: string, date: string,
 *   dryRun?: boolean, identityBound?: boolean,
 *   collect?: typeof collectLane, git?: typeof defaultGit,
 *   vcs: { mrList: Function, mrCreate: Function, mrAutoMerge: Function } | null,
 * }} opts
 * @returns {Promise<object>} the outcome shape — see design.md's module map.
 */
export async function shipLane({
  root,
  project,
  tier,
  host,
  date,
  dryRun = false,
  identityBound = false,
  collect = collectLane,
  git = defaultGit,
  vcs,
}) {
  const collected = collect({ root, host, date, git });
  const { ref, commit, collected: collectedCount, skipped, duplicates, baseFetched } = collected;
  const branch = ref.replace(/^refs\/heads\//, '');

  const { title, body } = buildTitleAndBody({ git, root, ref, branch });

  const base = {
    ref, branch, host, date, title, body,
    commit, collected: collectedCount, skipped, duplicates, baseFetched,
    identityBound, dryRun,
  };

  // A7: under --dry-run, steps 3-6 are never reached (vcs:null, no push, no
  // fetch/rev-list survey either — only the diff read above, needed for the
  // plan the operator sees). `collect` above still ran and made its own
  // best-effort `git fetch origin main` — that qualifier is A7's own.
  if (dryRun) {
    return {
      ...base,
      ahead: null, behind: null, remoteRefPresent: null,
      pushed: false, diverged: false, pr: null, autoMerge: null,
    };
  }

  const { ahead, behind, remoteRefPresent } = surveyRef({ git, root, ref, branch });

  // A1's REFINED predicate: not `commit === null` alone — see design.md's
  // rationale for why the literal D2 form makes a failed push unrecoverable
  // inside the same day.
  if (commit === null && ahead === 0) {
    return {
      ...base, ahead, behind, remoteRefPresent,
      pushed: false, diverged: false, pr: null, autoMerge: null,
    };
  }

  // Our own pre-check refuses a KNOWN divergence before ever touching the
  // network — "nothing else runs" (A1). An UNKNOWN divergence (behind:null,
  // a degraded fetch) still reaches the real push below, which is the
  // authoritative check (A3).
  if (behind !== null && behind > 0) {
    const err = new Error(`memory.ship.diverged: ${ref} is behind origin's matching ref — refusing to force-push.`);
    err.diverged = true;
    throw err;
  }

  const pushResult = git(['push', '--no-verify', 'origin', `${ref}:${ref}`], { cwd: root });
  if (pushResult.status !== 0) {
    if (/non-fast-forward|fetch first|rejected/.test(pushResult.stderr)) {
      const err = new Error(`memory.ship.diverged: push refused — ${pushResult.stderr.trim()}`);
      err.diverged = true;
      throw err;
    }
    const err = new Error(`memory.ship.pushFailed: git push exited ${pushResult.status} — ${pushResult.stderr.trim()}`);
    err.pushFailed = true;
    throw err;
  }

  const pr = await findOrCreatePr({ vcs, project, branch, title, body });

  // Both derivations (URL parse + the one-shot mrList re-scan) failing
  // leaves the PR open and unarmed — NOT fatal (deviation from design.md's
  // A6 table, which lists this row as exit:1; spec.md's own scenario says
  // exit:0 and this implementation follows spec.md — see apply-progress's
  // Deviations section for the full reconciliation). The state self-heals:
  // the very next run's `mrList`-based idempotent find recovers `number`
  // from `mrList`'s own shape, the same way an `mrAutoMerge` refusal
  // self-heals one row below it in the same table.
  if (pr.number === null) {
    return { ...base, ahead, behind, remoteRefPresent, pushed: true, diverged: false, pr, autoMerge: null };
  }

  const autoMerge = await vcs.mrAutoMerge({ project, number: pr.number, requiredReviews: tierParams(tier).requiredReviews });

  return { ...base, ahead, behind, remoteRefPresent, pushed: true, diverged: false, pr, autoMerge };
}
