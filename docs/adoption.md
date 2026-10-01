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

# 1. Ignore node_modules/. env:init git-ignores .env itself, before it writes a
#    token, but it never touches node_modules/.
printf 'node_modules/\n' >> .gitignore

# 2. Install brain:
npm i -D @logikas/brain

# 3. Write the bootstrap alias and copy the managed paths:
npx brain init

# 4. Configure the environment (interactive — see "What env:init asks" below):
npm run brain:env:init

# 5. Make the adoption commit (see "The first commit" below):
git add -A && git commit -m "chore: adopt brain"
```

Then: `npm run brain:day:start` every morning, and follow the golden path
(`brain:start` → `brain:check` → `brain:ship`; `brain:next` tells you the next step).

Behind a mirror, firewall, or air-gapped registry? The git URL installs the same
allowlisted bytes into the same directory
([ADR-0030 Amendment 1](../brain/project/decisions/adr-0030-distribution-scoped-registry-package.md)):

```bash
npm i -D "git+https://github.com/csrinaldi/brain.git#v1.10.1"
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
| 2 | `npm run brain:env:init` | Creates `brain.config.json` if missing (derives `vcs.provider`, `gitHost`, `slug` from your git origin), git-ignores `.env`, prompts for a VCS token and writes it to `.env` (refusing an unsafe `.env`, see below), sets `core.hooksPath`, resolves the agent platform and SDD engine, **creates the governance labels, resolves `brain.actor`**, declares and sets up the memory backend, prints the governance tier it set and **whether the memory lane is on**, and reports the open tickets on your tracker. Ends with a summary that separates required failures (exit 1) from optional next steps (exit 0). | Yes — needs a real TTY for the token prompt. |

A bare `npx brain init` leaves the repo half-adopted: files present, nothing
configured, no hooks, no token. `env:init` is required, not optional.

### `.env` and your token

`env:init` checks `git check-ignore .env` and, when nothing ignores it, appends `.env` to
`.gitignore` (creating the file if needed). A pattern you already have is respected. It
does **not** add `node_modules/`.

It **refuses to write the token** into a `.env` that:

| `.env` is | Fix |
|---|---|
| tracked by git | `git rm --cached .env`, then re-run (git never reports a tracked file as ignored) |
| a symlink | replace it with a regular file |
| hardlinked, or not a regular file | replace it with a regular file |
| not confirmed as git-ignored | fix your `.gitignore` so `git check-ignore .env` succeeds |

A refusal names the fix and is a **required failure**: `env:init` exits 1.

### What the `env:init` summary tells you

`env:init` ends with a summary in two parts, and its exit code follows them.

| Result | Exit | What it means |
|---|---|---|
| A **required** step failed | **1** | The environment is not usable as adopted. The summary names each failure. Fix it and re-run — `env:init` is safe to repeat. |
| An **optional** step could not run | 0 | The environment is usable. The summary lists what is pending and the command that closes it — except the two rows marked *warning only* below, which are printed once during the run and not repeated in the summary. |

| Step | Required (exit 1) | Optional (exit 0) |
|---|---|---|
| SDD harness init | the init fails | |
| `core.hooksPath` | it cannot be set | |
| Memory backend declaration | | none declared and no terminal to ask on, an invalid value, or an unreadable `brain.config.json`: memory setup is skipped and the command that closes it is listed. If the answer you typed could not be saved, setup still runs for that answer and the save command is listed |
| Memory backend `setup` | it fails | |
| Memory `pull` | attempted and refused (merge or reconcile refusal, corrupt store) | no commit yet, no upstream, or remote unreachable |
| Memory `index` (engram) | binary present, indexing fails | binary absent — hydration and indexing skipped |
| VCS token | typed but not saved (refusals above), or `auth login` failed | no token given — *warning only*: re-run `env:init` with a terminal to add one |
| VCS provider override | the write fails | |
| Governance labels / `brain.actor` | | VCS unreachable or unauthenticated, a refused label create, or no VCS identity |
| `brain.config.json` | it cannot be parsed | any other `ensure` failure (e.g. the tier notice) |
| Open-ticket board | | could not be listed — *warning only*: a read-only listing, nothing to close |

### Choices `env:init` makes for you (and how to change them)

