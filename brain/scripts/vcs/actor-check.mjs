// actor-check.mjs — L5 human-approval actor check: pure evaluator + gh I/O wrapper
// + CLI (design §5, REQ-L5-1, REQ-L5-2). Sibling to phase-order-check.mjs.
//
// Pure evaluator (evaluateActor) takes plain data — no gh, no filesystem — so it
// is fully unit-testable with fixture events. The gh I/O wrapper resolves the
// issue referenced by the PR body (reusing the same Closes/Fixes/Resolves/Part-of
// extraction rules governance.yml's issue-link job already enforces in bash),
// fetches the approved-label labeling history via `gh api .../events`, and
// feeds evaluateActor. All I/O is dependency-injectable via `deps` (same
// CI-fragility discipline as run-check.mjs / phase-order-check.mjs) — no test
// spawns a real gh process.
//
// The approved label is config-driven and provider-resolved (issue #231 A2
// phase 1, design.md Decision 4): `resolveApprovedLabel()` reads
// `governance.approvedLabel` from brain.config.json and maps it per VCS
// provider. This file never hardcodes the label literal.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadContext, resolveDetectionBody, gitlabApiConfig } from './ci-context.mjs';
import { getVcs } from './cli.mjs';
import { resolveApprovedLabel } from '../governance/approved-label.mjs';
import { CLOSING_RE, CHAIN_RE } from '../governance/checks/issue-ref-patterns.mjs';
import { resolveTier, tierParams, resolveGatePolicy } from './governance-tiers.mjs';
import { parseDecision } from '../review/lib/decision-block.mjs';
import { extractFencedBlock, scalar } from '../review/lib/yaml-block.mjs';

// ── Pure evaluator (design §5 step 5) ───────────────────────────────────────

/**
 * Compares the approved-label event's timestamp against the PR's head-commit
 * timestamp (issue #358 Q5 Phase 4, REQ-L5-1' `lite` evidence: "distinct
 * act"). Pure — a plain millisecond comparison, no I/O.
 *
 * @param {string|null|undefined} labelCreatedAt  The approved-label add
 *   event's timestamp (ISO 8601).
 * @param {string|null|undefined} headCommitAt  The PR's head commit's
 *   timestamp (ISO 8601, `prCommits()`'s last entry's `at`).
 * @returns {boolean|null}  `true` when the label strictly postdates the head
 *   commit (a satisfiable "distinct act"), `false` when it does not (the
 *   approval predates the code it approves), `null` when either timestamp is
 *   missing — uncomputable, never assumed either way.
 */
export function compareTimestamps(labelCreatedAt, headCommitAt) {
  if (!labelCreatedAt || !headCommitAt) return null;
  return new Date(labelCreatedAt).getTime() > new Date(headCommitAt).getTime();
}

/**
 * Is this commit FOREIGN to the approval? (ADR-0026 Amendment 1, issue #418.)
 *
 * Foreign = authored by neither the approver nor a registered
 * `governance.reviewActors` identity. Only a foreign commit re-arms an
 * existing approval at `lite`.
 *
 * The test keys off the login the PROVIDER attributes the commit to — never
 * the commit header's name/email, which anyone can spell. An unresolvable
 * login is therefore foreign, not exempt: the relief never extends to an
 * identity the platform cannot vouch for. Two consequences are recorded in
 * the amendment rather than discovered later: GitLab resolves no logins today
 * (`login: null`, prCommits' documented residual) so it keeps the pre-
 * amendment behavior wholesale, and commits attributed to no account at all
 * (e.g. an agent session committing as a bare `noreply@` identity) keep
 * re-arming too.
 *
 * Logins fold case — they are case-insensitive on both providers, and
 * refusing on case alone would be a false positive.
 *
 * @param {{ login?: string|null }} commit
 * @param {string[]} exempt  Approver + reviewActors, already collected.
 * @returns {boolean}
 */
function isForeignCommit(commit, exempt) {
  const login = commit?.login;
  if (!login) return true; // unresolvable authorship — fail closed
  return !exempt.some(e => e && String(e).toLowerCase() === String(login).toLowerCase());
}

/**
 * `lite`'s REQ-L5-1' evidence: **distinct act over foreign commits**
 * (ADR-0026 Amendment 1, issue #418) — the approved-label event must be
 * strictly later than the latest FOREIGN commit, rather than than the head
 * commit. Self-approval is NOT checked here by design (design.md §2.A/§4):
 * a solo maintainer applying their own approval satisfies `lite` on its own,
 * evidence-tiered terms.
 *
 * Why the target moved: at `lite` the approver is *allowed* to be the author,
 * so comparing against the head commit asked "did you keep working on your
 * own branch" rather than "did someone slip work past the reviewer" — a
 * question whose cost scales with iteration count and whose value at n=1 is
 * near zero. It also made every automated fix-push demand a fresh human
 * signature, which would defeat the reviewer loop #409 is building toward.
 * The stale-green property #328 fixed is retained in full against every actor
 * whose work the approver has not seen: any third-party push still re-arms.
 *
 * The `reviewActors` exemption is only safe because the reviewer identity is
 * now VERIFIED against its token (#413) — before that, anyone holding any
 * token could declare themselves the bot.
 *
 * Fails CLOSED (never warn) once a labeled event exists but the timing cannot
 * be established — spec.md REQ-L5-1': "an unreadable approval is not an
 * approval." (The "no labeled event AT ALL yet" case is handled earlier, by
 * the shared warn+pass branch in `evaluateActor` — REQ-L5-2 — before this
 * function ever runs.)
 *
 * @param {{ actor: string|undefined, labelCreatedAt: string|undefined, commits: Array<{ at?: string, login?: string|null }>|null, reviewActors?: string[] }} input
 * @returns {{ level: 'pass'|'fail', reason: string }}
 */
