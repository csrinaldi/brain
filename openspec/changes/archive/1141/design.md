---
status: draft
issue: 1141
---

# Design — one directory per axis (issue #1141)

## Layout

```
brain/scripts/axes/
  layout.test.mjs                 the guard for this change
  lib/                            code shared by more than one harness axis
    agent-runtime.mjs(+test)
    harness-adapter-url.mjs       the old mixed directory's lookup, over the new layout
  memory/
    adapters/engram.mjs, plainfiles.mjs (+ their tests)
    no-artifact.parity.test.mjs, reindex-parity.test.mjs, save-parity.test.mjs
  vcs/
    adapters/github.mjs, gitlab.mjs, identity.drift.test.mjs
    contract.test.mjs             was vcs/providers/vcs.contract.test.mjs
  platform/
    adapters/claude.mjs, antigravity.mjs (+ tests), plain.mjs (re-export)
    lib/settings-hooks.mjs(+test)
  sdd-engine/
    adapters/gentle-ai.mjs, gentle-ai.roles.mjs, plain.mjs (+ tests)
    role-port.mjs(+test)          was roles/role-port.mjs
    contract.test.mjs             was roles/roles.contract.test.mjs
    fixtures/stage-set-custom.json
  review-engine/
    adapters/codex.mjs, gemini.mjs (+ tests), claude.mjs (re-export)
```

## File → axis map, with the evidence for each

Each row was decided from what the file exports and who imports it, read before the move.

### From `harness/backends/`

| file | home | evidence |
|---|---|---|
| `claude.mjs` | `platform/adapters/` (physical); `review-engine/adapters/claude.mjs` re-exports it | Exports `init` (emits `.claude/settings.json`), `AGENT_RUNTIME` and `CLAUDE_SETTINGS_EMIT_PATH`: the platform surface, and `claude` is the default `AGENT_PLATFORM`. It also exports `runStage` and `STAGE_TIMEOUT_MS`, the review-engine surface `stage-seam.mjs` dispatches to. Two axes, one module. |
| `antigravity.mjs` | `platform/adapters/` | `init` emits `AGENTS.md` and `.gemini/settings.json`; `AGENT_PLATFORMS` lists it; no `runStage`. |
| `plain.mjs` | `sdd-engine/adapters/` (physical); `platform/adapters/plain.mjs` re-exports it | Its own header calls it "the `plain` SDD_HARNESS backend". `declareRoles`, `runStage` and the manual SDD flow `init` prints are engine behaviour. As a platform it only declares `AGENT_RUNTIME = null` and emits nothing, so the logic lives with the engine. Listed in both `SDD_ENGINES` and `AGENT_PLATFORMS`. |
| `gentle-ai.mjs` | `sdd-engine/adapters/` | In `SDD_ENGINES`; exports `declareRoles` and `runStage`; `init` runs the gentle-ai ecosystem step. |
| `gentle-ai.roles.mjs` | `sdd-engine/adapters/` | Imported only by `gentle-ai.mjs` and its test. It is part of the gentle-ai adapter, not code shared across adapters. |
| `codex.mjs`, `gemini.mjs` | `review-engine/adapters/` | Export `runStage` plus their own model constants and helpers; neither is an `AGENT_PLATFORMS` or `SDD_ENGINES` member; `run-cold-review-stage.mjs` routes to them. |
| `settings-hooks.mjs` | `platform/lib/` | Imported only by `claude.mjs` and `antigravity.mjs`, both platform adapters. One axis, so the axis `lib/`. |
| `agent-runtime.mjs` | `axes/lib/` (shared) | `agentRuntimeReport` resolves the platform and loads a platform adapter, but `defaultRun` is imported by the review engines (`codex.mjs`, `gemini.mjs`, `claude.mjs`), by `review/cli.mjs` and by `harness/producer-forge-reach.mjs`. Two axes need it, so it goes to a shared location rather than into one axis's `lib/` or a copy in each. |

### From `memory/backends/`

`engram.mjs`, `plainfiles.mjs` and every per-adapter test go to `memory/adapters/`. The three
suites that run the same scenario over both adapters (`no-artifact.parity`, `reindex-parity`,
`save-parity`) go to the axis root, next to where one `contract.test.mjs` will be. The axis has
three parity suites, so they keep their names instead of being merged here.

### From `vcs/providers/`

`github.mjs`, `gitlab.mjs` and `identity.drift.test.mjs` go to `vcs/adapters/`.
`vcs.contract.test.mjs` becomes `vcs/contract.test.mjs`. `vcs/lib/` stays where it is: the
gates and `vcs/cli.mjs` import it as well as the adapters.

### From `roles/`

`role-port.mjs` (+ test) goes to `sdd-engine/role-port.mjs`: it is the SDD-engine role port,
and it loads SDD-engine adapters. `roles.contract.test.mjs` becomes `sdd-engine/contract.test.mjs`
and takes its fixture, `fixtures/stage-set-custom.json`, with it.

