# Proposal — Managed-Paths Namespace & Merge Safety (issue #97)

> **Status:** Proposed · **Branch (tracker):** feature/issue-97-managed-paths · **Issue:** #97 (managed-paths collision)
> **Relates to:** [managed-paths.mjs](../../../brain/core/managed-paths.mjs), [installer.mjs](../../../scripts/lib/installer.mjs), [brain-upgrade.mjs](../../../scripts/brain-upgrade.mjs), [day-start.mjs](../../../scripts/day-start.mjs), [bootstrap.sh](../../../scripts/bootstrap.sh) · **ADR:** likely ADR-0006 update (managed-paths model) or a new ADR — see note below

## Context

brain governs a consumer repo by **copying a set of managed paths** into it on `brain:upgrade`. The managed list (`brain/core/managed-paths.mjs`) was authored against brain's own repo, where every managed path is brain-owned. The Docker-based install tests reproduce that same assumption — they install into a **fresh, empty** container, so no managed path ever collides with pre-existing consumer content. **The tests are green because the test environment has nothing to collide with.**

A real install attempt into the NX monorepo at `/home/gandalf/IA/synergy` exposed two collisions the test harness structurally cannot see:

**Collision A — `.claude/settings.json` is OVERWRITTEN (catastrophic, silent data loss).**
`installer.mjs:copyManaged()` does a plain `copyFileSync(src, dest)`. brain's `.claude/settings.json` is 15 lines — only the `hooks.PreToolUse` block (the `--no-verify` guard). synergy's `.claude/settings.json` is 4.7 KB / **63 `permissions.allow` entries**. An upgrade would silently destroy the entire allowlist and every other consumer hook. (`settings.local.json` happens to survive — it is not a managed path — but the primary config is gone.)

**Collision B — `scripts/**` claims the consumer's ROOT `scripts/` directory.**
brain dumps **87 files** into the consumer's `scripts/`. synergy has no `scripts/` today, so it would simply appear; a consumer that already owns `scripts/` (the common case) gets 87 brain files interleaved with theirs, and any shared filename (e.g. `scripts/bootstrap.sh`) is silently overwritten. The consumer's own `scripts/` is no longer theirs.

**Root cause (single):** brain treats two consumer-owned surfaces as brain-managed. The fix is to (1) stop overwriting `.claude/settings.json` by **merging** instead, (2) move brain's harness scripts out of the consumer's namespace into **`brain/scripts/`**, and (3) add a general **pre-upgrade collision guard** so the next undiscovered collision fails loud instead of silently destroying data.

**Namespace decision (settled): `brain/scripts/`.** This completes brain's 3-pillar managed model — `brain/core` (managed methodology), `brain/project` (consumer-owned overrides), `brain/scripts` (managed harness verbs). `.brain/` was rejected: same blast radius, no benefit, awkward hidden-dir pattern. Keeping `scripts/` was rejected: zero blast but does not fix the collision. After the move, the consumer's root `scripts/` is theirs again.

## What to Build

Four slices, **chained PRs, feature-branch-chain** (tracker `feature/issue-97-managed-paths`), ordered **highest-value-first** — Slice 1 stops active data loss before anything else.

### Slice 1 — `.claude/settings.json` MERGE, not overwrite (~150 lines) — STOPS DATA LOSS
Add `mergeClaudeSettings(existingPath, brainSettings)` to `installer.mjs`: additively insert brain's `hooks.PreToolUse` entries into the consumer's existing `settings.json`, **deduped by serialized entry**, preserving `permissions.allow` and every other consumer key/hook. Fresh consumer (no file) → write brain's block as-is. Wire it into `brain-upgrade.mjs` so `.claude/settings.json` is routed through the merge instead of the raw `copyManaged` copy (gate it out of the plain-copy path). `settings.local.json` stays untouched (never managed). Unit tests including a fixture with a pre-existing 63-entry allowlist proving zero clobber. **Independently shippable and the highest-value change in the set.**

### Slice 2 — Pre-upgrade collision guard (~100 lines) — GENERAL BACKSTOP
Add a pre-flight check in `copyManaged()`: before overwriting, when the destination exists **and differs** from the incoming brain file, record it and surface a prominent pre-flight collision report. Add a `--abort-on-collision` flag to `brain-upgrade.mjs` (refuse to write when any managed path would clobber differing consumer content). This is the general safety net for **every** managed path, so the next undiscovered collision fails loud. Unit tests for the guard logic.

### Slice 3 — `scripts/` → `brain/scripts/` ATOMIC rename — BREAKING, single commit
`git mv scripts/ brain/scripts/` (87 files) **plus** all reference updates in **one atomic commit**:
- ~74 critical runtime references across ~20 files: 28 `package.json` script aliases, `bootstrap.sh` (incl. `git config core.hooksPath`), `install-tools.sh`, `day-start.mjs` (`HOOKS_PATH` self-heal), the hooks (`pre-push`/`pre-commit`/`post-merge`), `brain-save.mjs`, `brain-next.mjs`, `auto-resume.mjs`, `managed-paths.mjs` (the `'scripts/**'` entry), `verify-change.mjs` scope matcher, `check-refs.mjs` + `check-refs-rules.mjs` exempt lists, the test-container scripts, and the 4 test fixtures.
- ~15 test assertions across 6 test files.
- README, CHANGELOG (migration note — see below).

