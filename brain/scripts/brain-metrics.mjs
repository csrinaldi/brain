#!/usr/bin/env node
// brain-metrics.mjs — governance-effectiveness metrics, re-derived from
// brain's own merged git history (issue #324, M9).
//
// Usage: node brain/scripts/brain-metrics.mjs [<git-range>] [--json] [--period=month|week]
// Default range: origin/main..HEAD (falls back to HEAD if origin/main is absent) — audit parity.
// Default period: month.
//
// Read-only reporting verb, detection-only: introduces ZERO new governance
// gates, invariants, or CI-blocking behavior. Re-executes the SAME pure check
// functions brain-audit runs (via lib/merge-walk.mjs's shared evidence +
// verdict layers), over the same first-parent merge walk — measurement can
// never drift from enforcement because it is the same code (design D1).
//
// Per period bucket: changes-merged count, median lead time (issue's last
// `status:approved` label-add before merge → merge date — an ISSUE-APPROVAL
// PROXY, not PR-review-approval time), raw/enforced failure counts for
// diff-size/issue-link/decision-gate (decision-gate counts only PRs labeled
// "decision" — mixed enforcement), bypass usage (size:exception,
// skip:memory-gate — RAW label counts, size:exception is subtracted to form
// "enforced" but skip:memory-gate NEVER is: it is documented, not enforced
// anywhere in code), and DETECTION_JOBS as a single pass/fail column (never
// blocking, no raw/enforced split).
//
// memory-gate (memoryPresence) and memory-records coverage are BOTH
// repo-level, not per-period signals (design D3 / spec's Memory-record
// coverage requirement) — printed once, separately from the period table.
//
// Exit: 0 on a normal report (including "no data for this range") — this is
// a reporting tool, not an enforcement gate. Non-zero ONLY when the range
// itself cannot be resolved (E3 — an actionable CLI usage error, not a
// governance verdict).

import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  listMerges, readMergeParent, readMergeDiff, fetchPrMeta, resolveVcs, evaluateMerge, resolvedSkipLine,
} from './lib/merge-walk.mjs';
import { selectIssueLinkBody, parsePrNumber } from './lib/audit-helpers.mjs';
import { readRecordObservations } from './memory/lib/store.mjs';
import { makeGit } from './governance/postmerge/resolution.mjs';
import { gitOrThrow } from './governance/postmerge/git-seam.mjs';
import { memoryPresence } from './governance/checks/memory-presence.mjs';
import { CLOSING_RE, CHAIN_RE } from './governance/checks/issue-ref-patterns.mjs';
import { resolveApprovedLabel } from './governance/approved-label.mjs';
import {
  emptyRows, foldMerge, finalizeRows, PER_PERIOD_GATES, DETECTION_JOB_NAMES,
} from './lib/metrics-aggregate.mjs';
import { leadTimeDays } from './lib/lead-time.mjs';
import { computeMemoryCoverage } from './lib/memory-coverage.mjs';

// ── Argument parsing (Phase 4.1) ─────────────────────────────────────────────

/**
 * Parse CLI arguments. Positional `<git-range>` (design D7 — mirrors
 * `brain:audit`'s own positional arg, never a `--range=` flag), `--json`,
 * `--period=month|week`.
 *
 * @param {string[]} argv  `process.argv.slice(2)`.
 * @returns {{ range: string|undefined, json: boolean, period: 'month'|'week' }}
 */
export function parseArgs(argv) {
  let range;
  let json = false;
  let period = 'month';
  for (const arg of argv) {
    if (arg === '--json') { json = true; continue; }
    if (arg.startsWith('--period=')) { period = arg.slice('--period='.length); continue; }
    if (arg.startsWith('--')) {
      throw new Error(`brain-metrics: unrecognized flag "${arg}"`);
    }
    if (range !== undefined) {
      throw new Error(`brain-metrics: unexpected extra argument "${arg}" (only one <git-range> is accepted)`);
    }
    range = arg;
  }
  if (period !== 'month' && period !== 'week') {
    throw new Error(`brain-metrics: --period must be "month" or "week" (got "${period}")`);
  }
  return { range, json, period };
}

/** Default range resolution — audit parity (origin/main..HEAD, else HEAD). */
function resolveDefaultRange(cwd) {
  try {
    execSync('git rev-parse origin/main', { encoding: 'utf8', cwd, stdio: 'pipe' });
    return 'origin/main..HEAD';
  } catch {
    return 'HEAD';
  }
}

