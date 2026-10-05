# Design: commit-msg first-commit exemption (#1161)

## Decision
Extract `brain_repo_has_no_commit` into `brain/scripts/hooks/no-commit-yet.sh` (POSIX sh, sourced via `$(dirname "$0")`). `pre-commit` check 0 now calls it (behaviour unchanged, plus a fail-closed guard for "not a git repo"); `commit-msg` calls it before the ticket check, after format and attribution.

## Shipping
Hooks are installed with `core.hooksPath = brain/scripts/hooks` and shipped by the `brain/scripts/**` COPY glob in `brain/core/managed-paths.mjs`, so the helper travels with the hooks. A missing helper is guarded by `[ -f ]` (sourcing a missing file would abort a POSIX shell) and falls back to "no exemption".

## pre-receive (server side)
`pre-receive` refuses the same ticket-less first commit on the first push to an empty server: it validates `git rev-list <new> --not --all`, which is the whole history when the bare repo has no refs. So it has the same disagreement. It is NOT changed here: it is deliberately a single self-contained file (a bare repo receives exactly one file, so it cannot source the helper), it is byte-parity-pinned against commit-msg by `hooks.attribution-parity.test.mjs`, and the ticket scopes the fix to `commit-msg`. Follow-up recommended if a server-side hook is installed on a repository before its first push.
