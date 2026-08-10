---
status: draft
issue: 506
epic: 313
---

# Proposal — the rev bound counts an iteration, and the escalation has an exit

## What was wrong

§7's bound says *"this has gone around too many times, a human must rule"* — a statement
about iterations on a **disagreement**. The count measured something else: every parseable
verdict ever posted to the PR, with **no `head_sha` filter**.

Measured on PR #505 — four runs, same head `3ae6eb9`, same single finding, nothing changed
in the code:

| run | rev | verdict | escalate |
|---|---|---|---|
| 1 | 1 | REVISE | null |
| 2 | 2 | REVISE | null |
| 3 | 3 | REVISE | null |
| 4 | **4** | **STOP** | **human** |

A long-lived PR reviewed once at each of four successive heads — correctly every time — was
indistinguishable from one that argued four times about the same diff.

**And it had no exit.** A new commit did not reset it (no head filter). Dismissing the
reviews did not (a dismissed review keeps its `body`, so it still parses). Past the bound,
every future run returned STOP. The only way out was closing the PR and opening a new one —
discarding the review history the escalation exists to summarise. That is a trapdoor, not a
decision point.

## The two fixes

**1. One definition of "the same review iteration."** The ticket required this explicitly:
the anti-loop lock already filtered by head while the bound did not, and nothing said why.
`verdictsAtHead` is now that definition, cited by both. The anti-loop adds an **author**
condition on top — that difference is real and is stated where it is applied, not hidden in
a second notion of sameness.

**2. A human ruling clears the escalation.** It lands on the surface the signature already
lives on: `brain:approve` posts a `brain-decision/1` block bound to a head (#473), read from
the **same** review list cold boot already fetches. No new mechanism, no new port verb, no
new label — labels are the derived index, verdicts are truth.

Bound to the head, like everything else here: a push is work the human has not ruled on, and
it re-arms. That is the rule `actor-check` already applies to an approval that predates a
commit.

## What is deliberately NOT cleared

A ruling does not clear `unknownCausality`. That escalation says *"the reviewer cannot
determine whether this finding is caused by the diff"*, which a ruling about going around in
circles does not answer. Two escalations, two questions — and a fix that cleared both would
silently widen what a signature means. Mutation M3 is exactly that widening, and it is red.

## The bound is re-aimed, not weakened

Four verdicts at the **current** head still escalate. Arguing four times about one diff is
precisely what §7 is for.