| Axis | Default for a new repo | Where it's declared | How to change it |
|---|---|---|---|
| Governance tier | `lite` — no second approver required to merge ([ADR-0026 Amendment 8](../brain/project/decisions/adr-0026-governance-doctrine-tiers.md)) | `governance.tier` in `brain.config.json` | `npm run brain:config -- set governance.tier standard`, then `npm run brain:protect` |
| Agent platform | `claude` ([ADR-0024 Amendment 2](../brain/project/decisions/adr-0024-three-axis-decoupling.md)); `antigravity` is the second supported platform | `AGENT_PLATFORM` in `.env` | set `AGENT_PLATFORM=antigravity` in `.env` before running `env:init`, or export it for one run: `AGENT_PLATFORM=antigravity npm run brain:env:init` |
| Memory backend | **None is assumed.** `env:init` asks once on a terminal (there is no default: Enter re-prompts, and a closed stdin leaves it undeclared; the answer is `engram` or `plainfiles`) and writes the answer to tracked config. See "The memory backend is a team setting" below. engram 2.x is supported: a fresh 2.x store accepts brain's record import. Its duplicate-heal probe is still tested on 1.20.x and says so outside that range | `memory.backend` in `brain.config.json` (tracked) | `npm run brain:config -- set memory.backend plainfiles` (or `engram`) |
| VCS provider | derived from your git origin, confirmable on a TTY | `vcs.provider` in `brain.config.json` (tracked) | type `github` or `gitlab` at the prompt |

**The VCS provider and memory backend prompts validate.** The provider accepts `github`,
`gitlab` or empty (keep the derived default); the backend accepts `engram`, `plainfiles`
or empty. Anything else re-prompts, so a pasted token can never land in the tracked
`brain.config.json`.

**`project.name` may stay empty after `env:init`.** Only `project.slug` is filled from
your git origin. The `engram` adapter derives its project from `project.slug`, then
`project.name`, then the checkout's directory name, so you do not need to set it. If a
doctrine index write fails, `brain:memory:index` now exits non-zero and `env:init`
reports it as a required failure.

---

### What `env:init` sets up for the first PR and the first `brain:memory:save`

| Step | What `env:init` does | If it cannot |
|---|---|---|
| Governance labels | Creates, through the VCS port, the approved label (`governance.approvedLabel`, default `status:approved`), the `type:*` labels `brain:ship` and `brain:ticket:start` read, `size:exception`, `skip:memory-gate` and, on GitHub, the `governance:*` alarm labels. It only creates what is missing, so a re-run changes nothing, and it reports what it created. On GitLab the approved and `type:*` labels use the scoped `key::value` form; `size:exception` and `skip:memory-gate` keep their names. | Pending step, exit 0: the summary lists it with `npm run brain:env:init` (re-run once the VCS is reachable and authenticated) and the hand command, e.g. `gh label create "status:approved"`. |
| `brain.actor` | Keeps a valid one you already configured; otherwise writes your authenticated VCS identity as `@<username>` with `git config --local`. It never derives it from `user.name`. A stored `@legacy`, or a value that is not a handle, counts as unset. | Pending step, exit 0: `git config --local brain.actor @<handle>`. |
| Memory lane | States, on every run, whether the lane is on. It is off by default on every tier because it opens a separate pull request for memory records that may need a maintainer to merge. | Nothing to fail; to turn it on: `npm run brain:config -- set memory.lane.enabled true`. |

The labels step writes to your remote, so it needs an authenticated VCS (the token from the prompt above, or on GitHub an
existing `gh` login). Without one it is a pending step, not a failure: authenticate and
re-run `env:init`.

### The memory backend is a team setting

The backend used to live only in your untracked `.env`, so a teammate, a CI job or a fresh
clone had no `.env` and silently ran `engram` even when your team uses `plainfiles`. It is
now declared in tracked config:

```bash
npm run brain:config -- set memory.backend plainfiles   # or engram
git add brain.config.json && git commit
```

`env:init` asks once and writes it for you, to `brain.config.json` and not to `.env`.
Precedence, first wins: process env `MEMORY_BACKEND` (one run), then `.env` (this machine),
then `brain.config.json` (the team). When two disagree the CLI says which one won.

**If nothing declares a backend, memory commands refuse** and name this fix instead of
guessing `engram`: every op that consults a backend (`pull`, `import`, `index`, `share`,
`search`, `setup`, `heal-duplicates` and the feature checkpoint and resume) exits **3**
(nothing declared) or **4** (invalid value). `reindex`, `resolve-index`, `split-records`,
`collect`, `ship` and `migrate-v1` never consult a backend, and `audit` never refuses over a
missing backend (it reads the backend only when one is declared). `brain:memory:save` still writes the record, saying hydration is deferred until a
backend is declared. Without a terminal, `env:init` declares nothing and lists the command
as a pending step.

If your backend is already in `.env`, it keeps working, and `env:init` prints the one
command that shares it with the team.

### The audit cursor: nothing to do by hand

The post-merge audit remembers what it has audited in `refs/governance/audit-cursor`.
You do not create it. The first post-merge run on `main` creates it at the adoption
commit (the first commit that added `governance-postmerge.yml`) and audits everything
after it, provided no earlier run of that workflow ever succeeded. The workflow reads run
history with the `actions: read` permission, which it declares itself.

If a cursor was deleted after a run had succeeded, or the run history cannot be read, the
run files a `governance:cursor-missing` alarm with the command to recreate it at the
adoption commit; it never guesses. GitLab has no post-merge audit, so this is GitHub-only.

