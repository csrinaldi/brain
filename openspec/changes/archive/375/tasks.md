---
status: tasked
issue: 375
epic: 313
artifact_store: openspec
topic_key: sdd/issue-375-l5-deny-set/tasks
---

# Tasks — L5 deny-set (issue 375)

Strict TDD: RED before GREEN. Branch `fix/issue-375-fixgovernance-actor-check-rule-5-passes`,
worktree `/home/gandalf/IA/brain-issue-375`, base `main`.

Depends on **#374** (merged as of this branch): `governance.reviewActors` must have a value in
`main` or REQ-375-4 has nothing to assert against.

## Phase 1 — RED

- [x] 1.1 Add four tests to `brain/scripts/vcs/actor-check.test.mjs`: denied-actor fails (REQ-375-1
      S1), negative control (S2), deny-beats-allow (REQ-375-2 S3), gatherer wiring (REQ-375-3 S4).
      Each makes the actor differ from BOTH authors, so only the deny-set can catch it (design D4).
      **Observed RED:** `pass 45 / fail 3` — the negative control passed, correctly, both before and
      after.

TASK BOUNDARY: 1.1 observed RED before Phase 2. ✔

## Phase 2 — GREEN

- [x] 2.1 `evaluateActor` accepts `denyActors` and fails on a match, inserted **above** the
      allow-list and **below** `adminOverride` (design D2).
- [x] 2.2 `defaultReadDenyActors(cwd)` reading `governance.reviewActors`, kept separate from
      `defaultReadBotAllowlist` (design D3).
- [x] 2.3 `gatherActorCheckInputs` wires `deps.readDenyActors` and surfaces `denyActors` in both
      return paths (the early `issueNumber == null` return included).
- [x] 2.4 Docblock decision order renumbered 1-6 with the new step 3, and rule 6's comment corrected:
      it cannot verify humanness, only that the actor is not one this repo has named.

## Phase 3 — two regressions the change surfaced, both informative

- [x] 3.1 **REQ-A2-3 drift guard tripped**: `actor-check.mjs` must contain no literal `status:approved`
      (it reads the resolved `governance.approvedLabel`). My reason string and docblock both hardcoded
      it. Reworded to "the approved label". A real constraint, correctly caught.
- [x] 3.2 **#266 t1's reason assertion**: it asserted `/self/i`, but the deny check now fires first, so
      the reviewer is caught earlier and for the stronger reason. Widened to
      `/self|governance\.reviewActors/i`. **The `level` assertion — t1's load-bearing claim — is
      unchanged**, and the edit carries an in-file note explaining why t1 could never have detected
      this gap.

## Phase 4 — shipped-config behaviour test

- [x] 4.1 REQ-375-4 in `reviewer-identity-config.test.mjs`: feed the committed config's
      `reviewActors` into the real `evaluateActor` with both authors set to other identities, assert
      the shipped `reviewer.handle` is refused. **5/5.**

## Phase 5 — Tier 2 drafts (agent drafts, human promotes)

- [x] 5.1 ADR draft **`brain-drafts/adr-0025-l5-deny-set.md`** — the decision + **why R2 is excepted**. Non-negotiable per #375.
- [x] 5.2 §9 draft (in `brain-drafts/reviewer-protocol-l5-deny-set.md`, Edit 3) — and it records that the paragraph was **factually wrong**: it claimed actor-check rejects identities NOT in approvalActors, but `actor-check.mjs:90` is the PASS branch. That false backstop is why the gap survived. — deny-set enforced at L5, not only in the caller.
- [x] 5.3 §3 drafts (Edits 1-2, same file) — the table row, plus `t1`'s overstated claim — its two-key table presents `reviewActors` as L6-only,
      which this change makes false.

## Phase 6 — gates

- [x] 6.1 `npm run brain:repo:check`
- [x] 6.2 `npm test`
- [x] 6.3 `npm run brain:change:verify`

## Live micro-decisions

- **Deny placed above the allow-list**, which is stronger than #375's stated "ahead of rule 5".
  Deliberate: only that ordering is fail-closed on a contradictory config. Recorded in design D2.
- **The `decision` label is deliberately NOT applied.** `adrPresence` requires an
  `adr-NNNN-*.md` under `brain/project/decisions/` AND a `brain/HOME.md` change *together*; the ADR
  here is a Tier 2 **draft** under `brain-drafts/`, so neither is in the diff and the gate passes on
  its "no ADR requirement" branch. The real ADR lands in the human's promotion commit, exactly as
  `memory-format.md` did for #330.
