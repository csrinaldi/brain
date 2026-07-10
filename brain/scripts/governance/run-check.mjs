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

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { memoryPresence } from './checks/memory-presence.mjs';
import { adrPresence } from './checks/adr-presence.mjs';
import { issueLink } from './checks/issue-link.mjs';
import { diffSize } from './checks/diff-size.mjs';
import { resolveApprovedLabel } from './approved-label.mjs';
import { readRecordObservations } from '../memory/lib/store.mjs';
import { loadContext } from '../vcs/ci-context.mjs';
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
 * the active VCS provider's `issueView` verb (github → gh CLI, gitlab → glab
 * CLI). Never called in tests — always injected there (design.md Decision 2:
 * "no real network in tests").
 *
 * @param {{ repo?: string|null }} ctx
 * @returns {(issueNumber: number) => Promise<{ labels?: string[] }>}
 */
function defaultFetchIssue(ctx) {
  return async (issueNumber) => {
    const vcs = await getVcs();
    return vcs.issueView({ project: ctx.repo, number: issueNumber });
  };
}

// Mirrors checks/issue-link.mjs's CLOSING_RE/CHAIN_RE exactly (the pure
// evaluator stays UNCHANGED per ADR-0016 — this file needs the matched
// NUMBER, not just pass/fail, to know which issue's labels to verify).
const CLOSING_NUM_RE = /\b(?:closes|fixes|resolves)\s+#(\d+)/i;
const CHAIN_NUM_RE = /\bpart\s+of\s+#(\d+)/i;

/**
 * Extracts the referenced issue number from a PR/MR body, using the SAME
 * pattern precedence as issueLink() (closing keyword first, then "Part of
 * #N") — never base-branch-conditional (issueLink() itself is not).
 *
 * @param {string} body
 * @returns {number|null}
 */
function extractIssueNumber(body) {
  if (typeof body !== 'string') return null;
  const closing = body.match(CLOSING_NUM_RE);
  if (closing) return Number(closing[1]);
  const chain = body.match(CHAIN_NUM_RE);
  if (chain) return Number(chain[1]);
  return null;
}

/**
 * issue-link case (REQUIRED, THE GOTCHA — design.md Decision 2): calls the
 * pure issueLink(ctx.body) for the reference pattern, then verifies the
 * referenced issue carries the resolved approved label via an injectable
 * `fetchIssue`. Fails closed on a null/uncomputable body (issueLink() itself
 * returns `{ pass: false }` for a non-string body) and on a fetch failure.
 *
 * @param {{ body?: string|null, provider?: string, repo?: string|null }} ctx
 * @param {{ fetchIssue?: Function, readConfig?: () => object }} deps
 * @returns {Promise<{ pass: boolean, reason?: string }>}
 */
async function runIssueLinkCheck(ctx, deps) {
  const linkResult = issueLink(ctx.body);
  if (!linkResult.pass) return linkResult;

  const issueNumber = extractIssueNumber(ctx.body);
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
