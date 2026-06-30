#!/usr/bin/env node
// session-start.mjs — universal, read-only, LOCAL-ONLY session context loader
// (issue #138, design.md). Restores brain's operational context (manifest,
// engram, active change, ticket memory) for any agent or human, without the
// cost or network surface of day:start.
//
// The module performs NO action on import — all side effects are guarded by
// the `if (process.argv[1] === fileURLToPath(import.meta.url))` block at the
// bottom (mirrors brain-start.mjs:10-11,94). Each ordered step is a small
// exported/local function that takes `cwd` plus an injectable dependency
// seam, so it is unit-testable without subprocesses.
//
// Dependency boundary (design §1.5a — statically asserted by
// session-start.test.mjs's import-graph test): this module imports ONLY
// node:* builtins, lib/git-branch.mjs, lib/memory-manifest.mjs, and
// memory/lib/auto-resume.mjs. It MUST NOT import day-start.mjs, vcs/*,
// lib/installer.mjs, or memory/cli.mjs's `pull` path.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { currentBranch } from './lib/git-branch.mjs';
import { restoreManifestChurn } from './lib/memory-manifest.mjs';
import { tryFeatureResume } from './memory/lib/auto-resume.mjs';

// ── deriveChangeFromBranch — branch → openspec/changes/* resolver (design §1.4) ──

/**
 * Extracts an `issue-<N>` token from a branch name and matches it against
 * `openspec/changes/*` directory names (excluding `archive`).
 *
 * 0 / 1 / N handling is resolved by the caller (step3ResolveChange) — this
 * function only reports the facts. NEVER throws under any input.
 *
 * @param {string|null|undefined} branchName
 * @param {string} changesDir            Absolute path to openspec/changes.
 * @param {{ _readdir?: typeof readdirSync }} [opts]  Injectable seam for tests.
 * @returns {{ token: string|null, matches: string[] }}
 */
export function deriveChangeFromBranch(branchName, changesDir, { _readdir = readdirSync } = {}) {
  const out = { token: null, matches: [] };
  try {
    if (!branchName || typeof branchName !== 'string') return out;
    const m = branchName.match(/issue-(\d+)/i);
    if (!m) return out;
    out.token = `issue-${m[1]}`;

    let entries = [];
    try {
      entries = _readdir(changesDir, { withFileTypes: true });
    } catch {
      return out; // missing/unreadable changesDir → token known, zero matches
    }

    out.matches = entries
      .filter((e) => e && typeof e.isDirectory === 'function' && e.isDirectory() && e.name !== 'archive')
      .map((e) => e.name)
      // Delimiter-anchored match (NOT substring `.includes`): a dir name only
      // matches when it IS the token (bare `issue-<N>`) or starts with
      // `<token>-` (the usual `issue-<N>-<slug>` shape). Plain `.includes`
      // let a short token substring-match a longer one, e.g.
      // 'issue-138-session-start'.includes('issue-13') === true — a
      // confident WRONG resolution for branch `issue-13`.
      .filter((name) => name === out.token || name.startsWith(`${out.token}-`))
      .sort();
    return out;
  } catch {
    return out; // NEVER throws
  }
}

// ── assertLocalArgv — runtime local-op allowlist gate (design §1.5b) ─────────

const GIT_ALLOWED_SUBCOMMANDS = new Set(['status', 'restore', 'rev-parse']);
const MEMORY_CLI_ALLOWED_OPS = new Set(['import', 'feature-resume']);

// Defense in depth: reject these anywhere in argv, even on an otherwise-
// allowed cmd — guards against a future bug appending a network verb or flag
// (e.g. `import --export`) to an allowlisted call. The first alternative is
// anchored (`^...$`) so it only matches a *whole* argv token, not a
// substring; `--export`/`--cloud` match anywhere since they are themselves
// unambiguous flag names.
const FORBIDDEN_ARGV_TOKEN = /^(pull|fetch|merge|clone|ls-remote|push)$|--export|--cloud/i;

