#!/usr/bin/env node
// smoke.mjs — the bootstrap verbs, run cold in a fresh consumer fixture (#458).
//
// #446: an i18n catalog key with a hyphen rendered as a COMMAND WORD in the
// shell catalog `bootstrap.sh` evals under `set -euo pipefail`. `brain:env:init`
// died at exit 127 after writing brain.config.json and HOME.md and before doing
// anything else, so every fresh adopter got a half-initialised repo and one
// `command not found` as the only signal. CI was green throughout, because no
// job anywhere executes these verbs. #449 guarded that CATALOG. This guards the
// CLASS: the three commands every adopter runs, in order, actually run.
//
// ── Why a fixture and not this repo ─────────────────────────────────────────
//
// `.brain-source` marks the brain SOURCE tree, and several verbs branch on it.
// A consumer never receives that file. Running the verbs here would exercise
// the wrong branch — the #401 harness reasoning, reused. The fixture is seeded
// by COPY, never by running the verb under test: a broken bootstrap must not be
// able to produce the baseline its own assertions are compared against.
//
// ── Why it needs no token and no network ────────────────────────────────────
//
// Measured: all three verbs exit 0 offline, degrading with warnings on the VCS
// and engram steps. `test/fresh-install/run.sh` needs `VCS_TOKEN` and a
// published tag, which is why that suite cannot be the one CI runs per PR. This
// asserts SEQUENCING — that the steps run to the end — not that the ecosystem
// updates. No `day:start` flag had to be added: there was nothing to stub.
//
// HOME is redirected into the scratch dir, so nothing here writes to the
// runner's real home.
//
// ── Why this is the only entry point, and why it is node and not bash ───────
//
// Its two siblings are `run.sh` + `in-container.sh` pairs because they need a
// container. This one does not (see below), so a shell wrapper would be a
// second place to keep in sync — the #340 defect — for a banner and two
// `command -v` checks. The wrapper also failed `auditWorkflowAuth`'s step
// reader: `bash` is not on its inert list, so a `bash …/run.sh` step reads as
// reaching the server with no credential declared. That guard is right to be
// conservative, and the fix is to have one entry point it can classify rather
// than to widen its list.
//
// Usage: node test/bootstrap-smoke/smoke.mjs [--keep]
//
// Requires: node, git, tar. NO docker, NO github token, NO network.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { removeTempTree } from '../../brain/scripts/__fixtures__/tmp-tree.mjs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KEEP = process.argv.includes('--keep');

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };
const step = (msg) => console.log(`\n── ${msg} ──`);
const info = (msg) => console.log(`  · ${msg}`);

/**
 * Asserts a condition, counting the failure rather than throwing — every verb
 * still runs, so one report names everything that is broken instead of the
 * first thing.
 */
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

/**
 * Credentials and proxy settings STRIPPED from the fixture's environment.
 *
 * Review finding F3: `{ ...process.env }` inherits the parent wholesale, and
 * `GH_TOKEN`, `GITHUB_TOKEN` and `HTTPS_PROXY` were measured present in the
 * shell that runs this. That made "no token, no network" a property of the
 * MACHINE rather than of the suite: on a runner that carries a token, the verbs
 * take their authenticated branches — different code from the offline paths
 * this claims to exercise — and inherit that runner's rate limits and flakiness.
 *
 * Stripped here so the claim is true by construction. `envHygiene` below is
 * what stops this list becoming decorative.
 */
const STRIPPED_ENV = Object.freeze([
  'VCS_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN', 'GITHUB_ACTIONS', 'BRAIN_REVIEWER_TOKEN',
  'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy',
]);

/** The environment every fixture command sees. Pure, so a test can read it. */
function fixtureEnv(home) {
  const env = { ...process.env, HOME: home, CI: '1' };
  for (const k of STRIPPED_ENV) delete env[k];
  return env;
}

/**
 * Runs a command in the fixture. NEVER swallows a failure into a default: a
 * spawn that could not start returns status `null`, and reporting that as 0
 * would turn "the verb never ran" into "the verb passed" — the exact shape of
 * the bug this suite exists for.
 *
 * @returns {{status:number, out:string}}
 */
