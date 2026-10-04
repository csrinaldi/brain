// codeowners-drift.mjs — CODEOWNERS as an OPTIONAL mirror of `governance.owners` (ADR-0040, ratified point 8).
//
// The truth is `governance.owners` in brain.config.json; a CODEOWNERS rule for the team config is a convenience that
// makes the forge ask the same people. When it exists it must say the same thing, and when it does not, nothing is
// reported. The drift is a FINDING (diagnoseAxes / governance-status), never a gate.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEAM_CONFIG = 'brain.config.json';
// Where each forge looks, in its own order. GitLab never reads `.github/`; GitHub never reads `.gitlab/`.
const CANDIDATES = Object.freeze({
  github: Object.freeze(['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']),
  gitlab: Object.freeze(['CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS']),
});

const bare = (o) => String(o).trim().replace(/^@/, '').toLowerCase();

/**
 * Does a CODEOWNERS pattern match the root file `brain.config.json`? gitignore-style, as the forges document it:
 * `*` is any run but `/`, `?` one char but `/`, `**` anything (`**\/` any leading directories, `/**` everything inside),
 * a trailing `/` names a directory (never matches a file at the root), and a leading `/` only anchors — for a root
 * path anchored and unanchored patterns agree. A negation (`!`) is not CODEOWNERS syntax and matches nothing.
 */
function matchesTeamConfig(pattern) {
  if (pattern.startsWith('!') || pattern.endsWith('/')) return false;
  let p = pattern.replace(/^\//, '');
  if (p === '') return false;
  let re = '';
  for (let i = 0; i < p.length;) {
    if (p.startsWith('**/', i)) { re += '(?:.*/)?'; i += 3; }
    else if (p.startsWith('/**', i) && i + 3 === p.length) { re += '/.*'; i += 3; }
    else if (p.startsWith('**', i)) { re += '.*'; i += 2; }
    else if (p[i] === '*') { re += '[^/]*'; i += 1; }
    else if (p[i] === '?') { re += '[^/]'; i += 1; }
    else { re += p[i].replace(/[.+^${}()|[\]\\]/g, '\\$&'); i += 1; }
  }
  return new RegExp(`^${re}$`).test(TEAM_CONFIG);
}

/**
 * Pure. The owners of the LAST rule MATCHING the root `brain.config.json` (the forge applies the last matching rule, globs included, not the last that names the file), compared with `governance.owners`.
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
    if (matchesTeamConfig(pattern)) rule = who;
  }
  if (rule === null) return null;
  const mirrored = [...new Set(rule.map(bare))];
  const declared = [...new Set((Array.isArray(owners) ? owners : []).filter((o) => typeof o === 'string' && o.trim() !== '').map(bare))];
  const same = mirrored.length === declared.length && mirrored.every((o) => declared.includes(o));
  return same ? null : { codeowners: mirrored, owners: declared };
}

/**
 * The first CODEOWNERS file THE PROVIDER's forge looks for, as text; `null` when there is none or it cannot be read.
 * GitHub: `.github/`, the root, `docs/`. GitLab: the root, `docs/`, `.gitlab/` — never `.github/`. An unknown provider
 * reads the GitHub order.
 * @param {string} root
 * @param {string} [provider]  'github' | 'gitlab'
 */
export function readCodeowners(root, provider) {
  for (const rel of CANDIDATES[provider] ?? CANDIDATES.github) {
    const p = join(root, rel);
    try {
      if (existsSync(p)) return readFileSync(p, 'utf8');
    } catch { /* unreadable: no mirror to compare */ }
  }
  return null;
}
