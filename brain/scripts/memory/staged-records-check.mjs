#!/usr/bin/env node
// staged-records-check.mjs — the `pre-commit` half of issue #701 (design.md
// Decision 6, proposal.md Decision 4). Refuses a staged `.memory/records/`
// path whose blob is BYTE-IDENTICAL to that path's blob at the upstream base
// — the SAME predicate `dualWriteRecords()` uses (`upstream-records.mjs`), at
// a second call site, never a separate authorship rule.
//
// Shape follows `vcs/actor-check.mjs`: a PURE evaluator (`evaluateStagedRecords`)
// taking plain data, a thin I/O wrapper (`stagedRecordDiff`), and a CLI
// (`main`/entrypoint). Every case is tested against the evaluator; no test
// spawns git.
//
// `pre-commit`, not `pre-push` (design.md Decision 6): `pre-push`'s
// `.memory/` check is WARN-only by an explicit, recorded decision
// (`pre-push:114-119`, ADR-0014 §9) — `memory:share` runs earlier in that same
// hook and churns the manifest, so a hard block there self-blocks the push it
// runs on. After the exporter fix (#701 PR 2) `pre-push`'s own `share` no
// longer produces byte-identical records in the first place, so the pre-push
// case is closed by the exporter, not by a second gate here.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { upstreamRecordEntries } from './lib/upstream-records.mjs';
import { t } from '../i18n/t.mjs';

const ZERO_OID = '0'.repeat(40);

/**
 * evaluateStagedRecords() — PURE. `staged` is `parseStagedDiff()`'s shape
 * (`{path, dstOid, status}[]`); `upstream` is `upstreamRecordEntries()`'s
 * discriminated result — the SAME object the exporter reads, never a second
 * lookup for the same fact.
 *
 * Rule (design.md Decision 6):
 *   - `upstream.ok !== true`  → PASS + a note. The gate never blocks on a
 *     question it could not ask — the same degradation direction the
 *     exporter takes on an unavailable upstream.
 *   - `dstOid === ZERO_OID`   → ALLOW. A staged deletion is a different
 *     concern than a byte-identical re-commit.
 *   - `dstOid === upstream.byPath.get(path)` → REFUSE. Byte-identity compared
 *     as OID equality — zero blob reads, same content-addressed argument
 *     Decision 1 makes for the exporter.
 *   - anything else (new path, divergent bytes at a known path) → ALLOW.
 *
 * @param {object} args
 * @param {Array<{path: string, dstOid: string, status: string}>} args.staged
 * @param {{ok:true, byPath:Map<string,string>}|{ok:false, reason:string}} args.upstream
 * @returns {{level: 'pass'|'fail', offending: string[], note?: string}}
 */
export function evaluateStagedRecords({ staged = [], upstream } = {}) {
  if (!upstream || upstream.ok !== true) {
    return {
      level: 'pass',
      offending: [],
      note: upstream?.reason ?? 'upstream lookup unavailable — nothing was checked',
    };
  }

  const offending = [];
  for (const entry of staged) {
    if (!entry?.path || !entry.dstOid) continue;
    if (entry.dstOid === ZERO_OID) continue; // a deletion — allow
    if (upstream.byPath.get(entry.path) === entry.dstOid) offending.push(entry.path);
  }
  return { level: offending.length > 0 ? 'fail' : 'pass', offending };
}

/**
 * parseStagedDiff() — PURE. Parses `git diff --cached --raw -z --no-abbrev`
 * output: `:<srcmode> <dstmode> <srcoid> <dstoid> <status>` NUL, `<path>` NUL
 * per entry (a rename/copy carries a SECOND path token, consumed and
 * discarded — `.memory/records/*.jsonl` is never renamed by any in-tree
 * producer, so only the destination path is relevant here).
 *
 * @param {string} text
 * @returns {Array<{path: string, dstOid: string, status: string}>}
 */
export function parseStagedDiff(text) {
  const out = [];
  if (typeof text !== 'string' || text.length === 0) return out;

  const tokens = text.split('\0').filter((tk) => tk.length > 0);
  let i = 0;
  while (i < tokens.length) {
    const header = tokens[i++];
    if (!header.startsWith(':')) continue; // malformed — not a diff-raw header
    const parts = header.slice(1).split(' ');
    if (parts.length < 5) continue;
    const dstOid = parts[3];
    const status = parts[4];
    const path = tokens[i++];
    if (path === undefined) break;
    if (/^[RC]/.test(status)) i++; // rename/copy carries a second (old) path — discard it
    out.push({ path, dstOid, status });
  }
  return out;
}

