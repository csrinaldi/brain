---
status: tasked
issue: 889
---

# Tasks: #889 — the lane is recognised: one predicate, three callers, and two contexts that report before they block

Implements `spec.md` under `design.md`'s A1–A9, ruling `sdd/issue-889-lane-governance/ruling`
(D1–D8, 2026-09-10). Parent: #864 task 3.1c, ADR-0034 L1/L3/L6/C1. Delivery: `ask-on-risk`,
already resolved by the ruling — **two PRs, `stacked-to-main`**. PR 1 closes sub-ticket **#905**
(slice A: the gate surface). PR 2 closes **#889** (slice B: audit + index). Triggers (D6) are
sub-ticket **#906** — out of scope in both PRs below.

STRICT TDD MODE IS ACTIVE. Test runner: `npm test` (node:test). Every implementation task below is
preceded by its failing test task, naming the file and case titles from `spec.md`/`design.md`. Run
the focused `node --test` command after each RED/GREEN pair; run the full `npm test` before each
commit.

## 0. Live measurements apply performs first (read before implementing — no code in this section)

Neither `sdd-design` nor `sdd-tasks` had Bash available. Before task A1 begins, apply MUST measure
each of the following, record the result in `apply-progress`, and adjust the tasks below if reality
disagrees with the design's assumption:

- **0.1 — the three-dot diff behaviour that A2's whole predicate rests on.** Over a synthetic
  rename, a modification, and a deletion under `.memory/records/`, run
  `git diff --name-only A...B` and `git diff --diff-filter=A --name-only A...B`. Confirm the
  rename's NEW path appears in the first list and is ABSENT from the second — `classifyLane`'s
  `changedFiles ⊆ addedFiles` conjunction depends on this holding for every git version this repo's
  CI runs. If it disagrees, the conjunction (not its evidence source) must change, and that change
  belongs in A1, not silently patched later.
- **0.2 — exact current bytes of `contributor-scaffold.mjs:274-277` and the committed
  `.github/PULL_REQUEST_TEMPLATE.md` block it emits**, so A6's replacement is byte-equal after
  regeneration. Read once this phase (re-measure before A6 — this is a snapshot, not a guarantee
  against drift):
  ```
  contributor-scaffold.mjs:274-277 (source):
  - [ ] Session memory captured with \`npm run memory:share\`, and the record carries the
        linked issue number. Where the pipeline hands \`memory-gate\` this description,
        an unscoped record does NOT satisfy it. \`skip:memory-gate\` is named in the docs
        but no gate reads it — applying it exempts nothing.

  PULL_REQUEST_TEMPLATE.md:133-136 (committed, emitted, never hand-edited):
  - [ ] Session memory captured with `npm run memory:share`, and the record carries the
        linked issue number. Where the pipeline hands `memory-gate` this description,
        an unscoped record does NOT satisfy it. `skip:memory-gate` is named in the docs
        but no gate reads it — applying it exempts nothing.
  ```
- **0.3 — the job-order guard's current state.** `governance-checks.test.mjs:91` asserts YAML job
  `name:` order equals `GOVERNANCE_JOBS`. Confirm the CURRENT count (eight) and order before A5's
  append, so "append at the end" in all three files lands where the guard expects.
- **0.4 — counted-line check per PR, before opening it.** Run the repo's own `diff-size` check
  (`npm run brain:governance-status` / `run-check.mjs diff-size`) against the design's forecast —
  PR 1 ~277 counted vs. `lite`'s `diffBudget: 1000` (`governance-tiers.mjs:259`) and the 400-line
  reviewer budget; PR 2 ~87. Record the REAL number in each PR's wrap-up note, not just the
  forecast.
- **0.5 — artifact status bump.** Bump `status:` frontmatter on `explore.md`, `proposal.md`,
  `spec.md`, `design.md` from `draft`/`proposed` to `tasked`, alongside this file (`tasked` above)
  — one shared value across the change dir (`phase-order-check.mjs`'s `STATUS_LADDER` is
  forward-only). No code touched by this task.

