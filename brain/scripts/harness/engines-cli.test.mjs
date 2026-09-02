// engines-cli.test.mjs — issue #824: the I/O half against a real child
// process and the REAL in-repo frameworks (plain, gentle-ai — both are
// repo-local data since #814, so this runs on any machine).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { removeTempTree } from '../__fixtures__/tmp-tree.mjs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'engines-cli.mjs');

function world(t) {
  const root = mkdtempSync(join(tmpdir(), 'brain-824-'));
  t.after(() => removeTempTree(root));
  // A custom stage rides along (the #456 shape), so the survey has one answer
  // gentle-ai's recording never saw — the `derived` visibility case is real.
  writeFileSync(join(root, 'brain.config.json'), JSON.stringify({
    schemaVersion: '0.10.0',
    sdd: { stages: { proposal: {}, spec: {}, design: {}, tasks: {}, 'cold-review': { artefact: 'cold-review.md' } } },
  }, null, 2) + '\n', 'utf8');
  return root;
}

const run = (root, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8' });

test('#824 cli: the survey reports BOTH frameworks, per stage, and exits 0', (t) => {
  const r = run(world(t));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /plain/);
  assert.match(r.stdout, /gentle-ai/);
  assert.match(r.stdout, /proposal/, 'stages come from the resolved set');
  assert.match(r.stdout, /human/, "plain's agent is visible");
  assert.match(r.stdout, /derived/i, "gentle-ai's unseen-stage answer states its provenance state or the report is a laundering surface");
});

test('#824 cli: --record fails CLOSED while sdd.engines is undeclared, and the config is byte-untouched', (t) => {
  const root = world(t);
  const before = readFileSync(join(root, 'brain.config.json'), 'utf8');
  const r = run(root, '--record');
  assert.equal(r.status, 1, 'the sequencing consequence: the 1.4.0 draft is not promoted yet');
  assert.match(r.stderr, /sdd\.engines/);
  assert.equal(readFileSync(join(root, 'brain.config.json'), 'utf8'), before);
});

test('#824 cli: no brain.config.json is a named refusal, not a stack trace', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'brain-824-empty-'));
  t.after(() => removeTempTree(root));
  const r = run(root);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /brain\.config\.json/);
});
