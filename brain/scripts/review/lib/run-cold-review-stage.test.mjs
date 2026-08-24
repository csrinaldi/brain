// run-cold-review-stage.test.mjs — #682 slice 3, B.5.
//
// The centrepiece is `git status --porcelain` read inside a REAL repository
// after a real run. REQ-S3-3's second half is that the stage does not commit,
// and that is a claim about an ABSENCE: the module performs no git operations,
// which no assertion about its source can check and which a future edit could
// quietly undo. So the property is measured from outside, on a repository, by
// the tool that would notice.
//
// It is deliberately stronger than "did not commit". A stage that committed
// nothing but rewrote three tracked files would pass "HEAD is unchanged" and
// would still have corrupted the diff the verdict is about. The assertion is
// that the run's ONLY mutation is the artifact.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

import { runColdReviewStage } from './run-cold-review-stage.mjs';
import { artifactPathFor, ARTIFACT_TAG } from './findings-artifact.mjs';
import { COLD_REVIEW_STAGE } from '../../lib/stage-engine.mjs';

const PR = 765;
const ROUTED = { sdd: { map: { [COLD_REVIEW_STAGE]: { engine: 'claude', model: 'claude-opus-5' } } } };

function git(dir, ...args) {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  return (r.stdout ?? '').trim();
}

/**
 * A repo with one commit. Identity is set explicitly: `git init` inherits none,
 * and a fresh CI runner has none to auto-detect, so a fixture that commits
 * without it passes locally and fails off the author's machine (house pattern).
 */
function makeRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'cold-review-stage-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  spawnSync('git', ['init', '--initial-branch=main', dir], { encoding: 'utf8' });
  for (const [k, v] of [['user.email', 'test@test.com'], ['user.name', 'Test'], ['commit.gpgsign', 'false']]) {
    git(dir, 'config', k, v);
  }
  writeFileSync(join(dir, 'tracked.txt'), 'original\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'base');
  return dir;
}

/**
 * A COLD WORKTREE: a separate directory the engine runs in (judgment:cold-3).
 *
 * Separate on purpose. When the engine's cwd and the artifact's root are the
 * same path, "the engine writes where the reader looks" is true by accident and
 * no test can tell the two apart — which is how the stage shipped reading the
 * operator's tree while the verdict bound itself to the PR head.
 */