function evaluateDistinctAct({ actor, labelCreatedAt, commits, reviewActors = [] }) {
  // An approval whose own timestamp is unreadable is not an approval —
  // checked BEFORE the foreign-commit search, which would otherwise let a
  // timestamp-less label through the no-foreign-commit branch below. Pre-
  // Amendment-1 this was implicit (compareTimestamps returned null and the
  // comparison failed); Amendment 1 adds a path that never reaches that
  // comparison, so the invariant has to be stated outright.
  if (!labelCreatedAt) {
    return {
      level: 'fail',
      reason:
        'the approved-label event carries no timestamp — cannot verify the "lite" tier\'s distinct-act ' +
        'evidence (REQ-L5-1′, ADR-0026 Amendment 1); an unreadable approval is not an approval.',
    };
  }

  // Uncomputable commit data is unreadable evidence, not "no foreign commit" —
  // it must not fall through to the satisfied-by-default branch below.
  if (!Array.isArray(commits) || commits.length === 0) {
    return {
      level: 'fail',
      reason:
        'the PR\'s commit list is unreadable — cannot verify the "lite" tier\'s distinct-act ' +
        'evidence (REQ-L5-1′, ADR-0026 Amendment 1); an unreadable approval is not an approval.',
    };
  }

  const exempt = [actor, ...reviewActors].filter(Boolean);
  const foreign = commits.filter(c => isForeignCommit(c, exempt));

  // No foreign commit: every commit on the branch is the approver's or a
  // verified reviewer identity's, so there is nothing the approval has not
  // already seen. Any approval event satisfies the evidence (REQ-418-5).
  if (foreign.length === 0) {
    return {
      level: 'pass',
      reason:
        `the approved label was applied by "${actor ?? 'unknown'}" at ${labelCreatedAt ?? 'an unreadable time'}; ` +
        'every commit on the branch is authored by the approver or a registered governance.reviewActors ' +
        'identity, so no push re-arms the approval — distinct-act evidence satisfied at the "lite" tier ' +
        '(REQ-L5-1′, ADR-0026 Amendment 1).',
    };
  }

  const latestForeign = foreign[foreign.length - 1];
  const foreignAt = latestForeign?.at;

  if (!foreignAt) {
    return {
      level: 'fail',
      reason:
        `the latest foreign commit (authored by "${latestForeign?.login ?? 'an unresolvable identity'}") has an ` +
        'unreadable timestamp — cannot verify the "lite" tier\'s distinct-act evidence (REQ-L5-1′, ' +
        'ADR-0026 Amendment 1); an unreadable approval is not an approval.',
    };
  }

  const distinctAct = compareTimestamps(labelCreatedAt, foreignAt);
  if (distinctAct !== true) {
    return {
      level: 'fail',
      reason:
        `the approved label was applied at ${labelCreatedAt ?? 'an unreadable time'}, not strictly after the ` +
        `latest foreign commit — authored by "${latestForeign.login ?? 'an unresolvable identity'}" and pushed at ` +
        `${foreignAt} — so the approval predates work the approver has not seen. Re-apply the approved label ` +
        'after reviewing that commit (REQ-L5-1′ "lite" evidence, ADR-0026 Amendment 1).',
    };
  }

  return {
    level: 'pass',
    reason:
      `the approved label was applied by "${actor ?? 'unknown'}" at ${labelCreatedAt}, strictly after the latest ` +
      `foreign commit — authored by "${latestForeign.login ?? 'an unresolvable identity'}" and pushed at ` +
      `${foreignAt} — distinct-act evidence satisfied at the "lite" tier (REQ-L5-1′, ADR-0026 Amendment 1).`,
  };
}

const DECISION_PROTOCOL_PREFIX_RE = /^brain-decision\//;
const SUPPORTED_DECISION_PROTOCOL = 'brain-decision/1';

/**
 * Peeks at a review body's raw `protocol` scalar WITHOUT validating the rest
 * of the block — used only to distinguish "not addressed to this reader"
 * (design.md §E2 rule 3, silent) from "addressed but an unsupported version"
 * (rule 4, refuse). Reuses the SAME fence/scalar primitives `parseDecision`
 * itself uses (`yaml-block.mjs`), never a second, divergent reader.
 *
 * @param {unknown} body
 * @returns {string|null}
 */
function sniffDecisionProtocol(body) {
  if (typeof body !== 'string' || body.length === 0) return null;
  const block = extractFencedBlock(body);
  return block === null ? null : scalar(block, 'protocol');
}

/**
 * `brain-decision/1` as a PEER `lite` evidence source (design.md §C2, issue
 * #473). A sibling of `evaluateDistinctAct`, not a branch inside it — this
 * function speaks its own vocabulary (which diff did a human sign, and who)
 * and never returns a verdict shape (`{level,reason}`), only `{admitted}`
 * (design.md §C3): a verdict-shaped return is exactly what a careless caller
 * would pass straight through, and a stray `level:'fail'` escaping from a
 * NON-admissible block would break the composite's monotonicity guarantee
 * (§C4 — refusal ANNOTATES, it never blocks).
 *
 * Every review in `decisions` addressed to this reader (protocol starts
 * `brain-decision/`) is evaluated in order — design.md §E2 rule 16: admit if
 * ANY is admissible, collect the others' notes. Reviews carrying no fence, or
 * a fence for a DIFFERENT protocol family entirely, are silent (rules 2/3) —
 * they contribute nothing, not even a note.
 *
 * @param {object} input
 * @param {Array<{state?:string, author?:string|null, body?:string}>|null} input.decisions
 *   `prReviews()`'s normalized shape, or `null` when the review list itself
 *   is uncomputable.
 * @param {string|null} input.headSha  The PR's current head SHA
 *   (`resolveHeadSha(commits)`), or `null` when uncomputable.
 * @param {string[]} [input.denyActors]  `governance.reviewActors` — a review
 *   identity may never SIGN an approval either (design.md §E2 rule 15,
 *   mirrors the label's own deny-before-allow rule, `actor-check.mjs:358`).
 * @returns {{admitted:true,reason:string}|{admitted:false,note:string}|null}
 */
