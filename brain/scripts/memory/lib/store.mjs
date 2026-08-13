// store.mjs — thin I/O layer over `.memory/records/` + `.memory/index.jsonl`.
//
// Implements the durable-store side of the C0 contract
// (openspec/changes/issue-201-memory-format/spec.md, REQ-MF-3/REQ-MF-4): all
// filesystem access lives here; the schema, hashing, and validation logic is
// pure and lives in ./format.mjs.
//
// Degenerate-state contract (task C1a.2b):
//   (a) records/ absent or empty → empty index, exit 0 (no throw), no warning.
//       Never touches a sibling `.memory/chunks/*.jsonl.gz` (legacy transport).
//   (b) a corrupt/invalid physical line → FAILS CLOSED, throwing with the
//       file name and 1-based line number in the message. Never a silent skip.
//   (c) a repeated `id` (issue #574) → DEDUPLICATED AND REPORTED when the
//       repeated lines agree; REFUSED, naming both lines, when they disagree.
//       The rule and its justification live in ./duplicates.mjs.

import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  parseRecordLine,
  buildIndexEntry,
  serializeIndex,
  serializeRecord,
  validateWritableRecord,
  computeRecordId,
  canonicalJson,
} from './format.mjs';
import { summarizeDuplicates } from './duplicates.mjs';

/**
 * appendRecord() — validate, then append one record as exactly one physical
 * JSONL line to `records/<yyyy-mm>.jsonl` (month derived from `record.ts`).
 * Fails closed: an invalid record throws and nothing is written.
 *
 * Validates with `validateWritableRecord()`, not `validateRecord()`: this is
 * the ONE chokepoint through which every in-tree producer creates a record
 * (`plainfiles.mjs#save`, `engram.mjs#dualWriteRecords`, `migrate-v1.mjs`), so
 * it is where shape rules can be enforced WITHOUT a read-path rejection
 * bricking an already-populated consumer store (see format.mjs's read/write
 * note, issue #404).
 *
 * @param {object} record
 * @param {{recordsDir: string}} opts
 * @returns {{file: string, filename: string}}
 */
export function appendRecord(record, { recordsDir }) {
  const { valid, errors } = validateWritableRecord(record);
  if (!valid) throw new Error(`appendRecord: invalid record — ${errors.join('; ')}`);
  const filename = `${record.ts.slice(0, 7)}.jsonl`;
  const file = join(recordsDir, filename);
  mkdirSync(recordsDir, { recursive: true });
  appendFileSync(file, serializeRecord(record) + '\n', 'utf8');
  return { file, filename };
}

/**
 * rebuildIndex() — regenerate `.memory/index.jsonl` purely from `.memory/records/`
 * (REQ-MF-4). Deterministic and idempotent: deleting the index and re-running
 * reproduces it byte-for-byte (the property test in store.test.mjs).
 *
 * This is the store's ONE fail-closed integrity gate, and since issue #574 it
 * answers BOTH failure modes of a content-addressed log instead of one:
 *
 *   * a line whose bytes do not hash to its `id`  → REFUSED (tamper, #214).
 *   * the same `id` on lines that AGREE           → collapsed, and RETURNED in
 *     `duplicates` so every caller can say so out loud (#574).
 *   * the same `id` on lines that DISAGREE        → REFUSED, naming both lines.
 *     `id` does not hash `source`, so this is reachable without tampering, and
 *     the old Map-keyed collapse resolved it last-wins in silence.
 *
 * See ./duplicates.mjs for why a merge-born duplicate is reported rather than
 * refused, while a disagreeing one is refused rather than reported.
 *
 * @param {{recordsDir: string, indexPath: string}} opts
 * @returns {{count: number, duplicates: {ids: number, lines: number,
 *   groups: Array<{id: string, occurrences: string[]}>}}}
 *   `count` is unique ids (the index length); `duplicates.lines` is how many
 *   physical lines longer than the index the store is.
 * @throws {Error} on a corrupt/invalid physical line, an id mismatch, or a
 *   disagreeing duplicate — every message includes `<filename>:<1-based line
 *   number>` so the failure is locatable.
 */
