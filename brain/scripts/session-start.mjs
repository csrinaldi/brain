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
      .filter((name) => name.includes(out.token))
      .sort();
    return out;
  } catch {
    return out; // NEVER throws
  }
}

// ── assertLocalArgv — runtime local-op allowlist gate (design §1.5b) ─────────

const GIT_ALLOWED_SUBCOMMANDS = new Set(['status', 'restore', 'rev-parse']);
const MEMORY_CLI_ALLOWED_OPS = new Set(['import', 'feature-resume']);

/**
 * Throws synchronously if `(cmd, args)` is not on the local-only allowlist:
 *   - `git status|restore|rev-parse` (read/local index only).
 *   - `<node> brain/scripts/memory/cli.mjs import|feature-resume` (local-only
 *     ops per memory/cli.mjs:7-10 — never `pull`).
 *
 * Any other argv (notably `git fetch|pull|merge|clone|ls-remote|push`,
 * `memory/cli.mjs pull`, `engram sync --export`) is rejected. This is the
 * defense-in-depth runtime layer of REQ-2 — every subprocess this module
 * issues directly is checked here before it runs.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @throws {Error} when the argv is not allowlisted.
 */
export function assertLocalArgv(cmd, args = []) {
  const a = Array.isArray(args) ? args : [];

  if (cmd === 'git' && GIT_ALLOWED_SUBCOMMANDS.has(a[0])) return;

  const isMemoryCli = typeof a[0] === 'string' && a[0].includes('memory/cli.mjs');
  if (isMemoryCli && MEMORY_CLI_ALLOWED_OPS.has(a[1])) return;

  throw new Error(`assertLocalArgv: blocked non-allowlisted local op: ${cmd} ${a.join(' ')}`);
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

// ── CLI entry-point ──────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Placeholder until 2.16 wires the full orchestrator.
}
