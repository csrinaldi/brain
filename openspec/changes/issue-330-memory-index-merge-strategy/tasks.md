---
status: tasked
issue: 330
epic: 313
artifact_store: openspec
topic_key: sdd/issue-330-memory-index-merge-strategy/tasks
---

# Tasks — one-command resolution for a conflicted `.memory/index.jsonl` (issue 330)

Strict TDD: RED before GREEN on every code-bearing phase. Branch:
`fix/issue-330-fixmemory-memoryindexjsonl-has-no-merge`, worktree
`/home/gandalf/IA/brain-issue-330`, base `main`. PR **#360**.

> **Phases 1–5 delivered a mechanism that was then BLOCKED on doctrine review.** They are kept
> below, unedited in substance, because deleting them would erase the evidence trail. Phase 6 is
> the block; Phase 7 is the rework that supersedes them. `proposal.md`, `spec.md` and `design.md`
> have all been rewritten for the new mechanism — read those, not phases 1–5, for the contract.

---

## Phase 1 — RED: the merge regression tests (SUPERSEDED by Phase 7)

- [x] 1.1 Add `brain/scripts/memory/lib/index-merge.integration.test.mjs` with test 1 (clean union
      merge) and test 2 (negative control), modelled on `records-merge.integration.test.mjs`.
      **Observed:** both pass. The negative control fails the merge with conflict markers, which is
      what makes test 1 causal evidence rather than a coincidence.
- [x] 1.2 Add test 3, the repo tripwire, reading the real `.gitattributes`.
      **Observed RED:** `pass 3 / fail 1`, failing on `index-merge.integration.test.mjs:220` —
      "the shipped .gitattributes must declare a merge strategy for /.memory/index.jsonl".

TASK BOUNDARY: 1.2 observed RED before Phase 2. ✔

## Phase 2 — GREEN: the fix (SUPERSEDED — this is the reversal Phase 6 blocked)

- [x] 2.1 Add `/.memory/index.jsonl merge=union` to `.gitattributes`.
- [x] 2.2 Re-run the suite — **Observed:** `pass 4 / fail 0`.

## Phase 3 — doc (Tier 2 draft) (SUPERSEDED by 7.7)

- [x] 3.1 Draft the `memory-format.md` update into `brain-drafts/memory-format-index-merge.md`.
- [x] 3.2 Note in the PR body that the draft awaits human promotion.

## Phase 4 — gates

- [x] 4.1 `npm run brain:repo:check` — ✓ no prohibited references, artifact structure valid.
- [x] 4.2 Full unit suite via the repo verb `npm test` — **2036/2036 pass, 0 fail**. Note:
      `node --test <dir>` is NOT the repo's invocation and fails with MODULE_NOT_FOUND; always use
      the `test` script's glob.
- [x] 4.3 `npm run brain:change:verify` — ✓ repo + scripts scope, both green.
- [x] 4.4 `npm run memory:share` run before pushing. Gate verified directly:
      `node brain/scripts/governance/run-check.mjs memory-gate` → exit 0. **Nothing was staged from
      `.memory/`** — see the undiagnosed finding below.

## Phase 5 — delivery

- [x] 5.1 Commit as one work unit: `ff4ee8a`, 7 files, +715 (241 counted against the diff-size
      budget; `openspec/changes/**` is ignore-listed).
- [x] 5.2 Human applied `status:approved` to #330. Pushed and opened **PR #360** into `main`,
      labelled `type:bug`. All 8 governance jobs pass: issue-link, diff-size, memory-gate,
      decision-gate, local-checks, phase-order, actor-check, brain-writes-reviewed.
      Note: `gh pr edit --add-label` fails on this repo with a Projects-classic GraphQL deprecation
      error; `gh api repos/:owner/:repo/issues/<n>/labels` works.

---

## Phase 6 — BLOCK: doctrine review overturned the mechanism