export function rebuildIndex({ recordsDir, indexPath }) {
  const entries = new Map();
  /** id → ['<file>:<line>', …] for every physical line carrying that id. */
  const occurrences = new Map();
  /** id → the canonical bytes of the FIRST line carrying it (divergence check). */
  const firstSeen = new Map();
  const filenames = existsSync(recordsDir)
    ? readdirSync(recordsDir).filter((f) => f.endsWith('.jsonl')).sort()
    : [];

  for (const filename of filenames) {
    const raw = readFileSync(join(recordsDir, filename), 'utf8');
    const physicalLines = raw.split('\n');
    for (let i = 0; i < physicalLines.length; i++) {
      const line = physicalLines[i];
      if (line.trim() === '') continue; // skip any blank line (trailing newline / spacing); a non-blank malformed line fails closed below
      const at = `${filename}:${i + 1}`;
      let record;
      try {
        record = parseRecordLine(line);
      } catch (err) {
        throw new Error(`rebuildIndex: corrupt record at ${at} — ${err.message}`);
      }
      // id-integrity hardening (issue #214, C1b): recompute the id via the ONE
      // shared computeRecordId (never a second hasher) from the record's own
      // read fields. A legitimate record already has `title` folded into
      // `content` and absent optionals omitted (R3), so computeRecordId(record)
      // reproduces the stored id exactly. A mismatch means the line was
      // tampered with or is stale — fail closed with the same file:line
      // convention as the corrupt-line path above.
      const recomputedId = computeRecordId(record);
      if (recomputedId !== record.id) {
        throw new Error(
          `rebuildIndex: id mismatch at ${at} — stored id '${record.id}' does not match the recomputed id '${recomputedId}' (tampered or stale record)`,
        );
      }

      // Duplicate handling (issue #574). Compared as RFC 8785 canonical bytes,
      // not as the raw line: two lines that differ only in key order or
      // whitespace ARE the same record, and calling those a divergence would
      // refuse a store a different-but-conformant writer produced.
      const canonical = canonicalJson(record);
      const prior = firstSeen.get(record.id);
      if (prior === undefined) {
        firstSeen.set(record.id, { canonical, at });
        occurrences.set(record.id, [at]);
      } else {
        if (prior.canonical !== canonical) {
          // The tamper answer, for the same reason: two lines claim one id and
          // the store cannot know which is true. Only fields OUTSIDE the hash
          // can differ here (`source`, or an unknown extra key) — a difference
          // in any hashed field would have failed the id-integrity check above.
          throw new Error(
            `rebuildIndex: divergent duplicate at ${at} — id '${record.id}' was already read at ${prior.at} `
            + 'with different bytes. Two lines share one id but disagree outside the hashed fields '
            + '(`source` is not hashed), so collapsing them would silently drop one. Refusing to guess '
            + 'which is true — delete the wrong line, or keep both by giving one a distinct hashed field.',
          );
        }
        occurrences.get(record.id).push(at);
      }
      entries.set(record.id, buildIndexEntry(record, filename));
    }
  }

  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, serializeIndex(entries), 'utf8');
  return { count: entries.size, duplicates: summarizeDuplicates(occurrences) };
}

/**
 * readRecordIds() — read the set of record `id`s currently present in
 * `records/` (issue #221 fix pass, BLOCKER). `records/` is the AUTHORITATIVE
 * dedup source — not the derived `index.jsonl` — since it is the append-only
 * log dualWriteRecords() must never write a duplicate physical line into.
 *
 * Same degenerate-state contract as rebuildIndex(): an absent/empty
 * `records/` returns an empty Set, never throws. A corrupt physical line is
 * silently skipped here — this function is dedup INPUT, not the fail-closed
 * integrity gate (that remains rebuildIndex()'s job, which still fails closed
 * on the exact same line the next time it runs).
 *
 * @param {{recordsDir: string}} opts
 * @returns {Set<string>}
 */
export function readRecordIds({ recordsDir }) {
  const ids = new Set();
  if (!existsSync(recordsDir)) return ids;

  const filenames = readdirSync(recordsDir).filter((f) => f.endsWith('.jsonl'));
  for (const filename of filenames) {
    const raw = readFileSync(join(recordsDir, filename), 'utf8');
    for (const line of raw.split('\n')) {
      if (line.trim() === '') continue;
      try {
        const record = JSON.parse(line);
        if (record && typeof record.id === 'string') ids.add(record.id);
      } catch {
        continue; // corrupt line — not this function's fail-closed gate
      }
    }
  }
  return ids;
}

