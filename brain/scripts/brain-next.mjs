#!/usr/bin/env node
// brain-next.mjs — Golden-path verb: state machine — "what is my next step?" (REQ-S5-5).
//
// Usage: npm run brain:next
//   Derives state from (git branch, open PRs, .memory/ status, repo:check)
//   and emits the correct next command — giving a developer an agent-like experience.
//
// States (checked in order):
//   no-branch      → brain:start <issue>           (not on a feature branch)
//   open-pr        → PR status message             (PR already open for this branch)
//   no-memory      → brain:save                    (no uncommitted .memory/ changes)
//   checks-failing → brain:check                   (repo:check or known issue)
//   ready          → brain:ship                    (everything looks good)
//
// The script performs NO action on import — side effects are guarded at the bottom.

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── helpers ───────────────────────────────────────────────────────────────────

// Branches that are definitively NOT a per-issue working branch.
// This list covers permanent/long-lived integration branches.
const NON_WORKING_BRANCHES = /^(main|master|dev|develop|release\/.*)$/;

function isFeatureBranch(branch) {
  // A "working branch" is any named branch that is NOT a permanent integration branch.
  // Heuristic: refuse only explicit matches (main/master/dev/develop/release/*).
  // feature/, gov/, and other prefixes are allowed as working branches so that
  // brain:next can guide developers on those branches.
  if (!branch || branch === 'HEAD') return false;
  if (NON_WORKING_BRANCHES.test(branch)) return false;
  return true;
}

// ── core logic (injectable for tests) ────────────────────────────────────────

/**
 * Derive the next recommended action.
 *
 * @param {object} ctx
 * @param {string}   ctx.branch          Current git branch name.
 * @param {Function} ctx.openPRsFn       Async fn() → Array<{number,title,headBranch}>.
 * @param {Function} ctx.memoryStatusFn  Async fn() → string (git status --porcelain output).
 * @param {Function} ctx.repoCheckFn     Async fn() → {ok}.
 * @returns {Promise<{state:string, nextCommand:string}>}
 */
export async function deriveNext({ branch, openPRsFn, memoryStatusFn, repoCheckFn }) {
  // State 1: not on a working feature branch
  if (!isFeatureBranch(branch)) {
    return {
      state: 'no-branch',
      nextCommand: 'brain:start <issue>  — pick an approved issue and start work',
    };
  }

  // State 2: open PR exists for this branch
  const openPRs = await openPRsFn();
  const matchingPR = openPRs.find(pr => pr.headBranch === branch);
  if (matchingPR) {
    return {
      state: 'open-pr',
      nextCommand:
        `PR #${matchingPR.number} is open ("${matchingPR.title}"). ` +
        `Monitor CI, address reviews, and wait for merge.`,
    };
  }

  // State 3: no uncommitted .memory/ changes → save first
  const memStatus = await memoryStatusFn();
  if (!memStatus || memStatus.trim() === '') {
    return {
      state: 'no-memory',
      nextCommand: 'brain:save  — materialise and commit session memory before shipping',
    };
  }

  // State 4: repo:check failing → fix issues first
  const checkResult = await repoCheckFn();
  if (!checkResult.ok) {
    return {
      state: 'checks-failing',
      nextCommand: 'brain:check  — one or more governance checks are failing; fix them first',
    };
  }

  // State 5: everything looks ready
  return {
    state: 'ready',
    nextCommand: 'brain:ship  — checks pass and memory is saved; open the PR',
  };
}

// ── CLI entry-point ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cwd = process.cwd();

  let branch = '';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8', cwd, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch { /* not a git repo */ }

  // Read config for VCS provider
  const repoRoot = resolve(__dirname, '..', '..');
  let providerModule = null;
  try {
    const cfg = JSON.parse(readFileSync(resolve(repoRoot, 'brain.config.json'), 'utf8'));
    const provider = cfg?.vcs?.provider;
    const project = cfg?.project?.slug;
    if (provider && project) {
      providerModule = await import(`./vcs/providers/${provider}.mjs`);
      providerModule._project = project;
    }
  } catch { /* best-effort */ }

  const result = await deriveNext({
    branch,
    openPRsFn: async () => {
      if (!providerModule) return [];
      try {
        return await providerModule.mrList({ project: providerModule._project, state: 'open' });
      } catch {
        return [];
      }
    },
    memoryStatusFn: async () => {
      try {
        return execSync('git status --porcelain -- .memory', {
          encoding: 'utf8', cwd, stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
      } catch {
        return '';
      }
    },
    repoCheckFn: async () => {
      const r = spawnSync('node', ['brain/scripts/check-refs.mjs'], { encoding: 'utf8', cwd });
      return { ok: r.status === 0 };
    },
  });

  console.log(`\nbrain:next  [${result.state}]`);
  console.log(`  → ${result.nextCommand}`);
  console.log('');
}
