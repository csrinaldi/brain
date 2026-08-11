// release-postmerge-workflows.test.mjs — Structural tests for PR7 (S7).
//
// L2 release-gate (rung 2, fail-closed) + post-merge auto-revert (rung 3).
// REQ-L2-1, REQ-L2-2 — design.md §3.
//
// Both workflows reuse brain-audit.mjs unchanged and are deliberately SEPARATE
// files from governance.yml (design §10-B, gap B): the PR-time gate stays
// read-only; only the trusted post-merge context gets contents: write +
// pull-requests: write.
//
// Run with: npm test (node --test)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { auditWorkflowAuth } from './lib/workflow-auth.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

// ════════════════════════════════════════════════════════════════════════════
// PR4 (#304) — WORKFLOW-EXTRACTING TEST HARNESS, BORN ISOLATED (Phase 4.0,
// design §7.4, owner Ruling #902). This is the FIRST place this branch runs
// extracted workflow bash. The isolation contract below is an ACCEPTANCE
// CRITERION of every such test, honored from its first RED — never written
// un-isolated and patched later.
// ════════════════════════════════════════════════════════════════════════════

// extractRunScript(yamlText, stepId) — return the dedented `run: |` block of the
// step whose `id:` is stepId. Pure text parse (js-yaml is not a dependency).
function extractRunScript(yamlText, stepId) {
  const lines = yamlText.split('\n');
  let i = lines.findIndex((l) => /^\s*- id:\s*/.test(l) && l.trim() === `- id: ${stepId}`);
  assert.ok(i !== -1, `extractRunScript: step id '${stepId}' not found`);
  const stepIndent = lines[i].indexOf('- ');
  // Scan within this step (until the next `- ` at the same indent, or EOF) for `run: |`.
  let runIdx = -1;
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (l.trim() && l.indexOf('- ') === stepIndent && /^\s*- /.test(l)) break; // next step
    if (/^\s*run:\s*\|\s*$/.test(l)) { runIdx = j; break; }
  }
  assert.ok(runIdx !== -1, `extractRunScript: step '${stepId}' has no 'run: |' block`);
  const runIndent = lines[runIdx].search(/\S/);
  const body = [];
  for (let j = runIdx + 1; j < lines.length; j++) {
    const l = lines[j];
    if (l.trim() === '') { body.push(''); continue; }
    const ind = l.search(/\S/);
    if (ind <= runIndent) break; // block ended
    body.push(l.slice(runIndent + 2)); // dedent (run content is runIndent+2)
  }
  return body.join('\n');
}

// THE ISOLATION CONTRACT (Phase 4.0). Every extracted-script spawn MUST run with
// these env overrides and a temp cwd/HOME — so a `git config` (even a stray
// --global) can never touch the real user's config or the real repo. No
// inherited GH_TOKEN: the isolated bash must reach a stubbed `gh`, never the network.
function isolatedEnv(homeDir, extra = {}) {
  const env = {
    PATH: `${join(homeDir, 'bin')}:${process.env.PATH}`,
    HOME: homeDir,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    RUNNER_TEMP: homeDir,
    GITHUB_OUTPUT: join(homeDir, 'github_output'),
    ...extra,
  };
  // Deliberately NO GH_TOKEN — the isolated run must not authenticate.
  return env;
}

// A recording `gh` stub: logs each invocation to $GH_LOG, prints canned output
// for read subcommands, and (by default) succeeds. Placed on PATH ahead of the
// real gh so no isolated test ever hits the network or needs a token.
function writeGhStub(binDir, { prListPrints = '', issueListPrints = '', exitCode = 0 } = {}) {
  mkdirSync(binDir, { recursive: true });
  const gh = join(binDir, 'gh');
  writeFileSync(gh, [
    '#!/usr/bin/env bash',
    'echo "gh $*" >> "${GH_LOG:-/dev/null}"',
    'case "$1 $2" in',
    `  "pr list") printf '%s' ${JSON.stringify(prListPrints)} ;;`,
    `  "issue list") printf '%s' ${JSON.stringify(issueListPrints)} ;;`,
    '  *) : ;;',
    'esac',
    `exit ${exitCode}`,
    '',
  ].join('\n'));
  chmodSync(gh, 0o755);
}

// Make the extracted script cwd-independent: the workflow calls
// `node brain/scripts/...` relative to the checkout root; rewrite those to the
// real repo's absolute path so the REAL cursor/audit/parse logic runs against
// the temp repo's git state (cursor.mjs & friends operate on process.cwd()).
function absolutizeNodePaths(script) {
  return script.replaceAll('node brain/scripts/', `node ${REPO_ROOT}/brain/scripts/`);
}

// Substitute the `${{ steps.*.outputs.* }}` expressions with test values.
function substituteExpr(script, subs) {
  let out = script;
  for (const [expr, val] of Object.entries(subs)) {
    out = out.replaceAll(expr, val);
  }
  return out;
}

