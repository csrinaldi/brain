---
status: tasked
issue: 862
---

# Design: #862 — how the memory lane lands

Parent: #864 (memory 2.0), Wave 1 task 1.1. A **ruling ticket**: this document is the contract
the five slice tickets (2.5, 3.1a–d) link to. It implements nothing. Every decision below is
L1–L9 as ratified on 2026-09-09, plus the maintainer's two conditions C1 and C2.

## D0 — Tier discipline: drafts, not writes

`brain/core/**` and `brain/project/**` are Tier 2/3; `brain-writes-reviewed` and CODEOWNERS
enforce it at the PR. This change writes **drafts** under `brain-drafts/` (§8), exactly as #863
did. Nothing under `brain/`, nothing in code.

## L1 — The lane class in the gates

A PR is a **lane** when *both* hold: head branch matches `^memory/`, **and** 3.1c's path check
passes (additions under `.memory/records/` only). Either alone is not enough — the branch name
is a claim, the path check is the proof.

| gate | file:line | change (3.1c) |
|---|---|---|
| `issue-link` | `brain/scripts/governance/run-check.mjs:313` (`runIssueLinkCheck`) | a lane branch returns `{pass:true, lane:true}` immediately after the body-string guard at `:320-326` and **before** `issueLink(ctx.body)` at `:327`, so the default-branch closing-keyword refusal at `:341-349` is never reached |
| `actor-check` | `brain/scripts/vcs/actor-check.mjs:671` (`evaluateActor`) | the lane branch sits above the deny branch (`:757`) only for the `lite` distinct-act evidence; a denied identity still refuses |
| pure evaluators | `brain/scripts/governance/checks/issue-link.mjs:22` | **UNCHANGED** (ADR-0016: evaluators stay context-unaware; the lane lives in the IO wrapper) |
| `brain:audit` | `brain/scripts/brain-audit.mjs:326` (`evaluateMerge`), rows at `:334-344` | a `[LANE]` row beside `[PASS]`/`[SKIP]`; no `issueLink` failure is recorded for a lane merge |
| `diff-size`, `decision-gate`, `phase-order`, `brain-writes-reviewed` | — | green by construction (`.memory/**` is on `governance.ignoreList`; no `brain/`, no `openspec/`) |

Branch grammar: `memory/<host>-<YYYY-MM-DD>`, `<host>` = `os.hostname()` slugified to
`[a-z0-9-]`, collision suffix `-<n>`.
Regex: `^memory/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}(-\d+)?$`.

## L2 + C1 — Merge by tier, and the scrub that gates it

Tier is read from `brain.config.json:17` (`lite` here); `requiredReviews` per tier at
`brain/scripts/vcs/governance-tiers.mjs:265,277,292`.

| tier | `requiredReviews` | lane behaviour |
|---|---|---|
| `lite` | 0 | `mrAutoMerge` enables auto-merge on green |
| `standard` / `regulated` | 1 | `mrAutoMerge` **refuses**: `{ enabled:false, reason:'requires-human-approval' }` — the wait is reported, never hidden |

**C1 (required, non-waivable).** The secret scrub of the #469/#214 lineage runs as its own
**required status context** on the lane PR, `lane-scrub`, registered through `branchProtect`'s
`checks` array (`brain/core/methodology/vcs-contract.md:43`). It reuses
`brain/scripts/memory/lib/secret-scrub.mjs` — `scrubRecordsFile` (`:137`) over every added
`.memory/records/*.jsonl` path, patterns via `resolveSecretConfig` (`:56`) so a consumer's
`governance.memorySecretPatterns` extends the defaults (`:23-29`). Fail-closed, no flag; the
only bypass is the committed `memorySecretAllowPatterns`. A lane never auto-merges without a
green `lane-scrub`.

