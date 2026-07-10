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

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadContext, resolveDetectionBody } from './ci-context.mjs';
import { resolveApprovedLabel } from '../governance/approved-label.mjs';
import { CLOSING_RE, CHAIN_RE } from '../governance/checks/issue-ref-patterns.mjs';

// ── Pure evaluator (design §5 step 5) ───────────────────────────────────────

/**
 * Evaluates whether the approved-label actor is distinct from the PR/issue
 * author. Pure — no gh, no filesystem access (fully testable with fixtures).
 *
 * Decision order (design §5 step 5):
 *   1. No `labeled` event found → warn + pass (cannot prove self-approval on
 *      missing evidence — REQ-L5-2, keeps false positives ~0).
 *   2. `adminOverride` (an allow-listed `override:*` label is present) → pass,
 *      logged.
 *   3. Actor in `botAllowlist` (e.g. automation acting on a human's explicit
 *      instruction) → pass.
 *   4. Actor === author OR actor === issueAuthor → fail (self-approval) —
 *      REQ-L5-1 requires comparing against BOTH the PR author and the issue
 *      author (spec.md:398-400): the PR author and the issue author can be
 *      two different people (e.g. Bob files the issue, Alice opens the PR),
 *      and either one self-labeling their own issue counts as self-approval.
 *   5. Otherwise → pass (human-applied approval, actor differs from both).
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
 * @param {Array<{ actor: { login: string } }>} input.labeledEvents  `labeled`
 *   events for the resolved approved label, chronologically ordered.
 * @param {string[]} [input.botAllowlist]  Allow-listed actor logins / override
 *   label strings (`config.governance.approvalActors`).
 * @param {boolean} [input.adminOverride]  Whether an allow-listed `override:*`
 *   label is present on the issue (resolved by the wrapper against
 *   `botAllowlist` — never a blanket bypass, REQ-L5-2).
 * @returns {{ level: 'pass'|'warn'|'fail', reason: string }}
 */
