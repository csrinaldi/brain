// memory-manifest.mjs — restore .memory/manifest.json churn (issue #138, design §1.3).
//
// .memory/manifest.json is rewritten by `engram sync --export` (a derived
// index, not user content). Discarding uncommitted local churn before a git
// merge is safe and prevents the "your local changes would be overwritten"
// abort. Extracted verbatim from day-start.mjs's pre-sync block so
// `day:start` and `session:start` share one source of truth (REQ-3, REQ-9).

import { spawnSync } from 'node:child_process';

const MANIFEST = '.memory/manifest.json';

/**
 * Discards uncommitted churn in `.memory/manifest.json` only.
 * NEVER throws. NEVER touches any other path.
 *
 * @param {string} cwd  Repo root to run git in.
 * @param {{ _spawn?: typeof spawnSync }} [opts]  Injectable spawn seam for tests.
 * @returns {{ restored: boolean }}
 */
export function restoreManifestChurn(cwd, { _spawn = spawnSync } = {}) {
  try {
    const status = _spawn('git', ['status', '--porcelain', '--', MANIFEST], { cwd, encoding: 'utf8' });
    if (status.stdout?.trim()) {
      _spawn('git', ['restore', '--', MANIFEST], { cwd, encoding: 'utf8' });
      return { restored: true };
    }
    return { restored: false };
  } catch {
    return { restored: false };
  }
}
