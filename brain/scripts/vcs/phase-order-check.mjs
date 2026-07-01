// phase-order-check.mjs — L4 SDD phase-order gate: pure evaluator + git I/O wrapper
// + CLI (design §2, REQ-L4-1..5). Sibling to check-refs.mjs. Generic over
// openspec/changes/** file state + git — no harness-specific file is read or
// required (REQ-NEUTRALITY-1/2).
//
// PR4a shipped the pure evaluator (evaluatePhaseOrder). PR4b (this addition) adds
// the git I/O wrapper (git diff --name-only, existsSync/readdirSync artifact
// flags, `- [x]` counting, `git show BASE:path` for statusBefore) and the CLI
// entrypoint wired into DETECTION_JOBS.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Constants ────────────────────────────────────────────────────────────────

const CHANGE_DIR_PREFIX = 'openspec/changes/';

// Allowlist subtracted from the "impl" set (Rule C): files that never count as
// implementation code even when they live outside openspec/changes/**.
const ROOT_MD_RE = /^[^/]+\.md$/;

function isAllowlisted(path) {
  // Hardening (carried from PR4a review): never allowlist a path containing a
  // '..' segment. `git diff --name-only` never emits one, but an unnormalized
  // path must not be able to masquerade as an allowlisted docs/*.md file.
  if (path.split('/').includes('..')) return false;
  if (ROOT_MD_RE.test(path)) return true; // *.md at repo root
  if (path.startsWith('docs/')) return true;
  if (path.startsWith('.memory/')) return true;
  return false;
}

// ── Rule C — code-without-completed-phases (the enforcing core) ───────────────

function evaluateRuleC(impl, touchedDirs) {
  const findings = [];
  if (impl.length === 0) return findings;

  if (touchedDirs.length === 0) {
    // Unattributable — never fail, only warn (keeps false positives ~0).
    findings.push({
      rule: 'C',
      level: 'warn',
      message:
        'implementation code changed but no openspec/changes/** directory was touched ' +
        'in this diff — cannot attribute the change to a tracked SDD change',
    });
    return findings;
  }

  for (const dir of touchedDirs) {
    if (dir.checkedTasks !== 0) continue;
    findings.push({
      rule: 'C',
      level: 'fail',
      change: dir.name,
      message:
        `implementation code present but openspec/changes/${dir.name}/tasks.md has no ` +
        'checked item — phases not reached apply.',
    });
  }

  return findings;
}

// ── Rule A — artifact completeness, gated on Rule C seeing impl ────────────────

function evaluateRuleA(impl, touchedDirs) {
  const findings = [];
  // Planning-only PRs (no impl code) are never subjected to Rule A — they may
  // legitimately be mid-phase (design §10-A).
  if (impl.length === 0) return findings;

  for (const dir of touchedDirs) {
    const complete = dir.hasProposal && dir.hasSpec && dir.hasDesign && dir.hasTasks;
    if (!complete) {
      findings.push({
        rule: 'A',
        level: 'fail',
        change: dir.name,
        message: `openspec/changes/${dir.name}: implementation without spec.md/design.md`,
      });
    }
  }

  return findings;
}

// ── Rule B — monotonic status ───────────────────────────────────────────────

const STATUS_LADDER = [
  'draft',
  'proposed',
  'spec',
  'designed',
  'tasked',
  'applying',
  'verified',
  'archived',
];

function evaluateRuleB(touchedDirs) {
  const findings = [];

  for (const dir of touchedDirs) {
    const { statusBefore, statusAfter, name } = dir;
    if (!statusBefore || !statusAfter) continue; // absent frontmatter → no-op

    const idxBefore = STATUS_LADDER.indexOf(statusBefore);
    const idxAfter = STATUS_LADDER.indexOf(statusAfter);
    if (idxBefore === -1 || idxAfter === -1) continue; // unknown/custom → no-op
    if (idxAfter >= idxBefore) continue; // unchanged or forward-only → no-op

    findings.push({
      rule: 'B',
      level: 'fail',
      change: name,
      message:
        `openspec/changes/${name}: status regressed from '${statusBefore}' to ` +
        `'${statusAfter}' — backward phase jump`,
    });
  }

  return findings;
}

// ── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Evaluates the L4 phase-order rules against pre-computed changed-file + change-dir
 * state. Pure — no git, no filesystem access (fully testable with fixtures).
 *
 * @param {object} input
 * @param {string[]} input.changedFiles  Paths from `git diff --name-only BASE...HEAD`.
 * @param {Array<{
 *   name: string,
 *   hasProposal: boolean,
 *   hasSpec: boolean,
 *   hasDesign: boolean,
 *   hasTasks: boolean,
 *   checkedTasks: number,
 *   statusBefore: string|null|undefined,
 *   statusAfter: string|null|undefined,
 * }>} input.changeDirs  One entry per openspec/changes/** directory the caller knows
 *   about. `hasSpec` MUST be true if EITHER `spec.md` OR `specs/*\/spec.md` exists
 *   (Gap G1 — the wrapper is responsible for probing both conventions; this pure
 *   function only consumes the resulting boolean).
 * @returns {{ level: 'pass'|'warn'|'fail', findings: Array<{rule: string, level: string, change?: string, message: string}> }}
 */
export function evaluatePhaseOrder({ changedFiles = [], changeDirs = [] } = {}) {
  const impl = changedFiles.filter(f => !f.startsWith(CHANGE_DIR_PREFIX) && !isAllowlisted(f));

  const touchedDirs = changeDirs.filter(dir =>
    changedFiles.some(f => f.startsWith(`${CHANGE_DIR_PREFIX}${dir.name}/`))
  );

  const findings = [
    ...evaluateRuleC(impl, touchedDirs),
    ...evaluateRuleA(impl, touchedDirs),
    ...evaluateRuleB(touchedDirs),
  ];

  const level = findings.some(f => f.level === 'fail')
    ? 'fail'
    : findings.some(f => f.level === 'warn')
      ? 'warn'
      : 'pass';

  return { level, findings };
}

// ── Git I/O wrapper (PR4b) ──────────────────────────────────────────────────
//
// Gathers evaluatePhaseOrder()'s inputs from git + the filesystem. Every I/O
// operation is dependency-injectable via `deps` — real git/fs is used only as
// the default — so tests exercise this wrapper with plain-data fakes and never
// touch real git state or the real cwd (same CI-fragility discipline as
// run-check.mjs / check-refs.mjs).
//
// Path convention: every `deps` function takes/returns paths **relative to
// `cwd`** (POSIX `/`-separated, no leading `./`), never an absolute path —
// this keeps fakes trivial (a flat relative-path → content map) regardless of
// where `cwd` happens to point.

const STATUS_FRONTMATTER_RE = /^status:\s*(\S+)/m;

function parseStatus(text) {
  if (!text) return undefined;
  const m = text.match(STATUS_FRONTMATTER_RE);
  return m ? m[1] : undefined;
}

function countCheckedTasks(text) {
  if (!text) return 0;
  return (text.match(/^- \[x\]/gim) ?? []).length;
}

