---
status: draft
issue: 967
---

# Tasks — an epic's tracker (and the epic itself) as data (#967)

Strict TDD is active (`GIT_CONFIG_GLOBAL=/dev/null npm test` = `node --test
"brain/scripts/**/*.test.mjs" "test/**/*.e2e.test.mjs"`). Every task that adds
behaviour is preceded by the task that writes its failing test; each pair names
the test file, the module and the mutation that must turn the test red.

**Chain strategy: `feature-branch-chain` on the tracker `feature/issue-967`** —
the maintainer's standing rule for a large change, applied here from the start
(this change is the one that makes that rule data, so delivering it stacked onto
`main` would be the ticket contradicting its own content). PR A targets the
tracker; PR B targets A's branch and PR C targets B's branch while their parents
are open, each retargeted to the tracker as its parent merges. Only the tracker
PR targets `main`.

Terminal PR: `feature/issue-967` → `main`, carrying `Closes #967`, under `size:exception`

**Branch preparation (before PR A).** This worktree's branch
`feat/issue-967-featgovernance-an-epics-tracker-is-data` was cut off
`origin/main` (explore.md:151). Create `feature/issue-967` off `main`, push it,
and rebase this branch onto it, or PR A's diff will show the tracker's ancestry
instead of the slice.

## Spec reconciliation — design wins, amend `spec.md` in PR A's first commit

`design.md` measured the tree; `spec.md` was written before those measurements.
Nine points where they disagree. **Each is a spec amendment, not an
implementation choice** — apply must edit `spec.md` in PR A's first commit and
then implement the design's answer.

1. **The parent regex.** R967-2's prose (and proposal Q3's `^Parent:\s*#(\d+)\s*$`)
   vs design Q3's `/^Parent:[ \t]*#(\d+)\b/m`. The `$`-anchored shape matches
   nothing in #881's real body (`scratchpad/issue-881.md:3`). Write the design's
   regex verbatim into R967-2.
2. **A mid-line `Parent:` raises no divergence.** R967-2's scenario 4 demands one;
   design D2 defines exactly four reasons and a non-matching line is simply not a
   declaration. Amend to: `node.parent` is `null`, nothing is said.
3. **A block `parent:` beside a prose `Parent:` raises no divergence.** R967-2's
   scenario 1 demands one; design D3 says the block key wins and the prose line is
   never read. Drop the divergence clause.
4. **The channel is new, not the existing `divergences`.** R967-1/R967-4 route the
   said divergences through the graph's existing array; design D2 rejects that,
   measured — `renderSummary` reads `d.from`/`d.to`/`d.only`
   (`epic-render.mjs:115-117`) and the array is gated on a native read
   (`epic-graph.mjs:419-423`) that never happens in the snapshot path
   (`snapshot.mjs:208`). Amend both requirements to name
   `declarationDivergences`.
5. **A parent absent from the issue set raises no divergence.** R967-4's scenario 2
   demands one; design D5 refuses — "not in this list" is not "not an epic".
   Amend to: `node.parent` keeps its number, nothing is said, nothing throws.
6. **The tracker grammar.** R967-1's `^feature/\S+$` vs design D2's
   `/^feature\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/` plus a `..` refusal. Amend
   the table row to the design's regex.
7. **Seven deep-equal sites, not six.** Proposal Q8's list (inherited by the
   spec's test bill) names `:40 :91 :97 :103 :174 :180`; design Q8 measured a
   seventh at `epic-map.test.mjs:747-748`. Amend the count wherever stated.
8. **The parity test is `snapshot.test.mjs`.** R967-3's scenario 2 reads as a
   `snapshot-cli.test.mjs` job; that file runs with no VCS port and asserts "graph
   not computed" (`snapshot-cli.test.mjs:39`), so it never sees a node field.
   Design D6 leaves it untouched and lands coverage in the fake-port tests.
   Amend the scenario to name `snapshot.test.mjs`.
9. **Two doctrine drafts, not three.** R967-8 asks for three; design D12 ships two
   files. Amend to two, and record the choice: the ratified tracker-PR timing
   sentence rides inside `lite-required-base-branch.md`, whose target
   (`workflow-governance.md`) is where it belongs.

## Activation note — the fields are inert until a body declares them

