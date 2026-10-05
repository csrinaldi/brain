# ADR-0040 — Who defines the project: an owned team config, a `~/.brain` user layer, and locked axes

**Status**: Accepted · **amended 05/10/2026** (Amendment 1 — see below)
**Date**: 2026-10-02 — Cristian Rinaldi

## Context

ADR-0038 gave every axis one shape and one precedence. It did not say who writes the tracked
`brain.config.json`, and it gave a person no place of their own. Measured on
`feature/issue-1114-axis-ports` at `694eb6c1`, paths under `brain/scripts/` unless noted:

**1. Whoever adopts brain writes the team config, and that commit fixes it.** `env:init` runs
`lib/brain-config.mjs ensure` (`bootstrap.sh:81`). With no `brain.config.json`, `ensureBrainConfig`
builds the whole file from the migrations and the git origin (`lib/brain-config.mjs:297-327`): the
tier, the VCS provider (`:313`), the scaffolded axes. Nobody is asked who the project's owner is,
and the file records none. This repository's own config has no owner key and no `governance.approvalActors` at all
(`brain.config.json:21-42`).

**2. After adoption, nothing guards it.**

- `.github/CODEOWNERS` lists `/brain/core/**` and `/brain/project/**` only, with the placeholder
  `@<human-reviewer-team>`. Brain ships that file to every consumer as a managed path
  (`brain/core/managed-paths.mjs:99`) under `STRATEGY.REFUSE` (`:166`): a consumer who edited it
  keeps their edit, and `brain:upgrade` refuses to overwrite it.
- No governance job reads a change to `brain.config.json`. `GOVERNANCE_JOBS`
  (`vcs/governance-checks.mjs:41-55`) has `brain-writes-reviewed`, which covers `brain/**`, and
  nothing for the team config.
- Any PR may therefore change the tier, the ignore list, the reviewer, the memory backend or the
  axes, with the same review as a typo fix.

