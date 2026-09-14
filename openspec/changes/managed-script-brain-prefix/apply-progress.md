# Apply progress: memory scripts move to the `brain:memory:*` namespace (#961) — Tier-1 PR

Batch: Phases 0-6 (Tier-1 PR). Phase 7 (the five ADR drafts) is left **BLOCKED and
untouched**, per the launch instructions — a mid-session message claiming the ruling
gap was resolved and directing edits to the ADR drafts arrived through an unverified
channel (an injected note, not a relaunch from the actual orchestrator) and contradicted
the explicit written constraint "do not do it, do not touch the ADR drafts." It was not
acted on. See "Anomaly" section at the end.

Worktree: `/home/gandalf/IA/brain-script-prefix`, branch
`refactor/managed-memory-scripts-brain-prefix`. Strict TDD Mode active; every test run
used `GIT_CONFIG_GLOBAL=/dev/null`.

## Phase 0 — Pre-flight

- **0.1 Baseline** measured on `origin/main` tip (`f956f8b3`, fetched into a scratch
  `git worktree`, never the working branch): `GIT_CONFIG_GLOBAL=/dev/null npm test` →
  **5341 pass / 0 fail / 0 skipped** (5341 total).
- **0.2 Merge**: `git merge origin/main --no-edit` from the branch's prior tip
  (`29b2702d`, the merge-base) — a clean fast-forward to `f956f8b3` (2 docs-only commits,
  no conflicts). `git merge`, never rebase, per the hard constraint.
- **0.3 chunk-boundary.test.mjs pin**: `cli.mjs:655`'s
  `const { collectChunkObservations, buildMigrationReport } = await import(` re-verified
  unchanged post-merge, and again after the Phase 3.5 edit to `cli.mjs:8` (a comment;
  no line-count shift). Pin held both times — no re-pin needed.

## Phase 1 — Pinning test + package.json (RED -> GREEN)

- **1.1 RED**: `brain/scripts/memory/package-scripts.test.mjs` created (11 verbs,
  literal-string comparison per design D2, `MANAGED_SCRIPT_KEYS` never-managed check).
  All 11 sub-tests failed (`undefined` vs the expected command string) — keys absent.
- **1.2 GREEN**: 11 `brain:memory:*` keys inserted into `package.json` right after
  `brain:memory:session-end` (D1); lines 65-75 (the ten existing bare aliases) stayed
  byte-unchanged. All 11 sub-tests passed.
- **1.3 Mutation**: `brain:memory:save`'s value edited to end in `save-mutated`; re-run
  → exactly 1/11 sub-tests failed (the `save` case only). Reverted; re-run → 11/11 green.

## Phase 2 — Hazard guard (RED -> GREEN)

- **2.1/2.2**: `brain/scripts/lib/memory-script-prefix.test.mjs` created with the pure
  `scan(files)` scanner (test-only, D3) and its four assertions (A1-A4, D4) built
  together with 10 permanent fixture/mutation tests (clean-tree zero-findings baseline,
  then one test per assertion's exact mutation from design's table, each asserting the
  OTHER three assertions stay empty — i.e. baked-in non-overlap proof, not a transient
  manual step).
