#!/usr/bin/env node
// brain-save.mjs — Golden-path verb: materialise and commit session memory (REQ-S5-3).
//
// Usage: npm run brain:save
//   1. Runs `memory:share` (materialises .memory/ from engram).
//   2. Checks for new uncommitted .memory/ changes via `git status --porcelain`.
//   3. If no new changes → exits 1 with a prompt to capture a session summary.
//   4. Commits .memory/ with message `chore(memory): sync .memory [brain:save]`.
//
// The script performs NO action on import — side effects are guarded at the bottom.

import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ── core logic (injectable for tests) ────────────────────────────────────────

/**
 * Run the brain:save flow.
 *
 * @param {object} ctx
 * @param {Function} ctx.memoryShareFn  Async fn() → {ok,error?}. Injected for tests.
 * @param {Function} ctx.memoryStatusFn Async fn() → string (git status --porcelain output for .memory/).
 * @param {Function} ctx.gitAddFn       Async fn() → {ok,error?}. Injected for tests.
 * @param {Function} ctx.gitCommitFn    Async fn(message) → {ok,error?}. Injected for tests.
 * @returns {Promise<{exitCode:number, message:string}>}
 */
export async function runSave({ memoryShareFn, memoryStatusFn, gitAddFn, gitCommitFn }) {
  // Step 1: materialise memory
  const shareResult = await memoryShareFn();
  if (!shareResult.ok) {
    return {
      exitCode: 1,
      message: `brain:save: memory:share failed — ${shareResult.error ?? 'unknown error'}.\n  Run "npm run memory:share" manually and retry.`,
    };
  }

  // Step 2: check for uncommitted .memory/ changes
  const status = await memoryStatusFn();
  if (!status || status.trim() === '') {
    return {
      exitCode: 1,
      message:
        'brain:save: no new .memory/ changes after memory:share.\n' +
        '  Capture a session summary first:\n' +
        '    • In your AI session: ask the agent to run mem_session_summary\n' +
        '    • Then re-run:  npm run brain:save',
    };
  }

  // Step 3: stage .memory/
  const addResult = await gitAddFn();
  if (!addResult.ok) {
    return {
      exitCode: 1,
      message: `brain:save: git add .memory failed — ${addResult.error ?? 'unknown'}`,
    };
  }

  // Step 4: commit
  const COMMIT_MSG = 'chore(memory): sync .memory [brain:save]';
  const commitResult = await gitCommitFn(COMMIT_MSG);
  if (!commitResult.ok) {
    return {
      exitCode: 1,
      message: `brain:save: git commit failed — ${commitResult.error ?? 'unknown'}`,
    };
  }

  return {
    exitCode: 0,
    message: `brain:save: .memory/ committed — "${COMMIT_MSG}"`,
  };
}

// ── real git helpers ──────────────────────────────────────────────────────────

function gitStatus(cwd) {
  try {
    return execSync('git status --porcelain -- .memory', {
      encoding: 'utf8', cwd, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function gitAdd(cwd) {
  const r = spawnSync('git', ['add', '.memory'], { encoding: 'utf8', cwd });
  if (r.status === 0) return { ok: true };
  return { ok: false, error: r.stderr.trim() };
}

function gitCommit(message, cwd) {
  const r = spawnSync('git', ['commit', '-m', message], { encoding: 'utf8', cwd });
  if (r.status === 0) return { ok: true };
  return { ok: false, error: r.stderr.trim() };
}

// ── CLI entry-point ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cwd = process.cwd();

  const result = await runSave({
    memoryShareFn: async () => {
      const r = spawnSync('node', ['scripts/memory/cli.mjs', 'share'], {
        encoding: 'utf8', cwd, stdio: 'inherit',
      });
      return { ok: r.status === 0, error: r.stderr };
    },
    memoryStatusFn: async () => gitStatus(cwd),
    gitAddFn: async () => gitAdd(cwd),
    gitCommitFn: async (msg) => gitCommit(msg, cwd),
  });

  if (result.exitCode === 0) {
    console.log(result.message);
  } else {
    console.error(result.message);
  }
  process.exit(result.exitCode);
}
