// run-check.mjs — thin git/IO runner wrapping governance's pure checks (design §4).
//
// Usage: node brain/scripts/governance/run-check.mjs <memory-gate|decision-gate|issue-link|diff-size>
//
// All decision logic lives in the already-tested pure functions
// (memoryPresence, adrPresence, issueLink, diffSize). This file is git/IO
// glue only:
//   memory-gate    → memoryPresence(readRecordObservations(cwd))
//   decision-gate  → adrPresence(git diff --name-only BASE_SHA...HEAD_SHA)
//   issue-link     → issueLink(ctx.body) + referenced-issue approved-label check
//   diff-size      → diffSize(git diff --numstat BASE_SHA...HEAD_SHA, ignoreList)
//
// RECORDS-ONLY (C4/D4, REQ-C4-4): the #227 transitional chunks/records union
// ("Retire the chunks-path once fully decommissioned — tracked for C4/D1") is
// retired here. The memory-gate reads `.memory/records/*.jsonl` alone — the
// chunks reader (`chunk-reader.mjs`) is no longer imported by this file.
//
// CI FRAGILITY: BASE_SHA/HEAD_SHA come from the normalized ci-context seam
// (ADR-0016), never read from process.env directly here — ci-context.mjs is
// the sole module allowed to read pipeline env (a drift-guard test enforces
// this). All I/O is injectable via `deps` so tests never touch the real
// filesystem or spawn a real git process.
//
// FAIL-CLOSED: decision-gate is a REQUIRED gate. If the diff cannot be
// computed (ctx.baseSha/headSha null/uncomputable, or the git command
// throwing), defaultDiffNameOnly() THROWS rather than degrading to `[]` — an
// empty diff would otherwise read as "no architectural change" and let
// adrPresence pass silently. runCheck() catches the throw and fails the gate
// closed instead.
//
// THE GOTCHA (issue #231 A2 phase 2, design.md Decision 2): GitLab exposes no
// CI_MERGE_REQUEST_DESCRIPTION var and its CI_MERGE_REQUEST_LABELS freeze at
// pipeline creation (ADR-0016:45), so issue-link/diff-size cannot be bash on
// GitLab the way they are on GitHub. The MR body + FRESH labels exist only
// behind loadContext()/loadGitlabContext() (one proxy-aware API call). Both
// new cases here call the ALREADY-EXISTING pure evaluators
// (checks/issue-link.mjs#issueLink, checks/diff-size.mjs#diffSize — UNCHANGED,
// ADR-0016 boundary) fed by `ctx`. `size:exception` and the referenced-issue
// approved-label read come from FRESH `ctx.labels`/an injected issue-fetch,
// NEVER from CI_MERGE_REQUEST_LABELS. issue-link is REQUIRED and fails closed
// on `ctx.body === null` — this falls out naturally from issueLink(null)
// itself returning `{ pass: false }` (typeof-string guard), so no special
// casing is needed here; a dedicated test still proves it (never exit 0).
//
// THE ADDENDUM GOTCHA (issue #231 A2 phase 2 ADDENDUM — base-branch parity
// gap): GitHub bash's issue-link job (governance.yml:45-70) is BASE-BRANCH-
// CONDITIONAL — base==default branch requires a CLOSING keyword only; a
// slice target (base!=default) also accepts "Part of #N". The pure
// issueLink() evaluator is NOT base-branch-aware (REQ-CIC-4 — it stays
// UNCHANGED), so without the wrapper-level check below, a "Part of #N"-only
// body would wrongly PASS the Node path even on the default branch — a
// governance hole. `runIssueLinkCheck` closes this with
// `requiresClosingKeyword(ctx)`, fed by ci-context's new `ctx.defaultBranch`
// (REQ-CIC-2 delta): the platform's actual default branch, never a
// hardcoded 'main' literal (platforms only run closing keywords on merges
// to the default branch, GitHub and GitLab alike — this is not a naming
// convention). `ctx.defaultBranch === null` (uncomputable) FAILS CLOSED,
// never falls back to comparing against 'main'.

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { memoryPresence } from './checks/memory-presence.mjs';
import { adrPresence } from './checks/adr-presence.mjs';
import { issueLink } from './checks/issue-link.mjs';
import { diffSize } from './checks/diff-size.mjs';
import { CLOSING_RE, CHAIN_RE } from './checks/issue-ref-patterns.mjs';
import { resolveApprovedLabel } from './approved-label.mjs';
import { readRecordObservations } from '../memory/lib/store.mjs';
import { loadContext, gitlabApiConfig } from '../vcs/ci-context.mjs';
import { loadBrainConfig } from '../lib/brain-config.mjs';
import { getVcs } from '../vcs/cli.mjs';