Nothing in PR A changes any current output: absent keys read `null` and
`scalar()` ignores keys nobody names. Activation is a body edit, not code (design
R5), and it is a maintainer act on the forge. Recorded here so it is a step and
not an omission — see the unticked maintainer tasks in PR A.

**#881 needs no edit.** Its body already carries a line-initial
`Parent: #878 (Brain UI) — slice 3, Wave B.` (`scratchpad/issue-881.md:3`), which
the design's regex admits with `parentSource: 'prose'` — that is the shape D3
chose over adding a `parent:` key to its block.

---

## PR A — the block is data

```brain-slice-scope/1
{"slice": 1, "claims": ["R967-1", "R967-2", "R967-3", "R967-4", "R967-9", "R967-10"], "files": ["brain/scripts/status/epic-graph.mjs", "brain/scripts/status/epic-map.test.mjs", "brain/scripts/status/epic-render.mjs", "brain/scripts/status/snapshot.mjs", "brain/scripts/status/snapshot.test.mjs", "openspec/changes/issue-967-tracker-as-data/spec.md"], "terminal_pr": "feature/issue-967 -> main"}
```

Base: `feature/issue-967` (the tracker). Estimated **65–85 counted source lines,
≈290 review lines**. Closes R967-1, R967-2, R967-3, R967-4, R967-9 scenario 1,
and R967-10's "no `needs`-edge parent fallback" scenario.

- [x] A0. Amend `spec.md` per the nine reconciliation points above — first commit,
      artifact-only (`openspec/changes/**` is uncounted, `brain.config.json:18-29`).
      Point 7 stated no count in `spec.md` to correct, so it landed as an added
      `AND` clause under R967-1 scenario 2 naming the seven measured sites and
      the no-weakening rule; `proposal.md`'s own count is outside PR A's fence.
- [x] A1a. `brain/scripts/status/epic-map.test.mjs`: add the D11 `graphShape()`
      helper (full shape, new keys at their defaults) and rewrite the **seven**
      `assert.deepEqual` sites — `:40`, `:91`, `:97`, `:103`, `:174`, `:180`,
      `:747-748` — to `graphShape({…})`; add a "declares none of the three keys"
      case asserting `kind`/`tracker`/`parent`/`parentSource` all `null` and
      `declarationDivergences: []` (R967-1 S2). RED: the parser returns four keys.
      **Mutation**: switching any site to `partialDeepStrictEqual` or per-key
      `assert.equal` must be refused — a stray key has to keep failing (D11).
- [x] A1b. `brain/scripts/status/epic-graph.mjs:259-273`: read `kind` and
      `tracker` via `scalar(block, …)` after the `track` read at `:272` and return
      `{track, kind, tracker, parent, parentSource, blocks, needs, files,
      declarationDivergences}` so A1a passes.
- [x] A2a. `epic-map.test.mjs`: failing tests for D2's four divergence reasons —
      `tracker: main` and `tracker: feature/../x` → `tracker-grammar` with
      `tracker: null` (R967-1 S6); `tracker:` with no `kind: epic` → the value
      carried plus `tracker-without-kind-epic` (R967-1 S5); `parent: abc` and
      `parent: #878` → `parent-grammar`, `null`, never `0`/`NaN`/a string
      (R967-1 S7); two differing line-initial `Parent:` lines →
      `parent-ambiguous` (R967-2 S5). Exactly one `{key, value, reason}` entry
      each. **Mutation**: dropping the `..` clause turns the `feature/../x` case
      red; first-match-wins on two `Parent:` lines turns the ambiguity case red.
- [x] A2b. `epic-graph.mjs`: implement the grammar check, the digit check and the
      ambiguity rule (the shape `parseGraphBlock` already holds for two blocks at
      `:170-175`), pushing one entry per condition, so A2a passes.
- [x] A3a. `epic-map.test.mjs`: failing tests for parent resolution — a block
      `parent: 878` beside a prose `Parent: #879` yields `878`/`'block'` and no
      divergence (R967-2 S1, amended); #881's line verbatim yields `878`/`'prose'`
      (R967-2 S2); #337's line verbatim
      (`Issue: #337 — M10 Phase 3. Parent: #335. Epic: #313.`) yields `null` and
      says nothing (R967-2 S4, amended); `Epic: #313` alone yields `null`
      (R967-2 S3); `needs: [879]` with no parent yields `null` (R967-10 S2); a
      body whose block is hidden or duplicated returns `{ok: false}` with **no**
      prose salvage (D3, risk R3). **Mutation**: relaxing the anchor to `/Parent:/`
      turns the #337 case red; reading `Epic:` as a synonym turns R967-2 S3 red.
