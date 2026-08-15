// cli.backend-fallback.test.mjs — issue #641, end to end.
//
// The ticket is not "a fallback was missing": `MEMORY_BACKEND=plainfiles npm run
// memory:share` exited clean the whole time. The ticket is that the documented
// verb died and no message ever pointed at the working route, so four PRs'
// worth of capture was skipped on the belief that capture was impossible here.
// A unit test over `selectBackend` cannot fail for that. So this drives the REAL
// cli.mjs in a child process and asserts on what it EMITS, and on which pipe.
//
// ── Hermetic by construction, in both directions ────────────────────────────
//
// PATH is REPLACED, never inherited: `engram` present vs absent is the variable
// under test, so leaving it to whatever the runner happens to have installed
// makes every assertion below conditional on the machine. The replacement PATH
// carries a symlink to the real `which` and nothing else — so "absent" is a
// measured absence rather than a broken probe, which is a distinction #641
// specifically added and which the third test pins.
//
// `.env` is replaced too, via BRAIN_MEMORY_ENV_FILE. `.env` is gitignored, so
// whether the maintainer's checkout carries `MEMORY_BACKEND=engram` would
// otherwise decide the STATED-vs-DEFAULTED branch that is the point of the
// feature. That is the same ambient-state trap #657's suite hit with $VCS_TOKEN.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRecord, serializeRecord } from './lib/format.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'cli.mjs');

/**
 * The substitution notice, matched on a phrase UNIQUE to it.
 *
 * The obvious matcher — `/not installed here/` — was wrong and passed anyway:
 * #530's `memory.save.engramUnsupported` contains the words "If engram is not
 * installed here (the agent environment)", so every `doesNotMatch` guarding a
 * NON-substituted op was liable to trip on an unrelated message, and every
 * `match` could in principle have been satisfied by one. Anchoring on the
 * records-only clause makes the assertion name the notice rather than a phrase
 * two catalogue entries happen to share.
 */
const SUBSTITUTED = /ran on the records-only `plainfiles` backend instead/;

/** The real `which`, resolved once — the sandbox PATH still needs it to work. */
const REAL_WHICH = execFileSync('sh', ['-c', 'command -v which'], { encoding: 'utf8' }).trim();

/**
 * A temp world: a records fixture, an isolated PATH, and an isolated `.env`.
 *
 * @param {object} t              node:test context, for cleanup
 * @param {{engram?: boolean, envFile?: string}} opts
 *   engram  — plant an executable `engram` on the sandbox PATH
 *   envFile — contents of the `.env` the CLI will read ('' = no keys at all)
 */
