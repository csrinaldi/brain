// collect.mjs — the IO shell for the lane collector (#887 Slice B, ADR-0034 L4/C2).
//
// collectLane() is the only place this slice touches the machine: it
// enumerates worktrees, reads bytes, scans them for secrets, writes blobs,
// builds a tree in a TEMPORARY index, mints a commit, and moves ONE local
// ref with a compare-and-swap. Every decision about WHICH bytes survive is
// delegated to `lane/plan.mjs`'s planLaneCommit() (A1) — this module never
// decides who wins a group, it only executes the plan.
//
// See openspec/changes/issue-887-lane-collector/design.md, decisions A1-A9,
// and its "Data flow" section for the exact command sequence this mirrors.

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join, basename } from 'node:path';

import { planLaneCommit } from './plan.mjs';
import { scanTextForSecrets, resolveSecretConfig, compilePatterns } from '../lib/secret-scrub.mjs';
// removeTempTree, not a bare rmSync: this module spawns git AND recursively
// removes a directory (the temp index's mkdtemp dir) — issue #800/#802's
// adoption rule for exactly that combination.
import { removeTempTree } from '../../__fixtures__/tmp-tree.mjs';

// Node's execFileSync defaults to a 1 MiB output buffer — the same ceiling
// governance/postmerge/git-seam.mjs raises for the same reason (#332): a
// large `ls-tree`/`status` over a long-lived worktree tree must not collapse
// to an unmapped -1 status just because our own limit, not git's, was hit.
const DEFAULT_MAX_BUFFER = 256 * 1024 * 1024;

/**
 * defaultGit() — A3: shaped like governance/postmerge/git-seam.mjs#gitTry,
 * widened by `input` (A2's exact-bytes hash) and `env` (A9's GIT_INDEX_FILE).
 * NEVER throws — a genuine spawn failure collapses to status -1, still
 * distinguishable from every real git exit code.
 *
 * @param {string[]} argv
 * @param {{ cwd?: string, input?: string, env?: Record<string,string> }} [opts]
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export function defaultGit(argv, { cwd = process.cwd(), input, env } = {}) {
  try {
    const stdout = execFileSync('git', argv, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: DEFAULT_MAX_BUFFER,
      input,
      env: env ? { ...process.env, ...env } : process.env,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    if (err.code === 'ENOBUFS') {
      return {
        status: -1,
        stdout: typeof err.stdout === 'string' ? err.stdout : '',
        stderr: `git output exceeded the ${DEFAULT_MAX_BUFFER}-byte output buffer (ENOBUFS)`,
      };
    }
    return {
      status: typeof err.status === 'number' ? err.status : -1,
      stdout: typeof err.stdout === 'string' ? err.stdout : '',
      stderr: typeof err.stderr === 'string' ? err.stderr : String(err.message ?? ''),
    };
  }
}

/** Run `git(argv, opts)`; return stdout on status 0, throw (`.status` attached) otherwise. */
function gitOrThrow(git, argv, opts = {}) {
  const result = git(argv, opts);
  if (result.status !== 0) {
    const err = new Error(`git ${argv.join(' ')} exited ${result.status}: ${result.stderr.trim()}`);
    err.status = result.status;
    err.stdout = result.stdout;
    err.stderr = result.stderr;
    throw err;
  }
  return result.stdout;
}

/**
 * _defaultLoadConfig() — reads `brain.config.json` for the
 * `governance.memorySecret*` keys, mirroring backends/engram.mjs's
 * `_defaultLoadBrainConfig`. Never throws: an absent/unparseable config
 * falls back to `{}`, which resolveSecretConfig() turns into the default
 * pattern set.
 *
 * @param {string} root
 * @returns {object}
 */
function _defaultLoadConfig(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'brain.config.json'), 'utf8'));
  } catch {
    return {};
  }
}

/** Parse `git worktree list --porcelain` into `{path, bare, prunable, locked}` stanzas. */
function parseWorktrees(stdout) {
  const stanzas = [];
  let current = null;
  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length), bare: false, prunable: false, locked: false };
      stanzas.push(current);
    } else if (current && line === 'bare') {
      current.bare = true;
    } else if (current && line.startsWith('prunable')) {
      current.prunable = true;
    } else if (current && line.startsWith('locked')) {
      current.locked = true;
    }
  }
  return stanzas;
}