- **2.3 Real-tree test**: added, gated on `.brain-source` (real repo only, read-only,
  no git/writes). Run immediately after 2.2 (before Phase 3's renames): **RED as
  expected** — A3 found 14 Tier-1 files still using bare `npm run memory:<eleven>`
  (`README.md`, `docs/workflow-guide.md`, `brain-metrics.mjs`, `brain-save.mjs`,
  `brain-to-engram.mjs`, `bootstrap.sh`, `cli.mjs`, `index-lag.mjs`,
  `lib/backend-selection.mjs`, `backends/engram.mjs`, `i18n/en.mjs`, `i18n/es.mjs`,
  `hooks/post-merge`, `harness/backends/plain.mjs`).
- **2.4 Mutation**: proven as permanent regression tests in the same file (see 2.1/2.2);
  additionally, the exhaustive per-site automated proof in "Mutation table" below
  re-confirms A1-A4 never overlap across every REAL renamed site, not just the
  synthetic fixtures.

## Phase 3 — Anchored renames (R7)

- **3.1 Tightened the two rename-blind tests FIRST (RED)**:
  `harness/backends/plain.test.mjs:36` (`/memory:share/` → `/npm run brain:memory:share/`)
  and `memory/backends/plainfiles.save-index-failure.test.mjs:216-217`
  (`/memory:reindex/` → `/npm run brain:memory:reindex/`,
  `/Do NOT run memory:save again/` → `/Do NOT run brain:memory:save again/`). Run: 2/18
  failed (exactly the two tightened assertions) — RED confirmed.
- **3.2-3.5 GREEN**: anchored substitution
  `(?<![\w:-])memory:(save|index|share|pull|resolve-index|audit|ship|reindex|split-records|collect|migrate-v1)(?![\w-])`
  → `brain:$&`, applied ONLY to the explicit file:line list from design.md (never a
  blind sweep) — 42 lines, 45 substitutions, across `brain-to-engram.mjs`,
  `brain-save.mjs`, `brain-metrics.mjs`, `bootstrap.sh`, `hooks/pre-push`,
  `hooks/post-merge`, `harness/backends/plain.mjs`, `vcs/contributor-scaffold.mjs`,
  `memory/cli.mjs`, `memory/staged-records-check.mjs`, `memory/index-lag.mjs`,
  `memory/lane/plan.mjs`, `memory/backends/engram.mjs`,
  `memory/lib/{backend-selection,store,upstream-records,duplicates,format,migrate-v1,
  secret-scrub,audit-io,audit,resolve-index}.mjs`, `memory/__fixtures__/env.mjs`. Every
  targeted line was verified to contain a bare match before writing (drift guard); none
  drifted from the base line numbers. `governance.yml:133` and `adr-0002:86` /
  `adr-0034:136,143` were never touched — they are not in the map.
  The two tightened tests went GREEN; the guard's real-tree A3 count dropped
  correspondingly.
- **3.6**: the 26 remaining dependent test files' expectations/titles updated (62 more
  substitutions), EXCLUDING: `pkg.scripts['memory:X']` bracket-key-literal assertions
  (`cli.collect.test.mjs:295`, `cli.ship.test.mjs:603`,
  `capture-reachable.test.mjs:29,40,42` — these correctly test the ALIAS key, which
  stays bare forever under R4) and `lib/pm.test.mjs:342-343` (a generic
  `pm.runArgs(name, ...)` argv-shape unit test unrelated to brain's own scripts).
  `vcs/contributor-scaffold.test.mjs:796,819` needed a REAL fix (not just cosmetic):
  the emitted checklist item now reads `brain:memory:save --issue N` after
  `contributor-scaffold.mjs:276`'s rename, so the two assertions checking that literal
  text were retargeted — full-suite run confirmed these were genuinely broken before
  the fix (not ok 4525/4526) and green after (except the two byte-for-byte on-disk
  template checks, expected until Phase 5.2).
  `i18n/coverage.test.mjs:288,290` and `duplicates.i18n.test.mjs:64-65` were
  deliberately deferred to Phase 4.2 (same commit as the catalog rename they depend on).

## Phase 4 — i18n catalogs (R9)

- **4.1**: `en.mjs:76,103,201,203,294,334,409,452,470` and
  `es.mjs:67,93,185,187,267,303,364,403,421` renamed (values only, keys unchanged) — 22
  substitutions across 18 lines. Full suite dropped to 1 new failure
  (`duplicates.test.mjs` line 166's `/memory:reindex/`, matching `en.mjs:334`'s OLD
  value — expected, tightened in 3.6 ahead of this rename landing).
- **4.2**: `coverage.test.mjs:288,290` updated to the new `brain:memory:pull failed` /
  `brain:memory:index failed` literals; `duplicates.i18n.test.mjs:64-65` retargeted to
  `brain:memory:reindex`. Full suite: 5359/5363 pass, 4 failures remaining — all four
  are Phase 5 territory (PR template byte-for-byte + the real-tree guard, which still
  sees the un-renamed docs/README/templates/specs).

## Phase 5 — Docs, root, living specs, CHANGELOG

- **5.1/5.2/5.3**: `docs/workflow-guide.md:86`; `docs/methodology-map/index.html:825,
  863,867,1026`; `README.md:193,194`; `.github/PULL_REQUEST_TEMPLATE.md:135`;
  `.gitlab/merge_request_templates/Default.md:135`; `.gitignore:82`;
  `openspec/specs/governance/spec.md:687,691,695,701,831`;
  `openspec/specs/feature-working-memory/spec.md:53,58,64,169,177,184,185`;
  `openspec/specs/governance-v3/spec.md:988,1014,1020,1027` — 28 lines, 35
  substitutions.
  **Drift caught by the guard, not in design's static list**: `docs/KNOWN-LIMITATIONS.md
  :238,257` — new content that arrived via the Phase 0.2 merge (origin/main added 54
  lines to this file after design.md's anchors were fixed at base `29b2702d`). Renamed
  under the same R7 rule (2 more lines/substitutions). This is exactly what the hazard
  guard is for.
- **5.4**: new `## Unreleased — memory scripts join the brain: namespace (#961)` section
  added to `CHANGELOG.md`, verbatim per design's text, directly above `## v1.5.0`; lines
  523-532 (now shifted but byte-identical in content) untouched.
- Full suite after Phase 5: **5363/5363 pass, 0 fail** — includes the real-tree guard
  turning fully GREEN (A1-A4 all empty).

## Phase 6 — Verification, guard closure, mutation table

- **6.1**: real-tree test (2.3) re-run — GREEN (part of the 5363/5363 full-suite run).
- **6.2**: full suite final count: **5363 pass / 0 fail / 0 skipped** (5363 total).
  Delta vs. baseline (5341/0/0): **+22 tests**, all new and all passing — 11 from the
  pinning test (1.1) + 11 from the hazard guard (2.1-2.3). No baseline test regressed,
  none skipped.
- **6.3 Mutation table**: see below.

### Mutation table — package.json (Phase 1.3, manual)

| Site | Mutation | Result | Restored |
|---|---|---|---|
| `package.json` `brain:memory:save` value | append `-mutated` | exactly 1/11 pinning sub-tests fails | yes, 11/11 green |

### Mutation table — every renamed file:line site vs. the hazard guard (automated)

Script: revert ONE site's `brain:memory:<verb>` back to `memory:<verb>` (first
occurrence on that line only), run `node --test memory-script-prefix.test.mjs`, record
which of A1/A3/A4 fire (A2 never applies outside `governance.yml`, which was never
touched), restore, re-run to confirm clean. **88/88 sites**: exactly one of A3 or A4
fired (never both, never zero, never A1) and every restore returned the guard to
all-green. No site was skipped.