/**
 * stagedRecordDiff() — I/O wrapper: `git diff --cached --raw -z --no-abbrev
 * -- .memory/records`, parsed by `parseStagedDiff`. `--no-abbrev` is
 * load-bearing: git's default abbreviated raw-diff oids do not compare equal
 * to `upstream-records.mjs`'s full 40-hex `ls-tree` oids, and a false
 * "divergent" from a truncated oid would be the over-refusal axis M6 guards.
 *
 * @param {object} args
 * @param {string} args.root
 * @param {typeof spawnSync} [args._spawn]
 * @returns {{ok:true, staged: Array<{path:string,dstOid:string,status:string}>}|{ok:false, reason:string}}
 */
export function stagedRecordDiff({ root, _spawn = spawnSync }) {
  let result;
  try {
    result = _spawn('git', ['diff', '--cached', '--raw', '-z', '--no-abbrev', '--', '.memory/records'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1e9,
    });
  } catch (err) {
    return { ok: false, reason: `git diff threw — ${err.message}` };
  }
  if (result?.error) return { ok: false, reason: `git diff could not run — ${result.error.message}` };
  if (typeof result?.status !== 'number' || result.status !== 0) {
    const detail = result?.stderr ? ` — ${String(result.stderr).trim()}` : '';
    return { ok: false, reason: `git diff exited ${result?.status ?? 'with no status'}${detail}` };
  }
  return { ok: true, staged: parseStagedDiff(result.stdout ?? '') };
}

/**
 * runStagedRecordsCheck() — wires the SAME `upstream-records.mjs` lookup the
 * exporter uses (no second `ls-tree` spawn's worth of policy, one shared
 * module) to the staged-side diff, and evaluates. Seam-injectable for tests;
 * production defaults call the real git binary.
 *
 * @param {object} [opts]
 * @param {string} [opts.root]
 * @param {object} [opts.env]
 * @param {object} [opts.config]
 * @param {typeof spawnSync} [opts._spawn]
 * @param {typeof upstreamRecordEntries} [opts._upstreamRecordEntries]
 * @param {typeof stagedRecordDiff} [opts._stagedRecordDiff]
 * @returns {{level:'pass'|'fail', offending:string[], note?:string}}
 */
export function runStagedRecordsCheck({
  root = process.cwd(),
  env = process.env,
  config = {},
  _spawn = spawnSync,
  _upstreamRecordEntries = upstreamRecordEntries,
  _stagedRecordDiff = stagedRecordDiff,
} = {}) {
  const upstream = _upstreamRecordEntries({ root, env, config, _spawn });
  const diff = _stagedRecordDiff({ root, _spawn });
  if (!diff.ok) {
    // Symmetric with the upstream-unavailable branch: a question the gate
    // could not even ASK must never become a block either.
    return { level: 'pass', offending: [], note: `could not read staged .memory/records/ changes — ${diff.reason}` };
  }
  return evaluateStagedRecords({ staged: diff.staged, upstream });
}

/**
 * main() — runs the check, prints the verdict, returns the exit code. Kept
 * separate from `process.exit()` so it stays testable (mirrors
 * `actor-check.mjs#main`/`check-refs.mjs`'s own shape).
 *
 * The refusal message is the LOSSLESS remedy, verbatim (design.md Decision 6
 * "provably lossless" — task 3.4): `git restore --staged` unstages the path
 * (the byte-identical trunk copy is untouched); if that leaves the path
 * untracked (it was never committed here before), the working-tree file is
 * also safe to `rm` — the exact same bytes are already durable upstream.
 * Printed to STDOUT (this is `pre-commit`, run interactively, never piped
 * through a discarding redirect the way `pre-push`/`post-merge` are — no
 * stream-discipline rule applies here, design.md Decision 6's own note).
 *
 * @param {object} [deps]
 * @returns {Promise<0|1>}
 */
export async function main(deps = {}) {
  const result = runStagedRecordsCheck(deps);

  if (result.note) {
    console.log(`staged-records-check: ${await t('memory.stagedRecordsCheck.unavailable', { note: result.note })}`);
  }

  if (result.level === 'fail') {
    console.log(`staged-records-check: ${await t('memory.stagedRecordsCheck.refused', { count: result.offending.length })}`);
    for (const path of result.offending) {
      console.log(`  ${path}`);
    }
    console.log(await t('memory.stagedRecordsCheck.remedy', {
      paths: result.offending.join(' '),
    }));
    return 1;
  }

  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main());
}
