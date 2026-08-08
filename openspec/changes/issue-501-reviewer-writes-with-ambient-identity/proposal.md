---
status: draft
issue: 501
---

# Propuesta — reviewer writes with ambient identity (issue 501)

## Qué

Bind the reviewer's credential to the VCS port at construction, so every verb it invokes
writes under the identity that was verified — and add a drift guard so a verb added later
cannot bypass it.

## Por qué

Issue #501, found on the first end-to-end run of `brain:review` against a real PR (#500).

The reviewer **verifies** with `BRAIN_REVIEWER_TOKEN` and **writes** with whatever the
operator is logged in as. Measured: `whoami` resolved `csrinaldibot`, and the review posted
as `csrinaldi` — [#pullrequestreview-4887057484](https://github.com/csrinaldi/brain/pull/500#pullrequestreview-4887057484).

The cause is one-sided plumbing. `GH_TOKEN` appears twice in all of `github.mjs`, both inside
`whoami`; no write verb injects it. That is #413 fixed on the read side and left open on the
write side.

It survived because **the defect is invisible whenever ambient auth matches the reviewer
token** — the normal state on a machine dedicated to the bot. It took a run from a
maintainer's checkout, with `gh` logged in as one identity and the PAT of another, to
separate them.

Two consequences, both measured on PR #500:

1. **The anti-loop lock sees its own verdict and disowns it.** `poster.mjs:113` compares
   `lastVerdict.author` to `reviewerHandle`; the author is the ambient identity, so the
   comparison can never be true. Re-running at an unchanged head posted a second identical
   verdict, `rev: 2`. `rev` climbs on every run, and at `rev >= 3` a `REVISE` becomes `STOP`
   + `escalate:human` on a PR nothing changed on.
2. **The self-review abstention is evaluated against an identity the write path never
   uses.** `cold-boot.mjs:106` concluded "not a self-review", and the review was then posted
   by the PR author.

And one that is latent rather than active: `reviewer-protocol.md` §1 makes the sacred
asymmetry structural through two independent locks — `event: 'COMMENT'` hardcoded (lock 2)
and the reviewer's identity being allow-listed so L6 discounts its approvals (lock 3). Lock 2
held under three independent red-proofs on PR #490. **Lock 3 has never been load-bearing**:
the write carries the operator's identity, so if lock 2 were ever defeated and the operator
were a human who is neither the PR author nor allow-listed, the resulting APPROVE would
satisfy L6 — the outcome §1 says must be impossible by construction.

## Alcance

- **Incluye:**
  - `getVcs({ provider, identity })` binds a credential to the port; omitted, behaviour is
    unchanged for every existing caller.
  - `github.mjs`: one internal chokepoint through which every `gh` invocation passes.
  - `gitlab.mjs`: verbs take the bound token instead of falling back to `vcsToken(PROVIDER)`.
    GitLab is broken too, by a different mechanism — the per-verb token parameter exists,
    is correct, and the poster never passes it.
  - The review CLI binds its verified token to the port it hands the poster.
  - `poster.mjs` / `cold-boot.mjs`: the identity comparisons key on the writing identity.
  - **A source-level drift test**: no raw `gh` invocation outside the chokepoint, no
    `vcsToken(PROVIDER)` fallback on a verb the reviewer reaches.
- **No incluye:**
  - **Lock 2.** `event: 'COMMENT'` stays hardcoded; this change adds no parameter, flag or
    branch that reaches it (ADR-0020).
  - Unifying `VCS_TOKEN` and `BRAIN_REVIEWER_TOKEN`. They are distinct by design; merging
    them is an ADR, not a bug fix.
  - **#473** — where the approval signature lands. Being worked in parallel; file sets
    verified disjoint.