/**
 * Default `readRecords` dep for the memory-gate (issue #222 cutover fix):
 * best-effort reads `<cwd>/.memory/records/*.jsonl` via the transitional
 * `readRecordObservations`. Never throws — see that function's contract.
 *
 * @param {string} cwd
 * @returns {Array<{type?: string, [key: string]: unknown}>}
 */
function defaultReadRecords(cwd) {
  return readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') });
}

/**
 * Computes `git diff --name-only $baseSha...$headSha` from the normalized
 * ci-context (`ctx.baseSha`/`ctx.headSha`). Throws when either is null/absent
 * or the git command fails — the diff-gate must fail closed rather than
 * silently treat an uncomputable diff as an empty (harmless) one.
 *
 * @param {{ baseSha?: string|null, headSha?: string|null }} ctx
 * @returns {string[]}
 */
function defaultDiffNameOnly(ctx = {}) {
  const base = ctx.baseSha;
  const head = ctx.headSha;
  if (!base || !head) {
    throw new Error('BASE_SHA/HEAD_SHA not set — cannot compute diff');
  }
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean);
  } catch (err) {
    throw new Error(`git diff failed: ${err.message}`);
  }
}

/**
 * Computes `git diff --numstat $baseSha...$headSha` from the normalized
 * ci-context (`ctx.baseSha`/`ctx.headSha`). Throws when either is null/absent
 * or the git command fails — mirrors defaultDiffNameOnly's fail-closed
 * contract (diff-size is REQUIRED too).
 *
 * @param {{ baseSha?: string|null, headSha?: string|null }} ctx
 * @returns {string}
 */
function defaultDiffNumstat(ctx = {}) {
  const base = ctx.baseSha;
  const head = ctx.headSha;
  if (!base || !head) {
    throw new Error('BASE_SHA/HEAD_SHA not set — cannot compute diff');
  }
  try {
    return execFileSync('git', ['diff', '--numstat', `${base}...${head}`], {
      encoding: 'utf8',
    });
  } catch (err) {
    throw new Error(`git diff failed: ${err.message}`);
  }
}

/**
 * Default `readConfig` dep for issue-link/diff-size: reads brain.config.json
 * via the shared loader. Never throws — an unreadable/missing config degrades
 * to `{}` (resolveApprovedLabel/ignoreList both tolerate an empty config).
 *
 * @returns {object}
 */
function defaultReadConfig() {
  try {
    return loadBrainConfig();
  } catch {
    return {};
  }
}

/**
 * Default `fetchIssue` dep for issue-link: fetches the referenced issue via
 * the active VCS provider's `issueView` verb (github → gh CLI; gitlab →
 * direct API v4 fetch, issue #231 CP-A2b finding #12 — the `glab` CLI is
 * absent from the node:22 CI image). Never called in tests — always injected
 * there (design.md Decision 2: "no real network in tests").
 *
 * `gitlabApiConfig()` sources { apiBase, token, proxyUrl } from the
 * sanctioned env reader (ci-context.mjs) — run-check.mjs itself is a
 * GATE_FILE and must never read the GitLab API base URL pipeline var
 * directly (ci-context-drift-guard.test.mjs forbids it). github.mjs's
 * issueView ignores the extra keys (destructures only `{ project, number }`),
 * so passing them unconditionally is harmless for GitHub.
 *
 * @param {{ repo?: string|null }} ctx
 * @returns {(issueNumber: number) => Promise<{ labels?: string[] }>}
 */
function defaultFetchIssue(ctx) {
  return async (issueNumber) => {
    const vcs = await getVcs();
    const { apiBase, token, proxyUrl } = gitlabApiConfig();
    return vcs.issueView({ project: ctx.repo, number: issueNumber, apiBase, token, proxyUrl });
  };
}

// CLOSING_RE/CHAIN_RE come from the shared checks/issue-ref-patterns.mjs
// (issue #231 CP-A2a review, finding M1 — this file previously duplicated
// its OWN narrower CLOSING_NUM_RE; deleted in favor of the one shared
// constant, now imported by issueLink(), this file, AND actor-check.mjs).
// The pure issueLink() evaluator stays UNCHANGED in shape (per ADR-0016) —
// this file needs the matched NUMBER, not just pass/fail, to know which
// issue's labels to verify, so it matches the same shared regex again here.

