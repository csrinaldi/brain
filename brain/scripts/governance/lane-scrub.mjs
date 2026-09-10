// lane-scrub.mjs — required, non-waivable secret check (#905, spec.md
// "lane-scrub is a required, non-waivable secret check", design.md A5/A6, C1).
//
// SOURCE GUARD (design A5's deciding argument): this file NEVER imports
// governance-tiers.mjs. ADR-0034 calls lane-scrub non-waivable; if it routed
// through run-check.mjs's main() and a GATE_MATRIX cell, non-waivability
// would be a property of a matrix a future tier edit could soften. A
// standalone main() that never reaches the tier module makes "fail-closed at
// every tier, no flag" a property of the code — lane-scrub.test.mjs pins the
// absent import by reading this file's own source.
//
// DEPARTURE FROM D3's WORDING (design A6, raised as an open question): every
// other required context prints "not a lane — nothing to check" on a
// non-lane PR. lane-scrub does not — it needs no lane input at all. It scans
// every added `.memory/records/*.jsonl` path on EVERY PR, lane or not,
// because the five #890 feature-PR surfaces are still live: contributors are
// still told to commit records on feature branches
// (vcs/contributor-scaffold.mjs:274), and a scrub that only looked at lane
// PRs would leave that transition window unguarded. Revert path (one
// condition): gate the added-paths filter on classifyLane(...).laneBranch.

import { execFileSync as realExecFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LANE_PATH_RE } from './checks/lane.mjs';
import { resultToExit } from './postmerge/exit-codes.mjs';
import {
  compilePatterns,
  resolveSecretConfig,
  scanTextForSecrets,
} from '../memory/lib/secret-scrub.mjs';
import { loadBrainConfig } from '../lib/brain-config.mjs';
import { loadContext } from '../vcs/ci-context.mjs';

/** Same shape as lane-paths.mjs's default — the ADDED half of a three-dot diff. */
function buildDefaultDiffNameOnlyAdded(ctx, exec) {
  return () => {
    const base = ctx.baseSha;
    const head = ctx.headSha;
    if (!base || !head) {
      throw new Error('BASE_SHA/HEAD_SHA not set — cannot compute diff');
    }
    try {
      const out = exec('git', ['diff', '--diff-filter=A', '--name-only', `${base}...${head}`], { encoding: 'utf8' });
      return out.split('\n').filter(Boolean);
    } catch (err) {
      throw new Error(`git diff failed: ${err.message}`);
    }
  };
}

function defaultReadConfig() {
  try {
    return loadBrainConfig();
  } catch {
    return {};
  }
}

/**
 * evaluateLaneScrub() — tier-blind by construction (design A5/C1). Filters
 * `addedFiles` down to `.memory/records/*.jsonl` paths (LANE_PATH_RE, no lane
 * branch consulted at all — A6), then runs the shared secret scanner
 * (`memory/lib/secret-scrub.mjs`) over each one via an injectable `readFile`
 * seam (pure: no `fs` import reached from inside this function). Destructures
 * `{pattern, lineNumber}` from a hit and drops `.line` — the matched text
 * itself is never surfaced (C1's own output discipline).
 *
 * @param {{ addedFiles?: string[]|null, config?: object, readFile: (path: string) => string }} args
 * @returns {{ pass: boolean, reason?: string }}
 */
export function evaluateLaneScrub({ addedFiles, config, readFile }) {
  const recordPaths = (addedFiles ?? []).filter((path) => LANE_PATH_RE.test(path));
  if (recordPaths.length === 0) {
    return { pass: true, reason: 'no added record paths — nothing to scan' };
  }

  const { patternSources, allowPatternSources } = resolveSecretConfig(config);
  const patterns = compilePatterns(patternSources);
  const allowPatterns = compilePatterns(allowPatternSources);

  for (const path of recordPaths) {
    const text = readFile(path);
    const hit = scanTextForSecrets(text, patterns, allowPatterns);
    if (hit) {
      // {pattern, lineNumber} only — `hit.line` is dropped, never printed.
      return {
        pass: false,
        reason: `lane-scrub: secret pattern matched in ${path} — pattern=${JSON.stringify(hit.pattern)} lineNumber=${hit.lineNumber}`,
      };
    }
  }
  return { pass: true };
}

/**
 * main() — thin runner. Runs and reports on EVERY PR (never gated on a lane
 * branch — A6). An uncomputable added-diff fails closed (2): C1 is
 * non-waivable, so "cannot verify" must never read as "nothing to scan".
 *
 * @param {{ ctx?: object, diffNameOnlyAdded?: Function, execFileSync?: Function, readConfig?: () => object, readFile?: (path: string) => string }} [deps]
 * @returns {Promise<0|1|2>}
 */
export async function main(deps = {}) {
  const ctx = deps.ctx ?? {};
  const exec = deps.execFileSync ?? realExecFileSync;
  const diffNameOnlyAdded = deps.diffNameOnlyAdded ?? buildDefaultDiffNameOnlyAdded(ctx, exec);
  const readConfig = deps.readConfig ?? defaultReadConfig;
  const readFile = deps.readFile ?? ((path) => readFileSync(path, 'utf8'));

  let addedFiles;
  try {
    addedFiles = diffNameOnlyAdded();
  } catch (err) {
    const result = {
      pass: false,
      uncomputable: true,
      reason: `lane-scrub: cannot compute diff — failing closed (uncomputable): ${err.message}`,
    };
    console.log(result.reason);
    return resultToExit(result);
  }

  const config = readConfig();
  let result;
  try {
    result = evaluateLaneScrub({ addedFiles, config, readFile });
  } catch (err) {
    // An added record that cannot be read (e.g. deleted between the diff and
    // this run) is UNCOMPUTABLE, never a false violation: C1 is non-waivable,
    // so "cannot verify" must never surface as "verified clean" (1 would be
    // just as wrong the other way — it would report a secret that was never
    // actually scanned).
    result = {
      pass: false,
      uncomputable: true,
      reason: `lane-scrub: cannot read an added record — failing closed (uncomputable): ${err.message}`,
    };
  }
  if (result.reason) console.log(result.reason);
  return resultToExit(result);
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ctx = await loadContext();
  process.exit(await main({ ctx }));
}