// Run an extracted step script in an isolated temp repo. Returns {status, stdout, stderr, homeDir}.
function runStepIsolated(stepId, { repoSetup, subs = {}, ghOpts = {}, env = {} } = {}) {
  const homeDir = mkdtempSync(join(tmpdir(), 'pm-iso-'));
  writeGhStub(join(homeDir, 'bin'), ghOpts);
  writeFileSync(join(homeDir, 'github_output'), '');
  const repo = join(homeDir, 'repo');
  mkdirSync(repo, { recursive: true });
  const yamlText = readFileSync(POSTMERGE_YML, 'utf8');
  const g = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8', env: isolatedEnv(homeDir) });
  g('init', '--initial-branch=main');
  g('config', 'user.name', 'Test');
  g('config', 'user.email', 't@t');
  if (repoSetup) repoSetup(g, repo, homeDir);
  let script = extractRunScript(yamlText, stepId);
  script = absolutizeNodePaths(substituteExpr(script, subs));
  const r = spawnSync('bash', ['-c', script], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...isolatedEnv(homeDir, env), GH_LOG: join(homeDir, 'gh.log') },
  });
  return { ...r, homeDir, repo, ghLog: () => (existsSync(join(homeDir, 'gh.log')) ? readFileSync(join(homeDir, 'gh.log'), 'utf8') : ''), output: () => readFileSync(join(homeDir, 'github_output'), 'utf8') };
}

const RELEASE_YML = resolve(REPO_ROOT, '.github/workflows/release.yml');
const POSTMERGE_YML = resolve(REPO_ROOT, '.github/workflows/governance-postmerge.yml');
const GOVERNANCE_YML = resolve(REPO_ROOT, '.github/workflows/governance.yml');

// ── release.yml (rung 2, fail-closed) — REQ-L2-1 ────────────────────────────

test('release.yml exists', () => {
  assert.ok(existsSync(RELEASE_YML), 'expected .github/workflows/release.yml to exist');
});

test('release.yml references brain-audit.mjs', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /brain-audit\.mjs/, 'release.yml must invoke brain-audit.mjs');
});

test('release.yml triggers on workflow_dispatch with required tag_name input (audit-then-tag)', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /workflow_dispatch:/, 'release.yml must trigger on workflow_dispatch (audit-then-tag)');
  assert.match(text, /tag_name:/, 'release.yml must accept tag_name input');
  assert.match(text, /required:\s*true/, 'release.yml tag_name must be required');
});

test('release.yml does NOT have push:tags trigger (audit-then-tag prevents post-fact execution)', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.doesNotMatch(text, /push:\s*tags:/, 'release.yml must not have push:tags (would enable post-fact, non-enforcing mode)');
});

test('release.yml declares write contents permission (needed to create and push tags)', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /permissions:\s*\{[^}]*\bcontents:\s*write\b/, 'release.yml must declare contents: write (to create/push tags)');
});

// audit-then-tag mode: the audit runs BEFORE tag creation, from PREV_TAG..HEAD
// (the commits being tagged), which is always non-empty. This enforces that
// brain-audit must pass before any tag is created.
test('release.yml derives the audit range from the previous release tag to HEAD', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /git describe --tags/, 'release.yml must locate the previous release tag via git describe --tags');
  assert.match(text, /PREV_TAG/, 'release.yml must reference PREV_TAG (the previous release)');
  assert.match(text, /PREV_TAG\}?\.\.HEAD/, 'release.yml must audit PREV_TAG..HEAD (commits to be tagged)');
});

test('release.yml has a step that creates and pushes the tag (only after audit succeeds)', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /git tag/, 'release.yml must create a tag via `git tag`');
  assert.match(text, /git push origin/, 'release.yml must push the tag via `git push origin`');
  assert.match(text, /TAG_NAME/, 'release.yml must use the TAG_NAME variable for the tag value');
});

test('release.yml routes tag_name via env: not spliced into run: (security precedent from governance-postmerge.yml)', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /env:\s*TAG_NAME:\s*\$\{\{\s*inputs\.tag_name\s*\}\}/, 'tag_name must be routed via env: (untrusted user input)');
});

// ═══════════════════════════════════════════════════════════════════════════
// #479 / #475 — THE AUDIT'S CREDENTIAL, AND THE SCOPE THAT MAKES IT WORK.
//
// Both tickets describe this guard as an EXTENSION of one #467 added ("every
// step that reads the API declares its own env: GH_TOKEN"). Measured while
// implementing them: no such guard exists in this file, or anywhere else in the
// suite — changing governance-postmerge.yml's audit step from `GH_TOKEN` to
// `VCS_TOKEN` left all 3004 other tests green. #467 fixed the workflow and the
// guard was never written, which is why #475 could then ship the identical
// defect one rung down without anything noticing.
//
// TWO conditions, and the second is the load-bearing one:
//
//   1. Every step that runs the audit declares the credential.
//   2. Every workflow that declares a `permissions:` block grants the audit a
//      scope to read pull requests.
//
// A `permissions:` block sets every scope it OMITS to `none`, so a step can
// carry a perfectly good token and still be unable to read `pulls/{n}`. Asserting
// only (1) produces a gate that LOOKS fixed and still runs blind — #475's central
// point, and the reason the two are asserted together and never apart.
// ═══════════════════════════════════════════════════════════════════════════

// The rule lives in `lib/workflow-auth.mjs` and is imported, never restated here.
// #480 hardened it against the ten shapes that defeated PR #476's version, and a
// second copy of a rule is the defect #340 records: two implementations of one rule
// disagree, and the one CI runs is not the one anybody reads.

// ═══════════════════════════════════════════════════════════════════════════
// T1 (issue #535, Requirement 7) — the integration proof, deliberately LAST.
// `governance.yml` joins the audited set alongside the two workflows the
// guard already covered. This is the point where every fix from #535 has to
// hold TOGETHER: WU1's credential swap, WU2's entry-point invariant, WU3's
// manifest, WU4's per-invocation resolution, WU7's block-style permissions
// parse. Before all of them landed, this was red for two unrelated reasons at
// once (the GH_TOKEN steps AND the whole-file over-approximation flagging
// memory-gate/decision-gate) — indistinguishable from here alone, which is
// why this proof runs only once everything else is in place.
// ═══════════════════════════════════════════════════════════════════════════

