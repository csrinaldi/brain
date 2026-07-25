// tranche.mjs — REQ-H1-8: the tranche evaluator, THE per-push cold check
// (protocol §6, §8; design.md §2, §4). Mirrors the vcs/ DI-seam house style
// (D1): a pure `evaluateTranche(inputs)` core + `gatherTrancheInputs(deps)`
// that resolves the server-side rollup and re-derives the budget cold.
//
// Required gates come from the server's `prStatusRollup` (ADR-0021), RE-DERIVED
// cold — never read from the PR body / a report. If the rollup is uncomputable
// (`gh` down), this evaluator NEVER approves — it fails closed to REVISE with
// `conditions: [evidence uncomputable]` (protocol §10). Budget is re-derived
// the same way: `git diff --numstat base...head | diff-size-count.mjs`, never
// trusted from a report; when `base`/`head` are not resolvable, the budget is
// ALSO uncomputable and folds into the SAME fail-closed rule — this
// generalizes protocol §10's "never APPROVE on uncomputable evidence" rather
// than inventing a new one. `base` (this file's caller, `cli.mjs`) resolves
// from `ci-context.mjs`'s CI-env BASE_SHA when set, else from `prView`'s
// `baseRefOid` (ADR-0022 Decision 1/2, the port widening that closed
// H1-2C-BASE) — so this fail-closed branch now only fires when BOTH sources
// are genuinely uncomputable (e.g. the `gh`/`glab` fetch itself failed), not
// merely "running outside CI" as before the widening landed.

import { execFileSync } from 'node:child_process';

import { getVcs } from '../../vcs/cli.mjs';
import { loadBrainConfig } from '../../lib/brain-config.mjs';
import { parseDiffNumstat } from '../../vcs/diff-size-count.mjs';
import { REQUIRED_JOBS, DETECTION_JOBS } from '../../vcs/governance-checks.mjs';

// governance.yml's diff-size gate threshold (`.github/workflows/governance.yml`,
// "Invariant 2"). Mirrored here, not imported — governance.yml is YAML, not a
// module; if it ever moves into `governance-checks.mjs`, update both sites in
// the same commit (the drift-guard test for governance.yml's job names does
// not cover this constant).
const LINE_BUDGET = 400;

