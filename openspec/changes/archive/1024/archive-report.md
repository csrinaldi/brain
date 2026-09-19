---
status: archived
issue: 1024
archived_at: 2026-09-18
archived_against: 2d24841a (origin/main; PR #1048 squash-merged)
---

# Archive report — issue-1024-memory-gate-pr-context

**The change is closed.** Issue #1024 (`memory-gate` never received the PR description
in CI, so its issue-scoped check never ran) shipped as PR #1048, squash-merged into
`main` as `2d24841a` on 2026-09-18 with `size:exception` (about 1,059 governed lines
against the `lite` budget of 1,000). All 25 tasks are `[x]`; the 4 requirements and 27
scenarios of the two delta specs are covered; the post-merge verify report returned
**pass** with 0 CRITICAL.

## What was archived

`npm run brain:change:archive -- issue-1024-memory-gate-pr-context` moved the folder to
`openspec/changes/archive/1024/` and appended each delta, under an `[issue-1024]`
provenance header, to its central spec:

| Delta | Central spec | Requirements |
|---|---|---|
| `specs/governance-v3/spec.md` | `openspec/specs/governance-v3/spec.md` | REQ-L3-4 (modified), REQ-L3-5, REQ-L3-6 (added) |
| `specs/ci-context/spec.md` | `openspec/specs/ci-context/spec.md` | REQ-CIC-3 (modified) |

The verify report carries the `gentle-ai.verify-result/v1` envelope (evidence
revision `sha256:cadf442f858b5076382585d9a172b08f79a380de7f7ba6a82208bd8308a8548c`).

## Delivery

`2d24841a` — PR #1048 (`fix(governance)`, closes #1024):

- The GitHub `memory-gate` job passes `VCS_TOKEN`, `PR_NUMBER` and `PR_BODY`, delivering
  the evidence `GATE_MATRIX['memory-gate']` already ratified.
- Scoped evidence is the union of the PR tree and the default branch, de-duplicated by
  record id, read by `default-branch-records.mjs` with `git ls-tree` and one
  `git cat-file --batch`. It fetches only on an already-shallow checkout (CI).
- `skip:memory-gate` is real and follows `TIER_PARAMS.honorSkipMemoryGate`: honored at
  `standard` when applied by someone other than the PR author and outside
  `reviewActors`/`agentActors`; refused at `regulated`; noted at `lite`.
- Every run names its path and every refusal reason is visible.

## Decisions recorded during the change

- One PR with the default-branch read: wiring alone would have forced `standard`
  consumers to rebase after every lane merge.
- The override was made real in the same PR, performing step 2 of the #529 sequence
  before the gate tightens.
- The override follows `TIER_PARAMS`, not "every tier" as the proposal first said.
- `size:exception` over a split: the only seam would have shipped an override nothing
  calls.

## Incidents during the change

- **The real repository became shallow.** The first reader fetched with `--depth=1`
  unconditionally; nine tests reached it from the real repository and wrote
  `.git/shallow`, cutting history for every worktree. Repaired by removing the marker
  after confirming the parent objects were present (`git fsck --connectivity-only`
  clean); fixed by fetching only on shallow checkouts, with integration tests proving a
  full clone never fetches. Follow-up #1053 asks for a permanent guard.
- **Live CI found a buffer overflow.** On PR #1048 the gate failed closed:
  `git cat-file --batch` exceeded `execFileSync`'s 1 MiB default over roughly 9 MB of
  records, with an empty error message. Fixed in `d3daaeb5` (512 MiB buffer, the error
  names its cause) with tests that seed more than 1 MiB of records. The next run
  printed `memory-gate: path=retrieval #1024 (records: pr-tree+origin/<default>
  (fetched))` and a `lite` warning: the first live run of the scoped path.

## Verification at archive time

- `npm test` on `2d24841a`: 5941 passed, 0 failed.
- A first run under a git spy on `PATH` showed 4 failures in memory CLI tests untouched by
  this change. They reproduce every time the spy wrapper is on `PATH` and never without
  it; they are an artifact of the wrapper, not a flake in the suite.
- The spy logged 227 fetches, all inside `/tmp` fixtures; the repository stayed
  non-shallow; lane refs and open PRs were unchanged.
- A read-only probe on a full clone read 2409 records with no error and no fetch.

## Open follow-ups

- #1051 re-run `memory-gate` when a record lands on the default branch.
- #1052 `regulated` fails on partial coverage.
- #1053 guard against tests running git remote commands against the real repository.
- #1054 softened warnings print the gate name twice.
- #1055 verify the scoped path and the override on a live GitLab MR pipeline.
- #936 the lane re-carried an already-merged record on PR #1050 (evidence commented).
- Maintainer promotion of `brain-drafts/workflow-governance-memory-gate.draft.md` into
  `brain/core/methodology/workflow-governance.md`; `AGENTS.md` regenerates on promotion.