test('#479/#475/#535 drift guard: every audited workflow is compliant — VCS_TOKEN declared with a scope that can read PRs', () => {
  for (const [file, path] of [
    ['release.yml', RELEASE_YML],
    ['governance-postmerge.yml', POSTMERGE_YML],
    ['governance.yml', GOVERNANCE_YML],
  ]) {
    assert.deepEqual(auditWorkflowAuth(readFileSync(path, 'utf8'), { file, repoRoot: REPO_ROOT }), []);
  }
});

test('#479/#475 drift guard: it has TEETH — each condition alone is caught', () => {
  // Condition 1: the credential removed.
  const noToken = [
    'permissions: { contents: write, pull-requests: read }',
    'jobs:',
    '  g:',
    '    steps:',
    '      - name: Run the audit',
    '        run: node brain/scripts/brain-audit.mjs "a..b"',
  ].join('\n');
  assert.match(auditWorkflowAuth(noToken, { repoRoot: REPO_ROOT }).join('\n'), /does not declare VCS_TOKEN/);

  // Condition 2: the credential present, the SCOPE missing. This is the one an
  // eyeball review passes — the step looks authenticated, and the token it gets
  // cannot read a pull request.
  const noScope = [
    'permissions: { contents: write }',
    'jobs:',
    '  g:',
    '    steps:',
    '      - name: Run the audit',
    '        env:',
    '          VCS_TOKEN: ${{ github.token }}',
    '        run: node brain/scripts/brain-audit.mjs "a..b"',
  ].join('\n');
  assert.match(auditWorkflowAuth(noScope, { repoRoot: REPO_ROOT }).join('\n'), /every omitted scope is 'none'/);

  // And a step that merely NAMES the credential in a comment is not compliant.
  const commentOnly = noToken.replace(
    '        run: node',
    '        # VCS_TOKEN: handled elsewhere\n        run: node',
  );
  assert.match(auditWorkflowAuth(commentOnly, { repoRoot: REPO_ROOT }).join('\n'), /does not declare VCS_TOKEN/);
});

test('#479/#475 drift guard: reverting the audit step to the provider-specific GH_TOKEN is caught', () => {
  // The precise regression #479 removes. `GH_TOKEN` is not wrong on a step that
  // shells out to `gh` directly — it is wrong on the step that reaches the server
  // THROUGH the port, because that is the path GitLab consumers also execute.
  const reverted = readFileSync(POSTMERGE_YML, 'utf8')
    .replace('VCS_TOKEN: ${{ github.token }}', 'GH_TOKEN: ${{ github.token }}');
  assert.notEqual(reverted, readFileSync(POSTMERGE_YML, 'utf8'), 'the mutation must land');
  assert.match(auditWorkflowAuth(reverted, { file: 'governance-postmerge.yml', repoRoot: REPO_ROOT }).join('\n'), /does not declare VCS_TOKEN/);
});

test('#535 T1: reverting governance.yml\'s diff-size step to GH_TOKEN is caught (the precise #535 regression, this time on the PR-time gate)', () => {
  const original = readFileSync(GOVERNANCE_YML, 'utf8');
  const diffSizeBlock = original.match(/^  diff-size:\s*$[\s\S]*?(?=^  [a-z][\w-]*:\s*$)/m);
  assert.ok(diffSizeBlock, 'the diff-size job must be locatable in governance.yml');
  const revertedBlock = diffSizeBlock[0].replace('VCS_TOKEN: ${{ github.token }}', 'GH_TOKEN: ${{ github.token }}');
  assert.notEqual(revertedBlock, diffSizeBlock[0], 'the mutation must land');
  const reverted = original.replace(diffSizeBlock[0], revertedBlock);
  assert.match(
    auditWorkflowAuth(reverted, { file: 'governance.yml', repoRoot: REPO_ROOT }).join('\n'),
    /does not declare VCS_TOKEN/
  );
});

// ── governance-postmerge.yml (rung 3, auto-revert) — REQ-L2-2 ──────────────

test('governance-postmerge.yml exists', () => {
  assert.ok(existsSync(POSTMERGE_YML), 'expected .github/workflows/governance-postmerge.yml to exist');
});

test('governance-postmerge.yml references brain-audit.mjs', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /brain-audit\.mjs/, 'governance-postmerge.yml must invoke brain-audit.mjs');
});

test('governance-postmerge.yml declares contents: write and pull-requests: write', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /contents:\s*write/, 'governance-postmerge.yml must declare contents: write (trusted post-merge context)');
  assert.match(text, /pull-requests:\s*write/, 'governance-postmerge.yml must declare pull-requests: write (to open the auto-revert PR)');
});

test('governance-postmerge.yml triggers on push to main and a daily schedule', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /branches:\s*\[main\]/, 'governance-postmerge.yml must trigger on push to main');
  assert.match(text, /schedule:/, 'governance-postmerge.yml must also trigger on a schedule (daily cron)');
});

