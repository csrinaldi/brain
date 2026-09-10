---
change: issue-805-supersedes-writer
status: PASS WITH WARNINGS
verified_at: 2026-09-10T23:15:00Z
head: c410259e6a44de06eab6f9e124e9f2249428038f
---

# Verification Report — #805 a writer for `supersedes`

**Mode**: Strict TDD. PR #912 (`Closes #805`, `Parent: #864` in prose, label `type:bug`), merged
`376d6a31` on 2026-09-10. Spec `sdd/issue-805-supersedes-writer/spec` and tasks
`sdd/issue-805-supersedes-writer/tasks` confirmed against the merged tree at head `c410259e`
(PR #912 plus one later, unrelated PR #913).

## Completeness

| Metric | Value |
|---|---|
| tasks.md checkbox items (0.1–0.6, Units 1–6, W1–W6) | all `[x]` except **W3** |
| Unchecked items remaining | 1 — `W3` (tick epic task 2.1 in `issue-864-memory-2-0/tasks.md`), confirmed never applied on any commit reachable from `main` |
| Uncommitted local edit | `tasks.md` W1/W2/W4/W5/W6 ticks written this pass with the evidence below; `verify-report.md` (this file) |

## Build & Tests Execution

**Focused** (`node --test brain/scripts/memory/lib/supersedes.test.mjs
brain/scripts/memory/lib/supersedes.integration.test.mjs
brain/scripts/memory/backends/plainfiles.save.test.mjs
brain/scripts/memory/cli.save-search.test.mjs brain/scripts/memory/lib/format.test.mjs`):
`88 pass / 0 fail`.

**Full suite** (`npm test`): `5194 pass / 0 fail / 0 todo`, duration ~30.6s. (Task-time counts:
baseline 5139/5139 → 5173/5173 after Units 1–6 → 5176/5176 after the fresh-review corrections
(`3b018a50`) → 5177/5177 at the final applied head (`2dbc0197`, the cold-review blocker fix). The
17-test delta between 5177 and this pass's 5194 is PR #913 (`c410259e`, unrelated — the chunk
read-back boundary), landed on `main` after #805 merged.)

**check-refs** (`node brain/scripts/check-refs.mjs`): green — no prohibited references, artifact
structure valid.

## Spec Compliance Matrix

| Requirement | Test file / case | Result |
|---|---|---|
| `--supersedes <id>` reaches the record, backend-agnostic | `cli.save-search.test.mjs`; `plainfiles.mjs:78,133-156` (opts destructure + gate, independent of `MEMORY_BACKEND`) | ✅ COMPLIANT |
| a repeated flag is rejected before any write | `cli.save-search.test.mjs`; `cli.mjs:795,802-805` (`supersedesRepeated`) | ✅ COMPLIANT |
| local checked first, `origin/main` only on a local miss | `supersedes.test.mjs` (thunk-call-count assertions); `supersedes.mjs:41-45` (`localIds()` before `upstream()`) | ✅ COMPLIANT |
| an upstream-only id is accepted | `supersedes.integration.test.mjs` (bare-origin fixture) | ✅ COMPLIANT |
| malformed id refused purely, zero IO | `supersedes.test.mjs` (7 malformed values, `localIds`/`upstream` spies assert 0 calls); `plainfiles.save.test.mjs` (malformed value, both seams 0 calls) | ✅ COMPLIANT |
| not-in-store refused, no write | `supersedes.test.mjs`; `supersedes.integration.test.mjs` | ✅ COMPLIANT |
| could-not-verify refused, `reason` quoted verbatim, both remedies named | `supersedes.test.mjs`; `supersedes.integration.test.mjs` (origin-removed clone); i18n key `supersedesUnverifiable` (`en.mjs:434`, `es.mjs:388`) | ✅ COMPLIANT |
| chains allowed (C supersedes B supersedes A) | `supersedes.integration.test.mjs` (`#805: a chain (C supersedes B supersedes A) is accepted; A, B, C all stay readable and indexed`) | ✅ COMPLIANT |
| mismatched `--issue` allowed | `plainfiles.save.test.mjs` (per apply-progress batch 2) | ✅ COMPLIANT |
| self-supersede structurally impossible (note, not a scenario) | source inspection only — `hashInput` folds `supersedes` into `id` (`format.mjs`) before the id can exist; no code/test asserts this by design | ✅ COMPLIANT (documented, not code-enforced, matches spec's own framing) |
| `engram.save` names `--supersedes` in its refusal | `en.mjs:418`, `es.mjs:375` (`engramUnsupported` clause) | ✅ COMPLIANT |
| `memory:audit`'s `coverage.supersedes` counts the first real write | `supersedes.integration.test.mjs` (the epic's 6.1 scenario, 0→1, survives `memory:reindex`); `audit.mjs:76-81` unchanged | ✅ COMPLIANT |
| the record-first correction sequence is drafted, not code-enforced | `brain-drafts/memory-backend-contract.draft.md` (`brain-amendment/1`, `planAmendment` verified `ok:true`/`pending` per apply-progress 6.2); no `brain/core/**` edit in this diff | ✅ COMPLIANT |

**Compliance summary**: 13/13 requirement scenarios from the spec compliant with passing covering
tests or, for the two explicitly-non-code requirements (self-supersede, the doctrine draft),
compliant by source inspection matching the spec's own framing.

## Correctness (Static + Runtime Evidence, D1–D7)

| Decision | Status | Evidence |
|---|---|---|
| D1 exactly one backend-agnostic `--supersedes` flag, `=` form refused | ✅ | `cli.mjs:775-821` — two arity guards (`supersedesCount > 1`, value-less) plus the `startsWith('supersedes=')` branch added in the fresh-review correction (`3b018a50`); `opts.supersedes` forwarded unparsed to every backend (`cli.mjs:821`) |
| D2 local-first, fail-closed | ✅ | `supersedes.mjs:39-58` — `localIds()` (a thunk, consulted only after the grammar regex passes — the cold-review blocker fix, `2dbc0197`) checked before `upstream()`; `upstream()` called at most once, only on a local miss; `ok:false` refused with `reason` verbatim and both remedies named in `supersedesUnverifiable` |
| D3 chains allowed | ✅ | `supersedes.integration.test.mjs` chain case; no ordering/fan-in rule enforced (matches spec Non-Goal) |
| D4 no reader shipped | ✅ | `rg "export function" brain/scripts/memory/lib/supersedes.mjs` → only `classifySupersedes`; zero chain-resolution/read-side call sites in `plainfiles.mjs` or elsewhere |
| D5 `audit.mjs` unchanged, `coverage.supersedes` counts | ✅ | `audit.mjs:76-81` — `supersedes` counted as `typeof r.supersedes === 'string' && r.supersedes !== ''`; no other edit to the file |
| D6 the draft plans ok | ✅ | `brain-drafts/memory-backend-contract.draft.md` — `target:`+`issue:` keys only, one `amend-find`/`amend-replace` pair anchored on the two-line Deletion-section sentence, appends the four-step record-first sequence after it; `planAmendment` verified `ok:true`, every act `pending` (apply-progress 6.2 transcript) |
| D7 counted diff ~135 (measured, vs. ~106 forecast) | ✅ | tasks.md 0.5: "Measured: 133 lines" via `parseDiffNumstat`; PR #912 body: "~135 counted lines" (post-correction-batch count); `.memory/` scope in the merge commit (`git diff --stat 51ff915f 376d6a31 -- .memory/`): exactly 2 records (`rec-7723969eb495debe`, `rec-3afb00eb127d31a6`) + `index.jsonl \| 2 ++`; the correction record's `supersedes` field points at the session record verbatim (inspected directly) |

## Corrections From Fresh Reviews and Cold Review (Confirmed Landed)

| Correction | Evidence |
|---|---|
| `--supersedes=<id>` (equals form) silently dropped the field, exit 0 | commit `3b018a50`; `cli.mjs:788-796` now refuses via the existing `supersedesMissingValue` key |
| config-error warn branch untested | commit `3b018a50`; `plainfiles.mjs:144` (`console.warn`, never throws) now covered |
| mismatched-`--issue` rule untested | commit `3b018a50`; `plainfiles.save.test.mjs` |
| cold-review blocker: a malformed id read the local store before the grammar check | commit `2dbc0197`; `supersedes.mjs` — `localIds` converted to a thunk, called only after `SUPERSEDES_ID_RE` passes; `plainfiles.mjs:140` — caller-side eager read converted to a deferred thunk; regression test in `plainfiles.save.test.mjs` (spies on both seams, asserts 0 calls) |
| cold-review editorial: the session record's i18n-key count was wrong (claimed eight, actually six new + one edited) | record `rec-3afb00eb127d31a6`, `memory:save --supersedes rec-7723969eb495debe` — the writer's own first real use |

## PR & Review Evidence

- `gh pr view 912 --json state,mergeCommit,mergedAt`: `MERGED`, `mergeCommit.oid: 376d6a31`, body
  opens `Closes #805`, names `Parent: #864 (memory 2.0), task 2.1` in prose.
- Labels: `type:bug`, `needs-decision` (the latter carries the two open maintainer questions — see
  Handover below).
- `gh pr view 912 --json reviews`: two `csrinaldibot` reviews. Round 1 at `head_sha e0d75682`:
  `verdict: REVISE` (the thunk-ordering blocker above). Round 2 at `head_sha c58ccb16`:
  `verdict: APPROVE`, `findings: []`, `conditions: []`. Both posted as PR review comments.
- `.memory/` scope in the merge commit: exactly `index.jsonl` (+2 lines) and the two records named
  above — no stray records (the staging mistake tasks.md's W2 evidence describes was reverted in
  `c58ccb16` before the push).
- Epic issue #864, task 2.1: **not ticked** on `main` — see WARNING 1.

## TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | ✅ | apply-progress (obs #3335) reports RED→GREEN per unit and per correction batch, including the batch-3 cold-review blocker (34/35 RED confirmed before the fix, 35/35 GREEN after) |
| All tasks have tests | ✅ | Every implementation task in Units 1–5 is preceded by its RED task in tasks.md; Unit 6 is explicitly read-only/no-test by spec design |
| RED confirmed | ✅ | apply-progress documents RED states for 1.1, 3.1, 4.1/4.2, 5.1, and the batch-3 regression test; reproduced in spirit by this pass's clean focused/full runs |
| GREEN confirmed | ✅ | 88/88 focused, 5194/5194 full suite, this verify pass |
| Triangulation adequate | ✅ | `classifySupersedes` gets 5+ distinct branches (malformed, local-hit, upstream-hit, not-in-store, could-not-verify) each independently asserted, plus a thunk-call-count invariant per branch |
| Safety net for modified files | ✅ | Full `npm test` green after each commit per apply-progress; reconfirmed in this pass at the merged head |

**TDD Compliance**: 6/6 checks passed.

### Assertion Quality

No tautologies or ghost loops found in `supersedes.test.mjs`, `supersedes.integration.test.mjs`,
`plainfiles.save.test.mjs`, or `cli.save-search.test.mjs`. The local-first invariant asserts the
upstream thunk's *call count*, not just the returned classification, so a regression that reads
upstream unnecessarily (performance/IO discipline, not just correctness) would fail the test —
the same class of precision as the batch-3 cold-review fix this suite now pins.

**Assertion quality**: ✅ All assertions verify real behavior.

### Quality Metrics

**Linter**: not run — no linter invocation configured for this verify pass; no lint failures
reported by apply-progress.
**Type Checker**: not applicable — plain `.mjs`, no TS build step.

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. **Epic task 2.1 (`openspec/changes/issue-864-memory-2-0/tasks.md:30`) was never ticked.**
   `git log -p --all -S"2.1 #805" -- openspec/changes/issue-864-memory-2-0/tasks.md` shows the
   line unchanged since it was first written — it still reads `- [ ] 2.1 #805 — a writer for
   \`supersedes\`...` on `main` at head `c410259e`. tasks.md's own W3 named this as a wrap-up
   step; it was not done before the PR merged, and it was outside this verify pass's write scope
   (restricted to this change's own `tasks.md`/`verify-report.md`). Small follow-up edit,
   referencing PR #912, recommended before or during archive.
2. **PR #912 carries the two maintainer questions from its cold review unresolved, tracked only
   by the `needs-decision` label and PR body prose** (whether `brain:promote`'s promoted paragraph
   should name `memory:ship` explicitly in step 2, and whether it needs an amendment number for
   when fan-in eventually rewrites it). Not a defect — this is the intended "promotion sitting" on
   the maintainer — but it means the Unit 6 draft is not yet applied to
   `brain/core/methodology/memory-backend-contract.md`, and the auto-merge unblock the PR body
   names (ADR-0034 L2, #889 D7.2) has not yet been actioned. See Handover below.

**SUGGESTION**: None.

## Handover

The Unit 6 draft (`openspec/changes/issue-805-supersedes-writer/brain-drafts/memory-backend-contract.draft.md`)
sits for the maintainer's `npm run brain:promote` session (non-TTY-refusing by design), per PR
#912's "For the maintainer" section. Two open questions from the cold review, unresolved, to
settle before or during that promotion:

1. Should the appended correction-sequence paragraph's step 2 name `memory:ship` explicitly, now
   that the lane exists (it landed after this slice's design was fixed, per #888/#901)?
2. Does the appended paragraph need its own amendment number, anticipating a future fan-in rewrite?

**What this unblocks**: `allow_auto_merge` enablement per ADR-0034 L2 and #889 D7.2 — the first
real `memory:ship` lane PR merged by hand — names #805 as a named prerequisite. Neither this PR
nor this verify pass actions D7.2; that remains a separate maintainer/orchestrator act once the
promotion above lands.

## Verdict

**PASS WITH WARNINGS**

All 13 spec requirement scenarios compliant with passing covering tests or documented-by-design
source inspection (88/88 focused, 5194/5194 full suite at the current merged head); D1–D7
confirmed by source inspection against the current tree; `.memory/` scope minimal and correct in
the merge commit, including the writer's own first real correction (`rec-3afb00eb127d31a6`
supersedes `rec-7723969eb495debe`); PR #912 merged with both cold-review rounds posted (REVISE
then APPROVE, `findings: []`). Two WARNINGs, both process/tracking gaps rather than code defects:
epic task 2.1 was never ticked on `main`, and the doctrine-draft promotion sits open with two
unresolved maintainer questions. Zero CRITICAL — nothing blocks archive, but the archive report
should carry both WARNINGs forward, and epic task 2.1 should be ticked (referencing PR #912)
either just before or as part of archive.
