// capture-reachable.test.mjs — #530: there must be a route from "an agent knows
// something" to a durable record, IN THE ENVIRONMENT WHERE THE AGENT WORKS.
//
// Measured before the fix, and this file is the shape of that measurement:
//
//   MEMORY_BACKEND defaults to ....................... engram
//   engram.save() ................................... refuses by design
//   the refusal pointed at .......................... `engram save`, a binary
//                                                     `command -v` cannot find here
//   plainfiles.save() ............................... works, fully tested
//   reachable as an npm verb ........................ no
//
// So a working records-only writer existed and nothing could reach it. The gap was
// never the writer — it was every signpost pointing somewhere else.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const pkg = JSON.parse(readFileSync(`${REPO}/package.json`, 'utf8'));

test('#530: capture is exposed as a managed verb', () => {
  assert.ok(pkg.scripts['memory:save'],
    'the capture half had no npm verb at all — index/share/pull/reindex existed, save did not');
});

test('#530: the verb pins the backend that works without engram', () => {
  // Not a suggestion in a doc: the verb itself carries it, so the operator does
  // not have to know that the default backend refuses this op.
  assert.match(pkg.scripts['memory:save'], /MEMORY_BACKEND=plainfiles/,
    'under the default backend this verb refuses — pinning it here is what makes the verb usable');
  assert.match(pkg.scripts['memory:save'], /cli\.mjs save/);
});

test('#530: engram\'s refusal names a route that exists HERE, not only the native tool', async () => {
  // The old message said "use engram's native mem_save / 'engram save' instead."
  // That is actionable on a machine with engram and unactionable in the agent
  // environment, which is the environment the outage happened in. A refusal that
  // points at an absent binary is a dead end wearing a helpful tone.
  const { t } = await import('../i18n/t.mjs');
  const say = (locale) => t('memory.save.engramUnsupported', { op: 'save', backend: 'engram' }, { locale });

  const en = await say('en');
  const es = await say('es');

  // The option is `locale`. The first version of this test passed `{ lang }`, which
  // `t` ignores — so it resolved the ambient catalogue twice and asserted one
  // language while reporting two. N=1 wearing an N=2 loop, in the file whose subject
  // is measuring honestly. This line is what makes the collapse impossible: if the
  // option is ever renamed or dropped, the two come back equal and this fails.
  assert.notEqual(en, es, 'both locales resolved to the same string — the locale option is not being honoured');

  for (const [locale, msg] of [['en', en], ['es', es]]) {
    assert.match(msg, /plainfiles/, `[${locale}] the refusal must name the backend that works here`);
    assert.match(msg, /memory:save/, `[${locale}] and the verb that reaches it`);
    assert.match(msg, /--type/, `[${locale}] including the flag that is required, since it has no default`);
  }
});

test('#530: the CLI actually forwards --issue — the parser is a layer of its own', async (t) => {
  // Every other #530 guard drives `save()` directly, so the PARSER had no coverage:
  // deleting `--issue` from it left the whole suite green. Proving a behaviour at one
  // layer says nothing about the layer above it, which is the same shape that let a
  // `readMergeParent` guard sit unexercised on #518.
  const { mkdtempSync, rmSync, mkdirSync, readFileSync: read, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');

  const root = mkdtempSync(join(tmpdir(), 'capture-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.memory', 'records'), { recursive: true });

  const r = spawnSync('node', [`${REPO}/brain/scripts/memory/cli.mjs`, 'save', 'title', 'content',
    '--type', 'discovery', '--issue', '530'], {
    encoding: 'utf8',
    env: { ...process.env, MEMORY_BACKEND: 'plainfiles', BRAIN_MEMORY_TEST_ROOT: root },
  });
  assert.equal(r.status, 0, `the CLI must save:\n${r.stdout}\n${r.stderr}`);

  // The filename is `<yyyy-mm>.jsonl` derived from the record's own timestamp, so
  // hardcoding this month would pass today and fail on the 1st. Read whatever landed.
  const dir = join(root, '.memory', 'records');
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  assert.equal(files.length, 1, `exactly one records file should exist: ${files.join(', ')}`);
  const line = read(join(dir, files[0]), 'utf8').trim().split('\n').pop();
  assert.equal(JSON.parse(line).issue, 530,
    'the flag reached the parser and not the record — an untagged record is what #368 measured 2157 times');
});
