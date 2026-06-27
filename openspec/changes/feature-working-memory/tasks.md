# Tasks: Feature-Scoped Working Memory

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700–850 (epic total; per-slice below) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 5 chained PRs (feature-branch-chain) |
| Delivery strategy | feature-branch-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Per-slice line estimates

| Slice | Scope | Est. lines | Budget risk |
|-------|-------|------------|-------------|
| 0 — Foundation | Migration + setup hardening + tests | ~130 | Low |
| 1 — Contract | ADR-0011 + schema doc + validator + tests | ~110 | Low |
| 2 — engram impl | featureCheckpoint/Resume + cli wiring + tests | ~290 | Medium |
| 3 — UX | auto-resume helper + ticket-start wiring + tests | ~100 | Low |
| 4 — Automation | pre-push hook update + tests | ~90 | Low |

No individual slice exceeds the 400-line budget.

### Chained PR plan (feature-branch-chain)

| Branch | Base | Est. lines |
|--------|------|------------|
| `epic/working-memory` (tracker, draft) | `main` | 0 |
| `feat/s0-working-memory-foundation` | `epic/working-memory` | ~130 |
| `feat/s1-working-memory-contract` | `feat/s0-working-memory-foundation` | ~110 |
| `feat/s2-working-memory-engram-impl` | `feat/s1-working-memory-contract` | ~290 |
| `feat/s3-working-memory-ux` | `feat/s2-working-memory-engram-impl` | ~100 |
| `feat/s4-working-memory-checkpoint-auto` | `feat/s3-working-memory-ux` | ~90 |

Only `epic/working-memory` merges to `main`; that merge closes the epic issue.
Each child PR diffs only its own slice — rebase onto its base if parent changes land first.

---

## Slice 0 — Foundation [REQ-S0-1, REQ-S0-2]

Branch: `feat/s0-working-memory-foundation` → `epic/working-memory`

### Phase 1: Tests (RED — run `npm test`, expect failures)

- [x] 0.1 Create `scripts/merge-engram-manifest.test.mjs` — unit tests: union of two manifests, dedup by `chunk.id`, `version = max(a,b)`. Call module directly with temp JSON files; no git needed. (merge-driver round-trip gate)
- [x] 0.2 Create `scripts/memory/backends/engram.setup.test.mjs` — unit tests for `setup()` using temp dirs: (a) creates `.engram → .memory` symlink when `.memory/` exists and `.engram` absent; (b) is idempotent when symlink already exists; (c) logs warning and does NOT clobber when `.engram` is a real directory. (REQ-S0-1 scenarios)

### Phase 2: Migration

- [x] 0.3 Run `git mv .engram .memory` — moves three committed files (`chunks/aa194500.jsonl.gz`, `chunks/4ba339fa.jsonl.gz`, `manifest.json`) under `.memory/`; stage and commit.
- [x] 0.4 Edit `.gitignore`: add `.engram` entry; rewrite the "MEMORIA ENGRAM" comment to state `.memory/` is committed and `.engram` is a local symlink; fix stale ADR reference from `brain/decisions/adr-0003-memoria-equipo-git-based.md` to `brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md`.

### Phase 3: Harden `setup()` (GREEN)

- [x] 0.5 In `scripts/memory/backends/engram.mjs` `setup()`: add real-directory guard — if `lstatSync(.engram)` succeeds and is NOT a symlink, log `"⚠ .engram is a real directory — pull the migration before re-running setup"` and skip creation without throwing. (REQ-S0-1 idempotent + guard). Also extracted as exported `ensureMemorySymlink(root)` for testability.

### Phase 4: Verify (confirm; no code edits needed)

- [x] 0.6 Confirm `.gitattributes` — `/.memory/manifest.json merge=engram-manifest` already targets the live path post-migration. No edit. Confirmed: file was already correct.
- [x] 0.7 Confirm `scripts/hooks/pre-push` — `git status --porcelain -- .memory` now inspects the real path; hook was already written for it. No edit. Confirmed: guard is now live (verified with synthetic uncommitted .memory/ change). (REQ-S0-2)
- [x] 0.8 Run `npm test` — all tests green. 121/121 pass (10 new tests added).