function makeWorktree(t) {
  const dir = mkdtempSync(join(tmpdir(), 'cold-review-worktree-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A seam that behaves like an engine which did its job. */
function writingEngine(root, prNumber = PR) {
  return async () => {
    writeFileSync(
      join(root, artifactPathFor(prNumber)),
      `# cold review\n\n\`\`\`${ARTIFACT_TAG}\n[]\n\`\`\`\n`
    );
    return { ok: true };
  };
}

test('the run leaves exactly ONE change, untracked, at the artifact path', async (t) => {
  const root = makeRepo(t);
  const headBefore = git(root, 'rev-parse', 'HEAD');

  const result = await runColdReviewStage({
    config: ROUTED, prNumber: PR, root, worktreePath: makeWorktree(t), deps: { runStage: writingEngine(root) },
  });

  assert.deepEqual(result, { routed: true, ok: true, artifactPath: artifactPathFor(PR) });

  // No commit: the head the verdict binds itself to has not moved. §10 would
  // make the verdict stale against its own commit if it had.
  assert.equal(git(root, 'rev-parse', 'HEAD'), headBefore, 'HEAD must not move');

  // Nothing staged, and nothing tracked modified. Either would mean the run
  // edited the very diff it is reviewing.
  assert.equal(git(root, 'diff', '--cached', '--name-only'), '', 'the index must be untouched');
  assert.equal(git(root, 'diff', '--name-only'), '', 'no tracked file may be modified');

  // The whole worktree delta, as one string. Asserted as an EXACT match rather
  // than "the artifact is in there": a run that also dropped a scratch file, a
  // log, or a rewritten config would satisfy a containment check.
  //
  // `-uall` is load-bearing, not tidiness. Plain `--porcelain` COLLAPSES a wholly
  // untracked directory to a single `?? openspec/` line — measured, it is what
  // the first cut of this assertion got back. Under that form a second file
  // dropped beside the artifact is invisible, and the exact-match assertion above
  // would have passed while the run scattered whatever it liked inside the new
  // directory. The listing has to name files for "exactly one mutation" to mean
  // anything.
  assert.equal(
    git(root, 'status', '--porcelain', '-uall'),
    `?? ${artifactPathFor(PR)}`,
    'the artifact must be the run\'s only mutation, and it must be untracked'
  );
});

test('the stage creates its directory — the engine is not asked to', async (t) => {
  const root = makeRepo(t);
  const dir = dirname(join(root, artifactPathFor(PR)));
  assert.equal(existsSync(dir), false, 'precondition: the directory does not exist yet');

  let sawDir = false;
  await runColdReviewStage({
    config: ROUTED, prNumber: PR, root, worktreePath: makeWorktree(t),
    deps: {
      runStage: async () => {
        // Read from INSIDE the engine's turn: the directory has to exist when
        // the engine runs, not merely by the time the caller looks.
        sawDir = existsSync(dir);
        writeFileSync(join(root, artifactPathFor(PR)), `\`\`\`${ARTIFACT_TAG}\n[]\n\`\`\`\n`);
        return { ok: true };
      },
    },
  });

  assert.ok(sawDir, 'the directory must exist before the engine is spawned');
});

test('a second round is not an error — the directory already being there is normal', async (t) => {
  const root = makeRepo(t);
  const deps = { runStage: writingEngine(root) };

  const wt = makeWorktree(t);
  const first = await runColdReviewStage({ config: ROUTED, prNumber: PR, root, worktreePath: wt, deps });
  const second = await runColdReviewStage({ config: ROUTED, prNumber: PR, root, worktreePath: wt, deps });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true, 'reviews have rounds; the filesystem is not what distinguishes them');
});

test('unrouted does not run, and is NOT reported as a failure', async (t) => {
  const root = makeRepo(t);
  let spawned = false;

  const result = await runColdReviewStage({
    config: { sdd: { map: {} } }, prNumber: PR, root, worktreePath: makeWorktree(t),
    deps: { runStage: async () => { spawned = true; return { ok: true }; } },
  });

  assert.deepEqual(result, { routed: false });
  assert.equal(spawned, false, 'nothing may be spawned for a stage nobody routed');

  // ASKED OF THE FILESYSTEM, NOT OF GIT. The first cut asserted `git status` was
  // empty and claimed it proved no directory was created — measured, moving the
  // `mkdir` ahead of the routing guard left that assertion GREEN, because git
  // does not track empty directories and an empty `openspec/reviews/pr-765/` is
  // invisible to `status` at any `-u` level. Git is the right tool for "did it
  // commit" and the wrong one for "did it create a directory".
  assert.equal(
    existsSync(dirname(join(root, artifactPathFor(PR)))), false,
    'an unrouted stage must not create the directory — a repo that opted out gets no ' +
      'artefacts of a run that did not happen'
  );
  assert.equal(git(root, 'status', '--porcelain', '-uall'), '', 'and nothing git can see, either');
});

test('a clean exit with NO artifact is a failure, not "found nothing"', async (t) => {
  const root = makeRepo(t);

  const result = await runColdReviewStage({
    config: ROUTED, prNumber: PR, root, worktreePath: makeWorktree(t),
    deps: { runStage: async () => ({ ok: true }) },   // exits 0, writes nothing
  });

  // The fold this check exists to prevent: with no artifact,
  // `makeArtifactGenerate` returns null and the verdict says "enabled but no
  // transport is configured" — the SAME words a repo that never routed the stage
  // gets. Without this branch, a silent no-op engine tells the operator who
  // configured it that they did not.
  assert.equal(result.routed, true, 'the stage WAS routed — that fact must survive the failure');
  assert.equal(result.ok, false);
  assert.match(result.reason, /wrote no artifact/);
  assert.match(result.reason, /never routed the stage/, 'and must name the state it refuses to be confused with');
});

test('an engine that failed is reported with its own reason', async (t) => {
  const root = makeRepo(t);

  const result = await runColdReviewStage({
    config: ROUTED, prNumber: PR, root, worktreePath: makeWorktree(t),
    deps: { runStage: async () => ({ ok: false, reason: 'the engine exited with status 137' }) },
  });

  assert.deepEqual(result, { routed: true, ok: false, reason: 'the engine exited with status 137' });
});

test('a seam that answers nothing at all is still a failure', async (t) => {
  const root = makeRepo(t);

  const result = await runColdReviewStage({
    config: ROUTED, prNumber: PR, root, worktreePath: makeWorktree(t), deps: { runStage: async () => undefined },
  });

  assert.equal(result.ok, false, 'an undefined answer must not read as success');
  assert.match(result.reason, /no result/);
});

test('the engine is handed the RESOLVED engine and model, and the stage name', async (t) => {
  const root = makeRepo(t);
  const worktree = makeWorktree(t);

  async function seamSees(config) {
    let seen = null;
    await runColdReviewStage({
      config, prNumber: PR, root, worktreePath: worktree, baseRef: 'aaa', headRef: 'bbb',
      deps: {
        runStage: async (args) => {
          seen = args;
          writeFileSync(join(root, artifactPathFor(PR)), `\`\`\`${ARTIFACT_TAG}\n[]\n\`\`\`\n`);
          return { ok: true };
        },
      },
    });
    return seen;
  }

  // TWO ROUTINGS, and neither is the obvious default. The first cut ran only the
  // `{engine: 'claude', model: 'claude-opus-5'}` fixture and asserted those two
  // strings — measured, replacing `routing.engine`/`routing.model` with those
  // exact literals left it GREEN. An oracle whose fixture equals the hardcode it
  // is meant to catch is not an oracle. Driving two distinct routings kills the
  // hardcode whichever value it picks.
  const a = await seamSees({ sdd: { map: { [COLD_REVIEW_STAGE]: { engine: 'antigravity', model: 'zz-9' } } } });
  const b = await seamSees({ sdd: { map: { [COLD_REVIEW_STAGE]: { engine: 'plain', model: null } } } });

  assert.equal(a.engine, 'antigravity', 'the resolved engine must reach the seam — B.6 dispatches on it');
  assert.equal(a.model, 'zz-9', 'the model rides through opaquely — brain never interprets it (#323)');
  assert.equal(b.engine, 'plain');
  assert.equal(b.model, null, 'an absent model stays absent rather than acquiring a default');

  assert.equal(a.stage, COLD_REVIEW_STAGE);

  // judgment:cold-3. THIS LINE USED TO ASSERT `root`, WHICH IS THE DEFECT — a
  // test can pin the wrong behaviour just as firmly as the right one, and this
  // one did, for the whole slice. The engine reads the COLD checkout, so what
  // it sees is the code the verdict binds itself to rather than whatever branch
  // the operator has out.
  assert.equal(
    a.cwd, worktree,
    'the engine must run in the cold worktree — running in the operator tree reviews an arbitrary ' +
    'branch while the verdict claims the head, and silently, because the diff range still resolves'
  );

  assert.ok(a.prompt.includes('git diff aaa...bbb'), 'the refs reach the role');

  // And the WRITE target is the other half: absolute, into `root`, because the
  // reader looks there. Relative, it would land in the throwaway worktree and
  // the presence check would call a perfectly written artifact missing.
  assert.ok(
    a.prompt.includes(join(root, artifactPathFor(PR))),
    'the path the engine is told to write must be absolute into the operator tree, not relative to its cwd'
  );
});

test('there is NO default runStage — a missing seam refuses instead of picking a backend', async (t) => {
  const root = makeRepo(t);

  await assert.rejects(
    () => runColdReviewStage({ config: ROUTED, prNumber: PR, root }),
    /no default on purpose/,
    'defaulting to one backend would hand it every engine a repo routes to'
  );
});

test('an unreadable routing entry throws rather than running unrouted', async (t) => {
  const root = makeRepo(t);

  await assert.rejects(
    () => runColdReviewStage({
      config: { sdd: { map: { [COLD_REVIEW_STAGE]: {} } } },
      prNumber: PR, root, deps: { runStage: async () => ({ ok: true }) },
    }),
    /names no engine/,
    'an operator who wrote the key asked for something; silence would ignore it'
  );
});

test('a PR number that is not one is refused BEFORE anything is created', async (t) => {
  const root = makeRepo(t);
  let spawned = false;

  await assert.rejects(
    () => runColdReviewStage({
      config: ROUTED, prNumber: '../../etc', root,
      deps: { runStage: async () => { spawned = true; return { ok: true }; } },
    }),
    /is not a PR number/
  );

  assert.equal(spawned, false, 'nothing spawned');

  // The filesystem again, for the same reason: a directory made for a rejected
  // path segment is exactly the kind of empty directory git cannot report.
  assert.equal(
    existsSync(join(root, 'openspec', 'reviews')), false,
    'nothing created — the guard must run before the mkdir, or a rejected number has ' +
      'already made a directory somewhere by the time it is refused'
  );
});

// ── #682 C.5's verdict, judgment:cold-3 ──────────────────────────────────────

test('#682 cold-3: no worktree is a REFUSAL, not a quiet fallback to the operator tree', async (t) => {
  const root = makeRepo(t);
  let spawned = false;

  const result = await runColdReviewStage({
    config: ROUTED, prNumber: PR, root,       // no worktreePath
    deps: { runStage: async () => { spawned = true; return { ok: true }; } },
  });

  assert.equal(spawned, false, 'nothing may be spawned without the checkout the ADR names');
  assert.equal(result.routed, true, 'routed stays true — the repo DID route this, and the caller needs to tell ' +
    'a failure apart from a repo with no transport');
  assert.equal(result.ok, false);
  assert.match(result.reason, /cold/i, 'the reason must name what is missing, not merely that something is');

  // The fallback this refusal replaces is the defect itself: reviewing `root`
  // would produce a well-formed verdict over the wrong tree, and the diff range
  // would still resolve, so nothing downstream could notice.
  assert.doesNotMatch(result.reason, /^the engine/, 'this is not the engine failing — it never ran');
});

test('#682 cold-3: the engine writes into the operator tree and leaves the worktree untouched', async (t) => {
  const root = makeRepo(t);
  const worktree = makeWorktree(t);
  let cwdSeen = null;
  let told = null;

  const result = await runColdReviewStage({
    config: ROUTED, prNumber: PR, root, worktreePath: worktree,
    deps: {
      runStage: async ({ cwd, prompt }) => {
        cwdSeen = cwd;
        // An engine follows the path it is GIVEN. Writing what the prompt names
        // is the whole behaviour under test: if that path were relative, this
        // resolves inside the worktree and the presence check below fails.
        told = prompt.split('\n').find((l) => l.startsWith('Write exactly one file'))
          .match(/`([^`]+)`/)[1];
        writeFileSync(told, `\`\`\`${ARTIFACT_TAG}\n[]\n\`\`\`\n`);
        return { ok: true };
      },
    },
  });

  assert.equal(cwdSeen, worktree, 'the engine reads the cold checkout');
  assert.equal(result.ok, true, `the reader must find what the engine wrote — it was told ${told}`);
  assert.ok(existsSync(join(root, artifactPathFor(PR))), 'the artifact belongs where artifactDeps looks');
  assert.equal(
    existsSync(join(worktree, artifactPathFor(PR))), false,
    'and NOT in the throwaway checkout, which is deleted with it — findings written there are findings lost'
  );
});
