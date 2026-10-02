# ADR-0040 — Who defines the project: an owned team config, a `~/.brain` user layer, and locked axes

> **status:** proposed — rulings recorded from #1263 (maintainer, 2026-10-02), open questions pending, pending human promotion | **date:** 2026-10-02 | **owner:** @crinaldi
> **relates to:** ADR-0004 Amendment 3 (memory selector in tracked config), ADR-0020 (the `reviewActors`/`approvalActors` two-key split), ADR-0026 (tiers; Amendment 8, additive migration), ADR-0036 (fresh-consumer cost bar), ADR-0037 (the producer never approves or merges), ADR-0038 (one config shape per axis); maintainer rulings on #1263, 2026-10-02; #1114 (S3.3, S2)

> **Tier 2 draft.** `brain/project/decisions/**` is human-promoted (`agent-authorities.md` Tier 2).
> Promote with `npm run brain:promote -- <this path>`: the verb writes the house header, adds the
> `brain/HOME.md` entry `decision-gate` requires, regenerates `AGENTS.md` and stages all three.
> Committing them is the signature. The number `0040` was free on `origin/main` at `cef42973`
> (highest: 0037) and on the #1114 tracker at `694eb6c1` (highest: 0038). `0039` is taken by the
> unpromoted #1251 draft (`openspec/changes/issue-1251-ticket-hierarchy/brain-drafts/`). The
> `brain/HOME.md` line the verb derives from this H1 is, as a draft:
>
> - [ADR-0040](project/decisions/adr-0040-who-defines-the-project-owned-team-config-a-user-layer-and-locked-axes.md) — Who defines the project: an owned team config, a `~/.brain` user layer, and locked axes
>
> This ADR names amendments to ADR-0038, ADR-0020, ADR-0026, ADR-0004 and `agent-authorities.md`
> and edits none of them. Each amendment is a separate draft, promoted after this ADR because it
> cites it by number.

## Context

ADR-0038 gave every axis one shape and one precedence. It did not say who writes the tracked
`brain.config.json`, and it gave a person no place of their own. Measured on
`feature/issue-1114-axis-ports` at `694eb6c1`, paths under `brain/scripts/` unless noted:

**1. Whoever adopts brain writes the team config, and that commit fixes it.** `env:init` runs
`lib/brain-config.mjs ensure` (`bootstrap.sh:81`). With no `brain.config.json`, `ensureBrainConfig`
builds the whole file from the migrations and the git origin (`lib/brain-config.mjs:297-327`): the
tier, the VCS provider (`:313`), the scaffolded axes. Nobody is asked who the project's owner is,
and the file records none. This repository's own config has no `governance.approvalActors` at all
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
| **Team** | `brain.config.json` | yes | the repository, every clone, CI | what must be the same for everyone, and what CI reads: `governance`, `vcs`, the team's memory backend, the SDD pipeline and `sdd.roles`, the providers the team allows, and per-axis `locked` |
| **User** | `~/.brain/config.json` | no | one person on one machine, every repository | the person's orchestrator, the runtimes they have installed and their versions |

The user layer uses the ADR-0038 shape: `<axis>.default` and `<axis>.providers.<name>`. It holds
no `governance` and no `vcs`.

### 2. Precedence for an overridable axis

```
process env  >  .env  >  ~/.brain/config.json  >  brain.config.json  >  undeclared
```

- **`providers` on a machine is the union**: the team's `<axis>.providers` plus the user's.
- **Every value is checked against that union.** A value from any level that is not a key of the
  union is refused, never coerced (ADR-0038 §2). The capability rules of ADR-0038 §5 apply
  unchanged: `platform.default` must still name a provider that declares `orchestrate`.
- An axis no level declares still refuses (ADR-0038 §3).

### 3. `locked`

`<axis>.locked: true` in the team config forbids a user-level (`~/.brain`) or `.env` override of
that axis. It is a key of the team layer only.

| Axis | Proposed default | Why |
|---|---|---|
| `memory` | locked | the team's records hydrate into one backend; two backends in one team split the index |
| `sdd` | locked | the pipeline and its roles are the team's process |
| `platform` | free | the orchestrator is the person's tool |
| `vcs` | never overridable | the provider is where the repository lives (ADR-0038 §2); it has no `.env` level, and the user layer does not add one |

The defaults above are proposed for the scaffold; the maintainer's ruling names them as proposed
defaults, not as a migration of existing consumers (open question 6).

### 4. Three moments

