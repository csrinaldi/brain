---
status: draft
issue: 1094
---

# Spec

## REQ-1094-1 — the two call sites run the canonical verb
`.github/workflows/governance.yml`'s `local-checks` job and
`brain/scripts/ci/gitlab-governance.yml`'s `local-checks` job MUST invoke `npm run
brain:repo:check`, never the bare `repo:check` alias.
**Falsifiable by**: `rg 'npm run repo:check' .github/workflows/governance.yml
brain/scripts/ci/gitlab-governance.yml` returns a match.

## REQ-1094-2 — the bare alias is not promoted into MANAGED_SCRIPT_KEYS
`repo:check` (bare) MUST NOT appear in `MANAGED_SCRIPT_KEYS`
(`brain/core/managed-paths.mjs`).
**Falsifiable by**: `MANAGED_SCRIPT_KEYS.includes('repo:check')` is `true`.

## REQ-1094-3 — every managed workflow's `npm run` invocations are guarded
A test MUST assert that every `npm run <script>` invocation found in every workflow file
`managed` (`brain/core/managed-paths.mjs`) ships resolves to a `MANAGED_SCRIPT_KEYS` entry, with
one named exception for the `npm test` shorthand.
**Falsifiable by**: reverting REQ-1094-1 (restoring either bare `repo:check` call site) makes
`node --test brain/scripts/lib/managed-workflow-script-drift.test.mjs` fail.

## REQ-1094-4 — discovery is data-driven, not a hardcoded file list
The guard MUST determine which workflow files to scan by reading `managed`
(`brain/core/managed-paths.mjs`) — literal entries directly, glob entries (e.g.
`brain/scripts/**`) expanded against the real filesystem — not from a hardcoded array of
filenames written into the test.
**Falsifiable by**: adding a new literal `.yml`/`.yaml` entry to `managed` with an unmanaged
`npm run <verb>` script inside it, and the guard still passing without any edit to the test
file itself.

## REQ-1094-5 — both YAML invocation shapes are recognized
The guard MUST parse both `run: npm run X` (GitHub, single command per step) and GitLab's
chained shell-list form (`- npm run X && npm run Y && …`) on one line.
**Falsifiable by**: an unmanaged script named only inside a GitLab chained line (not the first
command) goes unflagged.

## REQ-1094-6 — `npm test` is an explicit, named allowance
The guard MUST NOT flag the `npm test` invocation (no `run` keyword) as drift, and that
allowance MUST be a named, documented constant in the guard's source — not an incidental gap in
the matching regex.
**Falsifiable by**: the guard's source has no identifier documenting why `npm test` is exempt,
or removing that exemption does not make the guard fail on `npm test`.

## REQ-1094-7 — the failure message is actionable
A violation MUST name the offending file path, the line number, and the offending script name in
the assertion failure.
**Falsifiable by**: introducing a fresh unmanaged `npm run <verb>` call in a managed workflow
produces a failure message that omits the file, the line, or the script name.

## REQ-1094-8 — `m4-danger-paths.yml` stays out of scope
The guard MUST NOT scan `.github/workflows/m4-danger-paths.yml` (it calls the unmanaged
`test:danger-paths`, but the workflow itself is not a `managed` path).
**Falsifiable by**: `discoverManagedWorkflowFiles()` (or equivalent) includes
`.github/workflows/m4-danger-paths.yml` in its result.
