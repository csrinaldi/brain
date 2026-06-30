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

// ── CLI entry-point ──────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Placeholder until 2.16 wires the full orchestrator.
}
