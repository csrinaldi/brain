// duplicates.mjs — the duplicate-line RULE for the durable record store
// (issue #574), and the operator report that makes it audible.
//
// ── The two failure modes of a content-addressed store ──────────────────────
//
//   1. a line whose bytes no longer hash to its `id`  → TAMPER.
//      `rebuildIndex()` has REFUSED this since issue #214, naming file:line.
//   2. the same `id` on more than one physical line   → DUPLICATE.
//      `rebuildIndex()` keys its Map by `id`, so it collapsed them and said
//      nothing. Measured on `main` when this was written: 2177 physical lines,
//      2038 unique ids, 49 repeated ids, 139 excess lines — an index 139
//      entries shorter than the store, reported by no one, on a path where
//      `memory:share` printed nothing at all.
//
// One mode was guarded and the other was mute, and the mute one is the one
// git merges produce.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
//   A repeated `id` whose lines AGREE is DEDUPLICATED AND REPORTED.
//   A repeated `id` whose lines DISAGREE is REFUSED, naming both lines.
//
// ── Why deduplicate-and-report, and not refuse ──────────────────────────────
//
// ADR-0017 fixes `merge=union` as the transport for `records/*.jsonl`
// (`.gitattributes`, REQ-MF-3). When two branches both hold the same record, a
// git merge concatenates both copies BY CONSTRUCTION — that is not a
// malfunction, it is the mechanism working. Refusing would turn the
// designed-for, conflict-free path into a hard failure: `memory:reindex` — the
// very command doctrine prescribes for finishing a merge (adr-0017:121-129) —
// would refuse to run right after an ordinary merge, and `share`, `pull`,
// `save` and `setup` would go down with it, since every one of them reindexes.
// Git is the transport, and a transport's normal output cannot be an error.
// ADR-0017 already ruled on this in its own words: "union can leave a rare
// duplicate physical line until the next reindex … Accepted — the alternative
// (rewriting the JSONL) breaks append-only and union safety."
//
// The asymmetry with the tamper path is about INFORMATION, not severity:
//
//   * a tampered line is a record NO producer could have written — the store
//     cannot say which bytes are true, so it must refuse;
//   * a repeated identical line is a record EVERY producer could have written
//     twice — the store knows exactly what it means, and collapsing it loses
//     nothing.
//
// Refuse where the truth is unknowable; report where it is merely redundant.
// What the silent version got wrong was never the collapse — it was the
// silence.
//
// ── Why a DISAGREEING duplicate is refused ──────────────────────────────────
//
// ADR-0017 says the duplicate lines "are byte-identical and share an `id`", so
// the index "collapses them losslessly". That holds only while the repeated
// lines carry equal information — and `id` does NOT hash `source`
// (format.mjs#computeRecordId excludes it as incidental provenance). Two lines
// can therefore share an `id`, each pass the id-integrity check on its own, and
// still disagree. Collapsing those is a last-wins DROP: the third mute failure
// mode, and the one no merge can justify. It belongs to the tamper family — the
// store cannot say which line is true — so it gets the tamper answer: refuse,
// naming both lines. That split is what makes this a rule instead of a habit.
//
// ── Strings ─────────────────────────────────────────────────────────────────
//
// The operator text lives here as literals rather than as `memory.*` keys in
// `brain/scripts/i18n/{en,es}.mjs`, because issue #574 claims
// `brain/scripts/memory/**` and only that. Precedent for operator notices
// carrying their text inside this tree already exists (`engram.mjs`'s manifest-
// restore and symlink notices). Promoting them is a mechanical follow-up, and
// this module is the single site it has to touch.

/** The zero accounting — the shape every caller sees when nothing repeats. */
export function emptyDuplicates() {
  return { ids: 0, lines: 0, groups: [] };
}

/**
 * summarizeDuplicates() — fold a per-id occurrence map into the accounting.
 * Only ids seen more than once become groups; `lines` counts EXCESS physical
 * lines (occurrences − 1 per id), which is the number the index is shorter
 * than the store by.
 *
 * @param {Map<string, string[]>} occurrencesById  id → ['<file>:<line>', …]
 * @returns {{ids: number, lines: number, groups: Array<{id: string, occurrences: string[]}>}}
 */
export function summarizeDuplicates(occurrencesById) {
  const groups = [...occurrencesById.entries()]
    .filter(([, occurrences]) => occurrences.length > 1)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, occurrences]) => ({ id, occurrences: [...occurrences] }));
  return {
    ids: groups.length,
    lines: groups.reduce((total, g) => total + g.occurrences.length - 1, 0),
    groups,
  };
}

/**
 * normalizeDuplicates() — tolerate a caller (or an injected `_rebuildIndex`
 * seam) that predates this accounting and returns only `{count}`. Absent
 * accounting means "nothing was measured", which reports as zero — never as a
 * crash, and never as a fabricated non-zero.
 *
 * @param {unknown} value
 * @returns {{ids: number, lines: number, groups: Array<{id: string, occurrences: string[]}>}}
 */
export function normalizeDuplicates(value) {
  if (value === null || typeof value !== 'object') return emptyDuplicates();
  const groups = Array.isArray(value.groups) ? value.groups : [];
  const lines = Number.isInteger(value.lines)
    ? value.lines
    : groups.reduce((total, g) => total + Math.max(0, (g?.occurrences?.length ?? 1) - 1), 0);
  return {
    ids: Number.isInteger(value.ids) ? value.ids : groups.length,
    lines,
    groups,
  };
}

const MAX_GROUPS = 10;
const MAX_OCCURRENCES = 6;

/**
 * formatDuplicateReport() — the operator-facing lines for a duplicate
 * accounting. Returns `[]` when nothing repeats, so a caller can `for (const
 * line of report) log(line)` unconditionally and stay quiet on a clean store.
 *
 * Prints the count FIRST (the number #574 asked for) and the locations second,
 * capped — a store with 49 repeated ids must not bury the summary under its own
 * evidence.
 *
 * @param {{ids: number, lines: number, groups: Array<{id: string, occurrences: string[]}>}} duplicates
 * @param {{indexCount?: number}} [opts]
 * @returns {string[]}
 */
export function formatDuplicateReport(duplicates, { indexCount } = {}) {
  const { ids, lines, groups } = normalizeDuplicates(duplicates);
  if (ids === 0) return [];

  const store = indexCount === undefined ? '' : ` (${indexCount + lines} physical line(s) → ${indexCount} indexed)`;
  const out = [
    `⚠ ${ids} duplicate record id(s) in .memory/records/ — ${lines} excess physical line(s) collapsed into the index${store}.`,
    '  Deduplicated, not refused: `merge=union` concatenates both copies when two branches hold the same '
    + 'record (ADR-0017, REQ-MF-3), so this is the transport working, not a corrupt store. The repeated lines '
    + 'agree, so the collapse is lossless — but `wc -l .memory/records/*.jsonl` over-counts the store by '
    + `${lines}, and it is only reported because you are reading this.`,
  ];

  for (const g of groups.slice(0, MAX_GROUPS)) {
    const shown = g.occurrences.slice(0, MAX_OCCURRENCES).join(', ');
    const more = g.occurrences.length > MAX_OCCURRENCES ? `, +${g.occurrences.length - MAX_OCCURRENCES} more` : '';
    out.push(`  ${g.id} ×${g.occurrences.length} — ${shown}${more}`);
  }
  if (groups.length > MAX_GROUPS) {
    out.push(`  … +${groups.length - MAX_GROUPS} more duplicated id(s).`);
  }
  return out;
}
