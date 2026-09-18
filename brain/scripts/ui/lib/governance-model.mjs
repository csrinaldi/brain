// governance-model.mjs — the governance sub-nav table and the shared row
// helper every one of this ticket's view builders reuses (#882 R882-1).
// Pure, imported by the browser and by node:test (D9): no `node:` builtin,
// no clock, no random, no fetch.

import { sourceLabel, sourceStamp } from './provenance.mjs';

/** The five governance sub-views, in the order the issue body lists them — the whole sub-nav, drawn straight from this table (mirrors view-model.mjs's MODES for the four top-level modes). */
export const GOVERNANCE_VIEWS = Object.freeze([
  Object.freeze({ id: 'roadmap', label: 'Roadmap' }),
  Object.freeze({ id: 'decisions', label: 'Decisions' }),
  Object.freeze({ id: 'anti-patterns', label: 'Anti-patterns' }),
  Object.freeze({ id: 'history', label: 'History' }),
  Object.freeze({ id: 'actors', label: 'By actor' }),
]);

export const GOVERNANCE_VIEW_IDS = Object.freeze(GOVERNANCE_VIEWS.map((view) => view.id));

/**
 * The said sentence a sub-view not yet built renders instead of an empty
 * area (never empty-on-failure), mirroring view-model.mjs's own
 * PLACEHOLDERS table for the four top-level modes. `roadmap` is `null`
 * from this PR on: it draws real content starting here. The other four
 * name the PR of this ticket's own chain that brings them, updated by
 * each of that chain's PRs as they land.
 */
export const GOVERNANCE_PLACEHOLDERS = Object.freeze({
  roadmap: null,
  decisions: 'the decisions view is not built yet — it lands in PR 2 of #882',
  'anti-patterns': 'the anti-patterns view is not built yet — it lands in PR 3 of #882',
  history: 'the history view is not built yet — it lands in PR 4 of #882',
  actors: 'the by-actor view is not built yet — it lands in PR 5 of #882',
});

/**
 * row({title, detail, source, ...rest}) -> {title, detail, source, sourceStamp, ...rest}.
 * One entry shape reused by every governance view builder: `source` (the
 * plain label) and `sourceStamp` (the bracketed stamp) are both derived
 * from the SAME `source` input, through provenance.mjs's own shapers —
 * never a second provenance shaper for one value (R882-1).
 */
export function row({ title, detail, source, ...rest }) {
  return { title, detail, source: sourceLabel(source), sourceStamp: sourceStamp(source), ...rest };
}
