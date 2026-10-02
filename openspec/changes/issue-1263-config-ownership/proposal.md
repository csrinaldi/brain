# Proposal — #1263 who defines the project: an owned team config, a `~/.brain` user layer, and locked axes

## Problem
Nothing says who defines a project's team configuration. `brain.config.json` is written by whoever adopts brain, any PR can change it afterwards, and #1114 S3.3 lets any developer's `env:init` declare missing axes into it. ADR-0038 gives a person no layer of their own. See #1263.

## Decision
The maintainer's rulings on #1263 (2026-10-02) are recorded in the Tier 2 draft
`brain-drafts/adr-0040-who-defines-the-project-owned-team-config-a-user-layer-and-locked-axes.md`:
two layers by owner, the precedence `env > .env > ~/.brain > team > undeclared` with a providers union, per-axis `locked`, three moments (foundation, daily use, change), `governance.approvalActors` as the owner, and enforcement through a tiered gate with CODEOWNERS as an optional mirror. The maintainer's eight ratified points (2026-10-02) are folded in. A human promotes it.

## Scope (slices)
1. Read the `~/.brain` layer, merge it with the team layer and apply `locked` (`resolveAxis`).
2. `env:init` writes the user layer and never the team config in an existing repo. This corrects #1114 S3.3.
3. Adoption seeds `approvalActors`; the optional `CODEOWNERS` mirror is checked for drift against it.
4. The team-config approval gate: detection at `lite`, required at `standard` and `regulated`.

All four land on the #1114 tracker (`feature/issue-1114-axis-ports`) before it integrates into `main`, so S3.3's team-config writes never reach a release.

## Non-goals
Credentials in `~/.brain` (a separate decision, ruling 7).
