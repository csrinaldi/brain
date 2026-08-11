---
status: draft
issue: 442
---

# Design

## Why the resolver is beside `resolveTier` and not at the call site

The ticket observes that `cli.mjs` has exactly one call site and suggests putting the override
there. It lives in `governance-tiers.mjs` instead, for two reasons.

`resolveTier` is already the pattern this needs — absent → default, explicit-unknown → throw —
and putting the twin next to it means one shape rather than two. And the module's own docstring
already **names** `resolveReviewProtocol` as the function that returns the tier default; the
name was pre-committed by the doctrine comment, and the function was the thing missing.

The CLI keeps one call site. It gained a `try/catch`, because a throw at boot must become a
readable refusal rather than a stack trace — and returning `1` before any port write is what
makes "post nothing" true rather than intended.

## Fail-closed is sharper here than for the tier

A bad `governance.tier` downgrades doctrine visibly — budgets and job sets change. A bad
`reviewer.protocol` falling back would change **nothing an operator can see**: the run
succeeds, a verdict posts, and the only difference is that causal admission never ran. Silence
is exactly what makes it worth refusing.

## The dogfooding needed its own guard

`reviewer.protocol` in `brain.config.json` is one line, and one line is what gets dropped in a
merge conflict. So a test reads the shipped config and asserts three things together: the tier
is still `lite`, `lite` still defaults to `/1`, and the resolution is `/2`. Asserting only the
last would pass if someone moved the tier to `regulated` — which is the change this ticket
exists to avoid.

## What the e2e had to prove that a unit test cannot

That the override reaches the **posted body**. Resolving `/2` in memory and posting `/1` is the
defect shape this ticket is most exposed to, and it is invisible to any assertion that stops at
the resolver. So all three cases write a real `brain.config.json`, spawn the real CLI, and read
the wire.

The no-override case pins **two layers**, and that is not belt-and-braces: `parseVerdict`
assigns `result.protocol` only for `/2`, so a `/1` result has no such key. Asserting
`verdict.protocol === 'brain-review/1'` fails against correct output; asserting it is falsy
passes against a parser that stopped reading the field. The body carries `/1` explicitly and
the parser's shape is pinned as **absent** — the same discipline REQ-409-6 arrived at for
`follow_ups`, one field over.

## Red-proof

| | mutation | result |
|---|---|---|
| M1 | an unknown protocol falls back silently instead of throwing | **1 RED** |
| M2 | an absent override resolves `/2` for everyone (the no-op guarantee broken) | **1 RED** |
| M3 | the `protocol` line dropped from brain's own `brain.config.json` | **5 RED** |
| M4 | the CLI swallows the throw and degrades to `/1` | **1 RED** (e2e) |

M3 is the one worth naming: dropping one line from a config file turns five tests red across
three layers, which is what "asserted rather than assumed" is supposed to mean.