export function evaluateSignedDecision({ decisions, headSha, denyActors = [] } = {}) {
  if (decisions === null) {
    return {
      admitted: false,
      note: '(brain-decision/1: the PR review list is unreadable — a signature could not be verified.)',
    };
  }

  if (!Array.isArray(decisions) || decisions.length === 0) return null;

  const notes = [];
  let addressed = false;

  for (const review of decisions) {
    const body = review?.body;
    const protocol = sniffDecisionProtocol(body);
    if (protocol === null || !DECISION_PROTOCOL_PREFIX_RE.test(protocol)) continue; // rules 2/3: silent

    addressed = true;

    if (protocol !== SUPPORTED_DECISION_PROTOCOL) {
      notes.push(
        `(brain-decision/1: unsupported protocol version "${protocol}" — this reader only understands "${SUPPORTED_DECISION_PROTOCOL}".)`,
      );
      continue; // rule 4
    }

    const parsed = parseDecision({ body });
    if (parsed === null) {
      notes.push('(brain-decision/1: the block is missing a required field, or is otherwise malformed — not admissible.)');
      continue; // rules 5, 6, 7, 8, 9, 12
    }

    if (headSha === null) {
      notes.push('(brain-decision/1: cannot resolve the PR head — the signature could not be verified.)');
      continue; // rule 11
    }

    if (parsed.head_sha.toLowerCase() !== headSha.toLowerCase()) {
      notes.push(
        `(brain-decision/1: the signature names ${parsed.head_sha}, the PR head is ${headSha} — re-sign the current head.)`,
      );
      continue; // rule 10
    }

    const author = review?.author;
    if (!author) {
      notes.push('(brain-decision/1: the review has no resolvable author — an unresolvable identity is not an identity.)');
      continue; // rule 13
    }

    if (String(parsed.actor).toLowerCase() !== String(author).toLowerCase()) {
      notes.push(
        `(brain-decision/1: the block claims to be signed by "${parsed.actor}" but was posted by "${author}".)`,
      );
      continue; // rule 14
    }

    if (denyActors.some(d => d && String(d).toLowerCase() === String(author).toLowerCase())) {
      notes.push(
        `(brain-decision/1: "${author}" is registered in governance.reviewActors — a review identity may never sign an approval.)`,
      );
      continue; // rule 15
    }

    return {
      admitted: true,
      reason:
        `a brain-decision/1 APPROVE block signed by "${author}" at head ${headSha} is admissible evidence ` +
        '(REQ-473-1, issue #473).',
    };
  }

  if (!addressed) return null; // rules 2/3, aggregate: nothing addressed to this reader

  return { admitted: false, note: notes.join(' ') };
}

/**
 * The pluggable `lite` evidence-source list (design.md §C2). A future peer
 * source (e.g. a real approving review, issue #454) appends here and touches
 * nothing else in `evaluateActor` — that is the whole reason (b) is a swap.
 * Frozen: the default list is never mutated in place.
 */
export const LITE_SIGNED_EVIDENCE_SOURCES = Object.freeze([evaluateSignedDecision]);

/**
 * `regulated`'s additional REQ-L5-1' evidence beyond `standard`'s distinct
 * actor: the approver must have authored NO commit on the branch. Returns
 * `null` when the evidence is satisfied (no additional verdict — the caller
 * falls through to its own pass), or a verdict object when it is not.
 *
 * Never fails on genuinely uncomputable commit-authorship data (e.g. a
 * provider — today, GitLab — that cannot resolve commit authors to an
 * account, `prCommits()`'s documented `login: null` residual) — warns
 * instead, the same zero-false-positive discipline REQ-L5-2 established for
 * missing labeled-event evidence.
 *
 * @param {{ actor: string|undefined, commits: Array<{ login: string|null }>|null }} input
 * @returns {{ level: 'warn'|'fail', reason: string }|null}
 */
function evaluateNoCommitOnBranch({ actor, commits }) {
  const resolvable = Array.isArray(commits) && commits.some(c => c.login != null);
  if (!resolvable) {
    return {
      level: 'warn',
      reason:
        `cannot verify whether "${actor ?? 'the approver'}" authored a commit on this branch — commit ` +
        'authorship is unreadable at the "regulated" tier (e.g. the provider cannot resolve commit authors ' +
        'to an account); never failing on missing evidence.',
    };
  }

  const authoredByApprover = commits.some(c => c.login === actor);
  if (authoredByApprover) {
    return {
      level: 'fail',
      reason:
        `"${actor}" authored at least one commit on this branch — the "regulated" tier requires the ` +
        'approver to have authored NO commit on the branch (REQ-L5-1′).',
    };
  }

  return null;
}

