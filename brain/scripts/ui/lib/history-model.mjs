// history-model.mjs — merges merge/release/adr-amended events newest-first
// (#882 R882-5). Pure, imported by the browser and by node:test (D9): no
// `node:` builtin, no clock, no random, no fetch.
//
// REVIEW VERDICTS ARE DELIBERATELY EXCLUDED FROM THIS MODEL (design.md's
// D-numbered decision). No field anywhere in the data carries a review
// round's timestamp — `prReviews` returns `{state, author, body}` only,
// `archive/881/design.md`'s D14 already established this for the Reviews
// tab — so a verdict cannot be placed on a real timeline without
// fabricating an order. History links to the Reviews mode instead of
// rendering a second, undated projection of the same rounds (the same
// "no second projection of the same values" ruling `archive/881/design.md`
// made for the design's rejected `sources` tab).

import { row } from './governance-model.mjs';

/** A commit's PR URL, built only when BOTH a project and a PR number are
 * known — never a fabricated link built from one alone. */
function mergeSource(commit, project) {
  if (project && commit.prNumber) return { url: `https://github.com/${project}/pull/${commit.prNumber}` };
  return { sha: commit.sha };
}

function mergeEvent(commit, project) {
  return row({ kind: 'merge', date: commit.date, title: commit.subject, prNumber: commit.prNumber, source: mergeSource(commit, project) });
}

/** A tag carries no per-event provenance beyond its own name (already the
 * event's title) — `source: null` renders through `sourceStamp` as the
 * one honest "no source was recorded" label, never a fabricated one. */
function releaseEvent(tag) {
  return row({ kind: 'release', date: tag.date, title: tag.name, source: null });
}

function adrAmendedEvent(adr, amendment) {
  const title = adr.title ? `${adr.title} amended` : `${adr.path} amended`;
  return row({ kind: 'adr-amended', date: amendment.date, title, source: { path: adr.path } });
}

/** One event per ADR amendment that carries a date — an amendment with no
 * date is never placed on the timeline (never a fabricated position). An
 * unreadable `adrsSection` degrades to no adr-amended events at all, never
 * throwing — merge/release events from `history` stand on their own either
 * way (the same "one failed section never blanks another" discipline
 * `decisions-model.mjs`'s `driftWarningsOf` already established). */
function adrAmendedEvents(adrsSection) {
  if (!adrsSection?.ok) return [];
  const events = [];
  for (const adr of adrsSection.value ?? []) {
    if (!adr.ok || !Array.isArray(adr.amendments)) continue;
    for (const amendment of adr.amendments) {
      if (amendment?.date) events.push(adrAmendedEvent(adr, amendment));
    }
  }
  return events;
}

const byDateDesc = (a, b) => Date.parse(b.date) - Date.parse(a.date);

/**
 * buildHistoryModel({history, adrs, project}) -> {ok:true, value:{events}} |
 * {ok:false, reason}. `history.ok === false` passes its reason straight
 * through — the merge/release events derive from it, so an unreadable
 * `history` fails the whole view. `adrs` degrades independently (see
 * `adrAmendedEvents`). `project` (an `owner/repo` string) is the only
 * source of the merge event's PR URL; with no project known, a
 * PR-numbered commit still becomes an event, sourced to git instead
 * (never a fabricated forge link).
 *
 * @param {{history?: {ok:boolean, value?:{commits:Array, tags:Array}, reason?:string},
 *   adrs?: {ok:boolean, value?:Array, reason?:string}, project?: string|null}} opts
 */
export function buildHistoryModel({ history, adrs, project = null } = {}) {
  if (!history || typeof history !== 'object') return { ok: false, reason: 'no history section was given to History' };
  if (history.ok !== true) return { ok: false, reason: history.reason };

  const { commits = [], tags = [] } = history.value ?? {};
  const events = [
    ...commits.map((c) => mergeEvent(c, project)),
    ...tags.map(releaseEvent),
    ...adrAmendedEvents(adrs),
  ].sort(byDateDesc);

  return { ok: true, value: { events } };
}
