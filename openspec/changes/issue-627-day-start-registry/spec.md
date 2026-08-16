---
status: draft
issue: 627
---

# Spec — day:start step 4 asks the registry (issue 627)

## REQ-627-1 — The source is the registry, through the consumer's own npm

The check runs `npm view <PACKAGE_NAME> versions --json` rather than
`git ls-remote --tags`. Going through npm rather than a hand-rolled fetch is
deliberate: it inherits the consumer's `.npmrc` — their registry, scope mapping,
proxy and auth — so a mirrored or air-gapped consumer is asked about the
registry they actually use.

## REQ-627-2 — No hardcoded remote

The github.com URL literal is gone. The package name comes from `PACKAGE_NAME`.

## REQ-627-3 — Three outcomes, never two

Up to date, a new version, and COULD NOT CHECK are distinct messages. The
previous code reported an unreachable host as `day.brain.noNetwork` — "no
network" — which is the wrong problem to hand a consumer whose registry is a
mirror they can reach perfectly well. The new text says the check was SKIPPED,
not passed (`evidence-reader-empty-on-failure`).

`notPublished` is likewise distinct from `registryUnreachable`: "there is no
release" and "I could not ask" are different facts.

## REQ-627-4 — Never recommend a prerelease

Ranking uses `highestVersion`, which excludes prereleases BY RULE (#644):
`compareSemver` reads only major.minor.patch, so an rc compares EQUAL to its
release and a plain sort returns whichever the registry listed last.

## REQ-627-5 — The installed version is read across the rename

`readInstalledVersion` matches `PACKAGE_NAME` **and** the pre-rename `brain`.
The legacy name is deliberate: a consumer who has not crossed the rename is
exactly the population that most needs to be told a new version exists.

## REQ-627-6 — A consumer's own version is never mistaken for brain's

The fallback candidate (the repo's own `package.json`, for self-host) matches on
NAME, not on position.
