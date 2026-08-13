// checkpoint.mjs — REQ-H1-10: the checkpoint evaluator. Runs the tranche
// checks (REQ-H1-8, REUSED via evaluateTranche — gates/budget/detection are
// NEVER re-implemented here) plus five checkpoint-only checks: report-vs-tree
// drift, sdd-layout artifact completeness, prior pins applied+cited, TDD-RED
// by reversion, and audit/governance-status quoting with the decision-gate
// step-2 warn converted into a hard finding (design.md §2).
//
// §10.4's base sha (the reversion's own anchor) is an INJECTED dependency,
// `deps.baseSha`, fed by cli.mjs's one resolved baseSha (ci-context BASE_SHA →
// `prView().baseRefOid`, ADR-0022 — landed #266 H1-2C-BASE) and NEVER a
// hardcoded branch. When it is null (genuinely uncomputable), both the reversion
// AND the tranche re-derivation it feeds fold into the SAME fail-closed rule
// tranche.mjs documents (protocol §10, "never APPROVE on uncomputable
// evidence") — generalized, not reinvented.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { evaluateTranche, gatherTrancheInputs } from './tranche.mjs';
import { TIERS, tierParams, requiredArtifactsFor } from '../../vcs/governance-tiers.mjs';
import { changeDir, missingRequiredArtifacts } from '../../lib/sdd-layout.mjs';

// A budget claim is `N/M` where M is a budget SOME tier declares — derived from
// the tier table, never written as a literal (ADR-0026: lite 1000 · standard
// 400 · regulated 200). The `400` this replaced matched `standard` by accident
// and returned null at the other two tiers, leaving §10.1 checking nothing
// while reporting nothing (issue #472, the second untiered literal after #443).
const CLAIM_PAIR_RE = /(\d+)\s*\/\s*(\d+)\b/g;
const DEFAULT_TIER = 'standard';

/** The set of denominators that are a declared tier budget. Resolved from the
 * tier table so a new tier needs no edit here, and so no budget number is ever
 * written twice (REQ-TIER-9). */
function declaredBudgets() {
  return new Set(TIERS.map((t) => tierParams(t).diffBudget));
}

