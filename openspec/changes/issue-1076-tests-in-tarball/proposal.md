# Proposal — #1076: stop shipping test infrastructure in the tarball

## Problem
`brain/scripts/**` is a managed COPY glob, so the package carries every vendored suite: 10.4 MiB / 933 files unpacked, 6.3 MiB of it `*.test.mjs`. The exploration (explore.md) found no consumer path that runs a brain suite (install, `brain:upgrade`, `brain:check`, hooks, CI templates). The allowlist comment claiming otherwise is false, and the size canary has been raised a dozen times for test growth.

## Maintainer rulings (2026-10-07, binding)
1. Ship no test infrastructure: negated `files` patterns, so new suites are excluded automatically.
2. Prune stale copies on `brain:upgrade`, as DATA in `RETIRED_PATHS` (the consumer's installed, older upgrader reads only that export from the incoming package; #1344).
3. The RETIRED_PATHS guard becomes "excluded by `files` and absent from the packed tarball" for these entries.
4. `port-coverage.mjs` stays; refuses clearly without `contract.test.mjs`.
5. Lower `SIZE_CANARY_MB` to ~10% above the measurement.
6. A consumer smoke suite is out of scope.

## Out of scope
What the brain repo itself tests; a consumer-side smoke suite; version bump (release cut is separate).
