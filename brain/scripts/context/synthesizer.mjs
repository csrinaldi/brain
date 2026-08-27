// synthesizer.mjs — Intelligent Context Synthesizer Engine (REQ-CTX-1, REQ-CTX-2, REQ-CTX-3).
//
// The question this module answers is "what should an agent READ before it
// starts", derived from the work in front of it — never asked of the model.
// That is the whole point: an agent cannot detect the absence of a fact, so a
// prompt telling it to "search memory proactively" is the weakest possible
// mechanism. Deriving the reading list from the active change is the strongest
// one available without a gate.
//
// ── WHAT WAS BROKEN (and is the reason this file changed) ───────────────────
//
// #267 shipped the memory half DECLARED AND NEVER POPULATED: `matchedMemories`
// was initialised, counted in `totalMatches`, and returned in the result — and
// nothing ever pushed to it. The name promised retrieval; the body did filename
// matching against ADR paths. The existing test even says so in its own title
// ("matches ADRs and memory records based on touched files") while asserting on
// decisions alone. So the failsafe was computed from a total that could only
// ever be the decisions count, and `matchedMemories: []` read as "the store had
// nothing for you" when nothing had been asked of the store.
//
// ── BACKEND-AGNOSTIC BY CONSTRUCTION ────────────────────────────────────────
//
// The memory half reads `.memory/records/` through `store.mjs#readRecords` —
// the durable, brain-owned record format (ADR-0017). WHAT FILLS THAT STORE IS
// INVISIBLE HERE and must stay so: engram today, a RAG/postgres backend
// tomorrow, a teammate's `git pull` either way. This module never probes for a
// binary, never reads `MEMORY_BACKEND`, and never names a backend. That is not
// incidental tidiness — it is the only reason this reading list still works in
// the agent environment, where `command -v engram` fails (#519, #641).
//
// `readRecords` is reused rather than re-implemented: store.mjs is the ONE
// chokepoint for reading the log (its own header names its six consumers), and
// it reports the duplicates it collapsed instead of quietly returning a shorter
// list. A seventh reader here would be a seventh place to get dedup wrong.

import fs from 'node:fs/promises';
import path from 'node:path';

import { readRecords, recordFilename } from '../memory/lib/store.mjs';

export const FAILSAFE_MODES = Object.freeze({
  CORE_FLOOR: 'core_floor',
  FULL_FALLBACK: 'full_fallback',
});

const CORE_METHODOLOGY_FILES = [
  'brain/core/methodology/agent-authorities.md',
  'brain/core/methodology/sdd-layout.md',
  'brain/core/methodology/workflow-governance.md',
  'brain/core/methodology/reviewer-protocol.md',
];

/** How many records the reading list may carry. A list nobody reads is not a list. */
const DEFAULT_MEMORY_LIMIT = 8;

/** Shortest term worth matching on. Below this every token matches everything. */
const MIN_TERM_LENGTH = 4;

/**
 * Tokens that appear in nearly every path in this repository and therefore
 * carry no signal about WHICH work is happening. Dropping them is not taste:
 * `brain` alone matches a third of the ADR filenames, so leaving it in turns
 * the "targeted" list into the full index with extra steps.
 *
 * `file`/`files` are here for the same reason and one more — they are the
 * generic half of almost every artifact name, so they were the tokens most
 * likely to make a deliberately-unmatched path look matched.
 */
const STOP_TERMS = new Set([
  'brain', 'scripts', 'script', 'openspec', 'changes', 'change', 'issue',
  'test', 'tests', 'spec', 'specs', 'docs', 'index', 'main', 'node',
  'file', 'files', 'code', 'this', 'that', 'with', 'from', 'into', 'lib',
]);

/**
 * deriveTerms() — PURE. Path-ish strings → the lowercase tokens worth matching.
 *
 * Splits on every non-alphanumeric boundary rather than on `/` alone, because
 * the inputs are as often change-dir names (`issue-519-memory-writer-silent`)
 * as they are file paths — and the signal in the first is entirely in the
 * hyphen-separated slug. The previous implementation compared whole path
 * segments with `String.includes`, so `memory-writer-silent` matched only an
 * ADR whose filename contained that exact phrase: never.
 *
 * @param {string[]} inputs  Paths, change-dir names, or any mix.
 * @returns {string[]} Unique tokens, length >= MIN_TERM_LENGTH, stop-words removed.
 */
export function deriveTerms(inputs = []) {
  const terms = new Set();
  for (const raw of Array.isArray(inputs) ? inputs : []) {
    if (typeof raw !== 'string') continue;
    for (const token of raw.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length < MIN_TERM_LENGTH) continue;
      if (STOP_TERMS.has(token)) continue;
      terms.add(token);
    }
  }
  return [...terms];
}