const CHECKPOINT_REPORT_RE = /(?:^|\/)openspec\/changes\/([^/]+)\/checkpoint-report\.md$/;
// Mirrors workflow-governance.md Invariant 4 step 2's scanned surfaces.
const ARCHITECTURAL_SURFACE_RE = [/providers\//, /^brain\/core\//, /config-migrations\.mjs$/, /^package\.json$/];

/** Extracts the ONE canonical machine-checkable claim this repo's checkpoint
 * reports state in a consistent form: the counted-lines budget (e.g. H1-2c's
 * own "372/400"). `evaluateCheckpoint`'s `reportClaims` input already accepts
 * an array of `{key, claimed, recomputed}` — more parsers can be added
 * without changing the contract; this is deliberately not a generic
 * arbitrary-number parser. */
export function parseBudgetClaim(reportText, diffBudget = tierParams(DEFAULT_TIER).diffBudget) {
  const budgets = declaredBudgets();
  const candidates = [];
  // Deliberately NOT filtered by markdown structure. An earlier round excluded
  // table rows on the theory that a row is always a per-file component — but
  // this repo's reports state the diff-size GATE verdict in a table
  // (`| diff-size | REQUIRED | PASS | 1/400 — … |`), and for a report whose
  // prose total carries no denominator that row is the only machine-readable
  // compliance claim it has. Excluding rows sent such a report back to `null`,
  // which is the very silence this issue removes, introduced at `standard`.
  // Measured against this repo's 17 real reports: with the exclusion removed,
  // exactly one differs from the pre-#472 parser at `standard` — archive/217,
  // 476 → 251, where 251 is the MR's real figure and 476 was a pre-split total
  // the old first-match regex reached first. A correction, not a regression.
  for (const line of (reportText ?? '').split('\n')) {
    for (const m of line.matchAll(CLAIM_PAIR_RE)) {
      const declaredBudget = Number(m[2]);
      // A denominator no tier declares is not a budget claim — it is a test
      // count (`npm test: **1269/1269**`), a slice count, a version. Admitting
      // those would let the drift check fabricate evidence from ordinary prose,
      // which is strictly worse than the silence this issue removes.
      if (!budgets.has(declaredBudget)) continue;
      candidates.push({ claimed: Number(m[1]), declaredBudget });
    }
  }
  if (candidates.length === 0) return null;

  // Prefer claims stated against THIS tier's budget — the same specificity the
  // hardcoded regex had, so an honest report at any tier parses exactly.
  //
  // When more than one survives, take the SMALLEST numerator rather than the
  // first or the last. Position is not a property of the claim: a report that
  // states its count twice would otherwise be read differently depending on
  // where the author put each sentence, and a drift check must not be softened
  // by a second, larger number appearing elsewhere. Smallest is the
  // fail-closed choice — it is the one most likely to fall below the cold
  // recomputation and surface the drift.
  const matching = candidates.filter((c) => c.declaredBudget === diffBudget);
  if (matching.length > 0) {
    return { claimed: Math.min(...matching.map((c) => c.claimed)), declaredBudget: diffBudget, matchesTierBudget: true };
  }

  // Every candidate quotes a budget some tier declares, but none quotes THIS
  // repo's. The report asserts compliance against doctrine that does not apply
  // here, and its numerator was judged under the wrong ceiling — report drift in
  // its own right (issue #472, option 2). Returning null would convert a
  // doctrine error back into the silence this change removes.
  const lowest = candidates.reduce((a, c) => (c.claimed < a.claimed ? c : a));
  return { ...lowest, matchesTierBudget: false };
}

/** Finds the change id from a `checkpoint-report.md` path in `changedFiles`. */
export function resolveChangeId(changedFiles = []) {
  for (const f of changedFiles) {
    const m = CHECKPOINT_REPORT_RE.exec(f);
    if (m) return m[1];
  }
  return null;
}

function matchesArchitecturalSurface(file) {
  return ARCHITECTURAL_SURFACE_RE.some((re) => re.test(file));
}

// ── §10.1 report-vs-tree drift ──────────────────────────────────────────────
function checkReportDrift(claims = []) {
  const findings = [];
  for (const claim of claims) {
    if (typeof claim.claimed === 'number' && typeof claim.recomputed === 'number' && claim.claimed < claim.recomputed) {
      findings.push({
        id: `drift:${claim.key}`,
        severity: 'blocker',
        evidence: `checkpoint-report.md claims ${claim.key}=${claim.claimed}; cold recomputation = ${claim.recomputed}`,
        cites: 'reviewer-protocol.md §10 report-vs-tree drift',
      });
    }
    // A report quoting a budget the repo does not operate under is itself
    // report drift: it asserts compliance against doctrine that does not apply
    // here, and the numerator it states was judged under the wrong ceiling
    // (issue #472). Dropping the claim instead would restore the silence this
    // check exists to remove — the parse failure would be indistinguishable
    // from a report that matched.
    if (claim.matchesTierBudget === false) {
      findings.push({
        id: `drift:${claim.key}-budget`,
        severity: 'blocker',
        evidence: `checkpoint-report.md states the ${claim.key} budget as ${claim.declaredBudget}; this repo resolves ${claim.tierBudget}${claim.tier ? ` (tier: ${claim.tier})` : ''}`,
        cites: 'ADR-0026 tierParams(tier).diffBudget; reviewer-protocol.md §10 report-vs-tree drift',
      });
    }
  }
  return findings;
}

// ── §10.2 artifact completeness ─────────────────────────────────────────────
function checkArtifactCompleteness({ missing = [], hasCheckedTask, tier = 'standard' } = {}) {
  const findings = [];
  if (missing.length > 0) {
    findings.push({
      // #555: the set is tier-resolved, so the evidence names the tier it was
      // measured against. Citing a fixed constant made a blocker unfalsifiable —
      // a reader could not tell whether the finding held at THIS repo's tier.
      id: 'artifacts-missing',
      severity: 'blocker',
      evidence: `governance-tiers requiredArtifactsFor("${tier}") missing: ${missing.join(', ')}`,
      cites: `governance-tiers.mjs requiredArtifactsFor (tier "${tier}", ADR-0026)`,
    });
  }
  if (hasCheckedTask === false) {
    findings.push({
      id: 'tasks-no-progress',
      severity: 'blocker',
      evidence: 'tasks.md has zero "- [x]" entries',
      cites: 'sdd-layout.mjs REQUIRED_ARTIFACTS (tasks.md)',
    });
  }
  return findings;
}

// ── §10.3 prior pins applied, each cited file:line ──────────────────────────
// NOTE: the `pin` field's exact shape is provisional — the ruling evaluator
// that WRITES it (H1-4) has not shipped yet. This reads whatever a prior
// verdict's `.memory/records/` entry carries under `pin.citation`; tighten
// once H1-4 lands its writer.
function checkPriorPins(pins = [], exists) {
  const findings = [];
  for (const pin of pins) {
    // A truthy non-string citation would throw on `.split(':')` — treat it as a missing/invalid citation, not a crash.
    if (!pin.citation || typeof pin.citation !== 'string') {
      findings.push({
        id: `pin:${pin.id}`,
        severity: 'blocker',
        evidence: `pin "${pin.id}" carries no file:line citation`,
        cites: 'reviewer-protocol.md §8 pin: payload',
      });
      continue;
    }
    const file = pin.citation.split(':')[0];
    if (!exists(file)) {
      findings.push({
        id: `pin:${pin.id}`,
        severity: 'blocker',
        evidence: `pin "${pin.id}" cites ${pin.citation} — file not found in the reviewed tree`,
        cites: 'reviewer-protocol.md §8 pin: payload',
      });
    }
  }
  return findings;
}

// ── §10.4 TDD-RED by reversion ──────────────────────────────────────────────
function checkReversion(reversion) {
  if (!reversion || reversion.uncomputable) return { findings: [], uncomputable: true, command: reversion?.command ?? null };
  const findings = (reversion.vacuousTests ?? []).map((testFile) => ({
    id: `reversion:${testFile}`,
    severity: 'blocker',
    evidence: `${reversion.command} — "${testFile}" PASSED after reverting the implementation to base (vacuous test)`,
    cites: 'reviewer-protocol.md §10 TDD-RED by reversion',
  }));
  return { findings, uncomputable: false };
}

// ── §10.5 audit/governance-status quoted + decision-gate step-2 → ruling ────
function checkAuditGovernance({ auditOutput, governanceStatusOutput } = {}) {
  const findings = [];
  if (auditOutput) findings.push({ id: 'audit-output', severity: 'editorial', evidence: `brain:audit — ${auditOutput}` });
  if (governanceStatusOutput) {
    findings.push({ id: 'governance-status-output', severity: 'editorial', evidence: `brain:governance-status — ${governanceStatusOutput}` });
  }
  return findings;
}

function checkDecisionSurface({ changedFiles = [], hasDecisionLabel } = {}) {
  const touched = changedFiles.filter(matchesArchitecturalSurface);
  if (touched.length === 0 || hasDecisionLabel) return [];
  // A checkpoint is a cold, deliberate audit — the CI step-2 heuristic only
  // WARNS (workflow-governance.md Invariant 4); here it becomes a real
  // finding that forces the human question "is this a decision?" rather than
  // a silently-ignorable ::warning::.
  return [{
    id: 'decision-surface',
    severity: 'blocker',
    evidence: `touches an architectural surface without the "decision" label: ${touched.join(', ')}`,
    cites: 'workflow-governance.md Invariant 4 step 2 (decision-gate)',
  }];
}

/**
 * Pure core (design.md §5 style). Reuses `evaluateTranche`'s findings/gates
 * verbatim and layers the five checkpoint-only checks on top.
 * @returns {{ conclusion: 'APPROVE'|'REVISE', gates: object, findings: object[], conditions: string[] }}
 */
export function evaluateCheckpoint({
  trancheInputs = {},
  reportClaims = [],
  artifacts = {},
  pins = [],
  reversion = null,
  auditOutput = '',
  governanceStatusOutput = '',
  changedFiles = [],
  hasDecisionLabel = false,
  exists = () => true,
} = {}) {
  const tranche = evaluateTranche(trancheInputs);
  const findings = [...tranche.findings];
  const conditions = [...tranche.conditions];

  findings.push(...checkReportDrift(reportClaims));
  findings.push(...checkArtifactCompleteness(artifacts));
  findings.push(...checkPriorPins(pins, exists));

  const rev = checkReversion(reversion);
  if (rev.uncomputable) {
    conditions.push(`evidence uncomputable: TDD-RED reversion (${rev.command ?? 'base sha unresolvable'})`);
  } else {
    findings.push(...rev.findings);
  }

  findings.push(...checkAuditGovernance({ auditOutput, governanceStatusOutput }));
  findings.push(...checkDecisionSurface({ changedFiles, hasDecisionLabel }));

  const anyBlocker = findings.some((f) => f.severity === 'blocker');
  const conclusion = tranche.conclusion === 'REVISE' || anyBlocker || rev.uncomputable ? 'REVISE' : 'APPROVE';

  return { conclusion, gates: tranche.gates, findings, conditions };
}

function childTestEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

// True iff `path` exists at `ref` (non-throwing): `git cat-file -e <ref>:<path>`
// exits 0 when the blob exists — tells an impl file the PR MODIFIED (exists at
// base) apart from one it ADDS (absent at base).
function existsAtRef({ cwd, ref, path }) {
  try { execFileSync('git', ['cat-file', '-e', `${ref}:${path}`], { cwd, encoding: 'utf8' }); return true; } catch { return false; }
}

// COLDBOOT-CWD-style isolation (protocol §8): NEVER `git checkout` in the
// operator's cwd. The revert + the PR's new tests run in a SEPARATE detached
// worktree, torn down after. Mirrors cold-boot.mjs's defaultCloneDetached.
export function defaultRunReversion({ cwd = process.cwd(), tmp = tmpdir() } = {}) {
  return ({ baseSha, headSha, implFiles = [], testFiles = [] }) => {
    if (!baseSha || !headSha) return { uncomputable: true, command: null };
    const worktreePath = join(tmp, `brain-review-reversion-${headSha}`);
    // Wrap the WHOLE body: an unexpected git/fs failure must NOT escape and
    // crash brain:review — it degrades to fail-closed (uncomputable → REVISE).
    try {
      try { execFileSync('git', ['worktree', 'remove', '--force', worktreePath], { cwd, encoding: 'utf8' }); } catch { /* no prior worktree */ }
      execFileSync('git', ['worktree', 'add', '--detach', worktreePath, headSha], { cwd, encoding: 'utf8' });

      // Bring each impl file to its BASE state: files that EXIST at base are
      // reverted; files ABSENT at base (the PR ADDS them) have no base content,
      // so REMOVE them. Passing an added path to `git checkout <base>` exits 1
      // (pathspec did not match) and aborts the ENTIRE batch — so partition.
      const toRevert = [];
      const toRemove = [];
      for (const path of implFiles) {
        if (existsAtRef({ cwd: worktreePath, ref: baseSha, path })) toRevert.push(path);
        else toRemove.push(path);
      }
      if (toRevert.length > 0) execFileSync('git', ['checkout', baseSha, '--', ...toRevert], { cwd: worktreePath, encoding: 'utf8' });
      for (const path of toRemove) rmSync(join(worktreePath, path), { force: true });

      const revertCmd = toRevert.length > 0 ? `git checkout ${baseSha} -- ${toRevert.join(' ')}` : '';
      const rmCmd = toRemove.length > 0 ? `rm ${toRemove.join(' ')}` : '';
      const command = [revertCmd, rmCmd, `node --test ${testFiles.join(' ')}`].filter(Boolean).join(' && ');
      const vacuousTests = [];
      for (const testFile of testFiles) {
        try {
          // NODE_TEST_CONTEXT must NOT leak into this child (gotcha: when this
          // evaluator itself runs under `node --test`, the inherited env var
          // trips node's recursive-test guard and the child silently SKIPS
          // running the file, exiting 0 — a false "vacuous" negative).
          execFileSync('node', ['--test', testFile], { cwd: worktreePath, encoding: 'utf8', env: childTestEnv() });
          vacuousTests.push(testFile); // passed against base — vacuous, never tested the change
        } catch { /* failed against base — real RED, exactly what TDD requires */ }
      }
      return { uncomputable: false, command, vacuousTests };
    } catch {
      // Fail-closed: an unexpected failure is uncomputable evidence, never a crash.
      return { uncomputable: true, command: null };
    } finally {
      try { execFileSync('git', ['worktree', 'remove', '--force', worktreePath], { cwd, encoding: 'utf8' }); } catch { /* best effort */ }
    }
  };
}

const defaultExec = (file, args, opts) => execFileSync(file, args, opts);

function defaultRunAudit({ cwd = process.cwd(), exec = defaultExec } = {}) {
  return () => {
    try { return exec('node', ['brain/scripts/brain-audit.mjs'], { cwd, encoding: 'utf8' }).trim(); } catch (err) { return String(err.stdout ?? err.message ?? '').trim(); }
  };
}

function defaultRunGovernanceStatus({ cwd = process.cwd(), exec = defaultExec } = {}) {
  return () => {
    try { return exec('node', ['brain/scripts/brain-governance-status.mjs'], { cwd, encoding: 'utf8' }).trim(); } catch (err) { return String(err.stdout ?? err.message ?? '').trim(); }
  };
}

/**
 * Gathers `evaluateCheckpoint`'s inputs. Mirrors `gatherTrancheInputs` — the
 * tranche portion is delegated wholesale (no re-implementation). Every
 * additional seam (`exists`/`listDir`/`readFile`/`runReversion`/`runAudit`/
 * `runGovernanceStatus`) is injectable; production defaults resolve against
 * `worktreePath` (cold-boot's isolated detached checkout) or `process.cwd()`.
 *
 * @param {{ project, number, provider, headSha, changedFiles, prBody, labels,
 *   worktreePath, doctrineRecords, deps }} args
 */
export async function gatherCheckpointInputs({
  project,
  number,
  provider,
  headSha,
  changedFiles = [],
  prBody = '',
  labels = [],
  worktreePath,
  doctrineRecords = [],
  tier = 'standard',
  deps = {},
} = {}) {
  const baseSha = deps.baseSha ?? null; // fed by cli.mjs (ci-context → prView.baseRefOid, ADR-0022); tests inject directly

  const trancheInputs = await gatherTrancheInputs({
    project, number, provider, headSha, baseSha, changedFiles, prBody, deps: deps.trancheDeps ?? {},
  });

  const root = worktreePath ?? process.cwd();
  const exists = deps.exists ?? ((p) => existsSync(join(root, p)));
  const listDir = deps.listDir ?? ((p) => readdirSync(join(root, p)));
  const readFile = deps.readFile ?? ((p) => readFileSync(join(root, p), 'utf8'));

  const changeId = deps.changeId ?? resolveChangeId(changedFiles);
  let artifacts = { missing: [], hasCheckedTask: null, tier };
  let reportClaims = [];
  if (changeId) {
    const missing = missingRequiredArtifacts(changeId, { artefacts: requiredArtifactsFor(tier), exists, listDir });
    let hasCheckedTask = null;
    if (!missing.includes('tasks.md')) {
      try { hasCheckedTask = /^- \[x\]/im.test(readFile(`${changeDir(changeId)}/tasks.md`)); } catch { hasCheckedTask = false; }
    }
    artifacts = { missing, hasCheckedTask, tier };

    if (!missing.includes('checkpoint-report.md')) {
      try {
        const reportText = readFile(`${changeDir(changeId)}/checkpoint-report.md`);
        // The tier's budget rides the SAME resolution the job sets and the
        // tranche budget use — `gatherTrancheInputs` already returns it, so
        // there is exactly one place a tier becomes a number (issue #472/#443).
        const claim = parseBudgetClaim(reportText, trancheInputs.diffBudget);
        if (claim !== null) {
          reportClaims = [{
            key: 'counted-lines',
            claimed: claim.claimed,
            recomputed: trancheInputs.budget?.lines ?? null,
            declaredBudget: claim.declaredBudget,
            matchesTierBudget: claim.matchesTierBudget,
            tierBudget: trancheInputs.diffBudget ?? null,
            tier: trancheInputs.tier ?? null,
          }];
        }
      } catch { /* report absent — no drift claim to check */ }
    }
  }

  const pins = (doctrineRecords ?? [])
    .filter((r) => r?.pin)
    .map((r) => ({ id: r.id ?? r.source ?? 'unknown', citation: r.pin?.citation ?? null }));

  const testFiles = deps.testFiles ?? changedFiles.filter((f) => f.endsWith('.test.mjs'));
  const implFiles = deps.implFiles ?? changedFiles.filter((f) => /\.mjs$/.test(f) && !f.endsWith('.test.mjs'));

  const runReversion = deps.runReversion ?? defaultRunReversion(deps);
  const reversion = baseSha ? await runReversion({ baseSha, headSha, implFiles, testFiles }) : { uncomputable: true, command: null };

  // §10.5 evidence is gathered against the COLD head (`root` = the isolated
  // worktree, per cold-boot.mjs's invariant), NOT the operator's live tree.
  const runAudit = deps.runAudit ?? defaultRunAudit({ cwd: root, exec: deps.exec });
  const runGovernanceStatus = deps.runGovernanceStatus ?? defaultRunGovernanceStatus({ cwd: root, exec: deps.exec });

  return {
    trancheInputs,
    reportClaims,
    artifacts,
    pins,
    reversion,
    auditOutput: runAudit(),
    governanceStatusOutput: runGovernanceStatus(),
    changedFiles,
    hasDecisionLabel: labels.includes('decision'),
    exists,
  };
}
