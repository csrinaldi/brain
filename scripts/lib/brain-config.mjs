// brain-config.mjs — Shared loader for brain.config.json.
//
// Reads and parses brain.config.json from the repository root and returns the
// parsed object. All scripts that need project identity values (gitHost,
// gitProjectId, slug, etc.) import this instead of duplicating the logic.
//
// Usage:
//   import { loadBrainConfig } from './lib/brain-config.mjs';
//   const config = loadBrainConfig();
//   const { gitHost, gitProjectId, slug, name } = config.project;

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
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
