import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTempTree } from '../__fixtures__/tmp-tree.mjs';
import { versionProbe, detectInstalled } from './axis-installed.mjs';

test('versionProbe reads brain\'s own package version, and never throws', () => {
  assert.match(versionProbe(), /^\d+\.\d+\.\d+/);
  assert.equal(versionProbe({ packageJson: '/nonexistent/package.json' }), null);
  const dir = mkdtempSync(join(tmpdir(), 'brain-1114-pkg-'));
  try {
    writeFileSync(join(dir, 'package.json'), '{ not json');
    assert.equal(versionProbe({ packageJson: join(dir, 'package.json') }), null);
  } finally { removeTempTree(dir); }
});

test('detectInstalled answers only for brain itself — no spawning probe (#1130 owns those)', () => {
  const got = detectInstalled();
  assert.deepEqual(Object.keys(got), ['sdd']);
  assert.deepEqual(Object.keys(got.sdd), ['brain']);
  assert.deepEqual(detectInstalled({ packageJson: '/nonexistent' }), {});
});
