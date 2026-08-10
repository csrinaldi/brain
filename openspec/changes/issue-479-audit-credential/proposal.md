---
status: draft
issue: 479
epic: 313
---

# Proposal — the audit authenticates through brain's own credential

## What was wrong

brain declares **one** provider-neutral credential and the governance audit did not use it.

`tokenEnvVar(_provider)` returns `VCS_TOKEN` for every provider — the underscore is the
point. The GitHub adapter already translates it (`GH_TOKEN` on the child env), which is
ADR-0008's adapter contract working: neutral in, provider-specific out. The GitLab CI
fragment documents the same input.

Between the declaration and the adapter, nothing connected them. `getVcs()` bound a
credential only when a caller passed `identity`, and **exactly one of the 20+ call sites
does** — the reviewer (`review/cli.mjs:186`). Everything else, the audit included, fell
through to whatever the environment happened to hold: gh's ambient keyring login on GitHub,
and — because GitLab's verbs each resolve `vcsToken(PROVIDER)` themselves — the neutral
credential on GitLab.

**So the same audit authenticated under two different conventions depending on provider,
and nothing asserted they stayed in sync.** "brain runs on GitLab" was true of the port and
false of everything that reached the port without binding an identity.

The consequence was measured before this ticket existed: #467, where the audit had no
ambient token and `issueLink` reported *"no issue reference found"* on a PR whose body opens
with `Closes #443`. The only fix available at the time was to set the provider's own
variable in the workflow.

## Where the fix belongs

#479's scope offered a choice — thread `vcsToken()` through `merge-walk.mjs`, or close the
seam — and required the answer be deliberate: *"a partial thread that leaves ambient-auth
fallbacks is a half-seam and should be a leftover of nothing."*

**The fallback goes in `getVcs()`.** Threading the audit path would have fixed the one route
#467 happened to expose and left nineteen others, which is the shape `bindIdentity` already
refuses one level down: *"a hand-maintained list is the shape that failed."* A call site
added tomorrow inherits the credential without knowing it exists.

An explicit `identity` still wins, so the reviewer — which verifies as one credential and
must write as that one — is untouched. With no `VCS_TOKEN` declared, `vcsToken()` answers
`null` and nothing is bound, so a developer relying on their ambient `gh` login is
unaffected. **The change is only ever additive: a credential that was declared and ignored
is now used.**

## Rung 2 was auditing blind (#475)

`release.yml`'s audit step had no credential at all. That file's own header calls rung 2
*"the primary enforcing guarantee for free-tier-private repos where branch protection
(rung 1) is unreachable"* — and it was the rung reading nothing.

It fails **closed**, so the direction was merciful: releases were blocked rather than waved
through. But blocked for a reason with nothing to do with the release, telling the operator
the repository violated governance when the gate simply could not read it.

**And a token alone would not have fixed it.** `release.yml` declares
`permissions: { contents: write }`, and a workflow that declares a `permissions:` block sets
every scope it omits to `none`. Adding the credential without `pull-requests: read` produces
a gate that *looks* fixed and still runs blind. The two land together, and the guard below
refuses to accept one without the other.

## The guard both tickets assumed existed

Both #479 and #475 describe the work as **extending** a drift guard #467 added — *"every
step that reads the API declares its own env: GH_TOKEN"*.

Measured while implementing this: **no such guard exists**, in that file or anywhere in the
suite. Changing the postmerge audit step from `GH_TOKEN` to `VCS_TOKEN` left all 3004 other
tests green. #467 fixed the workflow and the guard was never written — which is precisely
how #475 could then ship the identical defect one rung down with nothing noticing.

It is written here, from scratch, asserting both conditions together, and it is
**shape-independent by construction**: it slices the YAML on step bullets and searches each
slice whole, so it does not care whether `env:` precedes or follows `run:`, whether `run:`
is `|`, `>` or inline, or whether the step leads with `name:` or `id:`. #480 records what
the other approach costs — a guard keyed on step shape, defeated by seven ordinary ones.
Comment lines are stripped first, so a step cannot satisfy the rule by *mentioning* the
credential.

## Precondition for #130

#130 (ship GitLab CI gates) cannot deliver a working GitLab governance pipeline while the
audit authenticates through a GitHub-only variable. That ordering — this issue, then #130 —
is now satisfied.
