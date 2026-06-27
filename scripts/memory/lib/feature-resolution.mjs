// feature-resolution.mjs — deterministic active-feature resolver.
//
// Contract (feature-working-memory-contract.md / design.md §Verb contract):
//
//   resolveFeature(root, explicitArg?)
//
//   Precedence:
//     1. Explicit arg provided  → validate openspec/changes/<arg>/ exists; return arg.
//                                 If dir is missing → throw Error (caller must handle).
//     2. No arg, exactly one dir in openspec/changes/ (excluding 'archive') → return it.
//     3. No arg, >1 dirs        → throw Error "ambiguous active feature, pass [feature]: ..."
//                                 Caller: featureCheckpoint catches this; featureResume lets
//                                 it propagate (→ cli.mjs exits 1).
//     4. No arg, 0 dirs         → return null (caller exits 0 gracefully; never crash).
//
//   Branch names are intentionally NOT used for resolution.
//   (e.g., feat/issue-12-working-memory ≠ feature-working-memory)
//
// Pure-ish: only synchronous FS reads; no child processes, no engram dependency.

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolves the active feature change-folder name.
 *
 * @param {string} root         Repo root (absolute path).
 * @param {string} [explicitArg] Explicit feature name from argv, or undefined.
 * @returns {string|null}  Feature name, or null when zero dirs exist.
 * @throws {Error}         When explicit arg dir is missing, or when multiple dirs
 *                         exist and no arg is provided ("ambiguous").
 */
export function resolveFeature(root, explicitArg) {
  const changesDir = join(root, 'openspec', 'changes');

  if (explicitArg !== undefined && explicitArg !== null && explicitArg !== '') {
    // Precedence 1: explicit arg — validate the dir exists.
    const featureDir = join(changesDir, explicitArg);
    if (!existsSync(featureDir)) {
      throw new Error(
        `feature-resolution: '${explicitArg}' not found at ${featureDir}`,
      );
    }
    return explicitArg;
  }

  // No explicit arg — scan openspec/changes/ for candidates.
  let entries;
  try {
    entries = readdirSync(changesDir);
  } catch {
    // openspec/changes/ does not exist (fresh repo, no changes yet).
    return null;
  }

  // Filter: directories only, excluding 'archive'.
  const candidates = entries.filter((entry) => {
    if (entry === 'archive') return false;
    try {
      return statSync(join(changesDir, entry)).isDirectory();
    } catch {
      return false;
    }
  });

  if (candidates.length === 0) {
    // Precedence 4: no active feature.
    return null;
  }

  if (candidates.length === 1) {
    // Precedence 2: unambiguous.
    return candidates[0];
  }

  // Precedence 3: ambiguous — caller must provide an explicit arg.
  throw new Error(
    `feature-resolution: ambiguous active feature, pass [feature] explicitly.\n` +
    `  Found: ${candidates.join(', ')}`,
  );
}
