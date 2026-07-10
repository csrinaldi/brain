// secret-scrub.mjs — fail-closed secret scanner for `memory:share` (issue #214, C1b).
//
// Scans ONLY the content materialized in the CURRENT `memory:share` run — never
// the whole store (C1a design.md Decision 5). Today "materialized this run"
// means the engram gzip chunks `share()` writes to `.memory/chunks/*.jsonl.gz`
// (see backends/engram.mjs#scrubMaterializedChunks) — a deliberate pre-C2 scrub
// target: C2 re-points brain-owned durable I/O at `records/`, and the scanner
// moves with it then. Fails closed: a match blocks the run (non-zero exit) and
// names the matched pattern + file:line. There is NO `--no-scrub` flag — the
// only bypass is `governance.memorySecretAllowPatterns`, a committed, reviewable
// allowlist (never an ephemeral local CLI flag).

import { gunzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Default secret patterns (regex source strings). Additive only: a consumer's
 * `governance.memorySecretPatterns` EXTENDS this list — see resolveSecretConfig.
 * Mirrors the analogous list embedded in config-migrations.mjs's `0.5.0`
 * migration `defaults`; secret-scrub.test.mjs and installer.test.mjs both
 * guard the two from drifting apart.
 */
export const DEFAULT_SECRET_PATTERNS = [
  'ghp_[A-Za-z0-9]{20,}',
  'github_pat_[A-Za-z0-9_]{20,}',
  'glpat-[A-Za-z0-9_-]{20,}',
  'AKIA[0-9A-Z]{16}',
  '-----BEGIN [A-Z ]*PRIVATE KEY-----',
];

/** No allowlist entries ship by default — every entry is an explicit, reviewable opt-out. */
export const DEFAULT_SECRET_ALLOW_PATTERNS = [];

/**
 * compilePatterns() — turn regex source strings into RegExp objects.
 * Throws on an invalid pattern (fail closed — a broken config entry must
 * never silently disable scanning for the other patterns).
 *
 * @param {string[]} sources
 * @returns {RegExp[]}
 */
export function compilePatterns(sources) {
  return sources.map((src) => new RegExp(src));
}

/**
 * resolveSecretConfig() — merge a consumer's `brain.config.json` governance
 * keys with the defaults. Additive only (mirrors config-migrations.mjs's
 * `mergeDefaults` convention): the consumer list EXTENDS, never replaces or
 * shrinks, the default pattern set. The allowlist has no default members —
 * it is config-only, by design (Decision 5).
 *
 * @param {{governance?: {memorySecretPatterns?: string[], memorySecretAllowPatterns?: string[]}}} [config]
 * @returns {{patternSources: string[], allowPatternSources: string[]}}
 */
export function resolveSecretConfig(config) {
  const configured = Array.isArray(config?.governance?.memorySecretPatterns)
    ? config.governance.memorySecretPatterns
    : [];
  const allow = Array.isArray(config?.governance?.memorySecretAllowPatterns)
    ? config.governance.memorySecretAllowPatterns
    : [];
  const patternSources = [...new Set([...DEFAULT_SECRET_PATTERNS, ...configured])];
  const allowPatternSources = [...new Set([...DEFAULT_SECRET_ALLOW_PATTERNS, ...allow])];
  return { patternSources, allowPatternSources };
}

/**
 * scanTextForSecrets() — line-scan `text` against `patterns`. A line whose
 * match is ALSO matched by an `allowPatterns` entry is treated as allowed and
 * skipped (the sole bypass — no CLI flag). Returns the FIRST hit (fail fast)
 * or `null` if none.
 *
 * @param {string} text
 * @param {RegExp[]} patterns
 * @param {RegExp[]} [allowPatterns]
 * @returns {{pattern: string, lineNumber: number, line: string} | null}
 */
export function scanTextForSecrets(text, patterns, allowPatterns = []) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        const allowed = allowPatterns.some((allow) => allow.test(line));
        if (allowed) continue;
        return { pattern: pattern.source, lineNumber: i + 1, line };
      }
    }
  }
  return null;
}

/**
 * scrubChunkFile() — decompress an engram chunk (`.jsonl.gz`, a gzip of ONE
 * JSON object per ADR-0017's empirical inspection), pretty-print it so a
 * match has a meaningful line number, and scan for secrets.
 *
 * Defense-in-depth (cutover finding 7, id:388): guards existence before the
 * read. The primary fix excludes porcelain deletions in
 * `_defaultChangedChunkFiles` (engram.mjs), but a caller could still hand this
 * function a path that no longer exists (e.g. a race between `git status` and
 * the read) — treat "already gone" as "nothing to scan" rather than an ENOENT
 * throw.
 *
 * @param {string} chunkPath
 * @param {RegExp[]} patterns
 * @param {RegExp[]} [allowPatterns]
 * @returns {{pattern: string, lineNumber: number, line: string} | null}
 */
export function scrubChunkFile(chunkPath, patterns, allowPatterns = []) {
  if (!existsSync(chunkPath)) return null;
  const gz = readFileSync(chunkPath);
  const raw = gunzipSync(gz).toString('utf8');
  let pretty;
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // Not parseable JSON — scan the raw decompressed bytes rather than silently skipping.
    pretty = raw;
  }
  return scanTextForSecrets(pretty, patterns, allowPatterns);
}

/**
 * scrubRecordsFile() — read a plaintext `.memory/records/*.jsonl` file (one
 * physical JSON line per record, R1 — see format.mjs) and scan it for
 * secrets. Unlike scrubChunkFile(), there is NO gzip step: REQ-C2B1-2's
 * re-point target (issue #221, C2b-1) is already plaintext. Mirrors
 * scrubChunkFile()'s signature/return exactly.
 *
 * @param {string} recordsPath
 * @param {RegExp[]} patterns
 * @param {RegExp[]} [allowPatterns]
 * @returns {{pattern: string, lineNumber: number, line: string} | null}
 */
export function scrubRecordsFile(recordsPath, patterns, allowPatterns = []) {
  const text = readFileSync(recordsPath, 'utf8');
  return scanTextForSecrets(text, patterns, allowPatterns);
}