- [x] 6.1 A cold external review returned **BLOCK** on PR #360, CRITICAL, verified by direct read:
      `/.memory/index.jsonl merge=union` reverses `memory-format.md:145-153` ("NEVER hand-merged and
      NEVER union-merged") and ADR-0017:121-129. **All 8 gates were green** — no gate reads
      doctrine, by design (`workflow-governance.md`, enforce-outputs / guide-judgment boundary).
- [x] 6.2 Measured #330's unmeasured premise: real 3-way-merge conflict rate on the doctrine's
      normative index serialization, repo index as merge base, `rec-<16 hex>` id shape →
      **0–4.5% at n=1575**, and the rate is a function of store size (high only for young stores).
      Recorded in `design.md` D1. The premise "conflicts on every parallel branch" is false.
- [x] 6.3 Owner ruled the rework shape: **the command is the unit of truth and the hook CALLS the
      command** — both, layered. Rationale and rejected single-layer options in `design.md` D2.
- [x] 6.4 Rewrote `proposal.md`, `spec.md`, `design.md` for the new mechanism. REQ-330-1 is now the
      **inverse** of its superseded form: the index declares NO strategy. D0 keeps the record of why
      three true premises did not rescue a wrong design.

## Phase 7 — REWORK: `memory:resolve-index` + thin hook caller

- [x] 7.1 Delete `index-merge.integration.test.mjs` (-229). Every assertion in it is pinned to the
      reversed mechanism; there is nothing to salvage.
- [x] 7.2 RED: add `brain/scripts/memory/lib/resolve-index.integration.test.mjs` (+179) — real temp
      git repos, a real conflicting `git merge`. Four tests, one per REQ:

      | # | Test | REQ |
      |---|---|---|
      | 1 | conflicted index regenerated from `records/`, byte-identical to a fresh reindex, both ids present, sorted, no unmerged paths, `staged: true`, merge commits | REQ-330-2 S2 |
      | 2 | refuses when a `records/` file carries markers; index left byte-identical | REQ-330-3 S3 |
      | 3 | clean tree → normalizes, `staged: false`, `git diff --cached` empty | REQ-330-4 S4 |
      | 4 | shipped `.gitattributes` declares **NO** rule for `/.memory/index.jsonl` | REQ-330-1 S1 |

      The fixture starts from an **empty** committed index so the conflict is *guaranteed, not
      likely* — the pathological corner on purpose, documented in the file header as NOT a claim
      about frequency, citing `design.md` D1 for the real rate.
- [x] 7.3 GREEN: add `brain/scripts/memory/lib/resolve-index.mjs` (+91) — `resolveIndex()` +
      `conflictedRecordFiles()`. Fail-closed marker check on `records/` **before** any write (D3);
      unmerged set read **before** the rebuild, staged iff unmerged (D4); dependency-injected
      `runGit` / `rebuildIndex` / fs for testability.
- [x] 7.4 Register the verb: `resolve-index` in `VALID_OPS` and its backend-agnostic branch in
      `brain/scripts/memory/cli.mjs` (+20, beside `reindex`); `memory:resolve-index` in
      `package.json`; three i18n keys in `en.mjs` and `es.mjs` (done / staged / failed).
- [x] 7.5 Remove the 12 `.gitattributes` lines added by 2.1 — the index returns to `main`'s
      behaviour. `records/*.jsonl merge=union` and `manifest.json merge=engram-manifest` untouched.
- [x] 7.6 `brain/scripts/hooks/post-merge` (+8): one non-blocking `resolve-index` call after the
      existing `import` call, with a comment recording the honest boundary — git does not fire
      `post-merge` on a failed merge, so the hook keeps the index canonical but never rescues a
      conflict. No resolution logic in the hook (REQ-330-4).
- [x] 7.7 Rewrite the Tier 2 draft `brain-drafts/memory-format-index-merge.md` for the new
      mechanism: **name the helper** the doc already sanctions, weaken no exclusion.
- [x] 7.8 Target suite green:
      `node --test brain/scripts/memory/lib/resolve-index.integration.test.mjs` → **pass 4 / fail 0**.

TASK BOUNDARY: 7.2 must be observed RED before 7.3. ✔ (observed in the rework session)

## Phase 8 — re-delivery (PENDING)

- [x] 8.1 `npm run brain:repo:check` — ✓ no prohibited references, artifact structure valid.
- [x] 8.2 Full suite via the repo verb `npm test` (the glob, never `node --test <dir>`) —
      **2036/2036 pass, 0 fail**. Same total as the superseded run: the 4 deleted `index-merge`
      tests are replaced one-for-one by the 4 `resolve-index` tests.
- [x] 8.3 `npm run brain:change:verify` — ✓ 14 files detected, `repo` + `scripts` scopes both green
      (`check-refs` + `node --check` over the 5 touched script files).
- [x] 8.4 Commit the rework as one work unit on top of `ff4ee8a` (fix + tests + artifacts + draft).
      **Not a force-push, not an amend** — `ff4ee8a` is published and `agent-authorities.md` Tier 3
      forbids rewriting published history. The reversal is a forward commit.
- [ ] 8.5 Retitle PR #360 — its current title, *"fix(memory): give .memory/index.jsonl a union merge
      strategy"*, now describes the opposite of what the branch does. Update the body: the
      superseded mechanism, the block, the measurement, the two-layer rework, and the Tier 2 draft
      still awaiting human promotion.
- [ ] 8.6 Push and re-verify all 8 governance jobs.
- [ ] 8.7 Ask the cold reviewer for a re-review (`npm run brain:review -- --pr 360`). The prior
      verdict was BLOCK at a `head_sha` that no longer exists; a new verdict is required, and the
      reviewer re-derives it cold rather than reading this file (`reviewer-protocol.md` §8).

---

## Live micro-decisions

- **Tracker is `main`, not `feature/v2.0.0`.** `git rev-list --left-right --count
  origin/feature/v2.0.0...origin/main` reports `0 32` — fully absorbed and 32 behind. The epic #313
  body is stale on this point and should be re-synced by a doc PR (it declares itself source of
  truth).
- **The three findings that reshaped the FIRST design remain true and are now in `design.md` D0:**
  the index is a full rewrite not an append-only log; nothing reads it; self-healing is
  backend-asymmetric. They were true then and are true now — they just answered the wrong question
  ("is union dangerous?" rather than "does union merge two rewrites?").
- **A test pinned to a mechanism cannot question the mechanism.** The superseded tripwire asserted
  the union line was *present*, so it was structurally incapable of detecting that its presence was
  the defect. The replacement asserts **absence** — unforgeable by a wrong value. This is the
  reusable lesson and a candidate anti-pattern if it recurs.
- **UNDIAGNOSED, reported not ruled:** `npm run memory:share` (engram backend) printed
  `Created chunk b86f7b16 / Observations: 1965` but left `.memory/` **byte-identical** — no record
  appended for an observation saved seconds earlier, on either the worktree or the main checkout.
  The chunk it wrote is gitignored (`.gitignore:84`), so nothing became durable in git. Causes not
  yet distinguished: the MCP engram server and the `engram` CLI binary (v1.17.0, 1.20.0 offered) may
  address different stores, or `dualWriteRecords` deduped everything. Deliberately NOT filed as an
  issue — a confident bug report on an undiagnosed symptom is worse than an open question. Does not
  block: `memory-gate` is a repo-global `session_summary` existence check and passes.
- **Follow-up FILED as #361:** `engram.share()` reindexes only when it appended a record
  (`engram.mjs:315-318`) and `engram.pull()` never reindexes (`engram.mjs:589-619`), while
  `plainfiles` reindexes unconditionally on all four verbs.

## Review workload forecast

- Rework changed lines: ~305 added / ~241 deleted across 9 files; `openspec/changes/**` is
  ignore-listed, so the budgeted diff is the `brain/scripts/**` + `.gitattributes` + `package.json`
  portion (~76 net).
- 400-line budget risk: **Low**. Single PR, no chaining needed.
- Decision needed before re-delivery: **No** — the shape decision was taken in 6.3. The remaining
  human gate is the Tier 2 promotion of the `memory-format.md` draft, which does not block the PR.
