---
status: draft
issue: 604
---

# Proposal — the reviewer's coldness is not verifiable (issue 604)

## What

A **negative control** on the reviewer's identity verification: resolve identity
with a token that is deliberately invalid *first*, and refuse the run if that
probe **succeeds**. Plus the two supporting repairs the measurement exposed, and
the rulings for the four decisions #604 asks for.

## Why the existing verification is not evidence

`identity.mjs`'s premise is that `whoami({ token })` "resolves who the token
actually belongs to". Measured in this session's container, it does not:

```
$ curl -H "Authorization: Bearer ghp_thisIsDefinitelyNotARealTokenAtAll0000" \
       https://api.github.com/user   →  HTTP 200 · login: csrinaldi
$ curl -H "Authorization: Bearer "  https://api.github.com/user   →  HTTP 200 · login: csrinaldi
$ curl                              https://api.github.com/user   →  HTTP 200 · login: csrinaldi
```

An invented token, an empty one and no credential at all return the same
authenticated identity. `HTTPS_PROXY` is set, `GH_TOKEN`/`GITHUB_TOKEN` are
14-character sentinels, and `BRAIN_REVIEWER_TOKEN` is a 40-character PAT that
nothing ever reads. The proxy answers for the caller.

The dangerous half of #604's table is the one that **proceeds**: with
`reviewer.handle` set to the ambient login, the #413 comparison AGREES, and the
verb reports a verified identity established by a credential it never used.

## Why a negative control, rather than trusting `whoami` harder

The control asks a question the environment cannot answer favourably by
accident: *does this environment reject a credential it should reject?* It
cannot be defeated by rotating a token, because it never uses a real one — which
matters, because chasing this through rotation is exactly what cost the
maintainer three of them.

It is a **probe, not a fix**. It does not make the reviewer cold; it establishes
only that the identity evidence is the token's own. Coldness in the
provenance sense is half 2, ruled in `spec.md` and deliberately not built here.

## What the measurement also exposed

**1. `run()` swallowed launch failures.** `spawnSync` reports a missing binary
in `r.error`, with `status: null` and `stdout`/`stderr` both null. `run()` never
read it, so `brain:review` in a container without `gh` refused with:

```
… could not verify the reviewer identity against the token: gh api /user failed (status null):
```

— nothing after the colon. That is the `evidence-reader-empty-on-failure` family
(five prior instances), sitting on the reviewer's own identity path: "could not
run" was rendered indistinguishably from "ran and reported nothing".

**2. The `/2` e2e harness was simulating the broken environment.** `gh-stub`
served `user.json` for any `GH_TOKEN` at all — the credential-injecting
environment, faithfully reproduced by accident. An e2e that fakes the identity
endpoint that way cannot observe this defect. The same was true of the unit
doubles in `identity.test.mjs` and `cli.test.mjs`: every one returned a fixed
login whatever token it was handed, and the negative control refused all of
them on first run. A double that ignores its token cannot model a healthy
environment, and fixing them is part of the change rather than fallout from it.

## Scope

Half 1 only, as mechanism. Half 2 (provenance) and points 2–4 are **ruled** in
`spec.md` and sequenced in `tasks.md`; only decision 1 is implemented.

Explicitly out of scope, per the ticket: fixing the proxy, or giving the cloud
environment a second GitHub identity.

## This change cannot be reviewed cold in the environment that produced it

Stated because the change touches the mechanism everything else is reviewed
with, and a fix here that certifies itself is the worst available outcome:

- `brain:review` **cannot run in this container** — `gh` is absent, and after
  this change the negative control refuses here anyway (correctly: the control
  is unusable without a working provider CLI, and unusable is not clean).
- So this PR has **no cold verdict from the tooling it modifies**, and asks for
  a human review, or a run from the maintainer's machine or a GitHub Actions job
  holding the PAT as a repository secret.
- The one claim proven only against a shim rather than real `gh`: that a
  maintainer machine authenticated via `gh auth login` still **clears** the
  control. It rests on `GH_TOKEN` taking precedence over gh's keyring — the
  repo's own documented premise and the foundation of #413 — plus a
  token-honouring shim. It has not been run against real `gh`, and should be
  before this is relied on.
