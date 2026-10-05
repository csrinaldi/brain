# Proposal — issue #1277: upgrade harness uses the registry path

## Problem
`npm run test:upgrade` failed on main. The cause is a stale harness, not a product
regression: `test/upgrade/in-container.sh` installed `git+https://github.com/csrinaldi/brain.git`
and hardcoded `node_modules/brain/`, while the package is `@logikas/brain` (ADR-0030)
installed at `node_modules/@logikas/brain/`. A manual registry-path upgrade 1.10.1 -> 1.11.0
preserved custom config, `brain:*` verbs and a consumer-owned `brain:day:start`.

## Ruling (maintainer, option A)
Fix the harness to follow the documented consumer flow, and add an informational CI
workflow so it cannot rot silently again. The workflow is not a required check.

## Scope
- Rewrite `test/upgrade/in-container.sh` (registry install, `npx brain init`, `brain:env:init`).
- Add `.github/workflows/upgrade-smoke.yml` (informational).
- Non-goals: any change to `brain-upgrade.mjs`, GOVERNANCE_JOBS or branch protection.
