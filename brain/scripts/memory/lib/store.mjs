// store.mjs — thin I/O layer over `.memory/records/` + `.memory/index.json`.
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

import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parseRecordLine, buildIndexEntry, serializeIndex, serializeRecord, validateRecord } from './format.mjs';

/**
 * appendRecord() — validate, then append one record as exactly one physical
 * JSONL line to `records/<yyyy-mm>.jsonl` (month derived from `record.ts`).
 * Fails closed: an invalid record throws and nothing is written.
 *
 * @param {object} record
 * @param {{recordsDir: string}} opts
 * @returns {{file: string, filename: string}}
 */
export function appendRecord(record, { recordsDir }) {
  const { valid, errors } = validateRecord(record);
  if (!valid) throw new Error(`appendRecord: invalid record — ${errors.join('; ')}`);
  const filename = `${record.ts.slice(0, 7)}.jsonl`;
  const file = join(recordsDir, filename);
  mkdirSync(recordsDir, { recursive: true });
  appendFileSync(file, serializeRecord(record) + '\n', 'utf8');
  return { file, filename };
}

/**
 * rebuildIndex() — regenerate `.memory/index.json` purely from `.memory/records/`
 * (REQ-MF-4). Deterministic and idempotent: deleting the index and re-running
 * reproduces it byte-for-byte (the property test in store.test.mjs).
 *
 * @param {{recordsDir: string, indexPath: string}} opts
 * @returns {{count: number}}
 * @throws {Error} on a corrupt/invalid physical line — message includes
 *   `<filename>:<1-based line number>` so the failure is locatable.
 */
export function rebuildIndex({ recordsDir, indexPath }) {
  const entries = new Map();
  const filenames = existsSync(recordsDir)
    ? readdirSync(recordsDir).filter((f) => f.endsWith('.jsonl')).sort()
    : [];

  for (const filename of filenames) {
    const raw = readFileSync(join(recordsDir, filename), 'utf8');
    const physicalLines = raw.split('\n');
    for (let i = 0; i < physicalLines.length; i++) {
      const line = physicalLines[i];
      if (line.trim() === '') continue; // skip any blank line (trailing newline / spacing); a non-blank malformed line fails closed below
      let record;
      try {
        record = parseRecordLine(line);
      } catch (err) {
        throw new Error(`rebuildIndex: corrupt record at ${filename}:${i + 1} — ${err.message}`);
      }
      entries.set(record.id, buildIndexEntry(record, filename));
    }
  }

  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, serializeIndex(entries), 'utf8');
  return { count: entries.size };
}
