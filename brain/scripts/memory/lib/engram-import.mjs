// engram-import.mjs — brain record → engram observation (the import half of
// the C0 loss contract, REQ-C2B1-1, issue #221 C2b-1).
//
// Pure: no filesystem, no engram dependency, no child processes (mirrors
// engram-export.mjs's contract). Designed as the INVERSE of exportObservation():
// undoes the R2 title fold, renders provenance back into §4 prose via the
// shared renderProvenance(), and maps `ts` back to engram's naive timestamp
// form. Acceptance is the id-equality round-trip (design.md Decision 2,
// sdd/memory-format/c4-roundtrip-equality): exportObservation(importRecord(r))
// must reproduce computeRecordId(r) — NOT byte equality (the source/issue
// render asymmetry is inert, since `source` is excluded from the hash).

import { renderProvenance } from './provenance.mjs';

// The R2 fold buildRecord() applies: `"**" + title + "**\n\n" + content`.
// Reversible when content matches this shape — whatever title/body split is
// extracted, re-concatenating them with the same fixed template reproduces
// the original bytes exactly, which is all id-equality requires (byte-exact
// semantic title recovery is not). Content with no leading title block is
// returned unchanged, mirroring buildRecord's falsy-title no-op.
const TITLE_FOLD_RE = /^\*\*(.+?)\*\*\n\n([\s\S]*)$/;

function undoTitleFold(content) {
  const m = TITLE_FOLD_RE.exec(content ?? '');
  if (!m) return { title: '', body: content ?? '' };
  return { title: m[1], body: m[2] };
}

/**
 * toEngramNaive() — the inverse of engram-export.mjs's toUtcSeconds(): an
 * ISO-8601 UTC-seconds `ts` (`YYYY-MM-DDTHH:MM:SSZ`) becomes engram's naive
 * `"YYYY-MM-DD HH:MM:SS"` form (no `T`, no timezone). Fails closed on any
 * shape that isn't exactly the UTC-seconds form format.mjs's validateRecord
 * enforces on every stored record.
 *
 * @param {string} isoTs
 * @returns {string}
 */
export function toEngramNaive(isoTs) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z$/.exec(isoTs ?? '');
  if (!m) throw new Error(`toEngramNaive: invalid ISO-8601 UTC-seconds timestamp '${isoTs}'`);
  return `${m[1]} ${m[2]}`;
}

/**
 * importRecord() — the designed inverse of exportObservation(): a brain
 * record becomes an engram observation whose `content` carries the record's
 * provenance as §4 prose (renderProvenance), with `title` un-folded back to
 * its own field and `ts` mapped back to engram's naive form.
 *
 * @param {{ts:string, actor:string, actorKind:string, type:string, project:string,
 *          content:string, issue?:number, supersedes?:string, source?:string}} record
 * @returns {{type:string, project:string, title:string, content:string,
 *            created_at:string, scope:string}}
 */
export function importRecord(record) {
  const { title, body } = undoTitleFold(record.content);
  const content = renderProvenance({
    actor: record.actor,
    actorKind: record.actorKind,
    issue: record.issue,
    supersedes: record.supersedes,
    source: record.source,
    content: body,
  });
  return {
    type: record.type,
    project: record.project,
    title,
    content,
    created_at: toEngramNaive(record.ts),
    scope: 'project',
  };
}
