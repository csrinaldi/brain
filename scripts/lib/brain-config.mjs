// brain-config.mjs — Shared loader and writer for brain.config.json.
//
// Reads and parses brain.config.json from the repository root and returns the
// parsed object. All scripts that need project identity values (gitHost,
// gitProjectId, slug, name, etc.) import this instead of duplicating the logic.
//
// Usage:
//   import { loadBrainConfig, ensureProjectIdentity, ensureBrainConfig } from './lib/brain-config.mjs';
//   const config = loadBrainConfig();
//   const { gitHost, gitProjectId, slug, name } = config.project;

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { originIdentity } from '../vcs/lib/repo.mjs';
import { mergeDefaults } from './installer.mjs';
import { migrations } from '../../brain/core/config-migrations.mjs';

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

/**
 * Maps a git host to a VCS provider name.
 *
 * - 'github.com'           → 'github'
 * - any host containing 'gitlab' (e.g. 'gitlab.com', 'gitlab.example.com') → 'gitlab'
 * - anything else          → ''
 *
 * Pure function — no side effects.
 *
 * @param {string|null|undefined} host
 * @returns {string}
 */
export function providerFromHost(host) {
  if (!host) return '';
  if (host === 'github.com') return 'github';
  if (host.includes('gitlab')) return 'gitlab';
  return '';
}

/**
 * Builds the full default brain.config.json by applying all migrations in order
 * onto an empty object. Sets schemaVersion to the latest migration version.
 *
 * @returns {object}
 */
function buildDefaultConfig() {
  const ordered = [...migrations].sort((a, b) => {
    const va = a.version.split('.').map(Number);
    const vb = b.version.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (va[i] < vb[i]) return -1;
      if (va[i] > vb[i]) return 1;
    }
    return 0;
  });
  let cfg = {};
  for (const m of ordered) {
    if (m.defaults) {
      cfg = mergeDefaults(cfg, m.defaults);
    } else if (typeof m.migrate === 'function') {
      cfg = m.migrate(cfg, { mergeDefaults });
    }
  }
  cfg.schemaVersion = ordered.at(-1)?.version ?? '0.0.0';
  // Deep-clone to avoid mutating the source migration defaults (they are shared
  // references returned by mergeDefaults when keys are first seen). Config values
  // are all primitives, so JSON round-trip is safe and fast.
  return JSON.parse(JSON.stringify(cfg));
}

/**
 * Ensures brain.config.json exists and has project identity fields populated.
 *
 * - If the file DOES NOT EXIST: creates it with the full default schema derived
 *   from all config-migrations, sets project.gitHost / project.slug from the
 *   git origin, and sets vcs.provider via providerFromHost(). Returns
 *   { created: true, filled: string[], provider: string }.
 *
 * - If the file EXISTS: behaves like ensureProjectIdentity — fills empty
 *   gitHost / slug from the origin without touching other values (including
 *   vcs.provider). Returns { created: false, filled: string[], provider: string }.
 *
 * Never throws: degrades to a no-op if the origin is absent or the file is
 * unwritable.
 *
 * @param {string} root - Repository root (defaults to this module's repo root).
 * @param {{ identity?: { host: string|null, project: string|null }, write?: boolean }} options
 *   - identity: injected origin identity for testing; omit to call originIdentity().
 *   - write: set false to skip writing (dry-run). Defaults to true.
 * @returns {{ created: boolean, filled: string[], provider: string }}
 */
export function ensureBrainConfig(root = REPO_ROOT, { identity, write = true } = {}) {
  const configPath = join(root, 'brain.config.json');

  // Resolve origin identity once.
  const id = identity !== undefined ? identity : originIdentity();
  const hasIdentity = id && (id.host || id.project);

  const fileExists = existsSync(configPath);

  if (!fileExists) {
    // CREATE: build full default config from migrations.
    const cfg = buildDefaultConfig();

    const filled = [];
    if (hasIdentity) {
      if (id.host) {
        cfg.project.gitHost = id.host;
        filled.push('gitHost');
      }
      if (id.project) {
        cfg.project.slug = id.project;
        filled.push('slug');
      }
      cfg.vcs.provider = providerFromHost(id.host);
    }

    if (write) {
      try {
        writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
      } catch {
        // Unwritable directory — degrade silently.
        return { created: false, filled: [], provider: '' };
      }
    }

    return { created: true, filled, provider: cfg.vcs.provider };
  }

  // EXISTS: fill empty gitHost / slug only (preserve provider and all other values).
  let cfg;
  try {
    const raw = readFileSync(configPath, 'utf8');
    cfg = JSON.parse(raw);
  } catch {
    return { created: false, filled: [], provider: '' };
  }

  if (!hasIdentity) {
    return { created: false, filled: [], provider: cfg.vcs?.provider ?? '' };
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

  if (filled.length > 0 && write) {
    try {
      writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    } catch {
      return { created: false, filled: [], provider: cfg.vcs?.provider ?? '' };
    }
  }

  return { created: false, filled, provider: cfg.vcs?.provider ?? '' };
}

// Main-module guard: run as `node scripts/lib/brain-config.mjs ensure`
if (process.argv[1] === __filename && process.argv[2] === 'ensure') {
  const result = ensureBrainConfig();
  if (result.created) {
    console.log(`  ✓ brain.config.json: created (provider=${result.provider || '?'})`);
    try {
      const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      if (cfg.project?.gitHost)  console.log(`  ✓ brain.config.json: gitHost = ${cfg.project.gitHost}`);
      if (cfg.project?.slug)     console.log(`  ✓ brain.config.json: slug = ${cfg.project.slug}`);
    } catch {}
  } else if (result.filled.length > 0) {
    try {
      const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      for (const key of result.filled) {
        const value = key === 'gitHost' ? cfg.project.gitHost : cfg.project.slug;
        console.log(`  ✓ brain.config.json: ${key} = ${value}`);
      }
    } catch {}
  }
}
