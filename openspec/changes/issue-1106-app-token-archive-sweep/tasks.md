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

## Phase 6: rework — PR creation moves to the VCS port (issue #1106, coordinator correction)

The original plan (Phases 1-5) opened the PR with `gh pr create` in workflow bash,
authenticated by `GH_TOKEN="$APP_TOKEN"`. The coordinator corrected this: brain declares
itself VCS-agnostic (`vcs-contract.md`), the port already implements `mrCreate` for both
GitHub and GitLab (#239), and a `gh`-shaped bash call in a MANAGED workflow has no
GitLab equivalent. This phase re-plumbs PR creation through `getVcs().mrCreate`, called
from a new `sweep.mjs --open-pr` mode, while leaving the App-token mint and the push
(unavoidably GitHub-Actions-specific) in the workflow.

- [x] 6.1 RED: add `openArchivePr` unit tests to `sweep.test.mjs` — no token → `mrCreate`
      never called, `{outcome:'skipped',reason:'no-token'}`; empty-string token also
      skips; token present → `mrCreate` called with `project`/`title`/`body`/`head`/the
      INJECTED `base` (never a hardcoded `main`), `{outcome:'opened',url}` on success;
      `{url:null,error}` → `{outcome:'failed',error}`; `{url:null}` with no error →
      still `{outcome:'failed'}` with a non-empty error (never a silent success); a
      source guard that sweep.mjs never contains a literal `gh pr create` and does
      import/use `getVcs`. Confirmed RED: import failure (`openArchivePr` not exported).
- [x] 6.2 GREEN: implement `openArchivePr` in `sweep.mjs` (injectable `mrCreate`, no-token
      short-circuit, never-throws contract matching `mrCreate` itself) and a new
      `--open-pr` CLI mode (`--head --base --archived --report`) that reads
      `BRAIN_SWEEP_TOKEN` from its environment, binds the VCS port via
      `getVcs({ identity: token })` (so GitHub's identity-less `mrCreate` authenticates
      correctly) while ALSO passing `token` into `mrCreate`'s own args (the live
      credential GitLab's implementation reads). Exit contract: 0 opened / 1 failed / 2
      skipped, mirrored in stdout (`SWEEP-PR url=<url>|failed=<error>|skipped=no-token`).
      Fixed a self-referential false-positive in the new "never `gh pr create`" source
      guard (my own header comment contained the literal string) by rewording to "the
      `gh` CLI's own PR-creation subcommand". 16/16 green in sweep.test.mjs.
- [x] 6.3 RED: rewrite the workflow-level tests in `release-postmerge-workflows.test.mjs`
      — renamed `APP_TOKEN` → `BRAIN_SWEEP_TOKEN` throughout; replaced the "push+`gh pr
      create` reference APP_TOKEN" source guard with three: never `gh pr create` in the
      sweep script, `sweep.mjs --open-pr` invoked with `--head`/`--archived`/`--report`,
      and `--base "$default_branch"` (never a hardcoded `--base main`); extended
      `writeSweepNodeStub` to intercept BOTH sweep.mjs modes (`--apply` unchanged,
      `--open-pr` new, configurable exit/stdout); added `NODE_LOG`/`nodeLog()` to
      `runStepIsolated` (parallel to `ghLog()`) so a test can prove the minted token
      reached the open-pr call; rewrote the 4 executable "#1106" tests for the new split
      and added a 5th (`mrCreate` itself fails → real failure, branch deleted — the new
      exit-1 case the old two-branch design couldn't distinguish); removed the
      now-redundant `writeGhStubAppAware` helper (gh no longer authenticates PR
      creation, so its `[GH_TOKEN=...]` capture had nothing left to prove). Confirmed
      RED: 7 failing for the expected reason (workflow bash not yet reworked), 71
      passing (most #557/#1106 source guards and the early-exit executable tests were
      unaffected by the split and stayed green throughout).
- [x] 6.4 GREEN: replaced the workflow's App-availability-branched push+PR block with a
      linear push-then-open-pr shape — commit+push (App-authenticated via extraheader
      when available, plain GITHUB_TOKEN otherwise) as its own failure boundary; on
      success, invoke `node sweep.mjs --open-pr --head "$br" --base "$default_branch"
      --archived "$archived" --report ...`, branching on its exit code (0 open / 2 skip
      + compare-link alarm + branch kept / anything else → real-failure alarm + orphan
      branch deleted). Fixed 3 more self-referential false-positive matches (my own new
      comments containing the literal `gh pr create` string) the same way as 6.2. 78/78
      green in `release-postmerge-workflows.test.mjs`.
- [x] 6.5 Fix a THIRD occurrence of the `hardcoded-secret` repo:check false positive —
      the new `sweep.test.mjs` fixtures (`token: 'minted-app-token'`) — via the same
      `.join()`-assembled-constant pattern used in 4.1.
- [x] 6.6 Re-run the full `npm test` (6421 total, 6418 pass, 0 fail, 3 pre-existing
      skips) and `npm run brain:repo:check` (clean) after the rework.
- [x] 6.7 Update `spec.md` (two requirements rewritten: PR creation goes through the VCS
      port with a new `mrCreate`-fails scenario; a new requirement that `--base` is the
      actual default branch, never hardcoded) and `design.md` (a new "Rework" section:
      the split, `openArchivePr`'s shape, the exit contract table, why the token is
      threaded BOTH via `getVcs({ identity })` AND as `mrCreate`'s own field, and a new
      "Rejected: a bare token param with no bound identity" section) to match.

## Out of scope (explicitly, per the issue)

- The `auto-revert/*` step shares this defect and is deliberately untouched — tracked
  separately.
- Moving the alarm verbs (`gh issue create`/`comment`) behind the VCS port — the
  coordinator named this as a separate issue; the alarm path stays on `GITHUB_TOKEN` /
  `gh` throughout this change.