/**
 * Extracts the referenced issue number from a PR/MR body, mirroring GitHub
 * bash's OWN branch-conditional precedence (issue #231 CP-A2a review,
 * finding m2 — governance.yml:55-81) rather than a single fixed order:
 *   - Default-branch target (`closingRequired`): the default-branch policy
 *     already requires a closing keyword, so ONLY the closing pattern is
 *     consulted (mirrors governance.yml:56-64 — no Part-of fallback there).
 *   - Slice target (`!closingRequired`): Part-of is tried FIRST, then
 *     closing (mirrors governance.yml:69-76 exactly). This matters when a
 *     body carries BOTH patterns pointing at DIFFERENT issues — bash always
 *     resolves the Part-of issue on a slice target; before m2 this file
 *     always resolved the closing issue instead (a fail-OPEN divergence).
 *
 * @param {string} body
 * @param {boolean} closingRequired  From requiresClosingKeyword(ctx) — true
 *   when ctx.targetBranch === ctx.defaultBranch.
 * @returns {number|null}
 */
function extractIssueNumber(body, closingRequired) {
  if (typeof body !== 'string') return null;

  if (closingRequired) {
    const closing = body.match(CLOSING_RE);
    return closing ? Number(closing[2]) : null;
  }

  const chain = body.match(CHAIN_RE);
  if (chain) return Number(chain[1]);
  const closing = body.match(CLOSING_RE);
  return closing ? Number(closing[2]) : null;
}

/**
 * Default-branch-conditionality (issue #231 A2 phase 2 ADDENDUM — closes the
 * base-branch parity gap vs GitHub bash, governance.yml:45-70): the platform
 * only runs closing keywords (Closes/Fixes/Resolves) on merges to the
 * DEFAULT branch (GitHub and GitLab alike), so the gate mirrors where the
 * keyword actually has effect, not a naming convention ('main'). The pure
 * issueLink() evaluator stays base-branch-UNAWARE by design (REQ-CIC-4) — the
 * conditionality lives HERE, in the wrapper, fed by ci-context's
 * `defaultBranch` (REQ-CIC-2 delta).
 *
 * @param {{ targetBranch?: string|null, defaultBranch?: string|null }} ctx
 * @returns {boolean|null} true = closing keyword required (default-branch
 *   target); false = "Part of #N" also accepted (slice target); null =
 *   indeterminate — targetBranch or defaultBranch is uncomputable, so the
 *   conditional cannot be decided.
 */
function requiresClosingKeyword(ctx) {
  if (ctx.targetBranch == null || ctx.defaultBranch == null) return null;
  return ctx.targetBranch === ctx.defaultBranch;
}

/**
 * issue-link case (REQUIRED, THE GOTCHA — design.md Decision 2, extended by
 * the A2 phase 2 ADDENDUM): calls the pure issueLink(ctx.body) for the
 * reference pattern, applies the default-branch-conditional closing-keyword
 * policy (see requiresClosingKeyword — FAIL-CLOSED, never assumes 'main' when
 * `ctx.defaultBranch` is uncomputable), then verifies the referenced issue
 * carries the resolved approved label via an injectable `fetchIssue`. Fails
 * closed with a DISTINCT self-diagnostic reason on a non-string body (the
 * wrapper catches it before issueLink() — "context API fetch failed", vs the
 * "no issue reference found" of a string with no link), on an uncomputable
 * target/default branch, and on a fetch failure.
 *
 * @param {{ body?: string|null, provider?: string, repo?: string|null, targetBranch?: string|null, defaultBranch?: string|null }} ctx
 * @param {{ fetchIssue?: Function, readConfig?: () => object }} deps
 * @returns {Promise<{ pass: boolean, reason?: string }>}
 */
