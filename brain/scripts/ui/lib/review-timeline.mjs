// review-timeline.mjs — the reviews mode's own model (#998 R998-5). Pure, no
// DOM, no IO, imported by the browser and by node:test (D9). `reviewRows`
// (status/snapshot.mjs) already parsed every verdict and shaped its findings
// (`{id, severity, evidenceExcerpt, cites, file, line}` — `file`/`line` ARE
// real emitted fields, `verdict.mjs`'s `hasUsableAnchor`/REQ-405-2); this
// module only groups what it already produced into a thread per PR, oldest
// round first, plus the verdict queue — no parsing happens here.

/** Whatever a verdict declared, grouped — never filtered against a closed vocabulary (R998-5: an unknown severity is said, never dropped). */
function bySeverity(findings) {
  const counts = {};
  for (const f of findings) {
    const key = f.severity ?? 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * A finding's own anchor as a provenance object (D14, amended — a
 * per-finding anchor DOES exist when the verdict carried one): `{path,
 * line}` when `file` is present, `null` otherwise — never dropped, only
 * `sourceStamp`/`sourceLabel` (provenance.mjs) turn a `null` into the said
 * "no source was recorded" text at render time, same as every other value.
 */
function findingSource(f) {
  return f.file ? { path: f.file, line: f.line } : null;
}

function shapeRound(v) {
  const findings = v.findings.map((f) => ({ ...f, source: findingSource(f) }));
  return {
    rev: v.rev,
    verdict: v.verdict,
    headSha7: typeof v.head_sha === 'string' ? v.head_sha.slice(0, 7) : null,
    author: v.author,
    findings,
    // Carried forward, never dropped (#1009 cold review finding 1): a
    // malformed findings block reaches here as {findings: [], findingCount:
    // null, malformed: [...]} (reviewRows) — losing either field makes this
    // round indistinguishable from a clean verdict with zero findings.
    findingCount: v.findingCount ?? null,
    malformed: v.malformed ?? [],
    bySeverity: bySeverity(findings),
  };
}

/** A thread's rounds + verdict state, from its `reviewRows` row (or its absence). */
function threadState(reviewRow) {
  if (!reviewRow) return { rounds: [], latest: null, noRound: true };
  if (reviewRow.ok === false) return { rounds: [], latest: null, noRound: false, unreadable: { reason: reviewRow.reason } };
  const rounds = reviewRow.verdicts.map(shapeRound);
  return { rounds, latest: rounds.at(-1) ?? null, noRound: rounds.length === 0 };
}

/** The two "waiting on a verdict right now" cases (R998-5) — never an unreadable or an APPROVE-latest thread. */
function waitingOn(thread) {
  if (thread.noRound) return 'no round posted';
  if (thread.latest?.verdict === 'REVISE') return thread.latest.headSha7;
  return null;
}

/**
 * buildReviewTimeline(reviewsSection, prsSection, {issue}) -> {ok:true,
 * value:{threads, queue, totals}} | {ok:false, reason} — the failed
 * section's own reason, whichever of `prs`/`reviews` failed first.
 *
 * @param {{ok:boolean, value?:Array, reason?:string}} reviewsSection snapshot.reviews
 * @param {{ok:boolean, value?:Array, reason?:string}} prsSection snapshot.prs
 * @param {{issue?: number}} [opts] restrict the timeline to one issue's PR threads
 */
export function buildReviewTimeline(reviewsSection, prsSection, { issue } = {}) {
  if (!prsSection?.ok) return { ok: false, reason: prsSection?.reason ?? 'no PR section was given to the timeline' };
  if (!reviewsSection?.ok) return { ok: false, reason: reviewsSection?.reason ?? 'no reviews section was given to the timeline' };

  const reviewsByPr = new Map(reviewsSection.value.map((row) => [row.pr, row]));
  const prs = issue === undefined ? prsSection.value : prsSection.value.filter((p) => p.issue === issue);

  const threads = prs
    .map((p) => ({ pr: p.number, issue: p.issue, title: p.title, headBranch: p.headBranch, ...threadState(reviewsByPr.get(p.number)) }))
    .sort((a, b) => a.pr - b.pr);

  const queue = threads
    .filter((t) => waitingOn(t) !== null)
    .map((t) => ({ pr: t.pr, issue: t.issue, title: t.title, wait: waitingOn(t) }));

  const totals = { threads: threads.length, queue: queue.length, unreadable: threads.filter((t) => t.unreadable).length };

  return { ok: true, value: { threads, queue, totals } };
}
