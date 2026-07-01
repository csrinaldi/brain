// phase-order-check.mjs — Pure evaluator for the L4 SDD phase-order gate (design §2,
// REQ-L4-1..4). Sibling to check-refs.mjs. Generic over openspec/changes/** file state
// + git — no SKILL.md, no harness assumption (REQ-NEUTRALITY-1/2).
//
// PR4a scope: the pure evaluator ONLY (evaluatePhaseOrder). The git I/O wrapper
// (git diff --name-only, readdirSync/existsSync artifact flags, `- [x]` counting,
// `git show BASE:path` for statusBefore) and CLI entrypoint are PR4b.

// ── Constants ────────────────────────────────────────────────────────────────

const CHANGE_DIR_PREFIX = 'openspec/changes/';

// Allowlist subtracted from the "impl" set (Rule C): files that never count as
// implementation code even when they live outside openspec/changes/**.
const ROOT_MD_RE = /^[^/]+\.md$/;

function isAllowlisted(path) {
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

  if (touchedDirs.length === 1 && touchedDirs[0].checkedTasks === 0) {
    const dir = touchedDirs[0];
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

  const findings = [...evaluateRuleC(impl, touchedDirs), ...evaluateRuleA(impl, touchedDirs)];

  const level = findings.some(f => f.level === 'fail')
    ? 'fail'
    : findings.some(f => f.level === 'warn')
      ? 'warn'
      : 'pass';

  return { level, findings };
}
