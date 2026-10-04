# Design: local gates equal CI gates (#1186, #1187)

## Root causes
- `brain/scripts/brain-check.mjs` (pre-fix): `govCtx = { body, targetBranch, defaultBranch }` never set `repo`/`provider`, so `run-check.mjs#defaultFetchIssue` called `issueView({ project: ctx.repo })` with `undefined`. The default branch was read only from `symbolic-ref refs/remotes/origin/HEAD`.
- `brain-check.mjs` called `runCheck` (raw evaluation). CI's `run-check.mjs#main` calls `mapDetectionToWarning` (#603); `GATE_MATRIX['memory-gate'].lite` is `detection`.
- `brain-check.mjs` spawned `npm test` unconditionally; `.github/workflows/governance.yml` `local-checks` runs it `if: hashFiles('.brain-source') != ''`.

## Changes
- `governance/run-check.mjs`: new export `runCheckWithPolicy`; `main()` calls it (behavior unchanged).
- `lib/local-gate-context.mjs` (new): `resolveProjectSlug`, `resolveDefaultBranch`, `npmTestApplicability`. Reuses `vcs/lib/repo.mjs#originIdentity`, `postmerge/git-seam.mjs#gitTry`, `postmerge/cursor.mjs#resolveDefaultBranch`.
- `brain-check.mjs`: takes `config` (tier, slug, approved label come from it, like CI's `readConfig`), `getVcs`, `identity`, `npmTestApplicability`; exports `CI_COUNTERPART`; the diff base uses the resolved default branch; the UNVERIFIED remedy prints the check's own reason.
- `brain-ship.mjs`: PR base uses the shared default-branch resolver.
- `lib/hermetic-box.mjs` (new): the hermetic PATH/HOME/shim box extracted from `bootstrap.e2e.test.mjs`, which now imports it; the new e2e reuses it.

## Parity
`local-ci-parity.test.mjs` compares, per tier x fixture x check, the local state (pass / fail / unverified) against CI's real `main()` exit (0 / 1 / 2), plus a guard that every local check has a `CI_COUNTERPART`.
