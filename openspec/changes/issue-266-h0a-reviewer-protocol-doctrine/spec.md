---
status: draft
issue: 266
slice: H0-a
---

# Spec — Reviewer protocol as doctrine + VCS port verbs (issue 266)

Delta requirements introduced by #266 phase H0. Each `[H0-a]` requirement is satisfied by an
artifact promoted in this slice; each `[H0-b]` requirement is a testable contract that the
deferred implementation slice must meet — written here so the acceptance surface for the whole of
H0 is fixed before any code lands. Tests follow the project's `node:test` + `assert/strict`
dependency-injection house style over injectable seams (no network, no real repo mutation).

Vocabulary:

- **L5** — the human-approval actor gate, `brain/scripts/vcs/actor-check.mjs`
  (`evaluateActor`). Reads `governance.approvalActors` as its `botAllowlist`.
- **L6** — the brain-writes-reviewed gate, `brain/scripts/vcs/brain-writes-reviewed.mjs`
  (`evaluateBrainWritesReviewed`). Reads `governance.approvalActors` as its `botAllowlist` today.
- **reviewer identity** — the login the cold reviewer posts under.
- **verdict** — a `brain-review/1` YAML block posted in a review body.

---

## REQ-266-1 [H0-a]: The reviewer protocol is promoted as doctrine, co-indexed with HOME