/**
 * readRecordObservations() — TRANSITIONAL reader for the governance
 * memory-gate (issue #222 cutover fix), mirroring the chunk-reader's contract
 * (`../lib/chunk-reader.mjs`'s `readChunkObservations`): returns the full
 * parsed record objects (so callers can inspect `.type`, e.g. for
 * `session_summary`) found under `records/`. Best-effort — an absent/
 * unreadable `records/` or a corrupt physical line yields fewer (or zero)
 * records, and this NEVER throws. This is a gate READER, not the fail-closed
 * integrity gate (that remains `rebuildIndex()`'s job).
 *
 * Reuses the exact per-line parsing idiom from `readRecordIds()` above
 * (split on '\n', skip blank lines, `JSON.parse` inside try/catch with a
 * silent `continue` on failure) — no second/bespoke parser.
 *
 * DEDUPED BY `id` since issue #574 — the same rule `rebuildIndex()` applies,
 * at the reader the live layer is hydrated through. This is not cosmetic: a
 * duplicated physical line used to reach `importMemory()`'s payload TWICE (its
 * delta filters on what engram already holds, not on what the batch repeats),
 * and `engram import` INSERTS — so a union-merged duplicate propagated into the
 * live layer permanently, by that function's own measured note. Divergence is
 * NOT refused here: this reader's contract is best-effort and never-throws, so
 * it keeps the first line and leaves the refusal to `rebuildIndex()`, which
 * fails closed on the exact same pair the next time it runs.
 *
 * Retire this once the chunks-path is fully decommissioned (tracked for
 * C4/D1); until then both `.memory/records/` and `.memory/chunks/` are
 * legitimate observation sources for the memory-gate.
 *
 * @param {{recordsDir: string}} opts
 * @returns {Array<{type?: string, [key: string]: unknown}>}
 */
export function readRecordObservations({ recordsDir }) {
  return readRecords({ recordsDir }).records;
}

/**
 * readRecords() — `readRecordObservations()` plus the duplicate accounting it
 * collapsed (issue #574), so the callers that hydrate or search the store can
 * REPORT what they deduped instead of quietly returning a shorter list.
 * Same best-effort contract: never throws, absent/unreadable `records/` yields
 * an empty result.
 *
 * @param {{recordsDir: string}} opts
 * @returns {{records: Array<{[key: string]: unknown}>, duplicates: {ids: number,
 *   lines: number, groups: Array<{id: string, occurrences: string[]}>}}}
 */
export function readRecords({ recordsDir }) {
  const records = [];
  const occurrences = new Map();
  const seen = new Set();
  let filenames;
  try {
    filenames = readdirSync(recordsDir).filter((f) => f.endsWith('.jsonl')).sort();
  } catch {
    return { records, duplicates: summarizeDuplicates(occurrences) }; // records/ absent or unreadable
  }
  for (const filename of filenames) {
    let raw;
    try {
      raw = readFileSync(join(recordsDir, filename), 'utf8');
    } catch {
      continue; // file vanished/unreadable between readdir and read — best-effort, never throw
    }
    const physicalLines = raw.split('\n');
    for (let i = 0; i < physicalLines.length; i++) {
      const line = physicalLines[i];
      if (line.trim() === '') continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue; // corrupt line — not this function's fail-closed gate
      }
      const id = record && typeof record.id === 'string' ? record.id : undefined;
      if (id === undefined) {
        // No id to dedup on — a shape `rebuildIndex()` refuses outright. Passed
        // through rather than dropped: this reader never removes information it
        // cannot key, it only collapses repeats it can prove are repeats.
        records.push(record);
        continue;
      }
      occurrences.set(id, [...(occurrences.get(id) ?? []), `${filename}:${i + 1}`]);
      if (seen.has(id)) continue; // repeat — first line wins, accounting keeps the location
      seen.add(id);
      records.push(record);
    }
  }
  return { records, duplicates: summarizeDuplicates(occurrences) };
}