/** Load brain.config.json; returns {} on any error (never throws). */
function loadConfig(cwd) {
  try {
    return JSON.parse(readFileSync(join(cwd, 'brain.config.json'), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Extract the issue number a merge references (shared CLOSING_RE/CHAIN_RE
 * vocabulary, issue-ref-patterns.mjs) — the issue whose `status:approved`
 * label-add timestamp anchors lead time (design D4). Distinct from the PR
 * number `fetchPrMeta` parses from the subject.
 *
 * @param {string} body
 * @returns {number|null}
 */
export function extractIssueNumber(body) {
  if (typeof body !== 'string') return null;
  const closing = CLOSING_RE.exec(body);
  if (closing) return Number(closing[2]);
  const chain = CHAIN_RE.exec(body);
  if (chain) return Number(chain[1]);
  return null;
}

/**
 * Map a `prStatusRollup()` entry's raw `conclusion` to a DETECTION_JOBS
 * pass/fail signal. `null` (job absent from the rollup, or a non-terminal
 * conclusion like `neutral`/`cancelled`/in-progress) is NEVER coerced into
 * pass or fail — it is silently uncounted by `foldMerge` (D2-style honesty
 * for a non-blocking signal: current CI state, not a historical verdict, D6).
 *
 * @param {Array<{name: string|null, conclusion: string|null}>|null} rollup
 * @param {string} jobName
 * @returns {'pass'|'fail'|null}
 */
export function detectionConclusion(rollup, jobName) {
  if (!Array.isArray(rollup)) return null;
  const entry = rollup.find((c) => c.name === jobName);
  if (!entry) return null;
  if (entry.conclusion === 'success') return 'pass';
  if (entry.conclusion === 'failure') return 'fail';
  return null;
}

// ── Renderers (Phase 4.2/4.3) ────────────────────────────────────────────────

function fmtPct(n) {
  return `${n}%`;
}

function fmtLeadTime(days) {
  return days === null || days === undefined ? 'N/A' : `${days.toFixed(1)}d`;
}

function fmtGate(cell) {
  return `${cell.raw}/${cell.enforced}`;
}

/**
 * Render the markdown report: one row per period bucket, plus the two
 * repo-level lines (memory-gate at HEAD, memory-records coverage) — both
 * deliberately OUTSIDE the per-period table (design D3 / Phase 5).
 *
 * @param {{ rows: object[], memGate: {pass: boolean}, memCoverage: object, range: string, period: string }} opts
 * @returns {string}
 */
export function renderMarkdown({
  rows, memGate, memCoverage, range, period,
}) {
  const lines = [];
  lines.push(`# brain:metrics — ${range} (${period}ly)`, '');

  if (rows.length === 0) {
    lines.push('No data for this period.');
  } else {
    const header = [
      'Period', 'Changes Merged', 'Median Lead Time',
      'diff-size (raw/enf)', 'issue-link (raw/enf)', 'decision-gate (raw/enf)',
      'size:exception', 'skip:memory-gate',
      ...DETECTION_JOB_NAMES,
      'Uncomputable',
    ];
    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`| ${header.map(() => '---').join(' | ')} |`);
    for (const row of rows) {
      const cells = [
        row.period,
        String(row.changesMerged),
        fmtLeadTime(row.medianLeadTimeDays),
        ...PER_PERIOD_GATES.map((g) => fmtGate(row.gates[g])),
        String(row.bypass.sizeException),
        String(row.bypass.skipMemoryGate),
        ...DETECTION_JOB_NAMES.map((j) => `${row.detection[j].pass}/${row.detection[j].fail}`),
        String(row.uncomputable),
      ];
      lines.push(`| ${cells.join(' | ')} |`);
    }
  }

  lines.push('');
  lines.push('## Repo-level signals (not a per-period series — design D3)');
  lines.push('');
  lines.push(`- memory-gate (memoryPresence) at HEAD: ${memGate.pass ? 'PASS' : 'FAIL'}`);
  if (!memCoverage.available) {
    lines.push('- memory records coverage: Unavailable (.memory/records/ missing or unreadable) — adoption pending');
  } else {
    lines.push(
      `- memory records coverage: ${memCoverage.tagged}/${memCoverage.total} tagged with \`issue\` `
      + `(${fmtPct(memCoverage.coveragePct)}) — adoption pending`,
    );
  }
  lines.push('');
  lines.push('Caveats: lead time is an ISSUE-APPROVAL proxy (last `status:approved` label-add '
    + 'before merge), not PR-review-approval time. `skip:memory-gate` usage is documented '
    + '(AGENTS.md, workflow-governance.md) but implemented nowhere — reported as label usage '
    + 'only, never subtracted from an enforced count.');

  return lines.join('\n');
}

/**
 * Render the JSON report: a FLAT array, one object per period bucket (spec
 * H2 — "a flat array of period-metric objects consumable... without
 * additional parsing"). The two repo-level signals are denormalized onto
 * EVERY row (they are true constants for the whole run) rather than breaking
 * the flat-array contract with a wrapping object.
 */
export function renderJson({ rows, memGate, memCoverage }) {
  return JSON.stringify(
    rows.map((row) => ({
      period: row.period,
      changesMerged: row.changesMerged,
      medianLeadTimeDays: row.medianLeadTimeDays,
      gates: row.gates,
      bypass: row.bypass,
      detection: row.detection,
      uncomputable: row.uncomputable,
      memoryGatePassAtHead: memGate.pass,
      memoryRecordsCoverage: memCoverage,
    })),
    null,
    2,
  );
}

// ── Main orchestration ───────────────────────────────────────────────────────

/**
 * Evaluate one merge's full metrics descriptor (evidence + verdict + lead
 * time + detection-job current-state). Mirrors brain-audit.mjs's per-merge
 * loop body, but NEVER emits and NEVER exits — a per-merge git-plumbing
 * failure (parent resolution, diff read, reverter-exemption predicates) is
 * caught HERE and folded into the `uncomputable` column (design D2: metrics'
 * failure policy over the shared fail-closed core is "count visibly", never
 * "die on one bad merge" and never "silently hide it").
 *
 * @returns {Promise<object>} a foldMerge()-shaped merge descriptor.
 */
async function evaluateOneMerge(sha, subject, ctx) {
  const {
    cwd, resolutionGit, windowFrom, windowTo, allObservations, ignoreList, vcs, config, approvedLabel, period,
    leadTimeCache,
  } = ctx;

  // Same net-parity resolved-skip brain-audit applies — a merge brain-audit
  // itself never evaluates has no verdict for metrics to re-derive either
  // (Phase 7.4: never diverge from brain-audit's own resolution).
  let mergedAt;
  try {
    mergedAt = readMergedAt(sha, cwd);
  } catch {
    // Cannot even date the merge — nothing sensible to bucket. Propagates to
    // the CLI's own fail-closed handling (an infra-level failure, not a
    // per-merge governance signal).
    throw new Error(`brain-metrics: could not read merge date for ${sha.slice(0, 7)} ${subject}`);
  }

  let resolvedLine;
  try {
    resolvedLine = resolvedSkipLine(sha, subject, { git: resolutionGit, tip: windowTo });
  } catch {
    return {
      sha, mergedAt, prLabels: null, leadTimeDays: null, kind: 'uncomputable', evalRec: null, detection: null, period,
    };
  }
  if (resolvedLine) {
    return {
      sha, mergedAt, prLabels: null, leadTimeDays: null, kind: 'resolved-skip', evalRec: null, detection: null, period,
    };
  }

  try {
    const parent1 = readMergeParent(sha, subject, cwd);
    const { numstat, changedFiles, body } = readMergeDiff(parent1, sha, cwd);
    const { prLabels, prBody } = await fetchPrMeta(subject, vcs, config);
    const issueLinkBody = selectIssueLinkBody(prBody, body);

    const evalRec = evaluateMerge(sha, {
      numstat, changedFiles, issueLinkBody, prLabels, ignoreList, allObservations,
      resolutionGit, windowFrom, windowTo,
    });

    // Lead time: the ISSUE this merge references (not the PR) — best-effort,
    // never throws (labelEvents() returns null on an uncomputable fetch,
    // mirroring the CONTRACT verb's own convention; leadTimeDays handles null).
    // `leadTimeCache` (design Data Flow: "1 call/issue") de-duplicates the
    // labelEvents() fetch across every merge that references the SAME issue
    // (e.g. a chained-PR flow's "Part of #N" slices) — many merges, one API call.
    let leadTime = null;
    const issueNum = extractIssueNumber(issueLinkBody);
    if (issueNum !== null && vcs) {
      if (!leadTimeCache.has(issueNum)) {
        leadTimeCache.set(issueNum, vcs.labelEvents({ project: config?.project?.slug, number: issueNum }).catch(() => null));
      }
      const events = await leadTimeCache.get(issueNum);
      leadTime = leadTimeDays(events, approvedLabel, mergedAt);
    }

    // DETECTION_JOBS current-state (D6 — never historical): best-effort.
    let detection = null;
    const prNumForRollup = parsePrNumber(subject);
    if (prNumForRollup !== null && vcs && typeof vcs.prStatusRollup === 'function') {
      try {
        const rollup = await vcs.prStatusRollup({ project: config?.project?.slug, number: prNumForRollup });
        detection = Object.fromEntries(DETECTION_JOB_NAMES.map((j) => [j, detectionConclusion(rollup, j)]));
      } catch {
        detection = null;
      }
    }

    return {
      sha, mergedAt, prLabels, leadTimeDays: leadTime, kind: 'evaluated', evalRec, detection, period,
    };
  } catch {
    // Any git-plumbing throw (missing parent, diff read failure, reverter-
    // exemption predicate failure) — never propagates. Counted, not hidden.
    return {
      sha, mergedAt, prLabels: null, leadTimeDays: null, kind: 'uncomputable', evalRec: null, detection: null, period,
    };
  }
}

/** Committer date, strict ISO 8601 — the merge date `bucketOf`/lead-time anchor on. */
function readMergedAt(sha, cwd) {
  return gitOrThrow(['log', '-1', '--format=%cI', sha], { cwd }).trim();
}

/**
 * Run the full report and return its rendered string plus exit code — kept
 * separate from `process.exit()` so it stays testable (mirrors
 * brain-governance-status.mjs's injectable-orchestration convention).
 *
 * @param {{ argv: string[], cwd?: string }} opts
 * @returns {Promise<{ output: string, exitCode: number }>}
 */
export async function runMetrics({ argv, cwd = process.cwd() }) {
  let range;
  let json;
  let period;
  try {
    ({ range, json, period } = parseArgs(argv));
  } catch (err) {
    return { output: `brain-metrics: ${err.message}`, exitCode: 1 };
  }
  if (!range) range = resolveDefaultRange(cwd);

  const config = loadConfig(cwd);
  const ignoreList = Array.isArray(config?.governance?.ignoreList) ? config.governance.ignoreList : [];
  const approvedLabel = resolveApprovedLabel(config, config?.vcs?.provider);
  const resolutionGit = makeGit(cwd);
  const vcs = await resolveVcs(config);
  const allObservations = readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') });
  const memGate = memoryPresence(allObservations);
  const memCoverage = computeMemoryCoverage(cwd);

  let walk;
  try {
    walk = listMerges(range, cwd);
  } catch (err) {
    return {
      output: `brain-metrics: invalid git range "${range}" — ${err.message}\n`
        + 'Try a valid range such as "origin/main..HEAD" or "HEAD~10..HEAD" (see: npm run brain:audit).',
      exitCode: 1,
    };
  }

  if (walk.merges.length === 0) {
    if (json) return { output: '[]', exitCode: 0 };
    return {
      output: renderMarkdown({
        rows: [], memGate, memCoverage, range, period,
      }),
      exitCode: 0,
    };
  }

  const { merges, windowFrom, windowTo } = walk;
  let rows = emptyRows();
  const leadTimeCache = new Map(); // issue number -> Promise<labelEvents() result> (design Data Flow: 1 call/issue)
  for (const { sha, subject } of merges) {
    let m;
    try {
      m = await evaluateOneMerge(sha, subject, {
        cwd, resolutionGit, windowFrom, windowTo, allObservations, ignoreList, vcs, config, approvedLabel, period,
        leadTimeCache,
      });
    } catch (err) {
      // Could not even date the merge (a `git log -1 --format=%cI` failure on
      // an already-enumerated sha) — real repo corruption, not a normal
      // per-merge check failure. Fail closed at the CLI level rather than
      // silently dropping the merge from every bucket.
      return { output: `brain-metrics: ${err.message}`, exitCode: 1 };
    }
    rows = foldMerge(rows, m);
  }
  const finalRows = finalizeRows(rows);

  const output = json
    ? renderJson({ rows: finalRows, memGate, memCoverage })
    : renderMarkdown({
      rows: finalRows, memGate, memCoverage, range, period,
    });
  return { output, exitCode: 0 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { output, exitCode } = await runMetrics({ argv: process.argv.slice(2) });
  console.log(output);
  process.exit(exitCode);
}
