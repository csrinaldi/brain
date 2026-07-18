---
status: draft
issue: 266
slice: H0-a
---

# Proposal — Reviewer protocol as doctrine + VCS port verbs (issue 266, slice H0-a)

## What

Track H (#266) converts the human-mediated external reviewer into an invocable **cold agent**.
Phase **H0** is the ADR-level foundation: the reviewer protocol promoted to doctrine, plus four
new write verbs on the VCS port. This proposal covers the **H0-a slice** — the planning and
doctrine layer that a human promotes, with zero executable behavior change:

- these four SDD artifacts (`proposal` / `spec` / `design` / `tasks`);
- an **ADR draft** for the reviewer protocol + the four port verbs (agent drafts to
  `brain-drafts/`, human promotes to `brain/core/methodology/` — Tier 2 / ADR-0013);
- the **design-off record** — both source design documents committed unmodified under the change
  dir (not `design-docs/` at the root — `governance.ignoreList` covers `openspec/changes/**` but
  not `design-docs/**`, `brain.config.json:16-27`);
- the **durable memory records** that the rev-2 verdict binds to the first push (the lock-3
  two-key decision and the meta-finding).

The verb *implementations* on both providers, the verb-contract drift-guard update, the two
mandatory lock-3 tests, and the `governance.reviewActors` wiring are the **H0-b slice** — carried
here in `tasks.md` as explicit `(deferred)` items so the whole of H0 is visible in one plan, but
delivered in a later PR.

The design was fully litigated on the issue thread and **APPROVED at rev 2** by the external
reviewer (comment 4986616224), with two conditions binding the first PR (see §Acceptance).

## Why

The external reviewer is real and load-bearing today, but **human-mediated**: a human relays a
`checkpoint-report.md` to the reviewer and relays the verdict back
(`docs/inbox/PLAN-adapters-v3.md`). That serializes every checkpoint on a human turn. The role —
verify against the server, rule design forks against doctrine, sequence parallel work — is
mechanizable. The judgment that must stay human is narrower than the whole role: it is the
*keystroke* that authorizes a merge.

The hazard that shapes the whole design is not hypothetical — it is in the code today.
`brain:protect` sets `required_approving_review_count: 1` on `main`, and L6
(`brain/scripts/vcs/brain-writes-reviewed.mjs:98-118`) counts any non-author, non-allowlisted
`state === 'APPROVED'` review as *the* human review of a `brain/**` write. A reviewer agent
running an APPROVE would satisfy branch protection **and** the brain-writes gate in one call — it
would become a merge authorizer. **The sacred asymmetry cannot be a rule the agent remembers; it
must be structurally impossible.** H0 encodes that as three independent structural locks and a
two-key split, all of which live at the ADR/port layer — which is why H0 is doctrine, and why the
protocol goes to the repo before any `brain:review` runner is built.

Part of #266.

## Scope

### Includes (this slice, H0-a)

- **ADR draft** for `reviewer-protocol.md` doctrine + the four VCS port verbs, drafted to
  `brain-drafts/` for human promotion; `brain/HOME.md` co-promoted in the same MR
  (the #197→#199 lesson — `decision-gate` step 1 enforces ADR + HOME together).
- **Four SDD artifacts** under `openspec/changes/issue-266-h0a-reviewer-protocol-doctrine/`.
- **Design-off record**: `design-off/reviewer-protocol-{claude-code,antigravity}.md`, committed
  unmodified under the change dir.
- **Durable records** written to `.memory/records/` and reaching the server with the first push:
  the lock-3 two-key decision (finding `H0-LOCK3-DUAL`) and the meta-finding.

### Deferred to H0-b (planned here, implemented later)

- `prReviewComment` / `issueComment` / `labelAdd` / `labelRemove` implemented on **both**
  providers (`brain/scripts/vcs/providers/{github,gitlab}.mjs`).
- The verb-contract drift-guard (`brain/scripts/vcs/providers/vcs.contract.test.mjs`) extended so
  it turns red until both providers implement the four verbs; `VERBS`
  (`brain/scripts/vcs/cli.mjs:22-27`) and `vcs-contract.md` updated in lockstep.
- The **two mandatory lock-3 tests** (spec REQ-266-6): reviewer identity fails `actor-check` on
  `status:approved`; reviewer identity is excluded from the L6 human-approver count.
- `governance.reviewActors` wired as the new L6-only key, read by
  `brain/scripts/vcs/brain-writes-reviewed.mjs`; the reviewer handle is **never** added to
  `governance.approvalActors`.

### Does not include (any slice of H0)

- **No `brain:review` runner, no CLI, no modes** — that is H1, a separate issue/track phase.
- **No GitHub Actions hosting** — that is H2, deferred to evidence from H1 usage.
- **No APPROVE capability, ever** — no verb, flag, or code path that can emit an APPROVE review is
  added on any provider (this is a permanent invariant, asserted by a unit test in H0-b).
- **No loosening or unlocking labels** — the reviewer's caller carries a hardcoded deny-set;
  `status:*` stays human-only.
