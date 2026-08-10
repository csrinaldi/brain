---
status: draft
issue: 479
---

# Design

## One line, chosen over twenty

```js
const bound = identity ?? _token(name);
if (!bound) return mod;
return bindIdentity(mod, bound);
```

`identity ?? _token(name)` and not the reverse: `??` order is the whole of REQ-479-2, and
mutation M2 is exactly the reverse — it redirects the reviewer to the generic credential and
is red.

## `_token` is a seam, and it exists for a measured reason

`vcsToken()` reads the developer's `.env` **before** `process.env`. A test that merely set or
deleted `process.env.VCS_TOKEN` would assert one thing on a clean checkout and the opposite
on a configured one.

That is not hypothetical: the pre-existing assertion *"an unbound port must bind nothing"*
was passing **because the machine running it had no `VCS_TOKEN`**. It would have flipped the
moment a developer configured one. It is now driven through the seam and says what it means.

## Why the end-to-end test uses the real adapter

Every other test in `identity-binding.test.mjs` drives a stub provider, which proves the
binding and not the application of it. #475's acceptance is explicit that *reading the YAML
is not proof*, and the same standard applies here: the workflow change is worth nothing
unless the real adapter turns the neutral name into the provider-specific one on the child
env. So one test drives the **real** `github.mjs` through the **real** chokepoint with the
spawn seam recording what `gh` would have been handed.

## The guard's parser

`stepBlocks()` slices on step bullets at a common indent and returns each slice whole, with
comment lines removed first. Searching a whole slice rather than matching a step's structure
is what makes it shape-independent — and shape-dependence is the recorded failure mode
(#480: seven ordinary step shapes defeated the guard that keyed on them).

The permissions condition only fires when a `permissions:` block exists. With no block the
default token already carries read scope, so demanding the line there would be noise that
teaches people to ignore the guard.

## What is NOT in scope

**The 20 untokened `gh` call sites inside `providers/github.mjs`.** They are no longer
untokened in effect — every one of them goes through `ghOpts`, which now has an identity to
apply on every port obtained. Rewriting them to take explicit `token` parameters would
re-introduce the per-verb parameter #501 removed on purpose.

**#480.** Its subject is a guard defeated by step shapes; the guard written here is
shape-independent and covers the two audit workflows. #480 remains open for the wider
API-reading surface it names.

## Red-proof

Six mutations, all RED:

| mutant | the lie it would tell |
|---|---|
| M1 the seam removed | back to ambient auth, 4 red |
| M2 `VCS_TOKEN` overrides an explicit identity | the reviewer writes as the wrong actor |
| M3 the fallback hardcoded to GitHub | green in test, inert on GitLab (#335) |
| M4 postmerge reverts to `GH_TOKEN` | the provider-specific name returns |
| M5 release audit loses its credential | rung 2 blind again |
| M6 release keeps the token, loses the scope | **looks fixed, still blind** |

M6 is the one worth naming: it is the state #475 says an eyeball review passes.

Full suite: **3009 tests, 0 failures**.
