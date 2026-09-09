---
status: tasked
issue: 862
---

# Proposal: #862 — the memory lane

Parent: #864 (memory 2.0), task 1.1 (Wave 1). A **ruling ticket**: it records the lane's
contract as doctrine and files the four Wave 3 tickets (3.1a–d) plus 2.5. It implements
nothing.

## What

Memory stops riding the feature's pull request. A **memory lane** is a pull request whose
diff is additions under `.memory/records/` only, opened from a `memory/<host>-<date>` branch
by a collector that never checks out the main checkout, and merged without human review
where the tier allows it. Feature PRs carry no records; the surfaces that made them do so are
retired.

## Decisions requested

### L1 — The governance class of a lane PR

`issue-link` refuses a PR to `main` without a closing keyword to an approved issue, and a
closing keyword closes the issue on merge.

| option | what it means | cost |
|---|---|---|
| **(a) a lane class, narrowly defined** | `issue-link` (and `actor-check`) recognise a PR as **lane** when its head matches `^memory/` **and** 3.1c's path check passes (additions under `.memory/records/` only). A lane PR carries `Memory lane: <host> <date>` in its body, no issue. Any other path in the diff → not a lane → the normal rules apply | two gates gain a branch: the exemption is exactly as wide as the path check makes it safe |
| (b) one issue per run | the collector opens an issue via `issueCreate` and closes it with the PR | an issue per lane run — noise that trains people to ignore issues |
| (c) a standing memory issue | every lane PR says `Part of #N` | refused on `main` today; changing that reopens the #867 class |

**Recommendation: (a).** `brain:audit` post-merge reports no `issueLink` failure for lane merges
(task 3.1c); `diff-size`, `decision-gate`, `phase-order`, `brain-writes-reviewed` are green by
construction.

### L2 — Merge rule by tier

| tier | `requiredReviews` | lane merge |
|---|---|---|
| `lite` | 0 | **auto-merge** on green checks (`mrAutoMerge`, task 2.5) |
| `standard` / `regulated` | 1 | the lane PR **waits for a human approval**; `mrAutoMerge` refuses rather than pretending (2.5's contract) |

**Recommendation: as tabled.** Correction on any tier is a `supersedes` record (#805 — the
undo, a prerequisite of auto-merge).

### L3 — The index

| option | what it means | cost |
|---|---|---|
| **(a) index off the lane** | the lane commits **records only**. `index.jsonl` is derived: `post-merge` already regenerates it locally (`resolve-index`); the committed copy is refreshed by the next `memory:share` (which rebuilds it) on whatever PR touches memory next | the committed index can lag `main`'s records; a `local-checks` warning "index ≠ rebuild(records)" makes the lag visible |
| (b) reindex-before-merge | the collector rebases on `origin/main`, reindexes, commits both | two hosts' lanes still race on the same file between rebase and merge |

**Recommendation: (a).** Records are the truth; an index that lags is a stale cache, a
conflicting index is a stopped lane. Under `plainfiles` a reader rebuilds it anyway.

### L4 — The collector's mechanism

| option | what it means | cost |
|---|---|---|
| **(a) plumbing, no checkout** | enumerate `git worktree list`; gather untracked `records/*.jsonl` absent from `origin/main` (dedup by filename); `hash-object -w` each, build a tree on `origin/main` with a temporary index, `commit-tree`, push `refs/heads/memory/<host>-<date>` | touches no worktree, needs no branch checked out anywhere, atomic; ~80 lines |
| (b) a dedicated `brain-memory` worktree | copy files in, commit, push | a second tree every host must have, and a checkout the collector can leave dirty |

**Recommendation: (a).** After the lane merges, the copies in worktrees become tracked on the
next pull; until 3.1d retires `pre-push`'s export they are re-created and re-deduped — harmless.

### L5 — Trigger and credential

- **Trigger**: a verb, `brain:memory:ship`, invoked (1) by the session-end hook, (2) by
  `day:start`, (3) by hand. Never by `pre-push` of a feature branch.
- **Credential** (ADR-0033): the capturing session never holds it. `brain:memory:ship` is a
  separate process; at `lite` on a developer's machine it may use the ambient VCS session
  (the human's identity opens the lane PR); for unattended hosts, `BRAIN_MEMORY_TOKEN` on the
  environment axis, handed explicitly to the ship process (`withoutCredentials` for everything
  else).

**Recommendation: as stated.** The session-end hook is the trigger that meets the latency
target; `day:start` is the sweep for sessions that ended badly.

### L6 — `memory-gate` under the lane

Measured: the gate reads the PR tree's `.memory/records/`, not the diff. A feature PR rebased
on a `main` that already holds the lane's record for its issue passes the scoped gate
**unchanged**. **Recommendation: no change to the gate; the PR template's memory line changes
wording** (3.1d) from "captured with `memory:share`" to "captured as a record (`memory:save
--issue N`); it reaches `main` on the lane".

### L7 — Retiring the feature-PR surfaces (3.1d)

`pre-push:70` (`share` on feature branches), `ticket.nextSteps.step3` (en/es), `brain-save.mjs`,
`contributor-scaffold.mjs:274`, `day.done.checkCmd`. **Recommendation: 3.1d ships after 3.1b's
first scenario passes and after #874 (record-first) — `share` is then "commit what is already
true" and `pre-push` has nothing to export.**

### L8 — Doctrine

**Recommendation: a new ADR** (*"Memory travels on its own lane"*) rather than an amendment —
it is a new mechanism with its own governance class — plus `consolidation-protocol.md §5`
rewritten, `openspec/README.md` rule 3's lane exception (5.3), and ADR-0002's canonical-flow
bullets amended to point at the lane. Drafts under `brain-drafts/`, promoted by the maintainer.

### L9 — Targets

**Recommendation: ratify** p50 ≤ 1 h, p90 ≤ 24 h learn→main at `lite`, measured by
`memory:audit` against the baseline (21.6 h / 399.7 h).

## Tickets this ruling files

- **2.5** `mrAutoMerge` port verb — GitHub `gh pr merge --auto --squash`, GitLab
  merge-when-pipeline-succeeds; refuses when `requiredReviews > 0`; never throws.
- **3.1a** collector (L4) — `brain/scripts/memory/lane/collect.mjs`, plumbing, pure core + seams.
- **3.1b** push + PR (L5) — through the port (`mrCreate` + 2.5), credential rule, PR body per L1.
- **3.1c** path restriction + lane class (L1) — a CI check as required context; `issue-link`/
  `actor-check` lane branch; `brain:audit` lane rows; the "two lanes, one index" rule (L3).
- **3.1d** retire the feature-PR surfaces (L7) + template wording (L6).

## Scope

- Includes: the ruling; the ADR draft and the three doctrine drafts; the five tickets; the
  epic's tasks updated with their numbers.
- Does not include: any implementation.

## Non-goals

- A gate on feature PRs. A change to `memory-gate`'s logic. Any dependency on the backend.
