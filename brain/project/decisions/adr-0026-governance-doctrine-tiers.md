# ADR-0026 — Governance Doctrine Tiers: A Declared Axis Orthogonal to the Detected Substrate Ladder

**Status**: Accepted · **amended 21/08/2026** (Amendments 1-7 — see below)  
**Date**: 31/07/2026 — Cristian Rinaldi

## Context

ADR-0015 established six enforcement levels (L1–L6) over observable evidence and a
four-rung substrate ladder, with one global doctrine: five `REQUIRED_JOBS`, three
`DETECTION_JOBS`, four mandatory SDD artefacts, a 400-line diff budget. That doctrine
was authored for exactly one repo shape, and two structural contradictions have since
been observed that no implementation work can resolve:

1. **#329** — `actor-check` (L5) requires the `status:approved` actor to differ from the
   PR author. #124 requires the maintainer personally to apply that label. At one
   maintainer both are correct and mutually unsatisfiable; the gate can never pass. It
   is not misfiring — it is correctly reporting a condition the repo's own operating
   model guarantees. This blocked the whole detection→prevention promotion, because the
   documented "one-line move" from `DETECTION_JOBS` to `REQUIRED_JOBS` would make the
   repo permanently unmergeable for its own maintainer.
2. **#94** — branch protection returns `403` on brain's free-tier private repo, so the
   five "required" contexts have no substrate that requires them.

A third contradiction was found while resolving Q5 and is **recorded here for the first
time**: `brain-writes-reviewed` (L6) requires "an APPROVED review from a non-author,
non-bot human." That is **as unsatisfiable at one maintainer as `actor-check`'s
distinctness rule.** The Q5 recommendation in epic #313 asserts that
`brain-writes-reviewed` "never tiers" while its shipped evidence form cannot be
satisfied at the tier that most needs it. The same defect, one level deeper, unnoticed.

All three are one root cause: **brain conflates what a substrate CAN enforce with what
a team CHOOSES to be bound by.** The rung ladder already answers the first question, by
detection, and never lies about it (`verifiable: false` marks anything backed only by a
config declaration). Nothing answers the second.

## Decision

Introduce a second governance axis: a **declared** doctrine tier, orthogonal to the
**detected** substrate rung.

| Axis | Source | Question | Values |
|---|---|---|---|
| **Rung** (ADR-0015) | detected, never declared | WHERE fail-closed can live | 1 merge · 2 release · 3 auto-correct · 4 floor |
| **Tier** (this ADR) | declared, never detected | WHICH invariants are load-bearing, and on what evidence | lite · standard · regulated |

