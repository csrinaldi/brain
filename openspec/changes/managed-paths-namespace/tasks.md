# Tasks: Managed-Paths Namespace & Merge Safety (issue #97)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | S1 ~150 · S2 ~100 · S3 ~700 (mechanical) · S4 ~50 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (S1) → PR2 (S2) → PR3 (S3, size:exception) → PR4 (S4) |
| Delivery strategy | feature-branch-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**S3 size:exception rationale**: 87 file moves + ~74 refs cannot be split — any partial state
breaks brain's self-hosted tooling (`core.hooksPath`, package aliases, inter-script calls
all diverge simultaneously). Revert = one clean commit. Reviewer load is mechanical
(search/replace + `git mv`), not architectural complexity.

### Suggested Work Units

| Unit | Goal | PR base | Notes |
|------|------|---------|-------|
| S1 | mergeClaudeSettings + wiring | `feature/issue-97-managed-paths` (tracker) | TDD; independently shippable |
| S2 | Collision guard + `--abort-on-collision` | S1 branch | TDD; independently shippable |
| S3 | Atomic `scripts/` → `brain/scripts/` rename | S2 branch | ONE commit; size:exception |
| S4 | Synergy dry-run validation + NX docs | S3 branch | Manual acceptance gate |

---

## S1 — settings.json Merge (TDD) [REQ-S1-1..5]

- [x] 1.1 **[RED]** `scripts/lib/installer.test.mjs`: failing tests for `mergeClaudeSettings()` — fresh consumer writes as-is (REQ-S1-1); 63-entry `permissions.allow` preserved + brain hooks present (REQ-S1-2); custom consumer hook preserved (REQ-S1-2); idempotent re-run = no duplication (REQ-S1-3); `settings.local.json` absent from managed export (REQ-S1-4); `settings.json` not passed to `copyFileSync` (REQ-S1-5). `npm test` → RED.
- [x] 1.2 **[GREEN]** `scripts/lib/installer.mjs`: implement `mergeClaudeSettings(existingPath, brainSettingsPath)` — no dest → write brain's block as-is; dest exists → `{...consumerObj}`, additively append brain's `hooks.PreToolUse` entries deduped by `JSON.stringify`, preserve `permissions.allow` and all other keys. `npm test` → GREEN.
- [x] 1.3 `scripts/lib/installer.mjs` `copyManaged()`: add `specialMerge?: Record<relPath, mergeFn>` to opts; if managed path matches key → call `mergeFn(destPath, srcPath)` instead of `copyFileSync`; add `merged: string[]` to result object; `--dry-run` labels as `merged` not `copied`.
- [x] 1.4 `scripts/brain-upgrade.mjs`: pass `specialMerge: { '.claude/settings.json': mergeClaudeSettings }` into `copyManaged()`; surface `merged[]` and `collisions[]` in upgrade summary output.
- [ ] 1.5 `npm test` → zero. Open PR1 → base `feature/issue-97-managed-paths`.

## S2 — Collision Guard (TDD) [REQ-S2-1..3]

- [x] 2.1 **[RED]** `scripts/lib/installer.test.mjs`: failing tests — collision recorded when dest≠src (REQ-S2-1); collision report printed before first write (REQ-S2-1); `--abort-on-collision` exits non-zero + zero write calls (REQ-S2-2); no-op when all clean (REQ-S2-2); absent dest = no collision (REQ-S2-3); identical dest = no collision (REQ-S2-3); `specialMerge` paths excluded from guard. `npm test` → RED.
- [x] 2.2 **[GREEN]** `scripts/lib/installer.mjs` `copyManaged()`: before any write, for each managed path NOT in `specialMerge` — if dest exists AND bytes differ → push to `collisions[]`; return `collisions: string[]` in result. Pre-flight runs before writes begin.
- [x] 2.3 `scripts/brain-upgrade.mjs`: parse `--abort-on-collision` from argv; if `collisions.length > 0 && abortOnCollision` → print report, `process.exit(1)`, zero writes; default → print warning, proceed (current behavior preserved).
- [ ] 2.4 `npm test` → zero. Open PR2 → base PR1 branch.

## S3 — Atomic Rename (ONE commit) [REQ-S3-1..6]

Stage steps 3.1–3.6, verify gates 3.7–3.8, then ONE commit (3.9). No intermediate commits.

