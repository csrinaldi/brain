# ADR-0034 — Memory travels on its own lane: records reach `main` on their own pull request, never the feature's

**Status**: Accepted
**Date**: 2026-09-09 — Cristian Rinaldi

## Context

Memory rides the feature's pull request today. A capture becomes a record
(`memory:save`), `memory:share` materializes it into `.memory/records/` before
`git push`, the `pre-push` hook re-runs `share` on every push regardless of
branch, and the record reaches `main` only when the feature PR does —
`memory:audit`'s baseline on `main @ 96cd30c8` (n=350, first-parent, since
2026-08-01): **p50 21.6 h, p90 399.7 h** learn→main.

Two costs follow directly from riding the feature branch, both measured
(`openspec/changes/issue-862-memory-lane/explore.md`):

- **Cross-contamination.** Across 82 worktrees of this clone, the same
  untracked record file sits in up to seven of them — `pre-push`'s `share`
  exports the whole machine's backend into every worktree that pushes, not
  just the one that captured the record.
- **Latency is the branch's, not the record's.** A record waits for review,
  CI, and the feature's own merge timeline — none of which measures anything
  about the record itself.

`issue-link` refuses a PR to `main` without a closing keyword to an approved
issue (`brain/scripts/governance/run-check.mjs:341-349`); no merge verb exists
on the VCS port (`vcs-contract.md` has `mrCreate` but no `mrMerge` or
auto-merge, on either provider); and `.memory/index.jsonl` is derived
(ADR-0017) but nothing today prevents two hosts from committing a regenerated
copy and racing on it. A **memory lane** — a pull request whose diff is
additions under `.memory/records/` only, opened from its own branch by a
collector that never checks out the main checkout — needs a ruling on each of
these before it can exist. This ADR is that ruling: `openspec/changes/issue-862-memory-lane/proposal.md`
tabled nine decisions (L1–L9) on 2026-09-09; all nine were ratified as
recommended, plus two conditions the maintainer added (C1, C2). Full text:
`openspec/changes/issue-862-memory-lane/design.md`.

## Decision

**Memory moves off the feature branch. A `memory/<host>-<date>` pull request,
built by a collector that never checks out a worktree, carries records to
`main` on its own timeline, merged without human review where the tier
allows it.**

### L1 — The lane is a governance class, not a convention

A PR is a **lane** only when *both* hold: its head branch matches
`^memory/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}(-\d+)?$`, **and** every diff
path is an addition under `.memory/records/`. Either alone is not enough —
the branch name is a claim, the path check (3.1c's `lane-paths`, a required
status context) is the proof. 3.1c (#889) teaches `issue-link` and `actor-check`
to recognise a lane above their default refusal (today `runIssueLinkCheck`,
`run-check.mjs:313`, and `evaluateActor`, `actor-check.mjs:671`, know no lane); the
pure evaluators stay context-unaware (ADR-0016 — the lane lives in the IO
wrapper, not the rule). A lane PR carries `Memory lane: <host> <date>` in its
body and closes no issue — the standing-issue alternative was rejected
because it reopens the #867 class (a PR that closes an issue it did not
actually resolve).

**Risk, named rather than assumed away:** the lane class is only as narrow as
`lane-paths` makes it. 3.1c must land the path check as a *required* context
in the same PR that teaches the gates the lane branch — never before, or a
branch named `memory/*` bypasses `issue-link` by name alone.

### L2 + C1 — Merge by tier, gated by a required secret scrub

| tier | `requiredReviews` | lane merge |
|---|---|---|
| `lite` | 0 | `mrAutoMerge` (2.5) enables auto-merge on green |
| `standard` / `regulated` | 1 | `mrAutoMerge` refuses — `{enabled:false, reason:'requires-human-approval'}`, never throws; the PR waits for a human approval instead of pretending one happened |

`mrAutoMerge` is new VCS-port surface (`vcs-contract.md`, after `mrCreate`):
GitHub `gh pr merge --auto --squash`; GitLab
`PUT merge_requests/{iid}/merge` with `merge_when_pipeline_succeeds=true`.

**C1 (the maintainer's condition, non-waivable).** The secret scrub (#469/#214
lineage, `brain/scripts/memory/lib/secret-scrub.mjs`) runs as its own **required**
status context, `lane-scrub`, over every added `.memory/records/*.jsonl`
path. Fail-closed, no bypass flag — the only escape hatch is the committed
`memorySecretAllowPatterns`. **A lane never auto-merges without a green
`lane-scrub`.**

