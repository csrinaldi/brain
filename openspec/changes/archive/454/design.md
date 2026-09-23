---
status: draft
issue: 454
---

# Design — a third key, and why not a reuse

## The exempt set

```js
const exempt = [actor, ...reviewActors, ...agentActors].filter(Boolean);
```

One line. Everything else in this change is about where the strings come from and what the
exemption is honest about.

## Why a separate key

`reviewActors` already feeds three consumers: L5's deny (a review identity may never apply
the approval), L5's re-arm exemption, and L6's bot allowlist. Reuse would get all three
*behaviours* right for an agent — which is why it is tempting — and the **meaning** wrong.

The wrongness surfaces as a lying refusal. A consumer running an agent but no cold reviewer
would have to register their coding agent in `reviewActors`, and `brain:approve` would refuse
it with *"a review identity may never sign an approval"* — said about something that reviews
nothing. Correct refusal, false reason: the defect class #510 closed in `adrPresence` one
ticket earlier. Ruling R2 ("no key feeds two gates") was knowingly excepted once, in #375;
twice is how an exception becomes the rule.

## Agnosticism as a property, not an intention

The lock derives its forbidden strings **from the config**, so the guard names no platform
either and starts guarding the moment any consumer declares one.

Its first version scanned all of `brain/core/**` and `brain/scripts/**` and reported 18
files. Reading them refuted it: nearly all are adapters or their manifests —
`harness/backends/claude.mjs` implements the harness contract for one platform exactly as
`vcs/providers/github.mjs` implements the VCS contract for one forge. **Naming a platform is
what an adapter is FOR**, and a guard forbidding it would condemn the pattern that produces
the agnosticism. Scope is the path that DECIDES outcomes: `brain/scripts/vcs/**` and
`brain/scripts/governance/**`, where a literal would leave no adapter boundary to swap.

The guard also refuses to pass vacuously: a config declaring nothing fails with an explicit
message rather than reporting green over an empty loop.

## What the exemption does not prove

An identity string in a config file is not an authenticated identity. Providers attribute by
email match; git authorship is unauthenticated. The exemption is only as strong as the
push-access set.

Accepted as a `lite`-tier trade on a precedent already load-bearing in the same function:
`reviewActors` is exempt on exactly this basis, and #413 verified the reviewer identity at
the review-POSTING seam, never at the authorship seam. Demanding cryptographic proof of the
agent while the reviewer bot rides on email attribution would be an inconsistency, not a
standard. The upgrade path is signature verification normalized through the port — the same
way `login` already is — not a longer list.
