// actor-check.mjs — L5 human-approval actor check: pure evaluator + gh I/O wrapper
// + CLI (design §5, REQ-L5-1, REQ-L5-2). Sibling to phase-order-check.mjs.
//
// Pure evaluator (evaluateActor) takes plain data — no gh, no filesystem — so it
// is fully unit-testable with fixture events. The gh I/O wrapper resolves the
// issue referenced by the PR body (reusing the same Closes/Fixes/Resolves/Part-of
// extraction rules governance.yml's issue-link job already enforces in bash),
// fetches the `status:approved` labeling history via `gh api .../events`, and
// feeds evaluateActor. All I/O is dependency-injectable via `deps` (same
// CI-fragility discipline as run-check.mjs / phase-order-check.mjs) — no test
// spawns a real gh process.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Pure evaluator (design §5 step 5) ───────────────────────────────────────

/**
 * Evaluates whether the `status:approved` actor is distinct from the PR/issue
 * author. Pure — no gh, no filesystem access (fully testable with fixtures).
 *
 * Decision order (design §5 step 5):
 *   1. No `labeled` event found → warn + pass (cannot prove self-approval on
 *      missing evidence — REQ-L5-2, keeps false positives ~0).
 *   2. `adminOverride` (an allow-listed `override:*` label is present) → pass,
 *      logged.
 *   3. Actor in `botAllowlist` (e.g. automation acting on a human's explicit
 *      instruction) → pass.
 *   4. Actor === author → fail (self-approval) — REQ-L5-1.
 *   5. Otherwise → pass (human-applied approval, actor differs from author).
 *
 * The "most recent" labeled event wins (handles re-labeling: remove → re-add
 * uses the latest add) — `labeledEvents` is assumed to be in the same
 * chronological order `gh api .../events` returns (ascending), so this simply
 * reads the last element.
 *
 * @param {object} input
 * @param {string} input.author  PR author login (design §5 step 1).
 * @param {Array<{ actor: { login: string } }>} input.labeledEvents  `labeled`
 *   events for the `status:approved` label, chronologically ordered.
 * @param {string[]} [input.botAllowlist]  Allow-listed actor logins / override
 *   label strings (`config.governance.approvalActors`).
 * @param {boolean} [input.adminOverride]  Whether an allow-listed `override:*`
 *   label is present on the issue (resolved by the wrapper against
 *   `botAllowlist` — never a blanket bypass, REQ-L5-2).
 * @returns {{ level: 'pass'|'warn'|'fail', reason: string }}
 */
export function evaluateActor({ author, labeledEvents = [], botAllowlist = [], adminOverride = false } = {}) {
  if (labeledEvents.length === 0) {
    return {
      level: 'warn',
      reason:
        'no labeled event found for status:approved — cannot verify the approval actor; ' +
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
      reason: `status:approved applied by allow-listed automation identity "${actor}".`,
    };
  }

  if (actor === author) {
    return {
      level: 'fail',
      reason: `status:approved was self-applied by the PR/issue author "${author}" — self-approval is not allowed.`,
    };
  }

  return {
    level: 'pass',
    reason: `status:approved applied by "${actor}", distinct from author "${author}".`,
  };
}

// ── Issue-number extraction (reused rules from governance.yml's issue-link job) ─
//
// Mirrors the bash regexes in .github/workflows/governance.yml's issue-link job
// exactly: base=main requires a closing keyword; a slice PR (base!=main) also
// accepts "Part of #N".

const CLOSING_KEYWORD_RE = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i;
const PART_OF_RE = /part\s+of\s+#(\d+)/i;

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
    const m = body.match(CLOSING_KEYWORD_RE);
    return m ? Number(m[1]) : null;
  }

  const partOf = body.match(PART_OF_RE);
  if (partOf) return Number(partOf[1]);

  const closing = body.match(CLOSING_KEYWORD_RE);
  return closing ? Number(closing[1]) : null;
}

// ── gh I/O wrapper ───────────────────────────────────────────────────────────

