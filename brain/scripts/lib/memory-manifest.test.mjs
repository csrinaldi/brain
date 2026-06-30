// memory-manifest.test.mjs — unit tests for restoreManifestChurn() (issue #138, PR1).
//
// Extracts day-start.mjs's pre-sync manifest-restore block (lines ~117-129)
// verbatim in behavior: discards uncommitted local churn in the derived
// .memory/manifest.json index so a git merge can proceed safely.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { restoreManifestChurn } from './memory-manifest.mjs';

test('restoreManifestChurn: churn present → restore called, {restored:true}', () => {
  const calls = [];
  const _spawn = (cmd, args) => {
    calls.push([cmd, args]);
    if (args[0] === 'status') return { status: 0, stdout: ' M .memory/manifest.json\n' };
    return { status: 0, stdout: '' };
  };
  const result = restoreManifestChurn('/repo', { _spawn });
  assert.deepEqual(result, { restored: true });
  assert.equal(calls.length, 2, 'expects a status call and a restore call');
  assert.deepEqual(calls[0], ['git', ['status', '--porcelain', '--', '.memory/manifest.json']]);
  assert.deepEqual(calls[1], ['git', ['restore', '--', '.memory/manifest.json']]);
});

test('restoreManifestChurn: clean → no restore call, {restored:false}', () => {
  const calls = [];
  const _spawn = (cmd, args) => {
    calls.push([cmd, args]);
    return { status: 0, stdout: '' };
  };
  const result = restoreManifestChurn('/repo', { _spawn });
  assert.deepEqual(result, { restored: false });
  assert.equal(calls.length, 1, 'restore must not be called when clean');
});

test('restoreManifestChurn: spy throws → {restored:false}, never throws', () => {
  const _spawn = () => { throw new Error('spawn git ENOENT'); };
  assert.doesNotThrow(() => restoreManifestChurn('/repo', { _spawn }));
  assert.deepEqual(restoreManifestChurn('/repo', { _spawn }), { restored: false });
});

test('restoreManifestChurn: only ever touches .memory/manifest.json', () => {
  const paths = [];
  const _spawn = (cmd, args) => {
    paths.push(args[args.length - 1]);
    return { status: 0, stdout: ' M .memory/manifest.json\n' };
  };
  restoreManifestChurn('/repo', { _spawn });
  for (const p of paths) assert.equal(p, '.memory/manifest.json');
});