`roles/first-party/` STAYS. It is brain's own shelf of roles (ADR-0023). Its readers are the
cold review (`review/lib/*`) and the platform projection (`antigravity.mjs`'s `rolesSection`),
not the SDD-engine port. Moving it would pick an axis the code does not support.

## No file with an unclear axis

Every file above had an answer in its exports and importers. The one that needed a rule rather
than a reading is `agent-runtime.mjs`, placed by the maintainer's reuse rule: shared, not
duplicated and not forced into one axis.

## The loaders: why a lookup helper, and why it is not a resolver

Three loaders read `harness/backends/` by NAME, and none of them knew which axis a name
belonged to:

- `harness/cli.mjs#dispatch` loads the platform for `init`, the engine for `init`, and any
  engine name for `run-stage` (`claude`, `codex`, `gemini`, `gentle-ai`, `plain`).
- `agent-runtime.mjs#agentRuntimeReport` loads whatever `resolvePlatform` answers.
- `role-port.mjs#loadInhabitant` loads the engine it is given.

Splitting the directory by axis means a name no longer has one obvious path. Pointing each
loader at "its" axis would change behaviour, because the dispatcher is deliberately
axis-blind: it runs `run-stage` for any engine name. So `axes/lib/harness-adapter-url.mjs`
keeps the old behaviour over the new layout. It searches `platform`, `sdd-engine`,
`review-engine` in that order and returns the first `<name>.mjs` that exists. A dual-axis name
has one physical module, so the order decides which FILE is read, never which code runs. When
no axis has the name, it returns the first candidate, so the import fails the way it always did.

It is not the axis resolver. #1114 replaces it with one resolver per axis.

`memory/cli.mjs` and `vcs/cli.mjs` load from a single axis each, so their template paths just
point at the new directory.

## Guards that had to follow the move

A guard pointed at a directory that no longer exists can pass because it reads nothing. Each of
these was changed so it still reads what it was guarding. None of their assertions changed.

- `vcs/engine-blind-gates.test.mjs`: "the engines' home" was `brain/scripts/harness/`, which
  also held the adapters. It is now a list: `harness/` plus `axes/platform`, `axes/sdd-engine`,
  `axes/review-engine` and `axes/lib`. The VCS and memory axes are deliberately not in it,
  because a gate importing a VCS adapter is the port working as intended. Measured: appending
  `import { init } from '../axes/sdd-engine/adapters/plain.mjs';` to `vcs/actor-check.mjs`
  turns the current guard red, and leaves the pre-change guard green.
- `vcs/ci-context-drift-guard.test.mjs`: the direct-import regex and the gate-file list name
  `axes/vcs/adapters/`.
- `harness/stage-seam.test.mjs`, `harness/cli.test.mjs` (cycle walk),
  `axes/lib/agent-runtime.test.mjs` (registry) and `axes/platform/lib/settings-hooks.test.mjs`
  (single-copy scan) read the three harness axis directories through
  `harness-adapter-url.mjs`, not a fixed list.
- `axes/vcs/adapters/identity.drift.test.mjs`: the import regex names the new relative path to
  `vcs/lib/identity-context.mjs`.
- `test-spawn-hygiene.test.mjs`, `test-hygiene.test.mjs`, `memory/chunk-boundary.test.mjs`,
  `memory/retired-artifacts.static.test.mjs`, `lib/sdd-layout.test.mjs`: path rows updated,
  including a spawn line number (92 → 93) that moved by one import.
- `brain/project/check-refs-rules.mjs`: the `--no-verify` exemptions follow
  `settings-hooks.mjs` and the two platform tests to their new paths. Without it,
  `brain:repo:check` would flag the moved tests.

## The upgrade: removing what a release stops shipping

`copyManaged` walks the INCOMING package, so it never visits a file the package dropped. The
fix has the incoming package name what it retired:

- `brain/scripts/lib/retired-paths.mjs` exports `RETIRED_PATHS`, the 53 old paths.
- `brain-upgrade.mjs` imports it from the INCOMING package root after the install. A package
  from before the list existed has no module, and retires nothing.
- `copyManaged({ retired })` removes each path that is a file in the consumer's tree, is under
  `managed`, is not `local`, and is not shipped again. Removals are part of the same restore
  point as the writes, so a failed run puts them back. Parent directories left empty are
  pruned, never above the first non-empty one. The result gains `removed`, and the upgrade
  prints it.

**Why an exact list and not "whatever the package no longer has".** Under `--no-install` the
outgoing package is gone, so the tree cannot say which files were brain's. A directory-level
sweep would delete a consumer's own file sitting beside brain's. `brain/` in the new package
and `local` are the only facts available, and only the release that stopped shipping a file
knows it did.

**What it does not cover.** The consumer's `npm run brain:upgrade` runs the consumer's own
copy of `brain-upgrade.mjs`. A consumer on 1.7.0 running that script gets 1.7.0's copy logic,
which has no removal step; the old files are removed by the first upgrade run by a version
that has this change. Running the incoming package's script, as ADR-0036's procedure does,
removes them in one step. For the same reason an entry must stay in `RETIRED_PATHS` for as
long as a consumer may still be upgrading from a release that shipped it.

## Doctrine

`brain/core/**` and `brain/project/**` are not edited. The citations that name old paths are
drafted in `brain-drafts/`; see `brain-drafts/README.md` for which draft covers which citation
and the ones left for a ruling.
