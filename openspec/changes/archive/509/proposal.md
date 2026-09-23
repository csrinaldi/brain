---
status: draft
issue: 509
---

# Proposal — `brain:promote` gains the in-place amendment shape

## What was wrong

`brain-promote.mjs:335` refused the amendment path by design, and said so:

> This slice promotes NEW ADR files only. In-place edits to an already-signed `brain/**` file
> are NOT automated yet.

That refusal was correct when slice 1 shipped (#378): the amendment convention was unwritten,
and encoding an unwritten rule would have *been* writing doctrine, the Tier 2 act the whole
line exists to keep human. Both preconditions #378 named are now met — `consolidation-protocol.md`
§1c/§1d landed in `94d326d`, and `be2d143` is a real human execution of them.

What filled the gap in the meantime was **one bespoke shell script per promotion**, written
from the doctrine text:

| script | what it promoted | what it got wrong |
|---|---|---|
| `promote-529.sh` | a `workflow-governance.md` ruling | forgot the `AGENTS.md` regeneration — CI failed on the human's signing commit |
| `promote-516.sh` | ADR-0026 Amendment 4 + four doctrine sites | nothing, because it was written from the VERB's behaviour rather than the prose |

The second one is the tell. It got the cascade right *by copying what `brain:promote` already
does*, which is the argument for having one implementation instead of N. A second implementation
of a written rule is the #340 defect, and here it produced the defect within one commit of the
rule being written.

## What changed

`brain:promote` takes a second draft shape. A draft named `*.draft.md` carrying one fenced
`brain-amendment/1` block declares a target under `brain/**` and the passages it supersedes;
the verb performs §1c's three acts, §1b's index marker for the ADR shape, and §1d's `AGENTS.md`
regeneration — then stages and stops. All four ADR-0028 locks are unchanged and now cover both
shapes, because both shapes run through one flow.

Two target shapes, one cascade:

| | ADR target | doctrine-document target |
|---|---|---|
| §1c act 1 — Status line | generated, amendment number verified against the file | — (no Status line) |
| §1c act 2 — in-place annotation | declared as anchored find/replace pairs | same |
| §1c act 3 — appended signed section | required, `**Signed**:` stamped by the verb | optional |
| §1b — `brain/HOME.md` marker | generated from a one-line summary | — |
| §1d act 3 — `AGENTS.md` | regenerated | regenerated |

`promote-529.sh` and `promote-516.sh` are deleted. A test asserts they stay deleted.

## The acceptance, and it is not synthetic

Given the tree at `be2d143^` and the #473 amendment draft, the verb stages a tree
**byte-identical** to what the human's `be2d143` produced — the ADR file, `brain/HOME.md`, and
the regenerated `AGENTS.md` — with zero new commits and a printed commit command `commit-msg`
accepts. The human's own promotion is the oracle; the tool may not diverge from it and pass.

Proven red by mutation on four independent acts (§1c act 1, §1c act 2, the `HOME.md` marker,
the `AGENTS.md` regeneration) plus the date format and the literal-replacement guarantee. Each
mutation was read back off disk before the suite ran.

## Shipped as two PRs

At 1423 counted lines against the `lite` tier's 1000 this could not be one review. The cut is the
module boundary (design D11), which is also where the two cold reviewers split by themselves:

- **PR A — `lib/amendment-draft.mjs`**: the contract, the free-anchor algebra, the cascade
  assessment, plus the `compileAgentsMd` fail-open fix. Pure text in, text out; 784 counted lines.
- **PR B — `brain-promote.mjs`**: the dispatch, the write preconditions, the rollback, the plan
  surface, the locks guard, the golden oracle, the stopgap deletions and the Tier 2 drafts;
  639 counted lines, stacked on A.

A ships a module nothing calls yet. The cost is real; what it buys is that each half is
reviewable as one kind of thing.

## What this does NOT do

- **It still does not commit and it still does not push.** ADR-0028's whole point.
- **It is not the #516 amendment-marker guard, and it is not a gate.** #516 measured that
  `decision-gate` passes a modified ADR with no `brain/HOME.md` change, and recommended putting
  the net in this verb rather than in a fourth `decision-gate` branch — *a tool that performs
  the cascade cannot forget it*. What ships here is that tool. A promotion done by hand, or by
  the next bespoke script, is exactly as unguarded as it was yesterday. Design §D5 records why
  a content-keyed check was not also built.
- **One target per run.** Multi-ADR and cascading amendments stay out of scope; `promote-516.sh`
  touched four files in one pass and this verb would need four drafts to do the same.