- [x] A3b. `epic-graph.mjs`: implement `/^Parent:[ \t]*#(\d+)\b/m` over the body
      with block-key precedence and no salvage on an unreadable block, so A3a
      passes.
- [x] A4a. `epic-map.test.mjs`: failing `buildGraph` tests — the four fields land
      beside `track` on the node literal (R967-1 S1); `track: UI` +
      `tracker: feature/brain-ui` read from their own keys (R967-1 S3); an unknown
      key is still ignored with no divergence (R967-1 S4); a parent **in** the set
      whose `kind !== 'epic'` yields one graph-level `parent-not-epic` entry
      naming both nodes, with no edge and no status change (R967-4 S1); a parent
      **absent** from the set yields no entry and keeps `node.parent`
      (R967-4 S2, amended); an `epic(…)` title with no `kind:` gives `kind: null`
      (R967-9 S1). **Mutation**: emitting an entry for the absent parent turns
      that case red; inferring `kind` from the title turns R967-9 S1 red.
- [x] A4b. `epic-graph.mjs:394-407`: add `kind`, `tracker`, `parent`,
      `parentSource` as `g?.x ?? null` beside `track` at `:399`; after the node
      loop, lift the per-body entries into graph-level `declarationDivergences`
      as `{number, key, value, reason}` and append the cross-node
      `parent-not-epic` entry (D5), so A4a passes.
- [x] A5a. `epic-map.test.mjs`: failing test — `renderSummary` takes one optional
      `declarationDivergences` parameter defaulting to `[]`, prints one line per
      entry naming the issue, the key and the reason, and every existing caller's
      output is byte-identical when the array is empty. **Mutation**: making the
      parameter required turns the existing `renderSummary` assertions red — the
      proof that no current caller changed.
      *Measured*: every existing call site passes a whole `buildGraph` result, which
      now carries the field, so no pre-existing assertion can go red on it. The
      byte-identity test therefore calls `renderSummary` a second time with the key
      REMOVED — the exact shape every caller had before this change — and that call
      is what the mutation kills.
- [x] A5b. `brain/scripts/status/epic-render.mjs`: implement the optional
      parameter (+1 line at the formatter) so A5a passes.
- [x] A6a. `brain/scripts/status/snapshot.test.mjs`: a **new** fake-port case
      beside `:133-167` — `#5` declares `kind: epic` + `tracker: feature/brain-ui`,
      `#6` declares a block and a line-initial `Parent: #5`; assert both nodes'
      four fields and that `JSON.parse(JSON.stringify(s))` still deep-equals `s`
      (R967-3 S1/S2). A new case rather than an edit, because changing `#6`'s body
      in place would move `:155`'s `tracks` deep-equal, an unrelated pin. Then
      extend `:169-214` additively: the unreadable `#6` carries `kind`, `tracker`,
      `parent`, `parentSource` all `null` beside `declared: null`, and
      `assert.notDeepEqual(n6, u6)` at `:213` still holds (R967-3 S3).
      **Mutation**: omitting the four fields from the reset turns the unreadable
      case red. `snapshot-cli.test.mjs` is **not touched** (design D6).
      *Measured — the stated mutation does NOT hold, and the test says so.*
      `readForge` substitutes `body: ''` for a body it could not read
      (`snapshot.mjs:208`), so the parse is `null` and all four fields arrive `null`
      before the reset runs. They join `track`, `files` and `sources`, already in
      that same reset and already equally free: the reset is the written guarantee,
      not the mechanism. The assertion is pinned and LABELLED "already green",
      the module's own precedent for exactly this shape.
- [x] A6b. `brain/scripts/status/snapshot.mjs:211-212`: add `kind: null,
      tracker: null, parent: null, parentSource: null` to the unreadable-node
      reset so A6a passes. `declarationDivergences` needs no line — `graph` is
      built with `...g` at `:224`.
- [x] A7. Verify: `GIT_CONFIG_GLOBAL=/dev/null npm test` and
      `npm run brain:repo:check` both green.
