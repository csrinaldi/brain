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
// ── what is neutralised, and what is not ────────────────────────────────────
//
// The child env is BUILT key by key, never spread from `process.env` (the pattern
// cli.backend-fallback.test.mjs established): `BRAIN_MEMORY_UPSTREAM_REF` is
// resolution level 1 and would win over the config, so an ambient one makes
// `configError` unreachable and every assertion below vacuous. `.env` is replaced
// via BRAIN_MEMORY_ENV_FILE for the same reason it is there — it is gitignored, so
// `MEMORY_BACKEND` would otherwise be whatever the maintainer's checkout happens to
// carry.
//
// BUILT is not the same as hermetic, and two of the five keys `share()` sets are
// ambient on purpose:
//
//   HOME — passed straight through as `process.env.HOME`.
//   PATH — `${bin}:${process.env.PATH ?? ''}`, the sandbox bin PREPENDED to the
//          real one, never replacing it. That inherited tail is LOAD-BEARING, not
//          incidental: ref resolution spawns `git`, and with `bin` alone every
//          candidate ref failed to resolve for the wrong reason (no git binary),
//          which silently turned the derived-ref case into a second no-ref case
//          that asserted nothing. Measured while writing the `remote: true` world
//          (see that commit); prepending keeps the stub `engram` authoritative by
//          first-match-wins AND lets git actually run.
//
// The `engram` on PATH is a stub that exits 0 without exporting: the chunk it
// would have written is planted by the test instead, so `share` has real
// candidates to score without a real engram installation. In the DEFAULT world
// (`remote: false`) the tmpdir is not a git repo at all, which is what makes NO
// ref resolve there; the `remote: true` world `git init`s the root, pushes to a
// bare remote, and therefore DOES resolve a derived `origin/main` — that is the
// positive branch of the two-key split, and `world()`'s own jsdoc states the
// condition alongside the parameter it belongs to.
//
// The LOCALE is NOT neutralised, and it cannot be from here. This header used to
// be titled "hermetic by construction" while omitting the one ambient input that
// governs the strings asserted on: `t()` resolves its locale via `activeLang()`
// → `loadBrainConfig()`, which reads `brain.config.json` from the MODULE's own
// location (`lib/brain-config.mjs`), not from the env this test builds and not
// from the tmpdir. `docs.language: "es"` is a first-class ADR-0009 setting and
// the maintainer's own language, and there is no env override for it.
//
// So the expectations are RESOLVED THROUGH THE CATALOG in the ambient locale
// instead — the child CLI reads the same `brain.config.json` from the same
// module path, so the two always agree, in any locale, including one added
// later. Hard-coded English prose does not: flipping `docs.language` to `"es"`
// and running this file alone gave `# pass 4  # fail 3` of the 7 tests that then
// existed, and made every negative assertion vacuous in the same run — a Spanish
// message matches no English regex either, so `doesNotMatch` passed for the
// wrong reason. Measured on this branch before this fix.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { removeTempTree } from '../__fixtures__/tmp-tree.mjs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Aliased: every test callback below binds `t` to node:test's TestContext.
import { t as msg } from '../i18n/t.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'cli.mjs');

/**
 * The catalog line for `key`, in the SAME locale the child CLI will resolve.
 *
 * `{error}` is blanked: its text is a tmpdir path plus a Node-version-dependent
 * `JSON.parse` message, and that channel is asserted separately by pattern (it
 * is built in code, not translated, so it is locale-independent). Everything
 * after it is the prose these tests are about, and it is compared as an exact
 * substring — which is what makes both the positive and the NEGATIVE assertions
 * real in every locale.
 */
const catalogLine = (key, params = {}) => msg(key, { error: '', ...params });

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

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
  return r;
}

/**
 * A share-able world: one exported chunk (so `dualWriteRecords` has a candidate
 * and therefore produces an `upstreamScope` at all — it is absent on the
 * zero-candidate early return), plus whatever `brain.config.json` the case wants.
 *
 * @param {object} t
 * @param {{config?: string, remote?: boolean}} opts
 *   config — omitted → no brain.config.json at all
 *   remote — `true` gives the root a real fetched `origin/main`, so a DERIVED ref
 *            genuinely resolves past the broken config. Default `false`: the root
 *            is not a git repo at all, so NOTHING resolves.
 */