`governance.tier` is consumer config, defaulting to `standard` (behaviourally identical
to brain's pre-tier doctrine, so the migration is a no-op for every existing consumer).
The axes compose and neither may mask the other:
`brain:governance-status` reports both separately and renders their cross-product per
gate — a gate required by doctrine on a substrate that cannot block is surfaced as
"required by doctrine, detection-only in substrate", never as armed.

### The three tiers

| Tier | Operating model | What it buys |
|---|---|---|
| **lite** | Solo maintainer, experiment, internal tool. A bad merge is reversible by the person who made it. Two-human constraints are unsatisfiable by construction. | Traceability, correctness, agent containment, a reviewable slice — and a *passing* approval gate. |
| **standard** | Small team (n≥2), product code with external users. A bad merge is real but bounded. | Everything in lite, plus full artefact discipline, memory capture, distinct-actor approval, and a blocking release gate. **The default.** |
| **regulated** | Audited/compliance context or high-blast-radius infrastructure. A bad merge has external, sometimes legal cost. | Everything in standard, plus non-waivable constraints, a recorded verification artefact, auto-correction, and panel review. |

Three, not two: two tiers leave nowhere to put the constraints brain deliberately does
*not* impose on a normal team but which are the entire reason an audited shop would
adopt a governance layer. Three, not four: each tier costs a maintained matrix column,
docs, and a test axis, and at zero external adopters a fourth is speculative.

### Two tiering mechanisms — the load-bearing distinction

- **Position tiering** (`required` ⇄ `detection`) — used ONLY for proportionality:
  ceremony whose per-change cost is real and whose benefit scales with team size.
- **Evidence tiering** — the gate stays `required` at every tier; *what satisfies it*
  changes. Used when a gate belongs to the never-tiered core but one evidence form is
  structurally unsatisfiable at a tier's operating model.

Evidence tiering is what resolves #329 and its undocumented twin. It is strictly better
than the two options #329 itself proposed: the gate neither stops blocking nor stays
permanently red — it blocks, on evidence a solo maintainer can actually produce.

### Never-tiered by position (`required` at every tier); evidence may tier

| Gate | lite evidence | standard evidence | regulated evidence |
|---|---|---|---|
| `issue-link` | linked issue carries the approved label | same | same |
| `local-checks` | `repo:check` + `brain:nav` + `npm test` | same | same |
| `decision-gate` | ADR ⇔ `brain/HOME.md` co-occurrence **[Amended by Amendment 4 (#516) — only in the ADDED direction: an added ADR requires a `HOME.md` change, and a `HOME.md` change requires some ADR to be touched, but a MODIFIED ADR alone passes (#510). See Amendment 4.]** | + the `decision`-label step hard — **not implemented; the gate reads no labels at any tier (Amendment 4)** | + the ADR carries a recorded human signature |
| `diff-size` | ≤ 1000, `size:exception` honored | ≤ 400, honored | ≤ 200, **not honored** |
| `actor-check` | **distinct act over foreign commits** (Amendment 1, #418) — the approval event is strictly later than the latest *foreign* commit: one authored by anyone other than the approver or a registered `governance.reviewActors` identity. Commits by the approver or a verified reviewer identity never re-arm an existing approval. An author that cannot be resolved to an account counts as **foreign** (fail closed). With no foreign commit on the branch, any approval event satisfies the evidence. **[Amended by Amendment 2 (#473) — a `brain-decision/1 APPROVE` review comment, anchored on the PR's head SHA and posted via `brain:approve`, is ALSO sufficient `lite` evidence, OR'd with the distinct-act check above; see Amendment 2.]** **[Amended by Amendment 3 (#454) — the exempt set also includes identities registered in `governance.agentActors`: an agent acting inside the approved loop under the approver's instruction does not re-arm the approval; see Amendment 3.]** **[Amended by Amendment 5 (#581) — `governance.reviewActors` is REMOVED from the exempt set: a read-only identity has no commits to exempt, so a commit under one re-arms like any other foreign commit; see Amendment 5.]** | distinct act **+ distinct actor** — unchanged: the approval postdates the head-commit push | + the approver authored no commit on the branch — unchanged |
| `brain-writes-reviewed` | **agent-authorship exclusion** — no `governance.reviewActors` identity authored the `brain/**` change | non-author, non-bot **human** APPROVED review | + CODEOWNERS armed at rung 1 where the substrate allows |

The reviewer's `event: COMMENT` constraint (ADR-0020) is likewise never-tiered: **no
tier may grant the reviewer merge authority**, which would collide with L5 and #124.

### Tiered by position (proportionality)

| Gate | lite | standard | regulated |
|---|---|---|---|
| `memory-gate` | detection | required | required |
| `phase-order` | detection | required | required |
| release gate (rung 2) | detection | required | required |
| post-merge auto-revert (rung 3) | detection | detection | required |
| reviewer verdict recorded | — | detection | detection (panel ≥2) |

### Doctrine parameters

| Parameter | lite | standard | regulated |
|---|---|---|---|
| `phase-order` Rule A artefacts | `spec.md` | all four | all four + recorded verification artefact |
| diff budget | 1000 | 400 | 200 |
| `required_approving_review_count` | **0** | **1** | **1** |
| `size:exception` honored | yes | yes | no |
| reviewer verdict mode | deterministic checks only | single engine | panel ≥2, consensus-gated | **[Amended by Amendment 7 (#743) — RETIRED. The review system is not tiered: the protocol is always `brain-review/2` and the judgment half is a config capability. See Amendment 7.]**

### The seven tier invariants

1. **Monotonic ordinal** — `lite < standard < regulated`; nothing required at a lower
   tier is relaxed at a higher one. An unknown tier fails closed.
2. **A never-tiered core exists and is enumerated in code** — gates whose relaxation
   would make brain's claims false rather than merely weaker.
3. **No tier drops a gate below `detection`.** There is no `off`. `GOVERNANCE_JOBS`
   stays tier-independent: every job runs at every tier; only its exit policy and its
   branch-protection membership vary. This is the anti-pattern guard — tiers must never
   become a way to make an inconvenient red check disappear.
4. **Tier is declared, rung is detected, neither masks the other.** The tier is never
   inferred from platform capability, plan, visibility, or contributor count.
5. **Satisfiability** — a gate is never `required` at a tier whose own definition makes
   it structurally impossible to satisfy. Where the core conflicts with satisfiability,
   the *evidence* tiers and the *position* does not.
6. **Waivers are themselves tiered** — `size:exception` and the pre-existing
   allow-listed `override:*` label are honored at lite/standard and refused at
   regulated. A doctrine whose constraints the team can waive at will is a preference.
   Critically, `lite` MUST pass L5/L6 on its own evidence form with `override:*`
   **unused**: an override is a bypass, and a tier whose gates pass only by bypass has
   no doctrine.
7. **Proportionality bounds relaxation** — position tiering applies only to ceremony,
   never to correctness, traceability, agent containment, or internal consistency.

### brain declares `lite`

Explicitly in `brain.config.json`, as a recorded declaration and never by default.
Evidence: one maintainer (#329), free-tier private repo → `403` (#94) → detected rung 4.
The measured effect is that `actor-check` and `brain-writes-reviewed` move from
detection (one of them permanently red) to **required and passing**, while only
`memory-gate` moves to detection — and `memory-gate`'s check is already documented as
repo-global, identical for every merge in a window. **Declaring `lite` makes brain's
governance stronger, not weaker.**

### Divergence from the Q5 recommendation (requires ratification at promotion)

Epic #313's Q5 line recommends `standard = proposal + spec`. This ADR does **not** adopt
that: it contradicts ratified REQ-L4-2 (*"requires `spec.md` AND `design.md`, not just
`proposal.md` + `tasks.md`"*), a requirement that exists because `proposal + tasks` was
measured as insufficient. Since `standard` is the default tier, adopting the one-liner
literally would weaken the *default* doctrine as a side effect of a change whose purpose
is to make it more honest. `standard` therefore keeps all four artefacts, and
`regulated` earns its delta from a recorded verification artefact instead. The
compromise position, if preferred, is `standard = proposal + spec + design`.

## Consequences

- **Positive**: #329 resolves with a *passing* gate rather than a documented warn — the
  outcome its own acceptance criteria hoped for but did not expect.
- **Positive**: the detection→prevention promotion becomes decidable. `actor-check` and
  `brain-writes-reviewed` can be promoted at every tier (with tiered evidence);
  `phase-order` at standard/regulated only. The blocked global question dissolves into
  three per-tier answers.
- **Positive**: #94 decouples. The doctrine question is answered independently of which
  GitHub plan brain buys; brain can stay at rung 4 with a truthful, non-red report.
- **Positive**: brain becomes honest about the two axes for the first time. Today it
  runs a standard-shaped doctrine at rung 4 while one of its gates can never pass.
- **Positive**: `#284` (reviewer v2 refuter) is reframed from a nice-to-have into
  `regulated`'s enabling work.
- **Positive**: the concept has a fail-closed guard — a new governance job with no tier
  row turns the drift-guard test red, so adding a gate forces a tier decision.
- **Negative (honest residual)**: `standard` and `regulated` are **unexercised**. brain
  can only run `lite`. Their validation requires an n≥2 adopter; until then they are
  specified and tested, not proven.
- **Negative (honest residual)**: `regulated` is unsatisfiable on GitLab today — its
  rung-3 auto-revert obligation is GitHub-only (#130).
- **Negative (precondition)**: `lite`'s distinct-act evidence is a timestamp comparison
  and therefore **blocked on #328** (gate verdicts computed before the approval exists).
  Conversely, it is the cleanest available fix for #328's stale-green class: the check
  can no longer pass without observing an event that postdates the code.
  **[Amended by Amendment 1 (#418) — the comparison target moved from the head commit
  to the latest *foreign* commit at `lite`. The stale-green property is retained against
  every actor whose work the approver has not seen.]**
- **Negative (precondition, easy to skip)**: `phase-order`'s promotion still carries
  ADR-0015's recorded precondition — fail-close its uncomputable-diff branch first, or
  a false positive becomes a hard block.
- **Negative (pre-existing, now load-bearing)**: the `override:*` allowlist is read
  from `governance.approvalActors` — the same key that grants an identity the right to
  apply `status:approved`. The code's own comments flag this dual-semantics smell.
  Tier-scoping the override makes the overload load-bearing; splitting the key into a
  dedicated `governance.overrideLabels` should be considered in the same slice.
- **Negative (pre-existing, PARTLY resolved by Amendment 4, #516)**: `decision-gate`'s shipped
  check does not match its documentation. Two halves, and they are in different states.
  **Resolved**: the check was described as an *unconditional* ADR ⇔ `brain/HOME.md`
  co-occurrence. Since #510 it is added-only in one direction and touched-keyed in the other;
  the documentation (this row, `workflow-governance.md` invariant 4, `consolidation-protocol.md`
  §1c/§1d) was corrected to match, and the code half is pinned by test.
  **Still open**: the check is LABEL-BLIND at every tier, while the doctrine described a
  label-conditional step 1 and a heuristic step 2 — neither of which exists in any code path.
  The `standard` evidence row above (*"+ the `decision`-label step hard"*) therefore still
  describes behaviour that has never shipped, and still means nothing until it does.
- **Negative**: three tiers is three matrix columns to maintain, three docs paths, and a
  test axis on every tiered gate. Accepted as the cost of not shipping one doctrine that
  fits nobody.

## Amendment 1 — `lite` distinct-act re-arms only on foreign commits (issue #418)

**Signed**: 04/08/2026 — Cristian Rinaldi

The original `lite` evidence compared the approval event against the head-commit push.
Measured cost (#418, during #396): five pushes required five re-applications of
`status:approved`, and each fresh signature certified nothing the approver did not
already know — at `lite` the approver is *allowed* to be the author, so the check
degrades from "did someone slip work past the reviewer" to "did you keep working on
your own branch". The cost scales linearly with iteration count; the security value at
n=1 is near zero. It also structurally blocks the automated review loop (#409): every
agent fix-push would demand a fresh human signature, defeating the automation it gates.

Amended rule at `lite`: a push **re-arms** the approval requirement only when its author
is *foreign* — neither the approver nor a registered `governance.reviewActors` identity.
Uncomputable authorship is foreign (fail closed). The stale-green property #328 fixed is
retained against every actor whose work the approver has not seen: any third-party push
still invalidates the approval.

`standard` and `regulated` are untouched. There the approver is never the author, so
"did the code change after approval?" genuinely asks *did someone slip work past the
reviewer* — a property worth its cost.

**Precondition, satisfied:** #413 (PR #424) — the reviewer identity is now verified
against the token. The `reviewActors` exemption is only safe with a verifiable
identity; before #413 anyone holding any token could *declare* themselves the bot.

### Accepted losses, recorded rather than implied

1. **The n=1 "final state" look is gone.** A solo maintainer can approve once and keep
   pushing. This is the point of the amendment, and it is a real loss — the old rule did
   force a glance at the final state. Judged near-zero value against linear cost.
2. **A `reviewActors` identity can push after approval without re-arming.** Bounded
   three ways: the identity is verifiable (#413), it is registered by the owner in
   config (an L6-only key that never grants approval, per the L5/L6 separation), and
   `brain-writes-reviewed` still fails any `brain/**` change authored by a reviewer
   identity at every tier. Residual: for non-`brain/**` paths the bot could land
   post-approval content that no human re-signed. The recorded retreat position, if that
   residual proves unacceptable, is to drop the `reviewActors` exemption and keep only
   the approver exemption.

### Honest residuals

- **GitLab gets no relief.** `prCommits()` on GitLab cannot resolve commit authors to
  accounts (`login: null`, the documented residual) — every author is uncomputable ⇒
  foreign ⇒ the behaviour on GitLab is exactly the pre-amendment one. Honest and safe,
  but unequal across providers until the GL authorship residual is solved.
- **Unattributed authors get no relief either.** Commits authored as
  `Claude <noreply@anthropic.com>` (this repo's own agent-session convention) do not
  resolve to the approver's account ⇒ foreign ⇒ re-arm. The amendment relieves exactly
  the commits attributed to the approver's account or to a registered reviewer identity.
  The operator-side remedy is to attribute session commits to an account in one of the
  two exempt sets; the fail-closed default is correct without it.
- **The exemption set is config.** Whoever can edit `governance.reviewActors` can mint a
  non-re-arming identity. The trust model is unchanged — that key already gates L6 — but
  this amendment raises what the key buys.

### Alternatives rejected

- **Approval scoped to PR creation rather than head** — stable, but drops the "you
  approved the final state" property at *every* tier.
- **Content-scoped re-arming** (docs/test-only commits do not re-arm) — fragile, gameable.
- **Document the cost and accept it** — viable only while every push is human; #409's
  automated reviewer loop ends that.

## References

- `openspec/changes/issue-358-q5-doctrine-tiers/proposal.md` — the two-axis framing.
- `openspec/changes/issue-358-q5-doctrine-tiers/spec.md` — REQ-TIER-1..11 and the
  tier-scoped REQ-L4-2′ / REQ-L5-1′ / REQ-L6-1′.
- `openspec/changes/issue-358-q5-doctrine-tiers/design.md` — §1 rejected alternatives,
  §2 the full matrix, §3 the divergence, §4 the #329 resolution and promotion verdicts,
  §5 the measured cost of brain declaring `lite`, §6 T2.1 scoping, §7 M3 impact,
  §8 the implementation seam.
- `openspec/changes/issue-418-lite-distinct-act-rearm/` — Amendment 1's proposal, spec
  (REQ-418-1..7), design, and the signed draft in `brain-drafts/`.
- [ADR-0015](adr-0015-governance-v3-substrate-ladder.md) — the six levels and the
  four-rung ladder this ADR adds a second, orthogonal axis to. **Amended**: REQ-L4-2
  (artefact set tier-scoped), REQ-L5-1 (evidence tiered), REQ-L6-1 (evidence tiered),
  REQ-HONESTY-1/2 (extended to report tier alongside rung). The
  `REQUIRED_JOBS`/`DETECTION_JOBS` two-bucket registry is generalized to a
  `(gate × tier) → policy` function; `GOVERNANCE_JOBS` is unchanged.
- [ADR-0014](adr-0014-workflow-governance.md) — the enforce-outputs / guide-judgment
  boundary. Preserved: `regulated` enforces the review *artefact*, never the tool.
- [ADR-0020](adr-0020-reviewer-port-verbs-and-two-key-split.md) — `event: COMMENT` and
  the `reviewActors`/`approvalActors` split. Both preserved; `event: COMMENT` is added
  to the never-tiered core, and `reviewActors` is reused as `lite`'s L6 identity set —
  and, under Amendment 1, as `lite`'s non-re-arming push identity set.
- [ADR-0013](adr-0013-auto-adr-onboarding.md) — the Tier-2 draft → human-review →
  promotion flow this ADR itself follows.
- Issues: #358 (Q5), #329 (the blocker resolved), #94 (decoupled), #328 (precondition),
  #124 (preserved), #130 (regulated's GitLab gap), #284 (regulated's enabling work),
  #317 (tier-independent, lands first), #313 (epic), **#418 (Amendment 1)**,
  **#413 (Amendment 1's precondition)**.

## Amendment 2 — a signed decision block is admissible `lite` evidence for `actor-check` (issue #473)

**Signed**: 08/08/2026 — Cristian Rinaldi

### Context

Amendment 1 (#418) fixed the *cost* of `lite`'s distinct-act check — a push no
longer forces a fresh `status:approved` label unless its author is foreign. It
did not fix what the check *means*. A `status:approved` label event carries a
timestamp and nothing else: it proves an approval happened after some commit,
never *which diff* the approver actually looked at. That is a category error,
not a missing feature — authorization (may this proceed at all, #124) was
being asked to double as verification (does THIS diff pass), and a timestamp
comparison cannot answer the second question no matter how it is amended.

The "unattributed authors get no relief" residual ADR-0026 already records
(Amendment 1, Honest residuals) is the symptom. The label was re-applied five
times in one day (#454) purely to re-arm a check that was never asked to look
at the diff it was re-arming against — each re-application certified nothing
the approver had not already certified the first time. #497 shows the same
shape from the other side: a re-arm that only a human keystroke can satisfy,
on a PR where no line the approver cares about changed. Neither measurement
is a case of the check working correctly and expensively; both are the same
category error surfacing under different triggers.

### Decision

One new admissible evidence FORM at `lite` for `actor-check` only: a
`brain-decision/1 APPROVE` block, posted as a PR review comment through the
EXISTING `prReviewComment` verb, anchored on the PR's head commit SHA, whose
declared `actor` field equals the posting review's author and is not a
`governance.reviewActors` identity. This evidence is OR-composed with the
existing distinct-act check (Amendment 1) — either one alone satisfies `lite`
admissibility; neither is required when the other is present.

The `status:approved` label remains the precondition. `evaluateActor` checks
for a labeled event BEFORE dispatching to any tier-specific evidence,
`brain-decision/1` included — a signed block with no label event ever present
still yields `warn`, not `pass`. The label authorizes ("may this proceed");
the block verifies ("this is the diff a human read"). Amendment 2 does not
collapse that split, it completes it: the label answers the first question,
the block now answers the second, and the label no longer has to pretend to
answer both.

No new port verb exists. `brain:approve` (`brain/scripts/approve/cli.mjs`)
posts through `prReviewComment` with no `event` key — `event: 'COMMENT'`
stays hardcoded provider-side, exactly as it did before this change. ADR-0020
Locks 1-3 hold verbatim: no APPROVE code path, no adapter gains approve
capability, `governance.reviewActors` is never read as `approvalActors`.
`standard` and `regulated` are untouched — this is a `lite`-only widening.
`brain-writes-reviewed`'s (L6) row is untouched, and `prReviews()`'s
normalized shape (`{state, author, body}`) does not change on either
provider.

### The monotonicity claim, stated outright

No PR that passes `lite` admissibility today can fail it after this change,
and no PR that fails today (no label event, or a label event that fails the
distinct-act check, with no admissible `brain-decision/1` block) can pass
after this change. The block is additive evidence, never a stricter gate on
the existing path: a present-but-broken block (wrong head, wrong actor,
malformed, wrong protocol version) never turns a pass into a fail — it
annotates the fallback verdict's reason string and the run falls through to
`evaluateDistinctAct` exactly as before.

**Proof reference**: `brain/scripts/vcs/actor-check.test.mjs`, the section the
file's own comment (lines 1744-1748) names as the monotonicity proof — the
full PRE-EXISTING `evaluateDistinctAct` matrix (lines 1-1227) is re-run
BYTE-FOR-BYTE unmodified by the same `npm test` invocation that exercises the
new evidence source. A regression in either direction (a PR that used to pass
now failing, or a PR admitted on strictly less evidence than before) fails
that pinned suite, not a new one written to match the new behavior.

### Accepted losses, recorded rather than implied

1. **This does not reduce the number of human signatures per push.** A push
   moves the PR head; every prior `brain-decision/1` block goes stale
   (`head_sha` no longer matches) and the gate correctly re-arms. What changes
   is what the NEXT signature names: not "an approval happened at some point,"
   but "a human read the diff at exactly this SHA." The five-times-in-a-day
   cost Amendment 1 fixed for the label stays fixed; this amendment does not
   reopen it, and does not promise to close it further.
2. **A `reviewActors` identity still cannot manufacture evidence via this
   path.** Deny-before-allow runs on the block's review author, mirroring L5
   read rule 15 (`actor-check.mjs:358-365`) — an agent holding its own
   verified token still cannot self-admit.
3. **`decision-block.mjs`'s emitter/parser gained a fourth field family
   (`head_sha`, `actor`, `at`, `in_reply_to`) that only `at` and
   `in_reply_to` leave unread.** Both are written for the audit trail and
   validated by nothing — a future reader who makes them load-bearing is
   changing the contract, not tidying it (design.md §E1).

### Honest residuals

- **GitLab's quoted-note ambiguity is closed only by the actor/head rules,
  not by construction.** `prReviews` on GitLab returns every non-system note
  (`gitlab.mjs:352-354`), so a comment that merely QUOTES a valid block (a
  human pasting someone else's signature to discuss it) is a candidate row.
  It is refused only because rules 10 (head match) and 14 (actor === review
  author) both have to hold for the quote to be admissible — quoting is
  admissible only when quoting is behaviorally equivalent to signing.
  Recorded as a residual, not eliminated: the port does not distinguish "I am
  signing" from "I am quoting a signature" at the transport level.
- **On GitHub, a block pasted into a normal PR CONVERSATION comment does not
  count.** `prReviews()` reads `/pulls/N/reviews` only; `brain:approve` is the
  sanctioned path specifically because it posts through that surface. Widening
  the read port to also scan issue-thread comments is out of scope here.
- **Head resolution is capped by `prCommits` pagination.** GitHub's
  `/pulls/N/commits` endpoint caps at 250 commits; on a PR that exceeds it, the
  resolved head is wrong and every block is refused — the fail-closed
  direction (a mismatched head never grants a pass), but a false negative on
  very long-lived branches.
- **Only the first fenced block in a review body is read** (`rule 17`,
  `parse-verdict.mjs`'s own `FENCE_RE` primitive, shared via
  `yaml-block.mjs`). A stale block quoted above a fresh one refuses — correct
  direction, but a human who edits a review comment rather than posting a new
  one can produce a body the reader treats as unreadable.
- **A COMMENT-state review satisfies this check.** It would NOT satisfy a
  future `required_approving_review_count` branch-protection rule (#94) if
  GitHub Free's 403 on that feature is ever lifted for this repo — `lite`'s
  own doctrine already accepts a COMMENT-state signature (design.md §E2,
  "review `state` is deliberately not constrained" — encoding *how* a human
  clicked is not evidence about the diff, and GitLab's notes API has no
  approval-event concept to encode in the first place).
- **`dispositions` (per-finding structured verdicts inside the block) is a
  separate ticket**, deliberately absent from `brain-decision/1`'s field set
  (design.md §E1). This amendment answers only "which diff, signed by whom."
- **Post-then-verify matches the landed body by exact string equality.** A
  provider that normalizes whitespace server-side (trailing-newline
  collapse, CRLF→LF, trimmed trailing spaces on a line) would make the
  landed comment's body no longer `===` the block `brain:approve` composed,
  and the run would refuse post-hoc even though the signature is sitting on
  the PR. This is a fail-closed false negative — a loud non-zero exit and an
  explicit "delete the stray comment" instruction, never a silent success —
  and is accepted as the cheaper error over a normalized/fuzzy comparison
  that could paper over a genuinely different landed body.

## Amendment 3 — an agent identity inside the approved loop does not re-arm (issue #454)

**Signed**: 09/08/2026 — Cristian Rinaldi

### What changed

At `lite`, `actor-check`'s distinct-act evidence compares the approved-label event
against the latest **foreign** commit. Amendment 1 defined foreign as *authored by
neither the approver nor a registered `governance.reviewActors` identity*. This
amendment adds a third exempt set: **`governance.agentActors`**.

The key is read with `?? []`, is **absent by default**, and is deliberately NOT added
to `config-migrations.mjs`. `governance.reviewActors` set that precedent — its 0.8.0
migration says outright that it "stays absent". A key that WEAKENS a gate may never
arrive by upgrade, and a consumer who never declares it keeps today's behaviour byte
for byte.

### Why

The gate asks *"does the approval postdate work the approver has seen?"*. That
question is not served by re-arming on commits the approver's own agent made under
their instruction; it is served against commits from **outside** the approved loop,
which remain foreign.

The cost was measured before it was fixed. #454 recorded the maintainer re-applying
`status:approved` five times in one day. On the day this amendment was drafted, three
consecutive PRs — #514, #515 and #507 — were green on every other gate and red on
`actor-check` for this reason alone; #507's refusal listed four stale
`brain-decision/1` signatures, one per push. A gate whose normal failure mode is noise
on correct work trains people to ignore it.

### What was measured, and what it corrected in the ticket

The ticket's stated premise was that agent commits are authored as an address the
provider resolves to no account, and are foreign because unattributable. That is
**false**, and driving the API is what showed it: `GET /repos/…/commits/54aa5ff`
returns `author.login` populated. The commit is foreign only because the identity is
not in the exempt set. Two identities appear in this repo's history and only one is
attributable at all; the unattributable one keeps re-arming, which is correct.

### What this exemption does NOT prove — the accepted loss

**An identity string in a config file is not an authenticated identity.** The provider
attributes a commit by matching the author email against an account, and git authorship
is unauthenticated by construction, so anyone with push access can spell it. The
exemption is therefore only as strong as the push-access set.

This is accepted as a **`lite`-tier** trade, and it is accepted on a precedent already
load-bearing in the same function: `reviewActors` is exempt on exactly this basis.
#413 verified the reviewer identity against its token at the review-**posting** seam,
never at the authorship seam. Demanding cryptographic proof of the agent while the
reviewer bot rides on email attribution would be an inconsistency, not a standard.

The `standard`-tier upgrade is **signature verification**: the port normalizes a
`verified` flag across providers the same way it already normalizes `login`, and the
exemption requires it. `prCommits` discards `commit.verification` today, so that is a
port-contract change (ADR-0020 territory) and is tracked, not assumed.

### Platform-agnosticism, as a property rather than an intention

No vendor name appears in the governance decision path. The identity lives in the
consumer's `brain.config.json`, which `brain:upgrade` never touches (ADR-0003 /
ADR-0006). `agent-identity-agnostic.test.mjs` holds this as a structural lock and
derives what it forbids **from the config**, so it does not name a platform either and
starts guarding the moment any consumer declares one.

Its first version scanned all of `brain/core/**` and `brain/scripts/**` and reported 18
files; reading them refuted it. Nearly all are adapters or their manifests, and naming
a platform is what an adapter is *for* — a guard forbidding it would condemn the very
pattern that produces the agnosticism. The lock is scoped to `brain/scripts/vcs/**` and
`brain/scripts/governance/**`: the path that decides outcomes, where a literal would
leave no adapter boundary to swap.

### A separate key, not a reuse

`reviewActors` means *"acts as the cold reviewer"*. Reusing it would produce the right
behaviour on all three of its current readings and the wrong **meaning**, and the
wrongness surfaces as a refusal whose stated reason is false: a consumer running an
agent but no cold reviewer would have to register their coding agent there, and
`brain:approve` would refuse it with *"a review identity may never sign an approval"* —
said about something that reviews nothing. Ruling R2 ("no key feeds two gates") was
knowingly excepted once, in #375; twice is how an exception becomes the rule.

### What is unchanged

§9 stands: an agent identity may never **apply** `status:approved`. Exemption from
re-arming and permission to approve are different powers, and this grants only the
first — deny-before-allow still refuses a listed identity the label, tier-agnostically
(#375). An **unresolvable** author remains foreign; the relief never extends to an
identity the platform cannot vouch for. A third party still re-arms: the exemption
narrows the foreign set, never empties it.


---

## Amendment 4 — `decision-gate` is added-only and label-blind; the doctrine said otherwise (issue #516)

**Signed**: 11/08/2026 — Cristian Rinaldi

### What changed

Nothing in the gate. This amendment changes only what the doctrine CLAIMS about it, and the
claims were wrong in two independent ways.

**One: direction.** #510 (PR #515) made `adrPresence` distinguish an ADDED ADR from a MODIFIED
one, because the previous behaviour forced a `brain/HOME.md` re-index for correcting a line in
an ADR from months ago — it blocked PR #507 for months. Correct fix, and four doctrine
statements kept describing the old check. One of them, `consolidation-protocol.md` §1c, told a
human amending a signed ADR that *"omitting it fails the gate"*. It does not.

**Two: labels.** `workflow-governance.md` described a two-step gate — step 1 hard *"if the PR
carries the `decision` label"*, step 2 a heuristic scanning architectural surfaces and warning.
**Neither has ever existed.** `adrPresence` takes two file lists, no call site passes labels,
and the workflow job carries no condition. That claim also reached `AGENTS.md`, which is
compiled from that file, so it was in the agent's own instructions.

### The measurement

Driven on `main` at `eb8810d` (2026-08-11):

| condition | verdict |
|---|---|
| an ADR is **added**, no `brain/HOME.md` | **fail** |
| an ADR is added **+** `HOME.md` | pass |
| a **modified** ADR, no `HOME.md` | **pass** &larr; the case §1c claimed was caught |
| a modified ADR + `HOME.md` | pass |
| `HOME.md` alone, no ADR touched | **fail** |

All three enforcement surfaces (`run-check.mjs`, `brain-check.mjs`, `merge-walk.mjs`) pass the
added-file list, so there is no surface on which the old behaviour survives.

### Why option (1) and not a restored gate

Re-imposing co-occurrence on modified ADRs re-creates the defect #510 removed and re-blocks
PR #507's whole class. A protection whose first act is to block routine correction teaches that
gates are obstacles — the argument #529's ruling turned on.

The content-keyed guard #516 sketches — *"the Status line's amendment count increased &rArr; that
ADR's `HOME.md` line changed"* — is the right net and belongs in the amendment-promotion verb
(#509), not in a check that catches the omission afterwards. **A tool that performs the cascade
cannot forget it.**

### The accepted loss

Until #509 ships, the amendment marker in `brain/HOME.md` is convention with nothing mechanical
behind it. `brain:nav` does not catch it (the link is already there; the *marker* goes missing)
and `phase-order` is detection-only at `lite`. **This amendment is itself an instance**: it was
executed by hand, and nothing but the human would have caught the marker being omitted.

What is bought is that no one reads a guarantee that is not there. An apparent protection is
worse than a stated absence — that is #499's class, and it is why this was worth a ticket.

### What is still open

The label divergence. The `standard` row's *"+ the `decision`-label step hard"* still describes
behaviour that has never shipped. Both facts — label-blindness and the absent heuristic — are
now pinned by test (`run-check.test.mjs`, #516), each proven a real detector by a mutation that
IMPLEMENTS the claim, and those tests name this ADR and `workflow-governance.md` in their
failure messages. The doctrine cannot silently fall behind the code again; it can still be
ahead of it, which is exactly what that row is.

---

## Amendment 5 — a read-only review identity has no commits to exempt (issue #581)

**Signed**: 12/08/2026 — Cristian Rinaldi

### What changed

Amendment 1 defined a *foreign* commit as one authored by neither the approver nor a
registered `governance.reviewActors` identity, and only a foreign commit re-arms an
existing approval at `lite`. This amendment **removes `reviewActors` from that exempt
set**, narrowing REQ-418-3. The set becomes: the approver, plus `governance.agentActors`
(Amendment 3).

### Why

**Maintainer ruling, 12/08/2026: `reviewActors` is read-only.**

A read-only identity authors no commits. That leaves exactly two states, and the exemption
was wrong in both:

1. **The normal state — the reviewer never commits.** The entry exempted a case that
   cannot arise. Dead weight in a security predicate is not neutral: it read as *"we expect
   commits from this identity"*, which contradicts the role `reviewer-protocol.md` §4
   defines — four COMMENT-only port verbs, no git path anywhere in `poster.mjs`.
2. **The off-nominal state — a commit appears under a review identity** (a compromised
   token, an identity registered in the wrong key, a misconfigured handle). This is
   precisely when the re-arm rule should fire, and the exemption is what stopped it. The
   approval stayed green over a commit no human saw.

Zero value in the state it was written for; negative in the state where it fired. An
exemption that can only ever trigger in the case doctrine forbids is not a safeguard.

### What this does NOT change

Amendment 1's *reason* is untouched and still load-bearing — it is simply carried by the
key that actually describes it. The rationale was always *"commits the approver's own agent
made under their instruction"*, and that is **`agentActors`** (Amendment 3), which keeps its
exemption in full. A read-only reviewer was never an agent acting under instruction.

The comparison target stays the latest foreign commit rather than the head commit, which is
the substance of Amendment 1 and the thing that made the reviewer loop affordable. Only the
membership of the exempt set narrows.

Also unchanged: `reviewActors` keeps every one of its other meanings, all of them denials —
it may not sign a `brain-decision/1` (Amendment 2's path), it may not apply the approved
label, and it does not count toward L6's human-approver tally. After this amendment the key
carries **one** meaning, *this identity is not a human approver*, enforced at L5 as denial
and at L6 as exclusion.

### The precondition this retires

Amendment 1 recorded that its exemption *"is only safe because the reviewer identity is now
VERIFIED against its token (#413)"*. That precondition is not what changed and #413 still
holds. The ruling is narrower and prior to it: a read-only identity should never have had
commits to exempt at all, verified or not.

### Accepted loss, recorded rather than implied

If a reviewer identity ever *does* legitimately push — a use this doctrine does not sanction
but which the platform does not prevent, since nothing in brain stops a token with write
scope from using ordinary git — its push now re-arms the approval and demands a fresh human
signature. That is the intended cost. The alternative is the state this amendment removes:
an approval that survives a commit nobody reviewed.

### Red-proof

`actor-check.test.mjs` pins the narrowed behaviour directly: a `lite` PR approved at one
commit, then given a commit authored by a registered `reviewActors` identity, **fails**
distinct-act evidence. Two further tests hold the edges — the `agentActors` exemption stays
green (so the wrong exemption cannot be removed silently), and the `pass` reason string no
longer advertises an exemption the predicate does not grant.

Two mutations, each diffed against the pre-mutation file and read back from disk before the
result was trusted: restoring `reviewActors` to the exempt set turns the first test red;
restoring the old reason string turns the third red.

### References

- #581 (this amendment) · #418 / REQ-418-3 (Amendment 1, which introduced the exemption)
- #454 (Amendment 3 — `agentActors`, which keeps the rationale)
- #413 (token-verified reviewer identity — the retired precondition)
- #328 (the stale-green property the re-arm rule protects)
- #580 — the `reviewer-protocol.md` signature this unblocks; its §2 Lock 3 could not be
  ratified while the key carried two meanings
- `brain/scripts/vcs/actor-check.mjs` — `evaluateDistinctAct`, `isForeignCommit`

## Amendment 6 — the platform review count is a tier parameter (issue #94)

**Signed**: 13/08/2026 — Cristian Rinaldi

### What changed

The doctrine parameters table gains a row: **`required_approving_review_count`** — 0 at `lite`,
1 at `standard`, 1 at `regulated`. `brain:protect` reads it from the resolved tier the same way
it already derives the required-context set from `requiredJobs(tier)`.

### Why

`checks` was tier-derived; the review count was not. The call site omitted it entirely and
`github.mjs`'s `branchProtect` defaults the parameter to `1`, so **the value armed on the
platform came from a function signature rather than from doctrine**. There was no flag, no
config read, and no report of what had been set.

At n=1 the consequence is not cosmetic. GitHub forbids a pull-request author approving their own
pull request, so `required_approving_review_count: 1` blocks every PR in a single-maintainer
repository, permanently, until an admin bypasses. A verb described as idempotent moved `main`
into a state its only maintainer could not merge through, and said nothing.

Measured on this repository 13/08/2026: the live value was `0` and correct — held by nobody
having run `brain:protect` since 05/08/2026, not by anything in code. The state was right and
undefended, which is the inverse of the usual failure: not a protection claiming more than it
does, but a correct one that appears durable and is not.

### The values, and why `regulated` is 1

- **`lite` → 0.** `brain-writes-reviewed` already rules that a human author suffices for a
  `brain/core/**` write at this tier (REQ-L6-1'). Arming 1 imposes a `standard` posture on a
  repository that declares `lite`.
- **`standard` → 1.** L6's human approver is `approvers.find(a => a !== author &&
  !botAllowlist.includes(a))`. A non-author human is the point of the tier.
- **`regulated` → 1, deliberately not 2.** The *"panel ≥ 2, consensus-gated"* row already in
  this table is the **reviewer verdict mode** — how many engines produce the verdict — not the
  human approval count. Reading it as an approval count would be inventing doctrine, which
  `reviewer-protocol.md` §5 forbids. If `regulated` should demand two human approvals, that is a
  separate decision with its own reasoning, not an inference from an adjacent row.

### What this does NOT do — the n=1 coupling, recorded rather than enforced

A tier requiring a second approver is still selectable by a repository that has only one, and
choosing it still yields an unmergeable `main`. Enforcing otherwise needs a verb that enumerates
who can approve, and the VCS port has none of its 26 — adding one is a port widening, i.e. a
`decision`-labelled change with its own ADR (ADR-0020's rule). Out of scope here, and named so
it is a known limitation rather than an assumption.

What closes the silent half is that `brain:protect` now **prints the armed count and the tier
that produced it**, on the same surface as the required checks. The number was never wrong; its
origin was invisible.

### The escape hatch this amendment refuses

`csrinaldibot` holds `write` and looks like the second approver that would make `1` satisfiable
at n=1. It is not usable for that. L6 excludes `governance.reviewActors` identities from the
human-approver count, and `reviewer-protocol.md` §2 Lock 1 exists precisely so a review
identity's verdict can never count as an approval. Such an approval would satisfy GitHub's
counter and fail brain's own gate on any `brain/**` change, while dissolving the asymmetry the
reviewer protocol is built on. Recorded here so it is refused on the record.

### Red-proof

`brain-protect.test.mjs` drives the real `activateProtection` through an injected provider spy
and asserts the arguments it sends: `requiredReviews` is PRESENT — its absence is the defect,
since omission hands the decision to the provider default — and carries the tier's value, for
all three tiers. Two consecutive runs send byte-identical protection. A fourth test pins that
the armed count and its tier are reported.

Three mutations, each diffed against the pre-mutation file and read back from disk before the
result was trusted: omitting the argument, arming `lite` at 1, and deleting the report line.
All three turn tests red — the third only after the sweep found it pinned by nothing, which is
recorded because the report line is half of what this amendment delivers.

### References

- #94 (this amendment) · `brain/scripts/brain-protect.mjs` `protectionFor` ·
  `brain/scripts/vcs/governance-tiers.mjs` `TIER_PARAMS` ·
  `brain/scripts/vcs/providers/github.mjs` `branchProtect`
- REQ-L6-1' (`brain-writes-reviewed.mjs`) — why `lite` is 0
- `reviewer-protocol.md` §2 Lock 1 — why the reviewer handle cannot be the second approver
- #442 / D5 — `regulated` unsatisfiable at n=1, the same finding one gate over

## Amendment 7 — the reviewer verdict mode is not a tier parameter (issue #743)

**Signed**: 21/08/2026 — Cristian Rinaldi

### What the row said, and why it was wrong by this ADR's own rule

The parameter table above carried a `reviewer verdict mode` row: *deterministic
checks only* at `lite`, *single engine* at `standard`, *panel ≥2, consensus-gated*
at `regulated`. Read as doctrine, it tiers the review system.

Invariant 7 of this ADR already forbade that:

> **7. Proportionality bounds relaxation** — position tiering applies only to
> **ceremony**, never to **correctness**, traceability, agent containment, or
> internal consistency.

A schema version is not ceremony: `brain-review/1` is not structurally
unsatisfiable at any tier, so evidence tiering does not admit it either. And the
judgment half of the reviewer is a control that FINDS DEFECTS — correctness,
which invariant 7 names as the thing position tiering may never touch.

### What the drift cost, measured

Not hypothetical. `tierParams()` shipped `standard` as
`{inferentialEnabled: true, reviewProtocol: 'brain-review/1'}` — a tier that ASKED
for the judgment half beside a protocol that structurally cannot carry or
challenge a reasoned finding. The producer was enabled and the gate refused it, so
every `standard` verdict carried a condition saying the half did not run.

Two adversarial cold reviews found it. No gate did, because both halves were
hiding inside a posture parameter and nothing compared them.

### The ruling

> *"The tiers do not define the review system. The judgment half is an on/off
> capability, and the protocol is always `brain-review/2`."*

with an addendum the same day: `reviewer.inferential.enabled` is **ON when the key
is absent**, off only on an explicit `false`.

### What changes

1. **`reviewProtocol`, `inferentialEnabled` and `challengerAxis` leave
   `tierParams()`.** The protocol is `PRODUCED_PROTOCOL` — one value, every tier.
   The capability is `reviewer.inferential.enabled`, and the axis is
   `reviewer.inferential.challenger.axis`, defaulting to `human`.
2. **REQ-682-2 is retired**, not amended: its subject was which tier decides.
3. **`brain-review/1` stays readable forever.** It is retired as an output, never
   as an input — every verdict already posted is a `/1` block, and `cold-boot.mjs`
   reads that history to compute `rev` and hold the anti-loop lock. An explicit
   `reviewer.protocol: 'brain-review/1'` is still honoured: the ruling retired a
   default, and reading it as forbidding an operator's explicit choice would be
   inventing doctrine (reviewer-protocol.md §5).
4. **A guard replaces the retired pins.** `governance-tiers.test.mjs` fails if any
   tier carries a review-system key, plus its complement — that the parameters
   answering the approval question are still there — so it cannot pass on an
   empty table. This is #743's acceptance criterion 5, and it exists because the
   previous instance of this drift was added by an agent extending this very ADR.

### The consequence, declared rather than discovered

Until #682 slice 3 supplies a transport, the judgment half is ON everywhere and
can run nowhere. Every verdict, in every repo, carries
`the judgment half is enabled but no transport is configured`. It is a condition
and not a blocker — `buildVerdict` never reads `conditions[]`, so it cannot move a
verdict. It is pinned end to end so that the day it stops being true, a test says
so; that day is slice 3 landing.

### What this amendment does NOT do

It does not remove a tier. Measured while ruling on #743: `regulated` differs from
`standard` on the approval axis in the strongest available way — `actor-check`
requires an approver who authored **no commit on the branch**, and
`brain-writes-reviewed` adds `codeowners-rung1`. That is evidence tiering, the
mechanism this ADR names as the one that resolves #329. The narrowing removes
non-approval parameters from every tier; it leaves `regulated` meaning *the tier
where a distinct approver is not enough*.

An earlier measurement in #743 concluded the opposite — that `regulated` had no
approval content left — and it was wrong: it varied `tierParams()` and gate
POSITIONS and reported that as the approval axis, which lives in the other
mechanism. The correction is recorded in the ticket rather than edited away.
