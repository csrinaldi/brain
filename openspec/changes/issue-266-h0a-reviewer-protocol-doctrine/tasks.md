---
status: draft
issue: 266
slice: H0-a
---

# Tasks — Reviewer protocol as doctrine + VCS port verbs (issue 266, phase H0)

> **STRICT TDD MODE IS ACTIVE** for all H0-b code tasks: each is a RED → GREEN pair — the failing
> test is written and observed failing *first*, then the minimum code that makes it pass. Runner:
> `npm test` → `node --test "brain/scripts/**/*.test.mjs"` (node:test + `assert/strict`, colocated
> `*.test.mjs`, DI seams). Docs/artifacts in English (ADR-0009). Binding rulings R1–R5 in
> `design.md` §0.
>
> **Slice boundary.** Group A (H0-a) is this PR: planning artifacts, an ADR draft, the design-off
> commit, and the durable records — **no executable behavior change**. Group B (H0-b) is a later PR:
> the four port verbs on both providers, the drift-guard, the two mandatory lock-3 tests, and the
> `governance.reviewActors` wiring. Group B items are marked **(deferred)**.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| H0-a counted lines | **~0 counted.** Everything is under `openspec/changes/**`, `brain-drafts/`, `design-off/` (under the change dir), and `.memory/**` — all in `governance.ignoreList` (`brain.config.json:16-27`) or ignored by convention. The ADR draft lands in `brain-drafts/` (agent-drafts, human-promotes) and does not count until promotion. |
| H0-b counted lines | **~120–180** production lines: 4 verbs × 2 providers (~small each, following the existing verb shape), `VERBS` + `vcs-contract.md` edits, `governance.reviewActors` read at L6. Tests are budget-free (`**/*.test.mjs` ∈ `ignoreList`). Well under 400. |
| 400-line budget risk | **Low** for both slices. |
| Chained PRs | H0-a → then H0-b, both to `feature/v2.0.0`. H0-b depends on H0-a's doctrine being promoted. |
| Decision needed before apply | Confirm the H0-a / H0-b split and that the ADR promotion (agent-draft → human-promote) is done by a human, not the apply agent. |

---

# Group A — H0-a (this slice)

## Phase 1 — SDD planning artifacts

- [x] **1.1** `proposal.md` — the H0-a slice, its scope, and the H0-b deferral.
- [x] **1.2** `spec.md` — REQ-266-1..9; the two rev-2 conditions as acceptance; the two lock-3 tests
      as testable requirements (REQ-266-6).
- [x] **1.3** `design.md` — three locks, two-key split + hazard analysis, four port verbs, cold
      boot, verdict schema, bounded revision, monotonic labels + deny-set.
- [x] **1.4** `tasks.md` — this checklist.

## Phase 2 — ADR draft + doctrine (agent drafts, human promotes — Tier 2 / ADR-0013)

- [ ] **2.1** Draft the reviewer-protocol ADR + `reviewer-protocol.md` doctrine body to
      `brain-drafts/` (owner-managed dir). Load-bearing content per REQ-266-1: three locks, two-key
      split, four verbs, verdict schema, bounded revision, cold boot, monotonic labels + deny-set.
- [ ] **2.2** Draft the `brain/HOME.md` index entry for the new doctrine (co-promoted in the same MR
      — the #197→#199 lesson; `decision-gate` step 1 enforces ADR + HOME together).
- [ ] **2.3** *(human)* Promote the ADR draft to `brain/core/methodology/reviewer-protocol.md` and
      the HOME index — the human keystroke, not the apply agent.

## Phase 3 — design-off record (owner-managed dir)

- [ ] **3.1** Commit both source design documents unmodified as
      `design-off/reviewer-protocol-{claude-code,antigravity}.md` under the change dir (not
      `design-docs/` at the root — budget reason, `design.md` §8).

## Phase 4 — durable records (rev-2 binding condition A)

- [ ] **4.1** Write the lock-3 two-key decision record to `.memory/records/` (`type: decision`,
      `issue: 266`, `source: "H0 rev-2 verdict"`, finding `H0-LOCK3-DUAL`).
- [ ] **4.2** Write the meta-finding record to `.memory/records/`.

## Phase 5 — H0-a first-PR gates (the two rev-2 conditions)

- [ ] **5.1 GATE — Condition A.** The lock-3 decision record and the meta-finding record are present
      under `.memory/records/` in the first PR's diff (`.memory/records/` last changed server-side
      2026-07-09; absence in the first PR is a finding). Verify cold before opening the PR.
- [ ] **5.2 GATE — Condition B acknowledged.** `tasks.md` carries the two mandatory lock-3 tests as
      committed H0-b work (Phase 8); the implementation PR that lands them is bound by REQ-266-6.
- [ ] **5.3** Open PR H0-a → `feature/v2.0.0`, `Part of #266`. No `size:exception` (all diff is
      ignore-listed).

---

# Group B — H0-b (deferred to a later PR)

## Phase 6 — the four port verbs, both providers (deferred)