- [x] 3.1 `git mv scripts/ brain/scripts/` — stage all 87 file moves.
- [x] 3.2 Apply design §S3 Reference-Update MAP (~74 refs / ~20 files):
  - `package.json`: 28 aliases `./scripts/X` → `./brain/scripts/X`; test glob `scripts/**/*.test.mjs` → `brain/scripts/**/*.test.mjs`.
  - `brain/scripts/bootstrap.sh` §7 (`git config core.hooksPath`) + `brain/scripts/day-start.mjs` `const HOOKS_PATH`: `scripts/hooks` → `brain/scripts/hooks`.
  - `brain/core/managed-paths.mjs`: `'scripts/**'` → `'brain/scripts/**'`. [REQ-S3-1, REQ-S3-3]
  - Inter-script calls in `brain/scripts/bootstrap.sh` (~9), `day-start.mjs` (4 spawn), `install-tools.sh`, `brain-save.mjs`, `brain-next.mjs`, `memory/lib/auto-resume.mjs`.
  - Hook calls in `brain/scripts/hooks/pre-push` (4), `pre-commit` (1), `post-merge` (1): `$repo_root/scripts/` → `$repo_root/brain/scripts/`.
  - Scope matchers in `brain/scripts/verify-change.mjs` (2), `brain/project/check-refs-rules.mjs` (2), `brain/scripts/check-refs.mjs` (1).
  - `.github/workflows/governance.yml` (~line 76 + header comment ~line 5). (`governance-checks.mjs` syncs JOB NAMES only — no path change needed; audit confirmed.)
- [x] 3.3 Bootstrap install alias in README, fixtures, container scripts: `node_modules/brain/scripts/` → `node_modules/brain/brain/scripts/` (double `brain/`, intentional).
- [x] 3.4 Test container scripts `test/fresh-install/in-container.sh` + `test/upgrade/in-container.sh`: 8 path refs → `brain/scripts/`.
- [x] 3.5 Test fixtures `test/fixtures/{npm,pnpm,bun,yarn}/package.json`: 8 alias entries → `./brain/scripts/`.
- [x] 3.6 Test assertions (~15): `scripts/lib/installer.test.mjs` (5), `scripts/check-refs.test.mjs` (3), `scripts/governance/checks/diff-size.test.mjs` + `scripts/vcs/diff-size-count.test.mjs` (4), `scripts/i18n/coverage.test.mjs` (2), `scripts/lib/managed-paths.test.mjs` (1). Also update README + `openspec/` docs + `docs/inbox` headers (~85 non-breaking doc refs).
- [x] 3.7 `CHANGELOG.md`: add breaking-change entry — (a) delete orphaned root `scripts/` after upgrading; (b) new bootstrap path `node_modules/brain/brain/scripts/brain-upgrade.mjs`; (c) required order `brain:upgrade` → `day:start`/`env:init`; (d) `core.hooksPath` stale-window + self-heal explanation. [REQ-S3-4, REQ-S3-5]
- [x] 3.8 Write/update ADR-0006 under `docs/decisions/`: 3-pillar model (`brain/core` / `brain/project` / `brain/scripts`), `brain/scripts/` namespace rationale, merge-don't-overwrite policy for managed config.
- [x] 3.9 **Gate**: `npm test` + `npm run repo:check` + `npm run brain:nav` → all exit zero.
- [ ] 3.10 **Gate**: Docker `test/fresh-install/in-container.sh` + `test/upgrade/in-container.sh` → both pass. [REQ-S3-2 integration scenarios]
- [ ] 3.11 ONE `git commit` all staged (3.1–3.8). Verify `git show HEAD --stat` lists both moved files and updated references in same commit. Open PR3 → base PR2 branch; label `size:exception`. [REQ-S3-6]

## S4 — Synergy Validation (manual) [REQ-S4-1, REQ-E-1]

- [ ] 4.1 Run `brain:upgrade --dry-run --cwd /home/gandalf/IA/synergy` → assert zero collision records in output, exit zero. [REQ-S4-1]
- [ ] 4.2 Write `docs/inbox/nx-coexistence.md`: workspace-root non-interference, `namedInputs` non-interference, root `package.json` alias coexistence notes.
- [ ] 4.3 Verify README 3-pillar diagram reflects completed `brain/core` + `brain/project` + `brain/scripts` split.
- [ ] 4.4 **Epic closure (REQ-E-1)**: confirm synergy's 63-entry `permissions.allow` intact after upgrade + zero unexpected overwrites. Open PR4 → base PR3 branch.

---

## Closure Checklist

- [ ] Epic invariant: no consumer-owned file overwritten via `copyFileSync` at any point (verified by 1.2 + 2.2 + 3.5 together).
- [ ] Synergy dry-run (4.1) reports zero collisions.
- [ ] All PRs in order: PR1 → PR2 → PR3 (size:exception) → PR4 → tracker merges to `main`.

**Version-bump decision**: S3 is a BREAKING change. Exact semver (minor or major bump) is deferred to release time. CHANGELOG entry in 3.7 documents the breaking nature; bump number chosen at release.
