---
status: tasked
issue: 805
---

# Tasks: #805 — a writer for `supersedes`

Implements `spec.md` under `design.md`'s A1–A8, ruling `sdd/issue-805-supersedes-writer/ruling`
(D1–D7, 2026-09-10). Parent: #864 task 2.1, ADR-0034 L2 (`:84-86`). Delivery: `ask-on-risk`,
resolved by the ~106 counted-line forecast — **single PR**, `Closes #805`, `Parent: #864` in
prose, label `type:bug`.

STRICT TDD MODE IS ACTIVE. Test runner: `npm test` (node:test). Every implementation task below is
preceded by its failing test task, naming the file and case titles from `spec.md`/`design.md`. Run
the focused `node --test` command after each RED/GREEN pair; run the full `npm test` before each
commit.

## 0. Live measurements apply performs first (read before implementing — no code in this section)

Neither `sdd-design` nor `sdd-tasks` had Bash available. Before Unit 1 begins, apply MUST measure
each of design.md's six items, record the result in `apply-progress`, and adjust tasks below if
reality disagrees:

- [x] 0.1 The refusal shape end to end: `MEMORY_BACKEND=plainfiles node brain/scripts/memory/cli.mjs
  save t c --type discovery --issue abc` under `BRAIN_MEMORY_TEST_ROOT` — capture the exact
  stderr line (`memory/cli: plainfiles.save() failed — <message>`) and exit code 1; the
  `--supersedes` refusals must be byte-identical in shape (A7). **Confirmed**: byte-identical.
- [x] 0.2 `upstreamRecordEntries({root})` on a non-git temp dir — confirm `ok:false` and the exact
  `reason` string ("no upstream ref resolved (tried origin/HEAD, origin/main)"); A8's CLI test
  asserts this text. **Confirmed**, verbatim.
- [x] 0.3 `SUPERSEDES_ID_RE` against a freshly built record — run `buildRecord(...).id` in a scratch
  script before the regex is written; the producer is the oracle (A2). **Confirmed**: matches.
- [x] 0.4 The `amend-find` anchor occurs exactly once in `memory-backend-contract.md:94-95` —
  `planAmendment({draftText, targetText, homeText:null, gitUserName:'x', today:'<iso>'})` ⇒
  `ok:true`, every act `pending`. Read-only. **Confirmed**: `ok:true`, `pending`, `f:1 r:0`.
- [x] 0.5 The real counted diff via `npm run brain:governance-status` / `run-check.mjs diff-size`
  before opening the PR, against the ~106 forecast. Record the REAL number in the PR's wrap-up
  note. **Measured: 133 lines** (via `parseDiffNumstat` against `brain.config.json`'s
  `governance.ignoreList`) — still Low risk, single PR.
- [x] 0.6 `npm test` green, with `i18n/coverage.test.mjs` and `capture-reachable.test.mjs` named
  explicitly — they are the two a catalog edit breaks first. **Baseline 5139/5139**; final
  **5173/5173**, both tripwire files green throughout.

---

## Unit 1 — `lib/supersedes.mjs`: the pure classifier (spec "a supersedes id is checked against the store"; design A1–A3)

- [x] 1.1 RED: `brain/scripts/memory/lib/supersedes.test.mjs` (new) —
  - malformed (`rec-XYZ`, `rec-<15 hex>`, uppercase hex, `''`, non-string) ⇒
    `{ok:false, reason:'malformed', detail:{value}}`, upstream thunk **never called**
  - local hit (`id` in `localIds`) ⇒ `{ok:true, source:'local'}`, thunk **0 calls** (spy)
  - local miss + `upstream()` returns `{ok:true, byId}` and `byId.has(id)` ⇒
    `{ok:true, source:'upstream'}`
  - local miss + `upstream()` returns `{ok:true, byId}` miss ⇒
    `{ok:false, reason:'not-in-store', detail:{id, ref}}`
  - local miss + `upstream()` returns `{ok:false, reason}` ⇒
    `{ok:false, reason:'could-not-verify', detail:{id, reason}}` — `reason` copied **verbatim**,
    never mapped to `not-in-store`
  - `configError` present on either arm ⇒ carried through on the result unchanged
  - thunk called **at most once** across every branch
  - producer-oracle pin: `buildRecord(...).id` (from `format.mjs`) matches `SUPERSEDES_ID_RE`
  Focused: `node --test brain/scripts/memory/lib/supersedes.test.mjs` — RED (module absent).
