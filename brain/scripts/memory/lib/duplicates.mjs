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
//   A repeated `id` is DEDUPLICATED AND REPORTED — never refused.
//   When the repeated lines DISAGREE, the disagreement is reported SEPARATELY
//   and by name, and resolved deterministically: FIRST WINS (oldest month file,
//   earliest physical line) — the same resolution the fail-open reader uses, so
//   the index and the hydration path can never disagree about which line won.
//
// Refusal keeps the scope it always had: a line whose bytes do not hash to its
// own `id`. That check is untouched.
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
// ── The third failure mode: a DISAGREEING duplicate ─────────────────────────
//
// ADR-0017 says the duplicate lines "are byte-identical and share an `id`", so
// the index "collapses them losslessly". That holds only while the repeated
// lines carry equal information — and `id` does NOT hash `source`
// (format.mjs#computeRecordId excludes it as incidental provenance). Two lines
// can therefore share an `id`, each pass the id-integrity check on its own, and
// still disagree. Collapsing THOSE in silence is a last-wins DROP, and it is a
// distinct failure mode that deserves its own line in the report.
//
// It is reported, and NOT refused. The first draft of this rule refused it, on
// the reasoning that the store "cannot say which line is true" — the tamper
// argument. That reasoning was wrong on the facts, and the counter-example is
// brain's own round-trip:
//
//   * `renderFuente` (provenance.mjs) PREPENDS `issue #N` to a `source` that
//     does not already cite the issue, so a record exported → imported →
//     exported comes back with the same `id` and a widened `source`. Measured:
//     `"PR #405"` → `"issue #405 / PR #405"`, same id, different bytes.
//   * That widening is not a bug. `memory-format.md` excludes `source` from the
//     hash precisely so it "must not split one logical record into two ids when
//     two writers cite it slightly differently". Refusing the pair turns the
//     scenario the exclusion EXISTS to tolerate into a hard store-wide failure —
//     strictly worse than the split the doc forbids.
//
// So a disagreeing pair is NOT "a record no producer could have written" — it is
// a record brain's own producers write, which is the exact test this module uses
// to separate the tamper family from the transport family. And refusing it would
// have been a new READ-path rejection over `.memory/**`, which is consumer-owned
// (managed-paths.mjs's `local` array) and therefore un-migratable by brain — the
// precise class format.mjs's header exists to prohibit: "one rejected line makes
// a whole store unreadable … brain cannot migrate what a new read rule would
// break." One `--issue`-carrying record round-tripped on a second machine would
// have bricked `reindex`, `share`, `pull`, `save`, `setup` and `resolve-index`
// at once, on an append-only log with no repair verb.
//
// The resolution is therefore the one the store already had an answer for:
// FIRST WINS, deterministically (month files read in sorted order, lines in
// order), which is what `store.mjs#readRecords` does on the hydration path. The
// index and the reader now agree by construction instead of by coincidence.
// Reporting it is what this ticket was actually about.
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
  return { ids: 0, lines: 0, divergent: 0, groups: [] };
}

/**
 * summarizeDuplicates() — fold a per-id occurrence map into the accounting.
 * Only ids seen more than once become groups; `lines` counts EXCESS physical
 * lines (occurrences − 1 per id), which is the number the index is shorter
 * than the store by. `divergent` counts the subset of those ids whose lines do
 * not carry equal information — reported on its own line, because it is a
 * different fact about the store than a plain repeat.
 *
 * @param {Map<string, string[]>} occurrencesById  id → ['<file>:<line>', …]
 * @param {Set<string>} [divergentIds]  ids whose repeated lines disagree
 * @returns {{ids: number, lines: number, divergent: number,
 *   groups: Array<{id: string, occurrences: string[], divergent: boolean}>}}
 */
export function summarizeDuplicates(occurrencesById, divergentIds = new Set()) {
  const groups = [...occurrencesById.entries()]
    .filter(([, occurrences]) => occurrences.length > 1)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, occurrences]) => ({ id, occurrences: [...occurrences], divergent: divergentIds.has(id) }));
  return {
    ids: groups.length,
    lines: groups.reduce((total, g) => total + g.occurrences.length - 1, 0),
    divergent: groups.filter((g) => g.divergent).length,
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
 * @returns {{ids: number, lines: number, divergent: number, groups: object[]}}
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
    divergent: Number.isInteger(value.divergent) ? value.divergent : groups.filter((g) => g?.divergent).length,
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
 * Prints the counts FIRST (the numbers #574 asked for) and the locations
 * second, capped — a store with 49 repeated ids must not bury the summary under
 * its own evidence. A divergent group is marked inline and gets its own summary
 * line, because "the store holds this record twice" and "the two copies
 * disagree" are different facts and only the second needs a human.
 *
 * `surface` names what the repeats were collapsed INTO, so the verbs that never
 * touch the index (`search`) do not claim they did.
 *
 * @param {{ids: number, lines: number, divergent: number, groups: object[]}} duplicates
 * @param {{indexCount?: number, surface?: string}} [opts]
 * @returns {string[]}
 */
export function formatDuplicateReport(duplicates, { indexCount, surface = 'the index' } = {}) {
  const { ids, lines, divergent, groups } = normalizeDuplicates(duplicates);
  if (ids === 0 && lines === 0) return [];

  const store = indexCount === undefined ? '' : ` (${indexCount + lines} physical line(s) → ${indexCount} indexed)`;
  const out = [
    `⚠ ${ids} duplicate record id(s) in .memory/records/ — ${lines} excess physical line(s) collapsed into ${surface}${store}.`,
    '  Deduplicated, not refused: `merge=union` concatenates both copies when two branches hold the same '
    + 'record (ADR-0017, REQ-MF-3), so this is the transport working, not a corrupt store — but '
    + `\`wc -l .memory/records/*.jsonl\` over-counts the store by ${lines}, and it is only reported because `
    + 'you are reading this.',
  ];

  if (divergent > 0) {
    out.push(
      `  ${divergent} of them DISAGREE outside the hashed fields (\`source\` is not hashed, so two copies of one `
      + 'record can differ there — brain\'s own export→import→export widens it). Resolved first-wins: the '
      + 'earliest line of the earliest month file is the one indexed, exactly as the read path resolves it. '
      + 'Marked [divergent] below — worth a look, not an error.',
    );
  }

  for (const g of groups.slice(0, MAX_GROUPS)) {
    const shown = g.occurrences.slice(0, MAX_OCCURRENCES).join(', ');
    const more = g.occurrences.length > MAX_OCCURRENCES ? `, +${g.occurrences.length - MAX_OCCURRENCES} more` : '';
    out.push(`  ${g.id} ×${g.occurrences.length}${g.divergent ? ' [divergent]' : ''} — ${shown}${more}`);
  }
  if (groups.length > MAX_GROUPS) {
    out.push(`  … +${groups.length - MAX_GROUPS} more duplicated id(s).`);
  }
  return out;
}