Correction on any tier is a `supersedes` record (#805), never a force-push
and never a revert of a record — records are append-only
(`memory-backend-contract.md`).

### L3 — The index stays off the lane

The lane commits **records only**. `.memory/index.jsonl` is derived
(ADR-0017): `post-merge` regenerates it locally, and the next `memory:share`
on whatever PR touches memory refreshes the committed copy. The lag is made
audible by a `local-checks` **warning**, never a failure — *"index ≠
rebuild(records)"*. This is what lets two hosts' lane PRs both merge without
racing on the same file: reindex-before-merge was rejected precisely because
it does not remove that race, it only narrows the window.

### L4 + C2 — The collector: plumbing, no checkout, deterministic on divergence

A new `memory/lane/` directory under `brain/scripts/` (#887 creates it) — a
pure planner (`plan.mjs`) plus a thin IO shell (`collect.mjs`), the same seam shape as
`governance/postmerge/git-seam.mjs`. No worktree's working tree or index is
touched:

```
git worktree list --porcelain                        # every tree of this clone
git status --porcelain -- .memory/records             # per worktree, untracked/modified
git cat-file -e origin/main:.memory/records/<f>       # already on main? → skip
git hash-object -w --path .memory/records/<f> <abs>   # blob into the object db
GIT_INDEX_FILE=$tmp git read-tree origin/main
GIT_INDEX_FILE=$tmp git update-index --add --cacheinfo 100644,<oid>,.memory/records/<f>
GIT_INDEX_FILE=$tmp git write-tree
git commit-tree <tree> -p origin/main -m "memory: <host> <date> (<n> records)"
git push --no-verify origin <commit>:refs/heads/memory/<host>-<date>
```

**C2 (the maintainer's condition).** Candidates are keyed by basename.
Identical bytes across worktrees collapse to one copy. When copies
**diverge** (`source` is not hashed), the collector applies the **same
first-wins rule the reader already uses**
(`brain/scripts/memory/lib/duplicates.mjs:20-24` — earliest month file, earliest
physical line), with one added tiebreak because same-named copies tie on
month order: candidates are ordered by **lexicographic worktree path**, then
by physical line. Divergences are reported, never refused, in
`formatDuplicateReport`'s vocabulary — refusing a divergent duplicate was
rejected because it is a record brain's own producers write, and refusing
bricks `reindex`/`share`/`pull`/`save` on the very machine that needs them
most.

A dedicated `brain-memory` worktree was rejected: a second checkout on every
host the collector can leave dirty is a worse failure mode than plumbing that
touches nothing.

### L5 — Trigger and credential are separated

**Trigger**: the verb `brain:memory:ship`, invoked by (1) the session-end
hook, (2) `day:start`'s sweep for sessions that ended badly, (3) by hand.
**Never** by a feature branch's `pre-push` — that is the exact surface 3.1d
retires.

**Credential** (ADR-0033's poster-never-holds-a-credential shape, applied
here): the capturing session never holds the credential that pushes.
`brain:memory:ship` runs as a separate process; at `lite`, on a developer's
machine, it may use the ambient VCS identity (the human's own session opens
the lane PR). Unattended hosts hand `BRAIN_MEMORY_TOKEN` explicitly to the
ship process alone — `credential-env.mjs`'s `withoutCredentials` strips it
from everything else.

**Risk, named rather than assumed away:** `BRAIN_MEMORY_TOKEN` on unattended
hosts widens the credential surface ADR-0033 narrowed. It is scoped to the
ship process and asserted via `withoutCredentials` everywhere else — the same
discipline, not a new one.

### L6 / L7 — `memory-gate` is unchanged; the feature-PR surfaces retire, sequenced

`memory-gate` reads the PR **tree**, not the diff — a feature PR rebased on a
`main` that already carries the lane's record for its issue passes the scoped
gate **unchanged**. Only the PR template's wording changes (3.1d): from
*"captured with `memory:share`"* to *"captured as a record (`memory:save
--issue N`); it reaches `main` on the lane"*.

`pre-push:70`'s `share` call, `ticket.nextSteps.step3` (en/es),
`brain-save.mjs`, `contributor-scaffold.mjs:274`, and `day.done.checkCmd` are
the five feature-PR surfaces that make a record ride the branch today. They
retire in 3.1d, and **not before**: only after 3.1b's first scenario ("a
record does not wait for its feature") has passed, **and** after #874
(record-first: `memory:save` writes a record before any backend, under
`MEMORY_BACKEND=engram` too) has landed. Retiring them earlier would leave a
capture with nowhere to go the moment the lane is not yet proven.

### L8 — Doctrine

This ADR — a **new** decision, not an amendment to ADR-0002, because the lane
is a new governance mechanism with its own class of PR, not a refinement of
the two-layer memory model. `consolidation-protocol.md` §5 is rewritten to
describe the lane's actual flow; `openspec/README.md` rule 3 gains a lane
exception (task 5.3); ADR-0002 gains Amendment 2, pointing its canonical-flow
bullets at the lane. All four drafted under `brain-drafts/`, promoted by the
maintainer in one sitting — the same shape #863's six drafts became (PR
#875/#876).

### L9 — Targets are ratified, not claimed

`memory:audit` MUST report, at `lite`, **p50 ≤ 1 h, p90 ≤ 24 h** learn→main,
against the baseline **21.6 h / 399.7 h**. The exit is the command's own
number (#864 task 6.1), not a claim made here.

**The `--no-verify` push is deliberate and load-bearing, stated here rather
than buried in code (risk named, not hidden).** The collector pushes a
*computed* ref built with plumbing (`hash-object`/`commit-tree`) — no
worktree is ever checked out onto `memory/<host>-<date>`, so there is no
local `pre-push` hook invocation to run honestly in the first place, and
running `share` against the wrong tree on that push is exactly the
cross-contamination this ADR exists to stop. `--no-verify` is not a bypass of
review; it is the correct absence of a hook that has nothing to check.

## Consequences

- **Positive.** A record's time-to-`main` stops being coupled to its
  feature's review timeline; the lane's own tier decides the wait, if any.
- **Positive.** The collector reads worktrees without touching them — no
  checkout it can leave dirty, no second clone every host needs.
- **Negative.** Two required status contexts (`lane-paths`, `lane-scrub`)
  enter every clone's branch protection and CI workflow — one more thing a
  fork must configure correctly, same as every required check already there.
- **Negative, accepted.** The committed `index.jsonl` can lag `main`'s
  records between a lane merge and the next `memory:share`. `local-checks`
  makes the lag audible; nothing depends on the index being current, because
  every reader can rebuild it from records.
- **Deferred, not avoided.** Auto-merge without `supersedes` (#805) is a
  wait-and-hope story for corrections. #805 is a hard prerequisite of
  *enabling* auto-merge (2.5's verb can exist and be refused before then),
  not a nicety.

## Rejected alternatives

| rejected | reason |
|---|---|
| one issue per lane run (`issueCreate`) | an issue per run — noise that trains people to ignore issues |
| a standing memory issue, `Part of #N` | refused on `main` today (`run-check.mjs:341-349`); changing that reopens the #867 class |
| reindex-before-merge on the lane | two hosts still race on `index.jsonl` between rebase and merge — narrows the window, does not close it |
| a dedicated `brain-memory` worktree | a second tree on every host, and a checkout the collector can leave dirty |
| refusing a divergent duplicate | it is a record brain's own producers write; refusing bricks `reindex`/`share`/`pull`/`save` |
| amending ADR-0002 instead of a new ADR | the lane is a new governance mechanism, not a refinement of the two-layer model |
| auto-merge at `standard`/`regulated` | pretending a review happened; the wait is reported instead |

## Dependency order

```
2.5 mrAutoMerge ──► 3.1a collector ──► 3.1b push + PR ──► 3.1c paths + governance ──► 3.1d retire
                                          ▲                        ▲                     ▲
                        #805 supersedes ──┘        #874 record-first ──► 2.4 artifacts ──┘
```

Each slice is its own change dir, worktree and PR to `main` — stacked, no
tracker branch. 2.5 first: 3.1b cannot open-and-merge without the verb. #805
gates auto-merge's *enablement*, not 3.1a/3.1b's authorship, which may
proceed in parallel. #874 → epic task 2.4 gate 3.1c and 3.1d: manifest churn
would trip the path check, and `share` must already be "commit what is
already true" before `pre-push`'s export is removed.

## Open questions

None blocking. Two are deferred to 3.1c by design: the exact host of the
index-lag warning inside `local-checks`, and whether `lane-paths` also
tolerates a committed `index.jsonl` addition — L3 above rules records-only as
the default; 3.1c's implementer decides only if a concrete conflict forces
it.