- [x] 1.2 GREEN: `brain/scripts/memory/lib/supersedes.mjs` (new) —
  `SUPERSEDES_ID_RE = /^rec-[0-9a-f]{16}$/`; `classifySupersedes({id, localIds, upstream})` per
  the interface in `design.md` (pure, no `fs`/`child_process`, ADR-0016).
  Focused: same command — GREEN. `npm test` — green (nothing imports the module yet).

Commit: `feat(memory): add classifySupersedes, the pure supersedes-id classifier (#805)`.

## Unit 2 — `lib/format.mjs`: pin, do not modify (spec "the flag reaches the record"; design "File changes" — format.mjs UNCHANGED)

- [x] 2.1 RED→pin: extend `brain/scripts/memory/lib/format.test.mjs` — `buildRecord` called with
  `supersedes` set yields a **different `id`** than the same content without it (extends the
  existing hashInput assertion); `validateRecord` accepts a record carrying `supersedes`; the R3
  omission rule is unchanged when `supersedes` is absent. These assertions may already pass —
  this is a RED-as-absent, GREEN-without-a-production-edit pin (same treatment as
  `archive/889` A3.1).
  Focused: `node --test brain/scripts/memory/lib/format.test.mjs` — GREEN, no `format.mjs` edit.

No standalone commit — folds into Unit 3's commit (the gate needs a real id to classify against).

## Unit 3 — `backends/plainfiles.mjs`: the gate and the two seams (spec "no partial write"; design A1, A4, A7)