/**
 * Throws synchronously if `(cmd, args)` is not on the local-only allowlist:
 *   - `git status|restore|rev-parse` (read/local index only; trailing path
 *     args are permitted — these ops legitimately take them).
 *   - `<node> brain/scripts/memory/cli.mjs import|feature-resume`, called
 *     with EXACTLY those 2 args — no trailing flags (local-only ops per
 *     memory/cli.mjs:7-10 — never `pull`).
 *
 * Any other argv (notably `git fetch|pull|merge|clone|ls-remote|push`,
 * `memory/cli.mjs pull`, `memory/cli.mjs import --export`, `engram sync
 * --export`) is rejected. This is the runtime gate ALL subprocess calls
 * session-start.mjs controls are routed through — directly (step 2) and via
 * the injected `_spawn` seam threaded into the PR1 libs and the
 * feature-resume runner (steps 1, 3, 4) — before they reach the real spawn.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @throws {Error} when the argv is not allowlisted.
 */
export function assertLocalArgv(cmd, args = []) {
  const a = Array.isArray(args) ? args : [];
  const describe = () => `${cmd} ${a.join(' ')}`;

  if (a.some((arg) => typeof arg === 'string' && FORBIDDEN_ARGV_TOKEN.test(arg))) {
    throw new Error(`assertLocalArgv: blocked non-allowlisted local op: ${describe()}`);
  }

  if (cmd === 'git' && GIT_ALLOWED_SUBCOMMANDS.has(a[0])) return;

  const isMemoryCli = typeof a[0] === 'string' && a[0].includes('memory/cli.mjs');
  if (isMemoryCli && a.length === 2 && MEMORY_CLI_ALLOWED_OPS.has(a[1])) return;

  throw new Error(`assertLocalArgv: blocked non-allowlisted local op: ${describe()}`);
}

/**
 * The ONE gated runner every subprocess session-start.mjs controls funnels
 * through: validates `(cmd, args)` via `assertLocalArgv` BEFORE invoking the
 * underlying spawn function (real `spawnSync` in production, an injectable
 * spy in tests) — design §1.5(b)'s "every subprocess goes through ONE gated
 * runner" made literally true for both production and test code paths.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {object} opts
 * @param {Function} [spawnFn]  Defaults to the real `spawnSync`.
 */
export function gatedSpawn(cmd, args, opts, spawnFn = spawnSync) {
  assertLocalArgv(cmd, args);
  return spawnFn(cmd, args, opts);
}

// ── renderContextBlock — pure, sync, deterministic output (design §1.7) ─────

// TODO(#138): move these section labels to session.* i18n keys (en.mjs/es.mjs)
// per design §1.8. Kept as plain literals here so the renderer stays pure/sync
// and trivially snapshot-testable in PR2; PR3 resolves the i18n strings ONCE
// in the CLI entry and passes the resolved map in, without changing this
// function's shape.
const HEADER = 'brain · session context';
const RULE_DOUBLE = '========================';
const RULE_SINGLE = '------------------------------------------';

function formatChangeLine(change) {
  const { matches } = change;
  if (matches.length === 0) return 'change:   (no change folder for branch)';
  if (matches.length === 1) return `change:   ${matches[0]}`;
  return `change:   ambiguous (${matches.length}): ${matches.join(', ')}`;
}

/**
 * Pure, synchronous string builder — no clocks, no randomness, no ANSI.
 * Fixed section order; lines are present/absent based only on the inputs.
 *
 * @param {{ manifest: {restored: boolean}, engram: {ok: boolean},
 *           change: {branch: string|null, token: string|null, matches: string[]},
 *           ticket: string|null }} model
 * @returns {string}
 */
export function renderContextBlock(model) {
  const { manifest, engram, change, ticket } = model;

  const lines = [
    HEADER,
    RULE_DOUBLE,
    `branch:   ${change.branch ?? '(unknown)'}`,
    formatChangeLine(change),
    engram.ok ? 'memory:   engram hydrated' : 'memory:   engram unavailable (skipped)',
  ];

  if (manifest.restored) {
    lines.push('manifest: churn restored (safe)');
  }

  lines.push(
    RULE_SINGLE,
    'ticket:',
    ticket ?? '(no active ticket memory)',
    RULE_DOUBLE,
  );

  return lines.join('\n');
}