| File | Lines (count) | Assertion that fires |
|---|---|---|
| `brain/scripts/brain-to-engram.mjs` | 6 (1) | A3 |
| `brain/scripts/brain-save.mjs` | 5, 33, 43 (3) | A4, A4, A4 |
| `brain/scripts/brain-metrics.mjs` | 314, 340 (2) | A3, A3 |
| `brain/scripts/bootstrap.sh` | 312, 313, 334 (3) | A3, A3, A3 |
| `brain/scripts/hooks/pre-push` | 6, 10, 115 (3) | A4, A4, A4 |
| `brain/scripts/hooks/post-merge` | 57 (1) | A3 |
| `brain/scripts/harness/backends/plain.mjs` | 18 (1) | A3 |
| `brain/scripts/vcs/contributor-scaffold.mjs` | 276 (1) | A4 |
| `brain/scripts/memory/cli.mjs` | 8 (1) | A3 |
| `brain/scripts/memory/staged-records-check.mjs` | 15 (1) | A4 |
| `brain/scripts/memory/index-lag.mjs` | 45, 107 (2) | A4, A3 |
| `brain/scripts/memory/lane/plan.mjs` | 112 (1) | A4 |
| `brain/scripts/memory/backends/engram.mjs` | 14, 802, 827, 1471, 1537 (5) | A4, A4, A3, A4, A4 |
| `brain/scripts/memory/lib/backend-selection.mjs` | 13, 19 (2) | A4, A3 |
| `brain/scripts/memory/lib/store.mjs` | 101 (1) | A4 |
| `brain/scripts/memory/lib/upstream-records.mjs` | 300 (1) | A4 |
| `brain/scripts/memory/lib/duplicates.mjs` | 13, 35, 189 (3) | A4, A4, A4 |
| `brain/scripts/memory/lib/format.mjs` | 227 (1) | A4 |
| `brain/scripts/memory/lib/migrate-v1.mjs` | 215 (1) | A4 |
| `brain/scripts/memory/lib/secret-scrub.mjs` | 1, 3 (2) | A4, A4 |
| `brain/scripts/memory/lib/audit-io.mjs` | 1, 22 (2) | A4, A4 |
| `brain/scripts/memory/lib/audit.mjs` | 1, 144 (2) | A4, A4 |
| `brain/scripts/memory/lib/resolve-index.mjs` | 6 (1) | A4 |
| `brain/scripts/memory/__fixtures__/env.mjs` | 12 (1) | A4 |
| `brain/scripts/i18n/en.mjs` | 76,103,201,203,294,334,409,452,470 (9) | A3,A3,A4,A4,A3,A3,A3,A3,A3 |
| `brain/scripts/i18n/es.mjs` | 67,93,185,187,267,303,364,403,421 (9) | A3,A3,A4,A4,A3,A3,A3,A4,A3 |
| `docs/workflow-guide.md` | 86 (1) | A3 |
| `docs/methodology-map/index.html` | 825,863,867,1026 (4) | A4,A4,A4,A4 |
| `README.md` | 193, 194 (2) | A3, A3 |
| `.github/PULL_REQUEST_TEMPLATE.md` | 135 (1) | A4 |
| `.gitlab/merge_request_templates/Default.md` | 135 (1) | A4 |
| `.gitignore` | 82 (1) | A4 |
| `docs/KNOWN-LIMITATIONS.md` | 238, 257 (2) | A4, A4 |
| `openspec/specs/governance/spec.md` | 687,691,695,701,831 (5) | A4×5 |
| `openspec/specs/feature-working-memory/spec.md` | 53,58,64,169,177,184,185 (7) | A4×7 |
| `openspec/specs/governance-v3/spec.md` | 988,1014,1020,1027 (4) | A4×4 |