/**
 * Evaluates whether the approved-label actor satisfies REQ-L5-1's
 * tier-scoped evidence form (issue #358 Q5 Phase 4, REQ-L5-1'). Pure — no
 * gh, no filesystem access (fully testable with fixtures).
 *
 * Decision order (design §5 step 5, extended by design.md §2.A/REQ-L5-1' and
 * issue #375's deny-set):
 *   1. No `labeled` event found → warn + pass (cannot prove self-approval on
 *      missing evidence — REQ-L5-2, keeps false positives ~0). This is the
 *      "no approval yet" case, distinct from `lite`'s own fail-closed rule
 *      below, which only applies once a labeled event exists.
 *   2. `adminOverride` (an allow-listed `override:*` label is present, and
 *      honored at this tier) → pass, logged.
 *   3. Actor in `denyActors` (`config.governance.reviewActors`) → fail — a
 *      review identity may never apply the approved label (issue #375;
 *      reviewer-protocol.md §9), at ANY tier. Evaluated BEFORE the allow-list
 *      so a contradictory config resolves fail-closed, and BEFORE the tier
 *      branch below so `lite`'s narrower distinct-act evidence can never
 *      admit a denied identity either.
 *   4. Actor in `botAllowlist` (e.g. automation acting on a human's explicit
 *      instruction) → pass.
 *   5. `lite`: distinct-act ONLY (`evaluateDistinctAct`) — self-approval is
 *      not evaluated; a solo maintainer's own late approval passes.
 *   6. `standard`/`regulated`: distinct actor — actor === author OR actor ===
 *      issueAuthor → fail (self-approval). REQ-L5-1 requires comparing
 *      against BOTH the PR author and the issue author (spec.md:398-400):
 *      the PR author and the issue author can be two different people (e.g.
 *      Bob files the issue, Alice opens the PR), and either one self-labeling
 *      their own issue counts as self-approval. This is UNCHANGED from the
 *      pre-tiering behavior (REQ-TIER-10's no-op-migration guarantee for the
 *      default `standard` tier).
 *   7. `regulated` only: additionally requires the approver authored no
 *      commit on the branch (`evaluateNoCommitOnBranch`) — REQ-L5-1'.
 *   8. Otherwise → pass (approval by an identity that is neither an author nor
 *      deny-listed). NOTE: this branch cannot verify that the actor is human —
 *      it verifies only that it is not one this repo has named. Step 3 is what
 *      keeps a known non-human out of it (issue #375).
 *
 * The "most recent" labeled event wins (handles re-labeling: remove → re-add
 * uses the latest add) — `labeledEvents` is assumed to be in the same
 * chronological order `gh api .../events` returns (ascending), so this simply
 * reads the last element.
 *
 * @param {object} input
 * @param {string} input.author  PR author login (design §5 step 1).
 * @param {string} [input.issueAuthor]  Issue author login (the issue the PR
 *   closes/references) — REQ-L5-1 requires failing on either author matching.
 * @param {Array<{ actor: { login: string }, at?: string }>} input.labeledEvents
 *   `labeled` events for the resolved approved label, chronologically
 *   ordered. `at` (the label-add timestamp) is required for `lite`'s
 *   distinct-act evidence.
 * @param {string[]} [input.botAllowlist]  Allow-listed actor logins / override
 *   label strings (`config.governance.approvalActors`).
 * @param {string[]} [input.denyActors]  DENY-listed actor logins
 *   (`config.governance.reviewActors`, issue #375) — a review identity may
 *   never apply the approved label, at any tier. Checked before
 *   `botAllowlist` and before the tier branch.
 * @param {boolean} [input.adminOverride]  Whether an allow-listed `override:*`
 *   label is present on the issue AND honored at this tier (resolved by the
 *   wrapper against `botAllowlist` — never a blanket bypass, REQ-L5-2).
 * @param {boolean} [input.overrideRefused]  Whether an allow-listed
 *   `override:*` label was present but NOT honored at this tier (issue #358
 *   Q5, REQ-TIER-6 — `regulated` refuses the label). When true, the verdict
 *   NAMES the refusal rather than silently proceeding as if the label were
 *   absent.
 * @param {'lite'|'standard'|'regulated'} [input.tier]  Selects the evidence
 *   form (REQ-L5-1') AND the `overrideRefused` message text.
 * @param {Array<{ sha: string, login: string|null, at?: string }>|null} [input.commits]
 *   The PR's commits, ascending (`prCommits()`'s normalized shape), or `null`
 *   when uncomputable. Consumed by `lite` (head-commit timestamp) and
 *   `regulated` (approver-authored-commit check) only.
 * @param {Array<{state?:string, author?:string|null, body?:string}>|null} [input.decisions]
 *   `prReviews()`'s normalized shape (issue #473), or `null` when
 *   uncomputable. Consumed by `lite`'s signed-evidence sources only.
 * @param {string|null} [input.headSha]  The PR's current head SHA
 *   (`resolveHeadSha(commits)`, issue #473) — a signed decision block binds
 *   to this.
 * @param {Function[]} [input.signedEvidenceSources]  The pluggable `lite`
 *   evidence-source list (design.md §C2) — defaults to
 *   `LITE_SIGNED_EVIDENCE_SOURCES`. A test drives a fake source to prove the
 *   composite honors the LIST (order, first-admitted-wins), not a hardcoded
 *   call.
 * @returns {{ level: 'pass'|'warn'|'fail', reason: string }}
 */