**Your first real merge does not alarm, and alarms close themselves** (1.10.1). The post-merge
audit asks the same memory question the PR gate asked (issue-scoped, and at `lite` a warning,
not a failure). While `.memory/records/` holds no `.jsonl` file at all, the audit abstains and
prints `[memory: no history yet — abstained]` on that merge's `[PASS]` line; from the first
record on, the full rule applies. When a later run clears the condition behind a
`governance:*` alarm (a clean audit, or a successful archive sweep for
`governance:archive-sweep-failed`), the workflow comments on the open alarm issue with a link to
the passing run and closes it. A comment or close that cannot happen is a `[WARN]` line, never
a red run. This needs the current `governance-postmerge.yml`: it is REFUSE-managed, so if you
edited your copy `brain:upgrade` leaves it alone and names
`--force-managed .github/workflows/governance-postmerge.yml`.

**Upgrading from 1.9.0 or earlier with a post-merge run that never succeeded?** Your first
run audits every commit since your adoption at once, and can open several
`auto-revert/<sha>` pull requests. The CHANGELOG entry for 1.10.0 says how to pick the
window before you upgrade.

---

## The first commit

In a brand-new repository your adoption commit (`brain.config.json`, the copied managed
paths, `.gitignore`) is the first commit on `main`, so there is nothing to branch from and
no issue to cite. **No ticket is needed and there is no `--no-verify`.** Two hooks allow it
while **no ref reaches any commit**, and each prints one line saying so:

| Hook | What it exempts on the first commit |
|---|---|
| `pre-commit` | its "no direct commit to `main`" and "no commit from the main checkout" checks |
| `commit-msg` | the `#N` ticket reference (#1161) |

The message must still be a Conventional Commit (`chore: adopt brain`). The exemption ends
by itself: once that commit exists, every later commit is judged as before, including a
`git commit --amend` of the adoption commit, which then needs a `#N`. The other
`pre-commit` checks (`repo:check` and the staged-records check) still run on the first
commit. In an existing repository with history, nothing changes: the hooks judge your
commit normally. If you install the server-side hook (`brain:protect-server`) before your
first push, its `pre-receive` still asks for a ticket on that push
([#1169](https://github.com/csrinaldi/brain/issues/1169)).

---

## Your first PR: `brain:check` and `brain:ship`

On a fresh repository, `brain:start` (or `brain:ticket:start`), your change, then `brain:check`
and `brain:ship` open the first PR. Before 1.10.1 this needed an undocumented
`git remote set-head`, a working `test` script and a session summary; none of them is needed
now (the summary only matters above the default `lite` tier).

| Question `brain:check` answers | Where the answer comes from |
|---|---|
| Which repository does `issue-link` ask about? | `project.slug` in `brain.config.json`, else the origin remote (`env:init` fills the slug from it) |
| Which branch is the default? | `DEFAULT_BRANCH`, else `origin/HEAD`, else the remote's own `HEAD` (read, never written). If none answers (offline), `issueLink` is reported `UNVERIFIED` with the reason and the command prints what could not be verified instead of "Ready to brain:ship"; export `DEFAULT_BRANCH` to override |
| Does `npm test` run? | Only in the brain source repo (the `.brain-source` marker), as in CI. Elsewhere it prints `[N/A] npmTest` and is never a failure |
| Does a missing memory record fail? | As CI does: a warning at `lite`, a failure at `standard` and `regulated` |

It also runs `brain:nav` and the warning-only `index-lag` check, so it now covers every step of
CI's `local-checks` job (`npm test` only where CI runs it).
`brain:ship` opens the PR against the same default branch (or `project.defaultBranch` if you
set it) and still requires `vcs.provider` and `project.slug` in `brain.config.json`, which
`env:init` writes.

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
npm run brain:upgrade -- v1.10.1             # install a newer tag, copy managed paths
npm run brain:upgrade -- v1.10.1 --dry-run   # preview what would change
```

Read the [CHANGELOG](../CHANGELOG.md) first — renames and breaking changes need
manual action. Additive `brain.config.json` migrations apply automatically; your
own values in `brain/project/**`, `brain.config.json`, `.env`, `openspec/changes/**`
and `.memory/**` are never touched. `brain:day:start` checks for a newer tag every
morning and never auto-updates.

---

## When a step fails

- **`env:init` reports step failures inline** (a `⚠` line naming the step) and keeps
  going rather than aborting the whole run — it's safe to re-run. At the end it lists
  optional gaps under "pending" with the command that closes each, and any **required**
  failure by name, with exit code 1 (see "What the `env:init` summary tells you").
- **Check the exit code, not just the text.** A required failure no longer ends in a
  clean `Environment ready`; a script that wraps `env:init` sees exit 1.
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
