// format.mjs — the normative durable memory record format (brain/scripts/memory/lib).
//
// Implements the C0 contract fixed in
// openspec/changes/issue-201-memory-format/spec.md (REQ-MF-1..6) and
// openspec/changes/issue-201-memory-format/brain-drafts/memory-format.md.
//
// Pure functions only: no filesystem access, no engram dependency, no child
// processes. The thin I/O layer (append to records/, rebuild index.jsonl) lives
// in ./store.mjs, which calls into this module.
//
// Three code-pins from the C0 contract, enforced here:
//   R1 — index.jsonl: one entry per physical line, sorted by id, deterministic (serializeIndex).
//   R2 — a non-empty `title` is folded into `content` as a bold prefix BEFORE hashing (buildRecord).
//   R3 — absent optional fields (`issue`, `supersedes`, `source`) are OMITTED — never `null` (buildRecord, validateRecord).

import { createHash } from 'node:crypto';

/** The seven-member `type` enum (REQ-MF-1). */
export const RECORD_TYPES = [
  'decision', 'architecture', 'pattern', 'bugfix', 'config', 'discovery', 'session_summary',
];

const REQUIRED_FIELDS = ['id', 'ts', 'actor', 'actorKind', 'type', 'project', 'content'];
const OPTIONAL_FIELDS = ['issue', 'supersedes', 'source'];

