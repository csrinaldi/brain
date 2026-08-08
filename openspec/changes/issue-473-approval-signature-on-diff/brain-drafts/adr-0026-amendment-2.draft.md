# ADR-0026 — Governance Doctrine Tiers: A Declared Axis Orthogonal to the Detected Substrate Ladder

> **status:** Tier 2 draft. Not yet promoted. Promotion is a HUMAN, in-file edit
> (see "Promotion is manual" below) — `brain:promote` refuses to overwrite an
> existing signed artifact, and ADR-0026 already exists at
> `brain/project/decisions/adr-0026-governance-doctrine-tiers.md`. This draft is
> not a new ADR file; it is the text a human pastes into the existing one.

## Amendment 2 — a signed decision block is admissible `lite` evidence for `actor-check` (issue #473)

**Signed**: DD/MM/2026 — <Name> *(filled in at promotion — see "Promotion is manual")*

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

### Promotion is manual

`brain:promote` (`brain-promote.mjs:348-352`) refuses to write over an
existing decision file — ADR-0026 already exists, and Amendment 1 was applied
as an in-file edit, not a promoted new file. This draft is promoted by a
HUMAN editing `brain/project/decisions/adr-0026-governance-doctrine-tiers.md`
directly (consolidation-protocol.md §1c, "three acts in one commit"), gated
by L6 `brain-writes-reviewed` + CODEOWNERS as usual — not automated by this
change, and not invoked by `brain:promote` against this draft (the `.draft.md`
suffix is deliberate: `DRAFT_BASENAME_RE` does not match it, so
`destinationFor()` returns `null` and the verb refuses cleanly instead of
attempting to create a second `adr-0026-*.md` file).

The three acts, as paste-ready blocks:

**Act 1 — the Status line** (`adr-0026-governance-doctrine-tiers.md:3`, replace in place):

```
**Status**: Accepted · **amended DD/MM/2026** (Amendments 1-2 — see below)
```

**Act 2 — the superseded passage, `lite` evidence-table row**
(`adr-0026-governance-doctrine-tiers.md:86`, `actor-check` row, append to the
end of the `lite` cell, after the existing Amendment 1 marker):

```
**[Amended by Amendment 2 (#473) — a `brain-decision/1 APPROVE` review
comment, anchored on the PR's head SHA and posted via `brain:approve`, is
ALSO sufficient `lite` evidence, OR'd with the distinct-act check above; see
Amendment 2.]**
```

**Act 3 — the signed section.** Append the full "## Amendment 2 — a signed
decision block is admissible `lite` evidence for `actor-check` (issue #473)"
section above (Context through Honest residuals) to the end of
`adr-0026-governance-doctrine-tiers.md`, immediately after Amendment 1's
"## References" section, filling in the `**Signed**: DD/MM/2026 — <Name>` line
with the actual promotion date and the promoting human's name.

**`brain/HOME.md` line replacement** (`brain/HOME.md:74`, replace in place):

```
- [ADR-0026](project/decisions/adr-0026-governance-doctrine-tiers.md) — Governance doctrine tiers: a declared lite/standard/regulated axis orthogonal to the detected substrate ladder (amends ADR-0015 REQ-L4-2/L5-1/L6-1; resolves #329; **Amendment 1, 04/08/2026** — at `lite`, distinct-act re-arms only on foreign commits, #418; **Amendment 2, DD/MM/2026** — a signed `brain-decision/1` block is additional sufficient `lite` evidence for `actor-check`, #473)
```

After the three acts and the `HOME.md` line, regenerate `AGENTS.md`
(`AGENT_PLATFORM=antigravity npm run brain:env:init`) in the SAME commit —
`brain/HOME.md` is one of the five `SOURCE_DOCS` `AGENTS.md` compiles from
(consolidation-protocol.md §1d), and `antigravity.drift.test.mjs` fails the
gate on a stale compiled file.

### References

- Issue #473 — this change.
- Issue #418 (Amendment 1) — `lite` distinct-act re-arms only on foreign
  commits; the cost measurement this amendment builds on.
- Issue #454 — the five-re-applications-in-one-day measurement.
- Issue #497 — the re-arm case that motivated verifying the diff rather than
  the timestamp.
- Issue #124 — the `status:approved` label's authorization role, preserved
  unchanged by this amendment.
- ADR-0020 — the reviewer's COMMENT-only write locks; Locks 1-3 hold verbatim.
  `vcs.contract.test.mjs:1670-1737` is the pinned proof this amendment adds no
  new case to, and `brain/scripts/approve/locks.test.mjs` is the write-side
  twin proving the same for `brain:approve`.
- `openspec/changes/issue-473-approval-signature-on-diff/design.md` — §B-H,
  the full architecture, the read-side fail-closed matrix (§E2), and the
  write-side refusal matrix (§E3) this amendment summarizes.
- `brain/core/methodology/consolidation-protocol.md` §1c — "Amending a signed
  ADR," the three-acts shape this draft follows.
