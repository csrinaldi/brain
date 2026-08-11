---
status: draft
issue: 408
epic: 313
---

# Proposal — the `follow_ups` path had every layer except a producer

## What was wrong

`verdict.mjs` routes `causal_disposition: 'pre-existing'`/`'base-only'` out of the blocking
set. `schema-v2.mjs` admits both. `reviewer-protocol.md` documents them. `renderVerdict`
emits the block and `parseVerdict` reads it back.

**No evaluator ever produced either value**, so the routing branch was unreachable in
production and `follow_ups` was always `[]`. #381 moved it from *broken* to *empty*, not to
*working*. The reason was correct and is quoted in `causal-admission.mjs`: *"none of these
checks compare against base closely enough to honestly claim that — inventing the claim would
be worse than omitting it."* The gap was that no check which CAN honestly make the claim had
been built.

## Two measurements decided the design, and the first one killed the obvious version

**(1) The obvious comparator is inert in this repo.** The natural design reads the base
commit's check-run rollup and asks *"was this gate already red?"*. Measured on `main` at
`1e05960`: `governance.yml` triggers on `pull_request` **only**, so a commit on `main` carries
`m4-danger-paths`, `audit-and-revert` and `relabel-retrigger` — and **not one of the eight
governance gates**. A rollup-based comparator would find no base entry for any required gate,
classify nothing, and stay green in every test while never firing in production. That is
#335's class, and it is why this **re-runs** the check at base instead of reading a status
somebody else recorded.

**(2) Exactly one gate can inherit a failure.** Seven of the eight required jobs are diff- or
PR-scoped **by construction** — `diff-size` measures `base...head`; `issue-link`,
`decision-gate`, `memory-gate` and `phase-order` read this PR's body and this change's
artefacts; `actor-check` and `brain-writes-reviewed` read this PR's approval and authorship.
Asking whether any of them "exists on base" is not a hard question, it is a meaningless one.
`local-checks` is the exception: it runs `repo:check`, `brain:nav` and the unit suite over the
**tree**, and a tree can be broken before this branch touched it.

So the producer is narrow on purpose: one gate, re-derived at base, in a throwaway worktree.

## The four design questions the ticket asked to settle first

**1 — What base state does it read?** Not the `base...head` diff: a base **checkout**, exactly
as the reversion check does, and the reason is measurement (1). The isolation discipline is
copied from `defaultRunReversion` rather than reinvented — detached worktree, never a checkout
in the operator's cwd, torn down in `finally`.

**2 — `pre-existing` vs `base-only`?** This ships `pre-existing` only. `base-only` ("exists
only on the base, not touched by this diff") has **no honest producer** among brain's checks:
everything brain emits is about this PR or about a tree the PR is part of, so nothing it
observes is base-*only*. Stated rather than invented — `causal-admission.mjs`'s own rule
applies one level up. Both values route to the same branch, so it becomes reachable either way.

**3 — Cost.** Lazy, and the laziness has two halves. The probe runs only when a
base-reproducible gate is **already a blocker** — the PR is stopped and a human is about to be
summoned, so paying for a base run to tell them *"this is not your change's doing"* is the
cheap side of the trade, and a green PR never pays it. And the command list **mirrors the
workflow's own `if: hashFiles('.brain-source')` condition**, so a consumer runs two fast node
scripts and only brain's own repo pays for the suite. Feasible at all because brain declares
zero dependencies: every command runs in a bare worktree with no install step.

**4 — Does the refuter's `inferential` producer belong here?** **No, and it is not a
deferral.** A base re-run answers a question about *causality* by observing. `inferential` is a
claim about how a finding was *established* — reasoned rather than observed — and every
evaluator brain has is deterministic by construction. Building a reasoner so a fork can fire is
the same error this module refuses. Filed as **#552** with that reasoning.

## The uncomputable case is not `unknown`, deliberately

`unknown` forces `STOP` + `escalate: human` per finding. A base probe that failed for
infrastructure reasons would then summon a human for every gate finding on every review — the
escalation storm #394 exists to prevent. A failed probe leaves the finding `introduced`, which
keeps it **blocking**: the safe direction, where a failed base check costs a false block and
never a false pass. The inability is reported as a condition, never swallowed.

## Proven end-to-end, because the ticket refuses anything less

The exit criterion rejects a unit test that hand-feeds `causal_disposition`. Two e2e cases
spawn the real CLI against a real git history and read the **posted** body back with the real
parser. The only difference between them is whether the baseline commit is broken:

- base broken → `gate:local-checks` lands in `follow_ups[]` as `pre-existing`, leaves
  `findings[]`, and the REVISE-to-APPROVE softening fires. **`verdict.mjs`'s branch is reachable.**
- base healthy → the same red gate stays in `findings[]` as `introduced`, verdict `REVISE`.

The second is what makes the first mean anything: without it, a classifier hardcoded to answer
`pre-existing` would pass.

## Two things this change had to fix to be honest

**The fixture was not a consumer after adopt.** It vendored `brain/core` without
`brain/HOME.md` — which is neither `managed` nor `local` in `managed-paths.mjs`, because a real
consumer's is written by `brain:env:init`. So `brain:nav` failed on every fixture for that
reason alone, and the moment a base probe started *running* `brain:nav`, every e2e would have
reported "the tree was already broken" — true of the fixture, false of the thing it models. The
fixture now generates a flat `brain/HOME.md` index over whatever `brain/**` contains, so it
satisfies both nav invariants for any core payload.

**A tripwire came due.** REQ-409-6 was left asserting `follow_ups` absent with the instruction
*"flip means #408 landed, move these, do not delete them"*. It did not flip — correctly, since
its finding is `gate:phase-order`, which no base comparison can speak to. Its framing was
rewritten to say what it now means (a statement about **scope**, not about #408 being
unlanded), and its refuter half is now the only part tracking something unbuilt.
