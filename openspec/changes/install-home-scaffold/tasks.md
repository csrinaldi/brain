# Tasks: Install-time HOME.md Scaffold

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450 total (Slice 1 ~230, Slice 2 ~220) |
| 400-line budget risk | High for single PR; Low per slice |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (Slice 1 — scaffold) → PR2 (Slice 2 — index helper + adapter rewire) |
| Delivery strategy | feature-branch-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base branch |
|------|------|-----------|-------------|
| 1 | Slice 1 — nav exclusion, template, `ensureHome`, `bootstrap.sh` wiring | PR1 | `feature/install-home-scaffold` (tracker) |
| 2 | Slice 2 — `insertAdrLink` helper + adapter rewire | PR2 | `feature/install-home-scaffold-s1` |

### Chained-PR Branch Plan (feature-branch-chain)

- Tracker: `feature/install-home-scaffold` — accumulates both slices; only this merges to `main`
- PR1: `feature/install-home-scaffold-s1` → targets tracker
- PR2: `feature/install-home-scaffold-s2` → targets `feature/install-home-scaffold-s1`

---

## Slice 1 — Scaffold (self-contained; REQ-1 through REQ-6 of `home-scaffold`)

> Branch: `feature/install-home-scaffold-s1` | CI: `npm test` + `npm run brain:nav`

### Phase 1: Nav exclusion (must land first — unblocks the template file)

- [x] 1.1 RED — `brain/scripts/check-brain-nav.test.mjs`: add case asserting a `.md` file under `brain/core/templates/` is neither reported as orphan nor dead-linked
- [x] 1.2 GREEN — `brain/scripts/check-brain-nav.mjs` L44: extend the `brainFiles` filter to also exclude `/templates/`, mirroring the existing `/__fixtures__/` skip

### Phase 2: Template content (REQ-4)

- [x] 2.1 Create `brain/core/templates/HOME.template.md` with the exact body from design Decision 2: `## Generic core` with 6 direct methodology links, `core/anti-patterns/README.md` link, empty `### Architecture decisions` heading, no `project/**` links, all prose in English (ADR-0009)

### Phase 3: `ensureHome` scaffold helper (REQ-1, REQ-2)

- [x] 3.1 RED — `brain/scripts/lib/home-scaffold.test.mjs` (model after `lib/brain-config.test.mjs`): test "absent HOME.md → `{created:true}`, file written with template content"
- [x] 3.2 RED — same file: test "existing HOME.md with arbitrary content → `{created:false}`, content byte-identical to before the call"
- [x] 3.3 RED — same file: test "second call on a just-created HOME.md → `{created:false}`, no rewrite"
- [x] 3.4 GREEN — Create `brain/scripts/lib/home-scaffold.mjs`: `ensureHome(root, { templatePath, write })` per design Decision 1 (existsSync guard, byte-verbatim copy, no token substitution, injectable `root`/`templatePath`/`write` seams) + main-module CLI guard (`node home-scaffold.mjs ensure`)
- [x] 3.5 Run `npm test` — Phase 3 tests green, no regressions

### Phase 4: Nav-integrity fixture (REQ-3, REQ-6)

- [x] 4.1 RED — new fixture test (model after `check-brain-nav.test.mjs` spawn pattern): `cpSync` real `check-brain-nav.mjs` + real `brain/core/` into a temp root, call `ensureHome(root)`, spawn the script, assert exit 0 with zero orphans/dead links
- [x] 4.2 GREEN — fix any reachability gap surfaced by 4.1 (expected to pass once Phase 1 + Phase 2 land; only diagnostic changes if it fails) — passed immediately, no gap found

### Phase 5: `managed-paths.mjs` scope check (REQ-6)

- [x] 5.1 RED — `brain/core/managed-paths.test.mjs` (or nearest existing suite): assert neither `managed` nor `local` arrays contain an entry matching `brain/HOME.md` or `HOME.md`
- [x] 5.2 Verify GREEN with no source change (spec requires absence, not addition) — confirm existing globs in `brain/core/managed-paths.mjs` do not accidentally match `HOME.md`

### Phase 6: `bootstrap.sh` wiring (REQ-5)