export function evaluateActor({
  author,
  issueAuthor,
  labeledEvents = [],
  botAllowlist = [],
  denyActors = [],
  adminOverride = false,
  overrideRefused = false,
  tier = 'standard',
  commits = null,
  decisions = null,
  headSha = null,
  signedEvidenceSources = LITE_SIGNED_EVIDENCE_SOURCES,
} = {}) {
  const withRefusalNote = result => {
    if (!overrideRefused || result.level === 'warn') return result;
    return {
      ...result,
      reason: `${result.reason} (an override:* label was present but is not honored at the "${tier}" tier — refusing the bypass, REQ-TIER-6.)`,
    };
  };

  if (labeledEvents.length === 0) {
    return {
      level: 'warn',
      reason:
        'no labeled event found for the approved label — cannot verify the approval actor; ' +
        'never failing on missing evidence (REQ-L5-2).',
    };
  }

  const lastEvent = labeledEvents[labeledEvents.length - 1];
  const actor = lastEvent?.actor?.login;
  const labelCreatedAt = lastEvent?.at;

  if (adminOverride) {
    return {
      level: 'pass',
      reason: `admin override present (allow-listed override:* label) — approval actor check bypassed (actor: ${actor ?? 'unknown'}).`,
    };
  }

  // DENY before ALLOW (issue #375). `denyActors` comes from
  // `governance.reviewActors` — the same key L6 reads to exclude an identity
  // from the human-approver count. Both readings are restrictive and say the
  // same thing: this identity is not a human authority. See the ADR for why
  // ruling R2 ("no key feeds two gates") is knowingly excepted here.
  //
  // Placed ABOVE the allow-list on purpose: `reviewer-identity-config.test.mjs`
  // already asserts the two lists never overlap in the shipped config, so this
  // ordering only decides a contradictory config — and it must resolve
  // fail-CLOSED. A misregistration must not hand the reviewer the merge
  // keystroke.
  //
  // Deliberately BELOW `adminOverride`: that is the documented, logged human
  // recovery path (workflow-governance.md), and #375 scopes rule 2 out.
  //
  // Deliberately ABOVE the tier branch (issue #358 Q5): a denied identity must
  // never slip through `lite`'s narrower distinct-act evidence either — the
  // deny-set is a tier-agnostic identity gate, not part of REQ-L5-1's
  // evidence form.
  if (actor && denyActors.includes(actor)) {
    return withRefusalNote({
      level: 'fail',
      reason:
        `the approved label was applied by "${actor}", which is registered in governance.reviewActors ` +
        '— a review identity may never apply the approved label (reviewer-protocol.md §9; that label is human-only).',
    });
  }

  if (actor && botAllowlist.includes(actor)) {
    return withRefusalNote({
      level: 'pass',
      reason: `the approved label was applied by allow-listed automation identity "${actor}".`,
    });
  }

  // `denyActors` IS `governance.reviewActors` (see the deny branch above).
  // Amendment 1 reuses that same set as `lite`'s non-re-arming push identity
  // set — no new config key. The two readings do not conflict: a review
  // identity may never APPLY the approval (denied above), and its pushes do
  // not INVALIDATE one (here).
  //
  // issue #473 (design.md §C2): `signedEvidenceSources` is tried FIRST, in
  // order — a `brain-decision/1` block is an ADDITIONAL sufficient form of
  // evidence, OR-composed with the existing distinct-act check below. A
  // non-admissible block never blocks; it only annotates the fallback
  // verdict's reason (§C4 — monotonicity: no PR passes on LESS evidence than
  // today, and the block grants nothing on unreadable/broken evidence).
  if (tier === 'lite') {
    const signedNotes = [];
    for (const source of signedEvidenceSources) {
      const signed = source({ decisions, headSha, denyActors });
      if (signed?.admitted) return withRefusalNote({ level: 'pass', reason: signed.reason });
      if (signed?.note) signedNotes.push(signed.note);
    }
    const base = evaluateDistinctAct({ actor, labelCreatedAt, commits, reviewActors: denyActors });
    return withRefusalNote(
      signedNotes.length ? { ...base, reason: `${base.reason} ${signedNotes.join(' ')}` } : base,
    );
  }

  if (actor === author || (issueAuthor && actor === issueAuthor)) {
    const matched = actor === author ? 'PR author' : 'issue author';
    return withRefusalNote({
      level: 'fail',
      reason: `the approved label was self-applied by "${actor}" (matches the ${matched}) — self-approval is not allowed.`,
    });
  }

  if (tier === 'regulated') {
    const commitVerdict = evaluateNoCommitOnBranch({ actor, commits });
    if (commitVerdict) return withRefusalNote(commitVerdict);
  }

  return withRefusalNote({
    level: 'pass',
    reason: `the approved label was applied by "${actor}", distinct from the PR author "${author}" and the issue author "${issueAuthor ?? 'n/a'}".`,
  });
}

// ── Issue-number extraction (reused rules from governance.yml's issue-link job) ─
//
// Mirrors the bash regexes in .github/workflows/governance.yml's issue-link job
// exactly: base=main requires a closing keyword; a slice PR (base!=main) also
// accepts "Part of #N". CLOSING_RE/CHAIN_RE come from the shared
// checks/issue-ref-patterns.mjs (issue #231 CP-A2a review, finding M1) —
// this file's own CLOSING_KEYWORD_RE/PART_OF_RE were already the BROAD
// 9-form vocabulary (identical in behavior to the shared pattern), deleted
// here in favor of the one shared constant now imported by issueLink(),
// run-check.mjs, AND this file.

/**
 * Extracts the issue number referenced by a PR body, following the same rules
 * governance.yml's issue-link job enforces in bash.
 *
 * @param {string} prBody
 * @param {string} baseBranch
 * @returns {number|null}
 */
export function extractIssueNumber(prBody, baseBranch) {
  const body = prBody ?? '';

  if (baseBranch === 'main') {
    const m = body.match(CLOSING_RE);
    return m ? Number(m[2]) : null;
  }

  const partOf = body.match(CHAIN_RE);
  if (partOf) return Number(partOf[1]);

  const closing = body.match(CLOSING_RE);
  return closing ? Number(closing[2]) : null;
}

// ── gh I/O wrapper ───────────────────────────────────────────────────────────

/**
 * Filters the `labelEvents()` CONTRACT verb's normalized output (issue #239
 * A3, D1) down to `add` events for the resolved approved label — the SHARED
 * post-filter applied to EITHER provider's normalized shape (`action`,
 * `label`), AFTER the verb normalizes. Pure — exported for unit testing the
 * provider-resolved wiring without spawning a real `gh`/API call (issue #231
 * A2 phase 1). `events === null` (labelEvents' uncomputable signal) passes
 * through as `[]`, feeding evaluateActor's existing "no labeled event found"
 * → `warn` branch (REQ-L5-2 — never fail on missing evidence).
 *
 * @param {Array<{ action?: string, label?: string }>|null} events
 * @param {string} approvedLabel
 * @returns {Array<{ actor: { login: string }, action: string, label: string, at: string }>}
 */
export function filterLabeledEvents(events, approvedLabel) {
  if (!events) return [];
  return events.filter(e => e.action === 'add' && e.label === approvedLabel);
}

/**
 * Default `fetchLabeledEvents` dep: dispatches the `labelEvents` CONTRACT
 * verb (issue #239 A3, D1 — the m3 close) via `getVcs({ provider })` on the
 * RUNTIME-detected `ctx.provider` — the same finding-#14 pattern
 * `run-check.mjs#defaultFetchIssue` already uses (`run-check.mjs:167-177`):
 * a GitLab MR's referenced issue lives on GitLab even when this repo's own
 * config says github. `{ apiBase, token, proxyUrl }` are threaded in from
 * `gitlabApiConfig()` (harmless no-op params for the GitHub provider).
 * `getVcs` is injectable via `{ getVcs }` for tests, mirroring
 * `defaultFetchIssue`'s own `{ getVcs: getVcsFn = getVcs }` shape.
 *
 * @param {string} repo
 * @param {string|undefined} provider
 * @param {string} approvedLabel
 * @param {{ getVcs?: Function }} [deps]
 * @returns {(issueNumber: number) => Promise<Array<{ actor: { login: string }, action: string, label: string, at: string }>>}
 */