/**
 * recordTitle() — PURE. The human-readable head of a record.
 *
 * `buildRecord` folds an optional title into the content as `**Title**\n\n…`
 * (format.mjs), so the title is not a field to read — it is a shape to
 * recognise. A record written without one falls back to its first non-empty
 * line, truncated: something to show is better than an empty cell, and the id
 * beside it is what actually addresses the record.
 *
 * @param {{content?: unknown}} record
 * @returns {string} Possibly empty when the record has no readable content.
 */
export function recordTitle(record) {
  const content = typeof record?.content === 'string' ? record.content : '';
  const bold = content.match(/^\s*\*\*(.+?)\*\*/s);
  if (bold) return bold[1].trim().replace(/\s+/g, ' ');
  const first = content.split('\n').find((line) => line.trim() !== '') ?? '';
  const flat = first.trim().replace(/\s+/g, ' ');
  return flat.length > 100 ? `${flat.slice(0, 100)}…` : flat;
}

/**
 * matchMemories() — PURE. Records in, reading list out. No I/O, no clock.
 *
 * TWO RULES, DELIBERATELY OF DIFFERENT KINDS:
 *
 *   1. `issue` — EXACT. A record carrying this change's issue number is about
 *      this change, full stop. This is the same scoping key #379 established
 *      for the gate, used here for retrieval instead of for judgement, and it
 *      is the only rule that cannot produce a false positive.
 *   2. `terms` — matched against the record's TITLE, never its body. Bodies
 *      here are whole verify reports and design docs; a body match returns
 *      most of the store for a term like "memory" and teaches the reader that
 *      the list is noise. Precision over recall is the right trade for a list
 *      that is read before work rather than searched during it.
 *
 * Rule 1 is never crowded out by rule 2: issue-scoped hits are emitted first
 * and the cap is applied afterwards. Within each rule, newest first.
 *
 * @param {object}   args
 * @param {object[]} args.records  As returned by `store.mjs#readRecords`.
 * @param {number|null} [args.issue]  Active change's issue number, when known.
 * @param {string[]} [args.terms]
 * @param {number}   [args.limit]
 * @returns {Array<{id: string, ts: string, type: string, issue: number|null,
 *                  title: string, file: string|null, reason: 'issue'|'term'}>}
 */
export function matchMemories({ records = [], issue = null, terms = [], limit = DEFAULT_MEMORY_LIMIT } = {}) {
  const wanted = Number.isInteger(issue) ? issue : null;
  const activeTerms = Array.isArray(terms) ? terms.filter((t) => typeof t === 'string' && t !== '') : [];

  const byIssue = [];
  const byTerm = [];

  for (const record of Array.isArray(records) ? records : []) {
    if (record === null || typeof record !== 'object') continue;
    const id = typeof record.id === 'string' ? record.id : null;
    if (id === null) continue; // unaddressable — a list entry nobody can open is not an entry

    const title = recordTitle(record);
    // `record.issue` is an integer by the write gate (format.mjs W2), but the
    // log carries records written before that gate existed, so a string `"519"`
    // is a real shape in this store. Coerced for COMPARISON only — never
    // written back, never reported as anything other than what it was.
    const recordIssue = record.issue === undefined || record.issue === null ? null : Number(record.issue);
    const entry = {
      id,
      ts: typeof record.ts === 'string' ? record.ts : '',
      type: typeof record.type === 'string' ? record.type : 'unknown',
      issue: Number.isFinite(recordIssue) ? recordIssue : null,
      title,
      file: safeRecordFilename(record),
      reason: 'issue',
    };

    if (wanted !== null && entry.issue === wanted) {
      byIssue.push(entry);
      continue; // an issue hit is never also counted as a term hit
    }

    const haystack = title.toLowerCase();
    if (haystack !== '' && activeTerms.some((term) => haystack.includes(term))) {
      byTerm.push({ ...entry, reason: 'term' });
    }
  }

  const newestFirst = (a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : a.id < b.id ? -1 : 1);
  byIssue.sort(newestFirst);
  byTerm.sort(newestFirst);

  const cap = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_MEMORY_LIMIT;
  return [...byIssue, ...byTerm].slice(0, cap);
}

/**
 * `recordFilename` throws on a record whose id/ts it refuses to name a file
 * from — correct for the writer, wrong here: this is a reading list, and a
 * malformed record should cost that record its path, not the whole list.
 */
function safeRecordFilename(record) {
  try {
    return recordFilename(record);
  } catch {
    return null;
  }
}

