---
status: draft
issue: 405
epic: 313
artifact_store: openspec
topic_key: sdd/issue-405-inline-review-comments/proposal
---

# Proposal: inline per-line review comments (issue #405)

Issue #405. Epic #313, Lane B — the last piece of the **M3 exit criterion**.
Change folder: `openspec/changes/issue-405-inline-review-comments/`.

## Intent

M3's exit is *"a developer sees inline code review in the PR, on GitHub and GitLab."*
#394 shipped the core (refuter wired, `/2` tier-activated) and left this untouched:
`poster.mjs` posts a single fenced block and nothing else, so the milestone does not
hold. A reviewer that reports `src/a.mjs:42` inside a YAML block is a report, not a
review — the developer still has to go find the line.

## What the measurements say (taken before designing)

**GitHub is a widening of the existing call.** `prReviewComment` already POSTs to
`repos/{project}/pulls/{number}/reviews` with `{ body, event: 'COMMENT' }`
(`github.mjs:435`). That endpoint accepts `comments[]` in the *same* payload. So inline
comments ride the existing call, `event: 'COMMENT'` stays hardcoded, and **lock 2
(REQ-266-3) is preserved by construction** — no new event, no new endpoint, no second
postable artifact.

**GitLab is a different endpoint.** `prReviewComment` posts to
`projects/{enc}/merge_requests/{n}/notes` (`gitlab.mjs:448`), which has no line
anchoring. Inline requires `POST …/discussions` with a `position` object
(`position_type: 'text'`, `new_path`, `new_line`, plus `base_sha`/`head_sha`/`start_sha`
from the MR's `diff_refs`). Structurally still a note — it cannot become an approval,
so lock 2 holds here too, for a different reason.

The contract can therefore be **symmetric while the implementations are not** — the
shape the vcs port already absorbs elsewhere (`prCommits`' `login: null` residual on
GitLab is the precedent).

**The schema validator is dead code.** `validateSchemaV2` (`schema-v2.mjs`) validates
`evidence_class` and `causal_disposition` — and is **called nowhere in production**
(found by the third cold review of PR #478; `grep -rn 'schema-v2\|validateFinding'
--include=*.mjs brain/scripts | grep -v test` returns only comments). This directly
resizes deliverable 3: adding `file`/`line` "+ validator coverage" buys nothing while
the validator is unreachable. Either the validator gets wired — a real behaviour change
with its own failure semantics — or the deliverable is honestly restated as schema
fields plus *renderer/parser* coverage. **This is a decision for the human, recorded in
design D6 rather than settled here.**

## Decision (subject to the ADR amendment)

Widen `prReviewComment` with an optional `comments[]`, keep the four-verb count in
ADR-0020, and make an un-anchorable comment **degrade into the summary block** rather
than fail the review. Details and the four remaining decisions are in `design.md`.

## Scope

- ADR amendment to ADR-0020 recording D1–D6.
- `brain-drafts/` draft of the `vcs-contract.md` row change → **human promotion**
  (Tier 2: `brain/**` is human-only; the agent drafts, never writes).
- `/2` finding schema: `file` / `line`.
- Both providers implement the widened contract; `vcs.contract.test.mjs` forces parity
  **including the un-anchorable fallback**.
- `poster.mjs` wiring, preserving anti-loop, anti-stale, and `event: COMMENT`.
- E2E on #409's harness — the README there already names this change as its landing pad.

Out of scope: #408 (the producers that make `follow_ups` reachable); wiring
`validateSchemaV2` unless D6 rules it in.

## Sequencing — this cannot start coding yet

The ticket notes #381 must land first; it has. But **#452 (PR #478) is in review and
owns `verdict.mjs` + `parse-verdict.mjs` right now** — the exact files a `file`/`line`
schema change touches. Three review rounds have already rewritten that pair.

So this change is **design-only until #478 merges**. That is not idleness: #405 is the
one ticket in Lane B whose own body says *"this needs a design pass, not just code"*,
and the five decisions below each change the size of the work.
