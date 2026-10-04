# Release notes draft (#1186, #1187)

For the next release's guide text (not applied to `docs/adoption.md` here).

- `brain:check` and `brain:ship` now work on a fresh consumer's first PR with no manual step: no `git remote set-head`, no `GITHUB_REPOSITORY`, no `test` script, no session summary needed at the default `lite` tier.
- The local verdict is CI's verdict: each local check calls the same predicate as the CI gate it anticipates, at the same governance tier.
- `npm test` is reported as `[N/A]` unless you are in the brain source repo; it never fails a consumer's first PR.
- If the remote's default branch cannot be resolved (offline), `issueLink` is reported UNVERIFIED with the reason; export `DEFAULT_BRANCH` to override.