// Drift guard (issue #468, REQ-R3-3): substrate.mjs's POSTMERGE_STALE_MS
// (rung 3's staleness window) is derived from "2 periods of the daily cron" —
// a constant, not a live read of this file. If the cron cadence ever changes
// without updating that constant, the two silently drift apart and rung 3's
// staleness window stops matching reality. No cron parser (zero-dependency
// doctrine, substrate.mjs:111-114) — a shape assertion plus a literal value
// check is enough to catch drift.
//
// Uses `matchAll` (every `- cron:` entry), NOT a single non-global `.match()`
// — a single match only inspects the FIRST cron entry, so ADDING a second
// entry (e.g. an hourly cron alongside the daily one) would change the
// effective cadence while the guard silently kept passing on entry #1 alone.
// `assertCronDriftGuard` is shared by the real-file test below and the
// synthetic-drift test, so both exercise the identical guard logic.
function assertCronDriftGuard(text, staleMs) {
  // Count DECLARED entries independently of the ones this guard can parse. The
  // value matcher reads quoted scalars; a second entry in a shape it does not
  // read (double quotes, unquoted) would otherwise change the effective cadence
  // while the guard passed on the entries it happened to see — a guard blind to
  // exactly the drift it exists to catch. Any unparseable entry is drift.
  const declared = [...text.matchAll(/-\s*cron\s*:/g)].length;
  const matches = [...text.matchAll(/-\s*cron:\s*['"]([^'"]+)['"]/g)];
  assert.ok(matches.length > 0, 'must declare at least one cron schedule string');
  assert.equal(
    matches.length,
    declared,
    `found ${declared} cron entr${declared === 1 ? 'y' : 'ies'} but could only read ${matches.length} — an entry this guard cannot parse is an entry it cannot check`,
  );
  assert.equal(
    matches.length,
    1,
    `expected exactly one cron entry, found ${matches.length} — multiple schedule entries change the effective cadence and require re-deriving POSTMERGE_STALE_MS`,
  );
  assert.match(
    matches[0][1],
    /^\d+\s+\d+\s+\*\s+\*\s+\*$/,
    'the cron must stay daily-shaped (minute hour * * *) — a cadence change requires re-deriving POSTMERGE_STALE_MS',
  );
  assert.equal(
    staleMs,
    2 * 24 * 60 * 60 * 1000,
    'POSTMERGE_STALE_MS must stay 2 daily cron periods (48h). A cadence change requires updating THREE things together: this constant, the literal on this line, and the daily-shape regex above — the constant alone leaves this guard failing on its own assertion.',
  );
}

// The operator-facing threshold strings must INTERPOLATE the constant, never
// restate it. No behavioural assertion can prove this while the literal and the
// derived value coincide — `older than 48h` and `older than ${LABEL}` render
// identically today, so a unit test passes either way and the regression is
// invisible until someone changes the constant. Asserting the SOURCE is the only
// form that distinguishes them, and it is exactly what the drift guard needs:
// the moment POSTMERGE_STALE_MS moves, a hardcoded string starts lying, and the
// guard above forces that move to be deliberate.
test('drift guard: the operator-facing threshold strings interpolate POSTMERGE_STALE_LABEL, never a hardcoded literal', () => {
  const substrateSrc = readFileSync(fileURLToPath(new URL('./substrate.mjs', import.meta.url)), 'utf8');
  const statusSrc = readFileSync(fileURLToPath(new URL('../brain-governance-status.mjs', import.meta.url)), 'utf8');

  assert.match(
    substrateSrc,
    /stale \(older than \$\{POSTMERGE_STALE_LABEL\}\)/,
    "E8's stale reason must interpolate POSTMERGE_STALE_LABEL — a hardcoded threshold survives every behavioural test and starts lying the moment the constant moves",
  );
  assert.match(
    statusSrc,
    /succeeded within \$\{POSTMERGE_STALE_LABEL\}\]/,
    "the armed line must interpolate POSTMERGE_STALE_LABEL for the same reason",
  );
});

test('drift guard: governance-postmerge.yml cron stays daily-shaped, and POSTMERGE_STALE_MS stays 2 daily periods', async () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  const { POSTMERGE_STALE_MS } = await import('./substrate.mjs');
  assertCronDriftGuard(text, POSTMERGE_STALE_MS);
});

test('drift guard: adding a second cron entry (e.g. an hourly cron alongside the daily one) trips the guard', async () => {
  const { POSTMERGE_STALE_MS } = await import('./substrate.mjs');
  const textWithTwoCrons = `
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'
    - cron: '0 * * * *'
`;
  assert.throws(
    () => assertCronDriftGuard(textWithTwoCrons, POSTMERGE_STALE_MS),
    /exactly one cron entry/,
    'a second cron entry must trip the drift guard — the effective cadence changed even though entry #1 is still daily-shaped',
  );
});

// ── D2 (#259): the cursor-windowed, exit-code-branched, [FAIL-SHA]-consuming
// shape. These INVERT the pre-D2 assertions above: the window is no longer the
// push payload's before..sha (which skips offenders and collapses on cron) — it
// is the governance cursor range. ────────────────────────────────────────────

// The v1 range (github.event.before..github.sha) is GONE: it skips an offender
// that landed while an earlier run was pinned (REQ-D2-1), and collapses to an
// empty sha..sha on cron. The window is the cursor's — never the push payload's.
test('governance-postmerge.yml does NOT window on github.event.before (the skip-over regression)', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.doesNotMatch(
    text,
    /github\.event\.before/,
    'governance-postmerge.yml must NOT use github.event.before — the audit window is the governance cursor range (REQ-D2-1)'
  );
});

test('governance-postmerge.yml resolves the audit window from the cursor CLI', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(
    text,
    /cursor\.mjs window/,
    'governance-postmerge.yml must resolve the window via `cursor.mjs window` (cursor..HEAD), not the push payload'
  );
});

