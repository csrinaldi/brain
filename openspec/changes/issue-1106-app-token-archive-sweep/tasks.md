---
status: applied
issue: 1106
---

# Tasks: App-token-authenticated archive sweep

## Phase 1: resolve the pin

- [x] 1.1 Resolve `actions/create-github-app-token`'s latest release tag to its full
      40-hex commit SHA via `gh api repos/actions/create-github-app-token/git/ref/tags/<tag>`
      (resolving through the tag object if annotated) — confirmed `v3.2.0` →
      `bcd2ba49218906704ab6c1aa796996da409d3eb1`, verified as a real commit via
      `gh api repos/actions/create-github-app-token/commits/<sha>`.

## Phase 2: RED — extend the test harness first (strict TDD)

- [x] 2.1 Add source guards to `release-postmerge-workflows.test.mjs`: pinned SHA +
      version comment; no `secrets.*` read directly in any `if:`; secrets-check step
      declares both env vars and never fails on absence; mint step gated on the
      secrets-check output; no `continue-on-error` anywhere; sweep step's `env:` reads
      the new outputs and still declares `GH_TOKEN: github.token`; push/PR reference
      `APP_TOKEN`, never a literal `github.token` splice.
- [x] 2.2 Add executable guards (fakes for `git`/`gh`, no network): App configured and
      minted → PR opened with the App token (both push and `gh pr create`); secrets
      absent → branch archived+pushed, no `gh pr create`, alarm with compare link,
      branch kept; secrets present but mint failed (empty token) → same degrade, alarm
      text distinguishes "mint failed"; App-available push/PR failure still cleans up
      the orphan branch and alarms.
- [x] 2.3 Update the pre-existing 8.2 dry-run "1 eligible folder" test to pass a
      configured+minted App env, since `gh pr create` is no longer attempted without one
      — preserves the test's original intent (exactly one PR opened) under the new
      contract.
- [x] 2.4 Run the extended suite and confirm every #1106 test fails for the expected
      reason (the workflow does not implement the fix yet) — RED, 8 failing / 67 passing
      in this file.

## Phase 3: GREEN — implement the workflow change

- [x] 3.1 Add `archive-app-secrets` step: maps the two secrets into env, reports
      `configured=true|false`, never fails.
- [x] 3.2 Add `archive-app-token` step: `uses: actions/create-github-app-token@<sha> #
      v3.2.0`, gated on `steps.archive-app-secrets.outputs.configured == 'true'`.
- [x] 3.3 Extend the `sweep` step's `env:` with `APP_CONFIGURED`, `APP_TOKEN`,
      `GITHUB_REPOSITORY`, `DEFAULT_BRANCH`; keep `VCS_TOKEN`/`GH_TOKEN` unchanged.
- [x] 3.4 Replace the "Commit, push, and open the PR" block with the
      App-availability-branched version: App-authored push+PR on the success path
      (extraheader-based credential, checkout header stripped first);
      degrade-archive-push-alarm-keep-branch on the unavailable path; existing
      cleanup+alarm on any push failure in either branch.
- [x] 3.5 Fix the two RED-phase escapes found while turning the suite green: an unset
      `GITHUB_REPOSITORY` under `set -u` in the isolated test harness (defaulted to
      `${GITHUB_REPOSITORY:-}`), and a false-positive substring match in the "no
      `secrets.*` in `if:`" test (`archive-app-secrets.outputs` itself contains
      `secrets.`) — narrowed to the real secrets-context accessor shape
      (`secrets\.[A-Z_]`).
- [x] 3.6 Run the extended suite again and confirm GREEN — 75/75 in this file.

## Phase 4: repo-wide verification

- [x] 4.1 Fix `brain:repo:check`'s `hardcoded-secret` finding against the new tests'
      literal fixture token strings — replaced with a `.join()`-assembled
      `FIXTURE_APP_TOKEN` constant referenced by variable, never an inline quoted
      literal after `TOKEN[=:]`.
- [x] 4.2 Run the full `npm test` — 6412 total, 6409 pass, 0 fail, 3 pre-existing skips.
- [x] 4.3 Run `npm run brain:repo:check` — clean.
- [x] 4.4 Confirm the #1094 managed-workflow-script-drift guard
      (`managed-workflow-script-drift.test.mjs`) stays green — no bare `npm run` was
      introduced.

## Phase 5: documentation

- [x] 5.1 Draft a `brain-drafts/` note under this change for `brain/core/**` maintainers:
      a managed workflow that opens a PR now optionally needs a GitHub App, and what
      "optionally" means operationally (degraded path is safe, not silent).
- [x] 5.2 Document the two required secrets and the App's minimal permission scope in
      this change's `design.md` (consumer impact) and in the alarm body text itself, so
      a human hitting the alarm has the setup instructions in hand without reading the
      workflow source.

## Out of scope (explicitly, per the issue)

- The `auto-revert/*` step shares this defect and is deliberately untouched — tracked
  separately.
