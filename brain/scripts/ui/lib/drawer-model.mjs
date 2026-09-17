// drawer-model.mjs — `GET /api/change/{issue}` turned into the four tabs the
// inspector renders (#881 PR 4 / B2, R881-8, A3). Pure, imported by the
// browser AND by node:test (D9).
//
// `change-route.mjs` already did the IO and the parsing; what is left is the
// last mile the DOM needs, and it is exactly the part that is easy to get
// quietly wrong:
//
//   * every entry carries a SOURCE STRING, never an object and never an
//     empty one — A3 asks for the path or the URL beside every value, so a
//     value whose source was lost says that instead of rendering a blank;
//   * a tab that failed keeps its reason AND its expected path (the "no
//     change dir" case names the glob an operator can paste into a shell);
//   * a review thread that could not be read is an ENTRY, not a skip —
//     skipping it reads as "no rounds were ever posted"
//     (`evidence-reader-empty-on-failure.md`, R881-9).
//
// One entry shape for all four tabs — `{title, detail, source, pending,
// done?, children?}` — so `app.js` renders every tab with one loop and has
// no per-tab branch to get wrong.

export const TAB_IDS = ['spec', 'tasks', 'workingMemory', 'reviews'];
const TAB_LABELS = { spec: 'Spec', tasks: 'Tasks', workingMemory: 'Working memory', reviews: 'Reviews' };

// A3: `sourceLabel` lives in provenance.mjs since #998; re-exported so every
// importer of this module keeps working. `sourceStamp` is additive (#998
// R998-2): `source` stays the same plain string every existing reader
// already gets, `sourceStamp` is the design's bracketed form the door's
// entries render from PR 2 on, with the href a forge/link chip may carry.
import { sourceLabel, sourceStamp } from './provenance.mjs';
export { sourceLabel };

function entry({ title, detail, source, pending = false, ...rest }) {
  return { title, detail, source: sourceLabel(source), sourceStamp: sourceStamp(source), pending, ...rest };
}

/** A failed tab: the reason stays, and so does whatever path the failure knew about. */
function failedTab(id, tabView, entries = []) {
  return { id, label: TAB_LABELS[id], ok: false, reason: tabView.reason, source: tabView.source ? sourceLabel(tabView.source) : null, entries, note: tabView.sourceNote ?? null };
}

function specEntries(cards) {
  return cards.map((card) => entry({
    title: `${card.id} — ${card.title}`,
    source: card.source,
    children: (card.scenarios ?? []).map((scenario) => entry({
      title: scenario.name,
      detail: `WHEN ${scenario.when ?? '(nothing stated)'} / THEN ${scenario.then ?? '(nothing stated)'}`,
      source: scenario.source,
      pending: scenario.complete !== true,
    })),
  }));
}

function taskEntries(items) {
  return items.map((item) => entry({
    title: item.text,
    // `change-route.mjs` attaches `{ok:false, reason}` per row when the blame
    // failed: the row still renders in full, and the missing attribution is
    // said here rather than folded into a silent "unknown".
    detail: item.attribution?.ok
      ? `${item.attribution.value.actor ?? 'unknown'}${item.attribution.value.ts ? ` at ${item.attribution.value.ts}` : ''}`
      : `attribution unavailable: ${item.attribution?.reason ?? 'no attribution was attached'}`,
    source: item.source,
    done: item.done === true,
    pending: item.done !== true,
  }));
}

function workingMemoryEntries(fields) {
  return Object.entries(fields).map(([name, field]) => entry({
    title: name,
    detail: field.ok ? String(field.value) : field.reason,
    source: field.source,
    pending: !field.ok,
  }));
}

/**
 * One child row per finding (#998 R998-5) — severity and id in the title,
 * the excerpt and cites in the detail. D14 originally read "no per-finding
 * anchor exists in this provider" — wrong, measured against PR #1006's
 * posted verdict (verdict.mjs's `hasUsableAnchor`, REQ-405-2): a finding
 * carrying `file`/`line` gets its OWN `{path, line}` source, rendered
 * through the same `sourceStamp`/`sourceLabel` helper as every other value
 * on this page; only a finding without one falls back to the round's own
 * source (the PR comment URL).
 */
function findingEntries(round) {
  return (round.findings ?? []).map((f) => entry({
    title: `${f.severity ?? 'unknown'} — ${f.id ?? '?'}`,
    detail: `${f.evidenceExcerpt ?? ''}${f.cites ? ` (cites ${f.cites})` : ''}`,
    source: f.file ? { path: f.file, line: f.line } : round.source,
  }));
}

function reviewEntries(rounds, unreadable) {
  const read = rounds.map((round) => entry({
    title: `#${round.pr} rev ${round.rev} — ${round.verdict}`,
    // `findingCount`, not `findings.length` (#998 R998-5): a malformed
    // verdict keeps `findings: []` with `findingCount: null` — reading
    // `.length` there would silently say "0 findings" for "uncomputable".
    detail: `${round.author ?? 'unknown author'}, ${round.findingCount === null ? 'unknown finding count' : `${round.findingCount} finding(s)`}${round.head_sha ? `, head ${round.head_sha}` : ''}`,
    source: round.source,
    children: findingEntries(round),
  }));
  // After the rounds that WERE read, never instead of them.
  const missed = unreadable.map((thread) => entry({
    title: `#${thread.pr} — unreadable`,
    detail: `this thread could not be read: ${thread.reason}`,
    source: thread.source,
    pending: true,
  }));
  return [...read, ...missed];
}

/**
 * buildDrawerModel(changeView) -> {ok:true, value:{issue, changeDir, tabs}} |
 * {ok:false, reason}
 *
 * @param {{ok:boolean, value?:object, reason?:string}} changeView the parsed `GET /api/change/{issue}` body
 */
export function buildDrawerModel(changeView) {
  if (!changeView || typeof changeView !== 'object') return { ok: false, reason: 'no change view was given to the drawer' };
  if (changeView.ok !== true) return { ok: false, reason: changeView.reason };
  const { issue, changeDir, spec, tasks, workingMemory, reviews } = changeView.value;

  const tabs = [
    spec.ok ? { id: 'spec', label: TAB_LABELS.spec, ok: true, reason: null, source: null, note: null, entries: specEntries(spec.value) } : failedTab('spec', spec),
    tasks.ok ? { id: 'tasks', label: TAB_LABELS.tasks, ok: true, reason: null, source: null, note: null, entries: taskEntries(tasks.value) } : failedTab('tasks', tasks),
    workingMemory.ok
      ? { id: 'workingMemory', label: TAB_LABELS.workingMemory, ok: true, reason: null, source: null, note: null, entries: workingMemoryEntries(workingMemory.value) }
      : failedTab('workingMemory', workingMemory),
    reviews.ok
      ? { id: 'reviews', label: TAB_LABELS.reviews, ok: true, reason: null, source: null, note: reviews.sourceNote ?? null, entries: reviewEntries(reviews.value ?? [], reviews.unreadable ?? []) }
      : failedTab('reviews', reviews, reviewEntries([], reviews.unreadable ?? [])),
  ];

  return { ok: true, value: { issue, changeDir, tabs } };
}
