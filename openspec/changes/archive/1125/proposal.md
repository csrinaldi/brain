---
status: draft
issue: 1125
parent: 1121
---

# Proposal — the default agent platform is `claude`; `antigravity` is the second supported platform

## Why

ADR-0024 made `antigravity` the default `AGENT_PLATFORM` and called it "a deliberate default".
The 2.0 epic (#1121) sets a different MVP support matrix: **`claude` is the default** and
**`antigravity` is the second supported platform**, the other one available for testing. The
maintainer ruled this on 2026-09-24 (ruling 3 on #1121).

ADR-0024's "Known state at acceptance" also hands the `day-start.mjs` hardcoding gap to #123.
#123 closed on 2026-08-13 without clearing it. `day-start.mjs` §3 still calls `gentle-ai`
directly, whatever `SDD_ENGINE` says. A signed ADR that points at a closed ticket for an open
gap reads as "handled", and nothing is handling it. #1114 is the cross-axis port invariant
with a guard, and it now owns the gap.

## What changes

1. **Doctrine (draft only).** `brain-drafts/adr-0024-amendment-2.draft.md` is a
   `brain-amendment/1` draft of ADR-0024 Amendment 2. It covers the new default, `antigravity`
   as the second supported platform, and the corrected "Known state" pointer to #1114. The
   maintainer promotes it with `brain:promote`. The agent does not.
2. **Code.** Every place that picks a platform when none is stated now picks `claude`:
   - `harness/platform.mjs#resolvePlatform`. The default and the membership become named
     exports, `DEFAULT_PLATFORM` and `AGENT_PLATFORMS`.
   - `bootstrap.sh` §6. It is a second resolver in shell, and it now has the same precedence
     and default as `resolvePlatform`. A parity test holds the two together until #1114 leaves
     one resolver.
3. **Tests.** Tests that pinned `antigravity` as the default, or used `claude` as the "stated"
   value in a way the new default would make vacuous, are updated with the reason. None are
   deleted.

## Out of scope

- #1114's single resolver per axis. This change keeps two resolvers, with a parity guard, and
  leaves comments that point at #1114.
- `brain.config.json`'s `harness` section on the `env:init` path. `bootstrap.sh` and
  `harness/cli.mjs` do not read it today, whatever the default is. See design.md, "Known
  gaps".
- Migrating existing consumers. The old `bootstrap.sh` wrote `AGENT_PLATFORM=antigravity` into
  their `.env`, so they keep `antigravity`. That is intended. The default applies only where
  nothing is stated.

## Acceptance (from #1125)

- The amendment is promoted (maintainer act).
- A fresh install with no platform stated resolves `claude` in every entrypoint, including
  `bootstrap.sh`. The packed-tarball check is in design.md, "ADR-0036 evidence".