function defaultFetchLabeledEvents(repo) {
  return issueNumber => {
    // --paginate is REQUIRED: `gh api` does not auto-paginate, and the Events
    // API is oldest-first — on an issue with >~30 events, an unpaginated fetch
    // silently drops the newest labeled events (page 2+), including a late
    // self-applied `status:approved`, which would wrongly PASS (fail-open).
    const out = execFileSync(
      'gh',
      ['api', '--paginate', `repos/${repo}/issues/${issueNumber}/events`],
      { encoding: 'utf8' }
    );
    const events = JSON.parse(out);
    return events.filter(e => e.event === 'labeled' && e.label?.name === 'status:approved');
  };
}

function defaultFetchIssueLabels(repo) {
  return issueNumber => {
    const out = execFileSync('gh', ['api', `repos/${repo}/issues/${issueNumber}`], {
      encoding: 'utf8',
    });
    const issue = JSON.parse(out);
    return (issue.labels ?? []).map(l => l.name);
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

/**
 * Gathers evaluateActor()'s inputs from the PR body + gh API (or from injected
 * `deps` in tests). `adminOverride` is resolved here — an override:* label is
 * only honored when it is BOTH present on the issue AND listed in
 * `botAllowlist` (`config.governance.approvalActors`); an unlisted override:*
 * label grants nothing (REQ-L5-2 — no blanket bypass).
 *
 * @param {{ author: string, prBody: string, baseBranch: string, repo: string, cwd?: string, deps?: object }} args
 * @returns {{ author: string, labeledEvents: Array, botAllowlist: string[], adminOverride: boolean }}
 */
export function gatherActorCheckInputs({ author, prBody, baseBranch, repo, cwd = process.cwd(), deps = {} } = {}) {
  const fetchLabeledEvents = deps.fetchLabeledEvents ?? defaultFetchLabeledEvents(repo);
  const fetchIssueLabels = deps.fetchIssueLabels ?? defaultFetchIssueLabels(repo);
  const readBotAllowlist = deps.readBotAllowlist ?? defaultReadBotAllowlist(cwd);

  const botAllowlist = readBotAllowlist();
  const issueNumber = extractIssueNumber(prBody, baseBranch);

  if (issueNumber == null) {
    return { author, labeledEvents: [], botAllowlist, adminOverride: false };
  }

  const labeledEvents = fetchLabeledEvents(issueNumber);
  const issueLabels = fetchIssueLabels(issueNumber);
  const adminOverride = issueLabels.some(l => l.startsWith('override:') && botAllowlist.includes(l));

  return { author, labeledEvents, botAllowlist, adminOverride };
}

/**
 * Runs the full L5 actor check: gathers inputs (gh API + PR body), evaluates the
 * pure rule. Never throws — a gh API failure, or missing PR author/repo context,
 * degrades to `warn` rather than `fail`, keeping REQ-L5-2's zero-false-positive
 * goal intact while this job is detection-only (DETECTION_JOBS).
 *
 * @param {{ author?: string, prBody?: string, baseBranch?: string, repo?: string, cwd?: string } & object} [deps]
 * @returns {{ level: 'pass'|'warn'|'fail', reason: string }}
 */
export function runActorCheck(deps = {}) {
  const author = deps.author ?? process.env.PR_AUTHOR;
  const prBody = deps.prBody ?? process.env.PR_BODY ?? '';
  const baseBranch = deps.baseBranch ?? process.env.BASE_BRANCH;
  const repo = deps.repo ?? process.env.GITHUB_REPOSITORY;
  const cwd = deps.cwd ?? process.cwd();

  if (!author || !repo) {
    return {
      level: 'warn',
      reason: 'PR_AUTHOR/GITHUB_REPOSITORY not set — cannot verify approval actor; skipping actor-check.',
    };
  }

  let inputs;
  try {
    inputs = gatherActorCheckInputs({ author, prBody, baseBranch, repo, cwd, deps });
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
  process.exit(main());
}
