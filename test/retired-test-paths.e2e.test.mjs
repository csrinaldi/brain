// retired-test-paths.e2e.test.mjs — the list of test infrastructure earlier releases
// shipped under the managed `brain/scripts/**` glob, so `brain:upgrade` can prune it
// (issue #1076).
//
// The upgrader that runs is the consumer's INSTALLED (older) one; it imports the
// INCOMING package's `retired-paths.mjs` and removes exactly what that exports. So
// the prune is DATA: an exact list, generated from git, never new upgrader logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isTestInfraPath, publishedTags, generateList, renderModule } from './tools/retired-test-paths.mjs';
import { RETIRED_TEST_PATHS } from '../brain/scripts/lib/retired-test-paths.mjs';
import { RETIRED_PATHS } from '../brain/scripts/lib/retired-paths.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('#1076: the classifier names test infrastructure and nothing a consumer runs', () => {
  for (const yes of [
    'brain/scripts/lib/installer.test.mjs',
    'brain/scripts/review/lib/deep/x.e2e.test.mjs',
    'brain/scripts/__fixtures__/pull-fixture.mjs',
    'brain/scripts/memory/__fixtures__/env.mjs',
    'brain/scripts/ui/test-support/dom.mjs',
    'brain/scripts/vcs/fixtures/github-prView-happy.json',
    'brain/scripts/lib/hermetic-box.mjs',
    'brain/scripts/lib/test-brain-home.mjs',
    'brain/scripts/lib/test-tmp.mjs',
    'brain/scripts/test-hygiene.mjs',
  ]) assert.equal(isTestInfraPath(yes), true, yes);
  for (const no of [
    'brain/scripts/lib/tmp-tree.mjs',            // runtime: memory/lane/collect.mjs imports it
    'brain/scripts/lib/installer.mjs',
    'brain/scripts/vcs/port-coverage.mjs',
    'brain/core/managed-paths.mjs',
    'test/publish-allowlist.e2e.test.mjs',        // outside brain/scripts
    'brain/scripts/lib/latest-fixtures-note.mjs', // a name containing "fixtures" is not a fixtures dir
  ]) assert.equal(isTestInfraPath(no), false, no);
});

test('#1076: the committed list is well formed and not vacuous', () => {
  assert.ok(RETIRED_TEST_PATHS.length > 400, `only ${RETIRED_TEST_PATHS.length} entries — a vacuous list prunes nothing`);
  const sorted = [...RETIRED_TEST_PATHS].sort();
  assert.deepEqual([...RETIRED_TEST_PATHS], sorted, 'sorted, so a regeneration diff is minimal');
  assert.equal(new Set(RETIRED_TEST_PATHS).size, RETIRED_TEST_PATHS.length, 'no duplicates');
  for (const rel of RETIRED_TEST_PATHS) assert.equal(isTestInfraPath(rel), true, `${rel} is not test infrastructure`);
  assert.ok(RETIRED_TEST_PATHS.includes('brain/scripts/lib/installer.test.mjs'));
  assert.ok(RETIRED_TEST_PATHS.includes('brain/scripts/ui/test-support/load-app.mjs'));
});

test('#1076: RETIRED_PATHS carries every generated entry (the old upgrader reads only this export)', () => {
  const have = new Set(RETIRED_PATHS);
  for (const rel of RETIRED_TEST_PATHS) assert.ok(have.has(rel), `${rel} missing from RETIRED_PATHS`);
  assert.equal(new Set(RETIRED_PATHS).size, RETIRED_PATHS.length, 'RETIRED_PATHS has no duplicates');
});

test('#1076: the committed module equals a regeneration from the published tags', (t) => {
  let tags;
  try { tags = publishedTags(REPO_ROOT); } catch { tags = []; }
  if (!tags.includes('v1.12.1')) return t.skip('release tags are not fetched in this checkout');
  assert.ok(tags.length >= 10, 'the tag set is not vacuous');
  const generated = generateList(REPO_ROOT, tags);
  assert.deepEqual([...RETIRED_TEST_PATHS], generated, 'run `npm run retired:test-paths` to regenerate');
  const onDisk = readFileSync(join(REPO_ROOT, 'brain/scripts/lib/retired-test-paths.mjs'), 'utf8');
  assert.equal(onDisk, renderModule(generated, tags), 'the file is byte-identical to the generator output');
});
