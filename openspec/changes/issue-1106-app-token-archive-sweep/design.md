---
status: tasked
issue: 1106
---

# Design: App-token-authenticated archive sweep

## Context

`governance-postmerge.yml`'s `sweep` step (design of #557) archives closed change
folders and opens a PR with `gh pr create`, authenticated by the step's `env: GH_TOKEN:
${{ github.token }}`. This repository's Actions permission
(`can_approve_pull_request_reviews: false`,
`repos/{owner}/{repo}/actions/permissions/workflow` → Actions may not create PRs) refuses
the creation outright. Even on a repo that allows it, a `GITHUB_TOKEN`-authored PR
triggers no downstream workflow runs (GitHub's own recursion guard), so
`governance.yml` would never run on it and it could never merge.

## Decision

Two new steps precede `sweep`:

1. **`archive-app-secrets`** — maps `secrets.BRAIN_SWEEP_APP_ID` /
   `secrets.BRAIN_SWEEP_APP_PRIVATE_KEY` into its own `env:`, and reports
   `configured=true|false` via `$GITHUB_OUTPUT`. It never fails — a missing secret is a
   legitimate, reportable state, not an error.
2. **`archive-app-token`** — `if: steps.archive-app-secrets.outputs.configured ==
   'true'`. Uses `actions/create-github-app-token@<sha> # vX.Y.Z` to mint a
   short-lived installation token, output `token`.

Both are gated identically to `sweep` itself
(`steps.audit.outputs.code == '0' && steps.advance.outcome == 'success'`) — no reason to
mint a token on a run that never reaches the sweep.

`sweep`'s `env:` gains `APP_CONFIGURED` (from step 1's output) and `APP_TOKEN` (from step
2's output), alongside the untouched `VCS_TOKEN`/`GH_TOKEN` (still `github.token`, still
what the alarm path uses).

Inside the `sweep` script, after the existing archive/backlog/same-day logic
(unchanged), a new resolution decides which identity opens the PR:

```
app_available = (APP_CONFIGURED == 'true') AND (APP_TOKEN is non-empty)
```

- **`app_available`**: push authenticates with the App token (a per-invocation
  `-c http.extraheader=` Basic-auth header built from `x-access-token:<token>`, after
  stripping the checkout-persisted `GITHUB_TOKEN` extraheader so the two credentials
  never collide on the same request) and `gh pr create` runs with
  `GH_TOKEN="$APP_TOKEN"`. Any failure in this chain triggers the pre-existing orphan-branch
  cleanup + `governance:archive-sweep-failed` alarm (unchanged shape from #557).
- **not `app_available`**: archive + push with the default (`GITHUB_TOKEN`) credentials —
  this already works, `contents: write` covers a push — but `gh pr create` is never
  attempted. On a successful push, file the shared alarm with a compare link
  (`https://github.com/<repo>/compare/<default_branch>...<branch>`) and leave the branch
  in place. On a push failure, fall back to the existing cleanup+alarm path.

The two "unavailable" causes (secrets absent vs. mint failed) are distinguished only in
the alarm body text — the execution shape is identical, because both mean "no working App
identity to open a PR with," and the fix for a human reading either alarm is the same
(open the compare link, or configure the App).

## Why not swap the whole remote URL

An earlier draft considered `git remote set-url origin
https://x-access-token:<token>@github.com/<repo>.git`. Rejected: it would hardcode
`github.com` into a workflow tested against local bare-repo fixtures (this file's own test
harness, `runStepIsolated`), forcing every test to either hit the network or fake DNS. The
`-c http.extraheader=` form only affects HTTP(S) transport — a no-op against a local path
remote — so the exact same script runs correctly against a sandboxed bare repo in tests
and against the real `origin` in production.

## Why the extraheader is stripped first

`actions/checkout` persists a repo-scoped `http.https://github.com/.extraheader` carrying
the job's own `GITHUB_TOKEN`. Pushing with an ADDITIONAL `-c http.extraheader=` for the
same host sends two `Authorization` headers, which GitHub's HTTP endpoint rejects. The
unset is scoped to `--local` (this checkout only) and defensively swallowed
(`|| true`) since it is a no-op — not a failure — everywhere the persisted header does
not exist (every isolated test, and any future non-GitHub host).

## Consumer impact (managed workflow)

`governance-postmerge.yml` is `STRATEGY.REFUSE` on upgrade (a consumer's own edits are
never silently overwritten) but ships as-is to a fresh adopter. A consumer who has not
created the `BRAIN_SWEEP_APP_ID` / `BRAIN_SWEEP_APP_PRIVATE_KEY` secrets gets the
degraded-but-correct path forever: their sweep archives and pushes, never crashes, and
tells them exactly what to configure via the alarm body. Setting up the App is optional,
not required for the sweep to behave safely.

## Rejected: continuing to call `gh pr create` with `GITHUB_TOKEN` as a last resort

Rejected outright — that is the exact defect #1106 reports. It is refused unconditionally
in both the "not configured" and "mint failed" branches; there is no code path in this
design where `gh pr create` runs without a verified non-empty `APP_TOKEN`.
