// cli.ship.test.mjs — `memory:ship` through the real CLI (#888), against a
// fixture repo under BRAIN_MEMORY_TEST_ROOT, mirroring cli.collect.test.mjs's
// real-CLI pattern.
//
// NETWORK-FREE BY CONSTRUCTION, deliberately more so than cli.collect.test.mjs:
// `ship` DOES reach a real `vcs` port on a successful push (unlike `collect`,
// which never touches one at all), so every case here is engineered to never
// get past the pre-push divergence check or the dry-run short-circuit — the
// full push + PR + arm sequence is `lane/ship.integration.test.mjs`'s job,
// against a FAKE port. This file is scoped to the `ship` OP: dispatch
// boundary, argument handling, exit codes, i18n, and the credential-never-
// printed guarantee.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';

import { testTmp } from '../lib/test-tmp.mjs';
import { collectLane } from './lane/collect.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'cli.mjs');

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} (cwd=${cwd}): ${r.stderr}`);
  return r.stdout;
}

/** A bare origin + a `main` checkout pushed to it — mirrors
 * cli.collect.test.mjs's fixtureRepo, scoped to what `ship` needs. */
function fixtureRepo({ withCandidate = false } = {}) {
  const base = testTmp('cli-ship-');
  const originDir = join(base, 'origin.git');
  const mainDir = join(base, 'main');
  git(base, 'init', '--bare', '-q', originDir);
  git(base, 'init', '-q', '-b', 'main', mainDir);
  git(mainDir, 'remote', 'add', 'origin', originDir);
  git(mainDir, 'config', 'user.email', 'test@example.invalid');
  git(mainDir, 'config', 'user.name', 'brain-test');
  git(mainDir, 'commit', '-q', '--allow-empty', '-m', 'root');
  git(mainDir, 'push', '-q', '-u', 'origin', 'main');
  git(mainDir, 'fetch', '-q', 'origin');
  if (withCandidate) {
    const dir = join(mainDir, '.memory', 'records');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '2026-09-rec-1111111111111111.jsonl'),
      JSON.stringify({
        id: 'rec-1111111111111111', ts: '2026-09-09T00:00:00Z', actor: '@t',
        actorKind: 'agent', type: 'discovery', project: 'brain', content: 'x',
      }) + '\n',
      'utf8',
    );
  }
  return { mainDir, originDir };
}

/** A repo whose lane ref already diverged from origin — engineered directly
 * via `collectLane` + a raw force-push, never through the CLI, so the ONLY
 * path this fixture ever drives through the real `ship` op is the pre-push
 * divergence refusal (before any `vcs` call).
 *
 * CRITICAL: this must use the exact same `host`/`date` the real CLI process
 * will compute for itself (`hostname()`, today's date) — `memory/cli.mjs`'s
 * `ship` op takes neither as a flag (mirrors `collect`'s own lack of a
 * `--date` override). A mismatched ref here would let the CLI's own
 * `collectLane` mint a DIFFERENT, non-diverged ref, sail past the
 * divergence check, and reach the REAL `vcs` port — exactly the "never call
 * the real VCS port in tests" rule this fixture exists to make structurally
 * impossible. */
function fixtureRepoDiverged() {
  const host = hostname();
  const date = new Date().toISOString().slice(0, 10);
  const { mainDir, originDir } = fixtureRepo({ withCandidate: true });
  const collected = collectLane({ root: mainDir, host, date });
  git(mainDir, 'push', 'origin', `${collected.ref}:${collected.ref}`);
  const raceTree = git(mainDir, 'rev-parse', `${collected.commit}^{tree}`).trim();
  const raceCommit = git(mainDir, 'commit-tree', raceTree, '-m', 'racing writer').trim();
  git(mainDir, 'push', '--force', 'origin', `${raceCommit}:${collected.ref}`);
  return { mainDir, originDir };
}

function runCli(root, ...args) {
  return spawnSync(process.execPath, [CLI, 'ship', ...args], {
    encoding: 'utf8',
    env: { ...process.env, BRAIN_MEMORY_TEST_ROOT: root, MEMORY_BACKEND: 'no-such-backend' },
  });
}

test('memory:ship is a valid op, dispatched before backend selection', () => {
  const { mainDir } = fixtureRepo({ withCandidate: false });
  const run = runCli(mainDir);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stderr, /backend 'no-such-backend' not found/);
  assert.doesNotMatch(run.stderr, /unknown op/);
});

test('nothing to ship: exit 0, prints memory.ship.nothing', () => {
  const { mainDir } = fixtureRepo({ withCandidate: false });
  const run = runCli(mainDir);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /memory\/cli:/);
});

test('--json carries the outcome shape on stdout only', () => {
  const { mainDir } = fixtureRepo({ withCandidate: false });
  const run = runCli(mainDir, '--json');
  assert.equal(run.status, 0, run.stderr);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.pushed, false);
  assert.equal(parsed.pr, null);
  assert.equal(parsed.dryRun, false);
});

test('--dry-run prints the plan and makes zero of ship\'s own network calls (push/fetch never happen)', () => {
  const { mainDir, originDir } = fixtureRepo({ withCandidate: true });
  const beforeOriginRefs = git(originDir, 'for-each-ref', 'refs/heads/memory/');
  assert.equal(beforeOriginRefs, '', 'no lane ref must exist on origin before the dry run');

  const run = runCli(mainDir, '--dry-run', '--json');
  assert.equal(run.status, 0, run.stderr);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.pushed, false);
  assert.equal(parsed.pr, null);

  const afterOriginRefs = git(originDir, 'for-each-ref', 'refs/heads/memory/');
  assert.equal(afterOriginRefs, '', 'a dry run must never push the lane ref to origin');
});

test('a pre-seeded divergent origin lane: exit 1 + memory.ship.diverged, this path never reaches the port', () => {
  const { mainDir, originDir } = fixtureRepoDiverged();
  const beforeSha = git(originDir, 'for-each-ref', '--format=%(objectname)', 'refs/heads/memory/').trim();

  const run = runCli(mainDir);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /memory\/cli:.*diverged/i);

  const afterSha = git(originDir, 'for-each-ref', '--format=%(objectname)', 'refs/heads/memory/').trim();
  assert.equal(afterSha, beforeSha, 'the diverged remote ref must be left exactly as it was');
});

test('the CLI never re-throws: a diverged run exits cleanly with no stack trace on stderr', () => {
  const { mainDir } = fixtureRepoDiverged();
  const run = runCli(mainDir);
  assert.equal(run.status, 1);
  assert.doesNotMatch(run.stderr, /at .*\(.*\.m?js:\d+:\d+\)/, 'an uncaught exception would print a stack trace — this must be a caught, mapped failure');
});

test('BRAIN_MEMORY_TOKEN never appears in stdout or stderr, on any path', () => {
  const sentinel = 'sekrit-token-value-do-not-print';
  const { mainDir: nothingRoot } = fixtureRepo({ withCandidate: false });
  const runNothing = spawnSync(process.execPath, [CLI, 'ship', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, BRAIN_MEMORY_TEST_ROOT: nothingRoot, MEMORY_BACKEND: 'no-such-backend', BRAIN_MEMORY_TOKEN: sentinel },
  });
  assert.doesNotMatch(runNothing.stdout + runNothing.stderr, new RegExp(sentinel));

  const { mainDir: divergedRoot } = fixtureRepoDiverged();
  const runDiverged = spawnSync(process.execPath, [CLI, 'ship'], {
    encoding: 'utf8',
    env: { ...process.env, BRAIN_MEMORY_TEST_ROOT: divergedRoot, MEMORY_BACKEND: 'no-such-backend', BRAIN_MEMORY_TOKEN: sentinel },
  });
  assert.doesNotMatch(runDiverged.stdout + runDiverged.stderr, new RegExp(sentinel));
});

test('the op reads BRAIN_MEMORY_TOKEN exactly once (source guard) and threads only a bound vcs + identityBound to shipLane', () => {
  const source = readFileSync(CLI, 'utf8');
  const reads = source.match(/process\.env\[MEMORY_TOKEN_ENV\]/g) ?? [];
  assert.equal(reads.length, 1, `BRAIN_MEMORY_TOKEN must be read exactly once via MEMORY_TOKEN_ENV, found ${reads.length} occurrence(s)`);
  assert.doesNotMatch(source, /shipLane\([^)]*identity\b(?!Bound)/, 'shipLane must never receive the raw token — only identityBound');
});

test('memory:ship resolves from package.json, beside the other memory:* scripts', () => {
  const pkg = JSON.parse(readFileSync(join(HERE, '../../../package.json'), 'utf8'));
  assert.equal(pkg.scripts['memory:ship'], 'node ./brain/scripts/memory/cli.mjs ship');
});