export function evaluateActor({
  author,
  issueAuthor,
  labeledEvents = [],
  botAllowlist = [],
  adminOverride = false,
} = {}) {
  if (labeledEvents.length === 0) {
    return {
      level: 'warn',
      reason:
        'no labeled event found for the approved label — cannot verify the approval actor; ' +
        'never failing on missing evidence (REQ-L5-2).',
    };
  }

  const actor = labeledEvents[labeledEvents.length - 1]?.actor?.login;

  if (adminOverride) {
    return {
      level: 'pass',
      reason: `admin override present (allow-listed override:* label) — approval actor check bypassed (actor: ${actor ?? 'unknown'}).`,
    };
  }

  if (actor && botAllowlist.includes(actor)) {
    return {
      level: 'pass',
      reason: `the approved label was applied by allow-listed automation identity "${actor}".`,
    };
  }

  if (actor === author || (issueAuthor && actor === issueAuthor)) {
    const matched = actor === author ? 'PR author' : 'issue author';
    return {
      level: 'fail',
      reason: `the approved label was self-applied by "${actor}" (matches the ${matched}) — self-approval is not allowed.`,
    };
  }

  return {
    level: 'pass',
    reason: `the approved label was applied by "${actor}", distinct from the PR author "${author}" and the issue author "${issueAuthor ?? 'n/a'}".`,
  };
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
 * Filters `gh api .../events` output down to `labeled` events for the
 * resolved approved label. Pure — exported for unit testing the
 * provider-resolved wiring without spawning a real `gh` process (issue #231
 * A2 phase 1).
 *
 * @param {Array<{ event?: string, label?: { name?: string } }>} events
 * @param {string} approvedLabel
 * @returns {Array<{ event: string, label: { name: string } }>}
 */
export function filterLabeledEvents(events, approvedLabel) {
  return events.filter(e => e.event === 'labeled' && e.label?.name === approvedLabel);
}

function defaultFetchLabeledEvents(repo, approvedLabel) {
  return issueNumber => {
    // --paginate is REQUIRED: `gh api` does not auto-paginate, and the Events
    // API is oldest-first — on an issue with >~30 events, an unpaginated fetch
    // silently drops the newest labeled events (page 2+), including a late
    // self-applied approved label, which would wrongly PASS (fail-open).
    const out = execFileSync(
      'gh',
      ['api', '--paginate', `repos/${repo}/issues/${issueNumber}/events`],
      { encoding: 'utf8' }
    );
    const events = JSON.parse(out);
    return filterLabeledEvents(events, approvedLabel);
  };
}

function defaultFetchIssue(repo) {
  return issueNumber => {
    // Single-object fetch (not a list endpoint) — no --paginate needed here.
    const out = execFileSync('gh', ['api', `repos/${repo}/issues/${issueNumber}`], {
      encoding: 'utf8',
    });
    const issue = JSON.parse(out);
    return {
      labels: (issue.labels ?? []).map(l => l.name),
      author: issue.user?.login ?? null,
    };
  };
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
 * Gathers evaluateActor()'s inputs from the PR body + gh API (or from injected
 * `deps` in tests). `adminOverride` is resolved here — an override:* label is
 * only honored when it is BOTH present on the issue AND listed in
 * `botAllowlist` (`config.governance.approvalActors`); an unlisted override:*
 * label grants nothing (REQ-L5-2 — no blanket bypass). `issueAuthor` is
 * surfaced from the same issue-object fetch used for labels (`fetchIssue`) —
 * no second gh round-trip — so evaluateActor can compare the approving actor
 * against BOTH the PR author and the issue author (REQ-L5-1).
 *
 * `provider` (github|gitlab, from `ctx.provider`) resolves the approved label
 * (`governance.approvedLabel`, issue #231 A2 phase 1) for the default
 * `fetchLabeledEvents` wrapper; an injected `deps.fetchLabeledEvents` bypasses
 * resolution entirely (as tests do).
 *
 * @param {{ author: string, prBody: string, baseBranch: string, repo: string, provider?: string, cwd?: string, deps?: object }} args
 * @returns {{ author: string, issueAuthor: string|null, labeledEvents: Array, botAllowlist: string[], adminOverride: boolean }}
 */
export function gatherActorCheckInputs({ author, prBody, baseBranch, repo, provider, cwd = process.cwd(), deps = {} } = {}) {
  const readConfig = deps.readConfig ?? defaultReadConfig(cwd);
  const approvedLabel = resolveApprovedLabel(readConfig(), provider);

  const fetchLabeledEvents = deps.fetchLabeledEvents ?? defaultFetchLabeledEvents(repo, approvedLabel);
  const fetchIssue = deps.fetchIssue ?? defaultFetchIssue(repo);
  const readBotAllowlist = deps.readBotAllowlist ?? defaultReadBotAllowlist(cwd);

  const botAllowlist = readBotAllowlist();
  const issueNumber = extractIssueNumber(prBody, baseBranch);

  if (issueNumber == null) {
    return { author, issueAuthor: null, labeledEvents: [], botAllowlist, adminOverride: false };
  }

  const labeledEvents = fetchLabeledEvents(issueNumber);
  const { labels: issueLabels, author: issueAuthor } = fetchIssue(issueNumber);
  const adminOverride = issueLabels.some(l => l.startsWith('override:') && botAllowlist.includes(l));

  return { author, issueAuthor, labeledEvents, botAllowlist, adminOverride };
}

/**
 * Runs the full L5 actor check: gathers inputs (gh API + PR body), evaluates the
 * pure rule. Never throws — a gh API failure, or missing PR author/repo context,
 * degrades to `warn` rather than `fail`, keeping REQ-L5-2's zero-false-positive
 * goal intact while this job is detection-only (DETECTION_JOBS).
 *
 * `author`/`baseBranch`/`repo` source from the normalized ci-context (`ctx.*`,
 * ADR-0016) — never from process.env directly (a drift-guard test enforces
 * this). Per CP-A0 ruling 1, `author` is the PR author from the API payload
 * (`ctx.author`), NOT the pipeline-trigger env identity.
 * `prBody` is DETECTION-only: it falls back to PR_BODY via
 * `resolveDetectionBody()` when `ctx.body` is uncomputable (amendment 2 — this
 * fallback is sanctioned ONLY for DETECTION consumers like this check).
 *
 * @param {{ author?: string, prBody?: string, baseBranch?: string, repo?: string, cwd?: string, ctx?: object } & object} [deps]
 * @returns {{ level: 'pass'|'warn'|'fail', reason: string }}
 */
export function runActorCheck(deps = {}) {
  const ctx = deps.ctx ?? {};
  const author = deps.author ?? ctx.author ?? undefined;
  const prBody = deps.prBody ?? resolveDetectionBody(ctx, deps) ?? '';
  const baseBranch = deps.baseBranch ?? ctx.targetBranch ?? undefined;
  const repo = deps.repo ?? ctx.repo ?? undefined;
  const provider = deps.provider ?? ctx.provider ?? undefined;
  const cwd = deps.cwd ?? process.cwd();

  if (!author || !repo) {
    return {
      level: 'warn',
      reason: 'PR_AUTHOR/GITHUB_REPOSITORY not set — cannot verify approval actor; skipping actor-check.',
    };
  }

  let inputs;
  try {
    inputs = gatherActorCheckInputs({ author, prBody, baseBranch, repo, provider, cwd, deps });
  } catch (err) {
    return {
      level: 'warn',
      reason: `actor-check: could not gather inputs (gh api failure?) — ${err.message}`,
    };
  }

  return evaluateActor(inputs);
}

/**
 * Runs the check, prints the verdict + reason, and returns the process exit
 * code — kept separate from `process.exit()` itself so it stays testable
 * (mirrors run-check.mjs / phase-order-check.mjs's main()). Exit 0 on
 * pass/warn, 1 on fail.
 *
 * @param {object} [deps]
 * @returns {0|1}
 */
export function main(deps = {}) {
  const result = runActorCheck(deps);
  console.log(`actor-check: ${result.level}`);
  if (result.reason) console.log(`  ${result.reason}`);
  return result.level === 'fail' ? 1 : 0;
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ctx = await loadContext();
  process.exit(main({ ctx }));
}