| Moment | When | Who writes the team config |
|---|---|---|
| **Foundation** | the repository has no `brain.config.json` | `brain init` + `env:init`, and only then. The adoption commit is the founding decision, signed by whoever adopts. |
| **Daily use** | `brain.config.json` exists | **nobody.** `env:init` writes the user layer only. For a team axis the config does not declare, it refuses with a named fix: ask an owner, or propose it with `npm run brain:config -- set <axis>.default <name>` in a PR. This corrects #1114 S3.3. |
| **Change** | any later edit of the team config | a PR, approved by a project owner (section 5) |

### 5. The owner

- **The owner is declared in the team config itself:** `governance.approvalActors`. This reuses
  ADR-0020's two-key split rather than adding a third identity list. `approvalActors` already
  means "the identities trusted to approve on the team's behalf"; it now also owns the team config.
  The reviewer handle stays out of it, as ADR-0020 requires.
- **Adoption seeds it** with the adopter's `brain.actor`.
- **Changing owners is a team-config change.** It goes through section 4's change moment, and an
  existing owner approves it.

### 6. Enforcement

- **CODEOWNERS.** The `.github/CODEOWNERS` brain ships covers `brain.config.json`, owned by the
  project owners.
- **A gate.** A governance job in the style of `brain-writes-reviewed` requires an approval from an
  identity in `governance.approvalActors` on any PR that touches `brain.config.json`. It follows
  the tier ladder:

  | Tier | Policy |
  |---|---|
  | `lite` | detection: reported, never blocks |
  | `standard` | required |
  | `regulated` | required |

  This differs from `brain-writes-reviewed`, which is required at every tier
  (`vcs/governance-tiers.mjs:211-219`). The job's name and its evidence form are slice 4's.

### 7. Out of scope

Moving credentials into `~/.brain` is a separate decision (ruling 7). Nothing here changes where a
token lives.

### Examples

**A team config** (`brain.config.json`, tracked). The version strings are illustrative.

