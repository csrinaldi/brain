---
status: tasked
issue: 887
---

# Tasks: #887 — the lane collector: a pure planner, an IO shell, and one local ref

Implements `spec.md` under the ratified ruling `sdd/issue-887-lane-collector/ruling` (D1–D7,
2026-09-09). Parent: #864 task 3.1a, ADR-0034 **L4 + C2**. Design's split recommendation
(`design.md` "Changed-line forecast and the delivery recommendation") is taken as the work
shape: **Slice A — the planner** (`lane/plan.mjs`, `lane/plan.test.mjs`, A7's `format.mjs`/
`store.mjs` move, ~152 counted) and **Slice B — the shell and the verb**
(`lane/collect.mjs`, the `collect` op in `memory/cli.mjs`, both i18n catalogs, `package.json`,
`collect.integration.test.mjs`, `cli.collect.test.mjs`, ~242 counted).

STRICT TDD MODE IS ACTIVE. Test runner: `npm test` (`node:test`). Every implementation task
below is preceded by its failing-test task, file and case titles taken from `spec.md`'s STRICT
TDD test map. Run the focused `node --test` command after each RED/GREEN pair; run the full
`npm test` before each commit.

**PR mechanics decision — PENDING** (see "Chained-PR mechanics" below). This file plans both
slices assuming they ship as two PRs; Slice B's branch/target is written two ways (feature-branch
chain vs. a stacked-to-main both-close shape) until the maintainer or the orchestrator picks one,
per the Review Workload Forecast.

## Chained-PR mechanics — the gate evidence, read before opening either PR