- [ ] **6.1 (deferred) RED** — extend `providers/vcs.contract.test.mjs`: add
      `prReviewComment` / `issueComment` / `labelAdd` / `labelRemove` to the contract assertion set
      run over `['github', 'gitlab']`. Fails: neither provider exports them yet.
- [ ] **6.2 (deferred) RED** — a unit test asserting `prReviewComment` emits `event: 'COMMENT'` for
      every input, and that **no** exported verb on either provider can emit an APPROVE review
      (REQ-266-3). Fails: verb does not exist.
- [ ] **6.3 (deferred) GREEN** — implement the four verbs on `providers/github.mjs`, following the
      existing verb shape (normalized `{ url }|{ url: null, error }`, never throws). `prReviewComment`
      hardcodes `event: 'COMMENT'` — no APPROVE argument, no APPROVE branch.
- [ ] **6.4 (deferred) GREEN** — implement the same four on `providers/gitlab.mjs`.
- [ ] **6.5 (deferred)** — add the four verb names to `VERBS` (`brain/scripts/vcs/cli.mjs:22-27`).
- [ ] **6.6 (deferred)** — update `vcs-contract.md`: add the four verbs to the required-verbs table,
      **and fix the stale "15 verbs" prose** (line 61) — it is already one verb behind `VERBS`
      (which includes `capabilities`). Adding these verbs is a decision → `decision` label + ADR.
- [ ] **6.7 (deferred) GREEN** — the drift-guard (6.1) now passes: both providers export all four.

## Phase 7 — `governance.reviewActors` wiring (deferred)

- [ ] **7.1 (deferred) RED** — a test that L6 (`brain-writes-reviewed.mjs`) reads
      `governance.reviewActors` and threads it into its `botAllowlist`, in addition to / replacing
      the current `governance.approvalActors` read — per the design's two-key split (§3).
- [ ] **7.2 (deferred) GREEN** — implement the L6 read of `governance.reviewActors`. L5
      (`actor-check.mjs`) is **not** touched — it keeps reading `governance.approvalActors` only.
- [ ] **7.3 (deferred)** — populate `governance.reviewActors` with the reviewer handle in
      `brain.config.json`; confirm the reviewer handle is **never** added to
      `governance.approvalActors` (Fork A, design §11).

## Phase 8 — the two mandatory lock-3 tests (deferred; rev-2 binding condition B)

- [ ] **8.1 (deferred) — t1.** `actor-check` test: with the reviewer identity as the approved-label
      actor, and the reviewer in `governance.reviewActors` but NOT in `governance.approvalActors`,
      `evaluateActor` does NOT return `pass` via the allow-listed-automation branch — the reviewer
      cannot self-apply `status:approved` (REQ-266-6 t1, spec scenario).
- [ ] **8.2 (deferred) — t2.** `brain-writes-reviewed` test: the reviewer identity in L6's
      `botAllowlist` (from `governance.reviewActors`) is excluded from the human-approver count — an
      APPROVED review authored by the reviewer is not counted as the human review (REQ-266-6 t2).
- [ ] **8.3 (deferred) GATE** — both tests present and green in the H0-b PR. This is the rev-2
      binding condition B: the implementation carries both mandatory lock-3 tests. Non-negotiable.

## Phase 9 — H0-b close-out (deferred)

- [ ] **9.1 (deferred)** — `npm test`, `npm run brain:repo:check`, `npm run brain:change:verify` all
      green; the drift-guard green; the two lock-3 tests green.
- [ ] **9.2 (deferred)** — open PR H0-b → `feature/v2.0.0`, `Part of #266`, after H0-a's doctrine is
      promoted.

---

## Hot micro-decisions

Session agreements. Promote at MR time — see `brain/core/methodology/consolidation-protocol.md`.

- **The dual-semantics hazard is real and in the tree.** `governance.approvalActors` is read as
  `botAllowlist` by L5 (`actor-check.mjs:90-94`, permissive → PASS) AND L6
  (`brain-writes-reviewed.mjs:111`, restrictive → excluded). One registration would both
  de-authorize at L6 and authorize self-approval at L5. The split is the only fix.
- **Neither governance key is populated today.** `brain.config.json` has only `governance.ignoreList`
  (lines 15-28); both gates read `approvalActors` and default to `[]`. `reviewActors` is genuinely
  new; `approvalActors` must be formalized in H0-b (Fork A).
- **Lock 1 is by construction.** L6 counts only `state === 'APPROVED'`
  (`brain-writes-reviewed.mjs:99`); a COMMENT-state verdict contributes nothing — not a rule the
  reviewer follows.
- **No APPROVE path, ever.** `prReviewComment` hardcodes `event: 'COMMENT'`; the port never gains an
  approve capability (REQ-266-3). A unit test asserts this is structurally absent.
- **The drift-guard is `providers/vcs.contract.test.mjs`** — one assertion set over both providers.
  Adding verbs to `VERBS` turns it red until both implement them.
- **`vcs-contract.md` is already one verb behind** (`:61` says "15 verbs", `VERBS` has 16). Fix in
  the same MR that adds the four new verbs (6.6).
- **H0-a is budget-free.** All of it is ignore-listed or owner-managed dirs; no `size:exception`.
