---
status: draft
issue: 473
artifact_store: hybrid
topic_key: sdd/issue-473-approval-signature-on-diff/proposal
---

# Proposal: the approval signature lands on the diff (issue #473)

Issue #473. Change folder (drafts only): `openspec/changes/issue-473-approval-signature-on-diff/`.
Artifact store: engram. Source: `sdd/issue-473-approval-signature-on-diff/explore`.

## Intent

At `lite`, L5's only approval evidence is a `status:approved` LABEL-ADD EVENT **on the issue**,
compared by timestamp against the latest foreign commit on the PR branch
(`actor-check.mjs` `evaluateDistinctAct`, ADR-0026 Amendment 1). A label event carries a
timestamp and nothing else: it cannot name **which diff** was approved. So the gate infers
freshness from clock ordering on an object that is not the diff, and every re-arm is
answered by re-applying a label that certifies nothing new.

The fix is to give L5 an evidence form that *says what it approved*: a signed, machine-parseable
`brain-decision/1` block anchored on the PR's `head_sha`, posted as a COMMENT-state review on the
PR and read back by a new admissibility branch in `actor-check`.

**What this does NOT claim.** It does not reduce the number of human acts per push. A push moves
`head_sha`, the block goes stale, the gate re-arms — correctly, because the human has not signed
that code. What dies is the *category error*: authorization (`status:approved`, #124 — applied
once, on the issue) stops being asked to double as per-diff verification, and each act becomes
auditable (protocol, actor, SHA, timestamp in a durable comment) instead of an opaque label event.

## Direction (settled in-ticket 2026-08-06; not re-litigated here)

