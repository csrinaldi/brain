// record-route.mjs — GET /api/record/{id}: one record's content, for the
// Memory view's inline expansion (#1313, R1313-8). A read-only local file read.
//
// The id is validated against RECORD_ID_RE and is NEVER joined into a path:
// the file is an entry the directory listing returned, matched by comparing
// names. A symlink, a directory or a lookalike name is not a record file. The
// read is bounded twice: a file over RECORD_FILE_MAX is not opened, and the
// content is cut at DOCUMENT_CAP bytes on a UTF-8 boundary, the same cap the
// SDD reader applies to a document.

import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { capText, DOCUMENT_CAP } from './change-route.mjs';
import { NO_TEXT, EMPTY_TEXT } from '../memory/lib/record-summary.mjs';

/** The shape `computeRecordId` mints: `rec-` and 16 lowercase hex. Anchored; `$` is not trusted with a trailing newline. */
export const RECORD_ID_RE = /^rec-[0-9a-f]{16}$/;
/** A record file larger than this is not opened. One record per file (#677), so this is generous. */
export const RECORD_FILE_MAX = 4 * DOCUMENT_CAP;
const RECORDS_DIR = '.memory/records';
const MONTH_PREFIX_RE = /^\d{4}-\d{2}-/;

const refuse = (status, reason) => ({ status, body: { ok: false, reason } });
const unknown = (id) => refuse(404, `no record ${id} in ${RECORDS_DIR}`);

/** The file name the listing holds for this id: `<yyyy-mm>-<id>.jsonl`, compared as text. */
function findRecordFile(dir, id) {
  let names;
  try { names = readdirSync(dir); } catch { return null; }
  const tail = `${id}.jsonl`;
  return names.find((name) => MONTH_PREFIX_RE.test(name) && name.slice(8) === tail) ?? null;
}

function findRecord(text, id) {
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let record;
    try { record = JSON.parse(line); } catch { continue; }
    if (record && record.id === id) return record;
  }
  return null;
}

/**
 * @param {{root: string, id: unknown}} opts
 * @returns {{status: number, body: object}}
 */
export function buildRecordView({ root, id }) {
  if (typeof id !== 'string' || !RECORD_ID_RE.test(id)) {
    return refuse(400, 'a record id is rec- followed by 16 lowercase hex digits');
  }
  const dir = join(root, RECORDS_DIR);
  const name = findRecordFile(dir, id);
  if (name === null) return unknown(id);
  const path = join(dir, name);
  let stat;
  try { stat = lstatSync(path); } catch { return unknown(id); }
  if (!stat.isFile()) return unknown(id);
  if (stat.size > RECORD_FILE_MAX) return refuse(413, `${RECORDS_DIR}/${name} is larger than ${RECORD_FILE_MAX} bytes, so it is not read`);
  let text;
  try { text = readFileSync(path, 'utf8'); } catch (err) { return refuse(500, `${RECORDS_DIR}/${name} could not be read: ${err.code ?? err.message}`); }
  const record = findRecord(text, id);
  if (record === null) return unknown(id);

  if (typeof record.content !== 'string') return { status: 200, body: { ok: false, reason: NO_TEXT } };
  if (record.content.trim() === '') return { status: 200, body: { ok: false, reason: EMPTY_TEXT } };
  const cut = capText(record.content);
  return { status: 200, body: { ok: true, id, file: `${RECORDS_DIR}/${name}`, content: cut.text, truncated: cut.truncated, truncatedAt: cut.truncatedAt } };
}
