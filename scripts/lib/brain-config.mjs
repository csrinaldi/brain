// brain-config.mjs — Shared loader and writer for brain.config.json.
//
// Reads and parses brain.config.json from the repository root and returns the
// parsed object. All scripts that need project identity values (gitHost,
// gitProjectId, slug, name, etc.) import this instead of duplicating the logic.
//
// Usage:
//   import { loadBrainConfig, ensureProjectIdentity } from './lib/brain-config.mjs';
//   const config = loadBrainConfig();
//   const { gitHost, gitProjectId, slug, name } = config.project;

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { originIdentity } from '../vcs/lib/repo.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..', '..');
const CONFIG_PATH = join(REPO_ROOT, 'brain.config.json');

/**
 * Loads and returns the parsed brain.config.json from the repository root.
 * Throws a descriptive error if the file is missing or malformed.
 *
 * @returns {object} The parsed brain.config.json object.
 */
export function loadBrainConfig() {
  let raw;
  try {
    raw = readFileSync(CONFIG_PATH, 'utf8');
  } catch {
    throw new Error(
      `brain.config.json not found at ${CONFIG_PATH}.\n` +
      'Create it at the repository root with the required project fields.\n' +
      'See brain/project/methodology/developer-environment.md for the expected schema.'
    );
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`brain.config.json is not valid JSON: ${err.message}`);
  }
}

/**
 * Fills empty project.gitHost and project.slug in brain.config.json from the
 * git origin. Idempotent: never overwrites non-empty values.
 *
 * Degrades to a no-op if brain.config.json is unreadable or the origin is absent.
 *
 * @param {string} root - Repository root (defaults to this module's repo root).
 * @param {{ identity?: { host: string|null, project: string|null } }} options
 *   - identity: injected origin identity for testing; omit to call originIdentity().
 * @returns {{ filled: string[] }} Names of fields that were written.
 */
export function ensureProjectIdentity(root = REPO_ROOT, { identity } = {}) {
  // Read and parse brain.config.json; degrade to no-op on any error.
  let cfg;
  try {
    const raw = readFileSync(join(root, 'brain.config.json'), 'utf8');
    cfg = JSON.parse(raw);
  } catch {
    return { filled: [] };
  }

  // Resolve origin identity: use injected value when provided, otherwise query git.
  const id = identity !== undefined ? identity : originIdentity();
  if (!id || (!id.host && !id.project)) {
    return { filled: [] };
  }

  if (!cfg.project) cfg.project = {};

  const filled = [];
  if (!cfg.project.gitHost && id.host) {
    cfg.project.gitHost = id.host;
    filled.push('gitHost');
  }
  if (!cfg.project.slug && id.project) {
    cfg.project.slug = id.project;
    filled.push('slug');
  }

  if (filled.length === 0) {
    return { filled: [] };
  }

  writeFileSync(join(root, 'brain.config.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  return { filled };
}

// Main-module guard: run as `node scripts/lib/brain-config.mjs ensure`
if (process.argv[1] === __filename && process.argv[2] === 'ensure') {
  const result = ensureProjectIdentity();
  if (result.filled.length > 0) {
    try {
      const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      for (const key of result.filled) {
        const value = key === 'gitHost' ? cfg.project.gitHost : cfg.project.slug;
        console.log(`  ✓ brain.config.json: ${key} = ${value}`);
      }
    } catch {}
  }
}