Approach (a). Destination (b) — the agent gets its own verifiable identity (#454) so a real
approving review becomes possible — stays deferred. (a) must be built so (b) is a **swap of the
evidence source, not a rewrite**: one admissibility function, pluggable evidence list.

Verified constraints carried from exploration (do not re-open):

| Constraint | Consequence for this change |
|---|---|
| ADR-0020 Locks 1-3: no APPROVE code path exists in the VCS port, and none may be created (`cli.mjs` VERBS: `prReviewComment` only, `event:'COMMENT'` hardcoded) | Post via the **existing** `prReviewComment`; read via the **existing** `prReviews()` (returns `body`). No new verb. Locks hold verbatim. |
| L6 `brain-writes-reviewed` does not read PR reviews at `lite` (`brain-writes-reviewed.mjs:357` — `reviews = tier === 'lite' ? [] : await fetchReviews(...)`) | This is a **third, orthogonal** evidence channel, not a reuse of L6's plumbing. L6's `standard`/`regulated` filter is `state==='APPROVED'`, so a COMMENT-state block can never satisfy L6. The two-key split survives untouched. |
| `prReviews()` normalizes to `{ state, author, body }` on both providers — no `id`/`commit_id` (`github.mjs:306-314`) | `in_reply_to` cannot be verified. Scoped **out** (see D3). |
| `parseVerdict()` hardcodes a two-protocol allowlist (`parse-verdict.mjs:214`) | Fork, not widen (see D4). |
| `actor-check` already receives `commits` with `sha` ascending (`prCommits()` shape, actor-check.mjs:294) | The PR head SHA is **already available** to the gate. `head_sha` anchoring needs no new port surface. |

## Scope of the first slice

**In:**
1. `brain:approve` CLI — verify identity via `whoami` (reuse `brain/scripts/review/identity.mjs`),
   refuse if the resolved login is in `governance.reviewActors` (reuse `evaluateActor`'s
   deny-before-allow shape, actor-check.mjs:358-365), compose a `brain-decision/1` block stamped
   with the current head SHA, re-read the SHA after composing and refuse if it moved, post via
   `prReviewComment`.
2. `parseDecision()` — sibling parser sharing extracted low-level primitives with `parseVerdict()`.
3. `actor-check` admissibility branch at `lite`: a `brain-decision/1 APPROVE` whose `head_sha`
   equals the PR head, whose review author equals the block's `actor`, and whose author is not a
   `reviewActors` identity, is **an additional sufficient evidence form** alongside the existing
   label-timestamp check. Fail closed on every unreadable input, matching the existing branch.
4. Drafts (human promotion only, Tier 2): ADR-0026 **Amendment 2** — one new admissible `lite`
   evidence row for `actor-check`; the `brain-writes-reviewed` row is untouched.

**Deliberately deferred (named, not implied-covered):**

- **The `dispositions` / finding-ruling extension** appended to #473 after it was signed
  ("an agent must not create an issue from a review finding until that finding's disposition is
  ruled") → **its own ticket**. It is a materially different governance surface (it constrains
  issue *creation*, not approval evidence), it partially depends on #408 whose `follow_ups[]` is
  currently inert (no evaluator emits it), and the ticket itself flags it as possibly requiring
  re-signature. Bolting it on here would make the first slice untestable as one behavior.
- Extending `prReviews()` with `id`/`commit_id` on both providers + `vcs.contract.test.mjs` case,
  and therefore any read-side use of `in_reply_to`.
- Any new user-facing config key (`governance.approvalMarker` and relatives).
- #454's agent identity; any native APPROVE path; `standard`/`regulated` behavior; who may apply
  `status:approved` (#124); branch protection (#94, inactive).

## Decisions taken here (exploration's open questions)

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Additional evidence, or replace the foreign-commit timing check at `lite`? | **Additional (OR).** `isForeignCommit`/`compareTimestamps` stay, unchanged. | Deleting them strands every PR where `brain:approve` never ran and would silently change `standard`/`regulated` reasoning. The new form is strictly stronger evidence; nothing passes on *less* evidence than today. |
| D2 | Shape of `governance.approvalMarker`? | **No new config key in slice 1.** Protocol recognition is a constant/tier parameter, mirroring how `parseVerdict` hardcodes its protocols. | A protocol name is not a user-tunable knob. Adding config adds a migration, a validation path, and a failure mode that buys nothing in the first slice. |
| D3 | Extend `prReviews()` for `in_reply_to` verification? | **No.** `in_reply_to` is written and stays **audit-trail-only**, unread by any check. | Admissibility depends on `head_sha`, not on linkage to a `brain-review/N` comment. ADR-0020's Amendments 1/2 record how expensive asserting a property across both providers is; pay it when a check needs it. Answers OQ8 too: neither narrowly nor generally — not now. |
| D5 | `brain:approve` identity model — declare `human.handle`, or one-sided? | **One-sided + block-anchored:** the block's `actor` must equal the `whoami`-resolved login at write time; at read time the review author must equal the block's `actor` and be outside `reviewActors`. No `human.handle` config. | The pairing is verified against the block, not against config, so a declared handle adds surface without adding a checked property. |
| D6 | Does the dispositions extension ship here? | **No — separate ticket.** | See deferrals above. |

## Named but left to sdd-design

- **D4 — parser fork.** Preferred direction: extract `scalar`, `parseEntryList` and the fence regex
  into a shared module and write a sibling `parseDecision()`, rather than widening
  `parseVerdict()`'s allowlist — the verdict parser should not learn `decision`/`actor`/`head_sha`.
  The exact factoring boundary, module path, and drift-guard test cost are design's call.
- Whether the admissibility branch lives inside `evaluateDistinctAct` or beside it as a peer
  evidence source in `evaluateActor` (the (b)-swap seam).
- How `fetchDecisions`/`prReviews` is threaded into `gatherActorCheckInputs` as an injectable dep,
  following `defaultFetchLabeledEvents`'s existing `{ getVcs }` shape.
- Exact `brain-decision/1` field list and fail-closed matrix per missing field.
- ADR-0020 footnote: needed or not, given no verb shape changes (D3) and no APPROVE path.

## Affected areas

| Area | Impact |
|---|---|
| `brain/scripts/vcs/actor-check.mjs` | Modified — new `lite` evidence branch + new injectable dep |
| `brain/scripts/review/lib/parse-verdict.mjs` (+ new shared primitives module, new `parseDecision`) | Modified / New |
| `brain:approve` CLI + `brain/scripts/review/identity.mjs` reuse | New / Reused |
| `brain/project/decisions/adr-0026-*` | Draft-only (Amendment 2, human promotion) |
| `brain/scripts/vcs/providers/*` | **Unchanged** (D3) |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| OR-ing evidence is read as "approval got easier" | Med | Amendment 2 states the monotonicity claim explicitly: no PR passes on less evidence than today |
| Sign/push race (head moves between compose and post) | Med | Re-read head SHA after composing; refuse if moved (the issue's own design) |
| Parser fork drifts from `parseVerdict` | Med | Shared primitives module + tests over both parsers |
| Slice exceeds the 400-line review budget | High | Natural chain boundaries: (1) parser primitives + `parseDecision`, (2) `brain:approve` CLI + identity, (3) `actor-check` branch + ADR draft. Forecast is `sdd-tasks`' call. |
| A future #94 arming of `required_approving_review_count` would not be satisfied by a COMMENT-state block | Low | Accepted by design: (a) is an explicit `lite`-only bridge to (b) |

## Rollback

Single revert of the `actor-check` branch restores today's behavior exactly — the label-timestamp
evidence is never removed (D1), so removal is a pure subtraction. `brain:approve` and the parser
become dead code, harmless if left. Any promoted ADR amendment is reverted by a human with a
signed commit, as usual for Tier 2.

## Success criteria

- [ ] A PR whose current head is signed by `brain:approve` passes L5 at `lite` with a
      `status:approved` label event that **predates** later agent commits.
- [ ] A block whose `head_sha` no longer matches the PR head fails closed.
- [ ] A block posted by a `reviewActors` identity is refused at write time and rejected at read time.
- [ ] No APPROVE-state review is emitted anywhere; ADR-0020 Locks 1-3 verifiable as unchanged.
- [ ] `standard`/`regulated` behavior and `brain-writes-reviewed` are byte-for-byte unaffected.
- [ ] `prReviews()`'s normalized shape is unchanged on both providers.

## Proposal question round (executor could not ask directly)

1. D1 (OR vs replace) is the load-bearing call — do you want the label-timestamp check kept as a
   permanent peer, or marked deprecated with a removal ticket once `brain:approve` is habitual?
2. D5 — is "the block's actor equals the token's resolved login" enough, or do you want a declared
   `human.handle` so a stolen-token signature is also caught by config?
3. Confirm the dispositions/finding-ruling split into its own ticket (and whether it should block on
   #408 becoming live rather than reading findings via `in_reply_to` in the interim).
4. Is the honest framing acceptable — this change improves evidence quality and auditability, and
   does **not** reduce the number of human signatures per push?
