// codeowners-drift.mjs — CODEOWNERS as an OPTIONAL mirror of `governance.owners` (ADR-0040, ratified point 8).
//
// The truth is `governance.owners` in brain.config.json; a CODEOWNERS rule for the team config is a convenience that
// makes the forge ask the same people. When it exists it must say the same thing, and when it does not, nothing is
// reported. The drift is a FINDING (diagnoseAxes / governance-status), never a gate.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEAM_CONFIG = 'brain.config.json';
const CANDIDATES = Object.freeze(['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS']);

const bare = (o) => String(o).trim().replace(/^@/, '').toLowerCase();

/**
 * Pure. The owners of the LAST rule naming the root `brain.config.json`, compared with `governance.owners`.
 * @param {string|null|undefined} text  CODEOWNERS text, or nothing when there is no file.
 * @param {unknown} owners  `governance.owners`.
 * @returns {null|{codeowners: string[], owners: string[]}}  `null` when there is no such rule or it agrees.
 */
export function codeownersDrift(text, owners) {
  if (typeof text !== 'string' || text === '') return null;
  let rule = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (line === '') continue;
    const [pattern, ...who] = line.split(/\s+/);
    if (pattern.replace(/^\//, '') === TEAM_CONFIG) rule = who;
  }
  if (rule === null) return null;
  const mirrored = [...new Set(rule.map(bare))];
  const declared = [...new Set((Array.isArray(owners) ? owners : []).filter((o) => typeof o === 'string' && o.trim() !== '').map(bare))];
  const same = mirrored.length === declared.length && mirrored.every((o) => declared.includes(o));
  return same ? null : { codeowners: mirrored, owners: declared };
}

/** The first CODEOWNERS file the forges look for, as text; `null` when there is none or it cannot be read. */
export function readCodeowners(root) {
  for (const rel of CANDIDATES) {
    const p = join(root, rel);
    try {
      if (existsSync(p)) return readFileSync(p, 'utf8');
    } catch { /* unreadable: no mirror to compare */ }
  }
  return null;
}
