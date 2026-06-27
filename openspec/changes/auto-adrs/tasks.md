# Tasks: Auto-ADR Onboarding

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~390 total; per-PR: ~130 / ~80 / ~120 / ~60 |
| 400-line budget risk | Low per PR; Medium cumulative |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (S1 code) → PR2 (S2 command draft) → PR3 (S3 review+writes) → PR4 (S4 augment) |
| Delivery strategy | feature-branch-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Base branch |
|------|------|-----------|-------------|
| 1 | Slice 1 — gap seam + i18n + unit tests + in-container | PR1 | `feature/auto-adrs` (tracker) |
| 2 | Slice 2 — command file, phases 0-2 (detect + draft) | PR2 | `feature/auto-adrs-s1` |
| 3 | Slice 3 — phases 3-4 (review + Tier 2 writes) | PR3 | `feature/auto-adrs-s2` |
| 4 | Slice 4 — augment / idempotency | PR4 | `feature/auto-adrs-s3` |

### Chained-PR Branch Plan (feature-branch-chain)

- Tracker: `feature/auto-adrs` — accumulates all slices; only this merges to `main`
- PR1: `feature/auto-adrs-s1` → targets tracker
- PR2: `feature/auto-adrs-s2` → targets `feature/auto-adrs-s1`
- PR3: `feature/auto-adrs-s3` → targets `feature/auto-adrs-s2`
- PR4: `feature/auto-adrs-s4` → targets `feature/auto-adrs-s3`

---

## Slice 1 — Bootstrap gap detection (Code; Strict TDD)

> REQ-S1-1, REQ-S1-2, REQ-S1-3 | Branch: `feature/auto-adrs-s1` | CI: `npm test`

### Phase 1: RED — Failing tests first (all must fail before Phase 2)

- [x] 1.1 `gentle-ai.test.mjs`: add test "absent decisions dir → gap notice logged" — inject `_checkDecisionsDir: () => false`, assert `console.log` output contains "No project ADRs"
- [x] 1.2 Add test "empty decisions dir (no .md files) → gap notice logged" — same assert, seam returns `false`
- [x] 1.3 Add test "populated decisions dir (≥1 .md) → no notice" — inject seam returning `true`, assert notice absent
- [x] 1.4 Add test "Step 4 runs independently of engram: notice fires even when `_resolveProject` returns null (checkSddContext early-return does not skip Step 4)"
- [x] 1.5 Add test "existing engram-context notice (Step 3) still fires unchanged after checkSddContext() refactor" — regression guard

### Phase 2: GREEN — Implement seam in `scripts/harness/backends/gentle-ai.mjs`

- [x] 2.1 Add `readdirSync` to `import { readFileSync, existsSync } from 'node:fs'`
- [x] 2.2 Add `_defaultResolveDecisionsDir()`: `return join(repoRoot, 'brain', 'project', 'decisions')`
- [x] 2.3 Add `_defaultCheckDecisionsDir(dir)`: `try { if (!existsSync(dir)) return false; return readdirSync(dir).some(f => f.endsWith('.md')); } catch { return false; }`
- [x] 2.4 Extract current Step 3 body into internal `function checkSddContext({ _resolveProject, _checkEngram, _runEngramSearch })` — bare `return`s now scope to the helper, not `init()`
- [x] 2.5 Add `_resolveDecisionsDir = _defaultResolveDecisionsDir` and `_checkDecisionsDir = _defaultCheckDecisionsDir` to `init()` param list with defaults; call `await checkSddContext(...)` where Step 3 was
- [x] 2.6 Add Step 4 after `checkSddContext()` call: fires `t('bootstrap.sdd.noProjectAdrs')` + `t('bootstrap.sdd.noProjectAdrsHint')` via `console.log` when `!adrsPresent`
- [x] 2.7 Run `npm test` — all prior tests still pass + Phase 1 tests now green (251 total, +5)

### Phase 3: i18n parity (en.mjs + es.mjs)

- [x] 3.1 `scripts/i18n/en.mjs` §6: add `'bootstrap.sdd.noProjectAdrs': 'No project ADRs found (brain/project/decisions/ is empty or absent).'`
- [x] 3.2 `scripts/i18n/en.mjs` §6: add `'bootstrap.sdd.noProjectAdrsHint': 'Run /project:bootstrap-adrs in your AI agent to draft the starter ADR set (Stack, Testing, Build).'`
- [x] 3.3 `scripts/i18n/es.mjs` §6: add Spanish equivalent for `bootstrap.sdd.noProjectAdrs`
- [x] 3.4 `scripts/i18n/es.mjs` §6: add Spanish equivalent for `bootstrap.sdd.noProjectAdrsHint`
- [x] 3.5 Run `npm test` — `scripts/i18n/coverage.test.mjs` passes (no missing-key gaps)