function defaultFetchLabeledEvents(repo, provider, approvedLabel, { getVcs: getVcsFn = getVcs } = {}) {
  return async issueNumber => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    const events = await vcs.labelEvents({ project: repo, number: issueNumber, apiBase, token, proxyUrl });
    return filterLabeledEvents(events, approvedLabel);
  };
}

/**
 * Default `fetchIssue` dep: dispatches `getVcs({ provider }).issueView(...)`
 * on the RUNTIME-detected `ctx.provider` (issue #239 A3 TASK1 — a
 * fresh-context review finding, closing the SAME defect class as
 * `defaultFetchLabeledEvents` above and finding #14/`run-check.mjs`'s
 * `defaultFetchIssue`, mirrored EXACTLY here). Pre-fix, this wrapper called
 * the `gh` CLI (via `execFileSync`) UNCONDITIONALLY regardless of provider —
 * on GitLab CI (no `gh` binary) it threw ENOENT, masking R3 behind a permanent
 * `warn` even though `labelEvents` had already been migrated. Both providers'
 * `issueView` (migrated to direct API v4 in A2 finding #12 for GitLab)
 * expose `author` as of A3 TASK1, so `labels`/`author` both come from the
 * SAME dispatched call — no second round-trip. `getVcs` is injectable via
 * `{ getVcs }` for tests, mirroring `defaultFetchLabeledEvents`'s own shape.
 *
 * @param {string} repo
 * @param {string|undefined} provider
 * @param {{ getVcs?: Function }} [deps]
 * @returns {(issueNumber: number) => Promise<{ labels: string[], author: string|null }>}
 */
function defaultFetchIssue(repo, provider, { getVcs: getVcsFn = getVcs } = {}) {
  return async issueNumber => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    const issue = await vcs.issueView({ project: repo, number: issueNumber, apiBase, token, proxyUrl });
    return {
      labels: issue?.labels ?? [],
      author: issue?.author ?? null,
    };
  };
}

/**
 * Whether a tier's REQ-L5-1' evidence form needs the PR's commit list
 * (issue #358 Q5 Phase 4): `lite` needs the head commit's timestamp
 * (distinct-act); `regulated` needs the full commit-author list (no-commit
 * -on-branch). `standard` needs neither — REQ-TIER-10's no-op-migration
 * guarantee means `standard` makes no additional API call it did not make
 * before tiering.
 *
 * @param {string} tier
 * @returns {boolean}
 */
function needsCommitEvidence(tier) {
  return tier === 'lite' || tier === 'regulated';
}

/**
 * Default `fetchCommits` dep: dispatches the `prCommits` CONTRACT verb
 * (issue #358 Q5 Phase 4) via `getVcs({ provider })` on the
 * RUNTIME-detected `ctx.provider` — the same finding-#14 pattern
 * `defaultFetchLabeledEvents`/`defaultFetchIssue` use. `getVcs` is
 * injectable via `{ getVcs }` for tests, mirroring their shape.
 *
 * @param {string} repo
 * @param {string|undefined} provider
 * @param {{ getVcs?: Function }} [deps]
 * @returns {(prNumber: number) => Promise<Array<{ sha: string, login: string|null, at?: string }>|null>}
 */
function defaultFetchCommits(repo, provider, { getVcs: getVcsFn = getVcs } = {}) {
  return async prNumber => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    return vcs.prCommits({ project: repo, number: prNumber, apiBase, token, proxyUrl });
  };
}

/**
 * Whether a tier's evidence form needs the PR's reviews (issue #473,
 * design.md §D3): only `lite`'s `evaluateSignedDecision` reads them.
 * `standard`/`regulated` make ZERO additional API calls (REQ-473-10's
 * no-op-migration guarantee, the same discipline `needsCommitEvidence`
 * already established).
 *
 * @param {string} tier
 * @returns {boolean}
 */
function needsDecisionEvidence(tier) {
  return tier === 'lite';
}

/**
 * Default `fetchDecisions` dep: dispatches the `prReviews` CONTRACT verb
 * (issue #473) via `getVcs({ provider })`, mirroring
 * `defaultFetchCommits`/`defaultFetchLabeledEvents`'s `{ getVcs }` shape
 * exactly. Unlike `defaultFetchReviews` (`brain-writes-reviewed.mjs`), this
 * does NOT map `null` → `[]` — design.md §D2: `prReviews` returns `null` on
 * an uncomputable review list, and that must stay `null` so
 * `evaluateSignedDecision` can emit its own "review list unreadable" NOTE
 * (rule 1) rather than being indistinguishable from "genuinely zero
 * reviews" (rule 2).
 *
 * @param {string} repo
 * @param {string|undefined} provider
 * @param {{ getVcs?: Function }} [deps]
 * @returns {(prNumber: number) => Promise<Array<{state:string,author:string|null,body:string}>|null>}
 */
function defaultFetchDecisions(repo, provider, { getVcs: getVcsFn = getVcs } = {}) {
  return async prNumber => {
    const vcs = await getVcsFn({ provider });
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    return vcs.prReviews({ project: repo, number: prNumber, apiBase, token, proxyUrl });
  };
}

/**
 * The PR's head SHA, derived from the commit list already in hand
 * (`prCommits()`'s normalized shape, ascending) — issue #473, design.md §D4.
 * Deliberately NOT a second `prView` round-trip: that would introduce a
 * second source of truth for "the head" that could disagree with the commit
 * list `evaluateSignedDecision` reads. Residual (recorded): GitHub's
 * `/pulls/N/commits` caps at 250 commits, so a >250-commit PR resolves the
 * wrong head — the fail-closed direction (a mismatched head never admits).
 *
 * @param {Array<{ sha: string }>|null} commits
 * @returns {string|null}
 */
export function resolveHeadSha(commits) {
  return Array.isArray(commits) && commits.length > 0 ? (commits[commits.length - 1].sha ?? null) : null;
}

function defaultReadBotAllowlist(cwd) {
  return () => {
    try {
      const config = JSON.parse(readFileSync(join(cwd, 'brain.config.json'), 'utf8'));
      return Array.isArray(config?.governance?.approvalActors) ? config.governance.approvalActors : [];
    } catch {
      return [];
    }
  };
}

