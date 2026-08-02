---
status: proposed
issue: 375
epic: 313
artifact_store: openspec
topic_key: sdd/issue-375-l5-deny-set/proposal
---

# Proposal: give L5 a deny-set (issue 375)

Issue #375. Change folder: `openspec/changes/issue-375-l5-deny-set/`.

## Intent

`actor-check` (L5) exists to enforce that `status:approved` — the merge keystroke — carries a
**human** signature. It demonstrably passes a bot instead.

Its decision order ends:

```
3. Actor in botAllowlist               → pass
4. Actor === author OR === issueAuthor → fail   (self-approval)
5. Otherwise                           → pass   ← "human-applied approval"
```

Rule 3 is a **pass branch, not a requirement**. Absence from `governance.approvalActors` causes no
failure — the actor falls through and, if it is not an author, **passes as though it were a distinct
human**. Rule 5's comment asserts "human-applied" and the code never verifies it. There is no
deny-set anywhere.

## Grounding — measured, not reasoned

Two PRs with identical authorship and opposite verdicts. The only variable was which session applied
the label:

| Issue → PR | Applied by | Rule | Result |
|---|---|---|---|
| #367 → #374 | **`csrinaldibot`** (the reviewer identity) | 5 | **SUCCESS** |
| #372 → #373 | `csrinaldi` | 4 | FAILURE |

Reproduced on a single PR within minutes — re-applying #374's label from the maintainer's own session
flipped `actor-check` from SUCCESS (12:34) to FAILURE (12:39). **The reviewer applying the merge
keystroke produced a PASS; the human applying it produced a FAIL.**

`reviewer-protocol.md` §9 already forbids this in doctrine and says the deny-set is *"hardcoded in
the caller"*. That holds for `brain:review` runs and does not cover the label surface at all: a human
driving the web UI under the reviewer session bypasses the caller entirely. §2's three locks guard
the *review* surface; none guards the *label* surface. It has now happened twice by accident in this
repo — the #367 label above, and the merge of PR #360 (`e999a36`), the only merge in this
repository's first-parent history attributed to `csrinaldibot`.

## Scope

**Option A**, ruled by the maintainer on #375: `governance.reviewActors` gains a second reader.

| Gate | Reads `reviewActors` as |
|---|---|
| L6 `brain-writes-reviewed.mjs` | does NOT count as the human reviewer (existing) |
| L5 `actor-check.mjs` | may NOT apply the approved label (**new**) |

In scope: the deny check in `evaluateActor`, a `readDenyActors` reader, wiring through
`gatherActorCheckInputs`, unit tests pinning the FAILURE, a shipped-config behaviour test, and Tier 2
drafts for the ADR and the two `reviewer-protocol.md` sections that become stale.

Out of scope, each deliberately:

- **Rule 1's fail-open on missing label evidence** (REQ-L5-2). Deliberate and documented.
- **Rule 2's `override:*` admin bypass.** The documented, logged human recovery path
  (`workflow-governance.md`). The deny check sits *below* it.
- **The self-approval red on single-maintainer repos.** That is L5 working correctly.
- **Whether the reviewer identity needs `push` at all.** Belongs with #94 / #124; untested.

## Why not Option B

`governance.denyApprovalActors` (a third key, L5-only) honours ruling R2 literally but requires the
reviewer in two lists. An operator registering a new automation identity in one and forgetting the
other produces a **silent fail-open** — the denial simply does not apply. The purpose of this change
is to close a fail-open; trading it for a fail-open-by-omission is not a fix.

## Risk

Low, with one honest exception: this **knowingly excepts ruling R2** ("no key feeds two gates"). The
ADR draft carries the justification, and without that paragraph a future reader finds one key feeding
two gates and reasonably concludes it is the §3 bug. That paragraph is the difference between an
exception and a regression.