**Must be a single atomic commit.** brain runs its own scripts; a half-renamed state breaks brain's own workflows. Prepare everything on the branch, verify tests green, merge as one commit.

### Slice 4 — Synergy validation (docs / dry-run, not code)
Run `brain:upgrade --dry-run` against `/home/gandalf/IA/synergy` after S1–S3 and confirm **zero collisions**. Document NX monorepo integration notes (workspace-root coexistence, `namedInputs` non-interference, root-`package.json` alias coexistence). Verify the 3-pillar README diagram still reads correctly.

## Out of Scope (Non-Goals)

- **Deeper NX-specific integration** beyond the dry-run validation (per-project targets, affected-graph wiring, NX generators for brain) — a follow-up if synergy adoption proceeds.
- **`.brain/` or any alternate namespace** — `brain/scripts/` is settled.
- **Auto-deleting the consumer's orphaned root `scripts/`** after the rename — the installer never deletes consumer files; cleanup is a documented manual step (CHANGELOG), not automated.
- **Touching `settings.local.json`** — out of scope by design; it is never managed.
- **Migrating other managed paths** — only the two colliding surfaces (`.claude/settings.json`, `scripts/**`) are in scope.

## Acceptance Criteria

**Slice 1**
- [ ] `mergeClaudeSettings()` on a consumer file with a 63-entry `permissions.allow` preserves all 63 entries and every non-brain hook.
- [ ] brain's `hooks.PreToolUse` entries are present after merge, with **no duplicates** on a second upgrade (dedup proven).
- [ ] Fresh consumer (no `settings.json`) receives brain's hook block as-is.
- [ ] Fixture test with a pre-existing `settings.json` proves **no clobber**.
- [ ] `settings.local.json` is byte-identical before and after upgrade.

**Slice 2**
- [ ] Pre-flight report lists every managed path whose destination exists and differs from the incoming brain content.
- [ ] `--abort-on-collision` refuses to write and exits non-zero when any such collision is detected.
- [ ] No false positives when destination is identical or absent.

**Slice 3**
- [ ] All 87 files live under `brain/scripts/`; no file remains under root `scripts/` in brain's repo.
- [ ] `npm test` green; brain's own `day:start`, hooks, and verbs run from `brain/scripts/`.
- [ ] `core.hooksPath` resolves correctly after a fresh `bootstrap.sh` / `env:init`.
- [ ] Single atomic commit (git history shows the move + reference updates together).
- [ ] CHANGELOG documents the breaking change + consumer migration step.

**Slice 4**
- [ ] `brain:upgrade --dry-run` on synergy reports **zero collisions**.
- [ ] NX integration notes written; README 3-pillar diagram verified.

## Breaking Change & Migration (Slice 3)

**This is a BREAKING CHANGE for existing consumers.** A consumer that already installed brain has brain's scripts at root `scripts/`. After upgrading to the renamed version, `brain:upgrade` writes to `brain/scripts/` and **leaves the old root `scripts/` orphaned**. The bootstrap/alias path changes from `node_modules/brain/scripts/...` to `node_modules/brain/brain/scripts/...` (the double `brain/` is intentional and correct).

**CHANGELOG MUST document:**
- "After upgrading to vX.Y.Z, delete the orphaned root `scripts/` directory."
- Updated alias paths (`node_modules/brain/brain/scripts/...`).
- The required upgrade order (below).

**Version bump:** the breaking surface warrants a **minor or major** bump. We note this here and **defer the exact number to release** time.

**`core.hooksPath` one-time window:** `core.hooksPath` is per-clone (not committed). After `brain:upgrade` to the renamed version but **before** the next `env:init` / `day:start`, hooks still point at the stale `scripts/hooks` path → a brief "no hooks" window. It **self-heals on the next `day:start`** (which reconfigures `core.hooksPath` to `brain/scripts/hooks`). Required order: `brain:upgrade` → `day:start`/`env:init`. Document in the upgrade notes.

## Rollback Plan

- **S1**: `mergeClaudeSettings()` is additive and side-effect-free on consumer keys; revert the function + wiring to restore prior behavior. No data migration.
- **S2**: the guard is read-only pre-flight + an opt-in flag; revert removes it with no state change.
- **S3**: revert the single atomic commit to restore root `scripts/`. Because it is one commit, rollback is clean — no half-renamed state. Consumers who already deleted their orphaned `scripts/` re-receive it on the next upgrade.
- **S4**: docs/dry-run only — nothing to roll back.

## Note on ADR

This change alters brain's **managed-paths model** (the contract for what brain owns vs. what the consumer owns) and establishes the **merge-don't-overwrite** rule for consumer-shared config. That is an architectural decision and should be recorded — most likely as an **update to ADR-0006 (managed-paths model)**, or a new ADR if the existing one does not cover the 3-pillar `core`/`project`/`scripts` split and the merge-vs-overwrite policy. To be authored alongside Slice 3 (the structural change). This proposal does not author it — it flags the requirement.