function world(t, { engram = false, envFile = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'brain-641-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const recordsDir = join(root, '.memory', 'records');
  mkdirSync(recordsDir, { recursive: true });
  const record = buildRecord({
    ts: '2026-08-14T12:00:00Z',
    actor: '@test',
    actorKind: 'human',
    type: 'decision',
    project: 'brain',
    content: 'a single clean record, so a successful share has something to index',
  });
  writeFileSync(join(recordsDir, '2026-08.jsonl'), serializeRecord(record) + '\n', 'utf8');

  const bin = join(root, 'bin');
  mkdirSync(bin);
  symlinkSync(REAL_WHICH, join(bin, 'which'));
  if (engram) {
    // Never invoked in these tests — only `which` looks for it — but it is a
    // real executable so the probe answers the way it would on a real machine.
    writeFileSync(join(bin, 'engram'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  }

  const envPath = join(root, 'dotenv');
  writeFileSync(envPath, envFile, 'utf8');

  return { root, bin, envPath };
}

function runCli({ root, bin, envPath }, args, extraEnv = {}) {
  const env = {
    // Deliberately NOT `...process.env`: PATH and MEMORY_BACKEND are the two
    // variables under test and inheriting either makes the result ambient.
    HOME: process.env.HOME,
    PATH: bin,
    BRAIN_MEMORY_TEST_ROOT: root,
    BRAIN_MEMORY_ENV_FILE: envPath,
    ...extraEnv,
  };
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env });
}

// ── the defect, in the environment where it happened ────────────────────────

test('#641 memory:share with NO engram and NO stated backend: SUCCEEDS on the fallback and says so', (t) => {
  const w = world(t);
  const r = runCli(w, ['share']);

  assert.equal(r.status, 0, `share must succeed with no backend installed; stderr:\n${r.stderr}`);
  assert.match(r.stderr, SUBSTITUTED);
  assert.match(r.stderr, /plainfiles/, 'the notice must name the backend that actually ran');
  assert.match(r.stderr, /share/, 'and the verb it ran');
  assert.doesNotMatch(
    r.stderr,
    /engram binary not found/,
    'the old error must not survive alongside the fallback — that is the message that read as "capture is impossible here"',
  );
});

test('#641 the substitution notice goes to STDERR, not stdout', (t) => {
  // pre-push and post-merge run these verbs with stdout redirected to /dev/null.
  // A notice on stdout would be discarded exactly where a substitution is most
  // likely, which is the same outage in a different pipe.
  const w = world(t);
  const r = runCli(w, ['share']);
  assert.match(r.stderr, SUBSTITUTED);
  assert.doesNotMatch(r.stdout, SUBSTITUTED);
});

test('#641 `save` is NOT substituted — engram refuses it by design, and the refusal already names the route', (t) => {
  // MEASURED: `save` does not fail on the missing binary. `engram.save` refuses
  // it deliberately (C3 Decision 5) and #530 made that refusal name the
  // records-only route. Substituting here would make the signpost unreachable
  // on the default backend — replacing a designed refusal with different
  // behaviour rather than repairing a failure. `npm run memory:save` is pinned
  // to plainfiles in package.json, so the documented verb is unaffected.
  const w = world(t);
  const r = runCli(w, ['save', 'a title', 'some content', '--type', 'decision', '--issue', '641']);

  assert.notEqual(r.status, 0);
  assert.doesNotMatch(r.stderr, SUBSTITUTED, 'nothing failed on the binary, so nothing may be substituted');
  assert.match(r.stderr, /is not a cli verb for the 'engram' backend/, "engram's own refusal must survive");
  assert.match(r.stderr, /MEMORY_BACKEND=plainfiles/, '#530\'s signpost must still reach the caller');
});

test('#641 `setup` is NOT substituted — engram.setup() needs no binary, and owns the merge driver', (t) => {
  // THE REGRESSION THIS PINS. `engram.setup()` exits 0 with no engram
  // installed: it creates the `.engram → .memory` symlink and registers the
  // `merge=union` driver for `.memory/manifest.json` (ADR-0002).
  // `plainfiles.setup()` does NEITHER. Substituting silently dropped the merge
  // driver on every machine without engram — the mechanism ADR-0017's union
  // safety rests on.
  const w = world(t);
  const r = runCli(w, ['setup']);

  assert.doesNotMatch(
    r.stderr,
    SUBSTITUTED,
    'setup never failed on the binary, so there was no failure to replace',
  );
});

// ── each precondition, measured through the real CLI ────────────────────────

test('#641 engram PRESENT: no substitution, no notice — the existing path is untouched', (t) => {
  const w = world(t, { engram: true });
  const r = runCli(w, ['share']);

  assert.doesNotMatch(r.stderr, SUBSTITUTED, 'nothing was substituted, so nothing may claim it was');
  // The stub `engram` exits 0 without exporting, so `share` fails downstream —
  // which is the point: the run went to ENGRAM, exactly as it does today.
  assert.match(r.stderr, /engram\./, `the failure must come from the engram backend; got:\n${r.stderr}`);
});

test('#641 MEMORY_BACKEND=engram STATED via the environment: not overridden, but the alternative is named', (t) => {
  const w = world(t);
  const r = runCli(w, ['share'], { MEMORY_BACKEND: 'engram' });

  assert.notEqual(r.status, 0, 'a stated selector that cannot run must still fail');
  assert.doesNotMatch(r.stderr, SUBSTITUTED, 'a stated selector is never silently swapped');
  assert.match(r.stderr, /MEMORY_BACKEND=plainfiles/, 'the working route must be named — this is the signpost #641 says was missing');
  assert.match(r.stderr, /engram binary not found/, 'and the original failure must still be reported');
});

test('#641 MEMORY_BACKEND=engram STATED via .env: same ruling — the file is a statement too', (t) => {
  const w = world(t, { envFile: 'MEMORY_BACKEND=engram\n' });
  const r = runCli(w, ['share']);

  assert.notEqual(r.status, 0);
  assert.doesNotMatch(r.stderr, SUBSTITUTED);
  assert.match(r.stderr, /MEMORY_BACKEND=plainfiles/);
});

test('#641 `import` — an op the fallback does not serve — keeps engram\'s error, which names the real fix', (t) => {
  // `import` hydrates engram FROM records/; plainfiles has no such op at all.
  // Substituting would turn "engram binary not found. Install via: gentle-ai
  // install" — which names the actual fix — into "backend 'plainfiles' does not
  // implement op 'import'", naming a backend the caller never asked for.
  const w = world(t);
  const r = runCli(w, ['import']);

  assert.notEqual(r.status, 0);
  assert.doesNotMatch(r.stderr, SUBSTITUTED, 'no substitution may be claimed');
  assert.doesNotMatch(r.stderr, /'plainfiles'/, 'and the fallback must not be named as the thing that failed');
  assert.match(r.stderr, /gentle-ai install/);
});

test('#641 `index` is not substituted either — it projects into engram\'s OWN store', (t) => {
  // MEASURED, not assumed: `engram.index()` shells brain-to-engram.mjs, which
  // reports each document's failure and still exits 0 with "0 documentos
  // indexados". That zero-on-total-failure is its own instance of
  // `evidence-reader-empty-on-failure` and is NOT in this ticket's scope — so
  // this asserts only what #641 owns: that nothing was swapped underneath it.
  const w = world(t);
  const r = runCli(w, ['index']);

  assert.doesNotMatch(r.stderr, SUBSTITUTED, 'plainfiles is not a substitute for an engram-store projection');
  assert.doesNotMatch(r.stderr, /not supported by the 'plainfiles'/);
});

test('#641 a BROKEN probe is reported as itself and substitutes nothing', (t) => {
  // PATH with no `which` at all: the probe cannot run. Before #641 this was
  // indistinguishable from "engram is not installed" and would now silently
  // switch the backend on a machine that may well have engram.
  const w = world(t);
  const emptyBin = join(w.root, 'empty-bin');
  mkdirSync(emptyBin);
  const r = runCli({ ...w, bin: emptyBin }, ['share']);

  assert.match(r.stderr, /could not determine/, 'the probe outage must be reported as an outage');
  assert.doesNotMatch(r.stderr, SUBSTITUTED, 'an unmeasured absence must not substitute a backend');
  assert.match(r.stderr, /could not be resolved/, 'and the engram refusal must not claim "not found" either');
  assert.notEqual(r.status, 0);
});

// ── the message is a catalog key, not a literal (so `es` is not handed English) ──

test('#641 the notices resolve from the catalogs in es, not English (#638 is about this exact leak)', (t) => {
  const w = world(t);
  const rEn = runCli(w, ['share']);
  assert.match(rEn.stderr, SUBSTITUTED);

  // brain.config.json's docs.language drives the locale; assert the catalog has
  // the keys rather than shelling a second config, and that they differ.
  return import('./../i18n/en.mjs').then(async ({ default: en }) => {
    const { default: es } = await import('./../i18n/es.mjs');
    for (const key of [
      'memory.backend.substituted',
      'memory.backend.statedButAbsent',
      'memory.backend.probeFailed',
    ]) {
      assert.ok(en[key], `${key} must exist in en`);
      assert.ok(es[key], `${key} must exist in es`);
      assert.notEqual(es[key], en[key], `${key} must actually be translated, not copied`);
    }
  });
});
