---
status: spec
issue: 405
epic: 313
artifact_store: openspec
topic_key: sdd/issue-405-inline-review-comments/spec
---

# Spec — inline per-line review comments (issue #405)

Requirements tagged `REQ-405-N`. Provisional until the ADR-0020 amendment is ratified
and D6 is ruled — both are human acts, and the requirements below that depend on them
are marked.

## REQ-405-1 — the port verb widens; the verb count and lock 2 do not move

`prReviewComment({ project, number, body, comments? })`. `comments` is optional and
absent-by-default, so every existing caller is unaffected.

`event: 'COMMENT'` stays hardcoded on GitHub with no parameter, flag or branch reaching
it (ADR-0020 lock 2 / REQ-266-3). Asserted at the level that cannot rot: a test that
inspects the posted payload, plus the existing drift-guard on the verb list.

## REQ-405-2 — a finding carries an OPTIONAL anchor, and no anchor means no comment

`file` (string) and `line` (integer) on a `/2` finding. Both optional. A finding lacking
either produces **no** inline comment and is unaffected in every other respect.

This is what keeps the change additive: every evaluator shipping today keeps working
unchanged and gains inline coverage only when it starts emitting anchors. A test pins
that a legacy finding — no `file`, no `line` — round-trips and posts exactly as it does
today.

## REQ-405-3 — the anchor survives the render/parse round trip

`file`/`line` are scalar entry fields, so they flow through `yamlScalar` /
`unyamlScalar` and `ENTRY_CONT_RE` like `cites`. Pinned by a round-trip test over the
REAL renderer and parser, not hand-built strings — the #381 class exists precisely
because a field was rendered in one encoding and read in another.

Depends on PR #478 (issue #452), which owns that pair today.

## REQ-405-4 — an un-anchorable comment NEVER costs the verdict

The load-bearing requirement. When a provider rejects the inline payload (GitHub 422 for
a line outside the diff; GitLab a stale `position`):

1. the summary block **is still posted**, at the same head;
2. the un-anchorable findings appear **in** that block;
3. the verdict **reports the count** of dropped anchors.

Point 3 is not decoration. Without it, "no inline comments appeared" is indistinguishable
from "the anchors would not attach" — `evidence-reader-empty-on-failure` relocated into
the poster. The count is the reader's only way to tell the two apart.

Proven by making the provider stub reject the inline payload: the failure path IS the
deliverable, not an edge case, so it is exercised at the same level as the success path.

## REQ-405-5 — one call, so the anti-loop lock is untouched

Inline comments post in the SAME provider call as the summary body they accompany. No
second postable artifact, no second parseable verdict, no ordering dependency.

Asserted behaviourally: a run that posts inline comments must still skip with
`anti-loop` on a second invocation at the same head, exactly as a summary-only run does.

## REQ-405-6 — parity is forced by the contract suite, not by inspection

`vcs.contract.test.mjs` requires BOTH providers to satisfy REQ-405-1, -2 and -4. The
implementations differ by design (GitHub widens one payload; GitLab switches from
`notes` to `discussions` and fetches `diff_refs` first) — the contract is what makes
that asymmetry safe rather than accidental. A provider that silently no-ops on
`comments` fails the suite.

## REQ-405-7 — the contract document is DRAFTED, not written

`brain/core/methodology/vcs-contract.md`'s `prReviewComment` row must record the widened
signature, the two-endpoint GitLab mapping, and the extra `diff_refs` read.

`brain/**` is Tier 2 — **human-only**. The agent writes
`openspec/changes/issue-405-inline-review-comments/brain-drafts/vcs-contract-row.md` and
the human promotes it. The agent must never write the destination file.

## REQ-405-8 — the e2e proves a developer actually sees them

On #409's harness (`test/review-regulated/`), whose README already names this change as
its landing pad: assert the captured `POST …/reviews` payload's `comments` array. The
`gh` stub captures the full body verbatim, so this needs no harness change — the
reuse contract REQ-409-7 predicted this exact case.

## Pending human acts — NOT agent decisions

- **The ADR-0020 amendment** recording D1–D5. Amending an ADR is a three-step cascade
  (ADR → `brain/HOME.md` → regenerate `AGENTS.md`).
- ~~**D6**~~ — **RULED (b), 2026-08-06.** The validator stays untouched here; its
  inertness is **#483**. What replaces "validator coverage" as this change's schema
  evidence: REQ-405-3's round trip over the REAL renderer/parser, and REQ-405-4's
  poster-side anchor validation — both of which run in production, which the validator
  does not.