function world(t, { config, remote = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'brain-701-cli-'));
  t.after(() => removeTempTree(root));

  mkdirSync(join(root, '.memory', 'records'), { recursive: true });
  mkdirSync(join(root, '.memory', 'chunks'), { recursive: true });
  writeFileSync(
    join(root, '.memory', 'chunks', 'chunk-1.jsonl.gz'),
    gzipSync(Buffer.from(JSON.stringify({ observations: [OBSERVATION] }), 'utf8')),
  );
  if (config !== undefined) writeFileSync(join(root, 'brain.config.json'), config, 'utf8');

  if (remote) {
    const bare = mkdtempSync(join(tmpdir(), 'brain-701-cli-remote-'));
    t.after(() => removeTempTree(bare));
    git(bare, ['init', '-q', '--bare', '-b', 'main']);
    git(root, ['init', '-q', '-b', 'main']);
    git(root, ['config', 'user.email', 'test@example.invalid']);
    git(root, ['config', 'user.name', 'brain-test']);
    writeFileSync(join(root, '.gitignore'), '.memory/chunks/\nbin/\ndotenv\n', 'utf8');
    git(root, ['add', '.gitignore']);
    git(root, ['commit', '-q', '-m', 'init']);
    git(root, ['remote', 'add', 'origin', bare]);
    git(root, ['push', '-q', '-u', 'origin', 'main']);
  }

  const bin = join(root, 'bin');
  mkdirSync(bin);
  // A `which` STUB, not a symlink to the machine's own. `probeBinary` spawns
  // `which engram` (`lib/backend-selection.mjs`), so an image with no `which` at
  // all makes the probe UNDETERMINED and the run never reaches
  // `dualWriteRecords` — measured on this branch by stripping `which` from PATH:
  // `# pass 3  # fail 5`. `lib/backend-selection.test.mjs:44` documents that
  // machine class as real ("the real shape on a container with no `which`").
  //
  // The previous shape resolved the real `which` with `execFileSync('sh', ['-c',
  // 'command -v which'])` at module TOP LEVEL and symlinked it in. That was worse
  // in both directions: `command -v` exits 127 when the binary is absent and
  // `execFileSync` throws on it (verified: status 127), so on exactly that image
  // the file died at import reporting ZERO assertions — and on every image that
  // HAS `which` the symlink was redundant, because `share()` below puts the real
  // PATH after `bin`. One ambient input fewer, no import-time I/O.
  writeFileSync(join(bin, 'which'), '#!/bin/sh\ncommand -v "$1"\n', { mode: 0o755 });
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
      // `bin` FIRST, so the stub `engram` is the one found no matter what the
      // machine has installed. The real PATH follows because ref resolution
      // spawns `git`: with `bin` alone every candidate ref fails to resolve for
      // the wrong reason (no git binary), which silently turns the
      // derived-ref case below into the no-ref case and makes it assert nothing.
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      BRAIN_MEMORY_TEST_ROOT: root,
      BRAIN_MEMORY_ENV_FILE: join(root, 'dotenv'),
      MEMORY_BACKEND: 'engram',
    },
  });
}

const CORRUPT = '<<<<<<< HEAD\n{ "memory": { "upstreamRef": "origin/feature" } }\n';

test('#701 memory:share REPORTS an unreadable brain.config.json — the print the channel exists for', async (t) => {
  const r = share(world(t, { config: CORRUPT }));

  assert.equal(r.status, 0, `an unreadable config must not fail the share; stderr:\n${r.stderr}`);
  assert.match(
    r.stderr, /brain\.config\.json .* could not be parsed/,
    'the operator must be told the config was skipped — every layer below this one was already pinned; this is the one a human reads',
  );
  // The catalog half, resolved through the catalog rather than re-typed here.
  assert.ok(
    r.stderr.includes(await catalogLine('memory.share.upstreamConfigUnreadableNoRef')),
    `and told a ref stated there went unread; got:\n${r.stderr}`,
  );
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

test('#701 with NO ref resolved, neither printed line names a ref', async (t) => {
  // The tmpdir is not a git repo, so neither origin/HEAD nor origin/main
  // resolves and `ref` is `null`. It used to be the string `'origin/main'`, and
  // BOTH lines then named it: the config notice claimed "the upstream base was
  // derived as origin/main instead", and `upstreamUnavailable` interpolated the
  // same invention into "could not check the upstream base (origin/main)" —
  // directly under a line saying nothing had resolved.
  const r = share(world(t, { config: CORRUPT }));

  assert.ok(
    r.stderr.includes(await catalogLine('memory.share.upstreamConfigUnreadableNoRef')),
    `the honest half of the sentence; got:\n${r.stderr}`,
  );
  assert.equal(
    r.stderr.includes(await catalogLine('memory.share.upstreamConfigUnreadable', { ref: 'origin/main' })), false,
    `no ref answered, so none may be named as the one used instead; got:\n${r.stderr}`,
  );
  // `reason` is built in code, so this whole expected line is locale-safe apart
  // from the wrapper, which comes from the catalog. It has no `{ref}` slot left.
  assert.ok(
    r.stderr.includes(await msg('memory.share.upstreamUnavailable', {
      reason: 'no upstream ref resolved (tried origin/HEAD, origin/main)',
    })),
    `and the unavailable line names no ref either; got:\n${r.stderr}`,
  );
});

test('#701 when a derived ref DOES answer past the broken config, the notice names it', async (t) => {
  // The positive branch of the two-key split, and the reason `ref` has to travel
  // at all. Both catalog entries share the `{error}` text and "NOT honored", so
  // without an assertion on the clause that differs, the discriminator could be
  // dropped from the accounting with this file still green.
  const r = share(world(t, { config: CORRUPT, remote: true }));

  assert.equal(r.status, 0, `stderr:\n${r.stderr}`);
  assert.ok(
    r.stderr.includes(await catalogLine('memory.share.upstreamConfigUnreadable', { ref: 'origin/main' })),
    `origin/main really was fetched here, so it really is the base that took over — the one case naming it is true; got:\n${r.stderr}`,
  );
  assert.equal(
    r.stderr.includes(await catalogLine('memory.share.upstreamConfigUnreadableNoRef')), false,
    `a ref answered, so the "nothing resolved" wording would be the opposite falsehood; got:\n${r.stderr}`,
  );
});

test('#701 the "wrote every candidate" degradation is stated ONCE, by the wrapper that owns it', (t) => {
  // `reason` used to end in "— writing every candidate this run (pre-#701
  // behaviour)" and the catalog wrapper restates it immediately: "This run wrote
  // every candidate (the pre-#701 behaviour); nothing was scoped." The same
  // sentence, twice, consecutively, in one printed line. Asserted on the
  // code-built clause rather than on catalog prose, so it holds in every locale.
  const r = share(world(t, { config: CORRUPT }));

  assert.equal(
    /writing every candidate/.test(r.stderr), false,
    `the reason must not restate what this consumer's own wrapper says next; got:\n${r.stderr}`,
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