function defaultDiffNameOnly(cwd) {
  return (baseSha, headSha) => {
    const out = execFileSync('git', ['diff', '--name-only', `${baseSha}...${headSha}`], {
      cwd,
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean);
  };
}

function defaultExists(cwd) {
  return relPath => existsSync(join(cwd, relPath));
}

function defaultListDir(cwd) {
  return relPath => readdirSync(join(cwd, relPath));
}

function defaultReadFile(cwd) {
  return relPath => {
    try {
      return readFileSync(join(cwd, relPath), 'utf8');
    } catch {
      return null;
    }
  };
}

function defaultShowAtRef(cwd) {
  return (ref, relPath) => {
    try {
      return execFileSync('git', ['show', `${ref}:${relPath}`], { cwd, encoding: 'utf8' });
    } catch {
      return null; // file did not exist at that ref — treated as absent frontmatter
    }
  };
}

/** True when a change dir has a spec artifact under EITHER convention (Gap G1). */
function hasNestedSpec(relDir, { exists, listDir }) {
  const specsDir = `${relDir}/specs`;
  if (!exists(specsDir)) return false;
  let entries;
  try {
    entries = listDir(specsDir);
  } catch {
    return false;
  }
  return entries.some(name => exists(`${specsDir}/${name}/spec.md`));
}

/**
 * Extracts the set of touched openspec/changes/** directory names from a list
 * of changed file paths, in first-seen order.
 */
function touchedDirNames(changedFiles) {
  const names = [];
  const seen = new Set();
  for (const f of changedFiles) {
    if (!f.startsWith(CHANGE_DIR_PREFIX)) continue;
    const name = f.slice(CHANGE_DIR_PREFIX.length).split('/')[0];
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/**
 * Builds one changeDirs entry for evaluatePhaseOrder from filesystem + git-show
 * state. `hasSpec` folds BOTH conventions (Gap G1): a root `spec.md` OR any
 * `specs/*\/spec.md` nested file. `statusBefore`/`statusAfter` are sourced from
 * `tasks.md`'s frontmatter (design §2 — the file this checker also reads
 * `checkedTasks` from), before vs. after this diff.
 */
function buildChangeDir(name, { exists, listDir, readFile, showAtRef, baseSha }) {
  const relDir = `${CHANGE_DIR_PREFIX}${name}`;
  const tasksPath = `${relDir}/tasks.md`;

  const hasProposal = exists(`${relDir}/proposal.md`);
  const hasDesign = exists(`${relDir}/design.md`);
  const hasTasks = exists(tasksPath);
  const hasSpecRoot = exists(`${relDir}/spec.md`);
  const hasSpec = hasSpecRoot || hasNestedSpec(relDir, { exists, listDir });

  const tasksTextAfter = readFile(tasksPath);
  const checkedTasks = countCheckedTasks(tasksTextAfter);
  const statusAfter = parseStatus(tasksTextAfter);
  const statusBefore = parseStatus(showAtRef(baseSha, tasksPath));

  return { name, hasProposal, hasSpec, hasDesign, hasTasks, checkedTasks, statusBefore, statusAfter };
}

/**
 * Gathers `evaluatePhaseOrder`'s `{ changedFiles, changeDirs }` input from git
 * + the filesystem (or from injected `deps` in tests).
 *
 * @param {{ baseSha: string, headSha: string, cwd?: string, deps?: object }} args
 * @returns {{ changedFiles: string[], changeDirs: Array }}
 */
export function gatherPhaseOrderInputs({ baseSha, headSha, cwd = process.cwd(), deps = {} } = {}) {
  const diffNameOnly = deps.diffNameOnly ?? defaultDiffNameOnly(cwd);
  const exists = deps.exists ?? defaultExists(cwd);
  const listDir = deps.listDir ?? defaultListDir(cwd);
  const readFile = deps.readFile ?? defaultReadFile(cwd);
  const showAtRef = deps.showAtRef ?? defaultShowAtRef(cwd);

  const changedFiles = diffNameOnly(baseSha, headSha);
  const changeDirs = touchedDirNames(changedFiles).map(name =>
    buildChangeDir(name, { exists, listDir, readFile, showAtRef, baseSha })
  );

  return { changedFiles, changeDirs };
}

/**
 * Runs the full L4 phase-order check: gathers inputs (git I/O) and evaluates
 * the pure rules. Never throws — an uncomputable diff (missing BASE_SHA/
 * HEAD_SHA, or a failing git command) degrades to `warn` rather than `fail`,
 * keeping REQ-L4-5's zero-false-positive goal intact while this job is
 * detection-only (DETECTION_JOBS).
 *
 * @param {{ cwd?: string, baseSha?: string, headSha?: string, deps?: object }} [deps]
 * @returns {{ level: 'pass'|'warn'|'fail', findings: Array }}
 */
export function runPhaseOrderCheck(deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const baseSha = deps.baseSha ?? process.env.BASE_SHA;
  const headSha = deps.headSha ?? process.env.HEAD_SHA;

  if (!baseSha || !headSha) {
    return {
      level: 'warn',
      findings: [
        {
          rule: 'wrapper',
          level: 'warn',
          message: 'BASE_SHA/HEAD_SHA not set — cannot compute diff; skipping phase-order check.',
        },
      ],
    };
  }

  let inputs;
  try {
    inputs = gatherPhaseOrderInputs({ baseSha, headSha, cwd, deps });
  } catch (err) {
    return {
      level: 'warn',
      findings: [
        {
          rule: 'wrapper',
          level: 'warn',
          message: `phase-order-check: could not gather inputs — ${err.message}`,
        },
      ],
    };
  }

  return evaluatePhaseOrder(inputs);
}

function formatFinding(f) {
  const rulePart = f.rule && f.rule !== 'wrapper' ? `Rule ${f.rule}` : 'wrapper';
  const changePart = f.change ? `${f.change}: ` : '';
  return `  [${f.level}] (${rulePart}) ${changePart}${f.message}`;
}

/**
 * Runs the check, prints the verdict, and returns the process exit code — kept
 * separate from `process.exit()` itself so it stays testable (mirrors
 * run-check.mjs's main()). Exit 0 on pass/warn, 1 on fail.
 *
 * @param {object} [deps]
 * @returns {0|1}
 */
export function main(deps = {}) {
  const result = runPhaseOrderCheck(deps);
  console.log(`phase-order-check: ${result.level}`);
  for (const finding of result.findings) {
    console.log(formatFinding(finding));
  }
  return result.level === 'fail' ? 1 : 0;
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