function run(cmd, args, { cwd, home }) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: fixtureEnv(home),
    timeout: 10 * 60 * 1000,
  });
  if (r.error && r.error.code === 'ETIMEDOUT') return { status: 124, out: 'TIMED OUT' };
  if (r.status === null) {
    return { status: 127, out: `spawn produced no exit status: ${r.error?.message ?? 'unknown'}` };
  }
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * A content manifest of every tracked-shaped file in the fixture: path → sha256.
 * Used to prove the second `env:init` changes nothing.
 *
 * Throws on an unreadable file. A manifest that silently drops what it cannot
 * read would compare two shrinking sets and call them equal.
 */
function manifest(root) {
  const out = new Map();
  const walk = (rel) => {
    for (const e of readdirSync(join(root, rel || '.'), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      // F5: by NAME, at any depth. `r` is the root-relative PATH, so the
      // previous `r === '.git'` excluded these only at the root and walked
      // any nested one — hashing a whole install into an assertion about
      // idempotency. Latent when found; a bug in the comparison regardless.
      if (e.name === '.git' || e.name === 'node_modules') continue;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) out.set(r, createHash('sha256').update(readFileSync(join(root, r))).digest('hex'));
      else out.set(r, `<${e.isSymbolicLink() ? 'symlink' : 'special'}>`);
    }
  };
  walk('');
  if (out.size === 0) throw new Error(`manifest of ${root} is empty — the walker is broken, not the tree`);
  return out;
}

/**
 * `.env` is compared as a SET of `KEY=value` lines instead of byte-for-byte.
 *
 * MEASURED, not assumed: a second `brain:env:init` writes the same three keys
 * in a different ORDER — `AGENT_PLATFORM` moves from the first line to the
 * third. Same keys, same values, different bytes. That is a real
 * non-idempotency and it is recorded as a finding on #458's PR rather than
 * repaired here: the writer is `brain/scripts/bootstrap.sh`, outside this
 * change's file claim.
 *
 * The weakening is exactly one file and it is the strongest assertion that
 * file currently supports: a key gained, lost or re-valued still fails.
 */
const SET_COMPARED = Object.freeze(['.env']);

const envKeySet = (root, rel) =>
  new Set(readFileSync(join(root, rel), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).sort());

const sameSet = (a, b) => a.size === b.size && [...a].every((v) => b.has(v));

/** @returns {{kind:'removed'|'changed'|'added', path:string}[]} byte-level differences. */
function diffManifests(before, after) {
  const diffs = [];
  for (const [p, h] of before) {
    if (!after.has(p)) diffs.push({ kind: 'removed', path: p });
    else if (after.get(p) !== h) diffs.push({ kind: 'changed', path: p });
  }
  for (const p of after.keys()) if (!before.has(p)) diffs.push({ kind: 'added', path: p });
  return diffs;
}

// ── Build the fixture ───────────────────────────────────────────────────────

// ── Preflight ───────────────────────────────────────────────────────────────

for (const bin of ['git', 'tar']) {
  if (spawnSync('command', ['-v', bin], { shell: true }).status !== 0) {
    console.error(`\u2717 ${bin} is required.`);
    process.exit(2);
  }
}
console.log(`\u25b6 bootstrap smoke | node=${process.version}`);

const scratch = mkdtempSync(join(tmpdir(), 'brain-bootstrap-smoke-'));
const consumer = join(scratch, 'consumer');
const home = join(scratch, 'home');
mkdirSync(consumer, { recursive: true });
mkdirSync(home, { recursive: true });

step(`fresh consumer fixture at ${consumer}`);
execFileSync('bash', ['-c',
  `tar -c --exclude=.git --exclude=node_modules --exclude=.brain-source -C ${JSON.stringify(SOURCE)} . | tar -x -C ${JSON.stringify(consumer)}`,
]);

// `.brain-source` marks the source tree and must be absent — a consumer never
// receives it. Asserted rather than assumed: if the exclude above ever stops
// working, every verb below silently takes the source-repo branch and this
// suite tests nothing.
check(!existsSync(join(consumer, '.brain-source')),
  '.brain-source is absent — the fixture is a consumer, not the brain source tree');