/**
 * Parse `git status --porcelain -z -uall -- .memory/records` output.
 * NUL-delimited, two-char status code + space + repo-relative path. Does not
 * decode the rename two-path form (`R  new\0old\0`) — a renamed path is
 * unreachable for this pathspec under normal use (records are appended, not
 * renamed) and would fall through as `unexpected-status`, which is the
 * closed reason set's correct bucket for it.
 */
function parseStatusZ(stdout) {
  const entries = [];
  for (const part of stdout.split('\0')) {
    if (part.length < 4) continue;
    entries.push({ status: part.slice(0, 2), path: part.slice(3) });
  }
  return entries;
}

/**
 * buildCandidate() — A1/A2: read the file's bytes ONCE and scan that exact
 * string. Every status entry is read, regardless of what it will turn out to
 * be routed as — the planner (not this function) decides what is
 * collectable, so duplicating its filename/status grammar here would be a
 * second place for the rule to drift (A7's own rationale, restated).
 */
function buildCandidate(worktreePath, entry, patterns, allowPatterns) {
  const file = basename(entry.path);
  const absPath = join(worktreePath, entry.path);
  let content = null;
  let readError;
  try {
    content = readFileSync(absPath, 'utf8');
  } catch (err) {
    readError = err.message;
  }
  let secret;
  if (content !== null) {
    const hit = scanTextForSecrets(content, patterns, allowPatterns);
    if (hit) secret = { pattern: hit.pattern, lineNumber: hit.lineNumber };
  }
  return { worktree: worktreePath, file, path: entry.path, status: entry.status, content, readError, secret };
}

/**
 * collectLane() — B2: the IO shell. See design.md's "Data flow" for the
 * exact command sequence.
 *
 * @param {{
 *   root: string,
 *   date?: string,
 *   host?: string,
 *   git?: typeof defaultGit,
 *   loadConfig?: (root: string) => object,
 * }} opts
 * @returns {{ref: string, commit: string|null, collected: number, skipped: object[],
 *   duplicates: object, baseFetched: boolean}}
 */
