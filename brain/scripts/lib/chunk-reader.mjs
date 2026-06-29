// chunk-reader.mjs — read engram session observations from committed .memory/chunks/.
//
// Each .memory/chunks/<id>.jsonl.gz is a GZIP of a single JSON object
// { sessions, observations: [...] } — NOT line-delimited JSONL despite the name.
// This depends on engram's export format: a brittle EXTERNAL dependency. Any
// absent, corrupt, or schema-drifted chunk is skipped silently — callers
// (brain:audit, brain:check) MUST never crash because memory is unreadable.

import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

import { chunkObservations } from './audit-helpers.mjs';

/**
 * Reads all engram observations from `<cwd>/.memory/chunks/*.jsonl.gz`.
 * Best-effort: returns the observations it can parse; an unreadable directory or
 * a corrupt/format-drifted chunk yields fewer (or zero) observations, never an error.
 *
 * @param {string} cwd  Repo root (reads the on-disk working-tree .memory/chunks/).
 * @returns {Array<{type?: string, [key: string]: unknown}>}
 */
export function readChunkObservations(cwd) {
  const all = [];
  const dir = join(cwd, '.memory', 'chunks');
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.jsonl.gz'));
  } catch {
    return all; // .memory/chunks/ absent or unreadable
  }
  for (const file of files) {
    try {
      const parsed = JSON.parse(gunzipSync(readFileSync(join(dir, file))).toString('utf8'));
      // for-loop push (not spread) avoids a RangeError on pathologically large arrays
      for (const obs of chunkObservations(parsed)) all.push(obs);
    } catch {
      // Corrupt or unparseable chunk — skip, never throw out of the caller
    }
  }
  return all;
}
