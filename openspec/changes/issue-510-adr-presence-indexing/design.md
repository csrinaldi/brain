---
status: draft
issue: 510
---

# Design — added is not touched, and the surfaces read the same evidence

## The two invariants

| | question | keys on | who owns it now |
|---|---|---|---|
| **I1 — indexing** | does a NEW ADR appear without its `brain/HOME.md` entry? | added paths | `adrPresence` |
| **I2 — content governance** | did an ADR change without a human gate? | review evidence | `writesGoverned` (#511) |

They were one function until now, and nothing separated them because no PR had ever
modified an ADR without also touching `HOME.md`. PR #507 is the first.

## The signature

```js
adrPresence(changedFiles, addedFiles = null)
```

`addedFiles = null` means *"assume every touched ADR is new"* — the pre-#510 behaviour. It
is a default, not a fallback: a caller that cannot cheaply produce the added list keeps
working, and the two in-tree callers that do not need it (`brain-promote`,
`postmerge/resolution`) are untouched by this change.

The three ENFORCEMENT surfaces all pass it, because they must reach the same verdict on
the same merge:

| surface | reader |
|---|---|
| CI (`governance/run-check.mjs`) | `defaultDiffNameOnlyAdded` — `git diff --diff-filter=A --name-only BASE...HEAD` |
| local (`brain-check.mjs`) | the same command against the resolved base |
| audit (`lib/merge-walk.mjs`) | `readMergeDiff`, through the same `gitOrThrow` as the touched list |

## Fail closed on the added list, in the same `try`

```js
try {
  changedFiles = diffNameOnly();
  addedFiles   = diffNameOnlyAdded();   // #510 — SAME try
} catch (err) {
  return { pass: false, uncomputable: true, reason: `cannot compute diff — failing closed (uncomputable): ${err.message}` };
}
```

An added list that failed to compute must not degrade into `[]` (*"nothing was added"*) or
into `null` (*"assume everything touched is new"*). Both are verdicts about evidence that
does not exist, and `[]` in particular re-opens #510 from the opposite side — fail-OPEN,
every added ADR reading as modified.

The audit's reader gets the same treatment for the same reason: it goes through
`gitOrThrow`, not a cheaper read. Measurement and enforcement on different rules is the
drift #340 records.

## What changed about A10

A10's PROPERTY is frozen and untouched: *a live-at-HEAD ungoverned artifact must always be
reported*. What changed is **which invariant carries it**.

Until now that was `adrPresence`, firing on a MODIFY it was never meant to see. With the
imprecision gone, the owner is `writesGoverned`, which keys on PR review evidence — so the
fixture needs a **resolvable PR**. Without one the check abstains (#474/#511: absence of
evidence is not a verdict), the offender comes out `[PASS]`, and the fixture is green for
the reason the maintainer's ruling explicitly rejected: a comment describing a mechanism
that no longer runs.

So R and O become PR-shaped merges, a PATH-stubbed `gh` serves one PR whose only review is
a **comment**, and one assertion is added: the report must name `writesGoverned`. That is
the honest shape of the attack under the new design — the merge was seen, and nobody gated
it.

## The narrowing, stated rather than discovered

The audit's guarantee on the MODIFY channel is now **conditional on being able to read
review evidence**. A merge with no resolvable PR is not reported. Two distinct paths lead
there, and only the first is new:

1. `writesGoverned` abstains when the PR cannot be resolved (#511's settled design).
2. `resolvedSkipLine` — the **pre-evaluation** resolved-skip — drops a merge whose own
   contribution is net-absent at the tip *before any check runs*. So an ungoverned `brain/`
   write that was later reverted never reaches the human-gate check at all.

(2) is documented and deliberate (design §3.5 / REQ-D2-10) and predates this change; what
was never written down is that it now also governs review evidence, whose remedy is a human
reviewing the change rather than a machine undoing it. Recorded in ADR-0029, raised
separately, not changed here.

## Where the membership rule is actually testable

`writesGoverned` is deliberately absent from `TREE_KEYED_CHECKS`. A10 cannot prove that:
its offender's payload is live at the tip, so the net-parity exemption never applies to it
whatever the membership says — adding `writesGoverned` to the set leaves A10 green.

The merge the exemption is *for* is the cleanup reverter R. `netAddFull`'s full-window
range exists precisely so a tip-most R still earns its exemption (§15.3's range asymmetry).
R is a `brain/` write like any other, so if `writesGoverned` were tree-keyed the exemption
would clear it along with the rest. **A10d** pins that, and restates A11's property for
this class: R may be reported, and must never carry `[FAIL-SHA]` — undoing R would
resurrect the payload R removed.