- [ ] 6.1 `brain/scripts/bootstrap.sh` ~L20: add `node brain/scripts/lib/home-scaffold.mjs ensure || true` beside the existing `brain-config.mjs ensure` call, with a short comment mirroring the existing convention
- [ ] 6.2 Manual verification: run `brain:env:init` twice on a fixture repo — first run creates `brain/HOME.md`, second run leaves it unchanged (REQ-5 scenarios)

### Phase 7 (optional, Docker-gated): Fresh-install assertion

- [ ] 7.1 `test/fresh-install/in-container.sh`: add a block after `env:init` asserting `brain/HOME.md` exists and `npm run brain:nav` exits 0

---

## Slice 2 — Index helper + adapter rewire (depends on Slice 1)

> Branch: `feature/install-home-scaffold-s2`, base `feature/install-home-scaffold-s1` | CI: `npm test` + `npm run brain:nav`

### Phase 8: `insertAdrLink` pure helper (REQ-1 through REQ-4 of `home-index`)

- [ ] 8.1 RED — `brain/scripts/lib/home-index.test.mjs` (model after `lib/branch-type.test.mjs`): test "section has no ADR line (empty heading) → insert immediately after heading, `inserted:true`"
- [ ] 8.2 RED — same file: test "section has ≥1 ADR link → insert new line immediately after the last one, prior lines unchanged"
- [ ] 8.3 RED — same file: test "`### Architecture decisions` heading absent → return input unchanged, `inserted:false`, `reason:'anchor-not-found'`, `linesToAdd` populated"
- [ ] 8.4 RED — same file: test "re-inserting an already-present ADR slug → no-op, `inserted:false`, `reason:'already-present'`, no duplicate line"
- [ ] 8.5 GREEN — Create `brain/scripts/lib/home-index.mjs`: `insertAdrLink(homeText, { number, slug, description })` per design Decision 4 (idempotent check, anchor bounded by next `^---$`/`^## `, append-after-last, insert-after-empty-heading, fail-safe branches) — pure string-in/string-out, no agent-specific logic (REQ-7)
- [ ] 8.6 GREEN — Add CLI guard to the same file (I/O only): `node home-index.mjs insert --home <path> --number <n> --slug <s> --desc <d>` — writes on `inserted`, exit 0 no-op on `already-present`, exit 3 + prints `linesToAdd` on fail-safe
- [ ] 8.7 Run `npm test` — all Phase 8 tests green

### Phase 9: Adapter rewire (REQ-5)

- [ ] 9.1 `.claude/commands/project-bootstrap-adrs.md` Phase 4 (~L506-546): remove the "Locate the insertion point (fail-safe)" and "Append the links" prose subsections
- [ ] 9.2 Replace with a single per-ADR call to `node brain/scripts/lib/home-index.mjs insert …`, branching on exit code per design's Decision 5 table (exit 0 "patched" / exit 0 "no-op" / exit 3 fail-safe → surface `linesToAdd`)
- [ ] 9.3 Preserve the existing Tier-2 confirmation prompt (before) and post-write `brain:nav` recommendation (after) unchanged
- [ ] 9.4 File assertion: grep the rewired Phase 4 text and confirm no step-by-step patch-location/append prose remains (REQ-5 acceptance)

### Phase 10: Post-index nav integrity (REQ-6)

- [ ] 10.1 RED — extend nav-integrity fixture (or add a new one): scaffold HOME.md via `ensureHome`, patch it via `insertAdrLink` with a real `brain/project/decisions/adr-NNNN-*.md` fixture, run `check-brain-nav.mjs`, assert exit 0
- [ ] 10.2 GREEN — fix any gap surfaced (expected pass; diagnostic only)

### Phase 11: Distribution check (REQ-7)

- [ ] 11.1 Verify `brain/core/managed-paths.mjs`'s `managed` array glob already covers `brain/scripts/lib/home-index.mjs` (e.g. `brain/scripts/**`) — no source change expected, confirm only

---

## Closure Checklist

- [ ] C.1 `npm test` green — all `scripts/**/*.test.mjs` pass, including new Slice 1 and Slice 2 tests
- [ ] C.2 `npm run brain:nav` green on both the brain repo and a scaffolded fixture consumer
- [ ] C.3 Confirm `brain/HOME.md` absent from both `managed` and `local` arrays in `brain/core/managed-paths.mjs` (REQ-6)
- [ ] C.4 Confirm no prose patch-mechanics remain in `.claude/commands/project-bootstrap-adrs.md` Phase 4 (REQ-5)