// The audit's NUMERIC exit code is authoritative: continue-on-error flattens 1
// and 2 into a boolean, which would let an uncomputable (code 2) trigger a
// revert. The workflow must capture the numeric code and branch on it (REQ-D2-6).
test('governance-postmerge.yml does NOT flatten the audit exit code via continue-on-error', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.doesNotMatch(
    text,
    /continue-on-error:\s*true/,
    'governance-postmerge.yml must not use continue-on-error (it flattens exit 1 and 2 — a code-2 must never revert)'
  );
});

test('governance-postmerge.yml branches on the numeric audit code (0/1/2), not steps.*.outcome', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /steps\.audit\.outputs\.code\s*==\s*'0'/, 'code 0 must advance the cursor');
  assert.match(text, /steps\.audit\.outputs\.code\s*==\s*'1'/, 'code 1 must revert the parsed offenders');
  assert.match(text, /steps\.audit\.outputs\.code\s*==\s*'2'/, 'code 2 must raise a loud infra issue, never revert');
  assert.doesNotMatch(
    text,
    /steps\.audit\.outcome\s*==\s*'failure'/,
    'governance-postmerge.yml must branch on the numeric code, never the boolean outcome'
  );
});

// The revert consumes the ONE tested parser (REQ-D2-5) — never github.sha
// blindly, never an inline grep of stdout.
test('governance-postmerge.yml reverts the parsed [FAIL-SHA] offenders, not github.sha blindly', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(
    text,
    /parse-failures\.mjs/,
    'governance-postmerge.yml must parse offenders through parse-failures.mjs (REQ-D2-5)'
  );
  assert.doesNotMatch(
    text,
    /git revert[^\n]*github\.sha/,
    'governance-postmerge.yml must not blindly revert github.sha — it reverts the parsed offenders'
  );
});

// Parents-only count (REQ-D2-4): never `grep -c '^parent '` (also matches
// commit-message lines beginning with `parent `).
test('governance-postmerge.yml counts merge parents via %P, never grep -c "^parent "', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /git show -s --format=%P/, 'must count parents via `git show -s --format=%P`');
  assert.doesNotMatch(
    text,
    /grep -c ['"]\^parent /,
    'must not use `grep -c "^parent "` (matches message lines too — REQ-D2-4)'
  );
});

// PR-keyed idempotency (REQ-D2-13): dedup on the PR (`--state all`), so a
// closed-without-merge PR is never reopened or duplicated.
test('governance-postmerge.yml dedups auto-revert on the PR (--state all), not the branch', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(
    text,
    /gh pr list --head[^\n]*--state all/,
    'governance-postmerge.yml must dedup via `gh pr list --head <br> --state all` (REQ-D2-13, PR-keyed)'
  );
});

// Untrusted audit output is routed via env: and written to a file, never
// argv-spliced into a run: block (CWE-94, §4.5.1/4.5.2).
test('governance-postmerge.yml routes audit stdout via env:, never ${{ }}-spliced into run:', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /AUDIT_STDOUT:\s*\$\{\{\s*steps\.audit\.outputs\.stdout\s*\}\}/, 'audit stdout must reach run: via env:, not inline splicing');
  assert.match(text, /--body-file/, 'loud/PR bodies must be passed via --body-file, never argv-spliced');
});

// Loud paths carry no `|| true` (a swallowed failure is a silent halt), and the
// workflow guards against overlapping runs.
test('governance-postmerge.yml has a concurrency group and no swallowed loud paths', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /concurrency:\s*\{\s*group:\s*governance-postmerge/, 'must declare a concurrency group (§5.3)');
  assert.doesNotMatch(
    text,
    /gh (issue|label|pr) create[^\n]*\|\|\s*true/,
    'no loud path (gh issue/label/pr create) may be suffixed with `|| true`'
  );
});

// The terminal-state assertion runs always() and fails the job if the audit
// produced no mapped code (e.g. it was SIGKILLed) — never a silent clean pass.
test('governance-postmerge.yml asserts a terminal audit code via always()', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /if:\s*always\(\)/, 'must carry an always() terminal-state assertion step');
});

// ── design §10-B: separate-file isolation ───────────────────────────────────
//
// The read-only PR gate (governance.yml) must never gain write scope. Rung 3's
// write permissions live ONLY in governance-postmerge.yml, a file that governance.yml
// does not reference and vice versa — both files exist independently.

test('governance-postmerge.yml is a separate file from governance.yml (read-only PR gate isolation)', () => {
  assert.ok(existsSync(GOVERNANCE_YML), 'expected .github/workflows/governance.yml to exist (baseline PR gate)');
  assert.ok(existsSync(POSTMERGE_YML), 'expected .github/workflows/governance-postmerge.yml to exist as a SEPARATE file');
  assert.notEqual(GOVERNANCE_YML, POSTMERGE_YML, 'governance-postmerge.yml must not be the same path as governance.yml');

  const governanceText = readFileSync(GOVERNANCE_YML, 'utf8');
  assert.doesNotMatch(
    governanceText,
    /contents:\s*write/,
    'governance.yml (the PR-time gate) must stay read-only — write scope must not leak into it'
  );
});

