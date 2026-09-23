---
status: draft
issue: 405
epic: 313
artifact_store: openspec
topic_key: sdd/issue-405-inline-review-comments/brain-drafts/vcs-contract-row
---

# DRAFT for human promotion — `prReviewComment` row, `brain/core/methodology/vcs-contract.md`

`brain/**` is Tier 2 (human-only). This file is the agent's draft; a human promotes it.
REQ-405-7. **The verb count does not change** — this widens one signature, adds no row.

## What to do

Replace the existing `prReviewComment` row (line 41 of the verb table) with the row
below. Nothing else in the file moves.

## The row

```
| `prReviewComment` | `({ project, number, body, comments? }) -> Promise<{ url }\|{ url, inlineDropped }\|{ url: null, error }>` | Posts a review whose event is **`COMMENT`, hardcoded** (issue #266 lock 2, REQ-266-3) — no parameter, flag, or branch selects a different event, and `comments` does not change that. `comments` (issue #405) is an optional array of `{ path, line, body }` inline annotations; **absent and empty are the same request** (no inline attempted), and every pre-#405 caller is unaffected. GH: `POST repos/{project}/pulls/{number}/reviews`, `comments[]` riding the SAME payload as `body` — atomic; on failure it retries ONCE bare and returns `inlineDropped`. GL: no review-state concept on notes — `POST projects/{enc}/merge_requests/{number}/notes` for the summary **first**, then ONE `POST .../discussions` per anchor, each needing a `position` built from the MR's `diff_refs` (an extra `GET .../merge_requests/{number}` inside the verb; unreadable refs report every anchor dropped). **At most one payload the provider ACCEPTS carries the verdict body**, on both providers — the anti-loop lock counts parseable verdicts, not posts. (GitHub's fallback SENDS the body twice and normally lands one; a first call that landed server-side but exited non-zero would post it twice for real. Bounded — the lock reads the LAST parsed verdict, so a duplicate at one head still skips.) `inlineDropped` is ABSENT when nothing was dropped, never `0`. Never throws. |
```

## Why each clause is there — the reviewer's checklist

- **`comments?` optional, absent≡empty.** REQ-405-1's additive guarantee. If these two
  ever diverge, "no anchors requested" and "all anchors lost" become the same
  observation at the call site.
- **Lock 2 restated INSIDE the widened row.** The row is where a future reader checks
  what may reach `event`. Widening the signature without restating the lock invites the
  next widening to reach it.
- **Order differs by provider, and the rule does not.** GitHub attempts anchored and
  retries bare; GitLab posts the summary first and then anchors. Both follow from: when
  the calls cannot be atomic, the verdict must be the thing that is already safe when
  anything after it fails.
- **"At most one payload the provider ACCEPTS carries the verdict body."** This replaces
  the draft requirement "inline comments post in the SAME call", which was GitHub's
  implementation promoted to doctrine — GitLab cannot satisfy it, because discussions are
  one per position. The invariant the anti-loop lock actually needs is the one stated.
  The "accepts" was added in round 5: GitHub's fallback SENDS the body twice (anchored, then
  bare) and normally only the second lands, and a first call that landed server-side but
  exited non-zero would post it twice for real. Bounded, not denied — the lock reads the
  LAST parsed verdict, so a duplicate at one head still skips. `github.mjs` names this
  residual in its own comment; the row must not be less honest than the code it describes.
- **What a `{path, line}` anchor can attach to on GitLab, named rather than assumed.**
  The position carries `new_line` only. GitLab's diff-note position also takes `old_line`,
  which is what an anchor on an unchanged (context) or deleted line needs — and the anchor
  shape this port defines has no field to supply it, so `deriveInlineComments` cannot
  derive one. Such an anchor is refused and counted by `inlineDropped`; it is not silently
  lost. Flagged `inferential` (round 5 — not established against a live GitLab) and
  unreachable today, since no evaluator anchors. Written down so the next person to widen
  the anchor shape finds the constraint instead of the symptom.
- **The extra `GET` is named.** It is a real cost and a real failure mode, and it is
  GitLab-only. It lives inside the verb rather than in a widened `prView`, whose
  normalized shape is consumed by cold-boot, tranche, checkpoint and anti-stale (design
  D4).
- **`inlineDropped` absent, never `0`.** `evidence-reader-empty-on-failure`: a `0` is a
  positive measurement claim on runs that never attempted an anchor.

## What this row does NOT claim

No evaluator emits `file`/`line` today, so no production run currently sends `comments`.
The row documents the port, which is what the contract file is for — but a reader
looking for the caller will not find one. That gap is recorded in REQ-405-8 and is a
maintainer ruling, not something to bury in this row.
