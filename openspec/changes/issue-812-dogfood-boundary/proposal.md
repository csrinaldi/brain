---
issue: 812
phase: proposal
---

# Proposal — the dogfooding gets a boundary, and the key gets committed

## Intent

Make `sdd.map` — a shipped, migration-declared key — configurable in this
repository without turning `local-checks` red, so brain can dogfood the router
AND the reviewer instead of choosing.

## Measured (main, before)

```
brain.config.json WITH sdd.map.cold-review  →  review/cli.test.mjs: 45 pass / 26 FAIL
                       WITHOUT it            →  71 pass / 0 fail
```

All 26 in one file. The cause is not the dogfooding — `#442` chose to read the
REAL config on purpose, and that is what makes the repo prove its own
configuration works. The cause is that the dogfooding had **no boundary on one
axis**: with `sdd.map` present, `judgment.run` became true and the unit tests
went on to RUN THE STAGE and spawn an engine.

## The fix is a shape this file already uses

`readyDeps` already pins `trancheDeps.tier: 'standard'`, with a comment saying
why: *"pin the tier explicitly so these tests stay deterministic and decoupled
from brain's own real declared tier"*. The judgment axis had no equivalent.

It has one now — `inferentialDeps: {}` — and the boundary it draws is stated
where it lives:

> A test may inherit **doctrine** from the real config — the protocol version,
> the declared tier — and must pin its **environment**. A transport is
> environment.

`{}` is the honest stub: no generator, so the half does not run and the verdict
says so, which is exactly what a repo that has not run the stage should read.

## What this unblocks

`brain.config.json` carries `sdd.map.cold-review` in this PR. Until now it could
not: the key lived as an **uncommitted local edit** in the review checkout, and
any `git pull` destroyed it silently — after which the next `brain:review`
returned an `APPROVE` carrying `controls_not_applied: ["inferential"]`. That
happened seven times in one session. A workaround whose failure mode is a
green-looking half-verdict is worse than the gap it works around.

## Non-goals

No change to what `#442` chose to dogfood. The three assertions that read the
real config's protocol version stay, and stay passing — this widens the tests'
independence on one axis, it does not retire their purpose.