// ── ordered step functions — injectable deps seam (design §1.1) ─────────────
//
// `deps` is the single seam for tests: { _spawn, _branch, _changes, _resume }.
// Each defaults to the real local implementation; production passes nothing.
// Every step is independently try/caught and folds failure into its return
// shape — a missing engram, a non-git dir, or an ambiguous branch must
// degrade to a printed note, never an exception.

/**
 * Step 1 — restore `.memory/manifest.json` churn before any git or engram
 * operation (REQ-3). Thin wrapper over `restoreManifestChurn`.
 *
 * @returns {{ restored: boolean }}
 */
export function step1RestoreManifest(cwd, deps = {}) {
  try {
    return restoreManifestChurn(cwd, { _spawn: deps._spawn });
  } catch {
    return { restored: false };
  }
}

/**
 * Step 2 — hydrate local engram from `.memory/` via the allowlisted
 * `memory/cli.mjs import` (REQ-4). Local-only: gated by `assertLocalArgv`.
 *
 * @returns {{ ok: boolean }}
 */
export function step2HydrateEngram(cwd, deps = {}) {
  try {
    const spawn = deps._spawn ?? spawnSync;
    const cmd = process.execPath;
    const args = ['brain/scripts/memory/cli.mjs', 'import'];
    assertLocalArgv(cmd, args);
    const r = spawn(cmd, args, { cwd, encoding: 'utf8' });
    return { ok: Boolean(r) && r.status === 0 };
  } catch {
    return { ok: false };
  }
}

/**
 * Step 3 — resolve the current branch and its matching change folder(s)
 * (REQ-5). Combines `currentBranch` + `deriveChangeFromBranch`.
 *
 * @returns {{ branch: string|null, token: string|null, matches: string[] }}
 */
export function step3ResolveChange(cwd, deps = {}) {
  try {
    const branchFn = deps._branch ?? ((c) => currentBranch(c, { _spawn: deps._spawn }));
    const branch = branchFn(cwd);
    const changesDir = join(cwd, 'openspec', 'changes');
    const readdir = deps._changes ?? readdirSync;
    const { token, matches } = deriveChangeFromBranch(branch, changesDir, { _readdir: readdir });
    return { branch: branch ?? null, token, matches };
  } catch {
    return { branch: null, token: null, matches: [] };
  }
}

/**
 * Step 4 — surface active-ticket operational memory via the existing
 * `tryFeatureResume` (REQ-6). Already fully isolated; wrapped again here for
 * the same step-level invariant the other steps share.
 *
 * @returns {string|null}
 */
export function step4LoadTicketMemory(cwd, deps = {}) {
  try {
    const resumeFn = deps._resume ?? tryFeatureResume;
    return resumeFn(cwd) ?? null;
  } catch {
    return null;
  }
}

// ── runSessionStart — top-level orchestrator (design §1.1) ──────────────────

/**
 * Runs the full session:start loop in order: restore manifest churn →
 * hydrate engram → resolve branch/change → load ticket memory → render.
 *
 * ALWAYS resolves with `exitCode: 0`. session:start is a best-effort context
 * loader — a missing engram, a non-git dir, or an ambiguous branch must
 * degrade to a printed note, never a non-zero exit (an agent's session must
 * not be blocked by a context-load failure).
 *
 * @param {string} cwd
 * @param {{ _spawn?: Function, _branch?: Function, _changes?: Function, _resume?: Function }} [deps]
 * @returns {Promise<{ exitCode: 0, output: string }>}
 */
export async function runSessionStart(cwd, deps = {}) {
  const manifest = step1RestoreManifest(cwd, deps);
  const engram = step2HydrateEngram(cwd, deps);
  const change = step3ResolveChange(cwd, deps);
  const ticket = step4LoadTicketMemory(cwd, deps);
  const output = renderContextBlock({ manifest, engram, change, ticket });
  return { exitCode: 0, output };
}

// ── CLI entry-point ──────────────────────────────────────────────────────────
//
// Import-pure: NO action runs unless this file is the process entry point.
// Prints the context block to stdout and exits 0 implicitly — session:start
// must never block an agent's session on a context-load failure (REQ-1, REQ-7).

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { output } = await runSessionStart(process.cwd());
  console.log(output);
}
