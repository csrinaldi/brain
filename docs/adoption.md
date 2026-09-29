# Adopting brain

brain installs from the npm registry as **`@logikas/brain`**
([ADR-0030](../brain/project/decisions/adr-0030-distribution-scoped-registry-package.md)).
No token and no repository access are needed to install it — only to configure it
afterward.

There are two paths: a **new** repository (nothing to reconcile) and an **existing**
repository (extra steps before the gates activate). Read your path fully before running
anything — several steps below exist only because a real adoption hit them
([#1081](https://github.com/csrinaldi/brain/issues/1081)).

---

## Quick path — new repository

```bash
# 0. If there is no package.json yet:
npm init -y

# 1. Ignore the files brain is about to create, BEFORE anything writes a secret.
#    brain does not yet do this for you (#1112) — do it first, every time.
printf '.env\nnode_modules/\n' >> .gitignore

# 2. Install brain:
npm i -D @logikas/brain

# 3. Write the bootstrap alias and copy the managed paths:
npx brain init

# 4. Configure the environment (interactive — see "What env:init asks" below):
npm run brain:env:init

# 5. Make the adoption commit (see "The first commit" below — read it before
#    you run this):
git add -A && git commit -m "chore: adopt brain" --no-verify
```

Then: `npm run brain:day:start` every morning, and follow the golden path
(`brain:start` → `brain:check` → `brain:ship`; `brain:next` tells you the next step).

Behind a mirror, firewall, or air-gapped registry? The git URL installs the same
allowlisted bytes into the same directory
([ADR-0030 Amendment 1](../brain/project/decisions/adr-0030-distribution-scoped-registry-package.md)):

```bash
npm i -D "git+https://github.com/csrinaldi/brain.git#v1.8.0"
```

---

## Existing repository — the one with extra steps

Same install as above, **plus** you must reconcile pre-existing state before the git
hooks (`core.hooksPath`, wired by `env:init`) start refusing commits that don't conform.

- [ ] **Existing `openspec/` changes.** `brain:repo:check` requires every active
      change under `openspec/changes/` to carry `proposal.md`, `spec.md`, `design.md`
      and `tasks.md`. Finish, archive, or draft the missing artifacts first — this
      gate blocks every commit, including your own adoption commit.
- [ ] **Commit discipline.** The commit-msg hook requires Conventional Commits and a
      `#N` issue reference on every non-machine commit. If your team doesn't already
      do this, adopting brain means adopting it too.
- [ ] **Existing ADRs / docs.** brain expects decisions under `brain/project/decisions/`
      and project knowledge under `brain/project/`. Nothing migrates your existing
      docs automatically — run `npm run brain:nav` after moving them in, to catch
      orphaned links.
- [ ] **CI / PR template.** brain adds `.github/workflows/governance.yml` (or the
      GitLab fragment) and a PR/MR template. Reconcile with anything you already have.

**Your agent platform default does not change on upgrade.** `env:init` has always
written whatever it resolved back into `.env`. If you have ever run `env:init` before
(even on an older brain version), your `.env` already has `AGENT_PLATFORM=antigravity`
recorded explicitly, and an existing, non-empty `.env` value is never rewritten — you
keep `antigravity`, not the new-consumer `claude` default. Only a repository with no
`AGENT_PLATFORM` in `.env` yet (a brand-new install) resolves and persists `claude` the
first time `env:init` runs.

Then run the same five steps as the quick path above, and once `env:init` finishes:

```bash
npm run brain:repo:check        # confirm the structural gate is green
npm run brain:audit -- <range>  # a report card on this repo's history — expect it red at first
```

`brain:audit` red on an existing repo's history is normal: large PRs, no issue links,
no captured memory. It's a report, not a failure — it tells you what to adopt next.

---

## What `npx brain init` and `npm run brain:env:init` actually do

| Step | Verb | What it does | Interactive? |
|---|---|---|---|
| 1 | `npx brain init [tag]` | Writes the one script alias the upgrade cannot inject itself (`brain:upgrade`), then runs it: copies every managed path (`brain/core/**`, `brain/scripts/**`, the governance CI, the PR template, `.gitattributes`) and merges the rest of the `brain:*` script aliases into your `package.json`. Reads the tag from the version you installed; never guesses one. | No — safe for CI and scripted adoption. |
| 2 | `npm run brain:env:init` | Creates `brain.config.json` if missing (derives `vcs.provider`, `gitHost`, `slug` from your git origin), prompts for a VCS token and writes it to `.env`, sets `core.hooksPath`, resolves the agent platform and SDD engine, sets up the memory backend, prints the governance tier it set, and reports the open tickets on your tracker. | Yes — needs a real TTY for the token prompt. |

A bare `npx brain init` leaves the repo half-adopted: files present, nothing
configured, no hooks, no token. `env:init` is required, not optional.

### Choices `env:init` makes for you (and how to change them)

| Axis | Default for a new repo | Where it's declared | How to change it |
|---|---|---|---|
| Governance tier | `lite` — no second approver required to merge ([ADR-0026 Amendment 8](../brain/project/decisions/adr-0026-governance-doctrine-tiers.md)) | `governance.tier` in `brain.config.json` | `npm run brain:config -- set governance.tier standard`, then `npm run brain:protect` |
| Agent platform | `claude` ([ADR-0024 Amendment 2](../brain/project/decisions/adr-0024-three-axis-decoupling.md)); `antigravity` is the second supported platform | `AGENT_PLATFORM` in `.env` | set `AGENT_PLATFORM=antigravity` in `.env` before running `env:init`, or export it for one run: `AGENT_PLATFORM=antigravity npm run brain:env:init` |
| Memory backend | `engram` (prompted; `plainfiles` is the other supported value) | `MEMORY_BACKEND` in `.env` | answer the prompt, or set `MEMORY_BACKEND=plainfiles` in `.env` first |
| VCS provider | derived from your git origin, confirmable on a TTY | `vcs.provider` in `brain.config.json` (tracked) | type `github` or `gitlab` at the prompt |

**On the VCS provider prompt: type exactly `github` or `gitlab`.** `env:init` does not
yet validate this field (`#1112`) — anything else you type is written verbatim into the
tracked `brain.config.json`, and downstream tooling that switches on the provider
silently falls through to a `gitlab`-shaped default.

**`project.name` stays empty after `env:init`.** Only `project.slug` is filled from your
git origin; `project.name` is a known gap (`#1112`). If you use the `engram` memory
backend, set it by hand in `brain.config.json` before your first `brain:memory:index`
run — indexing silently fails per file otherwise (each failure is logged, but the run
still reports overall success).

---

## The first commit — no supported path exists yet

Once `core.hooksPath` is set, the pre-commit hook refuses any commit directly on
`main`/`master`. In a brand-new repository, your adoption commit (`brain.config.json`,
the copied managed paths, `.gitignore`) is necessarily the first commit on `main` —
there is nothing to branch from yet.

**There is no documented, supported way to make that commit today.** The only
guidance is the hook's own bypass hint: `git commit --no-verify`. That is a real
escape hatch, not a blessed workflow — it skips `repo:check` along with the branch
check, so verify `npm run brain:repo:check` is green yourself before pushing. This gap
is tracked as `#1112` (item 4); the guide will document a real bootstrap step once it
ships. Don't invent your own workaround beyond this — if `--no-verify` doesn't fit
your workflow, wait for `#1112` or comment on it.

---

## The archive sweep's automation identity

brain's post-merge archive sweep (closed changes move under `openspec/changes/archive/`
automatically) opens its own pull request. On GitHub, the workflow's own
`GITHUB_TOKEN` cannot create PRs and, even where it could, a PR opened with it would
trigger no required checks and could never merge (`#1106`, fixed). The sweep instead
mints a short-lived token from a **GitHub App installation**, read from two repository
secrets:

- `BRAIN_SWEEP_APP_ID`
- `BRAIN_SWEEP_APP_PRIVATE_KEY`

**Setting these up is a manual, one-time admin step today** — there is no `brain:*`
verb that provisions or verifies this identity yet (`#1107` is the open issue that
would add one, in the `brain:protect` family). Until then:

1. Create a GitHub App scoped to this repository only, with **Contents: read/write**
   and **Pull requests: read/write** permissions.
2. Install it on this repository.
3. Add its App ID and private key as the two repository secrets named above.

**If you skip this**, the sweep degrades explicitly: it still pushes the archive
branch, but instead of opening a PR it files an alarm issue with a compare link you
can open by hand. It never falls back to `GITHUB_TOKEN` and never fails silently.

GitLab has no archive-sweep workflow yet — this section is GitHub-only.

---

## `brain:protect`

A repo admin runs this **once**, after the first `env:init` (and again any time you
change `governance.tier`):

```bash
npm run brain:protect
```

It activates branch protection on `main` for the tier your config declares —
required status checks, and, above `lite`, a required approving review. It is
idempotent and requires repo-admin permissions. See
[Workflow governance](../brain/core/methodology/workflow-governance.md) for what
each tier requires and how to recover if protection locks you out.

---

## Upgrading

```bash
npm run brain:upgrade -- v1.8.0             # install a newer tag, copy managed paths
npm run brain:upgrade -- v1.8.0 --dry-run   # preview what would change
```

Read the [CHANGELOG](../CHANGELOG.md) first — renames and breaking changes need
manual action. Additive `brain.config.json` migrations apply automatically; your
own values in `brain/project/**`, `brain.config.json`, `.env`, `openspec/changes/**`
and `.memory/**` are never touched. `brain:day:start` checks for a newer tag every
morning and never auto-updates.

---

## When a step fails

- **`env:init` reports most step failures inline** (a `⚠` line naming the step) and
  keeps going rather than aborting the whole run — it's safe to re-run. At the end it
  lists everything that needs attention under "pending" with the command to fix it.
- **A failure reported this way is a real failure, not noise** — except where a known
  gap says otherwise (see `project.name` / doctrine indexing above, `#1112`). Don't
  assume a run that printed no red text actually finished every step; check the
  summary at the end.
- **`brain:upgrade` failures roll back the managed-path copy** to its pre-upgrade
  bytes wherever possible, and print where the snapshot is if it can't finish the
  rollback itself. See `docs/KNOWN-LIMITATIONS.md` for what's not yet covered.
- **Still stuck?** Open an issue against `csrinaldi/brain` with the exact command and
  its output — the defects in this guide were all found and fixed (or are being
  fixed) that way.

---

## Reference

- [Known limitations](KNOWN-LIMITATIONS.md) — open defects on the consumer path,
  each with a workaround if one exists.
- [Definition of done](definition-of-done.md) — what "done" means for brain 2.0.
- [Workflow guide](workflow-guide.md) — running a feature end to end.
- [HOME.md](../brain/HOME.md) — the knowledge-base entry point.
- [ADR-0030](../brain/project/decisions/adr-0030-distribution-scoped-registry-package.md) — distribution via the npm registry.
- [ADR-0026](../brain/project/decisions/adr-0026-governance-doctrine-tiers.md) — governance tiers, `lite` default for new consumers (Amendment 8).
- [ADR-0024](../brain/project/decisions/adr-0024-three-axis-decoupling.md) — agent platform, memory backend and VCS provider as independent axes; `claude` default (Amendment 2).
- [ADR-0036](../brain/project/decisions/adr-0036-a-change-is-done-when-it-works-on-a-fresh-consumer-install.md) — why this guide exists and what "done" means for it.
- [Workflow governance](../brain/core/methodology/workflow-governance.md) — the four invariants and how they're enforced.
