// cold-boot.test.mjs — Unit tests for the reviewer's cold boot (REQ-H1-2,
// REQ-H1-3; design.md §4). No test spawns a real gh/glab/git process — every
// I/O seam is injected via `deps`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evaluateSelfReview, gatherColdBoot, defaultCloneDetached } from './cold-boot.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const PR = { project: 'csrinaldi/brain', number: 42, provider: 'github' };

// headRefOid now comes from prView (ADR-0021 Decision 3) — the H1-1 cold-boot
// `fetchHead` DI-seam reader is retired, no separate seam exists.
function baseDeps(overrides = {}) {
  return {
    fetchPr: async () => ({ number: 42, author: 'alice', labels: [], body: '', headRefOid: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' }),
    cloneDetached: async () => ({ detached: true }),
    readRecords: () => [],
    fetchReviews: async () => [],
    ...overrides,
  };
}

// ── evaluateSelfReview (pure) ────────────────────────────────────────────────

test('evaluateSelfReview: reviewer handle equals author → true', () => {
  assert.equal(evaluateSelfReview({ reviewerHandle: 'brain-reviewer', author: 'brain-reviewer' }), true);
});

test('evaluateSelfReview: reviewer handle differs from author → false', () => {
  assert.equal(evaluateSelfReview({ reviewerHandle: 'brain-reviewer', author: 'alice' }), false);
});

// ── gatherColdBoot: anchor is the API headRefOid, detached ──────────────────

test('gatherColdBoot: checks out detached at prView\'s headRefOid, never a branch name', async () => {
  const cloneCalls = [];
  const fetchPrCalls = [];
  const result = await gatherColdBoot({
    ...PR,
    reviewerHandle: 'brain-reviewer',
    deps: baseDeps({
      fetchPr: async (args) => {
        fetchPrCalls.push(args);
        return { number: 42, author: 'alice', labels: [], body: '', headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d' };
      },
      cloneDetached: async (args) => { cloneCalls.push(args); return { detached: true }; },
    }),
  });

  assert.equal(result.abstain, false);
  assert.equal(result.headSha, 'cafef00dcafef00dcafef00dcafef00dcafef00d');
  assert.equal(cloneCalls.length, 1);
  // The clone seam receives shas only — `sha` (head) + `baseSha` (null here, the
  // fixture has no baseRefOid). NO `branch` key exists on the call (R2 — the
  // anchor is always an oid, never a branch name).
  assert.deepEqual(cloneCalls[0], { sha: 'cafef00dcafef00dcafef00dcafef00dcafef00d', baseSha: null });
  assert.deepEqual(fetchPrCalls[0], { project: PR.project, number: PR.number, provider: PR.provider });
});

// ── gatherColdBoot: the base tip flows to the clone (issue #291) ─────────────

test('gatherColdBoot: prView.baseRefOid flows to cloneDetached as baseSha (so the diff/reversion have the base)', async () => {
  const cloneCalls = [];
  await gatherColdBoot({
    ...PR,
    reviewerHandle: 'brain-reviewer',
    deps: baseDeps({
      fetchPr: async () => ({
        number: 42, author: 'alice', labels: [], body: '',
        headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d',
        baseRefOid: 'ba5eba5eba5eba5eba5eba5eba5eba5eba5eba5e',
      }),
      cloneDetached: async (args) => { cloneCalls.push(args); return { detached: true }; },
    }),
  });

  assert.deepEqual(cloneCalls[0], {
    sha: 'cafef00dcafef00dcafef00dcafef00dcafef00d',
    baseSha: 'ba5eba5eba5eba5eba5eba5eba5eba5eba5eba5e',
  });
});

// ── gatherColdBoot: doctrine is only records + prior verdicts ───────────────

test('gatherColdBoot: doctrine loads decision|architecture records + prior brain-review/1 blocks, excludes note records', async () => {
  const records = [
    { type: 'decision', id: 'd1' },
    { type: 'architecture', id: 'a1' },
    { type: 'note', id: 'n1' },
  ];
  const reviews = [
    { state: 'COMMENTED', author: 'brain-reviewer', body: '```yaml\nprotocol: brain-review/1\nverdict: REVISE\nhead_sha: aaa\nrev: 0\n```' },
    { state: 'COMMENTED', author: 'bob', body: 'just a plain human comment' },
  ];

  const result = await gatherColdBoot({
    ...PR,
    reviewerHandle: 'brain-reviewer',
    deps: baseDeps({
      readRecords: () => records,
      fetchReviews: async () => reviews,
    }),
  });

  assert.equal(result.abstain, false);
  assert.deepEqual(result.doctrine.records, [
    { type: 'decision', id: 'd1' },
    { type: 'architecture', id: 'a1' },
  ]);
  assert.equal(result.doctrine.priorVerdicts.length, 1);
  assert.equal(result.doctrine.priorVerdicts[0].head_sha, 'aaa');
  assert.equal(result.doctrine.priorVerdicts[0].author, 'brain-reviewer');
});

// ── gatherColdBoot: self-review abstention (REQ-H1-3) ────────────────────────

test('gatherColdBoot: reviewer handle equals PR author → abstains, no doctrine load, no boot I/O', async () => {
  const calls = { cloneDetached: 0, readRecords: 0, fetchReviews: 0 };
  const result = await gatherColdBoot({
    ...PR,
    reviewerHandle: 'alice',
    deps: baseDeps({
      fetchPr: async () => ({ number: 42, author: 'alice', labels: [], body: '', headRefOid: 'x' }),
      cloneDetached: async () => { calls.cloneDetached++; },
      readRecords: () => { calls.readRecords++; return []; },
      fetchReviews: async () => { calls.fetchReviews++; return []; },
    }),
  });

  assert.equal(result.abstain, true);
  assert.equal(result.headSha, undefined);
  assert.deepEqual(calls, { cloneDetached: 0, readRecords: 0, fetchReviews: 0 });
});

// ── fetchHead seam retirement (ADR-0021 Decision 3, Fork A condition 2) ─────

test('cold-boot.mjs source carries no fetchHead seam or TODO(#266) retirement marker — retired, headRefOid now comes from prView', () => {
  const src = readFileSync(fileURLToPath(new URL('./cold-boot.mjs', import.meta.url)), 'utf8');
  assert.doesNotMatch(src, /fetchHead/i, 'the fetchHead DI-seam reader must be fully removed');
  assert.doesNotMatch(src, /defaultFetchHead/, 'defaultFetchHead must be fully removed');
  assert.doesNotMatch(src, /TODO\(#266\)/, 'the TODO(#266) retirement marker must be removed once retired');
});

// ── COLDBOOT-CWD (real default, issue #266): protocol §8 "own clone/worktree" ─
// The ONE test that exercises the REAL defaultCloneDetached against real git —
// only the network fetch is stubbed (I/O, not the isolation logic). It must
// create an isolated detached worktree and NEVER move the operator's HEAD.

test('COLDBOOT-CWD (real default): defaultCloneDetached checks out a SEPARATE detached worktree and never moves the operator HEAD', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'brain-review-op-'));
  const wtParent = mkdtempSync(join(tmpdir(), 'brain-review-wt-'));
  t.after(() => {
    try { git(repo, 'worktree', 'prune'); } catch { /* best effort */ }
    rmSync(repo, { recursive: true, force: true });
    rmSync(wtParent, { recursive: true, force: true });
  });

  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 't@t.t');
  git(repo, 'config', 'user.name', 't');
  writeFileSync(join(repo, 'f.txt'), 'hi');
  git(repo, 'add', 'f.txt');
  git(repo, 'commit', '-q', '-m', 'a');
  const sha = git(repo, 'rev-parse', 'HEAD');
  const branch = git(repo, 'symbolic-ref', '--short', 'HEAD');

  // Real default; only the network fetch is stubbed (the sha is already local).
  const clone = defaultCloneDetached({ cwd: repo, fetch: () => {}, tmp: wtParent })({ sha });

  // isolated worktree, detached at the reviewed sha
  assert.ok(existsSync(clone.worktreePath), 'an isolated worktree must be created');
  assert.equal(git(clone.worktreePath, 'rev-parse', 'HEAD'), sha, 'worktree HEAD is the reviewed sha');
  assert.throws(() => git(clone.worktreePath, 'symbolic-ref', '-q', 'HEAD'), 'worktree HEAD must be DETACHED (no branch ref)');

  // the operator's HEAD did NOT move — still on its branch, still at the same sha
  assert.equal(git(repo, 'symbolic-ref', '--short', 'HEAD'), branch, 'operator HEAD stays on its branch — never detached in cwd');
  assert.equal(git(repo, 'rev-parse', 'HEAD'), sha, 'operator HEAD did not move');
});

// ── COLDBOOT-DEPTH (issue #291): fetch BOTH head and base WITH history ───────
// Second instance of the COLDBOOT-CWD class — "a DI seam tested only through its
// injected stub never exercises the real default". The `--depth 1` head-only
// fetch left the head a shallow graft (no ancestors → no merge-base) and never
// brought the base at all, so downstream `git diff base...head` (cli.mjs
// getChangedFiles) and `git checkout base -- <files>` (checkpoint §10.4
// reversion) both fail — the exact #290 crash (`fatal: <base>...<head>: no
// merge base`). Real git, real fetch from a local bare remote where the
// operator starts WITHOUT either commit (I291-AMBIENT-STATE: cold boot must be
// self-sufficient, never leaning on the operator's ambient clone state).
test('COLDBOOT-DEPTH (real default): defaultCloneDetached fetches head AND base with history — base...head diff resolves and the §10.4 base checkout works', (t) => {
  const remote = mkdtempSync(join(tmpdir(), 'brain-review-remote-'));
  const seed = mkdtempSync(join(tmpdir(), 'brain-review-seed-'));
  const op = mkdtempSync(join(tmpdir(), 'brain-review-op-'));
  const wtParent = mkdtempSync(join(tmpdir(), 'brain-review-wt-'));
  t.after(() => {
    try { git(op, 'worktree', 'prune'); } catch { /* best effort */ }
    for (const d of [remote, seed, op, wtParent]) rmSync(d, { recursive: true, force: true });
  });

  // Bare remote: a base and a head that DIVERGE from a common ancestor A.
  git(remote, 'init', '-q', '--bare');
  git(seed, 'init', '-q');
  git(seed, 'config', 'user.email', 't@t.t'); git(seed, 'config', 'user.name', 't');
  writeFileSync(join(seed, 'impl.mjs'), 'export const x = 1;\n');
  git(seed, 'add', 'impl.mjs'); git(seed, 'commit', '-q', '-m', 'A (common ancestor)');
  git(seed, 'checkout', '-q', '-b', 'base-branch');
  writeFileSync(join(seed, 'base-only.txt'), 'base\n');
  git(seed, 'add', 'base-only.txt'); git(seed, 'commit', '-q', '-m', 'B (base tip)');
  const baseSha = git(seed, 'rev-parse', 'HEAD');
  git(seed, 'checkout', '-q', '-b', 'head-branch', 'base-branch~1'); // diverge from A
  writeFileSync(join(seed, 'impl.mjs'), 'export const x = 2;\n');
  git(seed, 'add', 'impl.mjs'); git(seed, 'commit', '-q', '-m', 'H (head tip)');
  const headSha = git(seed, 'rev-parse', 'HEAD');
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', '-q', 'origin', 'base-branch', 'head-branch');

  // Operator repo: valid, but does NOT yet have base or head.
  git(op, 'init', '-q');
  git(op, 'config', 'user.email', 't@t.t'); git(op, 'config', 'user.name', 't');
  writeFileSync(join(op, 'unrelated.txt'), 'x'); git(op, 'add', 'unrelated.txt'); git(op, 'commit', '-q', '-m', 'unrelated');
  git(op, 'remote', 'add', 'origin', remote);

  // Real default fetch (no stub): must bring head AND base with history.
  const clone = defaultCloneDetached({ cwd: op, tmp: wtParent })({ sha: headSha, baseSha });
  assert.equal(clone.sha, headSha);

  // 1) the three-dot diff (cli.mjs getChangedFiles) resolves a merge-base (A)
  const changed = git(op, 'diff', '--name-only', `${baseSha}...${headSha}`);
  assert.match(changed, /impl\.mjs/, 'base...head diff must resolve — merge-base A reachable');

  // 2) the §10.4 reversion actually runs: inside the detached head worktree,
  //    `git checkout <base> -- impl.mjs` must succeed and revert the file to
  //    its base content (proves the base TREE — not just the commit — is local).
  git(clone.worktreePath, 'checkout', baseSha, '--', 'impl.mjs');
  assert.equal(
    readFileSync(join(clone.worktreePath, 'impl.mjs'), 'utf8'),
    'export const x = 1;\n',
    'the base checkout must revert impl.mjs to its base content (§10.4 TDD-RED reversion)',
  );
});

// ── COLDBOOT-SHALLOW (issue #293): a SHALLOW operator clone truncates history ─
// #291/#292 fixed the "base never fetched" half, but the REAL operator repo is a
// shallow clone AND the base/head tips are ALREADY present as depth-1 grafts
// (the #290 reality: the tracker already had both). Re-`git fetch origin <sha>`
// on an already-present graft is a no-op — it never deepens — so the merge-base
// (M, below both grafts) stays absent and base...head still fails. Third
// instance of the class: the fixture must match the real ENVIRONMENT (shallow +
// grafts already local), not merely exercise the real default.
// defaultCloneDetached must DEEPEN (unshallow) so the merge-base connects.
//
// History: root R -> M (merge-base); base = M->Pb->B; head = M->Ph->H. The op is
// a depth-1 clone of base-branch (has B, graft at Pb) + a depth-1 fetch of
// head-branch (has H, graft at Ph) — so M is two commits below each graft and
// absent, exactly like feature/v2.0.0 vs issue-266.
test('COLDBOOT-SHALLOW (real default): shallow op with both tips already grafted is deepened so base...head resolves and the §10.4 base checkout works', (t) => {
  const remote = mkdtempSync(join(tmpdir(), 'brain-review-remote-'));
  const seed = mkdtempSync(join(tmpdir(), 'brain-review-seed-'));
  const opParent = mkdtempSync(join(tmpdir(), 'brain-review-opp-'));
  const wtParent = mkdtempSync(join(tmpdir(), 'brain-review-wt-'));
  const op = join(opParent, 'op');
  t.after(() => {
    try { git(op, 'worktree', 'prune'); } catch { /* best effort */ }
    for (const d of [remote, seed, opParent, wtParent]) rmSync(d, { recursive: true, force: true });
  });

  git(remote, 'init', '-q', '--bare');
  git(seed, 'init', '-q', '-b', 'main');
  git(seed, 'config', 'user.email', 't@t.t'); git(seed, 'config', 'user.name', 't');
  writeFileSync(join(seed, 'r.txt'), 'r\n');
  git(seed, 'add', 'r.txt'); git(seed, 'commit', '-q', '-m', 'R (root)');
  writeFileSync(join(seed, 'impl.mjs'), 'export const x = 0;\n');
  git(seed, 'add', 'impl.mjs'); git(seed, 'commit', '-q', '-m', 'M (merge-base)');
  const m = git(seed, 'rev-parse', 'HEAD');
  // base-branch: M -> Pb -> B  (B's grandparent is M)
  git(seed, 'checkout', '-q', '-b', 'base-branch', m);
  writeFileSync(join(seed, 'pb.txt'), 'pb\n'); git(seed, 'add', 'pb.txt'); git(seed, 'commit', '-q', '-m', 'Pb');
  writeFileSync(join(seed, 'impl.mjs'), 'export const x = 1;\n');
  git(seed, 'add', 'impl.mjs'); git(seed, 'commit', '-q', '-m', 'B (base tip)');
  const baseSha = git(seed, 'rev-parse', 'HEAD');
  // head-branch: M -> Ph -> H
  git(seed, 'checkout', '-q', '-b', 'head-branch', m);
  writeFileSync(join(seed, 'ph.txt'), 'ph\n'); git(seed, 'add', 'ph.txt'); git(seed, 'commit', '-q', '-m', 'Ph');
  writeFileSync(join(seed, 'impl.mjs'), 'export const x = 2;\n');
  git(seed, 'add', 'impl.mjs'); git(seed, 'commit', '-q', '-m', 'H (head tip)');
  const headSha = git(seed, 'rev-parse', 'HEAD');
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', '-q', 'origin', 'main', 'base-branch', 'head-branch');

  // Operator repo: shallow, with BOTH tips already present as depth-1 grafts and
  // the merge-base M absent. `file://` so git honours --depth (a local-path
  // clone hardlinks the full store and ignores --depth).
  git(opParent, 'clone', '-q', '--depth', '1', '--branch', 'base-branch', `file://${remote}`, op);
  git(op, 'fetch', '-q', '--depth', '1', 'origin', 'head-branch');
  assert.equal(git(op, 'rev-parse', '--is-shallow-repository'), 'true', 'fixture must be a shallow clone');
  assert.throws(() => git(op, 'merge-base', baseSha, headSha), 'precondition: the merge-base is absent before the fix deepens');

  // Real default: fetch both shas (no-ops — already grafted) AND deepen.
  const clone = defaultCloneDetached({ cwd: op, tmp: wtParent })({ sha: headSha, baseSha });
  assert.equal(clone.sha, headSha);

  const changed = git(op, 'diff', '--name-only', `${baseSha}...${headSha}`);
  assert.match(changed, /impl\.mjs/, 'base...head must resolve from a shallow clone — merge-base M reachable after deepen');

  git(clone.worktreePath, 'checkout', baseSha, '--', 'impl.mjs');
  assert.equal(
    readFileSync(join(clone.worktreePath, 'impl.mjs'), 'utf8'),
    'export const x = 1;\n',
    'the §10.4 base checkout must revert to base content from a shallow clone too',
  );
});
