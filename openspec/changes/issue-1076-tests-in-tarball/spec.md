# Spec — #1076

- R1. `npm pack` contains no file for which `isTestInfraPath` is true (`*.test.mjs`, `__fixtures__`, `test-support`, `fixtures` dirs and four test-only helpers under `brain/scripts/`). Runtime `lib/tmp-tree.mjs` ships.
- R2. The exclusion is expressed as negated patterns in `package.json` `files`; no per-suite list.
- R3. `RETIRED_PATHS` includes every test-infrastructure path published tags v1.x shipped, from a generated module `brain/scripts/lib/retired-test-paths.mjs`; a test regenerates it from the tags and compares byte for byte.
- R4. Guard: each RETIRED_PATHS entry sits under a managed COPY glob; hand-kept entries are absent from brain; generated entries are test infrastructure and absent from the real packed tarball.
- R5. A retired path the consumer edited is removed and reported by name unless declared `local` (existing behaviour, pinned by a test).
- R6. `port-coverage.mjs` exits 1 with a message naming `contract.test.mjs` when the suite is absent.
- R7. `SIZE_CANARY_MB` is set from the measured post-change size.

Scenario: consumer on 1.12.1 runs its installed upgrader against this package: brain's test files under `brain/scripts` are removed, a consumer-owned `*.test.mjs` survives, `brain:repo:check` passes, a bare `node --test` finds nothing.
