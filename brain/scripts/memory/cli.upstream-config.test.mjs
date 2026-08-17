// cli.upstream-config.test.mjs — issue #701: the `memory:share` half of the
// `configError` channel, end to end, through the REAL cli.mjs.
//
// ── why a child process and not a unit test ─────────────────────────────────
//
// Every other layer of this channel already had a detector. `resolveUpstreamRef`
// carrying `configError`, `upstreamRecordEntries` carrying it on both arms,
// `dualWriteRecords` accounting for it in `upstreamScope` — drop any of those and
// the suite reddens. The PRINT had none: cold review round 2 of #701 neutered
// `if (scope.configError)` in `cli.mjs` and the full suite stayed at 4001 pass /
// 0 fail. An unread report is the same outage as no report, which is exactly the
// failure #574 and #641 each opened on, so the assertion has to be on what the
// process EMITS — cli.mjs is a top-level script with no importable seam anyway.
//
// ── on STDERR specifically ──────────────────────────────────────────────────
//
// `brain/scripts/hooks/pre-push` runs `memory:share` with stdout discarded. A
// config nobody could read is precisely the silent-degradation notice that must
// survive that discard, so the SINK is asserted and not just the text.
//
// ── hermetic by construction ────────────────────────────────────────────────
//
// The env is BUILT, never inherited (the pattern cli.backend-fallback.test.mjs
// established): `BRAIN_MEMORY_UPSTREAM_REF` is resolution level 1 and would win
// over the config, so an ambient one makes `configError` unreachable and every
// assertion below vacuous. `.env` is replaced via BRAIN_MEMORY_ENV_FILE for the
// same reason it is there — it is gitignored, so `MEMORY_BACKEND` would
// otherwise be whatever the maintainer's checkout happens to carry.
//
// The `engram` on PATH is a stub that exits 0 without exporting: the chunk it
// would have written is planted by the test instead, so `share` has real
// candidates to score without a real engram installation. The tmpdir is not a
// git repo at all, which is what makes NO ref resolve.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'cli.mjs');

/** The real `which`, resolved once — the sandbox PATH still needs it to work. */
const REAL_WHICH = execFileSync('sh', ['-c', 'command -v which'], { encoding: 'utf8' }).trim();

const OBSERVATION = {
  id: 1,
  sync_id: 'obs-aaaa1111',
  session_id: 's1',
  type: 'discovery',
  title: 'A title',
  content: 'No provenance prose here.',
  project: 'brain',
  scope: 'project',
  topic_key: 'sdd/x/y',
  revision_count: 1,
  duplicate_count: 0,
  last_seen_at: '2026-07-02 11:45:38',
  created_at: '2026-07-01 01:19:12',
  updated_at: '2026-07-02 11:45:38',
};

/**
 * A share-able world: one exported chunk (so `dualWriteRecords` has a candidate
 * and therefore produces an `upstreamScope` at all — it is absent on the
 * zero-candidate early return), plus whatever `brain.config.json` the case wants.
 *
 * @param {object} t
 * @param {{config?: string}} opts  `config` omitted → no brain.config.json at all
 */
function world(t, { config } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'brain-701-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  mkdirSync(join(root, '.memory', 'records'), { recursive: true });
  mkdirSync(join(root, '.memory', 'chunks'), { recursive: true });
  writeFileSync(
    join(root, '.memory', 'chunks', 'chunk-1.jsonl.gz'),
    gzipSync(Buffer.from(JSON.stringify({ observations: [OBSERVATION] }), 'utf8')),
  );
  if (config !== undefined) writeFileSync(join(root, 'brain.config.json'), config, 'utf8');

  const bin = join(root, 'bin');
  mkdirSync(bin);
  symlinkSync(REAL_WHICH, join(bin, 'which'));
  // Exits 0 without exporting — the chunk above is already in place, so the
  // probe answers the way it would on a real machine and the run reaches
  // dualWriteRecords with candidates.
  writeFileSync(join(bin, 'engram'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  writeFileSync(join(root, 'dotenv'), '', 'utf8');

  return { root, bin };
}

function share({ root, bin }) {
  return spawnSync(process.execPath, [CLI, 'share'], {
    encoding: 'utf8',
    // Deliberately NOT `...process.env` — see the header.
    env: {
      HOME: process.env.HOME,
      PATH: bin,
      BRAIN_MEMORY_TEST_ROOT: root,
      BRAIN_MEMORY_ENV_FILE: join(root, 'dotenv'),
      MEMORY_BACKEND: 'engram',
    },
  });
}

const CORRUPT = '<<<<<<< HEAD\n{ "memory": { "upstreamRef": "origin/feature" } }\n';

test('#701 memory:share REPORTS an unreadable brain.config.json — the print the channel exists for', (t) => {
  const r = share(world(t, { config: CORRUPT }));

  assert.equal(r.status, 0, `an unreadable config must not fail the share; stderr:\n${r.stderr}`);
  assert.match(
    r.stderr, /brain\.config\.json .* could not be parsed/,
    'the operator must be told the config was skipped — every layer below this one was already pinned; this is the one a human reads',
  );
  assert.match(r.stderr, /NOT honored/, 'and that a ref stated there went unread');
});

test('#701 the unreadable-config notice goes to STDERR — pre-push discards stdout', (t) => {
  const r = share(world(t, { config: CORRUPT }));

  assert.match(r.stderr, /could not be parsed/);
  assert.doesNotMatch(
    r.stdout, /could not be parsed/,
    'on stdout it would be discarded on every pre-push, which is the same outage in a different pipe',
  );
});

test('#701 the notice is printed ONCE — it is not also prefixed into the unavailable line', (t) => {
  // The defect: the config failure rode on `configError` AND was prefixed into
  // `reason`, and both are printed as separate consecutive lines. The operator
  // read the identical sentence twice — the previous round's doubled-phrase
  // defect reintroduced one level up, at sentence scale.
  const r = share(world(t, { config: CORRUPT }));

  const hits = r.stderr.match(/could not be parsed/g) ?? [];
  assert.equal(hits.length, 1, `the config failure must be stated once, not once per channel:\n${r.stderr}`);
});

test('#701 with NO ref resolved the notice does NOT name a derived ref', (t) => {
  // The tmpdir is not a git repo, so neither origin/HEAD nor origin/main
  // resolves and `ref` is the hard-coded `origin/main` `resolveUpstreamRef`
  // returns when NOTHING answered. The old wording claimed "the upstream base
  // was derived as origin/main instead" one line above a line saying nothing
  // had been derived and nothing checked.
  const r = share(world(t, { config: CORRUPT }));

  assert.match(r.stderr, /no upstream base resolved either/, 'the honest half of the sentence');
  assert.doesNotMatch(
    r.stderr, /derived as origin\/main instead/,
    'no ref answered, so none may be named as the one used instead',
  );
});

test('#701 a READABLE brain.config.json prints no config notice at all', (t) => {
  // The negative side of the detector: a print site that fired unconditionally
  // would satisfy every assertion above.
  const r = share(world(t, { config: JSON.stringify({ project: { slug: 'brain' } }) }));

  assert.doesNotMatch(
    r.stderr, /brain\.config\.json/,
    'nothing failed to be read, so nothing may be reported — evidence, not a banner',
  );
});

test('#701 an ABSENT brain.config.json is not a failure to read one', (t) => {
  // ENOENT is the ONE "there is nothing to read" case: no stated ref, derived
  // candidates take over, and there is nothing to tell the operator about.
  const r = share(world(t));

  assert.doesNotMatch(r.stderr, /brain\.config\.json/);
});
