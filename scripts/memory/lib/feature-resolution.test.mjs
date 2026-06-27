// feature-resolution.test.mjs — unit tests for resolveFeature().
//
// Acceptance criteria (task 2.2 / REQ-S2-1):
//   (a) Explicit arg with valid dir → returns arg.
//   (b) Explicit arg with missing dir → throws (dir not found).
//   (c) No arg, exactly one change dir → returns that dir.
//   (d) No arg, multiple change dirs → throws "ambiguous" with dir list.
//   (e) No arg, zero change dirs → returns null.
//   (f) 'archive' dir is excluded from candidates.
//   (g) 'archive' excluded, one real feature → returns real feature.
//
// Tests use temp dirs — no real openspec/ is touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// RED: import will fail until feature-resolution.mjs is created (task 2.4).
import { resolveFeature } from './feature-resolution.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempRoot() {
  return mkdtempSync(join(tmpdir(), 'feat-res-'));
}

function makeChangesDir(root, names) {
  const changesDir = join(root, 'openspec', 'changes');
  mkdirSync(changesDir, { recursive: true });
  for (const name of names) {
    mkdirSync(join(changesDir, name), { recursive: true });
  }
  return changesDir;
}

// ---------------------------------------------------------------------------
// (a) Explicit arg, valid dir
// ---------------------------------------------------------------------------

test('resolveFeature: explicit arg with valid dir returns the arg', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  makeChangesDir(root, ['my-feature', 'other-feature']);

  const result = resolveFeature(root, 'my-feature');
  assert.equal(result, 'my-feature');
});

// ---------------------------------------------------------------------------
// (b) Explicit arg, dir does NOT exist → throws
// ---------------------------------------------------------------------------

test('resolveFeature: explicit arg with missing dir throws with the arg name', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  makeChangesDir(root, ['other-feature']);

  assert.throws(
    () => resolveFeature(root, 'nonexistent'),
    (err) => {
      assert.ok(
        err.message.includes('nonexistent'),
        `expected 'nonexistent' in: ${err.message}`,
      );
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// (c) No arg, exactly one dir → returns it
// ---------------------------------------------------------------------------

test('resolveFeature: no arg and exactly one change dir returns that dir', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  makeChangesDir(root, ['solo-feature']);

  const result = resolveFeature(root, undefined);
  assert.equal(result, 'solo-feature');
});

// ---------------------------------------------------------------------------
// (d) No arg, multiple dirs → throws "ambiguous" with list
// ---------------------------------------------------------------------------

test('resolveFeature: no arg with multiple dirs throws ambiguous error listing them', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  makeChangesDir(root, ['feature-a', 'feature-b', 'feature-c']);

  assert.throws(
    () => resolveFeature(root, undefined),
    (err) => {
      assert.ok(err.message.includes('ambiguous'), `expected 'ambiguous' in: ${err.message}`);
      assert.ok(err.message.includes('feature-a'), `expected 'feature-a' in: ${err.message}`);
      assert.ok(err.message.includes('feature-b'), `expected 'feature-b' in: ${err.message}`);
      assert.ok(err.message.includes('feature-c'), `expected 'feature-c' in: ${err.message}`);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// (e) No arg, zero dirs → returns null
// ---------------------------------------------------------------------------

test('resolveFeature: no arg and zero change dirs returns null', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  makeChangesDir(root, []);

  const result = resolveFeature(root, undefined);
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// (f) 'archive' dir is excluded from candidates
// ---------------------------------------------------------------------------

test('resolveFeature: archive-only dir returns null (archive is excluded)', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  makeChangesDir(root, ['archive']);

  const result = resolveFeature(root, undefined);
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// (g) archive excluded, one real feature → returns real feature
// ---------------------------------------------------------------------------

test('resolveFeature: archive excluded, single real feature returned', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  makeChangesDir(root, ['archive', 'real-feature']);

  const result = resolveFeature(root, undefined);
  assert.equal(result, 'real-feature');
});
