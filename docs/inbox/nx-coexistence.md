# brain × Nx monorepo — coexistence notes

**Status:** Notes (S4 / managed-paths epic) · **Date:** 2026-06-29
**Context:** brain installs its managed paths into a consumer repo. When that
consumer is an Nx monorepo (validated against `synergy`, branch `test-brain`),
we must be sure brain never disturbs Nx's workspace-root configuration, its
task-graph inputs, or the consumer's own script aliases. Validated end-to-end
with `brain:upgrade --dry-run --cwd <synergy>` after the S1–S3 slices:
**zero collisions, `.claude/settings.json` merged (consumer content preserved),
exit 0.**

## Why there is no interference

brain's managed surface (`brain/core/**`, `brain/scripts/**`, `.gitattributes`)
lives entirely under the `brain/` namespace plus one dotfile. It does **not**
own, generate, or overwrite any of Nx's load-bearing files.

### 1. Workspace-root non-interference

- `nx.json`, `tsconfig.base.json`, `workspace.json`/`project.json`, and the
  `apps/` · `libs/` layout are **not** brain-managed paths. brain never reads or
  writes them.
- After the S3 rename, brain's tooling lives at `brain/scripts/`, not at the
  repo root `scripts/`. This removes the only real collision risk with an Nx
  workspace: a root-level `scripts/` directory that an Nx target or a consumer
  script might already own. The consumer's root `scripts/` (if any) is now
  fully consumer-owned — brain does not touch it.
- The collision guard (S2) makes this auditable: `brain:upgrade
  --abort-on-collision` performs a read-only pre-flight and exits non-zero
  before any write if a managed path's destination differs from brain's source.

### 2. `namedInputs` / task-graph non-interference

- `synergy`'s `nx.json` defines `namedInputs: { default, production,
  sharedGlobals }`. brain adds no files those globs are expected to capture as
  source inputs, and edits none of them.
- brain's managed files under `brain/**` are documentation/tooling, not
  application or library source. If a project's `default` input uses the common
  `{projectRoot}/**/*` / `sharedGlobals` patterns, brain's files sit outside
  any `apps/*` or `libs/*` project root and therefore do not invalidate Nx's
  computation cache for those projects.
- Recommendation (optional): if a consumer wants brain's docs explicitly
  excluded from `sharedGlobals`, add `!{workspaceRoot}/brain/**` to the relevant
  named input. Not required for correctness — only to avoid cache-key churn when
  brain docs change.

### 3. Root `package.json` alias coexistence

- brain contributes only a small set of script *aliases* (`brain:upgrade`,
  `brain:env:init`, `brain:day:start`, `brain:ticket:start`, …) that point at
  `node_modules/brain/brain/scripts/…` or `./brain/scripts/…`.
- Verified on `synergy`: of its 21 root scripts, **none** are brain-like, so
  there is no name clash. Nx's own targets (`nx build`, `nx test`, …) live in
  the task graph, not as root `package.json` script names, so they never
  collide with brain's verbs.
- brain merges — never overwrites — config it shares with the consumer:
  `.claude/settings.json` is additively merged (S1), preserving the consumer's
  `permissions.allow` and any pre-existing hooks.

## Validation summary

| Check | Result on `synergy` (`test-brain`) |
|-------|-------------------------------------|
| `brain:upgrade --dry-run` exit code | `0` |
| Collisions reported | `0` |
| `.claude/settings.json` | merged, `permissions.allow` (60 entries) preserved |
| Nx workspace-root files touched | none |
| Root `package.json` script clashes | none |
