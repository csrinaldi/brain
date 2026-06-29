# Design: Managed-Paths Namespace & Merge Safety (issue #97)

## Technical Approach

Two consumer-owned surfaces are wrongly treated as `managed` and clobbered on
`brain:upgrade`: `.claude/settings.json` (plain `copyFileSync` overwrite) and
root `scripts/**`. Fix them with three composable mechanisms, shipped as 4
chained PRs (feature-branch-chain, tracker `feature/issue-97-managed-paths`):

- **S1 — merge, don't overwrite** `.claude/settings.json` (`mergeClaudeSettings`).
- **S2 — collision guard**: pre-flight diff in `copyManaged()` + `--abort-on-collision`.
- **S3 — atomic namespace rename** `scripts/` → `brain/scripts/`.
- **S4 — synergy dry-run validation** (docs only).

S1/S2 stop data loss without touching the namespace; S3 removes the collision
structurally. The merge and the guard MUST be composable: `.claude/settings.json`
takes the merge path and is therefore EXCLUDED from the collision guard.

## Architecture Decisions

### Decision: settings.json — special-merge map in the installer API
**Choice**: Add a `specialMerge` map to `copyManaged()`: `{ relPath → mergeFn }`.
When a managed file matches a key, the installer calls `mergeFn(destPath, srcPath)`
and writes the result instead of `copyFileSync`. `.claude/settings.json` stays in
`managed` (still distributed, still drift-checked) but routes through
`mergeClaudeSettings`.
**Alternatives considered**: (a) remove `.claude/settings.json` from `managed` and
merge it as a bespoke post-copy step in `brain-upgrade.mjs`; (b) keep raw copy.
**Rationale**: A `specialMerge` map keeps the copy/skip/merge policy in ONE place
(`installer.mjs`, unit-testable without a real upgrade), mirrors the existing
`mergeDefaults`/`migrateConfig` seam, and generalizes to future mergeable managed
files. Option (a) scatters policy across the orchestrator and silently breaks the
drift guard; (b) is the bug. `--dry-run` reports merges as `merged` distinct from
`copied`.

### Decision: mergeClaudeSettings mirrors mergeDefaults (existing wins, additive)
**Choice**: Fresh consumer (no dest) → write brain's settings as-is. Existing dest
→ spread the consumer object, additively append brain's `hooks.PreToolUse` entries
deduped by `JSON.stringify`, preserve `permissions.allow` and every other key.
**Alternatives considered**: deep-merge everything; replace only `hooks`.
**Rationale**: brain only OWNS the PreToolUse hook block (ADR-0014 §9). Everything
else (`permissions.allow`, `settings.local.json`) is consumer territory — same
"existing value wins" invariant as `mergeDefaults`. Dedup by serialized entry is
idempotent across repeated upgrades.

### Decision: Collision guard is a pre-flight, abort-before-write backstop
**Choice**: In `copyManaged()`, before writing, for each managed file that is NOT a
`specialMerge` target: if dest exists AND its bytes differ from src, collect
`{rel, ...}`. Return `collisions[]` in the result. `brain:upgrade` surfaces a
report; `--abort-on-collision` throws BEFORE any write (all-or-nothing). Default
(no flag): warn and proceed (current behavior preserved).
**Alternatives considered**: per-file prompt; compare against previous brain
version's bytes to detect "consumer edited a managed file".
**Rationale**: Pre-flight + abort-before-write gives a clean rollback boundary and
keeps the guard read-only/opt-in (safe revert). The "previous-version" refinement
is a future enhancement, out of scope here.

### Decision: S3 is ONE atomic commit (git mv → all refs → verify)
**Choice**: `git mv scripts/ brain/scripts/` (87 files) + every reference update +
test assertions in a SINGLE commit. Order within the commit prep: (1) `git mv`,
(2) rewrite all references, (3) run the full suite + a real dry-run before commit.
**Alternatives considered**: incremental rename (move subdirs over several commits).
**Rationale**: **Self-hosting**. Brain runs its own `scripts/` (hooks, `day:start`,
governance workflow). Any half-renamed state breaks brain's own tooling mid-flight
— `core.hooksPath`, package aliases, and inter-script calls would point at a path
that no longer exists. Atomicity is the dominant risk control; revert = revert one
clean commit.

### Decision: core.hooksPath transition is a documented one-time self-heal window
**Choice**: Do not migrate `core.hooksPath` in the installer. Document the required
order `brain:upgrade → day:start/env:init`. `day:start` self-heals: after the
constant becomes `brain/scripts/hooks`, it reconfigures `core.hooksPath` on next run.
**Rationale**: `core.hooksPath` is per-clone, not committed — the installer can't
and shouldn't write developer git config. The existing self-heal already exists;
the only gap is a single run between upgrade and next `day:start` where hooks point
at stale `scripts/hooks`. Acceptable, documented in upgrade notes.

## S3 Reference-Update MAP (~74 critical refs across ~20 files)