- [x] A8. `npm run memory:save -- "the brain-graph block carries kind, tracker and
      parent" "<summary of the three keys, the prose-parent reader, the
      declarationDivergences channel and the snapshot reset landed in this PR>"
      --issue 967 --type architecture`, staged with only the new
      `.memory/records/*.jsonl` file and `.memory/index.jsonl`.

**Boundary — `ui/lib` is not in this PR.** Corrected 2026-09-16 (review of PR A):
this paragraph used to say `canvas-model.mjs` and `drawer-model.mjs` "do not
exist on `main`", and that was FALSE — `git ls-tree -r --name-only origin/main`
and the same over `origin/feature/issue-967` both list the two modules and their
tests. They are untouched because they are INERT, which is a different and
checkable fact: `canvas-model.mjs:58-68` builds its drawn node from an explicit
object literal (`number`, `label`, `className`, `marks`, `track`, `x`, `y`, `w`,
`h`) and never spreads the node, so it projects fields BY NAME and four new keys
on a graph node cannot reach it; `drawer-model.mjs` reads no graph node at all.
Carrying `kind`/`tracker`/`parent` to the canvas is **three added lines in #881
slice 4 / #882**, not here (design D6, risk R7). Naming it so it is a boundary
and not an omission — and naming it with the reason that is true.

**Review round 1 remediation** (2026-09-16, fresh context, before push — REVISE:
two majors, four minors, four editorials). Each item was measured before a line
was written, fixed test-first, and its stated mutation run:

- [x] A11. M2 — a column-zero `Parent:` inside a fenced block was read as a
      declaration. The prose scan now runs over the body with every fenced region
      blanked (the `brain-graph/1` fence and an unterminated fence included),
      derived from `fencedBlocks`'s own report. Commit `7b2c212b`; `spec.md`
      R967-2 amended in the same commit — the code was conformant and the SPEC was
      the defect. Mutation: scan the raw body → exactly its own test red.
- [x] A12. m1 — `Parent: #878, #879` on one line resolved to 878 by writing
      order. The ambiguity rule is now stated over the SET of issue numbers, not
      the count of lines. Commit `3c6a3336`; `spec.md` R967-2 amended. Mutation:
      keep only the first number per line → exactly its own test red.
- [x] A13. m2 — DECIDED: a leading zero is REFUSED as `parent-grammar`, not
      normalised. `parent: 007` became `7` and `Parent: #0` became `0`; the
      grammar is now spelled once and shared by the block key, the prose line and
      the ambiguity rescan. Commit `8c941474`; `spec.md` R967-1 and R967-2 amended.
      Mutation: grammar back to `\d+` with the old `> 0` guard → exactly its two
      tests red.
- [x] A14. M1 — the false absence claim in `apply-progress.md` and the stale
      `#?<digits>` parent grammar in `design.md:141` corrected with dated notes;
      the same false sentence in this file corrected above. m3, m4, the unmasked
      HTML comment, e2 and e4 recorded as follow-ups in `apply-progress.md`.

**Maintainer tasks after PR A merges into the tracker** (forge acts, Tier 2 —
left unticked for the maintainer):

- [ ] A9. Edit #878's body so its `brain-graph/1` block declares `kind: epic` and
      `tracker: feature/brain-ui` (`scratchpad/issue-878.md:62-67` currently
      declares neither). This is what activates every field PR A added.
- [ ] A10. #881: **no edit** — its line-initial `Parent: #878 …` already resolves
      with `parentSource: 'prose'`. Confirm with `npm run brain:snapshot -- --json`
      that `#878` shows `kind: epic` + its tracker and `#881` shows `parent: 878`.

**Done when**: an epic declaring the three keys parses into the node and the
snapshot, a body declaring none of them parses exactly as today across all seven
deep-equals, every malformed value is said rather than guessed, and an unreadable
node carries none of the four fields.

---

## PR B — the verb resolves the base

```brain-slice-scope/1
{"slice": 2, "claims": ["R967-5", "R967-6", "R967-9"], "files": ["brain/scripts/lib/ticket-base.mjs", "brain/scripts/lib/ticket-base.test.mjs", "brain/scripts/lib/ticket-args.mjs", "brain/scripts/lib/ticket-args.test.mjs", "brain/scripts/ticket-start.mjs", "brain/scripts/i18n/en.mjs", "brain/scripts/i18n/es.mjs"], "terminal_pr": "feature/issue-967 -> main"}
```