async function runIssueLinkCheck(ctx, deps) {
  // Self-diagnostic distinction (finding #12 follow-up): a NON-STRING body means
  // ci-context could not fetch the MR description (token/endpoint/API failure) —
  // an INFRA fail-closed, not a governance miss. Distinguish it in the message so
  // a failing pipeline log discriminates (A) "no issue link" from (B) "couldn't
  // read the MR body". The pure issueLink() evaluator stays UNCHANGED (REQ-CIC-4);
  // it only ever sees a string below.
  if (typeof ctx.body !== 'string') {
    return {
      pass: false,
      reason: 'issue-link: MR body uncomputable (context API fetch failed) — failing closed',
    };
  }
  const linkResult = issueLink(ctx.body);
  if (!linkResult.pass) return linkResult;

  const closingRequired = requiresClosingKeyword(ctx);
  if (closingRequired === null) {
    return {
      pass: false,
      reason:
        'issue-link: cannot determine whether the PR targets the default branch ' +
        '(ctx.targetBranch or ctx.defaultBranch is null/uncomputable) — failing ' +
        'closed rather than assuming "main".',
    };
  }
  if (closingRequired && !CLOSING_RE.test(ctx.body)) {
    return {
      pass: false,
      reason:
        'issue-link: PR targets the default branch and must use a closing ' +
        'keyword (Close(s|d)|Fix(es|ed)|Resolve(s|d) #N) — "Part of #N" alone ' +
        'is only accepted on non-default (slice) targets.',
    };
  }

  const issueNumber = extractIssueNumber(ctx.body, closingRequired);
  if (issueNumber == null) {
    return {
      pass: false,
      reason: 'issue-link: matched a reference pattern but could not extract an issue number',
    };
  }

  const fetchIssue = deps.fetchIssue ?? defaultFetchIssue(ctx);
  let issue;
  try {
    issue = await fetchIssue(issueNumber);
  } catch (err) {
    return {
      pass: false,
      reason: `issue-link: could not fetch issue #${issueNumber} — failing closed: ${err.message}`,
    };
  }

  const readConfig = deps.readConfig ?? defaultReadConfig;
  const approvedLabel = resolveApprovedLabel(readConfig(), ctx.provider);
  const issueLabels = issue?.labels ?? [];
  if (!issueLabels.includes(approvedLabel)) {
    return {
      pass: false,
      reason: `issue-link: issue #${issueNumber} is not labeled ${approvedLabel}`,
    };
  }
  return { pass: true };
}

/**
 * diff-size case (REQUIRED): reads `size:exception` from FRESH `ctx.labels`
 * (never CI_MERGE_REQUEST_LABELS — design.md Decision 2) and skips the
 * budget check when present; otherwise computes `git diff --numstat` (via an
 * injectable `diffNumstat` dep) and delegates to the pure diffSize().
 *
 * @param {{ labels?: string[]|null, baseSha?: string|null, headSha?: string|null }} ctx
 * @param {{ diffNumstat?: Function, readConfig?: () => object }} deps
 * @returns {Promise<{ pass: boolean, reason?: string }>}
 */
async function runDiffSizeCheck(ctx, deps) {
  const labels = ctx.labels ?? [];
  if (labels.includes('size:exception')) {
    return { pass: true, reason: 'size:exception label present — skipping diff-size gate.' };
  }

  const diffNumstat = deps.diffNumstat ?? (() => defaultDiffNumstat(ctx));
  let numstat;
  try {
    numstat = diffNumstat();
  } catch (err) {
    return {
      pass: false,
      reason: `cannot compute diff — failing closed: ${err.message}`,
    };
  }

  const readConfig = deps.readConfig ?? defaultReadConfig;
  const config = readConfig();
  const ignoreList = Array.isArray(config?.governance?.ignoreList) ? config.governance.ignoreList : [];
  return diffSize(numstat, ignoreList);
}

/**
 * Runs a named governance check via its pure function, computing inputs from
 * git/IO (or from injected `deps` in tests).
 *
 * @param {'memory-gate'|'decision-gate'|'issue-link'|'diff-size'} checkName
 * @param {{ cwd?: string, ctx?: object, readRecords?: (cwd: string) => unknown[], diffNameOnly?: () => string[], fetchIssue?: Function, diffNumstat?: Function, readConfig?: () => object }} [deps]
 * @returns {Promise<{ pass: boolean, reason?: string }>}
 */
export async function runCheck(checkName, deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const readRecords = deps.readRecords ?? defaultReadRecords;
  const ctx = deps.ctx ?? {};
  const diffNameOnly = deps.diffNameOnly ?? (() => defaultDiffNameOnly(ctx));

  if (checkName === 'memory-gate') {
    return memoryPresence(readRecords(cwd));
  }
  if (checkName === 'decision-gate') {
    let changedFiles;
    try {
      changedFiles = diffNameOnly();
    } catch (err) {
      return {
        pass: false,
        reason: `cannot compute diff — failing closed: ${err.message}`,
      };
    }
    return adrPresence(changedFiles);
  }
  if (checkName === 'issue-link') {
    return runIssueLinkCheck(ctx, deps);
  }
  if (checkName === 'diff-size') {
    return runDiffSizeCheck(ctx, deps);
  }
  throw new Error(`run-check.mjs: unknown check "${checkName}"`);
}

/**
 * Runs the named check, prints the reason (if any), and returns the process
 * exit code — kept separate from `process.exit()` itself so it stays testable.
 *
 * @param {string} checkName
 * @param {object} [deps]
 * @returns {Promise<0|1>}
 */
export async function main(checkName, deps = {}) {
  const result = await runCheck(checkName, deps);
  if (result.reason) console.log(result.reason);
  return result.pass ? 0 : 1;
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ctx = await loadContext();
  process.exit(await main(process.argv[2], { ctx }));
}