### Phase 4: Fresh-install integration assertion

- [x] 4.1 `test/fresh-install/in-container.sh`: add `[4]` block after `[3]` — re-run `npm run env:init` capturing stdout, assert `grep -q "No project ADRs"` passes; `ok "gap notice appears"` else `fail "gap notice missing"` (samples-of-html5 has no `brain/project/decisions/` so notice fires)

---

## Slice 2 — Agent command: explore + draft (Command authoring; NOT unit-testable via `node --test`)

> REQ-S2-1 through REQ-S2-5 | Branch: `feature/auto-adrs-s2` | Verification: Manual E2E below

### Phase 5: Scaffold

- [x] 5.1 Create `openspec/changes/auto-adrs/brain-drafts/.gitkeep` — makes Tier 1 draft output directory trackable in git

### Phase 6: Author `.claude/commands/project-bootstrap-adrs.md` (phases 0-2 only)

- [x] 6.1 Write frontmatter: `name: project-bootstrap-adrs`, `description: "..."` — do NOT include `delegate_only: true`
- [x] 6.2 Write Phase 0 (preflight): resolve repoRoot via `import.meta.url`; read `brain.config.json` → `docs.language` (default `en`) and `project.slug`; scan `brain/project/decisions/` for `adr-(\d{4})-*.md`; compute `maxNNNN`; set `nextNNNN = maxNNNN + 1` (empty dir → `0001`)
- [x] 6.3 Write Phase 1 (detect, Tier 1): `mem_search("sdd-init/<project>") → mem_get_observation` to read engram-cached signals for Stack/Testing/Build; fallback to direct file scan (`package.json`, `tsconfig.json`, lock files, `go.mod`, `pyproject.toml`, `Cargo.toml`, `Gemfile`, `composer.json`) using the detection→ADR mapping from design
- [x] 6.4 Write Phase 2 (draft, Tier 1): for each detected topic write `openspec/changes/auto-adrs/brain-drafts/adr-NNNN-<slug>.md` using template: title, `**Status**: Proposed`, `**Date**: <today>`, `## Decision\n<detected facts>`, `## Context\n<TODO: ...>`, `## Consequences\n<TODO: ...>`; language follows `docs.language`; numbers assigned sequentially at draft time
- [x] 6.5 Add graceful degradation: if a topic yields zero signal from all sources, skip that ADR and report "no signal detected for <topic>" to user — never write an empty stub

### Phase 7: Manual E2E checklist (Slice 2)

- [ ] 7.1 Run `/project:bootstrap-adrs` in samples-of-html5 (no existing decisions/); assert exactly 3 `.md` files under `openspec/changes/auto-adrs/brain-drafts/`
- [ ] 7.2 Assert no new or modified file under `brain/` after command completes (REQ-S2-2)
- [ ] 7.3 Assert draft filenames carry correct NNNN: starts at `max(existing)+1`, sequential, zero-padded 4 digits; no collision with any existing NNNN (REQ-S2-3)
- [ ] 7.4 Inspect each draft: `## Decision` contains detected technology facts; `## Context` and `## Consequences` both contain `<TODO>`; no "chosen over" / "because" claim not traceable to a repo file (REQ-S2-4)
- [ ] 7.5 Set `docs.language: "es"` in brain.config.json; re-run; assert ADR prose is in Spanish (REQ-S2-5)

---

## Slice 3 — Interactive review + Tier 2 writes (Command behavior extension; NOT unit-testable)

> REQ-S3-1 through REQ-S3-4, REQ-E-1 | Branch: `feature/auto-adrs-s3` | Verification: Manual E2E below

### Phase 8: Extend `.claude/commands/project-bootstrap-adrs.md` with Phase 3 + Phase 4

