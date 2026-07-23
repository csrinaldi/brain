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
| H0-b counted lines | **~210** production lines (actuals, PR #271's doctrine already promoted): 4 verbs × 2 providers (`github.mjs` +78, `gitlab.mjs` +108, both include JSDoc), `VERBS` (+5), `vcs-contract.md` (+6/-2), `brain-writes-reviewed.mjs`'s `governance.reviewActors` replace read at L6 (R2; +~12/-2). Above the ~120–180 estimate (GitLab's notes-API url derivation added JSDoc weight) but well under 400 — no `size:exception` needed. Tests are budget-free (`**/*.test.mjs` ∈ `ignoreList`). |
| 400-line budget risk | **Low** for both slices. |
| Chained PRs | H0-a → then H0-b, feature-branch-chain against the `issue-266` tracker branch (H0-a landed via PR #271 to the tracker; H0-b targets the same tracker, not `feature/v2.0.0`). H0-b depends on H0-a's doctrine being promoted — confirmed: `reviewer-protocol.md` + ADR-0020 merged at 77b91f3. |
| Decision needed before apply | Confirm the H0-a / H0-b split and that the ADR promotion (agent-draft → human-promote) is done by a human, not the apply agent. — **Resolved**: done via PR #271 (merged), human-signed ADR-0020. |

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

- [x] **2.1** Draft the reviewer-protocol ADR + `reviewer-protocol.md` doctrine body to
      `brain-drafts/` (owner-managed dir). Load-bearing content per REQ-266-1: three locks, two-key
      split, four verbs, verdict schema, bounded revision, cold boot, monotonic labels + deny-set.
- [x] **2.2** Draft the `brain/HOME.md` index entry for the new doctrine (co-promoted in the same MR
      — the #197→#199 lesson; `decision-gate` step 1 enforces ADR + HOME together).
- [x] **2.3** *(human)* Promote the ADR draft to `brain/core/methodology/reviewer-protocol.md` and
      the HOME index — the human keystroke, not the apply agent. Done via PR #271 (merged
      77b91f3): `reviewer-protocol.md` + `ADR-0020` signed Accepted, `brain/HOME.md` updated in the
      same MR.

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

## Phase 6 — the four port verbs, both providers

- [x] **6.1 RED** — extended `providers/vcs.contract.test.mjs`: added
      `prReviewComment` / `issueComment` / `labelAdd` / `labelRemove` to a contract assertion set
      run over `['github', 'gitlab']` (inline mocks, no new fixture files — budget reason). Observed
      RED: 17 new failures (`vcs.<verb> is not a function`) before implementation.
- [x] **6.2 RED** — a unit test asserting `prReviewComment` sends `event: 'COMMENT'` to the GitHub
      API regardless of input, plus a source-scan test asserting no provider source contains any
      review `event:` literal other than `'COMMENT'` (REQ-266-3). Observed RED alongside 6.1 (verb
      did not exist yet).
- [x] **6.3 GREEN** — implemented the four verbs on `providers/github.mjs`, following the existing
      verb shape (normalized `{ url }|{ url: null, error }` / `{ ok }|{ ok: false, error }`, never
      throws). `prReviewComment` hardcodes `event: 'COMMENT'` — no APPROVE argument, no APPROVE
      branch.
- [x] **6.4 GREEN** — implemented the same four on `providers/gitlab.mjs`. GitLab's notes API has no
      review-event concept at all (no APPROVE code path exists on this provider either);
      `labelAdd`/`labelRemove` target the issues endpoint (`PUT .../issues/{n}` with
      `add_labels`/`remove_labels`), matching `labelEvents`' existing issues-only precedent on this
      provider.
- [x] **6.5** — added the four verb names to `VERBS` (`brain/scripts/vcs/cli.mjs`).
- [x] **6.6** — updated `vcs-contract.md`: added the four verbs to the required-verbs table, and
      fixed the stale "15 verbs" prose → "20 verbs" (16 pre-existing + 4 new = `VERBS.length`,
      `capabilities` included). No new ADR — ADR-0020 (already merged) covers this decision per the
      H0-a/H0-b split; a fresh ADR would re-litigate an already-signed ruling.
- [x] **6.7 GREEN** — the drift-guard (6.1, plus the pre-existing `verb-contract-drift-guard.test.mjs`)
      now passes: both providers export all four with normalized shapes.

## Phase 7 — `governance.reviewActors` wiring

- [x] **7.1 RED** — a test that L6's default `readBotAllowlist` reader reads ONLY
      `governance.reviewActors` and that an identity present ONLY in `governance.approvalActors`
      (`release-bot`) is EXCLUDED from L6's botAllowlist, using a real temp `brain.config.json` (not
      an injected fake). Observed RED: the reviewer-only entry was missing from `inputs.botAllowlist`
      before the fix. (Distinguishing assertion added on review — a union implementation fails it.)
- [x] **7.2 GREEN** — implemented the L6 `defaultReadBotAllowlist` to read `governance.reviewActors`
      ONLY. L6's botAllowlist key **moves** off `governance.approvalActors` — it does NOT union them
      (binding ruling **R2**: "no key feeds two gates"; the union was corrected on orchestrator review
      — see ruling below). L5 (`actor-check.mjs`) is **not** touched — it keeps reading
      `governance.approvalActors` only.
- [ ] **7.3 (deferred — reviewer bot handle undefined; owner decision pending)** — populate
      `governance.reviewActors` with the reviewer handle in `brain.config.json`; confirm the reviewer
      handle is **never** added to `governance.approvalActors` (Fork A, design §11). No dedicated
      reviewer bot identity exists yet — `brain.config.json` is untouched by this PR; both governance
      keys stay absent, defaulting to `[]`.

## Phase 8 — the two mandatory lock-3 tests (rev-2 binding condition B)

- [x] **8.1 — t1.** `actor-check` test: with a FIXTURE reviewer identity (`brain-reviewer[bot]`) as
      the `status:approved` actor, that identity in `governance.reviewActors` but NOT in
      `governance.approvalActors`, `evaluateActor` does NOT return `pass` via the allow-listed
      -automation branch — the reviewer cannot self-apply `status:approved` (REQ-266-6 t1, spec
      scenario). No L5 code change was needed (L5 is untouched by design) — the test was still
      written first and observed GREEN immediately, proving the pre-existing L5 code already
      satisfies the invariant once the reviewer is correctly kept out of `approvalActors`.
- [x] **8.2 — t2.** `brain-writes-reviewed` test: the same fixture reviewer identity in L6's
      `botAllowlist` (from `governance.reviewActors`) is excluded from the human-approver count — an
      APPROVED review authored by the reviewer is not counted as the human review (REQ-266-6 t2).
      Observed RED before 7.2's fix (old code returned `pass`); GREEN after.
- [x] **8.3 GATE** — both tests present and green in the H0-b PR. Non-negotiable. Confirmed:
      `npm test` → 1471/1471 green, both t1/t2 included.

## Phase 9 — H0-b close-out

- [x] **9.1** — `npm test` (1471/1471 green) and `npm run repo:check` (clean) both green; the
      drift-guard green; the two lock-3 tests green. `npm run brain:change:verify` was not run
      separately (equivalent to `repo:check` in this repo's script aliases — see `package.json`).
- [ ] **9.2** — open PR H0-b → the `issue-266` tracker branch (feature-branch-chain; not
      `feature/v2.0.0`), `Part of #266`, after H0-a's doctrine is promoted (confirmed: PR #271
      merged). Deferred to the orchestrator per the apply-agent's constraints — no PR opened by this
      agent.

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
- **RULING (H0-b, task 7.2): L6 reads `governance.reviewActors` ONLY — REPLACE, not union.** The
  apply agent first implemented `defaultReadBotAllowlist` as `approvalActors ∪ reviewActors`, reading
  the H0-b task's "threads it into its botAllowlist" as additive. Corrected on orchestrator review:
  the **signed** authority — ADR-0020 and binding ruling **R2** ("no key feeds two gates";
  `approvalActors` is **L5-only") — eliminates the union. The union keeps `approvalActors` feeding
  both gates, which is exactly the dual-semantics coupling the split exists to dissolve; it defeats
  the mechanism. `design.md:31-32`'s prose "L6 gains a second config read" was a drafting error
  contradicting R2 and has been corrected to "moves." A distinguishing test now asserts an
  `approvalActors`-only identity (`release-bot`) is EXCLUDED from L6's botAllowlist — a union fails
  it. **Migration note:** REPLACE means a consumer with a populated `governance.approvalActors` who
  relied on L6 excluding those identities must now also list them in `governance.reviewActors` (both
  effects require both registrations — explicit, never implicit). Zero live impact on brain itself:
  `approvalActors` is empty here.
- **RULING (H0-b rev-1, P272-OVERRIDE-KEY): the `override:*` whitelist reads `approvalActors`, not
  `reviewActors` — option (b).** The rev-1 reviewer found that the REPLACE silently relocated a SECOND
  function of the old key: the `override:*` label whitelist (`brain-writes-reviewed.mjs:225`) read
  `botAllowlist`, which now = `reviewActors`. R2 was not violated (reviewActors still feeds one gate),
  but the relocation was an undocumented side effect and the docstrings (58, 192) still named
  `approvalActors`. Human decision (comment 4991860920): **option (b)** — the override whitelist gets
  its OWN `governance.approvalActors` read (`readOverrideActors` / `defaultReadApprovalActors`);
  `reviewActors` stays a PURE identity list (one key, one meaning). override:* and status:approved are
  both human-trust grants keyed on `approvalActors`; the reviewer handle is in neither. Docstrings 58
  and 192 fixed; a sibling test asserts an override:* string in `reviewActors` only is NOT honored.