export function collectLane({
  root,
  date = new Date().toISOString().slice(0, 10),
  host = hostname(),
  git = defaultGit,
  loadConfig = _defaultLoadConfig,
}) {
  // A4: date is read once by the caller's default above, not re-read below —
  // a run that crosses midnight must not mint two refs.

  // 1. fetch origin main — best-effort. A failed fetch degrades to the local
  //    origin/main ref, never aborts the run (A9's "offline" branch).
  const fetchResult = git(['fetch', 'origin', 'main'], { cwd: root });
  const baseFetched = fetchResult.status === 0;

  // 2. the base tree/commit this run measures candidates against.
  const originMainTip = gitOrThrow(git, ['rev-parse', 'origin/main'], { cwd: root }).trim();

  // 3. one `worktree list --porcelain` call (D6 cost control).
  const worktreeListOut = gitOrThrow(git, ['worktree', 'list', '--porcelain'], { cwd: root });
  const stanzas = parseWorktrees(worktreeListOut);

  // 4. one `ls-tree` for the whole run (D6 cost control) — mainPaths.
  const lsTreeOut = gitOrThrow(git, ['ls-tree', '-r', '--name-only', 'origin/main'], { cwd: root });
  const mainPaths = lsTreeOut.split('\n').filter(Boolean);

  // 5. secret config, resolved once per run.
  const { patternSources, allowPatternSources } = resolveSecretConfig(loadConfig(root));
  const patterns = compilePatterns(patternSources);
  const allowPatterns = compilePatterns(allowPatternSources);

  // 6. one `status -z -uall` per worktree (A8), `-C <wt>` in argv — the ONLY
  //    `-C` call in this module (the seam guard, design's 3b, asserts this).
  //    `prunable`/`bare` stanzas are skipped without ever calling `status`
  //    on them, and `git worktree prune` is never invoked anywhere here.
  const candidates = [];
  for (const stanza of stanzas) {
    if (stanza.bare || stanza.prunable) continue;
    const statusResult = git(
      ['-C', stanza.path, 'status', '--porcelain', '-z', '-uall', '--', '.memory/records'],
      { cwd: root },
    );
    if (statusResult.status !== 0) continue; // an unreadable worktree degrades to "nothing found here"
    for (const entry of parseStatusZ(statusResult.stdout)) {
      candidates.push(buildCandidate(stanza.path, entry, patterns, allowPatterns));
    }
  }

  // 7. the plan. `parent` is a placeholder here: ref/files/skipped/duplicates/
  //    message never depend on it, only the RETURNED `parent` field does — so
  //    it is safe to correct that one field below once the ref's real tip (if
  //    any) is known, without re-invoking the planner (badHost would already
  //    have thrown by now if the host were invalid).
  let plan;
  try {
    plan = planLaneCommit({ candidates, mainPaths, host, date, parent: { ref: originMainTip, tip: null } });
  } catch (err) {
    if (typeof err.message === 'string' && err.message.startsWith('memory.collect.badHost')) err.badHost = true;
    throw err;
  }

  // 8. A9: observe the ref's current tip AT PLAN TIME — this is the `<old>`
  //     value the CAS below is compared against. If it moved between here and
  //     the `update-ref` call, the CAS fails and the run reports `raced`.
  const refCheck = git(['rev-parse', '--verify', '--quiet', plan.ref], { cwd: root });
  const existingTip = refCheck.status === 0 ? refCheck.stdout.trim() : null;
  const oldTipArg = existingTip ?? '';
  if (existingTip) plan.parent = existingTip; // D2: same-day append parents off the ref's tip, not origin/main

  // 9. blobs for the winners ONLY (A1: a marked candidate never reaches
  //    `plan.files`, so `hash-object -w` is structurally unreachable for it).
  const blobs = plan.files.map((f) => ({
    path: f.path,
    sha: gitOrThrow(git, ['hash-object', '-w', '--stdin', '--path', f.path], { cwd: root, input: f.content }).trim(),
  }));

  // 10. build the tree in a TEMPORARY index (D6: no working tree, no repo
  //     index, is ever touched — `read-tree`/`update-index --cacheinfo`/
  //     `write-tree` with no `-u`/`-m` flag never checks anything out).
  const tmpDir = mkdtempSync(join(tmpdir(), 'brain-lane-index-'));
  const tmpIndex = join(tmpDir, 'index');
  try {
    const env = { GIT_INDEX_FILE: tmpIndex };
    gitOrThrow(git, ['read-tree', plan.parent], { cwd: root, env });
    for (const b of blobs) {
      gitOrThrow(git, ['update-index', '--add', '--cacheinfo', '100644', b.sha, b.path], { cwd: root, env });
    }
    const newTreeSha = gitOrThrow(git, ['write-tree'], { cwd: root, env }).trim();
    const parentTreeSha = gitOrThrow(git, ['rev-parse', `${plan.parent}^{tree}`], { cwd: root }).trim();

    if (newTreeSha === parentTreeSha) {
      // Nothing new: the ref is left exactly as it was, `update-ref` is never
      // called — the "nothing new is a no-op" scenario, verbatim.
      return { ref: plan.ref, commit: null, collected: 0, skipped: plan.skipped, duplicates: plan.duplicates, baseFetched };
    }

    const newCommitSha = gitOrThrow(
      git,
      ['commit-tree', newTreeSha, '-p', plan.parent, '-m', plan.message],
      { cwd: root },
    ).trim();

    // 11. the CAS. A lost race is NOT retried — the loser's plan is stale,
    //     its blobs are harmless loose objects, and a re-run collects them.
    const updateRefResult = git(['update-ref', plan.ref, newCommitSha, oldTipArg], { cwd: root });
    if (updateRefResult.status !== 0) {
      const err = new Error(`memory.collect.raced: ${plan.ref} moved during this run — ${updateRefResult.stderr.trim()}`);
      err.raced = true;
      throw err;
    }

    return {
      ref: plan.ref,
      commit: newCommitSha,
      collected: plan.files.length,
      skipped: plan.skipped,
      duplicates: plan.duplicates,
      baseFetched,
    };
  } finally {
    removeTempTree(tmpDir);
  }
}
