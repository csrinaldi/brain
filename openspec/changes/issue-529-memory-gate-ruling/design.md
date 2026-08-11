---
status: draft
issue: 529
---

# Design

## Why there is no code in this change

The ticket's subject is a decision. Option (1) is prose; options (2) and (3) are ruled *later*,
not *now*. Shipping a behaviour change alongside the ruling would answer the question by
implementation and leave the signature decorative — which is the shape #519 failed in: its PR
delivered the parts that were buildable and the decision quietly went with the close.

## Why a draft and not a direct edit

`brain/core/methodology/workflow-governance.md` is Tier 2 — the zone map's golden rule: *"if the
destination is `brain/`, the signature is human."* The draft carries the exact replacement text
so promotion is mechanical, and the checklist states the two things the signer is agreeing to,
because the ordering is the substance and a signature on wording alone would miss it.

## Where the correction goes, and why not where one already exists

`workflow-governance.md` **already says** the gate is repo-global — in the metrics caveats, 120
lines below the invariant table. That is not a second statement of the same rule; it is the rule
stated in the one place a reader is not looking when they form the belief. The replacement puts
it in the table and reduces the caveat to a pointer.

## The measurement that decided the ordering

Not an argument about risk appetite — a count. Option (2) fails a PR whose base postdates the
newest `session_summary`; the newest is 2026-08-04 and 34 merges have landed since. All 34.

And `skip:memory-gate` is unimplemented, which the doctrine itself records. So (2) today has no
override at all: the escape would be reverting the gate. That is what turns "tighten it now" from
a judgment call into a measured no.

## Red-proof

There is none, and that is the honest statement rather than an omission. A ruling is prose in a
human-signed file; `brain:repo:check` and `brain:nav` verify structure, not claims. The parts of
this ticket that *are* machine-checkable — the writer's reliability, and recency once it lands —
are #530 and the sequence's third step, and they will carry their own guards.

What this change can be held to instead: the numbers in it are reproducible.

```bash
git log --first-parent --since=2026-08-05 --format=%h origin/main -- .memory/records/ | wc -l   # 0
git log --first-parent --merges --since=2026-08-04 --format=%h origin/main | wc -l              # 34
```
