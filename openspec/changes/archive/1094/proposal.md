---
status: draft
issue: 1094
---

# Proposal — the shipped workflow runs a script the installer never ships

## What was wrong

`MANAGED_SCRIPT_KEYS` (`brain/core/managed-paths.mjs:41`) injects `brain:repo:check` into a
consumer's `package.json` on `brain:upgrade`. Two MANAGED workflows called the bare alias
instead:

1. `.github/workflows/governance.yml:128` — `run: npm run repo:check`
2. `brain/scripts/ci/gitlab-governance.yml:140` — `- npm run repo:check && npm run brain:nav && …`

Both files are `STRATEGY.REFUSE` managed literals (`managed-paths.mjs:81-82`, `managedStrategy`
rows at 184/190), so both travel to every consumer via `brain:upgrade`. brain's own
`package.json` still defines `repo:check` as a repo-only legacy alias (`#961 R4`), so the gate
stayed green **here** forever — the bare name resolves locally. A fresh consumer never gets that
alias (only `brain:`-namespaced keys are injected), so their first PR hits `npm error Missing
script: "repo:check"` on a REQUIRED governance job.

`.github/workflows/m4-danger-paths.yml:70` also calls a bare unmanaged script
(`test:danger-paths`), but that workflow is not in `managed` — it never reaches a consumer — so
it is out of scope here.

## Why this went undetected

`#922` built a doctrine-prose reconciliation (`managed-script-keys-doctrine.test.mjs`): every
`brain:`/`memory:` script a `.md`/`.mjs` doctrine file tells an agent to `npm run` must be in
`MANAGED_SCRIPT_KEYS`. Workflow YAML is a second surface that names scripts, and it was never
covered by that guard or any other — a `run:`/GitLab-script-list invocation is not doctrine
prose, so #922's walk never saw it.

## The fix

**Part 1** — rename both call sites to `brain:repo:check`, the canonical `brain:`-namespaced verb
since `#961`. This is the smaller, correct claim: `MANAGED_SCRIPT_KEYS` already ships the
`brain:` verb; the workflows just called the wrong (repo-only) alias. Do NOT add bare
`repo:check` to `MANAGED_SCRIPT_KEYS` — that would ship the deprecated alias to every consumer
in addition to the canonical one, re-legitimizing exactly the name `#961` retired.

**Part 2** — a drift guard, `managed-workflow-script-drift.test.mjs`, closing the class `#922`
missed: every `npm run <script>` invocation in every MANAGED workflow must resolve to a
`MANAGED_SCRIPT_KEYS` entry. Discovery reads `managed` (`brain/core/managed-paths.mjs`)
directly — literal entries as-is, glob entries expanded against the filesystem — so a future
managed workflow is covered automatically, with no second file list to remember to update.