/**
 * L5's DENY list (issue #375): `governance.reviewActors` — the SAME key L6
 * reads to exclude an identity from the human-approver count. Both readings are
 * restrictive and co-directional ("not a human authority"), which is why ruling
 * R2 is excepted here; see the ADR. Kept as a separate reader from
 * `defaultReadBotAllowlist` so the two keys never merge at the source.
 */
function defaultReadDenyActors(cwd) {
  return () => {
    try {
      const config = JSON.parse(readFileSync(join(cwd, 'brain.config.json'), 'utf8'));
      return Array.isArray(config?.governance?.reviewActors) ? config.governance.reviewActors : [];
    } catch {
      return [];
    }
  };
}

function defaultReadConfig(cwd) {
  return () => {
    try {
      return JSON.parse(readFileSync(join(cwd, 'brain.config.json'), 'utf8'));
    } catch {
      return {};
    }
  };
}

/**
 * Resolves the tier to attribute an API-failure verdict to (issue #358 Q5
 * Phase 5 review finding 1), WITHOUT ever throwing itself — this runs from
 * inside `runActorCheck`'s catch block, after `gatherActorCheckInputs` has
 * already failed, so a second failure here (a corrupt config, an unknown
 * `governance.tier`) must degrade rather than escape. Defaults to
 * `'standard'` on any resolution failure — `'standard'` also resolves
 * `actor-check` to `required` (REQ-TIER-2's never-tiered core), so this
 * default is fail-closed-safe regardless of the repo's real tier.
 *
 * @param {string} cwd
 * @param {{ tier?: string, readConfig?: () => object }} deps
 * @returns {'lite'|'standard'|'regulated'}
 */
function resolveTierForFailure(cwd, deps) {
  try {
    if (deps.tier) return deps.tier;
    const readConfig = deps.readConfig ?? defaultReadConfig(cwd);
    return resolveTier(readConfig());
  } catch {
    return 'standard';
  }
}

/**
 * Gathers evaluateActor()'s inputs from the PR body + gh API (or from injected
 * `deps` in tests). `adminOverride` is resolved here — an override:* label is
 * only honored when it is BOTH present on the issue AND listed in
 * `botAllowlist` (`config.governance.approvalActors`); an unlisted override:*
 * label grants nothing (REQ-L5-2 — no blanket bypass). `issueAuthor` is
 * surfaced from the same issue-object fetch used for labels (`fetchIssue`) —
 * no second gh round-trip — so evaluateActor can compare the approving actor
 * against BOTH the PR author and the issue author (REQ-L5-1).
 *
 * `provider` (github|gitlab, from `ctx.provider`) both resolves the approved
 * label (`governance.approvedLabel`, issue #231 A2 phase 1) AND selects the
 * VCS adapter (`getVcs({ provider })`, issue #239 A3 D1 — the m3 close) for
 * the default `fetchLabeledEvents` wrapper; an injected
 * `deps.fetchLabeledEvents` bypasses resolution entirely (as tests do). This
 * function is async as of A3 (the default wrapper awaits the `labelEvents`
 * CONTRACT verb, a Promise-returning dispatch); an injected sync
 * `deps.fetchLabeledEvents` still works unchanged (`await` on a
 * non-Promise resolves immediately to that same value).
 *
 * `adminOverride` is tier-scoped (issue #358 Q5, REQ-TIER-6): honored at
 * `lite`/`standard`, refused at `regulated` (`tierParams(tier).honorOverride`).
 * A present-but-refused override sets `overrideRefused: true` instead of
 * silently vanishing — evaluateActor() names the refusal in its verdict.
 *
 * `commits` (issue #358 Q5 Phase 4, REQ-L5-1') is fetched via `prCommits`
 * ONLY when the resolved tier's evidence form needs it (`lite`/`regulated`,
 * `needsCommitEvidence`) and a PR number is available — `standard` makes no
 * additional API call (REQ-TIER-10's no-op-migration guarantee).
 *
 * `denyActors` (issue #375) is sourced from `governance.reviewActors` via a
 * reader kept separate from `readBotAllowlist` (`config.governance.
 * approvalActors`) — the two keys must never merge at the source (design §3
 * two-key split). Threaded through unconditionally, at every tier.
 *
 * @param {{ author: string, prBody: string, baseBranch: string, repo: string, provider?: string, prNumber?: number, cwd?: string, tier?: string, deps?: object }} args
 * @returns {Promise<{ author: string, issueAuthor: string|null, labeledEvents: Array, botAllowlist: string[], denyActors: string[], adminOverride: boolean, overrideRefused: boolean, tier: string, commits: Array|null }>}
 */
export async function gatherActorCheckInputs({ author, prBody, baseBranch, repo, provider, prNumber, cwd = process.cwd(), tier: tierOverride, deps = {} } = {}) {
  const readConfig = deps.readConfig ?? defaultReadConfig(cwd);
  const config = readConfig();
  const approvedLabel = resolveApprovedLabel(config, provider);
  const tier = tierOverride ?? deps.tier ?? resolveTier(config);
  const { honorOverride } = tierParams(tier);

  const fetchLabeledEvents = deps.fetchLabeledEvents ?? defaultFetchLabeledEvents(repo, provider, approvedLabel, deps);
  const fetchIssue = deps.fetchIssue ?? defaultFetchIssue(repo, provider, deps);
  const readBotAllowlist = deps.readBotAllowlist ?? defaultReadBotAllowlist(cwd);
  const readDenyActors = deps.readDenyActors ?? defaultReadDenyActors(cwd);
  const fetchCommits = deps.fetchCommits ?? defaultFetchCommits(repo, provider, deps);
  const fetchDecisions = deps.fetchDecisions ?? defaultFetchDecisions(repo, provider, deps);

  const botAllowlist = readBotAllowlist();
  const denyActors = readDenyActors();
  const issueNumber = extractIssueNumber(prBody, baseBranch);

  const commits = needsCommitEvidence(tier) && prNumber != null ? await fetchCommits(prNumber) : null;
  const decisions = needsDecisionEvidence(tier) && prNumber != null ? await fetchDecisions(prNumber) : null;
  const headSha = resolveHeadSha(commits);

  if (issueNumber == null) {
    return { author, issueAuthor: null, labeledEvents: [], botAllowlist, denyActors, adminOverride: false, overrideRefused: false, tier, commits, decisions, headSha };
  }

  const labeledEvents = await fetchLabeledEvents(issueNumber);
  const { labels: issueLabels, author: issueAuthor } = await fetchIssue(issueNumber);
  const overrideLabelPresent = issueLabels.some(l => l.startsWith('override:') && botAllowlist.includes(l));
  const adminOverride = honorOverride && overrideLabelPresent;
  const overrideRefused = overrideLabelPresent && !honorOverride;

  return { author, issueAuthor, labeledEvents, botAllowlist, denyActors, adminOverride, overrideRefused, tier, commits, decisions, headSha };
}