// ── C1 (Phase 4.2, SELF-CONTAINED per #304 I304-C1-TARGET-ABSENT): the
// skip-over proof. Cursor pinned at C; offender M lands; clean P2 lands. The
// window step must resolve C..P2 (still containing M), NEVER a before..sha
// window that would skip M. The fixture mints its own repo + bare origin +
// governance cursor ref — it reads no live server branch. ──────────────────
test('C1 skip-over: the window step resolves cursor..HEAD (C..P2, containing M), never a payload range', () => {
  let cSha, mSha, p2Sha;
  const r = runStepIsolated('window', {
    repoSetup: (g, repo, homeDir) => {
      // bare origin so cursor.mjs's remote-authoritative ls-remote works
      const origin = join(homeDir, 'origin.git');
      spawnSync('git', ['init', '--bare', origin], { encoding: 'utf8', env: isolatedEnv(homeDir) });
      g('remote', 'add', 'origin', origin);
      writeFileSync(join(repo, 'f'), 'base\n'); g('add', '.'); g('commit', '-m', 'C0');
      // C — the cursor point
      writeFileSync(join(repo, 'f'), 'C\n'); g('add', '.'); g('commit', '-m', 'C (cursor)');
      cSha = g('rev-parse', 'HEAD').stdout.trim();
      // M — an offender merge lands after C
      g('checkout', '-b', 'off'); writeFileSync(join(repo, 'm'), 'offender\n'); g('add', '.'); g('commit', '-m', 'M work');
      g('checkout', 'main'); g('merge', '--no-ff', 'off', '-m', 'M: offender merge'); mSha = g('rev-parse', 'HEAD').stdout.trim();
      // P2 — a clean merge lands after M
      g('checkout', '-b', 'clean'); writeFileSync(join(repo, 'p'), 'clean\n'); g('add', '.'); g('commit', '-m', 'P2 work');
      g('checkout', 'main'); g('merge', '--no-ff', 'clean', '-m', 'P2: clean merge'); p2Sha = g('rev-parse', 'HEAD').stdout.trim();
      g('push', 'origin', 'main');
      // pin the governance cursor at C on origin
      g('push', 'origin', `${cSha}:refs/governance/audit-cursor`);
    },
  });
  assert.equal(r.status, 0, `window step must exit 0 on a present cursor:\n${r.stdout}\n${r.stderr}`);
  const out = r.output();
  assert.match(out, new RegExp(`range=${cSha}\\.\\.${p2Sha}`),
    `window must be C..P2 (contains M=${mSha.slice(0,7)}); got GITHUB_OUTPUT:\n${out}`);
});

// ── C2 (Phase 4.1): a cursor that resolves to UNKNOWN/ABSENT halts with exit 2
// and NEVER emits a range — an inferred empty range must never pass as clean.
// Here the repo has NO origin/governance ref → readCursor is UNKNOWN (ls-remote
// on a nonexistent remote is not status-2/absent). The step must exit 2 and
// write no range. ──────────────────────────────────────────────────────────
test('C2: an uncomputable cursor halts the window step at exit 2, emitting no range', () => {
  const r = runStepIsolated('window', {
    repoSetup: (g, repo) => {
      writeFileSync(join(repo, 'f'), 'x\n'); g('add', '.'); g('commit', '-m', 'c0');
      // no origin remote at all → ls-remote fails non-2 → UNKNOWN (fail-closed)
    },
  });
  assert.equal(r.status, 2, `an uncomputable cursor must exit 2 (fail-closed):\n${r.stdout}\n${r.stderr}`);
  assert.doesNotMatch(r.output(), /range=/, `no audit range may be emitted on an uncomputable cursor:\n${r.output()}`);
  assert.match(r.ghLog(), /gh (label|issue) create/, `a loud issue must be raised on halt:\n${r.ghLog()}`);
});

// ── C4 (Phase 4.3): the audit step normalizes an unmapped exit code to 2 BEFORE
// branching, so a killed/garbled audit can never advance the cursor or revert.
// A stub audit that exits 3 must surface as code=2 in GITHUB_OUTPUT. ─────────
test('C4: an unmapped audit exit code (3) is normalized to 2 before branching', () => {
  const r = runStepIsolated('audit', {
    subs: { '${{ steps.window.outputs.range }}': 'AAA..BBB' },
    repoSetup: (g, repo, homeDir) => {
      // shadow the audit invocation: put a fake node script path? The step calls
      // `node <REPO>/brain/scripts/brain-audit.mjs`. Stub by prepending a `node`
      // wrapper on PATH that intercepts brain-audit.mjs and exits 3.
      const bin = join(homeDir, 'bin');
      writeFileSync(join(bin, 'node'), [
        '#!/usr/bin/env bash',
        'for a in "$@"; do case "$a" in *brain-audit.mjs) echo "[FAIL] simulated"; exit 3;; esac; done',
        'exec /usr/bin/env -i PATH="/usr/bin:/bin:/usr/local/bin" node "$@"',
      ].join('\n'));
      chmodSync(join(bin, 'node'), 0o755);
    },
  });
  assert.equal(r.status, 0, `audit step itself exits 0 (it captures the code):\n${r.stdout}\n${r.stderr}`);
  assert.match(r.output(), /code=2/, `an exit-3 audit must normalize to code=2:\n${r.output()}`);
  assert.doesNotMatch(r.output(), /code=3/, 'the raw unmapped code must not survive');
});

// ── C5 (Phase 4.4): if the tested parser fails while code==1, the revert step
// fails closed — never a silently empty offender list. A stub parse-failures
// that exits non-zero must abort the step (set -e via command substitution). ─
test('C5: a parse-failures crash while reverting fails the step closed, never an empty offender list', () => {
  const r = runStepIsolated('revert', {
    env: { AUDIT_STDOUT: '[FAIL-SHA] ' + 'a'.repeat(40) },
    repoSetup: (g, repo, homeDir) => {
      writeFileSync(join(repo, 'f'), 'x\n'); g('add', '.'); g('commit', '-m', 'c0');
      const bin = join(homeDir, 'bin');
      // Intercept the parse-failures.mjs node call and make it crash.
      writeFileSync(join(bin, 'node'), [
        '#!/usr/bin/env bash',
        'for a in "$@"; do case "$a" in *parse-failures.mjs) echo "parser boom" >&2; exit 7;; esac; done',
        'exec /usr/bin/env node "$@"',
      ].join('\n'));
      chmodSync(join(bin, 'node'), 0o755);
    },
  });
  assert.notEqual(r.status, 0, `a parser crash must fail the revert step, never yield an empty list:\n${r.stdout}\n${r.stderr}`);
});

