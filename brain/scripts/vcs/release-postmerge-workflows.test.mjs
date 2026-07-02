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

// On `schedule` events, github.event.before does not exist, so the unconditional
// range "${{ github.event.before }}..${{ github.sha }}" becomes "..<sha>" which
// git treats as sha..sha — an empty range. The daily cron backstop (REQ-L2-2's
// whole purpose) would never catch anything. The workflow must branch on
// github.event_name and, on schedule, audit from the latest tag to HEAD instead.
test('governance-postmerge.yml branches on github.event_name for the cron leg', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(
    text,
    /github\.event_name.*=.*['"]schedule['"]/,
    'governance-postmerge.yml must branch on github.event_name == schedule to avoid auditing an empty range on cron runs'
  );
});

test('governance-postmerge.yml still uses github.event.before for the push-triggered path', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(
    text,
    /github\.event\.before/,
    'governance-postmerge.yml must still use github.event.before on the push (non-cron) path'
  );
});

// Idempotency (#165): a re-run on the same SHA — a retry, or the daily cron
// re-hitting an already-flagged commit before its revert PR merges — must not
// fail loudly on the existing auto-revert branch/PR. The workflow must check
// whether auto-revert/<sha7> already exists on origin and no-op if so, before
// reverting / pushing / opening the PR.
test('governance-postmerge.yml guards auto-revert branch idempotency before creating it', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(
    text,
    /git ls-remote --exit-code --heads origin/,
    'governance-postmerge.yml must check whether the auto-revert branch already exists on origin (idempotency guard, #165)'
  );
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
