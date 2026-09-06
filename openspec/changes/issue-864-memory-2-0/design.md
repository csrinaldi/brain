---
status: tasked
issue: 864
---

# Design: #864 — memory 2.0

> **Revised 2026-09-05** (gap review of PR #867 — see §7). Revisions are marked **[rev]**.

## 1. The frame every slice is designed inside

**Records are the concept; the backend is a derived index** (ADR-0002; ADR-0017:13). The
test of any design choice in this epic: *does it hold under `MEMORY_BACKEND=plainfiles`?* If
a property holds only because engram's store is machine-global, it is a leak of one
implementation into the concept, not a feature of memory. Same-machine "instant sharing" is
the canonical example: it fails the test, so no slice may rely on it.

Consequences already drawn from the frame:

- Records are the **only** channel. Their learn→main latency is memory's latency.
- The records layer is concurrency-safe by construction (one file per record, content-hash
  id). Every concurrency defect measured — import race, upsert-loss, manifest churn — lives
  in the adapter. No slice fixes an adapter defect by touching the records layer, or the
  reverse.
- Provenance lives **in the record** at capture, never in a backend's session id.
- **[rev]** The store an agent reasons about is its worktree's `records/` plus `origin/main`
  (spec.md Vocabulary). Nothing in the design may assume an agent can see another host's
  unmerged records — that is the same-machine leak in a different coat.

## 2. The two rulings, and their shape

### D1 — the memory lane (#862)

Memory leaves the feature's pull request and gets its own, still a PR:

- trigger: session end or a cadence — never `pre-push` of a feature branch;
- branch `memory/<host>-<yyyy-mm-dd>` (grammar finalised in #862);
- path-restricted to additions under `.memory/records/` + regenerated `index.jsonl`;
- validated by what exists — hash integrity (`rebuildIndex`) and secret scrub — and
  auto-merged on green **where the tier allows it** (below); size-exempt already
  (`brain.config.json:21`);
- review is asynchronous: disagreement is a `supersedes` record. **#805 is therefore a
  prerequisite of auto-merge**, not a neighbour.

**[rev] The mechanics the first version left implicit — each one is a slice or a ruling:**

| concern | shape | owner |
|---|---|---|
| governance surface | `issue-link` on `main` accepts only `Closes #N` against an approved issue (`run-check.mjs:346` refuses `Part of #N` on the default branch) and a lane PR has no issue: the ruling picks a `memory/*` branch-grammar exemption in `run-check.mjs`/`governance-tiers.mjs`, or a standing approved memory issue the lane closes idempotently; `actor-check`/`phase-order`/`decision-gate` must be green on a records-only diff without a waiver; `brain:audit`'s `issueLink` must not fail on lane merges | #862 ruling; 3.1c |
| tier | `lite`: auto-merge on green (`requiredReviews: 0`). `standard`/`regulated`: the lane PR waits for one approval; latency target applies to the pipeline half, the human wait is reported apart | #862 ruling |
| credential | the push and the PR/auto-merge go through the VCS port; the capturing session never holds the poster token (ADR-0033). Needs one new port verb — `mrAutoMerge` (GitHub: enable auto-merge; GitLab: merge-when-pipeline-succeeds) — on both providers | 2.5 (new ticket) |
| collector | records from **every worktree of the clone** on the host are gathered into one lane branch; the lane commit is made without checking the lane branch out in the main checkout (`pre-commit` #788 refuses task branches there) — plumbing (`commit-tree`) or a dedicated worktree; after merge the worktree copies are removed or marked shipped | 3.1a |
| path restriction | a CI check, required status context, refusing by path (`staged-records-check.mjs` has the shape); branch protection cannot express it | 3.1c |
| `index.jsonl` | two hosts' lanes both regenerate it and the forge cannot reindex. Ruling picks one: (i) the lane's merge flow updates the branch and runs `memory:resolve-index` before auto-merge, or (ii) the index leaves the lane and `post-merge` regenerates it on `main` | #862 ruling |
| retired surfaces | `PULL_REQUEST_TEMPLATE.md` memory line (via `contributor-scaffold.mjs`), `ticket.nextSteps.step3` (en/es), `brain-save.mjs`, `pre-push`'s `share` for feature branches | 3.1d |
| `memory-gate` | the issue-scoped mode must not `MISS` on a feature PR whose records are on `main` via the lane and not in the branch; ruling: read base∪head, or state another rule | 3.1d |
| #795 | its acceptance 1 (a ruling `memory-presence.mjs`'s header can cite) and 3 (the backend→file lag named, the export trigger stated) are answered in 3.1, not dropped with the close | 5.1 |
| manifest churn | the path restriction refuses a `manifest.json` change, and engram's `share` churns it today — **3.1 depends on 2.4** (artifact retirement), not only on #805 | graph §3 |

Rejected: *push straight to `main`* — 62% of the store is claims (`architecture` +
`decision`), ADR-0014 §9 and `pre-commit` (#788) refuse `main`, and the undo does not exist
yet. Rejected: *wait for the feature* — that is the measured p50 10.9 h / p90 400 h, and the
loss of every unmerged branch's memory.

### D2 — the backend contract (#863)

A document beside `vcs-contract.md`, cited by every adapter:

1. hydration from records is idempotent by record id;
2. the backend is never the first home of a capture — the agent's write produces a record
   (the `memory:save` path), and the backend is hydrated from it;
3. the backend owns no artifact the durable layer needs — manifest, chunks, **legacy chunks**,
   symlink, merge driver are the adapter's private business and leave the tree and the hooks
   (#247 becomes the path, not the tail).

Engram's adapter is measured against it and fails 1 and 2 today. #820's **fix** is
compliance with 1; what ships under #820 now is mitigation (skip-and-say around `import`)
and must say so.

**[rev] What D2 also has to say, and the first version did not:**

- **Doctrine.** ADR-0002 states *"the manifest stays committed; the merge driver is
  mandatory"* and ADR-0004 *"the manifest remains required for all backends"*. D2 contradicts
  both. The ruling lands as an amendment to each (1.2), not as a contract document that
  silently outranks two accepted ADRs.
- **The artifact retirement is a slice, not a consequence.** Tracked today:
  `.memory/manifest.json`, 48 files under `.memory/legacy/*.jsonl.gz` (no reader but
  `migrate-v1`'s move), `.gitattributes:5` (`merge=engram-manifest`),
  `merge-engram-manifest.mjs`, `lib/memory-manifest.mjs` (session-start step 1),
  `bootstrap.sh`'s driver registration, the `.engram` symlink in `engram.mjs#setup`. #247 owns
  chunks only, and half of it is done (PR #258 migrated the readers; materialisation is still
  live). Retirement of the rest is 2.4, a new ticket.
- **The capture door.** Agents write through the engram MCP (`mem_save`), which
  `agent-authorities.md` Tier 1 sanctions and `AGENTS.md` compiles. Record-first is unreachable
  while that door writes into the backend. 3.2 owns the door: wrap it (the MCP tool writes a
  record and hydrates), retire it from the agent's tool set, or declare the engram adapter
  non-conforming on that point — and the ruling says which, with `agent-authorities.md`
  rewritten to match.
- **`supersedes` is declared, never inferred.** The record has no `topic` field
  (`plainfiles.save` drops `scope`/`topic` loudly, by design). Two sessions on one topic yield
  two records; the later carries `supersedes` only because its writer passed
  `--supersedes <id>` after reading the earlier from its store. Adding `topic` to the format
  would be an ADR-0017 amendment and is refused (§6).
- **Provenance at capture is stricter than "not `@legacy`".** `actor` is a handle, never a
  branch name (28 of the last 94 records are branch names); `actorKind` is measured, not
  `PLAINFILES_ACTOR_KIND`. If #738 rules that the kind is sometimes unknowable, `unknown`
  enters the schema by ADR-0017 amendment. 2.2 owns it.

## 3. Dependency graph

```
0.0 reopen #864 ─────────────────────────────────────────────────────────────┐
#820 mitigation ──────────────────────────────────────────────────────────────┤
                                                                              │
#862 lane ruling ──► #805 supersedes ──┐                                      │
                 └──► 2.5 mrAutoMerge ──┼──► 3.1a collector ─► 3.1b push/PR ──┼──► 6.1 exit
                 └──► #738 provenance ──┤    3.1c path+gov ─► 3.1d surfaces   │   (memory:audit
#863 contract ─────► #247 chunks ──────┼──► 2.4 artifacts ─┘                  │    under both
                 └──► 3.2 record-first + capture door ─────────────────────────┤    backends)
                 └──► #361 reindex parity                                     │
2.6 memory:audit (measurement) ───────────────────────────────────────────────┤
#461 · #712 · #714 · #638 (independent hardening) ────────────────────────────┘
```

- Wave 0: 0.0 (reopen the tracker — a human act), #820 mitigation, **2.6 `memory:audit`**
  (the measurement must exist before anything is claimed to have moved).
- Wave 1: #862, #863 (rulings; may run in parallel). Each ruling closes the rows §2 assigns it.
- Wave 2: #805, #738, #247, **2.4 artifact retirement, 2.5 `mrAutoMerge`** (prerequisites;
  parallel once their ruling lands).
- Wave 3: 3.1a-d lane implementation (under #862; **3.1c/3.1d depend on 2.4**), 3.2
  record-first capture + door (under #863).
- Wave 4: #361, #461, #712, #714, #638.
- Close #795 in favour of #862 when the lane's first scenario passes **and** its acceptance
  1 and 3 are answered in `memory-presence.mjs`'s header.

## 4. Delivery strategy: stacked-to-main

Every slice is its own change (`openspec/changes/issue-<n>-<slug>/`), its own worktree
(`brain:ticket:start <n>`), its own PR **to `main`**. No tracker branch.

**[rev]** Every slice PR **closes its own ticket** (`Closes #<slice>`) and names the epic in
prose (`Parent: #864`), never with a keyword: `issue-link` on the default branch accepts only
a closing reference (`run-check.mjs:346`; `Part of #N` is for chained PRs to a non-default
base), and a closing keyword against #864 is how PR #867 closed the epic under its own
slices. 0.0 reopens the tracker so eleven open slices do not hang off a closed epic, and the
exit numbers land on an open issue.

**[rev]** The Wave 3 slices have no tickets yet. #862 and #863 each file theirs as the last
act of the ruling (3.1a-d under #862, 3.2 under #863), and tasks.md gets the numbers then.
Four lane slices, not one: the 400-line budget does not hold trigger, collector, port verb,
CI check and four surface rewrites in one PR.

Why not `feature-branch-chain`: the slices are independent tickets with standalone value
(#805 is useful the day it lands, whether or not the lane exists), and this repo's own
evidence (#795, #796) is that work held off `main` strands what it carries — including, with
bitter irony, the memory records of the work itself. A tracker branch for a memory epic
would reproduce the defect the epic exists to close.

Each slice PR checks its box in this change's `tasks.md` (one line; conflicts are trivially
resolvable). Verification of the epic is the last task.

## 5. How completion is verified

**[rev]** Not `brain:change:verify`: that verb classifies the diff and, for `openspec/**`,
runs only `check-refs` (`verify-change.mjs:72`). It cannot re-measure a scenario. The exit is:

1. `npm run memory:audit` (2.6) run on a fresh clone under `MEMORY_BACKEND=engram` and again
   under `MEMORY_BACKEND=plainfiles`; both outputs pasted on #864 beside the numbers that
   opened it (p50 10.9 h; 2339 rows / 2336 keys; 66/94 `@legacy` + 28/94 branch-name;
   0 `supersedes`).
2. The scenarios `memory:audit` cannot compute (unmerged-branch record on `main`; feature PR
   with no records; lane refused on a foreign path; two lanes one index) each proved once by
   doing it, with the PR link on #864.
3. The vacuity table (spec.md) filled per row for the `plainfiles` run.
4. `brain:change:verify` for the structural half (refs), and a human closes #864.

The epic closes when every scenario passes under **both** backends, not when the last slice
merges.

## 6. What this design refuses

- A gate that blocks a feature push on memory grounds.
- Any slice whose correctness depends on engram's store being machine-global.
- Backfilling `@legacy` here. **[rev]** #368 (the ticket the first version pointed at) is
  closed `not_planned`; a backfill, if ever wanted, is a new ticket with its own argument.
- **[rev]** A `topic` field in the record format to infer `supersedes` — the link is the
  writer's claim, and ADR-0017's schema does not move for a convenience.
- **[rev]** A lock on `git pull`, `post-merge` or the lane's merge: contention skips and says so.
- **[rev]** Auto-merge at a tier whose `requiredReviews` is 1 — the lane does not carve an
  exception out of ADR-0026.

## 7. Revision log — 2026-09-05 gap review of PR #867

What the merged contract lacked, and where each item now lives:

| # | gap | fix |
|---|---|---|
| 1 | #864 closed by its own contract PR; a closing keyword against the epic re-closes it; `Part of #N` is refused on `main` | tasks 0.0; §4 |
| 2 | lane PR vs `issue-link`/`actor-check`/`brain:audit` — untreated | spec "governance surface"; §2 D1 table |
| 3 | "feature PRs carry no records" vs `memory-gate` scoped + PR template + `step3` + `brain:save` + `pre-push` | spec two scenarios; 3.1d |
| 4 | "no artifact load-bearing" contradicts ADR-0002/0004; nobody retires manifest/legacy/driver/symlink | spec doctrine scenario; 1.2; 2.4 |
| 5 | provenance passes with a branch-name `actor`; `actorKind` door-typed | spec two scenarios; 2.2 |
| 6 | `supersedes` on "same topic" needs a topic identity the format lacks; "the store" undefined | Vocabulary; spec scenario; §6 |
| 7 | `mem_save` door open; doc-vocabulary list too narrow | spec door scenario; 3.2; doc scenario widened |
| 8 | lane mechanics (credential, tier, worktrees, enforcer, index) unspecified | §2 D1 table; 2.5; 3.1a-d |
| 9 | latency without a target; measurements are hand queries | spec targets; 2.6 `memory:audit` |
| 10 | exit attributed to `brain:change:verify`, which cannot re-measure | §5 |
| 11 | scenarios vacuous/undefined under `plainfiles`; `memory:import` is not an npm script | vacuity table; Vocabulary |
| 12 | #795 acceptance 1 and 3 orphaned by the close | spec scenario; 5.1 |
| 13 | Wave 3 slices have no tickets; one slice too big | §4; 3.1a-d |
| 14 | 3.1 depends on manifest churn being gone, not in the graph | §3 |
| 15 | #368 closed `not_planned`; frontmatter `draft` after approval | §6; `status: tasked` |
