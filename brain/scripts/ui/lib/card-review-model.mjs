// card-review-model.mjs — the review footer a lane card carries for its joined open PR (#1312). Pure, no DOM, no
// IO, imported by the browser and by node:test (D9). The verdict, rev and head come from `buildReviewTimeline`
// and nowhere else (D140); this module only joins its threads to issues and words them. It reads the sections
// the snapshot already serves and fetches nothing (R1312-7).

import { buildReviewTimeline } from './review-timeline.mjs';

const plural = (k) => `+${k} open PR${k === 1 ? '' : 's'}`;

/**
 * Where the verdict's head stands against the `origin/<branch>` tip THIS CLONE holds. Never "stale": the ref is
 * as of the last fetch and can lag the forge in either direction (D142).
 */
function headOf(round, thread, remoteChanges) {
  if (!round) return null;
  if (!round.headSha) return { sha7: null, tip: null, tipSha7: null, tipSha: null };
  const held = remoteChanges?.ok ? remoteChanges.value.branches.find((b) => b.branch === thread.headBranch) : undefined;
  if (!held) return { sha7: round.headSha7, tip: null, tipSha7: null, tipSha: null };
  return { sha7: round.headSha7, tip: held.sha === round.headSha ? 'same' : 'differs', tipSha7: held.sha.slice(0, 7), tipSha: held.sha };
}

/** The footer for one PR thread: `{pr, more, verdict, head, note, reason, text, title}`. */
function footerOf(thread, others, remoteChanges) {
  const round = thread.latest ?? null;
  const verdict = round ? { word: round.verdict, rev: round.rev, unknown: round.unknownVerdict } : null;
  const head = headOf(round, thread, remoteChanges);
  const note = thread.unreadable ? 'review thread unreadable' : round ? null : 'no verdict posted';
  const reason = thread.unreadable?.reason ?? null;
  const more = others.length > 0 ? plural(others.length) : null;

  const parts = [`PR #${thread.pr}`];
  const notes = [];
  if (verdict) {
    parts.push(`rev ${verdict.rev}`, verdict.unknown ? `${verdict.word} (unrecognised verdict)` : verdict.word);
    notes.push(`latest verdict on PR #${thread.pr}: ${verdict.word}, rev ${verdict.rev}`);
  }
  if (head) {
    parts.push(head.sha7 ? `head ${head.sha7}` : 'head not readable');
    notes.push(head.sha7 ? `the verdict judged head ${round.headSha}` : 'the verdict carried no readable head');
    if (head.tip === 'same') { parts.push('tip here'); notes.push(`origin/${thread.headBranch} in this clone is at the same commit (as of the last fetch; the forge may be ahead)`); }
    if (head.tip === 'differs') { parts.push(`origin tip here ${head.tipSha7}`); notes.push(`origin/${thread.headBranch} in this clone is at ${head.tipSha} (as of the last fetch; the forge may be ahead or behind, so this says nothing about which is newer)`); }
  }
  if (note) parts.push(note);
  if (reason) notes.push(`reason: ${reason}`);
  if (more) { parts.push(more); notes.push(`other open PRs: ${others.map((p) => `#${p}`).join(', ')}`); }
  return { pr: thread.pr, more, verdict, head, note, reason, text: parts.join(' · '), title: notes.length > 0 ? [parts.join(' · '), ...notes].join('\n') : parts.join(' · ') };
}

/** A footer for a PR whose threads were not read: the PR is named, the verdict is not invented. */
function unreadFooter(pr, others, reviews) {
  const failed = reviews?.pending !== true;
  const note = failed ? 'verdicts could not be read' : 'verdict not read yet';
  const reason = typeof reviews?.reason === 'string' ? reviews.reason : null;
  const more = others.length > 0 ? plural(others.length) : null;
  const text = [`PR #${pr}`, note, more].filter(Boolean).join(' · ');
  return { pr, more, verdict: null, head: null, note, reason, text, title: [text, reason ? `reason: ${reason}` : null, others.length > 0 ? `other open PRs: ${others.map((p) => `#${p}`).join(', ')}` : null].filter(Boolean).join('\n') };
}

/**
 * cardReviewIndex({prs, reviews, remoteChanges}) -> {show, byIssue}. Nothing is shown while `prs` is not
 * readable (D144); the highest-numbered open PR of an issue is the one named, the others are counted (D143).
 */
export function cardReviewIndex({ prs, reviews, remoteChanges }) {
  if (!prs?.ok) return { show: false, byIssue: new Map() };
  const prsByIssue = new Map();
  for (const p of prs.value) {
    if (p.issue === null || p.issue === undefined) continue;
    prsByIssue.set(p.issue, [...(prsByIssue.get(p.issue) ?? []), p.number].sort((a, b) => a - b));
  }
  const byIssue = new Map();
  const timeline = reviews?.ok ? buildReviewTimeline(reviews, prs) : null;
  const threads = new Map((timeline?.ok ? timeline.value.threads : []).map((t) => [t.pr, t]));
  for (const [issue, numbers] of prsByIssue) {
    const named = numbers[numbers.length - 1];
    const others = numbers.slice(0, -1);
    byIssue.set(issue, timeline?.ok && threads.has(named) ? footerOf(threads.get(named), others, remoteChanges) : unreadFooter(named, others, reviews));
  }
  return { show: true, byIssue };
}