execFileSync('git', ['-C', consumer, 'init', '-q', '.'], { stdio: 'ignore' });
execFileSync('git', ['-C', consumer, 'config', 'user.email', 'smoke@test.local']);
execFileSync('git', ['-C', consumer, 'config', 'user.name', 'smoke']);
execFileSync('git', ['-C', consumer, 'remote', 'add', 'origin', 'https://github.com/acme/widget.git']);
execFileSync('git', ['-C', consumer, 'add', '-A']);
execFileSync('git', ['-C', consumer, 'commit', '-qm', 'consumer baseline']);

// A fresh adopter has none of these — env:init is what creates them.
//
// `brain/HOME.md` joined the list on review finding F2. It was NOT deleted
// before, so the fixture's copy satisfied its post-condition and the check
// proved nothing: removing the `home-scaffold.mjs ensure` call from
// bootstrap.sh entirely left this suite fully GREEN. A check that survives
// the deletion of what it checks is not a check.
for (const f of ['brain.config.json', 'AGENTS.md', '.env', 'brain/HOME.md']) {
  rmSync(join(consumer, f), { force: true });
}

// A nested `node_modules` the walker must skip by NAME (F5). Cheap, and it
// makes the exclusion a measured property rather than a claim in a comment.
mkdirSync(join(consumer, 'brain', 'node_modules'), { recursive: true });
writeFileSync(join(consumer, 'brain', 'node_modules', 'PROBE'), 'must never reach the manifest\n');

const seededManifest = manifest(consumer);
check(![...seededManifest.keys()].some((p) => p.split('/').includes('node_modules')),
  'the manifest walker skips a NESTED node_modules, not just a root one');
const seeded = seededManifest.size;
check(seeded > 200, `fixture seeded by copy — ${seeded} files (a thin fixture would pass vacuously)`);

// ── 0. Environment hygiene ──────────────────────────────────────────────────
//
// F3: without this, STRIPPED_ENV is a list nothing reads back, and deleting an
// entry from it would be invisible. Ask a CHILD what it actually received
// rather than trusting the parent's own copy of the map.

step('0. the fixture sees no credential and no proxy');
const probe = run('node', ['-e',
  'const want = JSON.parse(process.argv[1]);'
  + 'console.log(JSON.stringify({ leaked: want.filter((k) => process.env[k] !== undefined), home: process.env.HOME }));',
  JSON.stringify([...STRIPPED_ENV]),
], { cwd: consumer, home });

if (probe.status !== 0) {
  fail(`the environment probe did not run (exit ${probe.status}) — hygiene is UNKNOWN, not clean`);
} else {
  let seen;
  try { seen = JSON.parse(probe.out.trim().split('\n').pop()); } catch { seen = null; }
  // An unparseable probe is a failure, never a pass: "we could not look" and
  // "we looked and it was clean" must not produce the same verdict.
  if (seen === null) fail(`the environment probe returned unparseable output: ${probe.out.trim().slice(0, 200)}`);
  else {
    check(seen.leaked.length === 0,
      `no credential or proxy reaches the fixture (leaked: ${seen.leaked.join(', ') || 'none'})`);
    check(seen.home === home, `HOME is redirected into the scratch dir (got ${seen.home})`);
  }
}

// ── 1. brain:env:init exits 0 and leaves a COMPLETE tree ────────────────────

step('1. brain:env:init — cold, on a fresh consumer');
const init = run('npm', ['run', 'brain:env:init'], { cwd: consumer, home });
check(init.status === 0, `brain:env:init exits 0 (got ${init.status})`);
if (init.status !== 0) console.log(init.out.split('\n').slice(-25).map((l) => `      ${l}`).join('\n'));

// The #446 shape: it died AFTER brain.config.json and HOME.md and BEFORE
// everything else, so asserting exit 0 alone is not enough — these are the
// post-conditions that only exist if the run reached its end.
const POST_CONDITIONS = [
  ['brain.config.json', () => existsSync(join(consumer, 'brain.config.json'))],
  ['brain/HOME.md', () => existsSync(join(consumer, 'brain', 'HOME.md'))],
  ['AGENTS.md (harness init ran)', () => existsSync(join(consumer, 'AGENTS.md'))],
  ['.env (PAT scaffold ran)', () => existsSync(join(consumer, '.env'))],
  ['core.hooksPath (pre-push hook installed)', () => {
    const r = spawnSync('git', ['-C', consumer, 'config', '--get', 'core.hooksPath'], { encoding: 'utf8' });
    return (r.stdout ?? '').trim() === 'brain/scripts/hooks';
  }],
];
for (const [label, probe] of POST_CONDITIONS) check(probe(), `post-condition present: ${label}`);