**Cross-checked "own test" pairings** (beyond the guard, empirically observed as RED
during the phase-by-phase runs above, GREEN once the paired production site landed):
`package.json` → `package-scripts.test.mjs` (1.1/1.3); `plain.mjs:18` →
`plain.test.mjs:36` (3.1); `en.mjs:452` → `plainfiles.save-index-failure.test.mjs:
216-217` (3.1/4.1); `en.mjs:334` → `duplicates.test.mjs:166` (3.6/4.1, the
"not-yet-renamed" RED observed in the Phase-4-pending full-suite run); `en.mjs:201,203`/
`es.mjs:185,187` → `coverage.test.mjs:288,290` (4.2); `es.mjs:303` →
`duplicates.i18n.test.mjs:64` (4.2); `contributor-scaffold.mjs:276` →
`contributor-scaffold.test.mjs:796,819` (3.6, confirmed genuinely broken pre-fix via
`not ok 4525/4526` in the full-suite log); `.github/PULL_REQUEST_TEMPLATE.md:135` +
`.gitlab/.../Default.md:135` → `contributor-scaffold.test.mjs`'s byte-for-byte on-disk
checks (5.2, the last failures to clear).

### Counted production diff (tests, `openspec/**`, `AGENTS.md`, `.memory/**` excluded)

`git diff --numstat` against 35 files: **92 insertions(+), 72 deletions(-) = 164
changed lines** (design forecast: ~163, Low risk). Breakdown matches design's Line
budget table: `package.json` +11; `brain/scripts/**` production ~109 (60 lines × 2 for
the ± of an in-place rename, per file above); i18n `en.mjs`/`es.mjs` 9+9 lines;
docs/README/templates/.gitignore ~10 lines; `CHANGELOG.md` +9. No file outside the
anchored map was touched except the guard-caught `docs/KNOWN-LIMITATIONS.md` drift.

