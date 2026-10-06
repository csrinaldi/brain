---
status: approved
issue: 1312
---

# Spec — cards-show-pr-and-verdict (issue 1312)

## Delta requirements

**R1312-1 — A joined PR is named.** A card drawn by `renderNodeCard` whose issue has at least one
entry in a readable `prs` section (`prs[].issue === node.number`) carries a review footer, and
that footer names the PR as `PR #<n>`. The join is `prs[].issue`, which `snapshot.mjs` derives
with `issueOfBranch`. The footer does not need `remoteChanges` to name the PR.

**R1312-2 — The latest verdict and its rev.** When the PR's review thread is readable and holds at
least one parsed verdict, the footer shows the verdict word and `rev <n>` of the LAST verdict in
the thread. That is the same `latest` that `buildReviewTimeline` derives. A verdict word outside
`KNOWN_VERDICTS` is shown verbatim and marked unrecognised. It is never rendered as if it were
known.

**R1312-3 — No verdict is a fact.** A readable thread with no parsed verdict says `no verdict
posted`. An unreadable thread (`reviews[].ok === false`) says `review thread unreadable` and keeps
the reason as the hover title. Neither case shows a verdict word.

**R1312-4 — Head honesty.** The footer names the head the verdict judged (7 characters). When
`remoteChanges` is readable and holds a branch whose name equals the PR's `headBranch`:
- the same SHA → the verdict is marked as on the branch tip held here;
- a different SHA → the footer names both SHAs, as the verdict head and the tip of `origin/<branch>`
  held here, and calls neither "current" nor "stale" in the forge's terms (ruled 2026-10-05, (a)).
When no such branch is readable, the footer names only the verdict head and makes no comparison.

**R1312-5 — Several open PRs.** When more than one open PR joins one issue, the footer names
exactly one of them and counts the rest as `+<k> open PR(s)`, as the highest-numbered PR (ruled 2026-10-05, (e)).
It never silently drops one.

**R1312-6 — Nothing read, nothing shown.** When `prs` is pending, idle or failed, the card has no
review footer. The sections band and the In flight notices already say why. When `prs` is readable
but `reviews` is not, the footer names the PR and says `verdict not read yet` while `reviews` is
pending, or `verdicts could not be read` when it failed. It shows no verdict. A card whose issue
joins no PR has no footer.

**R1312-7 — No new derivation, no new read.** The footer is computed by a pure module from the
served `prs`, `reviews` and `remoteChanges` sections, through `buildReviewTimeline`. It makes no
fetch, and no render waits on the forge.

**R1312-8 — Tasks stay where they are.** The footer shows no tasks count. Tasks progress stays in
the SDD strip, through `progressLabel` (#1199).

**R1312-9 — The card does not name the PR twice.** When the review footer names PR `#n`, the
remote-branch line on the same card for that PR's branch drops its `PR #n` part. The Remote work
panel is unchanged. (ruled 2026-10-05, (d)).

## Scenarios

- **S1** GIVEN `prs` holds `{number: 885, issue: 881}` and thread 885 holds verdicts rev 1 APPROVE
  and rev 2 REVISE, WHEN card #881 renders, THEN its footer reads `PR #885 · rev 2 · REVISE` and
  names the head of rev 2.
- **S2** GIVEN PR 885 joins #881 and its thread is `{ok:true, verdicts:[]}`, THEN the footer reads
  `PR #885 · no verdict posted`.
- **S3** GIVEN thread 885 is `{ok:false, reason:'HTTP 502'}`, THEN the footer reads
  `PR #885 · review thread unreadable` and its title carries `HTTP 502`.
- **S4** GIVEN the latest verdict has `head_sha` A and `remoteChanges` holds branch
  `feat/issue-881-x` (the PR's `headBranch`) at SHA B ≠ A, THEN the footer names `A7` as the
  verdict head and `B7` as the tip held here. With B = A, the footer marks the verdict as on the
  tip held here. With no matching branch, the footer names `A7` only.
- **S5** GIVEN `prs` is `{ok:false, pending:true}`, THEN no card has a review footer, and the
  first render completes with no forge call.
- **S6** GIVEN `prs` is readable and `reviews` is `{ok:false, pending:true}`, THEN the footer reads
  `PR #885 · verdict not read yet`.
- **S7** GIVEN PRs 900 and 910 both join #881, THEN the footer names PR 910 (the highest number)
  and reads `+1 open PR`.
- **S8** GIVEN #1230 carries no `status:approved` label and no open PR joins it, THEN its card
  shows the Awaiting review chip and no footer.
- **S9** GIVEN the latest verdict word is `MAYBE`, THEN the footer shows `MAYBE` marked
  unrecognised.
- **S10** GIVEN PR 885 joins #881 and `remoteChanges` holds its branch with `pr: {number: 885}`,
  THEN the card text contains `PR #885` exactly once.