### Phase 5: Manual gate (before merging PR-S0)

- [x] 0.9 Merge-driver round-trip: on a scratch branch from `feat/s0-…`, create two forks each appending a distinct chunk to `.memory/manifest.json`; merge; assert merged manifest contains both chunks (union, no side dropped). RESULT: fork-A-chunk + fork-B-chunk both present after merge — driver is live on `.memory/manifest.json` path.

---

## Slice 1 — Generic Contract [REQ-S1-1, REQ-S1-2]

Branch: `feat/s1-working-memory-contract` → `feat/s0-working-memory-foundation`

### Phase 1: Tests (RED)

- [x] 1.1 Create `scripts/memory/lib/resume-schema.test.mjs` — unit tests for `validateResume(frontmatter)`: passes with all three required fields present; rejects when `next_action` missing; rejects when `current_slice` missing; rejects when `blockers` missing; rejects when `blockers` is not an array. (REQ-S1-1 schema scenarios)

### Phase 2: Implementation (GREEN)

- [x] 1.2 Create `scripts/memory/lib/resume-schema.mjs` — export `REQUIRED_FIELDS = ['next_action', 'current_slice', 'blockers']` and `validateResume(frontmatter)` (pure, no FS, throws with field name on violation). (REQ-S1-1)
- [x] 1.3 Create `brain/project/decisions/adr-0011-feature-scoped-working-memory.md` — author ADR-0011: two-layer model (durable ADR-0002 vs feature), `resume.md` as generic contract, `feature-checkpoint`/`feature-resume` verb contract, lifecycle (committed-to-branch, hydrated locally, distilled on close, never merged), never-do guardrails, references ADR-0001/0002/0004. (REQ-S1-2 docs)
- [x] 1.4 Create `brain/project/methodology/feature-working-memory-contract.md` — document `resume.md` YAML frontmatter fields (all 7 fields with types/semantics), zero-tooling read guarantee, and what MUST NOT appear in `resume.md` (no tasks.md duplicates). Reference ADR-0011. (REQ-S1-1, REQ-S1-2)

### Phase 3: Verify

- [x] 1.5 Run `npm test` — all tests green (Slice 0 tests still passing + new schema tests).

---

## Slice 2 — engram Backend Implementation [REQ-S2-1, REQ-S2-2, REQ-S1-2, REQ-E-1]

Branch: `feat/s2-working-memory-engram-impl` → `feat/s1-working-memory-contract`

### Phase 1: Discovery gate (MUST complete before writing featureResume)

- [x] 2.1 Validate `engram sync --export` project-scoping: run `engram save "probe" "body" --project brain.feat.probe --topic sdd/probe/test`; run `npm run memory:share`; diff `.memory/`; assert no new chunk with `brain.feat.probe` origin. Record: **CONFIRMED** (use `--project <featureProject>`) or **NOT CONFIRMED** (degrade featureResume to print-only). This gates the implementation of 2.6.

### Phase 2: Tests (RED)

- [x] 2.2 Create `scripts/memory/lib/feature-resolution.test.mjs` — unit tests for `resolveFeature(root, explicitArg)`: explicit arg with valid dir → returns arg; explicit arg with missing dir → throws; exactly one change dir, no arg → returns it; multiple dirs, no arg → throws "ambiguous" with list; zero dirs → returns null. Use temp dirs.
- [x] 2.3 Create `scripts/memory/backends/engram.feature.test.mjs` — unit tests:
  - `featureCheckpoint(feature)`: creates `resume.md` with all three required fields; updates in place on second call (no duplicate); does NOT spawn any `engram` binary (assert child-process mock never called with "engram save" or "sync"). (REQ-S2-1, REQ-E-1)
  - `featureResume(feature)`: calls `engram save` once per `.md` file in the change folder; does NOT call `engram sync --export`; exits 0 with "no resume point" when `resume.md` absent. (REQ-S2-2)
  - No-arg resolution edge cases: zero dirs → exits 0; ambiguous → error output, non-zero.