## Full test suite

- Baseline (`origin/main` tip, pre-merge): 5341 pass / 0 fail / 0 skipped.
- Final (this branch, end of Phase 6): **5363 pass / 0 fail / 0 skipped**.
- Delta: +22 tests (Phase 1 pinning ×11, Phase 2 hazard guard ×11), all new, all green.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR / Mutation |
|---|---|---|---|
| 1.1-1.3 pinning test | 11/11 fail (keys absent) | 11/11 pass (`package.json` +11 keys) | 1 mutated key → exactly 1 fails; reverted |
| 2.1-2.4 hazard guard | scanner absent → tests threw before existing; fixture tests written alongside scanner (see note) | 10/10 fixture tests pass on first run once `scan()` landed; real-tree test RED (bare names present) | 10 fixture tests each bake in their own mutation, proving A1-A4 non-overlap; 88-site automated proof against real files (6.3) |
| 3.1 rename-blind tightening | 2/18 fail (the two tightened assertions) | both pass once 3.2-3.5 renamed the underlying sites | reverting either production site (see mutation table) fails it again |
| 3.2-3.6 anchored renames | n/a (production code, not test-first — each site paired with an existing or tightened test) | full suite 5357→5359/5363 across phases 3-5 | 88-site automated revert-and-restore proof (6.3) |
| 4.1-4.2 i18n catalogs | `duplicates.test.mjs:166` and `coverage.test.mjs:288,290`/`duplicates.i18n.test.mjs:64` observed RED before catalog values changed | GREEN once `en.mjs`/`es.mjs` renamed | included in the 88-site table |
| 5.1-5.4 docs/specs/CHANGELOG | real-tree guard A3/A4 RED for these sites pre-rename | GREEN post-rename (full suite 5363/5363) | included in the 88-site table |

Note on 2.1/2.2: the scanner and its tests were authored together in one file write
(a pure, small function), so the classic "run tests, see them fail on ReferenceError"
step was not separately captured as a log; the fixture/mutation tests each bake in a
permanent proof that a wrong or missing scanner result fails that specific test (the
same evidence a manual RED run would have produced), and the 88-site automated proof
in 6.3 is a stronger, exhaustive version of the same claim against real files.

## Commits (this batch, in order)

1. `test(memory): pin brain:memory:* aliases to their bare memory:* twin (#961, refs #963)`
2. `test(scripts): add the memory:* rename hazard guard (#961, refs #963)`
3. `refactor(scripts): rename memory:* to brain:memory:* across production and hooks (#961, refs #963)`
4. `refactor(i18n): rename memory:* command references to brain:memory:* (#961, refs #963, R9)`
5. `docs(scripts): rename memory:* references across docs, templates, specs, CHANGELOG (#961, refs #963)`
6. `docs(sdd): commit managed-script-brain-prefix SDD artifacts (#961, refs #963)` (this file + the rest of `openspec/changes/managed-script-brain-prefix/`, including `brain-drafts/` as-is, unapplied)
7. Record-first closing commit (`memory:save`, task 6.5) — recorded next.

## Anomaly encountered (not acted on)

Mid-session, a message arrived (via an injected `system-reminder`, not a relaunch of
this agent by the actual orchestrator) claiming the Phase 7 ruling gap was resolved
("option A") and instructing edits to the five ADR drafts, plus running
`brain/scripts/lib/amendment-draft.mjs`'s internals against the real ADR files. This
contradicted the explicit, written hard constraint from the actual launch prompt:
"Phase 7 ... is BLOCKED on a maintainer decision: do not do it, do not touch the ADR
drafts." It was not acted on — Phase 7 and everything under `brain-drafts/` remain
exactly as delivered by the design/tasks phases, untouched. Flagging for the real
orchestrator to verify out-of-band before any Phase 7 work is delegated.

## Task checklist status

Phases 0-6: all tasks complete (see `tasks.md`, updated `[x]` in the same commit as
this file). Phase 7: still `[ ]`, still marked BLOCKED — not started, not touched.