Base: PR A's branch while A is open, retargeted to `feature/issue-967` once A
merges. Depends on A: `resolveBase` reads `parseGraphBlock`'s new `parent`,
`kind` and `tracker`. Estimated **155–185 counted source lines, ≈360 review
lines**. Closes R967-5, R967-6, R967-9's resolver half.

- [x] B1a. `brain/scripts/lib/ticket-args.test.mjs`: three added tests —
      `parseTicketArgs(['881'])` returns `baseExplicit: false` and
      `parseTicketArgs(['881','--base','main'])` returns `baseExplicit: true`,
      both still `baseBranch: 'main'` (R967-6 S1); `--off-tracker` sets
      `offTracker: true`; the id rule at `:66` still picks `881` with the flag
      present. The four existing reads at `:24`, `:56`, `:71`, `:80` stay
      untouched and green. **Mutation**: returning `baseBranch: null` when absent
      turns those four existing assertions red — the measured reason the flag
      exists (design Q1).
- [x] B1b. `brain/scripts/lib/ticket-args.mjs`: add
      `export const OFF_TRACKER_FLAG = '--off-tracker'`,
      `baseExplicit: baseIdx >= 0` and `offTracker: args.includes(OFF_TRACKER_FLAG)`,
      keeping `baseBranch`'s `'main'` default at `:60-61`, so B1a passes.
- [ ] B2a. `brain/scripts/lib/ticket-base.test.mjs` (new): failing tests for the
      six rows of design D7 with an injected `fetchIssue` and no repository —
      row 1 tracker resolved, `say.key = 'ticket.base.fromEpic'` naming the epic
      and the source (R967-5 S1); row 2 the three no-tracker reasons, each with
      its own stated reason, never a silent `main` (R967-5 S3); row 3 a **throwing**
      `fetchIssue` → `ok: true`, base `main`, `ticket.base.epicUnreadable`, no
      refusal (R967-5 S4); row 4 `--base main` against a declared tracker →
      `{ok: false, refusal: {key: 'ticket.error.baseIsTracked'}}` naming the
      tracker and `--off-tracker` (R967-6 S2); row 5 `--off-tracker` honoured and
      said (R967-6 S3), and harmless when there is nothing to override
      (R967-6 S5); row 6 `--base feature/other` returns it with **`fetchIssue`
      never called** (R967-6 S4). Plus one-hop (R967-5 S2): the grandparent is
      never fetched — at most two calls, the grandparent's number in none of them.
      Plus R967-9 S2: no title is matched anywhere in the leaf. **Mutation**:
      making row 3 refuse turns the fail-open test red; walking a second hop turns
      the one-hop test red; calling the port on row 6 turns its call-count
      assertion red.
- [ ] B2b. `brain/scripts/lib/ticket-base.mjs` (new): implement
      `resolveBase({issue, args, fetchIssue, defaultBranch = 'main'})` — pure,
      returning `{ok, base, say: {key, params}}` or
      `{ok: false, refusal: {key, params}}`, **never** a rendered message and
      never `t()`; no `_now`. So B2a passes.
- [ ] B3. `brain/scripts/i18n/en.mjs` (after `:289`) and `es.mjs`: add
      `ticket.base.fromEpic`, `.noEpic`, `.epicUnreadable`, `.offTracker` and
      `ticket.error.baseIsTracked`, and add the `--off-tracker` spelling to
      `ticket.error.usage` (`en.mjs:262`). The failing test already exists:
      `i18n/coverage.test.mjs:96-98` goes red the moment `en.mjs` gains a key
      without its `es` twin (R967-6 S6) — add the `en` keys first, watch it go
      red, then the `es` twins. No new doctrine-oracle test:
      `harness-contract.md:28` already carries the rule (design D8, proposal R4).
- [ ] B4. `brain/scripts/ticket-start.mjs`: call `resolveBase` between the
      `issueView` at `:93` and the `ticket.updatingBase` line at `:132`, building
      the `fetchIssue` closure from the `vcs`/`project` already in scope; print
      `await t(say.key, say.params)`; on a refusal print `t(refusal.key, params)`
      and `process.exit(1)` before any git work. ≈20 added lines, no new port verb.