`stacked-to-main`, as epic design intends it (`archive/862/design.md:240-241`, "each slice is
its own PR to main, no tracker branch"), was written for epic-task-level slices — #887, #888,
#889, #890 are four **different** GitHub issues, each closed by its own PR. This proposal's
in-issue split is different: **two PRs, one issue (#887)**. The governance gate does not treat
that case the way the epic rule assumes:

- `runIssueLinkCheck` computes `closingRequired = requiresClosingKeyword(ctx)` via
  `ctx.targetBranch === ctx.defaultBranch` (`brain/scripts/governance/run-check.mjs:264-267`).
  On a PR whose target branch **is** `main` (the default branch), `closingRequired` is `true`.
- `extractIssueNumber(body, closingRequired)` — when `closingRequired` is `true` — matches
  **only** `CLOSING_RE` (`close[sd]?|fix(?:e[sd])?|resolve[sd]?` + `#N`); it never falls through
  to `CHAIN_RE` (`\bpart\s+of\s+#(\d+)/i`) in that branch (`run-check.mjs:234-246`,
  `checks/issue-ref-patterns.mjs:30,35`).
- Net effect: **a PR that targets `main` and carries only "Part of #887" fails `issue-link`.**
  There is no branch in `runIssueLinkCheck` that accepts a chain reference once
  `targetBranch === defaultBranch`. This matches the #862 explore's measurement referenced in
  the brief — a non-closing PR to `main` is refused.

Three shapes are viable under this gate; none is silently assumed:

1. **Both PRs target `main`, both carry a closing keyword for #887.** Passes `issue-link` on
   both. **Not recommended**: GitHub auto-closes #887 the moment PR A (Slice A) merges, before
   Slice B — the collector's only invocable surface — exists. The issue reads "closed" while
   `npm run memory:collect` still doesn't exist. Reopening #887 by hand after PR A merges is an
   operational step this plan does not want to depend on.
2. **Feature-branch chain**: PR A (Slice A) targets a tracker branch
   (`feat/issue-887-lane-collector`, itself never merged directly — or, more simply, PR A targets
   PR B's future branch directly if a tracker is skipped and PR B is authored on top of PR A's
   branch before PR A merges). `ctx.targetBranch` for PR A is then not `main`, so
   `requiresClosingKeyword` returns `false` and `extractIssueNumber` falls through to `CHAIN_RE` —
   `Part of #887` / `Parent: #864` is accepted. PR B targets `main` and carries `Closes #887`,
   closing the issue only when the collector is actually invocable. This does not violate the
   epic's "no tracker branch" rule, because that rule governs the four epic-task-level PRs
   (#887/#888/#889/#890), not a sub-split inside one of them. **Viable, and closes #887 at the
   right moment.**
3. **Single PR, `size:exception`.** Sidesteps the issue-link question entirely — one PR, one
   `Closes #887`, ~394 counted lines against the 400 budget waived via the `size:exception`
   label, honored only where `tierParams(tier).honorSizeException` allows it
   (`run-check.mjs:399-438`; `lite`/`standard` tiers honor it, `regulated` does not — confirm the
   project's tier before relying on this). **Viable if the maintainer accepts the exception and
   the tier honors it.**

**Recommendation carried into the forecast below: shape 2 (feature-branch chain for this
in-issue split) if two PRs are wanted, else shape 3.** Shape 1 is documented as gate-legal but
not proposed — it trades a governance pass for a real premature-closure defect.

## Slice A — the planner (pure, no fs, no spawn, no clock, no os)

Branch: `feat/issue-887-lane-collector-plan` (or, if the maintainer picks shape 2, the branch
that becomes PR A's head in the feature-branch chain — same branch either way, only the PR
target and body differ; see "The PR — Slice A" below).

### A1. `lane/plan.test.mjs` — RED, the full case set before any implementation

- [x] A1.1 RED `brain/scripts/memory/lane/plan.test.mjs` — candidate selection and skip routing
      (spec "candidate selection is narrow and structural (D5)"): an untracked, clean,
      off-main file is a candidate; `modified-tracked` / `invalid` / `already-on-main` each skip
      with their own reason and none is collected; `.memory/index.jsonl` is excluded by filename
      grammar and never appears in `collected` or `skipped`; a `not-a-record` name (including a
      pre-#677 `<yyyy-mm>.jsonl` month log) skips with a message pointing at
      `memory:split-records`; a secret-marked candidate is routed to `skipped` with `pattern` +
      `lineNumber` and **never appears in `files`**, asserted by inspecting `plan.files` directly
      — not by grepping stdout, so the assertion holds even before `collect.mjs` exists (A1's
      rationale in `design.md`: the planner is the single gate, `hash-object -w` is structurally
      unreachable for a marked candidate).
      Focused: `node --test brain/scripts/memory/lane/plan.test.mjs` — RED (module does not
      exist).
- [x] A1.2 RED, same file — dedup on divergence (spec "deterministic dedup on divergence
      (D3/C2)"): identical-bytes copies collapse to one blob, no divergence reported; diverging
      copies resolve by lexicographic worktree path then physical line, comparator is
      `(a < b ? -1 : a > b ? 1 : 0)` (never `localeCompare` — A6), and the group appears in
      `duplicates` as divergent; the `divergent` flag follows `canonicalOrNull(a) !== canonicalOrNull(b)`
      (imported from `format.mjs`, A7) so a key-order-only difference is a **duplicate**, not a
      divergence.
- [x] A1.3 RED, same file — stability (spec "stability under shuffled enumeration"): three
      worktrees × four files, **all 6 permutations** of enumeration order enumerated
      exhaustively (not randomised), each `deepStrictEqual` against a reference plan; a second
      call on identical input returns an identical plan.
- [x] A1.4 RED, same file — ref/message naming and empty-input shape: host slug regex (A5) —
      lowercase, `[^a-z0-9]` → `-`, collapsed, trimmed, truncated to 40; the finished ref is
      asserted against L1's grammar
      `^refs/heads/memory/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$` and throws `memory.collect.badHost`
      on an empty slug; `message` is `'memory: <host-slug> <date> (<n> records)'`; a plan built
      from zero candidates returns `commit: null` and an empty `duplicates` shape
      (`emptyDuplicates()`).
      `npm test` — still fine, unrelated files untouched.

Commit: `test(memory): add planLaneCommit unit suite — grouping, C2 tiebreak, stability, skip
routing (#887)`.

### A2. `lane/plan.mjs` — GREEN

- [x] A2.1 GREEN `brain/scripts/memory/lane/plan.mjs` — `planLaneCommit({ candidates, mainPaths,
      host, date, parent })` per `design.md`'s module map: group by `file`, C2 tiebreak inside a
      group, `skipped` routing for every non-collectable candidate (closed reason set:
      `already-on-main` · `modified-tracked` · `unexpected-status` · `not-a-record` · `invalid` ·
      `secret` · `unreadable`), host-slug + ref-grammar assertion, `message` construction, `files`
      sorted by `path`, `skipped` sorted by `(file, worktree)`. No `node:fs`, no `child_process`,
      no clock, no `os` import — a source guard in A1's suite (or a dedicated case) asserts this.
      Focused: `node --test brain/scripts/memory/lane/plan.test.mjs` — GREEN, all of A1.
      `npm test` — green project-wide (nothing else imports the module yet).

Commit: `feat(memory): implement planLaneCommit — the pure lane planner (#887)`.

### A3. A7's move — `canonicalOrNull` into `format.mjs`

- [x] A3.1 Move the private `canonicalOrNull` (`brain/scripts/memory/lib/store.mjs:417-427`) into
      `brain/scripts/memory/lib/format.mjs` beside `canonicalJson`, export it; `store.mjs` imports
      it instead of defining it. Mechanical move, no behaviour change.
      Focused: `node --test brain/scripts/memory/lib/store.test.mjs` — GREEN, unchanged
      assertions (the existing store suite is the regression guard for this move — no new test
      file). Then re-run `node --test brain/scripts/memory/lane/plan.test.mjs` to confirm the
      planner's import of `canonicalOrNull` from `format.mjs` (A1.2) is GREEN.
      `npm test` — full green.

Commit: `refactor(memory): move canonicalOrNull to format.mjs, export it (#887)`.

## Slice B — the shell and the verb

Branch: on top of Slice A's branch (either as PR B's head in a feature-branch chain, or as a
second `main`-targeted branch cut after Slice A merges — see the PR section).

### B1. `lane/collect.integration.test.mjs` — RED, real temp repo

- [x] B1.1 RED `brain/scripts/memory/lane/collect.integration.test.mjs` — scaffold: `testTmp
      ('brain-lane-')` (`lib/test-tmp.mjs:35`), `git init -q -b main`, a **bare** origin
      (`git init --bare` + `remote add origin <path>` + push) so `fetch` works offline, two real
      `git worktree add` trees (`bootstrap.worktree.test.mjs:82`'s pattern). Fixtures per
      worktree: an identical-bytes record, a divergent record (same filename, different bytes),
      a secret-bearing record, an already-on-`origin/main` record, a modified-tracked record.
      Focused: `node --test brain/scripts/memory/lane/collect.integration.test.mjs` — RED
      (`collectLane` does not exist).
- [x] B1.2 RED, same file — the no-mutation invariant (design's 3a): `git status --porcelain
      -uall` in both worktrees **and** the main checkout, snapshotted before the run, asserted
      byte-identical after; `rev-parse HEAD` unchanged in each. `-uall` is load-bearing here (A8):
      the fixture starts with `.memory/records/` wholly untracked, so a regression to the default
      `-unormal` would collapse the directory into one `?? .memory/records/` entry and silently
      collect zero candidates — this case is written so that mistake fails loudly, not silently.
- [x] B1.3 RED, same file — the secret path (design's 3c): compute the would-be blob id with
      `git hash-object --stdin` (no `-w`) and assert `git cat-file -e <oid>` exits non-zero;
      assert the path is absent from `git ls-tree -r <commit>`; assert the matched literal
      appears in neither stdout nor stderr; assert every other clean candidate in the batch was
      still collected.
- [x] B1.4 RED, same file — the ref lifecycle (design's 3d): first run creates
      `refs/heads/memory/<host>-<date>` with parent `origin/main`; a same-day re-run with new
      candidates **appends** (`rev-list --count` 2, exactly one `refs/heads/memory/*` entry, never
      a `-<n>` branch); a third run with zero new candidates writes nothing (`commit: null`, ref
      sha unchanged).
- [x] B1.5 RED, same file — CAS (design's 3e, A9): pre-move the ref behind the planner's back
      (simulating a racing writer), then run — exit non-zero, `memory.collect.raced`, ref left
      untouched, no retry.
- [x] B1.6 RED, same file — scope + seam guard (design's 3b, spec "scope boundary"): a counting
      `git` seam asserts every recorded argv containing `-C` has `status` as its verb
      (behavioural, not a source regex — #886 A4's precedent); no `push`, no PR-body string, and
      no hook invocation is present in `lane/collect.mjs`; main checkout counted as a worktree
      like any other; `prunable`/`bare` stanzas skipped and `git worktree prune` never invoked.
      `npm test` — full run still fine (only this new file is red).

Commit: `test(memory): add collect.integration.test.mjs — real temp repo, two worktrees,
no-mutation and no-secret invariants (#887)`.

### B2. `lane/collect.mjs` — GREEN

- [x] B2.1 GREEN `brain/scripts/memory/lane/collect.mjs` — `collectLane({ root, date, host, git =
      defaultGit, loadConfig = _defaultLoadConfig })` per the design's data flow: `fetch origin
      main` (failure → `baseFetched:false`, continue on local `origin/main`); one `worktree list
      --porcelain`; one `ls-tree origin/main` for `mainPaths`; one `status -z -uall` per worktree
      (`-C <wt>`, read-only); `readFileSync` + `scanTextForSecrets` in-process (the only place
      bytes are read); call `planLaneCommit`; `hash-object -w --stdin --path` per winner only
      (A2, same buffer that was scanned); `GIT_INDEX_FILE=<tmp>` read-tree/update-index/write-tree
      in a `finally`-cleaned `mkdtempSync`; short-circuit to `{commit:null, collected:0}` when the
      built tree equals the parent tree; `commit-tree` with the ambient identity, never a
      fabricated one; `update-ref <ref> <new> <old>` as the CAS, `<old>` = observed tip or `''`.
      The git seam is `defaultGit(argv, {cwd, input, env})` shaped like
      `governance/postmerge/git-seam.mjs:27,54`, injected, never imported directly from that
      module (A3).
      Focused: `node --test brain/scripts/memory/lane/collect.integration.test.mjs` — GREEN, all
      of B1.
      `npm test` — green.

Commit: `feat(memory): implement collectLane — the IO shell, temp index, one local ref (#887)`.

### B3. `cli.collect.test.mjs` — RED

- [x] B3.1 RED `brain/scripts/memory/cli.collect.test.mjs` — the op end to end under
      `BRAIN_MEMORY_TEST_ROOT` (`cli.audit.test.mjs:17-43`'s pattern, `cli.mjs:43-55`'s ambient-
      state trap this seam exists for): a run with candidates prints `memory.collect.done` and
      exits 0 with `{ref, commit, collected, skipped, duplicates}` populated; a run with nothing
      new prints `memory.collect.nothing` and exits 0 with `commit: null`; `--json` parses and
      carries the same shape on stdout only, with duplicate/skip evidence on stderr via
      `reportDuplicates(duplicates, {surface: 'the lane commit'})`; a genuine git failure prints
      `memory.collect.failed` and exits 1; dispatch never invokes any backend's `share`
      regardless of `MEMORY_BACKEND` value or absence; `memory:collect` resolves from
      `package.json`.
      Focused: `node --test brain/scripts/memory/cli.collect.test.mjs` — RED (`collect` not in
      `VALID_OPS`, `memory:collect` script absent).

Commit: `test(memory): add cli.collect.test.mjs — the collect op end to end (#887)`.

### B4. The `collect` op, i18n, `package.json` — GREEN

- [x] B4.1 GREEN `brain/scripts/memory/cli.mjs` — add `'collect'` to `VALID_OPS` (`:103-118`) and
      a dispatch block after `split-records` (`:231` area), **before** backend selection, calling
      `collectLane` with `root` from `BRAIN_MEMORY_TEST_ROOT ?? repoRoot` (A9), wrapped in the
      existing top-level try/catch so a genuine failure exits 1 with `memory.collect.failed`. No
      `unsupportedOp` path — `collect` is never backend-dispatched.
- [x] B4.2 GREEN `brain/scripts/i18n/en.mjs` + `es.mjs` — the eight `memory.collect.*` keys
      (`done`, `nothing`, `offline`, `failed`, `badHost`, `raced`, and the two skip-reason
      surface strings used by `reportDuplicates`'s call site), shape of `en.mjs:306-307`, landed
      in **both** catalogs in the same commit — `i18n/coverage.test.mjs:96-102` fails `npm test`
      on a missing Spanish entry.
- [x] B4.3 GREEN `package.json` — `"memory:collect": "node ./brain/scripts/memory/cli.mjs
      collect"` beside the other `memory:*` scripts (`:65-73`).
      Focused: `node --test brain/scripts/memory/cli.collect.test.mjs` — GREEN, all of B3. Then
      `node --test brain/scripts/i18n/coverage.test.mjs` — GREEN (unmodified test, green only
      once both catalogs carry all eight keys).
      `npm test` — full green.

Commit: `feat(memory): dispatch collect from cli.mjs, wire i18n and memory:collect (#887)`.

### Slice B correction batch (issue #897, fresh cold review)

Applied after B1-B4 above were already `[x]`-ticked, on the same worktree/branch, four commits:

- C1 — `collected`/the commit subject counted `plan.files.length` (group winners), not new
  blobs; a same-day re-run over-reported. Fixed via a `git diff-tree` read between the commit's
  parent tree and the tree just written. `collect.mjs`, `collect.integration.test.mjs`.
- E2 — any non-zero `update-ref` was tagged `raced`; gated on git's actual CAS-lock stderr
  shapes (`cannot lock ref` / `reference already exists` / `is at ... but expected`), everything
  else now reports as a genuine failure. `collect.mjs`, `collect.integration.test.mjs`.
- E3 — `parseWorktrees`'s unread `locked` field dropped; design.md:234 already documents that a
  locked worktree is scanned like any other. `collect.mjs`.
- E4 — `collect`'s `--json` detection scoped to `process.argv.slice(3)`, matching `audit`.
  `cli.mjs`.
- C2 — `removeTempTree` moved from `__fixtures__/tmp-tree.mjs` to `brain/scripts/lib/tmp-tree.mjs`
  (a production location); `__fixtures__/tmp-tree.mjs` now re-exports it. Recorded as design.md
  D8. `lib/tmp-tree.mjs` (new), `__fixtures__/tmp-tree.mjs`, `__fixtures__/tmp-tree-adoption.test.mjs`,
  `collect.mjs`.
- E1 — spec.md's output shape widened from five to six fields (`baseFetched` included), matching
  design.md's module map, which already sanctioned six. `spec.md`.

### CI + review round 1 (issue #897, batch 4)

Applied after the "Slice B correction batch" above, on the same worktree/branch, three commits:

- CI blocker — the GitHub runner (git 2.55, no configured identity) failed every collector test
  with `git commit-tree ... exited 128: Author identity unknown`. `collectLane()`'s own
  `commit-tree` call intentionally never gets an `env` override (D6: ambient identity, never a
  token) — the fixtures were the bug, relying on the developer's global git identity. Fixed with
  repo-local `git config user.name`/`user.email` in both scratch repos, mirroring
  `records-merge.integration.test.mjs`'s precedent. A new test pins the CORRECT failure behavior:
  no identity anywhere (repo, global, system) still fails loudly with git's own message,
  surfaced verbatim via `memory.collect.failed`. `collect.integration.test.mjs`,
  `cli.collect.test.mjs`.
- cold-1 — `parseStatusZ()` mis-parsed a rename/copy record's second NUL-terminated part (the
  bare old path) as its own status-tagged entry, manufacturing a bogus candidate. Fixed: a
  status starting with `R`/`C` now consumes the following part as the old path.
  `collect.mjs`, `collect.integration.test.mjs`.
- cold-2 — `cli.collect.test.mjs` never exercised the `memory.collect.secretSkipped`/
  `.modifiedTrackedSkipped` stderr lines. Added coverage; no implementation change was needed.
  `cli.collect.test.mjs`.

## Apply-time action item — not a code change in this slice

- [x] X1 Posted on #889 on 2026-09-09 (issuecomment-5610489542), after Slice A's first apply
      batch. The exact sentence, for the record:

      > #887 D2 makes a same-day second `collect` **append** a commit onto
      > `refs/heads/memory/<host>-<date>`, so the lane's tree descends from `origin/main` as it
      > was at the day's FIRST run. `lane-paths` must therefore compute its path set
      > **three-dot** — the merge base, `git diff --name-only origin/main...HEAD` — never
      > two-dot: an `origin/main..HEAD` diff reports every record `main` gained after the first
      > run as a **deletion**, and fails the lane by construction. GitHub's PR diff is already
      > three-dot; the required context must match it.

## Non-goals (D7 — restated, no work items)

Explicitly out of scope, unchanged by this slice:

- The push and the PR (#888) — including `--no-verify` and `mrCreate`/`mrAutoMerge` calls; this
  slice must not grow a push call or a PR-body builder.
- `brain:memory:ship` and any hook wiring — `pre-push`, `day:start`, session-end call nothing new
  here (#888).
- `lane-paths` / `lane-scrub` as CI contexts (#889) — the apply-time comment above is the only
  touch point.
- Retiring `pre-push:70` and the other four feature-PR surfaces (#890) — they keep working
  untouched, so this slice is additive and reversible.
- Any change to `share`, `reindex`, the record format, or `memory-gate`.
- No `brain/core/**` write, no `brain-drafts/` file — ADR-0034 already carries the collector's
  ruling; no doctrine promotion is needed for this slice (unlike #886).

## Wrap-up per PR

Each PR (Slice A, Slice B) does its own wrap-up before its own push:

- [x] W1 `npm test` full run, green, on that slice's branch.
- [x] W2 Record-first per PR: `rec-fa2869c4792a5941` (`--issue 897`, PR A) and
      `rec-7b2e1e8f09bcf068` (`--issue 887`, PR B), each committed before its push.
- [x] W3 Epic task 3.1a ticked in PR B (with 1.1, which #862's archive had left unticked).
- [x] W4 `brain:review` per PR: #898 APPROVE at 4973ce4a (round 1, after a fresh review's
      corrections landed before the push); #899 REVISE at 09d58bff (CI identity blocker,
      `parseStatusZ` rename record, a CLI stderr test) then APPROVE at 2db6a1ee.

Merge order: Slice A merges (or is approved and integrated per the chosen chain shape) before
Slice B is opened for final review — Slice B's `collect.mjs` imports nothing from Slice A that
isn't already on the branch it is built on, but the review order in `design.md`'s own
recommendation (planner → shell/verb) should hold for merge order too.

## The PR — Slice A

- [x] PR-A.1 Shipped as PR #898 from `feat/issue-897-featmemory-the-lane-planner`, `Closes #897`
      (the maintainer chose a sub-ticket for slice A so both PRs stack to `main` without closing
      #887 early — shape 1 with a child issue, not shape 2 or 3), `Part of #887` and
      `Parent: #864` in prose, `type:feature`; merged as 35fd2926 on 2026-09-09.
      Original decision notes, for the record:
      - Shape 2 (feature-branch chain): target is not `main`; body carries `Part of #887` and
        `Parent: #864` in prose. Does not close the issue.
      - Shape 3 (single PR): this task list collapses into one PR — see "Single-PR fallback"
        below; skip PR-A/PR-B as separate PRs.
      - Shape 1 is not proposed (see "Chained-PR mechanics" above) but is documented as gate-
        legal if the maintainer prefers it over waiting for Slice B.

## The PR — Slice B

- [x] PR-B.1 Shipped as PR #899, rebased onto #898's squash, `Closes #887`; merged as 2ec28558 on
      2026-09-10. Original notes: push the branch (on top of Slice A's merged/landed state). Body: summary, changes
      table (`lane/collect.mjs`, `cli.mjs`, `i18n/{en,es}.mjs`, `package.json`,
      `collect.integration.test.mjs`, `cli.collect.test.mjs`), test plan, label `type:feature`.
      Body carries `Closes #887`, `Parent: #864` in prose — this is the PR that makes the
      collector actually invocable, so it is the correct place for the issue to close.

## Single-PR fallback (shape 3, `size:exception`)

- [x] SP.1 Not taken — the maintainer chose two PRs (#898, #899). Kept for the record: if shape 3
      had been chosen, combine A1–A3 and
      B1–B4 onto one branch, one PR, `Closes #887`, label `type:feature` plus the `size:exception`
      label (request it from the maintainer before pushing — `runDiffSizeCheck` only honors the
      label at tiers where `honorSizeException` is true; confirm the project's tier first,
      `brain/scripts/governance/run-check.mjs:399-438`). Body states the ~394 counted / ~1,050
      reviewer-visible total and why it wasn't split (design's own forecast, restated). Wrap-up
      (W1–W4) runs once, including the epic tick.

## Review Workload Forecast

- Estimated changed lines (counted per `brain.config.json:18-29`, excluding `**/*.test.mjs` and
  `openspec/changes/**`): `lane/plan.mjs` ~130, `lib/format.mjs` + `lib/store.mjs` (A7's move)
  ~22 — **Slice A ~152**; `lane/collect.mjs` ~185, `memory/cli.mjs` ~40, `i18n/en.mjs` +
  `es.mjs` ~16, `package.json` ~1 — **Slice B ~242**. **Combined counted total ~394.**
- Reviewer-visible total, including ignore-listed test paths: `plan.test.mjs` ~200,
  `collect.integration.test.mjs` ~280, `cli.collect.test.mjs` ~170 → **~650 uncounted**, **~1,044
  grand total** across both slices if reviewed together.
- 400-line budget risk: **High** — ~394 counted against a 400 budget is ~1.5% headroom in a
  single PR; a single PR would also be ~1,044 reviewer-visible lines in one sitting.
- Chained PRs recommended: **Yes.**
- Decision needed before apply: **Yes** — two open questions, both resolved above with a
  recommendation but neither decided by this file: (1) two PRs vs. one PR with `size:exception`;
  (2) if two PRs, feature-branch chain (shape 2, recommended) vs. both-close stacked-to-main
  (shape 1, gate-legal but not recommended — premature issue closure).
- Reviewer-visible totals per slice if split: Slice A ~152 counted / ~352 visible; Slice B ~242
  counted / ~692 visible — both comfortably under 400 counted individually.