/**
 * Synthesizes targeted context for the active working session.
 *
 * @param {{ touchedFiles?: string[], issue?: number|null, rootDir?: string,
 *           limit?: number, _readRecords?: Function }} options
 * @returns {Promise<{ coreFloor: string[], matchedDecisions: string[],
 *   matchedMemories: object[], recordsScanned: number, failsafeActivated: boolean,
 *   failsafeMode: string, markdown: string }>}
 */
export async function synthesizeContext({
  touchedFiles = [],
  issue = null,
  rootDir = process.cwd(),
  limit = DEFAULT_MEMORY_LIMIT,
  _readRecords = readRecords,
} = {}) {
  const coreFloor = [];
  for (const relPath of CORE_METHODOLOGY_FILES) {
    try {
      const fullPath = path.join(rootDir, relPath);
      await fs.access(fullPath);
      coreFloor.push(relPath);
    } catch {
      // ignore if unreadable in test fixtures
    }
  }

  const terms = deriveTerms(touchedFiles);

  // ── Decisions (ADRs) ──────────────────────────────────────────────────────
  // Ranked by how many of this change's terms the filename carries, so an ADR
  // matching two terms outranks one matching a single generic word. Capped for
  // the same reason the memory list is: an unranked, uncapped list of "relevant"
  // documents is the index again.
  const matchedDecisions = [];
  try {
    const decisionsDir = path.join(rootDir, 'brain/project/decisions');
    const entries = await fs.readdir(decisionsDir);
    const scored = [];
    for (const file of entries) {
      if (!file.endsWith('.md')) continue;
      const fileLower = file.toLowerCase();
      const hits = terms.filter((term) => fileLower.includes(term)).length;
      if (hits > 0) scored.push({ file, hits });
    }
    scored.sort((a, b) => (b.hits - a.hits) || (a.file < b.file ? -1 : 1));
    for (const { file } of scored.slice(0, 6)) {
      matchedDecisions.push(`brain/project/decisions/${file}`);
    }
  } catch {
    // decisions dir absent or unreadable — a repo with no ADRs is a valid repo
  }

  // ── Memory (durable records) ──────────────────────────────────────────────
  // Best-effort in the same direction as every other reader in this path: the
  // reading list degrades, it never throws. `recordsScanned` is reported so a
  // caller can tell "scanned 2182, matched none" from "read nothing at all" —
  // the two answers this repo has paid for confusing nine times over.
  let records = [];
  try {
    records = _readRecords({ recordsDir: path.join(rootDir, '.memory', 'records') })?.records ?? [];
  } catch {
    records = [];
  }
  const matchedMemories = matchMemories({ records, issue, terms, limit });

  const totalMatches = matchedDecisions.length + matchedMemories.length;
  const failsafeActivated = touchedFiles.length > 0 && totalMatches === 0;
  const failsafeMode = FAILSAFE_MODES.CORE_FLOOR;

  const lines = [
    '# Synthesized Agent Context (.brain-context.md)',
    '',
    '## Core Methodology Baseline Floor (Mandatory)',
  ];

  for (const doc of coreFloor) {
    lines.push(`- [${path.basename(doc)}](${doc})`);
  }

  if (failsafeActivated) {
    lines.push('');
    lines.push('> [!NOTE]');
    lines.push('> Core Baseline Floor Activated: Zero targeted decision matches found for active diff files. Falling back to core governance rules.');
  }

  if (matchedDecisions.length > 0) {
    lines.push('');
    lines.push('## Targeted Architecture Decisions (ADRs)');
    for (const dec of matchedDecisions) {
      lines.push(`- [${path.basename(dec)}](${dec})`);
    }
  }

  if (matchedMemories.length > 0) {
    lines.push('');
    lines.push('## Working Memory (durable records)');
    lines.push('');
    lines.push('Read these before exploring — they are prior work on this change, addressed by id.');
    lines.push('');
    for (const m of matchedMemories) {
      const scope = m.reason === 'issue' ? `issue #${m.issue}` : 'related';
      const where = m.file ? ` — \`.memory/records/${m.file}\`` : '';
      lines.push(`- \`${m.id}\` · ${m.type} · ${scope} — ${m.title || '(untitled)'}${where}`);
    }
  } else if (records.length === 0) {
    lines.push('');
    lines.push('> [!NOTE]');
    lines.push('> No durable records were readable under `.memory/records/` — the reading list below reflects an unread store, not an empty history.');
  }

  const markdown = lines.join('\n');

  return {
    coreFloor,
    matchedDecisions,
    matchedMemories,
    recordsScanned: records.length,
    failsafeActivated,
    failsafeMode,
    markdown,
  };
}