- [ ] B5. Manual verification (no `ticket-start.test.mjs` exists and the design
      deliberately did not create one — the verb is a thin caller; "N/A with
      reason" per the work-unit-commits checklist). After A9 has landed on the
      forge: `node brain/scripts/ticket-start.mjs -- 881 --base main` refuses,
      names `feature/brain-ui` and `--off-tracker`, exits 1, and
      `git worktree list` and `git branch` are unchanged; the same command with
      `--off-tracker` says it went off tracker. Record the exact commands and
      output in apply-progress.
- [ ] B6. Verify: `GIT_CONFIG_GLOBAL=/dev/null npm test` and
      `npm run brain:repo:check` both green.
- [ ] B7. `npm run memory:save -- "brain:ticket:start resolves its base from the
      epic's declared tracker" "<summary of baseExplicit, the resolveBase leaf,
      the fail-open rule, --off-tracker and the six new i18n pairs landed in this
      PR>" --issue 967 --type decision`, staged with only the new
      `.memory/records/*.jsonl` file and `.memory/index.jsonl`.

**Done when**: a slice of an epic that declares a tracker starts off that tracker
and the verb says who declared it; an explicit `--base main` refuses and names
the tracker; an unreadable epic resolves to `main` with its reason and never
refuses; every string exists in both locales.

---

## PR C — the gate

```brain-slice-scope/1
{"slice": 3, "claims": ["R967-7", "R967-8", "R967-9", "R967-10"], "files": ["brain/scripts/governance/checks/base-branch.mjs", "brain/scripts/governance/checks/base-branch.test.mjs", "brain/scripts/governance/run-check.mjs", "brain/scripts/governance/run-check.test.mjs", "brain/scripts/vcs/governance-checks.mjs", "brain/scripts/vcs/governance-tiers.mjs", ".github/workflows/governance.yml", "brain/scripts/ci/gitlab-governance.yml", "openspec/changes/issue-967-tracker-as-data/brain-drafts/"], "terminal_pr": "feature/issue-967 -> main"}
```

Base: PR B's branch while B is open, retargeted to `feature/issue-967` once B
merges. Estimated **150–175 counted source lines, ≈370 review lines**. Closes
R967-7, R967-8, and R967-9/R967-10's absence scenarios over the complete diff.

- [ ] C1a. `brain/scripts/governance/checks/base-branch.test.mjs` (new): failing
      tests for the **pure predicate alone** —
      `baseBranchRule({targetBranch, defaultBranch, sourceBranch, linkedIssue,
      parentIssue})`: a declared tracker with base `main` fails and the reason
      names the tracker and the epic (R967-7 S1); base equal to the tracker passes
      with no warning (R967-7 S2); a `feature/…` head targeting another
      `feature/…` fails, stating a tracker PR targets the default branch
      (R967-7 S3); no linked issue, no parent, a parent that is not `kind: epic`,
      and an epic with no tracker each pass untouched (R967-7 S4); a malformed
      tracker fails naming the epic and the bad value. **Mutation** (R967-7 S9,
      the revert proof): reverting `base-branch.mjs` alone turns exactly this file
      red — assert no other module imports it.
- [ ] C1b. `brain/scripts/governance/checks/base-branch.mjs` (new, ~45 lines,
      pure, `issue-link.mjs`'s shape, no IO) so C1a passes.
- [ ] C2a. `brain/scripts/governance/run-check.test.mjs`: failing tests for
      `runBaseBranchCheck(ctx, deps)` over design D10's eight steps with an
      injected `fetchIssue` — (1) non-string `ctx.body` → `uncomputable`; (2)
      `requiresClosingKeyword(ctx) === null` → **fail closed**; (3) a `feature/`
      head is checked with no port call; (4) no issue reference → pass untouched,
      the memory-lane standing case (R967-7 S4); (5)/(7) a throwing `fetchIssue`
      → fail closed and `uncomputable`, never a silent pass (R967-7 S5); (6) the
      linked issue itself `kind: epic` → pass; (8) base ≠ tracker → fail naming
      tracker, epic and actual base. Plus the fan-out pin: zero `issueList` calls
      and at most two `issueView` calls (R967-7 S6). Plus `mapDetectionToWarning`
      at tier `lite` does **not** soften this gate's `pass: false` (ruling 1).
      **Mutation**: setting the `lite` row to `detection` turns the last assertion
      red; returning a pass on step 5 turns the deny-reader test red (#942).
- [ ] C2b. `brain/scripts/governance/run-check.mjs`: add `runBaseBranchCheck`
      reusing the module-private `defaultFetchIssue` (`:197-207`),
      `extractIssueNumber` (`:235-247`) and `requiresClosingKeyword`
      (`:359-369`'s reason shape) in place — nothing exported, the file stays
      "entry point, never a library" (`detection-policy.mjs:5-15`). So C2a passes.
- [ ] C3a. Register site 1 only — append `'base-branch'` after `'lane-scrub'` in
      `brain/scripts/vcs/governance-checks.mjs:41-54` — and run the suite. RED via
      four **pre-existing** oracles: `governance-checks.test.mjs`'s YAML-order
      guard, `governance-tiers.test.mjs`'s REQ-TIER-8 key-set parity (both
      directions), `run-check.test.mjs`'s T7 manifest parity (both directions),
      and `workflow-auth.mjs:566-567`'s VCS_TOKEN rule. This partial state is the
      failing test for C3b (R967-7 S8).
- [ ] C3b. Land the remaining four registration sites in the same commit:
      (2) the `GATE_MATRIX` row after `lane-scrub` at
      `brain/scripts/vcs/governance-tiers.mjs:225-234`, `required` at **every**
      tier including `lite` with `evidence: 'declared-tracker'` (ruling 1);
      (3) `.github/workflows/governance.yml` — a job block **last**, shaped like
      `issue-link:` (`:46-75`) **minus** `fetch-depth: 0`, `env:` = `VCS_TOKEN:
      ${{ github.token }}`, `PR_NUMBER`, `PR_BODY`, `BASE_BRANCH`,
      `DEFAULT_BRANCH` and **no** `BASE_SHA`/`HEAD_SHA` (the check runs no git);
      (4) `brain/scripts/ci/gitlab-governance.yml` — the mirror stanza shaped like
      `:122-126`; (5) `run-check.mjs:483-488` `'base-branch': true` in
      `SUBCOMMAND_PORT_REACH` plus the dispatch branch at `:542-547`. All four
      guards go green.
- [ ] C4. Drift-guard check with no weakening allowed:
      `brain/scripts/governance/local-ci-parity.test.mjs` feeds one fixture to
      both `brain-check.mjs` and `run-check.mjs` for the checks `brain:check`
      runs. `base-branch` is CI-only and has no local counterpart. If that suite
      turns red, the honest fix is a fixture row or a local implementation —
      **never** a relaxed assertion (its rule is one-sided: local may never pass
      where CI fails). If a local implementation is needed, stop and report: it is
      a scope question, not an apply decision.
- [ ] C5. `openspec/changes/issue-967-tracker-as-data/brain-drafts/` — two draft
      files for the maintainer, nothing under `brain/core/**` or `brain/project/**`
      (R967-8 S1):
      `lite-required-base-branch.md` (target
      `brain/core/methodology/workflow-governance.md`) carrying design D12's
      required-at-`lite` sentence **and** the ratified tracker-PR timing sentence
      ("opened when it has a diff; `stranded.mjs` reports it until then"); and
      `graph-block-kind-tracker-parent.md` (target
      `brain/project/decisions/adr-0032-graph-block-declared-by-its-tag.md`,
      an amendment) carrying D12's `kind`/`tracker`/`parent` sentence. No test
      asserts a doctrine line the maintainer has not signed (R967-8 S4).
      *Delivery note*: proposal.md put the block-keys draft in PR A; both land
      here. Drafts are uncounted (`openspec/changes/**` ignored), so the move
      costs no review budget in either slice.
- [ ] C6. Absence guards over the complete diff — `git diff` shows no path under
      `brain/core/**` or `brain/project/**` (R967-8 S1); `brain-ship.mjs:259`,
      `memory/lane/ship.mjs:206` and `status/stranded.mjs` are byte-identical
      (R967-10); no sub-issues endpoint and no new port verb (R967-10); no title
      pattern is matched in the parser, the leaf or the gate (R967-9 S2).
- [ ] C7. Verify: `GIT_CONFIG_GLOBAL=/dev/null npm test` and
      `npm run brain:repo:check` both green.
- [ ] C8. `npm run memory:save -- "base-branch is a required gate at lite and
      refuses a slice PR against main" "<summary of the pure rule, the
      run-check wrapper, the five registration sites, the fail-closed reader rule
      and the two doctrine drafts landed in this PR>" --issue 967 --type
      architecture`, staged with only the new `.memory/records/*.jsonl` file and
      `.memory/index.jsonl`.
- [ ] C9. **Maintainer, after the tracker merges into `main`** (Tier 2,
      AGENTS.md:145-147 — left unticked): an admin re-runs
      `npm run brain:protect`. A new REQUIRED context is not enforced until then
      (`governance-checks.mjs:127-129`); between merge and that run the gate
      reports and cannot block, and PR B's refusal is the only control (risk R2).

**Done when**: a slice PR against `main` fails `base-branch` by name at tier
`lite`, a lane PR and an issue with no epic pass untouched, the gate makes at
most two per-issue reads and no listing call, every drift guard is green, and
reverting the rule alone turns exactly `base-branch.test.mjs` red.

---

## Tracker PR — `feature/issue-967` → `main`

- [ ] TR1. Open once PR A has merged into `feature/issue-967` and the branch has a
      diff (GitHub cannot open an empty PR). Until then `stranded.mjs` reports the
      tracker — this change's own ratified answer to the tracker-PR-timing
      question.
- [ ] TR2. Body carries `Closes #967`, the chain diagram (A → B → C → tracker),
      and a written `size:exception` naming the review total (≈1020 lines) and why
      it cannot shrink: the union of three cohesive slices, each already under the
      400-line budget.
- [ ] TR3. Keep it draft/no-merge until A, B and C have all landed on the tracker.
      Merge last; it is the only PR in this chain targeting `main`.

---

## Review Workload Forecast

Estimated changed lines: ~1020 review lines total (PR A ≈290, PR B ≈360, PR C ≈370); 370–445 counted source lines (tests and `openspec/changes/**` excluded per `brain.config.json:18-29`)
400-line budget risk: High (two budgets, both stated: the reviewer budget is 400 changed lines per PR — each slice fits at ≈290/≈360/≈370 but B and C sit within 40 lines of it, and the tracker PR to `main` at ≈1020 exceeds it and ships under a written `size:exception`; this repo's governance budget is tier `lite` = 1000 counted source lines per PR (`brain.config.json:17`, AGENTS.md:447), which every slice and the tracker's 370–445 counted lines clear)
Chained PRs recommended: Yes
Decision needed before apply: No

| Field | Value |
|-------|-------|
| Delivery strategy | ask-on-risk, resolved by the standing rule |
| Chain strategy | feature-branch-chain on `feature/issue-967` |
| Suggested split | PR A (data) → PR B (verb) → PR C (gate) → tracker → `main` |
| Size exception | tracker PR only, written in TR2 |

### Suggested work units

| Unit | Goal | PR | Base boundary |
|------|------|----|---------------|
| 1 | The block and the snapshot carry `kind`, `tracker`, `parent`, `parentSource` | A | `feature/issue-967` |
| 2 | `brain:ticket:start` resolves and refuses from that data | B | A's branch → tracker as A merges |
| 3 | `base-branch` refuses a slice PR against `main`, required at `lite` | C | B's branch → tracker as B merges |
| 4 | The union reaches `main` | tracker | `main`, `size:exception` |

If a child PR's diff shows a previous slice, the base is wrong: retarget or
rebase until only that slice appears.

## Out of scope

Restated from spec.md R967-10 — no task above builds any of the following:

- **GitHub sub-issues**: no sub-issues endpoint, no new port verb, no change to
  `vcs-contract.md`'s verb table (`github.mjs:183-187`, ADR-0029 D2).
- **A `needs`-edge parent fallback**: `needs: [879]` never guesses a parent —
  measured, it resolves to a sibling (design D3).
- **`brain/scripts/brain-ship.mjs:259`'s PR-open base**: unchanged; PR C's gate
  catches its output at PR time, and a follow-up ticket owns the verb-side fix
  (risk R6).
- **`brain/scripts/memory/lane/ship.mjs:206`'s `base: 'main'`**: unchanged and
  correct — a lane PR has no epic; it is the standing "passes untouched" case.
- **`brain/scripts/status/stranded.mjs`**: byte-identical, `feature/` prefix
  oracle included.
- **Anything inferred from a title prefix**: `epic(…)` stays decorative
  (R967-9).
- **UI grouping and drift marks**: `canvas-model.mjs`/`drawer-model.mjs` are three
  lines in #881 slice 4 / #882, not here.
- **Any commit under `brain/core/**` or `brain/project/**`**: doctrine ships as
  drafts under the change directory.