Correction on any tier is a `supersedes` record (#805), never a force-push or a revert of a
record.

## L3 — The index stays off the lane

The lane commits **records only**. `.memory/index.jsonl` is derived (ADR-0017): `post-merge`
regenerates it locally (`brain/scripts/hooks/post-merge:67` → `resolve-index`), and the committed
copy is refreshed by the next `memory:share` on whatever PR touches memory next. The lag is made
audible by a **warning**, never a failure, on the `local-checks` path (`repo:check` →
`brain/scripts/check-refs.mjs`, whose sole warn channel is at `:50`): *"index ≠
rebuild(records)"*. Two lanes from two hosts therefore never conflict — that is the whole point.

## L4 + C2 — The collector: plumbing, no checkout

`brain/scripts/memory/lane/` — a pure planner plus a thin IO shell, with `git` injected exactly
as `brain/scripts/governance/postmerge/git-seam.mjs:27,54` (`gitTry`/`gitOrThrow`) already does.

```
lane/plan.mjs    planLaneCommit({ worktrees, candidates, onMain })  → pure, unit-tested
                 → { files: [{ path, content }], duplicates, skipped }
lane/collect.mjs the shell: git in, git out, no logic worth a test of its own
```

The commands, in order:

```sh
git fetch origin main --quiet
git worktree list --porcelain                       # every tree of this clone
git -C <wt> status --porcelain -- .memory/records   # untracked/modified record files
git cat-file -e origin/main:.memory/records/<f>     # already on main? → skip
git hash-object -w --path .memory/records/<f> <abs> # blob into the object db
GIT_INDEX_FILE=$tmp git read-tree origin/main
GIT_INDEX_FILE=$tmp git update-index --add --cacheinfo 100644,<oid>,.memory/records/<f>
GIT_INDEX_FILE=$tmp git write-tree
git commit-tree <tree> -p origin/main -m "memory: <host> <date> (<n> records)"
git push --no-verify origin <commit>:refs/heads/memory/<host>-<date>
```

`--no-verify` is deliberate and load-bearing: the collector pushes a *computed ref*, never a
checked-out branch, and `brain/scripts/hooks/pre-push:70` would run `cli.mjs share` on that push
— re-exporting the whole backend into the tree the collector just read. That is the exact
surface 3.1d retires; until then the hook must not run on the lane's push.

**C2 — deterministic dedup.** Candidates are keyed by basename. When the same filename appears
in more than one worktree with **identical** bytes, one copy is taken. When the copies
**diverge** (`source` is not hashed — `format.mjs#computeRecordId`), the planner applies the
*same first-wins rule the reader uses*
(`brain/scripts/memory/lib/duplicates.mjs:20-24`, `lib/store.mjs:340,349,356`
`readRecords` — earliest month file, earliest physical line), with one added tiebreak because
copies share a filename and therefore tie on month order: **candidate copies are ordered by
lexicographic worktree path**, then by physical line. The winner is the first line per `id`.
Divergences are **reported, never refused**, in `formatDuplicateReport`'s vocabulary
(`duplicates.mjs:203-210`), marked `[divergent]`. Acceptance: the post-merge index rebuild
reports **zero new `[divergent]` groups attributable to the lane**.

## L5 — Trigger and credential

Trigger: a verb, `brain:memory:ship` — (1) the session-end hook, (2) `day:start`'s sweep for
sessions that ended badly, (3) by hand. **Never** `pre-push` of a feature branch.

Credential (ADR-0033:67, `:200-201` — the token stays on the environment axis): the capturing
session never holds it. `brain:memory:ship` is a separate process; at `lite` on a developer's
machine it may use the ambient VCS session (the human's identity opens the lane PR). Unattended
hosts hand `BRAIN_MEMORY_TOKEN` explicitly to the ship process;
`brain/scripts/lib/credential-env.mjs:158` (`withoutCredentials`) strips it from everything else.

## L6 / L7 — The gate, and the surfaces that retire

`memory-gate` reads the PR **tree**, not the diff (`run-check.mjs:80-87`, dispatch at `:476-489`)
— a feature PR rebased on a `main` that already carries the lane's record for its issue passes
the scoped gate **unchanged**. No change to the gate. Only the PR template's wording changes
(3.1d): from *"captured with `memory:share`"* to *"captured as a record (`memory:save --issue
N`); it reaches `main` on the lane"*.

3.1d's inventory: `brain/scripts/hooks/pre-push:70`; `brain/scripts/i18n/en.mjs:279`
(`ticket.nextSteps.step3`, and `es`); `brain/scripts/brain-save.mjs`;
`brain/scripts/vcs/contributor-scaffold.mjs:274`; `brain/scripts/i18n/en.mjs:88`
(`day.done.checkCmd`). It ships **after** 3.1b's first scenario and **after** #874 — only then is
`share` "commit what is already true" and `pre-push` has nothing left to export.

## The lane PR contract

| field | value |
|---|---|
| head | `memory/<host>-<YYYY-MM-DD>[-n]` |
| base | `main` |
| title | `memory: <host> <date> (<n> records)` |
| body line | `Memory lane: <host> <date>` — **no** issue reference, followed by `Records: <n>` and the file list |
| required checks | `lane-paths` (3.1c), `lane-scrub` (C1), `diff-size`, `local-checks` |
| passing by lane class | `issue-link`, `actor-check` |
| green by construction | `memory-gate`, `decision-gate`, `phase-order`, `brain-writes-reviewed` |
| merge | squash, via `mrAutoMerge`; `lite` auto, otherwise a human approval |

`mrAutoMerge` (2.5), sitting in `vcs-contract.md` immediately after `mrCreate` (`:33`) and gaining
a row in the Phase 3 adapter table (`:95-104`):

```
mrAutoMerge({ project, number, method = 'squash', apiBase?, token?, proxyUrl?, fetchImpl? })
  -> Promise<{ enabled: true, url } | { enabled: false, reason, error? }>
```

`reason` ∈ `'requires-human-approval' | 'unsupported' | 'transport'`. **Never throws** — the
port's discipline. GH: `gh pr merge <n> --auto --squash`. GL:
`PUT projects/{enc}/merge_requests/{iid}/merge` with `merge_when_pipeline_succeeds=true`.
Consumed by the lane and by nothing else.

## L8 — The doctrine drafts

New ADR number: the highest under `brain/project/decisions/` is **0033**, and #863's promotion
adds only amendments, so the lane takes **ADR-0034**.

| draft (`brain-drafts/`) | shape | promotion |
|---|---|---|
| `adr-0034-memory-travels-on-its-own-lane.draft.md` | **new ADR** | `brain:promote`'s new-ADR shape (`brain/scripts/lib/amendment-draft.mjs:4` — slice #378) |
| `consolidation-protocol.draft.md` | `brain-amendment/1`, doctrine, acts rewriting §5 (`consolidation-protocol.md:186-217`, the sentence at `:214`) | `brain:promote`, in-place (`amendment-draft.mjs:44,48`) |
| `adr-0002-amendment-2.draft.md` | `brain-amendment/1`, **ADR shape** (`amendment-draft.mjs:53` — one extra act), amending the canonical-flow bullets at `adr-0002:27-28` | `brain:promote` |
| `openspec-readme-rule-3.draft.md` | plain patch — `openspec/README.md:25` is **outside `brain/`**, so `brain:promote` does not apply | edited directly in task 5.3's PR |

Every amendment draft is run through `planAmendment` (`amendment-draft.mjs:681`) before the PR:
`ok`, every anchor matched exactly once.

**Ordering constraint (a real one):** #863 already drafts `adr-0002-amendment-1` and a
`consolidation-protocol` amendment for §3. #862's two amendments must be *planned against the
post-#863 text*, or their anchors miss. Re-run `planAmendment` after #863's promotion sitting.

## L9 — Targets

p50 ≤ 1 h, p90 ≤ 24 h learn→main at `lite`, measured by `npm run memory:audit` against the
baseline **21.6 h / 399.7 h** (n=350, first-parent, since 2026-08-01). The exit is 6.1's command,
not a claim.

## Contract / API impact

- **`vcs-contract.md`**: one new verb row (`mrAutoMerge`) plus its adapter-status row; both
  adapters (`brain/scripts/vcs/github.mjs`, `gitlab.mjs`) gain an implementation. Port surface
  grows; no existing verb changes.
- **Governance**: two new required status contexts (`lane-paths`, `lane-scrub`) enter
  `branchProtect`'s `checks` array and the CI workflow. `run-check.mjs` gains a lane
  classification in its IO wrapper; the pure evaluators are untouched (ADR-0016).
- **Record format, `memory-gate` logic, backend contract**: unchanged. Rule 3 of the backend
  contract (*"the backend owns no artifact the durable layer needs"*,
  `issue-863-backend-contract/brain-drafts/memory-backend-contract.md:52`) holds — the lane moves
  records, which is the durable layer itself, and needs no backend running anywhere.

## Alternatives discarded

| rejected | reason (from the proposal) |
|---|---|
| one issue per lane run (`issueCreate`) | an issue per run — noise that trains people to ignore issues |
| a standing memory issue with `Part of #N` | refused on `main` today (`run-check.mjs:341-349`); changing that reopens the #867 class |
| reindex-before-merge on the lane | two hosts still race on `index.jsonl` between rebase and merge |
| a dedicated `brain-memory` worktree | a second tree on every host, and a checkout the collector can leave dirty |
| refusing a divergent duplicate | it is a record brain's own producers write (`duplicates.mjs:56-96`); refusing bricks `reindex`/`share`/`pull`/`save` |
| amending ADR-0002 instead of a new ADR | the lane is a new mechanism with its own governance class |
| auto-merge at `standard`/`regulated` | pretending a review happened; the wait is reported instead |

## Risks

1. **The lane class is only as narrow as `lane-paths`.** If the path check is weaker than the
   exemption, `issue-link` is bypassable by branch name. 3.1c must land the path check as a
   *required* context in the same PR that teaches the gates the lane branch — never before.
2. **`--no-verify` on the collector's push** disables `pre-push` for that push. Justified until
   3.1d, but it is a hook bypass and must be stated in the ADR, not buried in code.
3. **Amendment anchor drift** against #863's promotion (§8). Mitigation: re-plan, do not hand-fix.
4. **Squash-merge and `brain:audit`.** The first-parent walk enumerates the whole line
   (`brain-audit.mjs:240-247`), so a squashed lane commit is audited; the `[LANE]` row must exist
   before the first lane merges or the audit reports a false `issueLink` failure.
5. **`BRAIN_MEMORY_TOKEN` on unattended hosts** widens the credential surface ADR-0033 narrowed.
   Scope it to the ship process; assert it via `withoutCredentials` everywhere else.
6. **Auto-merge without a working undo.** #805 (`supersedes`) is a hard prerequisite of enabling
   auto-merge, not a nicety.

## Dependency order

```
2.5 mrAutoMerge ──► 3.1a collector ──► 3.1b push + PR ──► 3.1c paths + governance ──► 3.1d retire
                                          ▲                        ▲                     ▲
                        #805 supersedes ──┘        #874 record-first ──► 2.4 artifacts ──┘
```

- **2.5** first: 3.1b cannot open-and-merge without the verb.
- **#805** before 3.1b's auto-merge is *enabled* (risk 6). 3.1a/3.1b may be written in parallel.
- **#874 → 2.4** before **3.1c** and **3.1d** (epic design §3, `tasks.md:33,38-40`): manifest
  churn would trip the path check, and `share` must already be "commit what is already true"
  before `pre-push`'s export is removed.
- Each slice is its own change dir, worktree and PR to `main`, stacked-to-main, no tracker branch
  (epic design §4).

## Open questions

- None blocking. Two are deferred to their slices by design: the exact host of the index-lag
  warning inside `local-checks` (3.1c), and whether `lane-paths` also tolerates an
  `index.jsonl` addition (epic `tasks.md:39` says it may; L3 says the lane commits records only —
  3.1c rules, and L3 is the default).
