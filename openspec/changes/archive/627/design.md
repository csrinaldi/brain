---
status: draft
issue: 627
---

# Design — day:start step 4 asks the registry (issue 627)

## D1 — `npm view`, not a fetch

A direct HTTPS call to registry.npmjs.org would be fewer moving parts and WRONG
for the population ADR-0030 Amendment 1 exists to protect. `npm view` resolves
through the consumer's `.npmrc`: their registry mirror, scope mapping, proxy,
auth. Asking npm is how this check inherits their configuration instead of
contradicting it.

## D2 — The legacy name stays in `readInstalledVersion`

Dropping it would silence the check for every consumer who has not yet upgraded
across the rename — the exact set the notification is for.

## D3 — "Could not check" is not "no network", and not "up to date"

Three outcomes stay three. The old vocabulary was built when the only source was
a git host: unreachable meant no network. With the registry, unreachable most
often means a mirror, a proxy or an auth scope — a consumer with a perfectly
working network. Collapsing that into "no network" points them at the wrong
problem, and collapsing it into silence would be worse.

## D4 — `highestTag` is left alone

It parses `refs/tags/vX.Y.Z` and still has git-tag callers. Repurposing a
function whose other callers depend on its current semantics is the class
ADR-0030 Decision 3 warns about: re-derive, never translate. `highestVersion`
was written for registry lists in #644 and is used here as-is.
