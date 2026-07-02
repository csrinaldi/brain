# Adopting brain

How to bring brain into a repository. There are **two materially different paths** —
a **new** (greenfield) repo and an **existing** repo with its own history. The
existing-repo path has extra reconciliation you must do *first* or brain's gates
will block your work the moment they activate.

> brain installs from a git **tag** (no registry; works with private repos —
> [ADR-0006](../brain/project/decisions/adr-0006-distribucion-installer-versionado.md)).
> Read the [CHANGELOG](../CHANGELOG.md) before upgrading — renames need manual action.

---

## The two-step mental model

1. **`brain:upgrade -- <tag>`** copies the *managed paths* (`brain/core/**`,
   `brain/scripts/**`, `.gitattributes`, the governance CI + PR template) and
   **merges** `.claude/settings.json` (your config is preserved, brain's hooks
   appended). It does **not** configure anything.
2. **`brain:env:init`** is the real onboarding: it creates `brain.config.json`, prompts
   for your `VCS_TOKEN`, wires the HTTPS credential helper and `core.hooksPath`,
   selects the SDD harness + memory backend, and fires the ADR-onboarding notice.

> **A bare `brain:upgrade` leaves the repo half-adopted** — files present, but no
> config, no token, no hooks, no ADR onboarding. `brain:env:init` is required, not optional.

---

## Path A — new / greenfield repo

```bash
# 0. If there is no package.json yet:
npm init -y

# 1. Install at a pinned tag (HTTPS):
npm i -D "git+https://github.com/csrinaldi/brain.git#v0.7.1"

# 2. Add the brain aliases to package.json "scripts":
#      "brain:upgrade": "node node_modules/brain/brain/scripts/brain-upgrade.mjs",
#      "brain:env:init": "bash ./brain/scripts/bootstrap.sh",
#      "brain:day:start": "node ./brain/scripts/day-start.mjs"

# 3. Copy the managed paths:
npm run brain:upgrade -- v0.7.1

# 4. Configure the environment (INTERACTIVE — paste a PAT with `repo` scope):
npm run brain:env:init

# 5. Draft the starter ADRs (in your AI agent):
#      /project:bootstrap-adrs   → Stack, Testing, Build (you sign each)
```

Then: `npm run brain:day:start` every morning, and follow the golden path
(`brain:start` → `check` → `save` → `ship`; `brain:next` tells you the next step).

That's it — a clean repo has nothing to reconcile.

---

## Path B — existing repo (the one with extra steps)

Same install + `brain:env:init` as Path A, **plus** you must reconcile pre-existing
state. The gates (`commit-msg`, `pre-commit`, `pre-push`, and the server-side
`pre-receive`) activate as soon as `core.hooksPath` is set — and they will refuse
to let you commit/push until the repo conforms. Do the checklist **before** you
wire the hooks, so nothing blindsides you.

### Reconcile-first checklist

- [ ] **Existing `openspec/` changes.** brain's structural gate (`check-refs` S-1)
      requires *every* active change in `openspec/changes/` to have both
      `proposal.md` **and** `tasks.md`. A change mid-planning (design done, tasks
      pending) **blocks every commit** — even your `brain.config.json`. Complete
      it, archive it (move under `openspec/changes/archive/`), or draft the
      missing artifact first.
- [ ] **Commit discipline.** The `commit-msg` hook requires Conventional Commits
      **and** a `#N` ticket reference on every non-machine commit. If your team
      doesn't already do this, adopting brain means adopting it. (Exempt:
      merge/revert/`chore(release)`/`chore(memory)`.)
- [ ] **Existing ADRs / decisions / designs / docs.** brain expects architectural
      records under `brain/project/decisions/` and knowledge under `brain/project/**`.
      Your existing docs are **not** migrated automatically — `project:bootstrap-adrs`
      drafts *new* starter ADRs and ignores what you already have. Today this
      migration is **manual**: move/map your records into brain's structure and
      link them from `brain/HOME.md` (run `npm run brain:nav` to catch orphans).
      *(Tooling to inventory + migrate existing docs is tracked in issue #121.)*
- [ ] **CI / PR template.** brain adds `.github/workflows/governance.yml` and a PR
      template. Reconcile/merge them with any you already have.

### Then

```bash
npm i -D "git+https://github.com/csrinaldi/brain.git#v0.7.1"
# add the aliases (see Path A step 2)
npm run brain:upgrade -- v0.7.1     # managed paths; .claude/settings.json is MERGED, not overwritten
npm run brain:env:init              # config + token + hooks + harness + memory
npm run brain:repo:check            # confirm the structural gate is green (fix the checklist items it flags)
npm run brain:audit -- <range>      # see where the repo's history diverges from the invariants (honest report)
```

`brain:audit` on an existing repo's history is usually *red* at first — large PRs,
no issue links, no captured memory. That's expected: it's a report card, not a
failure. It shows exactly what to adopt next.

---

## What `brain:env:init` actually does

`brain:env:init` (a.k.a. `bash brain/scripts/bootstrap.sh`) is **interactive** and:

- Creates `brain.config.json` (provider, gitHost, slug — derived from your git origin).
- Prompts for your **PAT** and stores it as `VCS_TOKEN` in `.env`
  (gitignored), then configures the HTTPS credential helper.
- Sets `core.hooksPath = brain/scripts/hooks` (git hooks are **per-clone** — each
  teammate runs `brain:env:init` once, or `brain:day:start`, which self-heals it).
- Selects the SDD harness and the memory backend; reports any ecosystem tools to install.
- Fires the **ADR-onboarding notice** when `brain/project/decisions/` is empty
  ([ADR-0013](../brain/project/decisions/adr-0013-auto-adr-onboarding.md)).

---

## Friction seen in real adoptions (so you're not surprised)

- **The structural gate blocks you over an unrelated pre-existing change.** The
  fix is the reconcile-first checklist above — handle existing `openspec/` work
  before wiring the hooks.
- **The PAT prompt needs a real TTY.** `brain:env:init` can't prompt for the token when
  run without a terminal (e.g. piped/non-interactive). Run it in a real terminal,
  or add `VCS_TOKEN=<pat>` to `.env` and re-run.
- **`brain:upgrade` alone is not adoption.** Always follow it with `brain:env:init`.
- **Managed scripts live under `brain/scripts/`** (since v0.7.0). The bootstrap
  entrypoint is `node_modules/brain/brain/scripts/brain-upgrade.mjs` (double
  `brain/` is intentional). Delete any orphaned root `scripts/` after upgrading
  from a pre-v0.7.0 layout — see the [CHANGELOG](../CHANGELOG.md).

---

## Reference

- [Workflow guide](workflow-guide.md) — how to run a feature end to end, both AI-assisted (Claude) and manually (npm verbs in sequence).
- [HOME.md](../brain/HOME.md) — the knowledge-base entry point.
- [ADR-0006](../brain/project/decisions/adr-0006-distribucion-installer-versionado.md) — distribution via git tags.
- [ADR-0013](../brain/project/decisions/adr-0013-auto-adr-onboarding.md) — ADR onboarding authority tiers (agent drafts, human signs).
- [Workflow governance](../brain/core/methodology/workflow-governance.md) — the four invariants and how they're enforced.
