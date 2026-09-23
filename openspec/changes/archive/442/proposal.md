---
status: draft
issue: 442
epic: 313
---

# Proposal — `/2` dogfooded at `lite`, without moving a single gate

## What was wrong

`brain-review/2` — the causal-admission protocol — was **tested** (#409's e2e) and never
**used**. Brain's own PRs were reviewed at `/1`, so the annotation, the routing and now the
base comparison ran against fixtures and never against real work.

The reason was structural, not neglect. `/2` is `regulated`'s default, and **brain cannot
declare `regulated`**: at that tier `actor-check` requires an approver distinct from the author
who authored no commit on the branch — unsatisfiable for a solo maintainer, which is the #329
contradiction ADR-0026 exists to resolve. Moving the tier to get the protocol would have moved
seven other gates with it, into a doctrine brain cannot satisfy.

## The doctrinal door was already open

T2.3's design §3.4 — quoted verbatim in `governance-tiers.mjs`'s own docstring — already says
the tier sets a **default**, not a ceiling: *"Never forbids the other version at any tier — this
is only the DEFAULT `resolveReviewProtocol` would return."*

**No new doctrine was needed. What was missing was the knob**, and the function that docstring
names did not exist. It does now, and it is the one it describes.

## What lands

`reviewer.protocol` in `brain.config.json`, resolved by `resolveReviewProtocol(config, tier)`:
an explicit value wins at **every** tier, in both directions; absent falls through to the tier
default.

**Fail-closed on an unknown value**, exactly like `resolveTier` beside it and for a sharper
reason: silently falling back would hand the operator a `/1` verdict while they believed they
had `/2` — quietly dropping causal admission, the base comparison and the refuter fork. That is
the #382/#413 boot-refusal shape: refuse, name the value, post nothing.

**Brain's own config requests `/2`.** That is the dogfooding, and it is asserted rather than
assumed — a guard reads the shipped `brain.config.json` and fails if the line disappears.
Without it the key could be dropped and every other test would stay green while brain went back
to `/1`: green in test, inert in production (#335), applied to the ticket's own deliverable.

## What it deliberately does not touch

`governance.tier` stays `lite`. The gate matrix, the budgets and the approval evidence are
untouched — the e2e asserts the budget quoted is **lite's 1000**, not `regulated`'s 200, so a
change that moved the tier to get the protocol would fail there.

`deps.tier` stays a test-only seam and **no second one was added**: the config override is the
production path, so the CLI tests observe brain's real resolved protocol rather than an
injected one.

## What this makes true that was not

#442 was written expecting *"verdicts will carry annotated findings but empty `follow_ups`,
same as at `regulated` today"*. **#408 landed first**, so brain's own reviews now get the
annotation *and* a working `pre-existing` producer. The two tickets were sequenced apart and
compose: the protocol brain now uses is the one that has something to say.

## One thing that broke, and it was the right thing to break

Four `cli.test.mjs` cases went red, and one of them was named *"lite tier (brain's own declared
tier, **no override**) → brain-review/1"*. It was true until brain's config carried an override.
Those tests load the real config on purpose, so what they observe is brain's **actual** resolved
protocol — which makes that case the dogfooding seen from the CLI. The property it used to
carry did not disappear: it moved to the two layers that can express it honestly, pure
(every tier × absent override) and wire (a real config file with the key omitted).