| Category | Transform | Files |
|----------|-----------|-------|
| package.json aliases (28) | `./scripts/X` → `./brain/scripts/X`; test glob `scripts/**/*.test.mjs` → `brain/scripts/**/*.test.mjs` | `package.json` |
| Bootstrap install alias | `node_modules/brain/scripts/...` → `node_modules/brain/brain/scripts/...` (double `brain/`, intentional) | README, fixtures, container scripts |
| `core.hooksPath` (THE coupling) | `scripts/hooks` → `brain/scripts/hooks` | `scripts/bootstrap.sh` §7 (`git config core.hooksPath`), `scripts/day-start.mjs` `const HOOKS_PATH` |
| managed-paths manifest | `'scripts/**'` → `'brain/scripts/**'` | `brain/core/managed-paths.mjs` |
| Inter-script calls | `$repo_root/scripts/...`, `node scripts/...` → `brain/scripts/...` | `bootstrap.sh` (~9 node calls), `day-start.mjs` (4 spawn calls), `install-tools.sh`, `brain-save.mjs`, `brain-next.mjs`, `memory/lib/auto-resume.mjs` |
| Hook calls | `$repo_root/scripts/...` → `$repo_root/brain/scripts/...` | `hooks/pre-push` (4), `pre-commit` (1), `post-merge` (1) |
| Scope matcher | `f.startsWith('scripts/')` → `'brain/scripts/'`; label `scripts/**` | `verify-change.mjs` (2), `brain/project/check-refs-rules.mjs` exempt list (2), `check-refs.mjs` exempt (1) |
| Governance workflow | `node scripts/vcs/diff-size-count.mjs` → `brain/scripts/...`; header comment `scripts/vcs/governance-checks.mjs` | `.github/workflows/governance.yml` (managed file; line ~76 + comment line ~5) |
| Governance drift-guard | No change to script paths — guard syncs JOB NAMES, not script paths. Verified `scripts/vcs/governance-checks.mjs` does not parse script paths from the YAML. | (audit only) |
| Test container scripts (8) | `scripts/...` → `brain/scripts/...` | `test/fresh-install/in-container.sh`, `test/upgrade/in-container.sh` |
| Test fixtures (8, 4 files) | fixture `package.json` aliases `./scripts/...` → `./brain/scripts/...` | `test/fixtures/*/package.json` |
| Test assertions (~15) | hardcoded `scripts/` paths, numstat strings, i18n `scripts/hooks` | `installer.test.mjs` (5), `check-refs.test.mjs` (3), `diff-size*.test.mjs` (4), `i18n/coverage.test.mjs` (2), `managed-paths.test.mjs` (1) |
| Docs (~85, non-breaking) | layer diagram, install commands, header comments | `README.md`, openspec docs, `docs/inbox`, source headers |

## Data Flow (upgrade)

    brain-upgrade.mjs ──→ copyManaged({ managed, local, specialMerge })
         │                      │
         │              for each managed file:
         │                ├─ local match?  → skip (consumer wins)
         │                ├─ specialMerge? → mergeClaudeSettings(dest, src) → write
         │                └─ dest≠src?     → collisions.push (guard)
         │                                    └─ --abort-on-collision → throw pre-write
         └──→ report { copied, merged, skipped, collisions }

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `scripts/lib/installer.mjs` | Modify | Add `mergeClaudeSettings()`, `specialMerge` param + collision detection in `copyManaged()` |
| `scripts/brain-upgrade.mjs` | Modify | Pass `specialMerge`, surface merged/collision report, `--abort-on-collision` flag |
| `brain/core/managed-paths.mjs` | Modify | (S3) `'scripts/**'` → `'brain/scripts/**'`; keep `.claude/settings.json` in `managed` |
| `scripts/` → `brain/scripts/` | Rename | (S3) `git mv` 87 files, atomic |
| ~20 reference files | Modify | (S3) per MAP above |
| Test files (~6) | Modify | New `mergeClaudeSettings`/guard tests (S1/S2) + assertion path updates (S3) |
| `CHANGELOG.md` | Modify | (S3) breaking note: delete orphaned root `scripts/` after upgrade |

## Interfaces / Contracts

```js
// installer.mjs
export function mergeClaudeSettings(existingPath, brainSettingsPath) { /* … */ }
// copyManaged opts gains: specialMerge?: Record<relPath, (destPath, srcPath) => object>
// copyManaged result gains: { merged: string[], collisions: string[] }
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `mergeClaudeSettings`: fresh→as-is; existing→63-entry allowlist preserved, hooks deduped | Fixture with synergy-shaped settings.json proves no clobber |
| Unit | Collision guard: detect dest≠src, `--abort-on-collision` throws before write; settings.json excluded | In-memory fixtures |
| Integration | Container fresh-install + upgrade with renamed paths | `test/*/in-container.sh` |
| Manual/E2E | `brain:upgrade --dry-run` on synergy = zero collisions (S4) | Read-only validation |

## Migration / Rollout

- **Existing consumers (S3)**: installer never deletes — orphaned root `scripts/`
  remains. CHANGELOG MUST instruct `delete scripts/ after upgrading to vX.Y.Z`.
  Version bump (minor/major) deferred to release.
- **hooksPath window**: documented order `brain:upgrade → day:start`; self-heals.
- **Rollback**: S1 additive (revert fn+wiring); S2 read-only/opt-in; S3 revert one
  atomic commit; S4 docs only.

## ADR Note (defer to S3)

S3 changes the managed-paths model (adds the `brain/scripts/` namespace, completing
the 3-pillar core/project/scripts split) and establishes the merge-don't-overwrite
principle for managed config. This warrants an **ADR-0006 update** (or new ADR),
to be **authored in S3 — NOT here**. This design only flags it.

## Out of Scope

Deeper NX integration beyond the S4 dry-run (follow-up); `.brain/` alternative;
auto-delete of orphaned `scripts/`; touching `settings.local.json` or other
managed paths.

## Open Questions

- [ ] Exact version-bump number (minor vs major) — deferred to release.
- [ ] Whether `specialMerge` should also feed the dry-run "would merge" preview
      with a content diff (nice-to-have, can land in S1 or defer).
