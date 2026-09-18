// history.mjs — the merge/tag facts a History view timeline is built from
// (#882 R882-5). Pure parse, plus the edge: gatherHistoryFacts, reading
// through the same injected `_run` seam `release-debt.mjs` already uses —
// one more `git` call, not a new IO primitive.
//
// Either `git log` or `git tag` failing is this section's OWN {ok:false,
// reason} — never a partial commit list rendered as if it were the whole
// history (release-debt.mjs's own "an unknown must never be filed under a
// claim weaker than the one it prevented us from making" discipline,
// applied here to a whole section rather than one severity rung).

import { execFileSync } from 'node:child_process';

/** A trailing `(#N)` on a commit subject is a CITATION, not proof of a
 * squash-merged PR (fresh-context review of PR 4, blocker): measured
 * against this repository's own log, of 200 commits 147 carry a trailing
 * `(#N)`, and 17 of those resolve to `#882` — the issue itself, because
 * this ticket's own unsquashed commits cite the driving issue that way.
 * There is no textual signal separating a squash suffix from a
 * hand-written citation, so nothing downstream may assert "PR" from this
 * alone. A `(#N)` mid-subject is a citation to something else entirely,
 * not this commit's own reference, so the anchor is load-bearing. */
const CITED_REF = /\(#(\d+)\)\s*$/;

/** `git log --format='%H|%ai|%s'` output -> `{sha, date, subject, citedRef}`.
 * Splits on the first two `|` only — a subject itself may carry one.
 * `citedRef` is the bare number a trailing `(#N)` names — an issue XOR a
 * PR, whichever the number actually resolves to on the forge; never
 * asserted as one or the other here. */
export function parseCommitLog(text) {
  return String(text ?? '').split('\n').filter(Boolean).map((line) => {
    const i1 = line.indexOf('|');
    const i2 = line.indexOf('|', i1 + 1);
    const sha = line.slice(0, i1);
    const date = line.slice(i1 + 1, i2);
    const subject = line.slice(i2 + 1);
    const m = subject.match(CITED_REF);
    return { sha, date, subject, citedRef: m ? Number(m[1]) : null };
  });
}

/** `git tag --format='%(refname:short)|%(creatordate:iso-strict)'` output ->
 * `{name, date}`, in the order git already sorted them (`--sort=-creatordate`). */
export function parseTagList(text) {
  return String(text ?? '').split('\n').filter(Boolean).map((line) => {
    const i = line.indexOf('|');
    return { name: line.slice(0, i), date: line.slice(i + 1) };
  });
}

/**
 * gatherHistoryFacts({root, _run}) -> {ok:true, value:{commits, tags}} |
 * {ok:false, reason}. Never a thrown exception, and never a half-read
 * result folded into a "healthy" answer — either read failing fails the
 * whole section, said why.
 */
export function gatherHistoryFacts({ root, _run } = {}) {
  const run = _run ?? ((file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8' }));

  let commits;
  try {
    commits = parseCommitLog(run('git', ['log', '--format=%H|%ai|%s', '-n', '200']));
  } catch (err) {
    return { ok: false, reason: `git log could not be read: ${err?.message ?? err}` };
  }

  let tags;
  try {
    tags = parseTagList(run('git', ['tag', '--sort=-creatordate', '--format=%(refname:short)|%(creatordate:iso-strict)']));
  } catch (err) {
    return { ok: false, reason: `git tag could not be read: ${err?.message ?? err}` };
  }

  return { ok: true, value: { commits, tags } };
}
