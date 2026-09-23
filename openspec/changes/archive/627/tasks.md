---
status: draft
issue: 627
---

# Tasks — day:start step 4 asks the registry (issue 627)

- [x] Measure the live state first: `readInstalledVersion` returns null for BOTH
      a scoped consumer and brain's own repo on `main` @ `982f544`
- [x] `readInstalledVersion` matches PACKAGE_NAME and the legacy name
- [x] Step 4 reads the registry through `npm view`, ranked by `highestVersion`
- [x] The hardcoded github.com remote is gone
- [x] New i18n keys in BOTH catalogs: `registryUnreachable`, `notPublished`;
      the tag-shaped `noNetwork`/`noTags` retired
- [x] `node --check` on day-start.mjs; i18n parity suite green (47/47)
- [x] Full suite: **3628 pass / 0 fail** (1 pre-existing skip)
- [x] Mutation: drop PACKAGE_NAME from the name set → **2 red**, revert
      byte-identical

## Sequencing

Downstream of the publish. Until `@logikas/brain` is published the registry
query returns "no published release yet" — which is TRUE and says so, rather
than the old behaviour of silently reporting a tag nobody can install. Safe to
merge before or after the dispatch; correct in both states.