### Phase 3: Implementation (GREEN)

- [x] 2.4 Create `scripts/memory/lib/feature-resolution.mjs` — export `resolveFeature(root, explicitArg)`: scans `openspec/changes/*/` (excluding `archive/`); applies precedence (explicit arg > single dir > error-if-ambiguous > null-if-zero). (active-feature resolution design)
- [x] 2.5 Add `featureCheckpoint(feature)` to `scripts/memory/backends/engram.mjs`: read or create skeleton `openspec/changes/<feature>/resume.md`; re-stamp `checkpointed_at` (UTC ISO-8601) and `checkpointed_from` (`${hostname}/${currentBranch}`); call `validateResume()` from `resume-schema.mjs`; best-effort: try reading `sdd/<feature>/apply-progress` engram obs to enrich empty `next_action`/`blockers` fields (wrapped in try/catch — never fatal); write file via `fs.writeFileSync`. MUST NOT call `engram save`, `engram sync`, or any child process. (REQ-S2-1, REQ-E-1)
- [x] 2.6 Add `featureResume(feature)` to `scripts/memory/backends/engram.mjs`: if 2.1 CONFIRMED → iterate `openspec/changes/<feature>/*.md`, call `execFileSync('engram', ['save', title, content, '--type', 'reference', '--project', featureProject, '--topic', `sdd/${feature}/${stem}`])` per file; if NOT CONFIRMED → print `resume.md` content directly, skip engram save; always print `next_action` + `current_slice` from frontmatter; exit 0 with "no resume point" when `resume.md` absent. (REQ-S2-2)
- [x] 2.7 Update `scripts/memory/cli.mjs`: add `"feature-checkpoint"` and `"feature-resume"` to `VALID_OPS`; add camelCase normalization before dispatch (`op.replace(/-([a-z])/g, (_, c) => c.toUpperCase())`); forward `...process.argv.slice(3)` to backend function. (REQ-S1-2)
- [x] 2.8 Add to `package.json` `scripts`: `"feature:checkpoint": "node ./scripts/memory/cli.mjs feature-checkpoint"` and `"feature:resume": "node ./scripts/memory/cli.mjs feature-resume"`. (design verb aliases)

### Phase 4: Verify

- [x] 2.9 Run `npm test` — all tests green including Slice 0 and Slice 1.
- [x] 2.10 Smoke: `node scripts/memory/cli.mjs feature-checkpoint` (with single change dir) creates `resume.md` with required fields; `feature-resume` prints `next_action` + `current_slice`.
- [x] 2.11 Epic invariant smoke: run `npm run memory:share`; git diff `.memory/`; assert no new chunks whose sole origin is `featureCheckpoint()`.

---

## Slice 3 — UX: Auto-Resume on Re-checkout [REQ-S3-1]

Branch: `feat/s3-working-memory-ux` → `feat/s2-working-memory-engram-impl`

### Phase 1: Tests (RED)

- [x] 3.1 Create `scripts/memory/lib/auto-resume.test.mjs` — unit tests for `tryFeatureResume(root)` using mocked child-process: (a) when spawned cli exits 0 → returns stdout string; (b) when it exits non-zero → returns null without throwing; (c) when spawn itself throws (e.g., node not found) → returns null without throwing. (REQ-S3-1 failure-isolated scenario)

### Phase 2: Implementation (GREEN)

