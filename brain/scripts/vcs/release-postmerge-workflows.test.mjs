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
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

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

test('release.yml triggers on tags matching v*', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /tags:\s*\[\s*['"]v\*['"]\s*\]/, "release.yml must trigger on push tags: ['v*']");
});

test('release.yml declares read-only contents permission (fail-closed, no write scope)', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /permissions:\s*\{\s*contents:\s*read\s*\}/, 'release.yml must declare permissions: { contents: read }');
});

// brain merges the release PR to main, THEN tags that commit. On the tag push,
// origin/main is at/ahead of the tagged commit, so origin/main..HEAD is EMPTY —
// brain-audit.mjs logs "No merge commits found" and exits 0 unconditionally,
// making the rung-2 gate a silent no-op. The audit must instead run from the
// PREVIOUS release tag to the tagged commit, which is always non-empty.
test('release.yml does NOT use the empty origin/main..HEAD range on a tag push', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.doesNotMatch(
    text,
    /brain-audit\.mjs\s+origin\/main\.\.HEAD/,
    'release.yml must not invoke brain-audit.mjs with origin/main..HEAD — that literal range is empty on brain\'s tag-after-merge flow'
  );
});

test('release.yml derives the audit range from the previous release tag', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /git describe --tags/, 'release.yml must locate the previous release tag via git describe --tags');
  assert.match(text, /GITHUB_REF_NAME/, 'release.yml must use GITHUB_REF_NAME to identify the tag being released');
  assert.match(text, /PREV_TAG\}?\.\.HEAD/, 'release.yml must audit PREV_TAG..HEAD (previous tag to the tagged commit)');
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