**Apply's measured results (2026-09-10, git 2.53.0, this repo's default `diff.renames`):**
- 0.1 CONFIRMED in a synthetic temp repo: a rename's NEW path appears in
  `git diff --name-only A...B` and is ABSENT from `git diff --diff-filter=A --name-only A...B`
  (this repo's git auto-detects the rename by default — no `-M`/`--no-renames` needed; verified
  with `--no-renames` too, which shows the expected two-entry A+D shape instead). A modification
  and a deletion are excluded from the added-only list either way. `classifyLane`'s
  `changedFiles ⊆ addedFiles` conjunction holds as designed — A1 built on it unchanged.
- 0.2 CONFIRMED byte-for-byte against the snapshot above (re-read before A6.1 — unchanged).
- 0.3 CONFIRMED: eight jobs, `[issue-link, diff-size, local-checks, memory-gate, decision-gate,
  phase-order, actor-check, brain-writes-reviewed]`, in that order, before A5's append.
- 0.4 MEASURED (informational — not gated by this section): the REAL counted diff for slice A
  (all six commits, excluding `**/*.test.mjs` and `openspec/changes/**` per
  `brain.config.json`'s ignoreList) is **~514 lines**, not the ~277 forecast — see apply-progress
  for the breakdown. Still inside `lite`'s `diffBudget: 1000`; exceeds the 400-line reviewer
  budget. Flagged as a risk for the maintainer/orchestrator, not resolved unilaterally here.
- 0.5 DONE: `explore.md`, `proposal.md`, `spec.md`, `design.md` bumped to `status: tasked`.

---

## Slice A — gate surface (#905), PR 1

Branch: cut `feat/issue-905-lane-gate-surface` from this worktree's current branch — rename this
worktree's branch to that name before the first commit if it is not already named for a single PR
(one branch, one PR, no orphaned branch left over). PR 1 body: `Closes #905`, `Part of #889`,
`Parent: #864`.

### A1. Unit — `governance/checks/lane.mjs`: `classifyLane` (spec "the lane predicate is narrow and structural"; design A1–A3)

- [x] A1.1 RED: `brain/scripts/governance/checks/lane.test.mjs` (new) —
  - branch matches AND all changed paths under `.memory/records/` are added-only ⇒
    `lane: true`, `laneBranch: true`, `lanePaths: true`
  - branch matches, but a changed path under the prefix is a modification/deletion/rename
    (changed ⊄ added) ⇒ `lane: false`, `laneBranch: true`, `lanePaths: false`, `offending`
    lists it
  - branch matches, paths otherwise satisfy the predicate but include `.memory/index.jsonl`
    ⇒ not-a-lane (prefix fails, no special case)
  - branch matches, one path is nested (`.memory/records/sub/x.jsonl`) ⇒ not-a-lane
    (`[^/]+` fails)
  - paths satisfy the predicate but the branch does not match (e.g. `feat/x`) ⇒
    `lane: false`, `laneBranch: false`, `lanePaths: true`
  - `sourceBranch: null` ⇒ `lane: false`, reason names an absent branch
  - `changedFiles`/`addedFiles` empty ⇒ `lane: false`, `reason: 'empty diff'`
  - `changedFiles`/`addedFiles` null (uncomputable) ⇒ `lane: false`, NEVER
    `uncomputable: true`
  - date-suffix grammar (design A3): `LANE_BRANCH_RE` has NO `(-\d+)?` group — a table drives
    `plan.mjs`'s `REF_GRAMMAR_RE` over a host/date matrix and asserts every ref it returns
    (with `refs/heads/` stripped) satisfies `LANE_BRANCH_RE`; a literal
    `memory/host-2026-09-10-2` is asserted NOT a lane
  - invariant across every case table row: `lane === laneBranch && lanePaths`
  Focused: `node --test brain/scripts/governance/checks/lane.test.mjs` — RED (module absent).
- [x] A1.2 GREEN: `brain/scripts/governance/checks/lane.mjs` — export `LANE_BRANCH_RE`
  (`/^memory\/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$/`), `LANE_PATH_RE`
  (`/^\.memory\/records\/[^/]+\.jsonl$/`), and
  `classifyLane({sourceBranch, changedFiles, addedFiles})` returning
  `{lane, laneBranch, lanePaths, offending, reason}` per design A1's decomposition and A2's
  evidence rule (`changedFiles ⊆ addedFiles`, both matching `LANE_PATH_RE`). Pure — no `fs`,
  no `child_process` (ADR-0016).
  Focused: same command — GREEN. `npm test` — green (nothing imports the module yet).

Commit: `feat(governance): add classifyLane, the lane predicate (#905)`.

### A2. Unit — `run-check.mjs`: `runIssueLinkCheck` gains the lane branch (spec "issue-link recomputes the predicate before exempting"; design A4)

- [x] A2.1 RED: extend `brain/scripts/governance/run-check.test.mjs` —
  - a lane-classified ctx (branch matches; injected `diffNameOnly`/`diffNameOnlyAdded` fakes
    return only added record paths) ⇒ `runIssueLinkCheck` passes with no closing keyword in
    the body, and the pure `issueLink()` is never consulted (spy asserts zero calls)
  - a `memory/x-2026-09-10` branch whose diff includes one path outside
    `.memory/records/` (or a modified path under it) ⇒ refused by the ordinary `issueLink`
    rule, not silently exempted
  - a THROWING `diffNameOnly`/`diffNameOnlyAdded` on a lane-shaped branch ⇒ standard rules
    apply (NEVER returned/reported as `uncomputable`)
  - a non-`memory/*` head (`ctx.sourceBranch` does not match `LANE_BRANCH_RE`) ⇒ the diff
    closures are NEVER called (spy asserts zero calls) — the short-circuit happens before
    touching git (design A4 property 1)
  - `ctx.sourceBranch` absent/null ⇒ standard rules, diff closures never called
  Focused: `node --test brain/scripts/governance/run-check.test.mjs` — RED.
- [x] A2.2 GREEN: `brain/scripts/governance/run-check.mjs` — in `runIssueLinkCheck`, after the
  non-string-body guard and before `issueLink(ctx.body)` (`:320-327`): short-circuit on
  `LANE_BRANCH_RE.test(ctx.sourceBranch)` before calling `classifyLane` (which needs the
  diff); demote a thrown diff to "not a lane" (never `uncomputable: true`); when
  `classifyLane(...).lane` is true, skip `issueLink()` entirely and pass. Wire
  `deps.diffNameOnly`/`deps.diffNameOnlyAdded` — already built as closures at `:473-474` —
  into the call at `:514` (no new plumbing, no new test seam; `run-check.test.mjs` already
  injects these).
  Focused: same command — GREEN. `npm test` — green.

Commit: `feat(governance): recompute the lane predicate before exempting issue-link (#905)`.

### A3. `actor-check`: two pins, no production code (spec "actor-check stays unmodified"; ruling D2)

- [x] A3.1 RED → pin: extend `brain/scripts/vcs/actor-check.test.mjs` —
  - a lane-shaped PR body (no issue number) ⇒ `evaluateActor` returns `{level: 'warn'}` and
    `main()` exits 0 (`:722-729`, `:1359`) — a NEW named test even though it is already true
    today: RED here means "the assertion is absent from the file", not "the code fails it";
    once added it is green without touching `actor-check.mjs`
  - a labeled PR whose approver is in `denyActors` ⇒ `evaluateActor` returns
    `{level: 'fail'}` and `main()` exits 1 (`:779`) — same treatment, a pin
  Focused: `node --test brain/scripts/vcs/actor-check.test.mjs` — both assertions present and
  green. `npm test` — green.

No production code in this unit. Folded into the wrap-up commit or its own `test(vcs):` commit,
whichever keeps the PR's story readable at review time.

Commit: `test(vcs): pin actor-check's lane-shaped warn and denied-approver fail (#905)`.

### A4. Unit — `governance/lane-paths.mjs` + `governance/lane-scrub.mjs` (spec "lane-paths is a required, self-reporting context" / "lane-scrub is a required, non-waivable secret check"; design A5/A6)

- [x] A4.1 RED: `brain/scripts/governance/lane-paths.test.mjs` (new) —
  - a diff with one path outside `.memory/records/` (or under it but modified) ⇒
    `evaluateLanePaths` NAMES the offending path(s), CLI exits 1
  - a non-lane-branch head (`laneBranch: false`) ⇒ exits 0, prints "not a lane — nothing to
    check"
  - a lane-branch head whose diff is uncomputable ⇒ exits 2
  - a lane-branch head whose diff cleanly satisfies the predicate ⇒ exits 0
  - the default `diffNameOnly`/`diffNameOnlyAdded` deps are called with THREE-DOT
    (`base...head`) argv — asserted on the spy
  Focused: `node --test brain/scripts/governance/lane-paths.test.mjs` — RED (module absent).
- [x] A4.2 GREEN: `brain/scripts/governance/lane-paths.mjs` — pure
  `evaluateLanePaths({sourceBranch, changedFiles, addedFiles}) -> {pass, uncomputable?, reason}`
  built on `classifyLane`, plus a thin `main()` + CLI guard reusing `resultToExit`
  (`governance/postmerge/exit-codes.mjs`) and the three-dot diff closures.
  Focused: same command — GREEN.
- [x] A4.3 RED: `brain/scripts/governance/lane-scrub.test.mjs` (new) —
  - a planted `ghp_…` token in an added `.memory/records/*.jsonl` path ⇒ fails closed
    (exit 1), output contains `pattern` + `lineNumber`, NEVER the matched line
  - `memorySecretAllowPatterns` honoured (an allow-listed pattern does not fail)
  - no added record path (`addedFiles.filter(p => LANE_PATH_RE.test(p))` empty) ⇒ exit 0,
    "nothing to scan"
  - a lane-branch head and a non-lane-branch head BOTH scanned identically — design A6's
    deliberate departure from D3: `lane-scrub` reads no lane input at all, it scans every
    added record path on every PR
  - SOURCE GUARD: `lane-scrub.mjs` does not import `governance-tiers.mjs` (grep-based; pins
    C1's non-waivability as a property of the code, not a `GATE_MATRIX` cell a tier edit
    could soften)
  Focused: `node --test brain/scripts/governance/lane-scrub.test.mjs` — RED (module absent).
- [x] A4.4 GREEN: `brain/scripts/governance/lane-scrub.mjs` — pure
  `evaluateLaneScrub({addedFiles, config, readFile}) -> {pass, uncomputable?, reason}`
  filtering `addedFiles` by `LANE_PATH_RE`, running `scrubRecordsFile` per record, patterns
  from `resolveSecretConfig(config)`, destructuring `{pattern, lineNumber}` and dropping
  `.line`. Thin `main()` reusing `resultToExit`. NEVER imports `governance-tiers.mjs`.
  Focused: same command — GREEN. `npm test` — green (neither script is wired into the
  workflow or `GOVERNANCE_JOBS` yet — A5 does that next, deliberately separated so this
  commit's tests prove the pure/IO seam in isolation before registration).

Commit: `feat(governance): add lane-paths and lane-scrub check scripts (#905)`.

### A5. Registration — `GOVERNANCE_JOBS` + `GATE_MATRIX` + `governance.yml`, one commit (spec "job registration is atomic"; design A7; workflow-auth constraint)

- [x] A5.1 RED: extend `brain/scripts/vcs/governance-checks.test.mjs` AND
  `brain/scripts/vcs/governance-tiers.test.mjs` in the same edit —
  - `GOVERNANCE_JOBS` gains `'lane-paths'` and `'lane-scrub'` APPENDED AT THE END (order
    matters — `governance-checks.test.mjs:91` asserts YAML job order equals this array)
  - `GATE_MATRIX` gains two rows appended at the end, `policy: 'required'` at every tier,
    evidence tags `lane-path-restriction` / `secret-scan`
  - `checkContexts('lite')` (and every other tier) contains both names
  - the drift guard: red until `GOVERNANCE_JOBS`, `GATE_MATRIX`, AND the YAML all list ten
    matching job names, in the same order — this IS the intended red-before-green signal for
    the whole unit
  - `NEVER_TIERED` stays at six entries — confirm `governance-tiers.test.mjs:36` stays green,
    do not touch that array
  Focused: `node --test brain/scripts/vcs/governance-checks.test.mjs brain/scripts/vcs/governance-tiers.test.mjs` — RED.
- [x] A5.2 GREEN, ONE commit, three files together:
  - `brain/scripts/vcs/governance-checks.mjs` — append `'lane-paths'`, `'lane-scrub'` to
    `GOVERNANCE_JOBS` (`:41-50`)
  - `brain/scripts/vcs/governance-tiers.mjs` — append two `GATE_MATRIX` rows (`:150-219`),
    `policy: 'required'` at every tier
  - `.github/workflows/governance.yml` — append two new jobs AT THE END, matching
    `GOVERNANCE_JOBS`'s new order exactly. Each job's step `env:` MUST NOT declare
    `PR_NUMBER` (`lib/workflow-auth.mjs:57-64` — a step declaring `PR_NUMBER` requires
    `VCS_TOKEN`; both new jobs need only `BASE_SHA`/`HEAD_SHA` + ambient
    `GITHUB_HEAD_REF`, so they stay offline by construction). Both jobs use
    `actions/checkout@v4` with `fetch-depth: 0`. Additionally, the EXISTING `issue-link` job
    gains `fetch-depth: 0` and `BASE_SHA`/`HEAD_SHA` env (it has neither today, `:44-63`) —
    it already declares `PR_NUMBER` + `VCS_TOKEN` for `fetchIssue`, so its auth verdict is
    unchanged.
  Focused: same two commands — GREEN, ten jobs, matching order everywhere. Then:
  `node --test brain/scripts/vcs/lib/workflow-auth.test.mjs brain/scripts/vcs/engine-blind-gates.test.mjs`
  — confirm the two new steps need no credential, and that `governance/**` stays covered by
  its existing `dirs` entry (`:123`) with no `VERIFICATION_SURFACE` edit needed here (PR 2
  adds `memory/index-lag.mjs` separately, B2).
  `npm test` — full suite green.

Commit: `feat(governance): register lane-paths and lane-scrub as required contexts (#905)`.

### A6. Template sentence (spec "the template sentence describes the lane"; design D5/L6)

- [x] A6.1 RED: extend `brain/scripts/vcs/contributor-scaffold.test.mjs` — the emitted
  `.github/PULL_REQUEST_TEMPLATE.md` (via the scaffold's own render function) matches the
  COMMITTED file byte-for-byte, including the new sentence:
  ```
  - [ ] Session memory captured as a record (`memory:save --issue N`); it reaches `main`
        on the lane. Where the pipeline hands `memory-gate` this description, an unscoped
        record does NOT satisfy it. `skip:memory-gate` is named in the docs but no gate
        reads it — applying it exempts nothing.
  ```
  replacing the current three-line block at source `:274-277` (measured in 0.2) except the
  first line, which is now the sentence above.
  Focused: `node --test brain/scripts/vcs/contributor-scaffold.test.mjs` — RED. Confirm and
  note in apply-progress whether RED comes from the emitted-vs-expected mismatch or the
  emitted-vs-committed mismatch (the test file may assert both).
- [x] A6.2 GREEN: `brain/scripts/vcs/contributor-scaffold.mjs:274-277` — replace with the
  ratified wording above. Regenerate `.github/PULL_REQUEST_TEMPLATE.md` via the scaffold's own
  emit path — never hand-edit; `contributor-scaffold.test.mjs` refuses a hand-edit — so the
  committed file and the emitted one match byte-for-byte.
  Focused: same command — GREEN. `npm test` — full suite green, all six new A-slice test files
  passing together with the four extended ones.

Commit: `docs(vcs): describe the lane in the contributor template sentence (#905)`.

### Wrap-up A

- [ ] A.W1 `npm test` full run — record pass count in apply-progress before pushing.
- [ ] A.W2 `memory:save --issue 905` — record-first, committed before the first push.
- [ ] A.W3 Fresh-context review of the diff before opening PR 1.
- [ ] A.W4 Push; open PR 1 with `Closes #905`, `Part of #889`, `Parent: #864` in prose, label
  `type:feature`. Body: summary (three bullets — the predicate, the recomputed exemption, the
  two required contexts), changes table, test plan (every `node --test` command above plus the
  full `npm test`), the reconciliation notes (D5's template-ownership departure from
  ADR-0034's 3.1d assignment; D2's no-code decision for `actor-check`; A6's departure from D3's
  wording — `lane-scrub` scans every PR, not only lane PRs, flagged for the maintainer as an
  open question, non-blocking), dependency diagram (chained-pr skill, marking this PR 📍),
  contributor checklist per `branch-pr` skill.
- [ ] A.W5 `brain:review` before requesting human review.

**Maintainer act, after PR 1 merges — not in any diff, no code task:**
```
npm run brain:protect               # admin token; arms checkContexts('lite') = today's six + lane-paths + lane-scrub
npm run brain:governance-status     # must report BOTH lane-paths and lane-scrub armed
```
No real `memory:ship` run is valid before both contexts report armed — D1(a)/A4's recomputed
exemption is what keeps the repo safe in the window between merge and this act, not a substitute
for it.

---

## Slice B — audit + index (#889), PR 2

Stacked on slice A per `stacked-to-main`: branch `feat/issue-889-lane-audit-index`, cut from PR 1's
branch once it is opened. PR 2 body: `Closes #889`, `Parent: #864`.

### B1. Unit — `brain-audit.mjs`: the `[LANE]` audit row (spec "brain:audit reports [LANE] on both signals"; design A8)

- [x] B1.1 RED: extend `brain/scripts/brain-audit.test.mjs` — synthetic-walk fixtures matching
  the file's existing fixture style (fake `fetchPrMeta`/`readMergeDiff`, or a temp-repo
  squashed merge if that is the file's established pattern):
  - a merge whose diff is records-only additions under `.memory/records/` AND whose
    `issueLinkBody` (NOT the raw commit body) matches `/^Memory lane: /m` ⇒ prints
    `[LANE] <sha7> <subject>`, `evaluateMerge` is NEVER called (spy asserts zero calls)
  - the SAME records-only-additions merge WITHOUT the marker ⇒ evaluated normally
    (`evaluateMerge` IS called, same as today)
  - a merge mixing one code path alongside records-only paths, WITH the marker ⇒ evaluated
    normally (`lanePaths` is false, so the conjunction fails)
  - the `[UNCOMPUTABLE]` guard still short-circuits BEFORE this check (a merge whose PR
    metadata failed is never classified as a lane on a fallback body)
  - this file proves only that the walk reads `lanePaths` with `sourceBranch: null` — the
    `lane === laneBranch && lanePaths` invariant itself is A1's test, not re-asserted here
  Focused: `node --test brain/scripts/brain-audit.test.mjs` — RED.
- [x] B1.2 GREEN: `brain/scripts/brain-audit.mjs` — after `issueLinkBody` is computed and
  after the `[UNCOMPUTABLE]` guard (`:315-324`), before `evaluateMerge` (`:326`), add:
  ```js
  const laneMerge = classifyLane({ sourceBranch: null, changedFiles, addedFiles });
  if (laneMerge.lanePaths && /^Memory lane: /m.test(issueLinkBody ?? '')) {
    console.log(`[LANE] ${sha7} ${subject}`);
    continue;
  }
  ```
  mirroring the existing `[SKIP]` short-circuit shape at `:266-282`. Import `classifyLane` from
  `governance/checks/lane.mjs` (A1). Never touches `evaluateMerge` itself (ADR-0016 keeps the
  evaluator context-unaware).
  Focused: same command — GREEN. `npm test` — green.

Commit: `feat(vcs): print [LANE] for a records-only lane merge in brain:audit (#889)`.

### B2. Unit — `memory/index-lag.mjs`: non-mutating rebuild + compare (spec "local-checks warns on index lag, never fails"; design A9, discovered requirement)

- [x] B2.1 RED: `brain/scripts/memory/index-lag.test.mjs` (new) —
  - the committed `index.jsonl`'s id set differs from `readRecords()`'s id set ⇒
    `compareIndexToRecords` reports `lagged: true` with `indexed`/`rebuilt` counts, `main()`
    prints a warning naming both counts, exits 0
  - id sets match ⇒ `lagged: false`, silent, exits 0
  - missing `index.jsonl` ⇒ reads as an empty index, warns, exits 0 — never throws
  - NO FILE IS WRITTEN in any case — assert bytes + mtime of `index.jsonl` and every record
    file are IDENTICAL before and after `main()` runs (the comparison must use `readRecords`,
    never `rebuildIndex`, which writes)
  Focused: `node --test brain/scripts/memory/index-lag.test.mjs` — RED (module absent).
- [x] B2.2 RED (discovered requirement, design A9): extend
  `brain/scripts/vcs/engine-blind-gates.test.mjs` — `brain/scripts/memory/index-lag.mjs` MUST
  be declared in `VERIFICATION_SURFACE.scripts` (beside `check-refs.mjs`, `:128`) because it
  is outside every declared `dirs` entry (`:143-157`). Confirm this assertion is RED before
  the `governance-tiers.mjs` edit below — this is `npm test`'s own signal that the script
  exists but is unverified.
  Focused: `node --test brain/scripts/vcs/engine-blind-gates.test.mjs` — RED.
- [x] B2.3 GREEN: `brain/scripts/memory/index-lag.mjs` — pure
  `compareIndexToRecords({indexLines, records}) -> {lagged, indexed, rebuilt, missingFromIndex, staleInIndex}`
  comparing id SETS, never bytes (`serializeIndex` is deterministic, so a byte compare would
  also flag a harmless key-order/newline difference as "lag" — never cry wolf), plus a thin
  `main()` built on `readRecords({recordsDir})` (never `rebuildIndex`) that prints the warning
  and ALWAYS exits 0. `brain/scripts/vcs/governance-tiers.mjs` — add
  `'brain/scripts/memory/index-lag.mjs'` to `VERIFICATION_SURFACE.scripts`.
  `.github/workflows/governance.yml` — add one step to the `local-checks` job invoking the
  new script's `main()`.
  Focused: `node --test brain/scripts/memory/index-lag.test.mjs brain/scripts/vcs/engine-blind-gates.test.mjs`
  — GREEN. `npm test` — full suite green.

Commit: `feat(memory): warn on index lag without blocking or mutating (#889)`.

### Wrap-up B

- [x] B.W1 `npm test` full run — record pass count in apply-progress before pushing. 5091/5091
  green (baseline 5078 + B1's 4 + B2's 9).
- [ ] B.W2 `memory:save --issue 889` — record-first, committed before the first push.
- [x] B.W3 Tick epic task 3.1c in `openspec/changes/issue-864-memory-2-0/tasks.md`, referencing
  PR 2's number once known — on THIS PR, the closing PR for #889.
- [ ] B.W4 Fresh-context review of the diff before opening PR 2.
- [ ] B.W5 Push; open PR 2 with `Closes #889`, `Parent: #864` in prose, label `type:feature`.
  Body: summary (the `[LANE]` audit row, the non-mutating index-lag warning), changes table,
  test plan, dependency diagram marking this PR 📍 and PR 1 as the merged prerequisite
  (chained-pr skill), the D7 exit sequence stated as the NEXT steps after merge (not part of
  this PR's own scope — see below), contributor checklist per `branch-pr` skill.
- [ ] B.W6 `brain:review` before requesting human review.

---

## D7 — exit sequence (maintainer/orchestrator acts after PR 2 merges; no code, not part of any PR diff)

- [ ] D7.1 `npm run brain:protect` then `npm run brain:governance-status` — confirm BOTH
  `lane-paths` and `lane-scrub` report armed on `main` (repeat of the slice-A maintainer act if
  not already done, or its confirmation if it was).
- [ ] D7.2 The FIRST REAL `memory:ship` lane PR from this machine, merged BY HAND
  (`allow_auto_merge` stays `false` on this repo until #805). Record: PR number, the eight
  green contexts, the merge SHA.
- [ ] D7.3 The SAME DAY, a second `npm run memory:ship -- --json` run while the PR from D7.2 is
  already armed — step 5 re-calls `mrAutoMerge` unconditionally, so the already-armed response
  lands verbatim in `autoMerge.reason`. Capture it as a fixture with `recorded: true` for #886's
  classifier — its OWN small PR, not folded into #889's diff.
- [ ] D7.4 `npm run brain:audit` over the window containing the D7.2 merge — confirm it prints
  `[LANE]`, never `[FAIL]`.

No real `memory:ship` run is valid before D7.1 shows both contexts armed.

## Non-goals

No change to `collect`/`plan`/`ship`/`mrCreate`/`mrList`/`mrAutoMerge`/`vcsToken()` or the record
format. No `memory-gate` logic change (it reads the PR tree, not the diff). No `SessionEnd` hook or
`day:start` sweep — sub-ticket **#906**, gated behind `memory.lane.enabled` (default `false`),
explicitly OUT of both PRs in this file. No #805 auto-merge-enable machinery. No #890 feature-PR
surface retirements (the five surfaces stay live). No new VCS port verb, no head-branch field on
`fetchPrMeta`. No `--force` anywhere. No branch-protection API call from CI (`brain:protect` is a
maintainer act with an admin token, never in a diff). No `type:*` label exemption. The ADR-0034
regex reconciliation (the `(-\d+)?` suffix `plan.mjs` cannot produce, design A3's open question) is
the maintainer's call, not this slice's.

## Review Workload Forecast

- **PR 1 (#905)**: counted ~277 (`checks/lane.mjs` ~55; `run-check.mjs` ~30; `lane-paths.mjs`
  ~50; `lane-scrub.mjs` ~60; `governance.yml` ~50; `GOVERNANCE_JOBS` + 2 matrix rows ~22;
  scaffold + template ~10). Reviewer-visible with tests: ~760. Both inside the `lite` CI budget
  (`diffBudget: 1000`, `governance-tiers.mjs:259`) and inside the 400-line reviewer budget.
  400-line budget risk: Low. Chained PRs recommended within this slice: No — already the
  smaller half of an already-ratified two-PR split.
- **PR 2 (#889)**: counted ~87 (`brain-audit.mjs` ~30; `memory/index-lag.mjs` ~50;
  `governance.yml` step ~5; `VERIFICATION_SURFACE` ~2). Reviewer-visible with tests: ~270.
  400-line budget risk: Low. Chained PRs recommended within this slice: No.
- Chained PRs recommended (change-level): **Yes — already realized.** The ratified two-PR
  `stacked-to-main` split (PR 1 → #905, PR 2 → #889) was decided in the ruling
  (`sdd/issue-889-lane-governance/ruling`, D8) before this phase. Nothing here reopens it.
- Decision needed before apply: **No.** Delivery strategy, chain strategy, and the PR boundary
  were all ratified 2026-09-10. The two open questions in `design.md` (A3's suffix grammar, A6's
  every-PR scrub scope) are flagged in each PR's body for the maintainer — informational,
  non-blocking.