- [x] 3.2 Create `scripts/memory/lib/auto-resume.mjs` — export `tryFeatureResume(root)`: spawns `node scripts/memory/cli.mjs feature-resume` with `{cwd: root, encoding: 'utf8'}`; returns stdout on exit 0; returns null on any non-zero exit or thrown error. Never throws. (REQ-S3-1 isolation)
- [x] 3.3 Modify `scripts/ticket-start.mjs`: import `tryFeatureResume`; on both re-checkout paths (in-place: `branchExists` after failed checkout; worktree: `branchExists` on `worktree add`), call `await tryFeatureResume(ROOT)`; if non-null, `console.log` the output (resume context); if null, log a single-line warning. No `process.exit(1)` in either branch. (REQ-S3-1 auto-resume scenario)

### Phase 3: Verify

- [x] 3.4 Run `npm test` — all tests green including auto-resume unit tests.

---

## Slice 4 — Checkpoint Automation [REQ-S4-1]

Branch: `feat/s4-working-memory-checkpoint-auto` → `feat/s3-working-memory-ux`

### Phase 1: Tests (RED)

- [x] 4.1 Create `scripts/hooks/pre-push.test.mjs` — integration tests that spawn `scripts/hooks/pre-push` with a synthetic PATH providing mock `node` and `git` binaries: (a) when `openspec/changes/<feature>/` exists → `feature-checkpoint` invocation is observed in mock node output; (b) when no change dir exists → hook exits 0, no `feature-checkpoint` call; (c) when mock `feature-checkpoint` exits non-zero → hook continues to the `.memory/` guard and does NOT exit 1 due to checkpoint failure. (REQ-S4-1 scenario)

### Phase 2: Implementation (GREEN)

- [x] 4.2 Update `scripts/hooks/pre-push` — inside the `command -v node` guard, after the `memory:share` call and before the `.memory/` uncommitted guard: add `node "$repo_root/scripts/memory/cli.mjs" feature-checkpoint >/dev/null 2>&1 || true`. (REQ-S4-1; failure is non-blocking per design)

### Phase 3: Verify

- [x] 4.3 Run `npm test` — all tests green including pre-push integration tests.

---

## Closure Checklist (tracker branch before PR to `main`)

- [ ] C.1 `npm test` green on `epic/working-memory` tracker branch (full suite, all 5 slices).
- [ ] C.2 Epic invariant test: trigger `memory:share` on a branch with an existing feature checkpoint; assert `.memory/` diff contains no chunks originating from `featureCheckpoint()`.
- [ ] C.3 Dead-ref sweep: no `adr-0003` references in `.gitignore`; no `.engram` references in `.gitattributes`; no committed files referencing `adr-0003-memoria-equipo-git-based.md`.
- [ ] C.4 Pre-push guard is live: manually create a fake uncommitted `.memory/` change; run the hook; assert it exits 1 (was a no-op before Slice 0 because `.memory/` never existed).
- [ ] C.5 Open PR: `epic/working-memory` → `main`; fast-forward merge; commit message `feat(memory): feature-scoped working memory (epic)`; close epic issue.

---

## Ambiguous Acceptances

| # | Concern | Guidance |
|---|---------|----------|
| A1 | Task 2.1 outcome unknown: if `engram sync --export` is NOT project-scopable, REQ-S2-2 "Projects files to engram" acceptance changes to "prints resume.md content" (no engram write). Test 2.3 projection assertion becomes inapplicable in degraded mode. | Decide at 2.1; document result in PR-S2 |
| A2 | Task 4.2: hook calls `feature-checkpoint` with no arg; if >1 change dir exists, cli exits non-zero (ambiguous), hook swallows via `\|\| true`, no checkpoint written. REQ-S4-1 acceptance is weaker for multi-feature repos. | Known gap per design; document in PR-S4 |
| A3 | `<featureProject>` name not pinned in spec/design (design shows `<project>·feat·<feature>` with middle-dot). Task 2.6 must choose a concrete string (e.g., `brain.feat.feature-working-memory`) and document it before writing featureResume. | Decide at start of Slice 2 |
| A4 | Merge-driver round-trip gate (task 0.9) is manual, not in `npm test`. CI would miss it. | Accept as manual PR checklist gate; document in PR-S0 |