// The config it wrote must be the full schema, not the stub the run died holding.
try {
  const cfg = JSON.parse(readFileSync(join(consumer, 'brain.config.json'), 'utf8'));
  check(Boolean(cfg.schemaVersion) && Boolean(cfg.governance) && cfg.vcs?.provider === 'github',
    `brain.config.json carries the full schema (schemaVersion=${cfg.schemaVersion}, provider=${cfg.vcs?.provider})`);
  check(cfg.project?.slug === 'acme/widget',
    `project identity derived from the fixture's origin (got ${cfg.project?.slug})`);
} catch (e) {
  fail(`brain.config.json is unreadable or not JSON: ${e.message}`);
}

// ── 2. brain:session:start ──────────────────────────────────────────────────

step('2. brain:session:start — read-only, local-only');
const session = run('npm', ['run', 'brain:session:start'], { cwd: consumer, home });
check(session.status === 0, `brain:session:start exits 0 (got ${session.status})`);
if (session.status !== 0) console.log(session.out.split('\n').slice(-20).map((l) => `      ${l}`).join('\n'));

// ── 3. brain:day:start ──────────────────────────────────────────────────────

step('3. brain:day:start — network steps degrade, sequencing is what is asserted');
const day = run('npm', ['run', 'brain:day:start'], { cwd: consumer, home });
check(day.status === 0, `brain:day:start exits 0 (got ${day.status})`);
if (day.status !== 0) console.log(day.out.split('\n').slice(-25).map((l) => `      ${l}`).join('\n'));

// It must reach its END, not merely exit 0 having skipped everything. The verb
// announces 6 steps; a run that stops after two would still exit 0 today.
//
// F4: the `|| /brain:ticket:start/` fallback this used to carry is gone.
// Measured — day:start prints every marker `1/6`..`6/6`, so the strong test
// always matched and the fallback could only ever let a regression through.
check(/\b6\/6\b/.test(day.out),
  'brain:day:start reached its final step 6/6, not just an early exit');

// ── 4. Idempotency ──────────────────────────────────────────────────────────

step('4. a second brain:env:init changes nothing');
const before = manifest(consumer);

// Snapshot the set-compared files BEFORE the run, so the acceptance below
// compares two real readings rather than re-deriving one of them afterwards.
for (const p of SET_COMPARED) {
  check(existsSync(join(consumer, p)),
    `${p} exists, so relaxing it to a set comparison weakens something real`);
}
const beforeSets = new Map(
  SET_COMPARED.filter((p) => existsSync(join(consumer, p))).map((p) => [p, envKeySet(consumer, p)]),
);
// An empty key set makes `sameSet` trivially true, which would turn the one
// relaxation in this suite into "accept any change to .env whatsoever".
for (const [p, s] of beforeSets) {
  check(s.size > 0, `${p} parsed into ${s.size} key(s) — an empty set would accept every change to it`);
}

const again = run('npm', ['run', 'brain:env:init'], { cwd: consumer, home });
check(again.status === 0, `second brain:env:init exits 0 (got ${again.status})`);

const after = manifest(consumer);
const real = [];
const reordered = [];
for (const d of diffManifests(before, after)) {
  const relaxed = d.kind === 'changed'
    && beforeSets.has(d.path)
    && sameSet(beforeSets.get(d.path), envKeySet(consumer, d.path));
  (relaxed ? reordered : real).push(d);
}

check(real.length === 0, `second run changed nothing that matters (${real.length} real difference(s))`);
for (const d of real.slice(0, 20)) info(`${d.kind}: ${d.path}`);
for (const d of reordered) {
  info(`${d.path}: same key set, different byte order — known non-idempotency in bootstrap.sh, reported on #458`);
}

// ── Report ──────────────────────────────────────────────────────────────────

if (KEEP) info(`fixture kept at ${scratch}`);
else removeTempTree(scratch);

console.log('');
if (failures > 0) {
  console.log(`✗ bootstrap smoke: ${failures} failure(s)`);
  process.exit(1);
}
console.log('✓ bootstrap smoke: env:init → session:start → day:start, cold and idempotent');