// ISO-8601 UTC only — the `Z` is required (naive/local timestamps are rejected).
const UTC_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
// Partial PII heuristic (REQ-MF-5): flags an email-shaped actor. Does not catch
// a bare legal name — full enforcement is the C1b secret-scrubbing hook, not this validator.
const EMAIL_ACTOR_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * canonicalJson() — RFC 8785 (JCS) canonical serialization for this schema's
 * value shapes: strings, finite integers, booleans, null, and plain objects
 * (no floats/NaN/Infinity/Dates are ever fed to this — hashInput is a flat
 * record of those primitive types). Keys are sorted by default JS string
 * comparison, which orders by UTF-16 code unit — the JCS key-order rule.
 * Number serialization delegates to `String(n)`, matching the ECMAScript
 * Number-to-String algorithm JCS mandates. String escaping delegates to
 * `JSON.stringify`, which already implements RFC 8259 control-character/quote/
 * backslash escaping and leaves non-ASCII as raw UTF-8 — consistent with JCS.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('canonicalJson: non-finite numbers are not supported');
    }
    return String(value);
  }
  if (t === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (t === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  throw new Error(`canonicalJson: unsupported value type '${t}'`);
}

/**
 * computeRecordId() — REQ-MF-2: `id = "rec-" + sha256(canonicalJson(hashInput))[:16]`.
 * `hashInput` is `{ type, actor, actorKind, ts, project, issue?, supersedes?, content }`.
 * `source` is EXCLUDED from the hash (incidental provenance). Absent `issue`/
 * `supersedes` are omitted from `hashInput`, never `null` (R3) — nulling them
 * would canonicalize to different bytes and silently break dedup.
 *
 * @param {{type:string, actor:string, actorKind:string, ts:string, project:string,
 *          content:string, issue?:number, supersedes?:string}} fields
 * @returns {string}
 */
export function computeRecordId({ type, actor, actorKind, ts, project, content, issue, supersedes }) {
  const hashInput = { type, actor, actorKind, ts, project, content };
  if (issue !== undefined && issue !== null) hashInput.issue = issue;
  if (supersedes !== undefined && supersedes !== null) hashInput.supersedes = supersedes;
  const digest = createHash('sha256').update(canonicalJson(hashInput), 'utf8').digest('hex');
  return `rec-${digest.slice(0, 16)}`;
}

/**
 * buildRecord() — construct a normative durable record from source fields.
 *
 * R2: a non-empty `title` is folded into `content` as a bold Markdown prefix
 * (`"**" + title + "**\n\n" + content`) BEFORE the id is hashed, so the folded
 * bytes feed `computeRecordId` identically across machines. An empty/absent
 * `title` leaves `content` unchanged.
 *
 * R3: absent `issue`/`supersedes`/`source` are OMITTED from the returned
 * record — never serialized as `null`.
 *
 * @param {{ts:string, actor:string, actorKind:string, type:string, project:string,
 *          content:string, issue?:number, supersedes?:string, source?:string, title?:string}} fields
 * @returns {object} the record, without validation (call validateRecord() separately)
 */
export function buildRecord({ ts, actor, actorKind, type, project, content, issue, supersedes, source, title }) {
  const foldedContent = title ? `**${title}**\n\n${content}` : content;
  const id = computeRecordId({ type, actor, actorKind, ts, project, content: foldedContent, issue, supersedes });
  const record = { id, ts, actor, actorKind, type, project, content: foldedContent };
  if (issue !== undefined && issue !== null) record.issue = issue;
  if (supersedes !== undefined && supersedes !== null) record.supersedes = supersedes;
  if (source !== undefined && source !== null) record.source = source;
  return record;
}

/**
 * validateRecord() — schema-shape validator (REQ-MF-1, REQ-MF-2 R3, REQ-MF-5 partial).
 * Never throws — returns `{ valid, errors }` so callers choose fail-open vs
 * fail-closed (store.mjs's rebuildIndex() fails closed on this result).
 *
 * @param {unknown} record
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateRecord(record) {
  if (record === null || typeof record !== 'object') {
    return { valid: false, errors: ['record must be an object'] };
  }
  const errors = [];
  for (const f of REQUIRED_FIELDS) {
    if (record[f] === undefined || record[f] === null) errors.push(`missing required field: '${f}'`);
  }
  for (const f of OPTIONAL_FIELDS) {
    if (record[f] === null) errors.push(`optional field '${f}' must be omitted, not null (R3)`);
  }
  if (record.actorKind !== undefined && !['human', 'agent'].includes(record.actorKind)) {
    errors.push(`invalid actorKind: '${record.actorKind}' (must be 'human' or 'agent')`);
  }
  if (record.type !== undefined && !RECORD_TYPES.includes(record.type)) {
    errors.push(`invalid type: '${record.type}' (must be one of ${RECORD_TYPES.join(', ')})`);
  }
  if (typeof record.ts === 'string' && !UTC_TS_RE.test(record.ts)) {
    errors.push(`ts must be ISO-8601 UTC with 'Z': '${record.ts}'`);
  }
  if (typeof record.actor === 'string' && EMAIL_ACTOR_RE.test(record.actor)) {
    errors.push(`actor looks like an email address, not a stable handle: '${record.actor}'`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * serializeRecord() — serialize a record as exactly ONE physical JSONL line.
 * `JSON.stringify` already escapes embedded newlines (`\n`) inside `content`,
 * so this is the one-physical-line invariant (REQ-MF-1) by construction.
 *
 * @param {object} record
 * @returns {string}
 */
export function serializeRecord(record) {
  const line = JSON.stringify(record);
  /* c8 ignore start -- defensive: JSON.stringify always escapes control chars */
  if (/[\n\r]/.test(line)) {
    throw new Error('serializeRecord: result occupies more than one physical line');
  }
  /* c8 ignore stop */
  return line;
}

/**
 * parseRecordLine() — parse + validate one physical JSONL line.
 * Fails closed: THROWS (never silently skips) on invalid JSON or a schema
 * violation, so callers (store.mjs's rebuildIndex) can attach file/line-number
 * context and never treat a corrupt line as an empty result.
 *
 * @param {string} line
 * @returns {object} the parsed, validated record
 * @throws {Error}
 */
export function parseRecordLine(line) {
  let record;
  try {
    record = JSON.parse(line);
  } catch (err) {
    throw new Error(`invalid JSON: ${err.message}`);
  }
  const { valid, errors } = validateRecord(record);
  if (!valid) throw new Error(`invalid record: ${errors.join('; ')}`);
  return record;
}

/**
 * buildIndexEntry() — the derived `index.jsonl` projection of one record
 * (REQ-MF-4): `{ id, ts, actor, type, project, issue?, supersedes?, file }`.
 *
 * @param {object} record
 * @param {string} file  the `records/<yyyy-mm>.jsonl` filename the record lives in
 * @returns {object}
 */
export function buildIndexEntry(record, file) {
  const entry = { id: record.id, ts: record.ts, actor: record.actor, type: record.type, project: record.project };
  if (record.issue !== undefined) entry.issue = record.issue;
  if (record.supersedes !== undefined) entry.supersedes = record.supersedes;
  entry.file = file;
  return entry;
}

/**
 * serializeIndex() — R1 (index.jsonl): one entry per physical line, sorted by `id`,
 * deterministic formatting (`JSON.stringify`, stable key insertion order from
 * buildIndexEntry). An empty map serializes to the empty string.
 *
 * @param {Map<string, object>} entriesById
 * @returns {string}
 */
export function serializeIndex(entriesById) {
  const ids = [...entriesById.keys()].sort();
  const lines = ids.map((id) => JSON.stringify(entriesById.get(id)));
  return lines.length ? lines.join('\n') + '\n' : '';
}

/**
 * nowUtcSeconds() — a seam-injected clock producing the C2a canonical
 * UTC-seconds `ts` (`YYYY-MM-DDTHH:MM:SSZ`) that `UTC_TS_RE` (above) accepts.
 * Strips millisecond precision the same way `engram-export.mjs#toUtcSeconds`
 * does — the ONE canonical rule (REQ-MF-2), never a second stripping regex.
 * Never `new Date().toISOString()` directly: that emits `.mmmZ`, which
 * `validateRecord()` rejects.
 *
 * @param {() => Date} [getNow]  Injectable clock seam — defaults to `new Date()`.
 * @returns {string}
 */
export function nowUtcSeconds(getNow = () => new Date()) {
  return getNow().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
