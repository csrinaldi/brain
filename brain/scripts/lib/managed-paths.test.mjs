// managed-paths.test.mjs — Unit tests for brain/core/managed-paths.mjs
// Run with: npm test   (node --test, no dependencies)
//
// Covers REQ-S1-4: the two specific governance files must be listed as managed
// paths so they travel with brain on upgrade. The glob `.github/**` must NEVER
// be present — it would clobber a consumer's own workflows, issue templates,
// and CODEOWNERS on brain:upgrade.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  managed,
  local,
  MANAGED_SCRIPT_KEYS,
  RECORDS_UNION_MERGE_GITATTRIBUTES_LINE,
} from '../../core/managed-paths.mjs';
import { matchesAny } from './installer.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

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

// install-home-scaffold REQ-6, hardened: the two literal-only assertions above
// would not catch a future BROAD glob (e.g. `brain/**`) that silently pulls
// brain/HOME.md into `managed` without ever containing the literal string
// "brain/HOME.md". Assert via the actual glob matcher the installer uses
// (matchesAny, from installer.mjs) that no managed pattern MATCHES the path —
// not just that no entry equals it literally.
test('no managed glob MATCHES brain/HOME.md, via the real glob matcher (REQ-6, hardened)', () => {
  assert.equal(matchesAny('brain/HOME.md', managed), false,
    'brain/HOME.md must not match any managed glob — it would be clobbered on brain:upgrade');
});

// install-home-scaffold REQ-7: brain/scripts/lib/home-index.mjs must be
// covered by a managed glob so it ships to every consumer via brain:upgrade.
test('a managed glob covers brain/scripts/lib/home-index.mjs (REQ-7)', () => {
  assert.equal(matchesAny('brain/scripts/lib/home-index.mjs', managed), true,
    'brain/scripts/lib/home-index.mjs must be reachable by a managed glob (e.g. brain/scripts/**)');
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

// issue #214, C1b: the records/*.jsonl union-merge .gitattributes line is a
// single-source-of-truth constant (mirrors the MANAGED_SCRIPT_KEYS pattern
// above), so this repo's own .gitattributes can be drift-guarded against it.
test('RECORDS_UNION_MERGE_GITATTRIBUTES_LINE is the exact expected literal', () => {
  assert.equal(
    RECORDS_UNION_MERGE_GITATTRIBUTES_LINE,
    '/.memory/records/*.jsonl merge=union',
  );
});

test('.gitattributes contains the exact RECORDS_UNION_MERGE_GITATTRIBUTES_LINE literal (drift guard)', () => {
  const content = readFileSync(join(REPO_ROOT, '.gitattributes'), 'utf8');
  const lines = content.split('\n').map((l) => l.trim());
  assert.ok(
    lines.includes(RECORDS_UNION_MERGE_GITATTRIBUTES_LINE),
    `.gitattributes must contain the exact line: ${RECORDS_UNION_MERGE_GITATTRIBUTES_LINE}`,
  );
});
