// managed-paths.test.mjs — Unit tests for brain/core/managed-paths.mjs
// Run with: npm test   (node --test, no dependencies)
//
// Covers REQ-S1-4: the two specific governance files must be listed as managed
// paths so they travel with brain on upgrade. The glob `.github/**` must NEVER
// be present — it would clobber a consumer's own workflows, issue templates,
// and CODEOWNERS on brain:upgrade.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { managed, local, MANAGED_SCRIPT_KEYS } from '../../core/managed-paths.mjs';

test('managed includes .github/workflows/governance.yml (exact literal)', () => {
  assert.ok(
    managed.includes('.github/workflows/governance.yml'),
    'managed must contain the exact literal ".github/workflows/governance.yml"',
  );
});

test('managed includes .github/PULL_REQUEST_TEMPLATE.md (exact literal)', () => {
  assert.ok(
    managed.includes('.github/PULL_REQUEST_TEMPLATE.md'),
    'managed must contain the exact literal ".github/PULL_REQUEST_TEMPLATE.md"',
  );
});

test('managed does NOT contain .github/** (never clobber consumer GitHub files)', () => {
  assert.ok(
    !managed.includes('.github/**'),
    'managed must NOT contain ".github/**" — that glob would overwrite consumer workflows on upgrade',
  );
});

// Issue #176 bug 1: the L2 rung-2/rung-3 workflow files must travel with
// brain on upgrade, as exact literals — never the broad .github/** glob.
// Without these, rung-2/rung-3 enforcement never reaches any consumer.
test('managed includes .github/workflows/release.yml (exact literal, issue #176)', () => {
  assert.ok(
    managed.includes('.github/workflows/release.yml'),
    'managed must contain the exact literal ".github/workflows/release.yml"',
  );
});

test('managed includes .github/workflows/governance-postmerge.yml (exact literal, issue #176)', () => {
  assert.ok(
    managed.includes('.github/workflows/governance-postmerge.yml'),
    'managed must contain the exact literal ".github/workflows/governance-postmerge.yml"',
  );
});

// REQ-S3-1: managed declares brain/scripts/**, not scripts/**
test('managed includes brain/scripts/** (REQ-S3-1)', () => {
  assert.ok(
    managed.includes('brain/scripts/**'),
    'managed must contain "brain/scripts/**" (S3 namespace migration)',
  );
});

// REQ-S3-3: consumer root scripts/ is not a managed path
test('managed does NOT contain scripts/** (REQ-S3-3)', () => {
  assert.ok(
    !managed.includes('scripts/**'),
    'managed must NOT contain "scripts/**" — consumer root scripts/ is consumer-owned after S3',
  );
});

// REQ-L6-1: .github/CODEOWNERS (rung-1 enhancement, design §6.2) must travel with
// brain on upgrade, as an exact literal — never the broad .github/** glob, which
// would clobber a consumer's own CODEOWNERS, issue templates, or other workflows.
test('managed includes .github/CODEOWNERS (exact literal, REQ-L6-1)', () => {
  assert.ok(
    managed.includes('.github/CODEOWNERS'),
    'managed must contain the exact literal ".github/CODEOWNERS"',
  );
});

// S5: package.json must be a managed path for specialMerge injection.
test('managed includes package.json (S5)', () => {
  assert.ok(
    managed.includes('package.json'),
    'managed must contain "package.json" so brain:upgrade routes it through specialMerge',
  );
});

// install-home-scaffold REQ-6: brain/HOME.md must stay outside both managed
// and local — managed would clobber curated ADR links on every brain:upgrade,
// local only protects files that already exist at scaffold time. Consumer-owned
// by design.
test('managed does NOT contain an entry matching brain/HOME.md or HOME.md (REQ-6)', () => {
  const hit = managed.find((p) => p === 'brain/HOME.md' || p === 'HOME.md');
  assert.equal(hit, undefined,
    `managed must not contain an entry matching brain/HOME.md or HOME.md — found "${hit}"`);
});

test('local does NOT contain an entry matching brain/HOME.md or HOME.md (REQ-6)', () => {
  const hit = local.find((p) => p === 'brain/HOME.md' || p === 'HOME.md');
  assert.equal(hit, undefined,
    `local must not contain an entry matching brain/HOME.md or HOME.md — found "${hit}"`);
});

// S5 + #154: MANAGED_SCRIPT_KEYS must have exactly 9 entries, all prefixed brain:.
test('MANAGED_SCRIPT_KEYS has exactly 9 entries, all prefixed brain: (S5)', () => {
  assert.equal(MANAGED_SCRIPT_KEYS.length, 9,
    'MANAGED_SCRIPT_KEYS must contain exactly 9 brain:* verb keys');
  for (const key of MANAGED_SCRIPT_KEYS) {
    assert.ok(key.startsWith('brain:'),
      `every key must start with "brain:" — got "${key}"`);
  }
});