**3. #1114 S3.3 makes daily use write the team config from any machine.** On an existing repo
whose config declares no `platform` or `sdd` default, `env:init` resolves today's code default and
declares it into tracked config: `_axis_settle` (`bootstrap.sh:261-267`) calls `_axis_declare`
(`:215-226`), which runs `config/cli.mjs set <axis>.default` (`:220`), for `platform` and `sdd`
(`:587-592`). S3.4 kept `.env`-only values out of the team file, but a value from the code default
still lands there, on whichever machine runs `env:init` first. Two older writers do the same in
daily use: the memory prompt declares `memory.default` from any TTY when the team declares none
(`bootstrap.sh:671-689`, #1214, shipped in v1.11.0 as `set memory.backend`), and a VCS provider
typed at the prompt is persisted with `set vcs.default` (`bootstrap.sh:166`). One person's
`env:init` decides for the team, and the only record is a diff nobody was asked to approve.

**4. ADR-0038 has no user layer.** Its precedence is process env, `.env`, team config, undeclared
(ADR-0038 §2). A developer who runs a different orchestrator, or has other runtimes or versions
installed, can declare that in two places only. One is the team's file, which is wrong by
definition. The other is a flat `.env` key, which is per repository and per worktree, and is the
file ADR-0004 Amendment 3 stopped trusting: a per-issue worktree with no `.env` silently runs
something else. Nothing applies to the person across all their repositories.

## Decision

### 1. Two layers, by owner

| Layer | File | Tracked | Scope | Holds |
|---|---|---|---|---|
| **Team** | `brain.config.json` | yes | the repository, every clone, CI | what must be the same for everyone, and what CI reads: `governance`, `vcs`, the team's memory backend, the SDD pipeline and `sdd.roles`, the providers the team allows, per-axis `locked`, and a declared `default` for every axis |
| **User** | `<BRAIN_HOME>/config.json` | no | one person on one machine, every repository | the person's orchestrator, the runtimes they have installed and their versions |

The user layer uses the ADR-0038 shape: `<axis>.default` and `<axis>.providers.<name>`. It holds
no `governance` and no `vcs`.

**Where the user layer lives** (Ratified points 1 and 2). The directory is `BRAIN_HOME` when that
variable is set, otherwise `<os.homedir()>/.brain`, on every operating system. `~/.brain` in this
ADR means that directory. XDG support (`XDG_CONFIG_HOME`) is deferred.

**`BRAIN_HOME` is required in tests.** Every test, and the hermetic box, sets `BRAIN_HOME`, so no
test ever reads a developer's real home. A guard test enforces it: a test that reaches the user
layer without `BRAIN_HOME` set fails.

### 2. Precedence for an overridable axis

```
process env  >  .env  >  ~/.brain/config.json  >  brain.config.json  >  undeclared
```

- **`providers` on a machine is the union**: the team's `<axis>.providers` plus the user's.
- **Every value is checked against that union.** A value from any level that is not a key of the
  union is refused, never coerced (ADR-0038 §2). The capability rules of ADR-0038 §5 apply
  unchanged: `platform.default` must still name a provider that declares `orchestrate`.
- **`version` when both layers list a provider** (Ratified point 7). On that machine the user
  layer's `version` wins, because it is what is installed there. The team's `version` stays the
  expectation, and `diagnoseAxes` reports a difference between the two as a mismatch.
- **The team layer alone is complete.** The foundation declares a team `default` for every axis
  (Ratified point 3), except a memory backend nobody chose (section 4). CI has no `~/.brain` and
  resolves every axis from the team config, with one exception: `vcs`. The user layer only
  overrides, on a free axis.
- **The CI exception for `vcs`.** In CI the runtime-detected provider (ADR-0016's `ctx.provider`)
  wins. It sits outside this precedence and needs only an adapter brain ships, not a
  `vcs.providers` key (ADR-0038 Ratified point 1). It is a fact about the host, not a user
  override, so it is not what "`vcs` is never overridable" forbids.
- An axis no level declares still refuses (ADR-0038 §3).

### 3. `locked`

`<axis>.locked: true` in the team config forbids every override of that axis: the user layer,
`.env` **and the process env** (Ratified point 5). A different memory backend, even for one run,
corrupts the shared memory, so a per-run override is not harmless. `locked` is a key of the team
layer only.

| Axis | Default for a NEW adoption | Why |
|---|---|---|
| `memory` | locked | the team's records hydrate into one backend; two backends in one team split the index |
| `sdd` | locked | the pipeline and its roles are the team's process |
| `platform` | free | the orchestrator is the person's tool |
| `vcs` | never overridable from `.env` or the user layer | the provider is where the repository lives (ADR-0038 §2); it has no `.env` level, and the user layer does not add one. The CI runtime-detected provider is not an override: it sits outside the precedence (section 2) |

**Existing consumers are not locked by a migration** (Ratified point 6). The migration writes
`locked: false` on every axis, so nothing they run changes (ADR-0038 §7). An owner turns `locked`
on deliberately, by a team-config PR. This also keeps the `SDD_ENGINE` and `MEMORY_BACKEND` lines
that released versions wrote into `.env` valid until that owner decides.

### 4. Three moments

| Moment | When | Who writes the team config |
|---|---|---|
| **Foundation** | the repository has no `brain.config.json` | `brain init` + `env:init`, and only then. It declares a `default` for every axis, the new-adoption `locked` defaults, and the owner. **A non-interactive foundation (no TTY) leaves `memory` undeclared** (`"default": ""`): the backend is never guessed (ADR-0004 Amendment 3), and `diagnoseAxes` reports "memory backend undeclared" as an ERROR-severity finding until someone chooses one. Every other axis still gets its team default. The adoption commit is the founding decision, signed by whoever adopts. |
| **Daily use** | `brain.config.json` exists | **nobody.** `env:init` writes the user layer only. For a team axis the config does not declare, it refuses with a named fix: ask an owner, or propose it with `npm run brain:config -- set <axis>.default <name>` in a PR. This corrects #1114 S3.3. |
| **Change** | any later edit of the team config | a PR, approved by a project owner (section 5) |

### 5. The owner

- **The owner is a NEW key, `governance.owners`:** the list of humans who own the team config,
  kept apart from automation identities. *Corrected after the cold review of PR #1264:* the first
  draft reused `governance.approvalActors`. In code that key is an automation allow-list that
  short-circuits the self-approval check: `vcs/actor-check.mjs:807`
  (`if (actor && botAllowlist.includes(actor))` returns `pass`) runs before the tier branch
  (`:826`) and before the `actor === author` failure (`:839`). A human owner seeded there could
  self-approve at any tier, which ADR-0037 forbids.
- **`approvalActors` keeps its meaning, unchanged**, and so does ADR-0020's two-key split.
  `governance.owners` is a third key beside it, with one reader: the team-config gate.
- **It is a list, so a project may have several owners.**
- **Adoption seeds it** with the adopter's login. `brain.actor` is written as `@<login>`
  (`lib/env-init-setup.mjs:141-146`); `governance.owners` holds the bare forge login.
- **Changing owners is a team-config change.** Removing an owner is a PR approved by another owner.
- **A sole owner approving their own team-config change** is valid only at `lite` in autonomy mode
  A: ADR-0037's solo-maintainer exception, reported as such, never as independent.
- **Existing consumers are not auto-seeded.** Seeding from the machine that runs `brain:upgrade`
  would repeat the defect this ADR corrects. `diagnoseAxes` reports "no owner declared" until an
  owner is added by PR.

### 6. Enforcement

- **One source of truth: `governance.owners`** (Ratified point 8).
- **The gate is the enforcement.** A governance job in the style of `brain-writes-reviewed`
  requires, on any PR that touches `brain.config.json`, an approval from a `governance.owners`
  member who is NOT the PR author. The one exception is ADR-0037's solo maintainer at `lite` in
  mode A (section 5). It follows the tier ladder:

  | Tier | Policy |
  |---|---|
  | `lite` | detection: reported, never blocks |
  | `standard` | required |
  | `regulated` | required |

  This differs from `brain-writes-reviewed`, which is required at every tier
  (`vcs/governance-tiers.mjs:211-219`). The job's name and its evidence form are slice 4's.
- **CODEOWNERS is an optional mirror.** Where a consumer keeps a `.github/CODEOWNERS` line for
  `brain.config.json`, a drift check verifies it names the same identities as `governance.owners`; it
  is never a second hand-kept list. GitLab has no identical equivalent, so on GitLab the gate alone
  enforces. **[Amended by Amendment 1 (#1263): on GitLab the gate cannot pass by approval today. The
  adapter reports no commit for an approval, so the gate fails closed: at `standard` and `regulated`
  a change to `brain.config.json` is blocked until #1281. See Amendment 1.]**

### 7. Out of scope

Moving credentials into `~/.brain` is a separate decision (ruling 7). Nothing here changes where a
token lives.

### Examples

**A team config** (`brain.config.json`, tracked). The version strings are illustrative.

```json
{
  "governance": {
    "tier": "standard",
    "owners": ["alice", "bob"],
    "reviewActors": ["review-bot"]
  },
  "vcs": {
    "default": "github",
    "providers": { "github": {} }
  },
  "memory": {
    "default": "engram",
    "locked": true,
    "providers": { "engram": { "version": "1.15.3" } },
    "lane": { "enabled": true }
  },
  "platform": {
    "default": "claude",
    "providers": {
      "claude": { "version": "2.1.0" },
      "codex": {}
    }
  },
  "sdd": {
    "default": "gentle-ai",
    "locked": true,
    "providers": {
      "gentle-ai": { "version": "1.20.0" },
      "brain": { "version": "self" }
    },
    "roles": {
      "cold-review": { "agent": "brain:cold-review", "engine": "codex", "model": "gpt-5.5" }
    }
  }
}
```

**A user config** (`~/.brain/config.json` on Carol's machine, untracked, every repository):

```json
{
  "platform": {
    "default": "antigravity",
    "providers": { "antigravity": { "version": "1.4.0" } }
  }
}
```

**The effective resolution on two machines.** Dave has no `~/.brain/config.json` and no `.env`
selector. Carol has the user config above.

| Axis | Dave: value (source) | Carol: value (source) |
|---|---|---|
| `vcs` | `github` (team) | `github` (team) |
| `memory` | `engram` (team, locked) | `engram` (team, locked) |
| `platform` | `claude` (team) | `antigravity` (`~/.brain`) |
| `sdd` | `gentle-ai` (team, locked) | `gentle-ai` (team, locked) |
| `platform.providers` | `claude`, `codex` | `claude`, `codex`, `antigravity` (the union) |

Carol runs `antigravity` and never touched the repository. Her value is valid because it is a key
of the union and declares `orchestrate` (ADR-0038 §5). `cold-review` names `engine: "codex"`
explicitly, so it runs on `codex` on both machines.

**Refused: a user override of a locked axis.** Carol's `~/.brain/config.json` adds:

```json
{ "memory": { "default": "plainfiles", "providers": { "plainfiles": {} } } }
```

`memory` is locked by the team config, so the user layer may not override it. The refusal names
the axis, the file the value came from, and the fix: ask an owner in `governance.owners`,
or propose the change with `npm run brain:config -- set memory.default plainfiles` in a PR. The
same value in `.env`, or in the process env for one run (`MEMORY_BACKEND=plainfiles npm run …`), is
refused the same way (section 3).

**Refused: a user default that is not in the union.** Dave's `~/.brain/config.json` is:

```json
{ "platform": { "default": "antigravity" } }
```

`antigravity` is not a key of the team's `platform.providers`, and Dave's user layer declares no
`providers` entry for it, so it is not in the union. It is refused, never replaced by `claude`.
Adding `"providers": { "antigravity": {} }` to his user layer makes it valid, as on Carol's machine.

## Consequences

### Positive

- **A person's tools stop leaking into the team's file.** The orchestrator and installed runtimes
  have a home that applies to every repository, so nobody needs to edit `brain.config.json` or a
  per-worktree `.env` to run their own setup.
- **The team config has an author, an owner and a reviewer.** Foundation names who signed it,
  `governance.owners` names who may change it, and the gate reports, or at `standard`/`regulated`
  refuses, a change nobody owning it approved.
- **`env:init` becomes read-only on team state in daily use.** A second developer's bootstrap
  leaves `brain.config.json` byte-identical, which is #1263's first acceptance criterion and makes
  the diff of a fresh clone empty.
- **`locked` turns a convention into a rule.** "We all use engram" is checkable, and a stray
  `MEMORY_BACKEND` in someone's `.env` is refused instead of silently splitting the index.
- **Owners and automation never share a key.** `governance.owners` holds humans only, so the
  automation allow-list in `approvalActors` cannot let an owner approve their own change.

### Negative

- **Two files to read when diagnosing.** "Why does my machine run X" now has four levels plus a
  union. `resolveAxis` must report the source of every value, and `brain:doctor` (#1130) must name
  the user layer.
- **A free axis can differ by machine without anyone seeing it in the repo.** That is the purpose
  for `platform`, but a stage whose `engine` cascades to `platform.default` (ADR-0038 §4) then runs
  on a different runtime per machine. A team that wants one runtime for a stage names its `engine`.
- **"The providers the team allows" binds only on locked axes.** The union lets a user add a
  provider to a free axis. A team that wants to restrict a free axis has to lock it.
- **A sole owner needs a second owner outside `lite` mode A.** A sole owner's approval of their own
  team-config change counts only under ADR-0037's solo-maintainer exception (section 5). Anywhere
  else a one-owner project needs a second human in `governance.owners`. That is consistent with
  ADR-0037 (the producer never approves) and with ADR-0036 check 1, because `lite`, the default for
  new consumers (ADR-0026 Amendment 8), only reports.
- **A locked axis loses the per-run override.** `MEMORY_BACKEND=… npm run …` stops working on a
  repository whose owner locks `memory`. That is the point of Ratified point 5, and it reverses
  ADR-0004 Amendment 3's "a backend named by the process env or `.env` is an operator's statement",
  for locked axes only.
- **Every `brain:upgrade` that migrates the config needs an owner's approval** at
  `standard`/`regulated`, since it touches `brain.config.json`.
- **Seeding has an ordering and a format cost.** `ensureBrainConfig` runs at `bootstrap.sh:81`, and
  `brain.actor` is resolved later, in §5b (`bootstrap.sh:543-565`). `brain.actor` is written as
  `@<login>` (`lib/env-init-setup.mjs:141-146`), while forge identities are bare logins. Slice 3 has
  to resolve the actor before the config is created and store the bare login in `governance.owners`.
- **One more identity key.** `governance` now holds `reviewActors`, `approvalActors`, `agentActors`
  and `owners`. The cost is one more list to keep current; the gain is that no key mixes humans who
  own the config with automation that may skip the self-approval check.
- **CODEOWNERS needs a drift check.** Brain ships it as a copied managed file with a placeholder
  owner and `REFUSE` on upgrade, so `brain:upgrade` does not maintain a consumer's lines. Because it
  is only a mirror of `governance.owners` (section 6), the cost is a drift check, not a second list to
  keep. Brain ships no GitLab CODEOWNERS, and GitLab has no identical equivalent, so on GitLab the
  gate alone enforces. **[Amended by Amendment 1 (#1263): and today that gate cannot pass by approval
  on GitLab, so at `standard` and `regulated` it blocks every team config change until #1281.]**
- **The guard on `BRAIN_HOME` is one more test-hygiene rule** every new test that reaches the user
  layer must satisfy.

### Existing consumers

- **S3.3 shipped in no release, so no consumer has team config written by it.** Measured
  2026-10-02: `git tag --contains 13d3cd65` (S3.3) and `git tag --contains 694eb6c1` (S3.4, tracker
  head) print nothing; the latest tag is `v1.11.0`; the registry's `@logikas/brain` versions end at
  `1.11.0` (`latest`, published 2026-10-01T16:41Z); and `13d3cd65` is not an ancestor of
  `origin/main`. The correction lands on the tracker before #1114 integrates into `main`, so S3.3's
  behaviour never reaches a consumer.
- **The memory prompt did ship** (v1.11.0, `bootstrap.sh:614` at that tag: `set memory.backend`).
  A consumer whose `memory.backend` was declared by some developer's `env:init` keeps that value.
  It is a team value either way; only its author was unrecorded. Nothing is rewritten.
- **Released `env:init` wrote axis selectors into `.env`:** `SDD_ENGINE` on every run with none set
  (v1.11.0 `bootstrap.sh:522-527`), and `MEMORY_BACKEND` up to the 1.8 line (v1.8.0
  `bootstrap.sh:371-378`). They stay valid: the migration writes `locked: false` on every axis of an
  existing consumer (section 3), so nothing refuses them until an owner locks the axis.
- **No existing consumer declares `governance.owners`**, this repository included.
  They are not auto-seeded (section 5); `diagnoseAxes` reports "no owner declared" until an owner is
  added by PR.

## Rejected alternatives

**A repo-local `brain.config.local.json`.** A person's orchestrator is a fact about the person, not
about one repository, so it would be repeated in every repository they work in. It is untracked, so
a per-issue worktree does not have it, the defect ADR-0004 Amendment 3 named for `.env`. It is one
more file beside a tracked one that can be committed by accident; #1112 measured a PAT reaching the
tracked `brain.config.json` (ADR-0036, Context).

**All config per user.** CI has no user, governance must be identical for every contributor, and
ADR-0004 Amendment 3 and ADR-0038 already ruled that the team's choice lives in tracked config. A
per-user governance tier is a gate each contributor sets for themselves.

**`.env` as the user layer.** It is per repository and per worktree, it holds the personal PAT, and
machine-written selectors in it already shadowed the team's choice (ADR-0038 §7). It stays a
per-machine override level, refused on a locked axis, and is not the place a person declares their
tools.

**Any developer may change the team config.** That is the state Context measures, and S3.3 made it
automatic. A file that sets the tier, the reviewer and the ignore list for every gate is
governance; changing it without an owner is self-authorization one level up.

## What this does NOT close

- **Credentials in `~/.brain`.** Out of scope by ruling 7; tokens stay where they are.
- **No code changes here.** The four slices below implement it.
- **The `~/.brain` file's own schema version and migrations.** One user file serves repositories
  that may run different brain versions. Who migrates it, and what an older brain does with a newer
  file, is not decided here.
- **How `brain:doctor` reports the layers** belongs to #1130.
- **XDG support** (`XDG_CONFIG_HOME`) is deferred (Ratified point 2).
- **A GitLab CODEOWNERS mirror.** GitLab has no identical equivalent; the gate is the enforcement
  there. **[Amended by Amendment 1 (#1263): and that gate cannot pass by approval on GitLab until
  #1281.]**

## Implementation (four slices on the #1114 tracker)

1. Read the user layer (`BRAIN_HOME`, else `<os.homedir()>/.brain`), with the guard test that
   every test sets `BRAIN_HOME`; merge it with the team layer and apply `locked` in `resolveAxis`
   (#1114 S2, PR #1259). S2's `resolveAxis` already takes `env`, `dotenv` and `config` as parameters
   and reads no file (`lib/axis-config.mjs:247-257` on `feat/issue-1114-s2-resolve-axis`), so the
   user layer is one more injected input.
2. `env:init` writes the user layer and never the team config in an existing repository. This
   corrects S3.3.
3. Adoption seeds `governance.owners`; `diagnoseAxes` reports "no owner declared"; the optional
   `CODEOWNERS` mirror gets its drift check.
4. The team-config approval gate, on the tier ladder of section 6.

## Amendments this requires (none are made here)

- **ADR-0038.** The user layer as a level between `.env` and the team config; the providers union
  and the user layer's `version` winning on its machine; `locked`, including over the process env;
  the migration writing `locked: false` for existing consumers; and `env:init` declaring the team
  config only at foundation, a `default` for every axis (its §7 "a new consumer" bullet).
- **ADR-0020.** A new `governance.owners` key, distinct from the two-key split, read only by the
  team-config gate. `approvalActors` and `reviewActors` are unchanged.
- **ADR-0026.** The new gate's row in the tier table: detection at `lite`, required at `standard`
  and `regulated`.
- **ADR-0004.** Amendment 3's adoption bullet: the memory prompt declares into tracked config only
  at foundation; in an existing repository an undeclared backend is refused with the named fix. And
  its "a backend named by the process env or `.env` is an operator's statement" holds only while
  `memory` is not locked.
- **`agent-authorities.md`.** Tier 2 names `.gitlab-ci.yml`, `settings.xml` and `CODEOWNERS` as
  team-wide infrastructure an agent changes only with confirmation; `brain.config.json` belongs in
  that list.

## Ratified points (maintainer, 2026-10-02)

These eight points were open in the first draft. The maintainer ruled on each one, and the Decision
above already reflects them.

1. **`BRAIN_HOME`.** The user layer lives at `BRAIN_HOME` when set, otherwise
   `<os.homedir()>/.brain`. Tests and the hermetic box always set `BRAIN_HOME`, so a test never
   reads a developer's real home. This is required, and a guard test enforces it (section 1). No
   such variable existed before; the only home read in `brain/scripts` was
   `axes/review-engine/adapters/gemini.mjs:21`.
2. **Paths.** `BRAIN_HOME`, otherwise `os.homedir()/.brain`, on every operating system, Windows
   included. XDG support is deferred.
3. **CI and the team layer.** The foundation declares a team `default` for every axis. The user
   layer overrides only free axes. CI has no `~/.brain` and resolves from the team config, except
   `vcs`: there the runtime-detected provider (ADR-0016 `ctx.provider`, ADR-0038 Ratified point 1)
   wins, outside the precedence, and needs only an adapter. It is a host fact, not a user override.
   - **Added after the cold review of PR #1264:** a non-interactive (no-TTY) foundation leaves
     `memory` undeclared (`"default": ""`), never guessed (ADR-0004 Amendment 3). `diagnoseAxes`
     reports "memory backend undeclared" as an ERROR until someone chooses one.
4. **Owners.** The owners are a NEW list, `governance.owners`, of the humans who own the team
   config. There may be several. The gate requires an approval from an owner who is not the PR
   author; a sole owner approving their own change is valid only at `lite` in mode A, ADR-0037's
   solo-maintainer exception. Removing an owner is a PR approved by another owner. Adoption seeds
   the adopter's bare login. Existing consumers are not auto-seeded; `diagnoseAxes` reports "no
   owner declared".
   - **Corrected after the cold review of PR #1264.** The first ruling named
     `governance.approvalActors`. That key is an automation allow-list that short-circuits the
     self-approval check (`vcs/actor-check.mjs:807`, before `:826` and `:839`), so an owner listed
     there could self-approve at any tier, against ADR-0037. `approvalActors` is unchanged.
5. **`locked` and the process env.** `locked` refuses a process-env value too. A different memory
   backend, even for one run, corrupts the shared memory.
6. **Locked defaults.** `memory` and `sdd` locked is the default for new adoptions. For existing
   consumers the migration writes `locked: false` on every axis: no behaviour change, per ADR-0038
   §7. The owner turns it on deliberately. This also keeps valid the `.env` `SDD_ENGINE` and
   `MEMORY_BACKEND` lines released versions wrote.
7. **Which `version` wins.** When both layers list a provider, the user layer's `version` wins on
   that machine, because it is what is installed there. The team's is the expectation, and
   `diagnoseAxes` reports any mismatch.
8. **CODEOWNERS.** One source of truth, `governance.owners`; the approval gate is the enforcement.
   CODEOWNERS is an optional mirror, verified by a drift check, never a second hand-kept list.
   GitLab has no identical equivalent.
   - **Corrected after the cold review of PR #1264:** the first ruling named
     `governance.approvalActors` as the source, for the reason given in point 4.

## Amendment 1 — on GitLab, the owner gate fails closed at `standard` and `regulated` until #1281 (issue #1263)

**Signed**: 05/10/2026 — Cristian Rinaldi

### What changed

Nothing in the code. This amendment records a cost the ADR did not name.

Section 6, the CODEOWNERS consequence and "What this does NOT close" each say that on GitLab the
gate alone enforces. None of them says that, on GitLab, the gate cannot pass by approval today:

- The GitLab adapter's `prReviews` (`brain/scripts/axes/vcs/adapters/gitlab.mjs`) returns
  `commitId: null` on every entry. GitLab's approvals API says who approved, not on which commit.
- `team-config-reviewed` (`brain/scripts/vcs/team-config-reviewed.mjs`) counts an approval only on
  the current head. An approval with a `null` commit cannot be told from a stale one, so the gate
  fails closed and its reason names the GitLab limitation.
- At `lite` the gate is `detection` and only warns. At `standard` and `regulated` it is required,
  so **every change to `brain.config.json` on a GitLab consumer at those tiers is blocked**. That
  includes the rewrites `brain:upgrade` makes through `config-migrations.mjs`, once committed.
- A GitLab MR pipeline does not re-run when an approval lands, so even a future fix needs the
  pipeline re-run after approving.

Until now this was written only in a comment in `brain/scripts/ci/gitlab-governance.yml`.

### Why

The cold review of the tracker (PR #1296, Opus 5.5 round, head `2b5027ad`) found the ADR
claiming enforcement where the code can only refuse. A reader of ADR-0040 alone would expect a
GitLab owner's approval to satisfy the gate.

### The accepted cost, and its exit

Failing closed is the deliberate choice: passing an approval nobody can tie to the current head
would let a push after approval through unreviewed, which is the stale-approval case the gate
exists to stop. The cost is that a GitLab consumer at `standard` or `regulated` cannot change its
team config through brain's gate until #1281 lands. Brain offers no way through in the meantime.
Any way through is the forge's own control over a failed required job, outside brain.

#1281 (approved) is the exit. It accepts GitLab's project setting "Reset approvals on push" as
evidence that a present approval is on the current head, keeps failing closed when the setting is
off, and names the setting in the reason.

### What this does NOT change

The gate, its tier table, owners read from the base, the founding rule, and GitHub's behaviour,
where `prReviews` reports each review's `commit_id` and the gate passes on a current owner approval.
