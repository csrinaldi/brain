// migrate-v1.mjs — one-shot engram chunk → brain record migration (issue
// #217, C2).
//
// C2a scope (this slice): the DRY-RUN report only — record count, types
// histogram, unparseable-chunk list, rejection report, and the provenance
// recovered/fallback histogram. The REAL (persisting) run — writing
// `records/<yyyy-mm>.jsonl`, moving chunks to `.memory/legacy/`, the
// idempotency abort-if-`records/`-already-has-content guard, and the
// reindex — is C2b (see design.md "dual-write pipeline" decision). This
// module never mutates `.memory/chunks/`.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

import { exportObservation } from './engram-export.mjs';

/**
 * collectChunkObservations() — decompress every `*.jsonl.gz` chunk under
 * `chunksDir` and flatten their `.observations` arrays. NEVER throws: chunks
 * are sorted into exactly one of three buckets, never conflated:
 *
 *   - `unparseable`  — the chunk genuinely failed to gunzip or JSON.parse.
 *     This is real corruption; only THIS bucket may ever feed a future
 *     fail-closed migration gate.
 *   - `emptyObservations` — the chunk parsed FINE as JSON but its
 *     `observations` field is `null`/`undefined`/non-array. Verified against
 *     real data: legitimate sessions/prompts-only chunks take this shape
 *     (`observations: null` with `sessions` populated) — this is NOT
 *     corruption and must never be reported as such.
 *   - (no bucket) — `observations` is a valid array; its entries are
 *     flattened into the returned `observations` list as before.
 *
 * One corrupt chunk must not abort the whole migration report.
 *
 * @param {string} chunksDir
 * @returns {{observations: object[], unparseable: string[], emptyObservations: string[]}}
 */
export function collectChunkObservations(chunksDir) {
  const observations = [];
  const unparseable = [];
  const emptyObservations = [];
  if (!existsSync(chunksDir)) return { observations, unparseable, emptyObservations };

  const files = readdirSync(chunksDir).filter((f) => f.endsWith('.jsonl.gz')).sort();
  for (const file of files) {
    let parsed;
    try {
      const raw = gunzipSync(readFileSync(join(chunksDir, file))).toString('utf8');
      parsed = JSON.parse(raw);
    } catch {
      unparseable.push(file);
      continue;
    }
    if (Array.isArray(parsed.observations)) {
      observations.push(...parsed.observations);
    } else {
      emptyObservations.push(file);
    }
  }
  return { observations, unparseable, emptyObservations };
}

/**
 * buildMigrationReport() — pure: run exportObservation() over every
 * observation and produce the mandatory dry-run report (REQ-MF-6): the
 * exported record count, a types histogram (over successfully exported
 * records only), the count of `scope:personal` skips, the full rejection
 * report (id/title/type/reason per rejected observation), and the provenance
 * histogram (recovered vs fallback — for the CURRENT real store this MUST
 * read `{recovered: 0, fallback: N}`, proving §4 recovery ran and found no
 * prose anywhere, per the verified 0/278 fact).
 *
 * `chunkStats` (optional, from `collectChunkObservations()`) carries the
 * chunk-level buckets so the report's accounting narrative stays honest
 * (MAJOR-3): `emptyObservationsChunks` are provably 0 observations (a
 * legitimate sessions/prompts-only chunk shape, never corruption) and are
 * passed through as-is. `unparseableChunks` chunks NEVER parsed at all, so
 * the observation count they would have contributed is fundamentally
 * unknowable — the report surfaces this EXPLICITLY via `unparseableNote`
 * rather than silently treating it as zero. `records + skippedPersonal +
 * rejected.length` therefore only ever accounts for observations that were
 * actually readable; it is never claimed to be the grand total when any
 * chunk was unparseable.
 *
 * @param {object[]} observations
 * @param {{unparseable?: string[], emptyObservations?: string[]}} [chunkStats]
 * @returns {{recordCount:number, skippedPersonal:number, typesHistogram:Record<string,number>,
 *            provenanceHistogram:{recovered:number, fallback:number},
 *            rejected:{id:string,title:string,type:string,reason:string}[],
 *            records:object[], unparseableChunks:string[], emptyObservationsChunks:string[],
 *            unparseableNote?:string}}
 */
export function buildMigrationReport(observations, chunkStats = {}) {
  const records = [];
  const rejected = [];
  const typesHistogram = {};
  const provenanceHistogram = { recovered: 0, fallback: 0 };
  let skippedPersonal = 0;

  for (const obs of observations) {
    let result;
    try {
      result = exportObservation(obs);
    } catch (err) {
      // A throwing export (e.g. toUtcSeconds() on a malformed created_at)
      // must reject THAT one observation only — one corrupt observation
      // must never abort the whole migration report (MINOR-4).
      rejected.push({
        id: obs.sync_id ?? String(obs.id),
        title: obs.title ?? '',
        type: obs.type,
        reason: err.message,
      });
      continue;
    }
    if (result.skipped) {
      skippedPersonal += 1;
      continue;
    }
    if (result.rejected) {
      rejected.push(result.rejected);
      continue;
    }
    records.push(result.record);
    typesHistogram[result.record.type] = (typesHistogram[result.record.type] ?? 0) + 1;
    provenanceHistogram[result.recovered ? 'recovered' : 'fallback'] += 1;
  }

  const unparseableChunks = chunkStats.unparseable ?? [];
  const emptyObservationsChunks = chunkStats.emptyObservations ?? [];

  const report = {
    recordCount: records.length,
    skippedPersonal,
    typesHistogram,
    provenanceHistogram,
    rejected,
    records,
    unparseableChunks,
    emptyObservationsChunks,
  };

  if (unparseableChunks.length > 0) {
    report.unparseableNote = `${unparseableChunks.length} chunk(s) could not be read — observation count unknown`;
  }

  return report;
}