/**
 * Runs the full L5 actor check: gathers inputs (gh API + PR body), evaluates the
 * pure rule. Never throws — but a gh API failure inside `gatherActorCheckInputs`
 * no longer unconditionally degrades to `warn` (issue #358 Q5 Phase 5 review
 * finding 1). `actor-check` is `required` at EVERY tier (REQ-TIER-2's
 * never-tiered core, `GATE_MATRIX['actor-check']` — promoted out of
 * `PENDING_PROMOTION` in Phase 5): when the gate is required, an API failure
 * means the approval CANNOT BE VERIFIED, which is not the same thing as "no
 * approval yet" (REQ-L5-2's warn+pass branch, still handled inside
 * `evaluateActor` for the genuinely-computed "no labeled event" case). Failing
 * open on an unverifiable required gate would let a flaky `gh`/API outage
 * silently pass a check the doctrine says must block merge — the EXACT
 * asymmetry this fix closes against `evaluateDistinctAct`'s existing
 * fail-closed `prCommits: null` handling (same file, above): both paths now
 * agree that "cannot verify, required gate" fails, never warns. Only when the
 * resolved tier demotes this gate's POSITION to `detection` (not currently
 * true for `actor-check` — reserved for a future matrix change) does an API
 * failure still degrade to `warn`, mirroring `run-check.mjs`'s
 * `mapDetectionToWarning` discipline for detection-tier gates.
 *
 * Missing PR author/repo CONTEXT (the branch below, before any gh call is even
 * attempted) is a distinct case — this is not an API failure, it is "this run
 * has no PR to check" (e.g. a local/non-CI invocation) — and stays `warn`.
 *
 * `author`/`baseBranch`/`repo` source from the normalized ci-context (`ctx.*`,
 * ADR-0016) — never from process.env directly (a drift-guard test enforces
 * this). Per CP-A0 ruling 1, `author` is the PR author from the API payload
 * (`ctx.author`), NOT the pipeline-trigger env identity.
 * `prBody` is DETECTION-only: it falls back to PR_BODY via
 * `resolveDetectionBody()` when `ctx.body` is uncomputable (amendment 2 — this
 * fallback is sanctioned ONLY for DETECTION consumers like this check).
 *
 * This function is async as of issue #239 A3 — `gatherActorCheckInputs`
 * dispatches the `labelEvents` CONTRACT verb via `getVcs({ provider })`, a
 * Promise-returning call.
 *
 * @param {{ author?: string, prBody?: string, baseBranch?: string, repo?: string, cwd?: string, ctx?: object } & object} [deps]
 * @returns {Promise<{ level: 'pass'|'warn'|'fail', reason: string }>}
 */
export async function runActorCheck(deps = {}) {
  const ctx = deps.ctx ?? {};
  const author = deps.author ?? ctx.author ?? undefined;
  const prBody = deps.prBody ?? resolveDetectionBody(ctx, deps) ?? '';
  const baseBranch = deps.baseBranch ?? ctx.targetBranch ?? undefined;
  const repo = deps.repo ?? ctx.repo ?? undefined;
  const provider = deps.provider ?? ctx.provider ?? undefined;
  const prNumber = deps.prNumber ?? ctx.prNumber ?? undefined;
  const cwd = deps.cwd ?? process.cwd();

  if (!author || !repo) {
    return {
      level: 'warn',
      reason: 'PR_AUTHOR/GITHUB_REPOSITORY not set — cannot verify approval actor; skipping actor-check.',
    };
  }

  let inputs;
  try {
    inputs = await gatherActorCheckInputs({ author, prBody, baseBranch, repo, provider, prNumber, cwd, deps });
  } catch (err) {
    const tier = resolveTierForFailure(cwd, deps);
    if (resolveGatePolicy('actor-check', tier) === 'required') {
      return {
        level: 'fail',
        reason:
          `actor-check: could not gather inputs (gh api failure?) — ${err.message} — failing closed: ` +
          `actor-check is required at the "${tier}" tier (REQ-TIER-2's never-tiered core) and an ` +
          'unverifiable API failure cannot be treated as a pass (matches evaluateDistinctAct\'s existing ' +
          'fail-closed handling of an unreadable prCommits — issue #358 Q5 Phase 5 review finding 1).',
      };
    }
    return {
      level: 'warn',
      reason: `actor-check: could not gather inputs (gh api failure?) — ${err.message} (detection-tier at "${tier}").`,
    };
  }

  return evaluateActor(inputs);
}

/**
 * Runs the check, prints the verdict + reason, and returns the process exit
 * code — kept separate from `process.exit()` itself so it stays testable
 * (mirrors run-check.mjs / phase-order-check.mjs's main()). Exit 0 on
 * pass/warn, 1 on fail. Async as of A3 (awaits `runActorCheck`).
 *
 * @param {object} [deps]
 * @returns {Promise<0|1>}
 */
export async function main(deps = {}) {
  const result = await runActorCheck(deps);
  console.log(`actor-check: ${result.level}`);
  if (result.reason) console.log(`  ${result.reason}`);
  return result.level === 'fail' ? 1 : 0;
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ctx = await loadContext();
  process.exit(await main({ ctx }));
}
