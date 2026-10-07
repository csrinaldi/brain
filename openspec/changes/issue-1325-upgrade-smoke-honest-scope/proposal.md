# Proposal — upgrade-smoke tests published releases honestly (#1325)

## Problem
`upgrade-smoke` (#1277) runs on PRs touching `brain/scripts/**`, but it installs FROM and TO from the
registry, so a PR's own upgrader is never executed: the trigger implied coverage it did not provide.
It also claimed "managed core moved" while asserting only the installed version, failed on
tagged-but-unpublished releases, and swallowed `brain:env:init` / `brain:upgrade` exit codes.

## Scope
- Narrow `pull_request.paths` to `test/upgrade/**` and the workflow; state "published releases only".
- SKIP (exit 0, named notice) when FROM or TO is not on the registry; a non-404 `npm view` failure is an error.
- Assert managed files really moved to TO's content.
- Propagate exit codes (`pipefail`, env:init log on failure).

## Out of scope
Testing a PR's own upgrader against a packed tarball (separate decision).
