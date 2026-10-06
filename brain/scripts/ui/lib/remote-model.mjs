// remote-model.mjs — what the page says about teammates' branches (#1201 D42).
// Pure, imported by the browser AND by node:test (D9): no clock (the caller
// passes `nowMs`), no DOM, no fetch. The ONE source of the wording, shared by the
// lane card, the "Remote work" panel and (through `resume-view.mjs`) the drawer.
//
// The author is "last commit by <name>" and nothing more: a git author name, no
// handle derived from an email, no email, and no per-agent identity (R3, AC3).

import { ago } from './banners.mjs';
import { resumeWording } from './resume-view.mjs';

const DAY_MS = 24 * 3600 * 1000;
/** A card shows at most this many lines for one issue; the rest are counted. */
const CARD_LINES = 2;

/** "last commit by <name>" — the only way this page names a person. */
export function authorLine(author) {
  return `last commit by ${author}`;
}

/** `ago` has no days (its scale stops at hours); a two-week-old branch reading "336 h ago" would be a riddle. */
export function tipAge(tipAt, nowMs) {
  const ms = nowMs - Date.parse(tipAt);
  return ms >= 2 * DAY_MS ? `${Math.round(ms / DAY_MS)} d ago` : ago(ms);
}

/** Newest tip first, then branch: the section already sorts, but the order is a promise of THIS view, so it does not depend on the producer. */
const newestFirst = (a, b) => (a.tipAt < b.tipAt ? 1 : a.tipAt > b.tipAt ? -1 : a.branch.localeCompare(b.branch));

const cardText = (e, nowMs, omitPrs = []) => ['on origin: ' + e.branch, e.pr && !omitPrs.includes(e.pr.number) ? `PR #${e.pr.number}` : null, authorLine(e.author), tipAge(e.tipAt, nowMs)].filter(Boolean).join(' · ');

/** One badge line: the text, and the resume wording only when the resume is not present. */
const cardLine = (e, nowMs, omitPrs) => ({ text: cardText(e, nowMs, omitPrs), resume: resumeWording(e.resume) });

/**
 * The lines a ticket's card carries for its remote branches: `{lines, more}`.
 * A section that could not be read gives no lines — the sections band says why.
 * `omitPrs` (#1312 D147): PR numbers the card already names in its review footer, so a card never names one twice.
 */
export function remoteBadges(section, issue, nowMs, { omitPrs = [] } = {}) {
  if (!section?.ok) return { lines: [], more: null };
  const mine = section.value.branches.filter((e) => e.issue === issue);
  const extra = mine.length - CARD_LINES;
  return { lines: mine.slice(0, CARD_LINES).map((e) => cardLine(e, nowMs, omitPrs)), more: extra > 0 ? `and ${extra} more` : null };
}

/**
 * The "Remote work" panel: joined entries whose issue is not on the board (with
 * why), and the unjoined group — collapsed by default, newest first, every row
 * with its age, none filtered by age (R8). A hidden branch (lane, merged, base) is in no
 * list and no count here (R1201-3); only the branches not read yet are said.
 *
 * @param {Set<number>|number[]} nodeNumbers the issues the board draws
 */
export function remotePanel(section, nodeNumbers, nowMs) {
  if (!section?.ok) return { ok: false, reason: section?.reason ?? 'the remote branches could not be read' };
  const onBoard = new Set(nodeNumbers);
  const { branches, deferred } = section.value;
  const unjoined = [...section.value.unjoined].sort(newestFirst);
  const offBoard = branches.filter((e) => !onBoard.has(e.issue));
  return {
    ok: true,
    value: {
      remoteWork: {
        count: offBoard.length,
        rows: offBoard.map((e) => ({ ...cardLine(e, nowMs), branch: e.branch, issue: e.issue, reason: `#${e.issue} is not an open ticket on the board` })),
      },
      unjoined: {
        count: unjoined.length,
        header: `unjoined branches (${unjoined.length})`,
        collapsedByDefault: true,
        rows: unjoined.map((e) => ({ branch: e.branch, age: tipAge(e.tipAt, nowMs), text: [e.branch, authorLine(e.author), tipAge(e.tipAt, nowMs)].join(' · ') })),
      },
      deferredNote: deferred > 0 ? `${deferred} branch${deferred === 1 ? '' : 'es'} not read yet` : null,
    },
  };
}