```json
{
  "governance": {
    "tier": "standard",
    "approvalActors": ["alice", "bob"],
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
the axis, the file the value came from, and the fix: ask an owner in `governance.approvalActors`,
or propose the change with `npm run brain:config -- set memory.default plainfiles` in a PR. The
same value in `.env` as `MEMORY_BACKEND=plainfiles` is refused the same way.

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
  `approvalActors` names who may change it, and the gate reports, or at `standard`/`regulated`
  refuses, a change nobody owning it approved.
- **`env:init` becomes read-only on team state in daily use.** A second developer's bootstrap
  leaves `brain.config.json` byte-identical, which is #1263's first acceptance criterion and makes
  the diff of a fresh clone empty.
- **`locked` turns a convention into a rule.** "We all use engram" is checkable, and a stray
  `MEMORY_BACKEND` in someone's `.env` is refused instead of silently splitting the index.
- **No new identity list.** Reusing `approvalActors` keeps ADR-0020's split at two keys.

### Negative

- **Two files to read when diagnosing.** "Why does my machine run X" now has four levels plus a
  union. `resolveAxis` must report the source of every value, and `brain:doctor` (#1130) must name
  the user layer.
- **A free axis can differ by machine without anyone seeing it in the repo.** That is the purpose
  for `platform`, but a stage whose `engine` cascades to `platform.default` (ADR-0038 §4) then runs
  on a different runtime per machine. A team that wants one runtime for a stage names its `engine`.
- **"The providers the team allows" binds only on locked axes.** The union lets a user add a
  provider to a free axis. A team that wants to restrict a free axis has to lock it.
- **A sole owner cannot approve their own config change on the forge.** At `standard` and
  `regulated` a one-owner project needs a second identity in `approvalActors`. That is consistent
  with ADR-0037 (the producer never approves) and with ADR-0036 check 1, because `lite`, the
  default for new consumers (ADR-0026 Amendment 8), only reports.
- **Every `brain:upgrade` that migrates the config needs an owner's approval** at
  `standard`/`regulated`, since it touches `brain.config.json`.
- **Seeding has an ordering and a format cost.** `ensureBrainConfig` runs at `bootstrap.sh:81`, and
  `brain.actor` is resolved later, in §5b (`bootstrap.sh:543-565`). `brain.actor` is written as
  `@<login>` (`lib/env-init-setup.mjs:141-146`), while `actor-check` compares forge logins exactly
  (`vcs/actor-check.mjs:807`). Slice 3 has to resolve the actor before the config is created and
  store the bare login.
- **`approvalActors` gains a third reader.** ADR-0020's decision says it is read only by L5. It is
  already also read by L6 for `override:*` labels, as the same trust grant
  (`vcs/brain-writes-reviewed.mjs:265-289`). The new gate is a third reader in the same direction,
  and ADR-0020's amendment has to state that.
- **CODEOWNERS is shipped, not generated.** It is a copied managed file with a placeholder owner
  and `REFUSE` on upgrade. A consumer who filled in their owner does not get the new
  `brain.config.json` line from `brain:upgrade`; it has to be added by hand or by a new mechanism.
  Brain ships no GitLab CODEOWNERS today, so the GitLab half of the enforcement is the gate alone.

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
  `bootstrap.sh:371-378`). If `memory` and `sdd` became locked on those consumers, these
  machine-written lines would be refused overrides. Open question 6.
- **No existing consumer declares `approvalActors` as the owner list**, this repository included.
  Seeding it from the machine that runs `brain:upgrade` would repeat the defect this ADR corrects.
  Open question 4.

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
- **GitLab CODEOWNERS** and code-owner approval on GitLab.

## Implementation (four slices on the #1114 tracker)

1. Read the `~/.brain` layer, merge it with the team layer and apply `locked` in `resolveAxis`
   (#1114 S2, PR #1259). S2's `resolveAxis` already takes `env`, `dotenv` and `config` as parameters
   and reads no file (`lib/axis-config.mjs:247-257` on `feat/issue-1114-s2-resolve-axis`), so the
   user layer is one more injected input.
2. `env:init` writes the user layer and never the team config in an existing repository. This
   corrects S3.3.
3. Adoption seeds `approvalActors`, and the shipped `CODEOWNERS` covers `brain.config.json`.
4. The team-config approval gate, on the tier ladder of section 6.

## Amendments this requires (none are made here)

- **ADR-0038.** The user layer as a level between `.env` and the team config; the providers union;
  `locked`; and `env:init` declaring the team config only at foundation (its §7 "a new consumer"
  bullet).
- **ADR-0020.** `approvalActors` also owns the team config and is read by the new gate. The reviewer
  handle stays out of it.
- **ADR-0026.** The new gate's row in the tier table: detection at `lite`, required at `standard`
  and `regulated`.
- **ADR-0004.** Amendment 3's adoption bullet: the memory prompt declares into tracked config only
  at foundation; in an existing repository an undeclared backend is refused with the named fix.
- **`agent-authorities.md`.** Tier 2 names `.gitlab-ci.yml`, `settings.xml` and `CODEOWNERS` as
  team-wide infrastructure an agent changes only with confirmation; `brain.config.json` belongs in
  that list.

## Open questions for the maintainer

1. **An override path for `~/.brain`.** Should `BRAIN_HOME` (or another variable) relocate the user
   layer? Tests must never read a developer's real home, and ADR-0036's fresh-install definition
   forbids an inherited `HOME`. No such variable exists today; the only home read in `brain/scripts`
   is `axes/review-engine/adapters/gemini.mjs:21`.
2. **Windows.** `%USERPROFILE%\.brain`, `%APPDATA%\brain`, or something else? Should Linux honour
   `XDG_CONFIG_HOME`?
3. **CI with no `~/.brain`.** CI runs the governance gates, which read `brain.config.json` directly,
   plus `node --test` and the bootstrap smoke (`.github/workflows/*.yml`). It should resolve from
   the team config alone. That holds only if every axis CI consults is declared there. Must the
   team declare a default for every axis, free ones included, so that CI never meets an axis
   declared only in users' homes?
4. **Owners.** How are several owners, a leaving owner, and a sole owner authoring their own change
   at `standard` handled? How does an existing consumer get its first `approvalActors`, given that
   seeding from the upgrading machine repeats this ADR's defect?
5. **`locked` and the process env.** Ruling 3 forbids user-level and `.env` overrides. Does a locked
   axis also refuse a process-env value, or does the per-run override stay, as for `vcs`?
6. **Locked defaults on existing consumers.** Are `memory` and `sdd` locked only in a new
   consumer's scaffold, following ADR-0026 Amendment 8, or migrated? And is a `.env` value equal to
   the team's default an override to refuse, given the `SDD_ENGINE` and `MEMORY_BACKEND` lines
   released versions wrote?
7. **`version` when both layers list a provider.** The team's `version` is an expectation
   (ADR-0038 §6); the user's is what is installed. Which one does the merged entry carry, and is a
   difference a mismatch to report?
8. **One owner list or two.** Is the `CODEOWNERS` line for `brain.config.json` generated from
   `approvalActors`, or kept by hand? Two hand-kept lists drift.