const TIER2_PREFIXES = ['brain/core/', 'brain/project/'];
const AI_ATTRIBUTION_RE = /co-authored-by:\s*claude|generated with \[?claude|🤖/i;

function isGateGreen({ status, conclusion } = {}) {
  const c = (conclusion ?? '').toLowerCase();
  if (c) return c === 'success';
  return (status ?? '').toLowerCase() === 'success';
}

function quoteGate(name, gate) {
  return gate
    ? `prStatusRollup: ${name} status=${gate.status ?? 'null'} conclusion=${gate.conclusion ?? 'null'}`
    : `prStatusRollup: ${name} — not present in rollup`;
}

/**
 * Pure core (design.md §5 style — no seams). Takes the already-fetched rollup
 * + already-re-derived budget and produces `{ conclusion, gates, findings,
 * conditions }`, the shape `buildVerdict` (verdict.mjs) consumes directly.
 *
 * @param {object} input
 * @param {Array<{name:string,status:string|null,conclusion:string|null}>|null} input.requiredGates
 *   The full `prStatusRollup` — `null` means uncomputable (fail-closed).
 * @param {string[]} [input.changedFiles]
 * @param {{lines?:number, uncomputable?:boolean, baseSha?:string, headSha?:string}} [input.budget]
 * @param {string} [input.prBody]
 * @returns {{ conclusion: 'APPROVE'|'REVISE', gates: {required:string[],detection:string[]}, findings: object[], conditions: string[] }}
 */
export function evaluateTranche({ requiredGates = null, changedFiles = [], budget = null, prBody = '' } = {}) {
  if (!Array.isArray(requiredGates)) {
    // Uncomputable evidence (`gh` down, or the rollup fetch failed) — never
    // APPROVE on it (protocol §10, REQ-H1-8 scenario "uncomputable evidence
    // never approves").
    return {
      conclusion: 'REVISE',
      gates: { required: [], detection: [] },
      findings: [],
      conditions: ['evidence uncomputable'],
    };
  }

  const findings = [];
  const rollupByName = new Map(requiredGates.map(g => [g.name, g]));

  for (const name of REQUIRED_JOBS) {
    const gate = rollupByName.get(name);
    if (!gate || !isGateGreen(gate)) {
      findings.push({
        id: `gate:${name}`,
        severity: 'blocker',
        evidence: quoteGate(name, gate),
        cites: 'governance-checks.mjs REQUIRED_JOBS',
      });
    }
  }

  for (const name of DETECTION_JOBS) {
    const gate = rollupByName.get(name);
    if (gate && !isGateGreen(gate)) {
      // A detection-level warn is not a blocker — it is surfaced verbatim
      // (REQ-H1-8: "an unquoted warn is a review defect").
      findings.push({ id: `detection:${name}`, severity: 'editorial', evidence: quoteGate(name, gate) });
    }
  }

  if (budget?.uncomputable) {
    // Same fail-closed rule as the rollup, generalized: budget is also
    // required evidence, re-derived cold; if it cannot be computed, the
    // evaluator does not guess a number.
    return {
      conclusion: 'REVISE',
      gates: { required: [...REQUIRED_JOBS], detection: [...DETECTION_JOBS] },
      findings,
      conditions: ['evidence uncomputable: budget diff (base sha unresolvable outside CI)'],
    };
  }

  if (budget && typeof budget.lines === 'number' && budget.lines > LINE_BUDGET) {
    findings.push({
      id: 'budget',
      severity: 'blocker',
      evidence: `git diff --numstat ${budget.baseSha}...${budget.headSha} | diff-size-count.mjs = ${budget.lines}`,
      cites: 'governance.yml diff-size gate (400-line budget)',
    });
  }

  const tier2Touched = changedFiles.filter(f => TIER2_PREFIXES.some(prefix => f.startsWith(prefix)));
  if (tier2Touched.length > 0) {
    findings.push({
      id: 'tier2-frontier',
      severity: 'correction',
      evidence: `git diff --name-only touches Tier-2: ${tier2Touched.join(', ')}`,
      cites: 'agent-authorities.md Tier-2',
    });
  }

  if (AI_ATTRIBUTION_RE.test(prBody ?? '')) {
    findings.push({
      id: 'ai-attribution',
      severity: 'editorial',
      evidence: 'PR body matches an AI-attribution pattern (co-authored-by / generated with / 🤖)',
      cites: 'CLAUDE.md — never add AI attribution to commits',
    });
  }

  const conclusion = findings.some(f => f.severity === 'blocker') ? 'REVISE' : 'APPROVE';

  return { conclusion, gates: { required: [...REQUIRED_JOBS], detection: [...DETECTION_JOBS] }, findings, conditions: [] };
}

function defaultDiffNumstat({ cwd = process.cwd() } = {}) {
  return (baseSha, headSha) =>
    execFileSync('git', ['diff', '--numstat', `${baseSha}...${headSha}`], { cwd, encoding: 'utf8' });
}

/**
 * Gathers `evaluateTranche`'s inputs. `baseSha`/`headSha`/`changedFiles` are
 * caller-supplied (cli.mjs resolves them once and shares them with
 * `mode.mjs`'s derivation) — this function's own seams are the READ verb
 * (`fetchRollup`) and the local git budget re-derivation (`diffNumstat`).
 *
 * @param {{ project, number, provider, headSha, baseSha, changedFiles, prBody, deps }} args
 */
export async function gatherTrancheInputs({
  project,
  number,
  provider,
  headSha,
  baseSha,
  changedFiles = [],
  prBody = '',
  deps = {},
} = {}) {
  const fetchRollup =
    deps.fetchRollup ?? (async () => (await (deps.getVcs ?? getVcs)({ provider })).prStatusRollup({ project, number }));
  const requiredGates = await fetchRollup();

  const diffNumstat = deps.diffNumstat ?? defaultDiffNumstat(deps);
  const readIgnoreList = deps.readIgnoreList ?? (() => loadBrainConfig().governance?.ignoreList ?? []);

  let budget;
  if (!baseSha || !headSha) {
    budget = { uncomputable: true };
  } else {
    const raw = diffNumstat(baseSha, headSha);
    budget = { lines: parseDiffNumstat(raw, readIgnoreList()), baseSha, headSha, uncomputable: false };
  }

  return { requiredGates, changedFiles, budget, prBody };
}