The synthesized protocol MUST be promoted to `brain/core/methodology/reviewer-protocol.md` via an
ADR (Tier 2 / ADR-0013): the agent drafts to `brain-drafts/`, a human promotes. `brain/HOME.md`
MUST be updated to index it **in the same MR** — the `decision-gate` step-1 rule that an ADR and
HOME move together (#197→#199 lesson).

The doctrine MUST state, as load-bearing content: the three structural locks (REQ-266-4), the
two-key split (REQ-266-5), the four port verbs (REQ-266-2), the verdict schema (REQ-266-7),
bounded revision (REQ-266-8), cold-boot (design §Cold boot), and monotonic label tightening with
the hardcoded deny-set (REQ-266-9).

#### Scenario: doctrine and HOME are promoted together
- **GIVEN** the reviewer-protocol ADR is being promoted
- **WHEN** the promotion MR is opened
- **THEN** it adds `brain/core/methodology/reviewer-protocol.md`
- **AND** it updates `brain/HOME.md` to index that file in the same MR

---

## REQ-266-2 [H0-b]: Four write verbs are added to the VCS port, on both providers

The port MUST gain exactly these verbs, each implemented by **both** `github` and `gitlab`
providers (`brain/scripts/vcs/providers/`):

| Verb | Signature | Contract |
|------|-----------|----------|
| `prReviewComment` | `({ project, number, body }) -> Promise<{ url }\|{ url: null, error }>` | Posts a review whose event is **`COMMENT`, hardcoded**. No parameter, flag, or branch selects any other event. |
| `issueComment` | `({ project, number, body }) -> Promise<{ url }\|{ url: null, error }>` | Posts a plain issue comment (rulings on issues). |
| `labelAdd` | `({ project, number, labels }) -> Promise<{ ok }\|{ ok: false, error }>` | Adds labels. The **caller** enforces the deny-set (REQ-266-9), not the verb. |
| `labelRemove` | `({ project, number, labels }) -> Promise<{ ok }\|{ ok: false, error }>` | Removes labels. |

The four verb names MUST be added to `VERBS` (`brain/scripts/vcs/cli.mjs:22-27`) and to the
`vcs-contract.md` required-verbs table. Adding verbs to the port is itself a decision → `decision`
label + ADR, by the protocol's own rule.

#### Scenario: the drift-guard is red until both providers implement all four
- **GIVEN** `prReviewComment` / `issueComment` / `labelAdd` / `labelRemove` are in `VERBS`
- **WHEN** the parameterized contract suite (`providers/vcs.contract.test.mjs`) runs over
  `['github', 'gitlab']`
- **THEN** it fails for any provider missing any of the four verbs
- **AND** it passes only when both providers export all four with the normalized return shapes

---

## REQ-266-3 [H0-b]: No code path can emit an APPROVE review, on any provider

There MUST be no verb, parameter, flag, or branch on any provider that produces a review with an
event other than `COMMENT`. `prReviewComment` hardcodes `event: 'COMMENT'`; there is no APPROVE
sibling verb and no APPROVE argument.

#### Scenario: APPROVE is structurally absent
- **GIVEN** the full VCS port surface after H0-b
- **WHEN** a unit test searches every provider's exported verbs and their bodies
- **THEN** no exported verb can emit an APPROVE/approved review event
- **AND** `prReviewComment`'s emitted event is `COMMENT` for every input

---

## REQ-266-4 [H0-a doctrine, H0-b enforced]: Three independent structural locks

The reviewer MUST be prevented from becoming a merge authorizer by three locks, any one of which
holds if the other two fail:

1. **COMMENT-state verdicts.** Verdicts post as COMMENT-state reviews. L6 counts only
   `state === 'APPROVED'` (`brain-writes-reviewed.mjs:98-99`), so a COMMENTED verdict is ignored
   by construction and can never be miscounted as the human approval.
2. **No approve capability in the adapter.** The verb hardcodes `event: 'COMMENT'` (REQ-266-3);
   there is no APPROVE code path to reach.
3. **Key separation.** The reviewer handle registers in `governance.reviewActors` — a **new** key
   read ONLY by L6 (`brain-writes-reviewed.mjs`) — and is **never** in `governance.approvalActors`,
   read ONLY by L5 (`actor-check.mjs`). No key feeds two gates.

#### Scenario: a COMMENTED verdict never satisfies the brain-writes gate
- **GIVEN** a PR touching `brain/**` whose only non-author review is a `state: 'COMMENTED'` verdict
- **WHEN** `evaluateBrainWritesReviewed` runs
- **THEN** the approver set is empty and the result is `warn` (never `pass` on that review)

---

## REQ-266-5 [H0-a decision, H0-b enforced]: The two-key split dissolves the dual-semantics coupling

**Hazard (verified in the tree).** `governance.approvalActors` is read as `botAllowlist` by BOTH
gates with OPPOSITE semantics: at L5 an actor in the list PASSES
(`actor-check.mjs:90-94` → `{ level: 'pass', reason: 'allow-listed automation identity' }`), and
at L6 an actor in the list is EXCLUDED from the human-approver count
(`brain-writes-reviewed.mjs:111` → `approvers.find(a => a !== author && !botAllowlist.includes(a))`).
A single registration of the reviewer in `governance.approvalActors` would therefore **de-authorize
it at L6 AND authorize it to self-apply `status:approved` at L5** — one key, two opposite effects.

The resolution (finding `H0-LOCK3-DUAL`, human-decided) is a **two-key split**: L6 reads a new
`governance.reviewActors`; the reviewer is registered there and never in `governance.approvalActors`.
No key feeds two gates; the coupling is dissolved by construction rather than by discipline.

#### Scenario: the reviewer is L6-only, never L5
- **GIVEN** the reviewer handle is in `governance.reviewActors`
- **WHEN** the config is read by each gate
- **THEN** L6 (`brain-writes-reviewed.mjs`) sees the reviewer as a non-human-approver identity
- **AND** L5 (`actor-check.mjs`) does not see the reviewer in its `botAllowlist`

---

## REQ-266-6 [H0-b]: The two mandatory lock-3 tests (rev-2 binding condition)

The implementation slice MUST carry **both** tests below. They are the executable proof that the
two-key split holds; the rev-2 verdict makes them a binding condition of the first PR
(comment 4986616224). Neither may be deferred past H0-b.

- **t1 — reviewer fails L5 on `status:approved`.** With the reviewer identity as the actor that
  applied the approved label, and the reviewer registered ONLY in `governance.reviewActors` (not
  `governance.approvalActors`), `evaluateActor` MUST NOT return `pass` via the allow-listed-actor
  branch. The reviewer identity does not pass `actor-check` when applying `status:approved`.
- **t2 — reviewer excluded from the L6 human count.** With the reviewer registered in
  `governance.reviewActors` and threaded into L6's `botAllowlist`, an APPROVED review authored by
  the reviewer identity MUST NOT be counted as the human approver by `evaluateBrainWritesReviewed`.

#### Scenario: t1 — reviewer identity does not pass L5 on status:approved
- **GIVEN** the reviewer identity is the actor of the latest approved-label `labeled` event
- **AND** the reviewer is in `governance.reviewActors` but NOT in `governance.approvalActors`
- **WHEN** `evaluateActor` runs with `botAllowlist` sourced from `governance.approvalActors`
- **THEN** the reviewer is not admitted by the allow-listed-automation branch

#### Scenario: t2 — reviewer identity is not the L6 human approver
- **GIVEN** the only APPROVED review on a `brain/**` PR is authored by the reviewer identity
- **AND** the reviewer identity is in L6's `botAllowlist` (from `governance.reviewActors`)
- **WHEN** `evaluateBrainWritesReviewed` runs
- **THEN** no human approver is found and the result is not `pass`

---

## REQ-266-7 [H0-a]: The verdict schema `brain-review/1` is specified

The doctrine MUST define the verdict as a fenced YAML block (`protocol: brain-review/1`) with:
`verdict ∈ APPROVE|REVISE|STOP`; `head_sha` **mandatory** (the staleness anchor); `rev`; `gates`
(required + detection levels quoted verbatim); `findings[]` where **`evidence:` is mandatory** (a
command the reviewer actually ran — a finding without one is inadmissible) and **`cites:` is
mandatory for `severity: blocker`** (an uncited blocker is downgraded to `correction`);
`conditions[]`; optional `pin:`; optional `sequencing:`.

#### Scenario: a blocker without a citation is downgraded
- **GIVEN** a `brain-review/1` finding with `severity: blocker` and no `cites:`
- **WHEN** the verdict schema is applied
- **THEN** the finding is admissible only as a `correction`, never as a `blocker`

---

## REQ-266-8 [H0-a]: Revision is bounded — rev>=3 forces STOP

The doctrine MUST forbid a fourth REVISE. At `rev >= 3` the reviewer MUST emit `STOP` +
`escalate: human` instead of a fourth REVISE. No infinite revise loop is possible by construction.

#### Scenario: the fourth REVISE is impossible
- **GIVEN** a thread already at `rev: 3`
- **WHEN** the reviewer would otherwise REVISE again
- **THEN** it emits `verdict: STOP` with `escalate: human`

---

## REQ-266-9 [H0-a doctrine, H0-b enforced]: Labels tighten monotonically; the deny-set is hardcoded

The reviewer MAY apply labels that make a gate stricter (`decision`, `seq:*`, `reviewed:*`,
`needs-ruling`) and MUST NEVER apply labels that loosen (`size:exception`, `skip:memory-gate`) or
unlock (`status:approved`). The deny-set MUST be hardcoded in the caller, not left to the model.
`actor-check` independently catches a misapplied `status:approved` from any identity not in
`governance.approvalActors` — and the reviewer is never in `governance.approvalActors` — so a
deny-set bug is still visible at L5.

#### Scenario: an unlock label is refused by the caller
- **GIVEN** the reviewer attempts to apply `status:approved`
- **WHEN** the caller's deny-set is checked before `labelAdd`
- **THEN** the label is refused and never sent to the provider

---

## Acceptance (the two rev-2 conditions binding the first PR)

The external reviewer APPROVED at rev 2 (comment 4986616224) with two conditions that bind the
first PR of this slice, where they will be re-derived cold:

- [ ] **Condition A — durable records reach the server with the first push.** The lock-3 decision
      record and the meta-finding record MUST be present under `.memory/records/` in the first PR.
      Absence in the first PR is itself a finding.
- [ ] **Condition B — both mandatory lock-3 tests ship with the implementation.** REQ-266-6 t1 and
      t2 MUST be present in the H0-b implementation. (Planned in this slice; enforced when H0-b lands.)

#### Scenario: Condition A — the records are on the server
- **GIVEN** the H0-a first PR
- **WHEN** its diff is inspected cold
- **THEN** `.memory/records/` contains the lock-3 decision record and the meta-finding record

---

## Out of scope

- The `brain:review` runner, its modes, cold-worktree execution (H1).
- GitHub Actions hosting and the per-PR concurrency mutex (H2).
- Any change to L5/L6 evaluator logic beyond adding the `governance.reviewActors` read at L6.
- Any APPROVE capability on any provider — permanently excluded (REQ-266-3).
