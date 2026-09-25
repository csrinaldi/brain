# ADR-0037 — Autonomy is configurable: modes A, B and C, B by default, and the producing identity never approves or merges

**Status**: Accepted
**Date**: 2026-09-25 — Cristian Rinaldi

## Context

The maintainer's goal for brain 2.0 (#313's 2026-09-02 VISION, carried into #1121 as property 3)
is a workflow that is *"automatic end to end unless the human intervenes or the product escalates
to the human"*, for a team of humans and for a team of agents.

Brain's doctrine says something narrower, and its code enforces less than its doctrine says:

| Surface | What it says or does today |
|---|---|
| `agent-authorities.md` Tier 3 | The agent never *"approve[s] or merge[s] its own MR"*. Tier 2: the human reviews every MR before merging. |
| `actor-check` (L5) | At `lite`, a timestamp heuristic: the approval label must postdate the latest foreign commit (ADR-0026 Amendment 1). It reads the approval of the **issue**, not who merges the PR. |
| Branch protection | `required_approving_review_count` is **0** at `lite`, 1 at `standard` and `regulated` (ADR-0026 Amendment 6). At `lite` the forge requires no approving review at all. |
| VCS port | `mrCreate` and `mrAutoMerge` (ADR-0034, #886). `mrAutoMerge` arms the forge's auto-merge and refuses unless `requiredReviews` is 0; it never merges. There is no verb that merges (ADR-0034's Context stated this before `mrAutoMerge` existed; it is still true of a direct merge). In this repository `allow_auto_merge` is off, so `mrAutoMerge` is refused at every tier (ADR-0034 Amendment 4). |
| Identities | `governance.reviewActors` and `governance.agentActors` name the reviewer and the agents (ADR-0020, ADR-0026 Amendment 3). Nothing compares the identity that produced a change with the identity that approves or merges it. Agents commonly push under the human's own credential, so on the forge the two are often the same account. |

So "an agent never approves or merges its own work" is a rule an agent is asked to remember,
and at `lite` nothing on the forge stops it. The first of the three principles in the
2026-09-24 analysis (#1121) is **authority outside the model**: humans sign doctrine and
approvals, gates run where no agent can skip them, and no gate claims more than its host
enforces. Read literally against the VISION, that looked like a contradiction: either the human
clicks every merge, or an agent does. The maintainer ruled on 2026-09-24 (#1121 ruling 5, #1123)
that it is neither, and that the answer is configuration.

## Decision

**Who approves the intent and who merges is configurable, in three modes. Mode B is the
default. In every mode, the identity that produced a change never approves or merges it.**

### The three modes

| Mode | Intent approved by (issue `status:approved`) | Merge executed by | When a human acts |
|---|---|---|---|
| **A** | a human | a human | every change, twice |
| **B** (default) | a human | the platform, automatically, when every required gate passes **and** the cold review, performed by an identity other than the producer, approves | on the intent, and whenever something escalates |
| **C** | an agent identity other than the producer | the platform, under the same conditions as B | only on escalation |

"The platform" means a governed step that runs outside any agent session, under the automation
identity #1107 provisions, and merges through the VCS port's merge verb (#1133). It is not the
agent that wrote the code, and it is not the reviewer. It merges only a head the gates evaluated
(#1133's `expectedHeadSha`), and it refuses on a red check.

"Escalates" means any of: a required gate is red; the cold review's verdict is not an approval
(`REVISE`, `STOP`, or no verdict for the current head); an identity cannot be resolved or two
identities coincide (below); the declared mode cannot be honoured by the host (below). An
escalation does not merge. It leaves the change for a human, who then acts as in mode A.

### The invariant, in every mode

**The identity that produced a change never approves it and never merges it.**

- **Producing identities** are the change's commit authors and the author of its PR/MR.
- **The cold reviewer** is the identity the verdict is posted as (`reviewer.handle`, listed in
  `governance.reviewActors`), and the engine that produced the findings is spawned without a
  forge credential (ADR-0033).
- **The merger** is the identity that performs the merge: a human in mode A, the automation
  identity in modes B and C.
- **The intent approver** is the identity that applied the approval label to the issue.

The identity gate (#1134) resolves all four, reports each one, and refuses when the producer
coincides with the reviewer, the merger or (mode C) the intent approver, and when any of them
cannot be resolved. An unresolvable identity is never assumed distinct.

**The solo maintainer at `lite`, stated rather than hidden.** At `lite`, in mode A only, a human
who produced the change (or whose credential an agent produced it under) may approve and merge
it. That is the operating model ADR-0026 already records for `lite`: *"two-human constraints are
unsatisfiable by construction"*. The gate reports it as `producer = merger (lite, mode A)`,
never as independent, and it is refused at `standard` and `regulated`. Modes B and C have no
such exception at any tier: their only claim is independence, so an identity collision is an
escalation there.

### How B reconciles the VISION with principle 1

In mode B the human signs **what** gets done: the issue's approval label, which the port already
refuses to let an agent apply (`issueCreate`'s `assertNoApprovalLabel`, `vcs-contract.md`).
The merge is **how** it lands, and it is executed by the platform against gates no agent can
skip, on a head the gates saw, after a review by a different identity. The agent that wrote the
code holds no merge verb and is not the merger. Authority stays outside the model: the human's
signature is on the intent, and the platform's gates are on the merge.

### The reviewer gains no authority

The cold review's verdict becomes a **necessary condition** of an automatic merge in modes B and
C. It is never sufficient, and the reviewer does not merge. ADR-0026's never-tiered rule stands
unchanged: *"no tier may grant the reviewer merge authority"*. The reviewer still posts
COMMENT-state verdicts only, through a verb with no approve path (`reviewer-protocol.md` §2,
locks 1 to 3). What changes is who reads the verdict: the merge step, in addition to the humans.

### Where the mode is declared

`governance.autonomy` in `brain.config.json`, one of `"A"`, `"B"`, `"C"`. Absent means `"B"`.
It is declared, never detected, like `governance.tier` (ADR-0026). The key, its schema entry,
its migration and its reporting land with the first implementation that reads it (#1134). This
ADR records the key's name and semantics, not its code.

### How it composes with the tiers

The mode and the tier are separate axes. Neither may mask the other, the same rule ADR-0026
applies to tier and substrate rung.

| Tier | A | B | C |
|---|---|---|---|
| `lite` | allowed; the solo exception above applies | allowed; the default | allowed |
| `standard` | allowed | allowed, but see below | allowed, but see below |
| `regulated` | allowed | allowed, but see below | **refused** (maintainer ruling, 2026-09-24, "for now") |

**At `standard` and `regulated`, B does not remove the human approving review.** Those tiers set
`required_approving_review_count: 1`, and the cold reviewer cannot supply it (lock 2). The
platform's merge therefore waits for a human approving review, exactly as `mrAutoMerge` already
refuses with `requires-human-approval` there (ADR-0034 L2). In practice, at those tiers, B moves
the human's act from the merge button to the approval, and brain reports it that way. Whether an
approving review may ever come from a non-human identity is not decided here; it would amend
ADR-0026 and `reviewer-protocol.md`, not this ADR.

**Mode C at `regulated` is a refusal, not a downgrade.** A declared `C` at `regulated` is a
configuration error: brain reports it, and no automatic merge runs until the declaration is
corrected. It never silently runs as B.

### Brain reports the mode honestly

Brain reports two things, in the spirit of ADR-0015 (never claim more than the host enforces) and
ADR-0026 (the declared tier and the detected rung are reported separately):

- **declared mode:** what `governance.autonomy` says;
- **effective mode:** what the host actually enforces today, with the reason for each gap.

The effective mode is never reported stronger than the host enforces. Concretely, B is effective
only when all of these hold: the merge verb exists and the forge accepts it (#1133); the identity
gate is a required check (#1134); the producer, reviewer and merger resolve to distinct
identities (#1107, `governance.agentActors`, `governance.reviewActors`); and the cold review for
the head exists. When any is missing, the effective mode is A and the report names which. C adds
one condition: an intent-approver identity distinct from the producer, through a path that is not
`issueCreate` (below).

### The transition, stated

**Until #1133 and #1134 land, mode B cannot be claimed, and the effective default is A.** The
declared default is B from promotion, so a consumer that sets nothing is already on the path to
B. What it runs today is A: a human approves the intent and a human merges. Brain says so rather
than letting the default read as shipped. The order is: #1107 (distinct identities) and #1133 (the
merge verb), then #1134 (the gate that makes the invariant a required check), then the reporting
that lets brain state an effective B.

Mode C has one more prerequisite that no open issue owns yet: an agent identity applying the
approval label. Today the port refuses that label on `issueCreate` by design, and this ADR does
not remove that refusal. C is recorded as a mode and stays not effective until an implementation
names the identity that approves intent and how it is kept distinct from the producer.

## How this relates to other decisions

- **ADR-0015.** The effective-mode report is its rule applied to autonomy: no report claims an
  enforcement the host does not perform.
- **ADR-0020.** The two-key split is unchanged. `reviewActors` stays L6-only and
  `approvalActors` L5-only. The identity gate reads both key sets as data about who is who; it
  does not widen what either key authorizes.
- **ADR-0026.** The tier table, `required_approving_review_count`, the evidence tiers and the
  never-tiered reviewer rule are unchanged. The mode is a separate declared axis; the tier bounds
  it (C refused at `regulated`; B at `standard`/`regulated` still waits for a human approval).
- **ADR-0031.** A commit's attribution is a claim, not a record. The identity gate therefore
  resolves identities from the forge (commit accounts, PR author, review author, merge actor),
  never from trailers.
- **ADR-0033.** The cold review stays a spawned stage whose producer holds no credential. Mode B
  makes its verdict load-bearing for a merge, which is one more reason the performer and the
  posting identity are configuration and never the producer (#1121 phase 4).
- **ADR-0034.** `mrAutoMerge` arms the forge's auto-merge and never merges; it stays the lane's
  verb. The merge in modes B and C goes through #1133's `mrMerge`, which refuses on a moved head
  or a red check, so it does not depend on the forge's `allow_auto_merge` setting.
- **ADR-0036.** B merges when every gate passes. ADR-0036 is what makes "every gate passes" say
  something about consumers and not only about brain's own repository.

## Consequences

- **The Tier 3 rule changes shape.** "Never approve or merge its own MR" becomes a per-mode rule
  that keeps "never the producing identity" (`agent-authorities-tier3.draft.md`).
- **Identity becomes load-bearing.** An agent that pushes under the human's credential collides
  with the human. That is acceptable in mode A at `lite` (reported) and an escalation in B and C.
  Distinct identities per agent (#1107) stop being a nicety and become the precondition of B.
- **A new required check.** #1134 adds a gate every consumer running B or C must require. Its
  failure mode is an escalation, never a silent pass.
- **Doctrine runs ahead of enforcement** until #1133 and #1134 land. The effective-mode report is
  how that gap stays visible.
- **At `standard` and `regulated`, B still needs a human approving review.** The automation moves,
  the human act does not disappear. This is a consequence of lock 2, and it is named so B is not
  read as "no human" at those tiers.

## What does NOT change

- The approval label is a human act on `issueCreate`: the port keeps refusing it. Mode C's
  approver path is future work, not a relaxation of this refusal.
- The reviewer's three locks (`reviewer-protocol.md` §2), ADR-0020's key split, and ADR-0026's
  tier parameters, including `required_approving_review_count`.
- Every existing required check and its tier policy. Nothing merges past a red check in any mode.
- `mrAutoMerge`'s contract and the memory lane's merge rules (ADR-0034).
- No code, no config default and no branch-protection setting changes in this ADR.

## Requires ratification at promotion

- **The `lite` solo exception** (mode A only, reported, refused above `lite`). Without it, the
  invariant would forbid the way this repository is operated today: agents push under the
  maintainer's credential and the maintainer merges.
- **The config key name**, `governance.autonomy` with values `"A"`, `"B"`, `"C"`.
- **Declared C at `regulated` is a configuration error**, not a fallback to B or A.

## Rejected alternatives

**Keep "a human merges everything" as the only mode.** It is property 3's baseline (~55%), and it
makes the human the bottleneck on work every gate has already evaluated.

**Let the producing agent merge when the gates are green.** The gates check outputs; they do not
check that the actor merging is not the actor being checked. The producer holding the merge verb is
the exact authority principle 1 keeps outside the model.

**Let the cold reviewer approve or merge.** It collides with ADR-0026's never-tiered reviewer rule
and with the locks that make reviewer-as-authorizer impossible by construction.

**One global switch, "automatic on or off".** It cannot say "human intent, automatic merge", which
is the mode the maintainer chose as the default.

**Tie the mode to the tier** (`lite` = C, `standard` = B, `regulated` = A). The tier says how much
ceremony a change costs; the mode says who acts. A solo `lite` maintainer who wants to merge by
hand, or a `standard` team that wants automatic merges, would each have to misdeclare one axis to
get the other.