// ── D1 (Phase 4.0.1): a drift-guard over THIS test file, proven with teeth.
// Every `spawnSync('bash', ...)` that runs extracted workflow script MUST carry
// the isolation env (isolatedEnv). The guard scans source text and reports any
// bash spawn whose call is not accompanied by isolatedEnv within its options.
// Teeth: it must FLAG a deliberately non-compliant sample and PASS the real file.
function auditBashIsolation(sourceText) {
  const violations = [];
  const lines = sourceText.split('\n');
  lines.forEach((l, idx) => {
    // Scan CODE only — a drift-guard that trips on its own prose is noise. Skip
    // comment lines (a bash-spawn mentioned in a comment is not an execution).
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*')) return;
    if (/spawnSync\(\s*['"]bash['"]/.test(l)) {
      // look at the next ~8 lines for the options object carrying isolatedEnv
      const window = lines.slice(idx, idx + 8).join('\n');
      if (!/isolatedEnv\(/.test(window)) violations.push(idx + 1);
    }
  });
  return violations;
}

test('D1 isolation drift-guard: every extracted-bash spawn in this file is isolated (proven with teeth)', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.deepEqual(
    auditBashIsolation(self), [],
    'every spawnSync("bash", ...) that runs workflow script must carry isolatedEnv(...)',
  );
  // TEETH: a non-compliant sample (bash spawn WITHOUT isolatedEnv) must be
  // flagged. The spawn token is assembled at runtime so this teeth-sample is NOT
  // itself a literal in this file's source — otherwise the guard above would
  // (correctly) flag its own sample and this test could never pass clean.
  const spawnTok = 'spawn' + 'Sync("bash"';
  const badSample = [
    `const r = ${spawnTok}, ["-c", script], {`,
    '  cwd: repo,',
    '  env: { ...process.env },',
    '});',
  ].join('\n');
  assert.ok(
    auditBashIsolation(badSample).length > 0,
    'the drift-guard has no teeth — it failed to flag a bash spawn missing isolatedEnv',
  );
});

// ── D2 (Phase 4.0.3): the real repository's git identity is UNCHANGED by running
// an isolated extracted-script step — even one that itself runs `git config`.
// The isolation contract (HOME=temp, GIT_CONFIG_GLOBAL=/dev/null) guarantees a
// stray global write cannot reach the developer's ~/.gitconfig or this repo. ─
test('D2 isolation: an isolated step running git config leaves the real repo/user identity untouched', () => {
  const before = spawnSync('git', ['config', '--get-regexp', '^user\\.'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout;
  // Run the gitidentity step isolated — it sets user.name/email on ITS repo.
  const r = runStepIsolated('gitidentity', {
    repoSetup: (g, repo) => { writeFileSync(join(repo, 'f'), 'x\n'); g('add', '.'); g('commit', '-m', 'c0'); },
  });
  assert.equal(r.status, 0, `gitidentity step must succeed in isolation:\n${r.stderr}`);
  const after = spawnSync('git', ['config', '--get-regexp', '^user\\.'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout;
  assert.equal(after, before, 'the real repository\'s user.* config changed — isolation leaked');
  // And the isolated repo DID get the bot identity (the step actually ran).
  const isoName = spawnSync('git', ['config', 'user.name'], { cwd: r.repo, encoding: 'utf8', env: isolatedEnv(r.homeDir) }).stdout.trim();
  assert.equal(isoName, 'github-actions[bot]', 'the isolated repo must have received the bot identity');
});

// ═══════════════════════════════════════════════════════════════════════════
// #466 (REQ-TS-4/-5) — NO TERMINAL STATE MAY BE BOTH RED AND SILENT.
//
// These execute the SHIPPED steps out of the real YAML, per this repo's
// standing bar (#464's harness pattern): reading the workflow is not evidence.
//
// The state under test is T5 — brain-audit exits 1 with ZERO [FAIL-SHA] lines,
// which §15.5 documents as LEGITIMATE (every surviving violation is in a
// non-auto-revertible class, or a tree-keyed failure was suppressed because its
// revert would resurrect a payload). Before this change the revert step called
// that "incoherent" and exited 2, while the alarm step — gated on the AUDIT
// step's output of '1' — never ran. Red, nothing reverted, no alarm, cursor
// frozen. Observed live on 2026-08-06, run 31094912872 over c724942.
// ═══════════════════════════════════════════════════════════════════════════

/** An exit-1 audit stdout with real [FAIL] lines and NO [FAIL-SHA] — the T5 shape. */
const T5_AUDIT_STDOUT = [
  '[FAIL] c724942 Merge pull request #471 from csrinaldi/fix — issueLink: no issue reference found',
  '[FAIL] d70093a Merge pull request #468 from csrinaldi/adr — adrPresence: ADR added but brain/HOME.md not updated',
].join('\n');

/** Give the revert step a repo with a commit, so `git rev-parse HEAD` resolves. */
const oneCommit = (g, repo) => { writeFileSync(join(repo, 'f'), 'x\n'); g('add', '.'); g('commit', '-m', 'c0'); };

test('#466 REQ-TS-4: exit 1 with ZERO offenders FILES AN ALARM (never red-and-silent)', () => {
  const r = runStepIsolated('revert', {
    env: { AUDIT_STDOUT: T5_AUDIT_STDOUT },
    repoSetup: oneCommit,
  });

  // The invariant: this state reaches an alarm. Before the fix the step printed
  // "incoherent, failing closed" and exited 2 with no gh call whatsoever.
  assert.match(r.ghLog(), /issue (create|comment)/,
    `a failed-but-unrevertible audit MUST file an alarm — gh log was:\n${r.ghLog()}\n${r.stdout}\n${r.stderr}`);
  assert.match(r.ghLog(), /governance:audit-unrevertible/,
    `the alarm must carry its own honest label, not 'uncomputable':\n${r.ghLog()}`);
  assert.notEqual(r.status, 0, 'the job must still fail — this is a halt, not an accept');
});

test('#466 REQ-TS-4: the step no longer calls a documented §15.5 state "incoherent"', () => {
  const r = runStepIsolated('revert', {
    env: { AUDIT_STDOUT: T5_AUDIT_STDOUT },
    repoSetup: oneCommit,
  });
  assert.doesNotMatch(`${r.stdout}${r.stderr}`, /incoherent/,
    'brain-audit.mjs\'s own contract says a [FAIL-SHA] count of 0 on exit 1 is LEGITIMATE (§15.5)');
});

test('#466 REQ-TS-4: the cursor is NOT advanced by the unrevertible halt', () => {
  const r = runStepIsolated('revert', {
    env: { AUDIT_STDOUT: T5_AUDIT_STDOUT },
    repoSetup: oneCommit,
  });
  // Auto-advancing here would perform `cursor.mjs accept` — a gate the design
  // made a human keystroke WITH a written reason (REQ-D2-10a) — with neither.
  assert.doesNotMatch(r.stdout, /cursor advanced/, 'an unrevertible failure must never advance the cursor');
  assert.match(r.stdout, /cursor stays pinned/i, 'the halt must say the cursor is pinned');
});

// ── The BACKSTOP (REQ-TS-5) — the load-bearing half. #466 was an alarm gated on
// an ENUMERATION of exit codes, and a state inside code 1 was missed. A branch
// for that one state leaves the next unenumerated state just as silent, so the
// invariant is asserted over the JOB OUTCOME instead. ────────────────────────

function runTerminal(env, ghOpts = {}) {
  return runStepIsolated('terminal', { env, ghOpts, repoSetup: oneCommit });
}

test('REQ-TS-5 backstop: a RED job with no alarm recorded files the backstop alarm', () => {
  const r = runTerminal({ JOB_STATUS: 'failure', AUDIT_CODE: '1' });

  assert.match(r.ghLog(), /governance:postmerge-unreported/,
    `a red job that filed no alarm must be caught by the backstop:\n${r.ghLog()}\n${r.stdout}\n${r.stderr}`);
  assert.notEqual(r.status, 0, 'the backstop must keep the job red');
});

test('REQ-TS-5 backstop: a red job with an UNMAPPED audit code (killed audit) is also caught', () => {
  // The audit process was killed and wrote no output at all — `code` is empty.
  const r = runTerminal({ JOB_STATUS: 'failure', AUDIT_CODE: '' });

  assert.match(r.ghLog(), /governance:postmerge-unreported/,
    `an empty audit code is a terminal state too, and must not be silent:\n${r.ghLog()}`);
  assert.notEqual(r.status, 0);
});

test('REQ-TS-5 backstop: a red job that ALREADY alarmed does not double-file', () => {
  const r = runTerminal({
    JOB_STATUS: 'failure', AUDIT_CODE: '1', ALARM_REVERT: 'governance:audit-unrevertible',
  });

  assert.doesNotMatch(r.ghLog(), /postmerge-unreported/,
    `the backstop must not duplicate an alarm a step already filed:\n${r.ghLog()}`);
  assert.notEqual(r.status, 0, 'the job stays red either way');
});

test('REQ-TS-5 backstop: a GREEN job files nothing', () => {
  const r = runTerminal({ JOB_STATUS: 'success', AUDIT_CODE: '0' });

  assert.equal(r.ghLog(), '', `a clean run must file no alarm at all:\n${r.ghLog()}`);
  assert.equal(r.status, 0, `a green job must stay green:\n${r.stdout}\n${r.stderr}`);
});

// ── The invariant itself, as a PROPERTY over every terminal code rather than a
// per-code fixture. This is the assertion #466's acceptance asks for. ────────
test('REQ-TS-5 PROPERTY: for every terminal audit code, red ⟹ an alarm exists', () => {
  const unreported = [];
  for (const code of ['0', '1', '2', '3', '']) {
    for (const jobStatus of ['success', 'failure']) {
      for (const prior of ['', 'governance:audit-uncomputable']) {
        const r = runTerminal({ JOB_STATUS: jobStatus, AUDIT_CODE: code, ALARM_WINDOW: prior });
        const mapped = ['0', '1', '2'].includes(code);
        const red = jobStatus === 'failure' || !mapped;
        const alarmed = prior !== '' || /issue (create|comment)/.test(r.ghLog());
        if (red && !alarmed) unreported.push(`code='${code}' job='${jobStatus}' prior='${prior}'`);
        // And a red terminal state must always keep the job red.
        if (red) assert.notEqual(r.status, 0, `red state left the job green: code='${code}' job='${jobStatus}'`);
      }
    }
  }
  assert.deepEqual(unreported, [],
    `these terminal states were RED AND SILENT — the #466 signature:\n${unreported.join('\n')}`);
});