- [ ] 8.1 Add Phase 3 (interactive review): present each draft with a 2-3 sentence summary and exactly four choices: `accept | edit [feedback] | reject | accept-all`
- [ ] 8.2 Document `edit [feedback]` flow: revise draft in `brain-drafts/` incorporating feedback, re-present; loop until `accept` or `reject`
- [ ] 8.3 Document `reject` flow: discard draft; zero writes to `brain/`; no HOME.md entry for that ADR
- [ ] 8.4 Document `accept-all` gate: option is NEVER surfaced until user explicitly states they reviewed the drafts; if user types `accept-all` before that assertion, decline and ask for the confirmation first (REQ-S3-4)
- [ ] 8.5 Add Phase 4 (Tier 2 writes): for each accepted ADR, request explicit per-action user confirmation before writing `brain/project/decisions/adr-NNNN-<slug>.md`; `accept-all` path collapses to one batched Tier 2 confirmation after the "I reviewed" gate
- [ ] 8.6 Add HOME.md patch: read `brain/HOME.md`, locate `### Architecture decisions` list, append after last `- [ADR-NNNN](...)` entry in exact format: `- [ADR-NNNN](project/decisions/adr-NNNN-<slug>.md) — <short description>`; patch is gated by Tier 2 confirmation
- [ ] 8.7 Add HOME.md fail-safe: if `### Architecture decisions` anchor or trailing ADR link line cannot be located unambiguously → abort patch, leave HOME.md untouched, report exact lines to add manually; never produce an orphaned ADR (REQ-S3-3)
- [ ] 8.8 Add post-write recommendation: suggest `npm run brain:nav` to verify no orphans

### Phase 9: Manual E2E checklist (Slice 3)

- [ ] 9.1 `accept` one ADR + confirm Tier 2 → assert `brain/project/decisions/adr-NNNN-<slug>.md` created; run `npm run brain:nav` → assert green (REQ-S3-2, REQ-S3-3)
- [ ] 9.2 `reject` one ADR → assert no file written under `brain/`; HOME.md unchanged (REQ-S3-1)
- [ ] 9.3 `edit "change testing reference to Vitest"` → assert draft revised and re-presented before final choice (REQ-S3-1)
- [ ] 9.4 Type `accept-all` without "I reviewed" first → assert command declines and prompts for review confirmation (REQ-S3-4)
- [ ] 9.5 State "I reviewed all drafts" then `accept-all` → assert single batch Tier 2 confirmation; all non-rejected ADRs written; HOME.md patched; `brain:nav` green (REQ-S3-4)
- [ ] 9.6 Use HOME.md with no `### Architecture decisions` section → assert HOME.md untouched; agent reports exact lines to add manually (REQ-S3-3)

---

## Slice 4 — Idempotency / Augment (Command behavior extension; NOT unit-testable)

> REQ-S4-1, REQ-S4-2 | Branch: `feature/auto-adrs-s4` | Verification: Manual E2E below

### Phase 10: Extend Phase 0 with coverage detection

- [ ] 10.1 Compute topic coverage: keyword-match each existing ADR title/slug against design keyword sets — Stack: `stack/framework/frontend/backend/language` + known framework names (react/vue/angular/nest/express/next/svelte); Testing: `test/testing/coverage/tdd` + known runner names (jest/vitest/mocha/playwright/cypress); Build: `build/bundl/package.manager` + known bundler/PM names (vite/webpack/rollup/esbuild/tsup/pnpm/yarn/npm/bun)
- [ ] 10.2 Present coverage assessment to user before drafting: list topics as covered/uncovered; ask user to confirm or override; never silently skip
- [ ] 10.3 Draft only uncovered topics: skip Phase 1-2 for any topic the user confirms as already covered
- [ ] 10.4 Full-coverage clean exit: when all 3 topics confirmed covered, print "All starter ADR topics are already covered. No drafts needed." and exit without writing any files to `brain-drafts/`

### Phase 11: Manual E2E checklist (Slice 4)

- [ ] 11.1 Run with `brain/project/decisions/` containing only `adr-0001-stack.md` → assert 2 drafts in brain-drafts/ (Testing + Build only); assert Stack draft NOT generated; assert coverage assessment was presented before drafting (REQ-S4-1)
- [ ] 11.2 Run with all 3 topics covered → assert 0 drafts written; "no gaps found" (or equivalent) message displayed; brain-drafts/ unchanged (REQ-S4-2)
- [ ] 11.3 Verify coverage assessment requires user confirmation before drafting begins — command must not silently skip a topic without presenting the assessment (REQ-S4-1)

---

## Closure Checklist

- [ ] C.1 `npm test` green — all `scripts/**/*.test.mjs` pass, including new Slice 1 tests
- [ ] C.2 `npm run brain:nav` green — no orphaned ADRs after any accept flow
- [ ] C.3 Epic invariant audit (REQ-E-1): search codebase for any write path to `brain/project/decisions/` or `brain/HOME.md` introduced by this feature; confirm every path is behind an explicit Tier 2 human confirmation gate