- [x] 3.1 RED: extend `brain/scripts/memory/backends/plainfiles.save.test.mjs` —
  - `{supersedes}` in `opts` reaches `buildRecord` — the written record carries the field
  - a refusal (any of the three reasons) rejects with `_appendRecord`/`_rebuildIndex` at **0
    calls**, no `records/` dir created (mirrors the file's existing secret-hit assertion shape)
  - `supersedes` absent ⇒ **neither** new seam (`_readRecordIds`, `_upstreamRecordEntries`)
    called — the whole gate short-circuits
  - a local hit ⇒ `_upstreamRecordEntries` **not** called (thunk discipline, A1)
  - the thrown error carries **no `indexFailed`** (A7)
  Focused: `node --test brain/scripts/memory/backends/plainfiles.save.test.mjs` — RED.
- [x] 3.2 GREEN: `brain/scripts/memory/backends/plainfiles.mjs` — `supersedes` into the opts
  destructure (`:76`); `_readRecordIds = readRecordIds`, `_upstreamRecordEntries =
  upstreamRecordEntries` as new seam defaults; the gate between the `issue` refusal (`:122`) and
  `buildRecord` (`:124`): `if (supersedes !== undefined)` → `_readRecordIds({recordsDir})` →
  `classifySupersedes({id: supersedes, localIds, upstream: () =>
  _upstreamRecordEntries({root})})` → on `ok:false`, `throw new Error(await t(key, detail))` per
  the three-key map (A3); `configError` present ⇒ `console.warn`, never throws. Hoist
  `recordsDir`'s `join` up from `:136` to the gate (do not duplicate it). `buildRecord({…,
  supersedes})` at `:124`.
  Focused: same command — GREEN. `npm test` — green.

Commit: `feat(memory): refuse an unverifiable supersedes id before any write (#805)`.

## Unit 4 — `cli.mjs` + `engram.mjs` message + i18n (spec "backend-agnostic flag", "engram names the flag"; design A5, A6)

- [x] 4.1 RED: extend `brain/scripts/memory/cli.save-search.test.mjs` —
  - `--supersedes <local id>` writes the field, exit 0
  - `--supersedes` given twice ⇒ exit 1, message names fan-in as deferred
    (`memory.save.supersedesRepeated`)
  - `--supersedes` as the final argument (no value) ⇒ exit 1, **no record written**
    (`memory.save.supersedesMissingValue`)
  - an unknown id under the non-git `BRAIN_MEMORY_TEST_ROOT` ⇒ exit 1, the `could-not-verify`
    reason quoted verbatim (A8 — never `not-in-store` here)
  Focused: `node --test brain/scripts/memory/cli.save-search.test.mjs` — RED.
- [x] 4.2 RED: extend `brain/scripts/memory/backends/engram.save-search-unsupported.test.mjs` —
  the `unsupportedOp` message for `save` names `--supersedes` explicitly.
  Focused: `node --test brain/scripts/memory/backends/engram.save-search-unsupported.test.mjs` —
  RED.
- [x] 4.3 RED→pin: confirm `brain/scripts/i18n/coverage.test.mjs` and
  `brain/scripts/memory/capture-reachable.test.mjs` (`:55-59`, three-substring guard:
  `/plainfiles/`, `/memory:save/`, `/--type/` in both locales) — both currently green, note as
  the two tripwires a catalog edit breaks first (RED the moment 4.5 edits the shared clause
  carelessly, GREEN once 4.5 lands correctly).
- [x] 4.4 GREEN: `brain/scripts/memory/cli.mjs` (`:771-791`) — two arity guards around the
  existing `flags[arg.slice(2)] = rest[++i]` parser for `--supersedes`: a repeated flag refuses
  before any write (`supersedesRepeated`); a value-less flag refuses (`supersedesMissingValue`);
  `opts.supersedes` forwarded unparsed to every backend.
  Focused: `node --test brain/scripts/memory/cli.save-search.test.mjs` — GREEN.
- [x] 4.5 GREEN: `brain/scripts/i18n/en.mjs`, `es.mjs` — add
  `memory.plainfiles.save.{supersedesMalformed,supersedesNotInStore,supersedesUnverifiable,
  supersedesConfigError}`, `memory.save.{supersedesRepeated,supersedesMissingValue}` (6 keys,
  both locales); append one clause naming `--supersedes` to `memory.save.engramUnsupported`
  (`en.mjs:418`, `es.mjs:375`) — append only, do not restructure.
  Focused: `node --test brain/scripts/memory/backends/engram.save-search-unsupported.test.mjs
  brain/scripts/i18n/coverage.test.mjs brain/scripts/memory/capture-reachable.test.mjs` — GREEN.
  `npm test` — green.

Commit: `feat(memory): enforce a single --supersedes id in the CLI and name it in engram's refusal (#805)`.

## Unit 5 — integration: a real bare `origin` (spec "an upstream-only id is accepted", "not in the store", "could not verify", "the epic's 6.1 exit scenario"; design A8)

- [x] 5.1 RED: `brain/scripts/memory/lib/supersedes.integration.test.mjs` (new) — reuse
  `upstream-records.integration.test.mjs:36-75`'s bare-origin + trunk + worktree fixture:
  - an id present **only** at `origin/main` after `git fetch` ⇒ accepted, record written
  - an id in neither local nor upstream ⇒ **`not-in-store`**, no file appended
  - the clone with `origin` removed ⇒ `could-not-verify`, naming the degradation
  - a second record superseding an already-superseded record (chain) ⇒ accepted, both prior
    records stay readable and indexed
  - the epic's 6.1 scenario: record A saved plain, record B saved with `--supersedes <A>`, then
    `npm run memory:audit` ⇒ `coverage.supersedes` reports `1`, up from `0`; B's
    `**Supersede:**` line survives a `memory:reindex` round trip
  Focused: `node --test brain/scripts/memory/lib/supersedes.integration.test.mjs` — RED.
- [x] 5.2 GREEN: no new production code expected — Units 1/3/4 already implement the behaviour
  this test exercises end to end; if RED persists after those units are green, the fix belongs
  in whichever of `supersedes.mjs`/`plainfiles.mjs` the failure isolates to, not a new module.
  Focused: same command plus `node --test brain/scripts/memory/lib/audit.test.mjs` (confirm the
  existing pure cases at `:89-96,136-156` stay unchanged, D5) — GREEN. `npm test` — full suite
  green.

Commit: `test(memory): integration-cover supersedes against a real bare origin, chains, and audit coverage (#805)`.

## Unit 6 — the doctrine draft (spec "the record-first correction sequence is drafted for promotion, not enforced in code"; design D6)

- [x] 6.1 Create
  `openspec/changes/issue-805-supersedes-writer/brain-drafts/memory-backend-contract.draft.md`
  — non-ADR `brain-amendment/1` contract, exactly:
  ```
  target: brain/core/methodology/memory-backend-contract.md
  issue: 805
  ```
  one `amend-find`/`amend-replace` pair anchored on the whole two-line sentence closing the
  Deletion section (`memory-backend-contract.md:94-95`); the replacement keeps those two lines
  verbatim and appends the four-step record-first correction sequence (save with `--supersedes`
  → lane ships it → stale record untouched → `memory:reindex`).
- [x] 6.2 Verify, read-only, no test file: call `planAmendment({draftText, targetText,
  homeText:null, gitUserName:'x', today:'<iso>'})` directly against the draft above (same call as
  measurement 0.4) — `ok:true`, every act `pending`. Record the transcript in `apply-progress`.
  This file is excluded from the counted diff (`openspec/changes/**`) and from `npm test` — no
  node:test file covers it.

Commit: `docs(brain-drafts): draft the record-first correction sequence for #805 promotion`.

---

## Wrap-up

- [x] W1 `npm test` full run, green, recorded with before/after counts. Baseline 5139/5139 →
  5173/5173 after Units 1-6 → 5176/5176 after the fresh-context review corrections (3b018a50) →
  5177/5177 at the final applied head (2dbc0197, the cold-review blocker fix). Re-verified at
  archive time against the merged tree (c410259e, PR #912 + later unrelated work): 5194/5194,
  0 fail. Focused files also green: `node --test brain/scripts/memory/lib/supersedes.test.mjs
  brain/scripts/memory/lib/supersedes.integration.test.mjs
  brain/scripts/memory/backends/plainfiles.save.test.mjs
  brain/scripts/memory/cli.save-search.test.mjs brain/scripts/memory/lib/format.test.mjs` —
  88/88. `node brain/scripts/check-refs.mjs` — green.
- [x] W2 `memory:save --issue 805` — record-first, committed before the first push. Record
  `rec-7723969eb495debe` written and committed first; a fresh cold review then measured its
  "eight i18n keys" claim wrong (six new + one edited per locale), so a CORRECTION record
  `rec-3afb00eb127d31a6` was written with `memory:save --supersedes rec-7723969eb495debe` — the
  writer's first real use of the flag it built — and committed. A staging mistake (a hydrated
  stray record plus 119 index lines) was reverted in c58ccb16 so the merged branch carries
  exactly the two records above and their two `.memory/index.jsonl` lines (confirmed via
  `git diff --stat 51ff915f 376d6a31 -- .memory/`: 2 records + `index.jsonl \| 2 ++`). The
  correction record's `supersedes` field points at `rec-7723969eb495debe`, verbatim.
- [x] W3 (ticked on the archive branch, PR #912 named) Tick epic task 2.1 in `openspec/changes/issue-864-memory-2-0/tasks.md` (`:30`),
  referencing this PR's number once known. **NOT DONE** — verify-time inspection of the merged
  tree (`git log -p --all -S"2.1 #805" -- openspec/changes/issue-864-memory-2-0/tasks.md`) shows
  the line has never been ticked in any commit reachable from `main`; it still reads `- [ ] 2.1
  #805 — a writer for \`supersedes\`...`. This is out of this executor's write scope (restricted
  to this change's `tasks.md`/`verify-report.md`) — flagged as a WARNING finding below for the
  orchestrator/maintainer to close as a small follow-up edit.
- [x] W4 Fresh-context review before the PR: adversarial pass over the refusal shape (A7), the
  thunk-discipline pin (A1), and the CLI arity guards (A5) — the three places a careless commit
  most likely regresses. Verdict APPROVE, nine mutants killed (upstream-before-local,
  allow-on-refusal, loosened grammar, gate-after-append, dropped arity guards, `supersedes`
  dropped from `buildRecord`, remapped reason, catalog clause removed, plus the `=`-form gap);
  its corrections landed in commit 3b018a50 (`--supersedes=<id>` refused; the config-error warn
  branch tested; the mismatched-issue rule tested).
- [x] W5 Open the PR: `Closes #805`, `Parent: #864` in prose, label `type:bug`. PR #912, merged
  as `376d6a31` on 2026-09-10. Confirmed via `gh pr view 912`: state MERGED, body opens "Closes
  #805", names "Parent: #864 (memory 2.0), task 2.1" in prose, label `type:bug` present (plus a
  `needs-decision` label carrying the two open maintainer questions — see Handover in
  `verify-report.md`). Body includes the Summary, Changes table, Test plan (every `node --test`
  command plus full `npm test`, `i18n/coverage.test.mjs` and `capture-reachable.test.mjs` named),
  the reconciliation note, D2's fail-closed-on-shallow-clone note, the deferred-reader note, the
  promotion-sitting-as-follow-up note, the auto-merge-unblock note, and the contributor
  checklist.
- [x] W6 `brain:review` on the PR — post the verdict; land any corrections before merge. Round 1
  at `e0d75682`: verdict REVISE (blocker: a malformed `--supersedes` id read the local store
  before the grammar check ran; fixed in `2dbc0197` by making `localIds` a thunk consulted only
  after `classifySupersedes` validates the id shape; editorial: the session record's i18n-key
  count corrected via the `--supersedes` correction record). Round 2 at `c58ccb16`: verdict
  APPROVE, `findings: []`, `conditions: []`. Both reviews confirmed posted as PR review comments
  via `gh pr view 912 --json reviews` (author `csrinaldibot`, `head_sha` matching each round).

**Maintainer acts, after this PR merges — not in any diff, no code task:**
1. Sit the Unit 6 draft: `npm run brain:promote` against
   `openspec/changes/issue-805-supersedes-writer/brain-drafts/memory-backend-contract.draft.md`.
2. Auto-merge enablement is now unblocked (ADR-0034 L2; #889 D7.2 named #805 as its
   prerequisite) — this PR does not enable `allow_auto_merge` or run D7.2 itself; both remain
   separate maintainer/orchestrator acts.

## Non-goals

No `engram.save` writer (#874 owns record-first for engram). No index, hash, or format change —
`format.mjs`, `store.mjs`, `upstream-records.mjs`, `audit.mjs` stay unchanged. No reader-side
chain resolution or "hide the superseded" behavior (#874/#880). No fan-in (`supersedes` stays a
string, D1/D3). No lane, tier, or auto-merge enablement work — naming the unblock in the PR body
is not doing it. No fix to `--issue`'s identical missing-value hole (`cli.mjs:790`) — a different
flag's bug, out of scope.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~106 counted (excl. tests/openspec per `brain.config.json`); ~450–520 reviewer-visible with tests |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not needed — single PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Breakdown (design.md "Changed-line forecast"): `lib/supersedes.mjs` ~50, `backends/plainfiles.mjs`
~28, `cli.mjs` ~14, `i18n/en.mjs`+`es.mjs` ~14, `brain-drafts/` draft 0 (excluded). Measurement 0.5
MUST record the real counted diff before the PR opens; the ~106 forecast is the design's input,
not a promise.
