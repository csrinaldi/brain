---
change: issue-738-provenance-at-capture
status: PASS WITH WARNINGS
verified_at: 2026-09-10T23:59:00Z
head: 5a928804955fb4c72e61e362e1a3eaf8a08034bb
---

# Verification Report — #738 provenance at capture: one configured handle, one measured kind, the branch demoted to `issue`

**Mode**: Strict TDD. Shipped as PR #914 (`Closes #738`, `Parent: #864`), merged `5a928804` on
2026-09-10, after a merge with `main` that resolved conflicts against #912 (`#805` supersedes) and
#913 (`#247` chunk read-back). Ruling `sdd/issue-738-provenance-at-capture/ruling` (D0–D6,
obs #3329) confirmed against the current tree.

## Completeness

| Metric | Value |
|---|---|
| tasks.md checkbox items — Section 0 (0.1–0.7) | all `[x]` |
| tasks.md checkbox items — Units 1–8 (1.1–8.3) | all `[x]` |
| tasks.md checkbox items — Wrap-up W1–W6 | all `[x]` |
| tasks.md checkbox item — Wrap-up W7 | `[ ]` — **intentional handover**, see below |
| Epic `openspec/changes/issue-864-memory-2-0/tasks.md:31` task 2.2 | `[x]`, names PR #914 |

W7 ("confirm `memory:audit`'s fresh-window `handle` count has moved off the all-time 0") is left
open on purpose per tasks.md's own framing — it requires a real capture in normal maintainer use
after merge, not a capture forced by this verify pass. W3 (the wrap-up task, not the spec
requirement) already recorded one real capture (`rec-96965eb1cf95f9a0`) at apply time, which is
why the epic and D5 exit criteria read as substantively met even though W7's own checkbox stays
unticked — see WARNING 2.

## Build & Tests Execution

**Focused** (`node --test` on the eight named files, isolated git identity
`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 HOME=$(mktemp -d)`): **146 pass / 0 fail**
(`git-config.test.mjs`, `capture-provenance.test.mjs`, `format.test.mjs`, `plainfiles.save.test.mjs`,
`plainfiles.actorkind-consistency.test.mjs`, `cli.save-search.test.mjs`, `engram-export.test.mjs`,
`real-store-roundtrip.integration.test.mjs`). Note: the orchestrator's pre-verify figure cited
"108/108" for a similarly-scoped focused run; this pass's own count over the exact eight files named
in the launch prompt is 146/146 (node:test counts nested subtests, so the two numbers likely reflect
different counting granularity or a slightly different file set at measurement time — not a
discrepancy in outcome, since both runs are green).

**Full suite** (`npm test`, same isolated identity): **5257 pass / 0 fail / 0 todo**, duration
~34.0s — matches the orchestrator's cited post-merge figure exactly.

**`check-refs.mjs`**: `✓ No prohibited references found.` / `✓ Artifact structure is valid.` (exit 0).

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| "a record carries its provenance" — actor resolved from `brain.actor` | fresh capture attributed | `plainfiles.save.test.mjs` | ✅ COMPLIANT |
| "a record carries its provenance" — `actorKind` measured | marker present/absent ⇒ agent/human | `capture-provenance.test.mjs`, `plainfiles.save.test.mjs` | ✅ COMPLIANT |
| "a record carries its provenance" — correction expressible | `supersedes` names the corrected id | `plainfiles.save.test.mjs` (merge w/ #805) | ✅ COMPLIANT |
| "capture refuses without a configured handle" | unset ⇒ non-zero, remedy named | `cli.save-search.test.mjs`, `capture-provenance.test.mjs` | ✅ COMPLIANT |
| "capture refuses without a configured handle" — non-handle-shaped | malformed ⇒ same remedy | `capture-provenance.test.mjs` | ✅ COMPLIANT |
| "an agent capture carries the operator's handle" | agent session ⇒ actor stays operator, `source` names instrument | `plainfiles.save.test.mjs` | ✅ COMPLIANT |
| "the write gate refuses a branch-shaped actor" — `appendRecord` W3 | `feat/x`/default branches refused | `format.test.mjs` | ✅ COMPLIANT |
| "the write gate refuses a branch-shaped actor" — read gate admits historical | `validateRecord` unchanged | `format.test.mjs` | ✅ COMPLIANT |
| "the write gate refuses a branch-shaped actor" — export soft-rejects | `{rejected}`, never throws | `engram-export.test.mjs` | ✅ COMPLIANT |
| "the actor predicate is owned by `format.mjs`" | relocation behavior-preserving | `format.test.mjs`, `audit.test.mjs` (unmodified) | ✅ COMPLIANT |
| "`issue` is derived from the branch when not declared" — all 3 scenarios | `--issue` wins; derived; absent never fabricated | `capture-provenance.test.mjs`, `plainfiles.save.test.mjs` | ✅ COMPLIANT |
| "brain's own capture path never emits a legacy sentinel" — capture path | `@legacy` never producible via `memory:save` | `plainfiles.save.test.mjs` (unit 7 pin) | ✅ COMPLIANT |
| "brain's own capture path never emits a legacy sentinel" — fresh-record audit target | D5 100%/0%/0% | measured live (Section 0.6), see Correctness below | ✅ COMPLIANT (one real capture measured; full-population audit is W7, open by design) |

**Compliance summary**: 13/13 spec-derived requirement rows COMPLIANT with passing covering tests
(146/146 focused, 5257/5257 full suite).

## Correctness (Static + Runtime Evidence)

| Decision | Status | Evidence |
|---|---|---|
| D0 — #542 overturned | ✅ | `plainfiles.actorkind-consistency.test.mjs` rewritten (not deleted) to pin the new rule; correction comment posted on both #542 and #738 (`gh api .../issues/{738,542}/comments`, both bodies identical, timestamps 2026-09-11T01:08:38Z/:40Z). |
| D1 — `actor` from `brain.actor` only, no fallback | ✅ | `rg "BRAIN_ACTOR\|user\\.name\|user\\.email\|gh api user"` across `capture-provenance.mjs` and `plainfiles.mjs` — zero matches. Refusals (unset/malformed/`@legacy`) all resolve through `resolveActor` (`capture-provenance.mjs:26,42-49`), `RESERVED_ACTORS = new Set(['@legacy'])`. |
| D1b — `actorKind` measured; agent capture keeps operator handle | ✅ | `resolveActorKind` reads the agent-marker env (`AI_AGENT` default, `brain.agentEnv` override); wiring at `plainfiles.mjs:170` never substitutes `actor` — `actor` stays `actorResult.actor` (the configured handle) at all times regardless of `actorKind`. |
| D2 — W3 write-path only; `HANDLE_RE` shared; `exportObservation` soft-rejects | ✅ | `format.mjs:236` — `appendRecord`'s `validateWritableRecord` refuses `classifyActor(record.actor) === 'branch'`; `validateRecord` (read gate) has no such check (grep confirms no W3-named error outside the writable-record path). `HANDLE_RE` exported from `format.mjs:56`, imported by `capture-provenance.mjs:14` (post-MINOR-1 fix — see below). `engram-export.mjs` returns `{rejected: {...}}` at 3 call sites (lines 70, 100, 123), never throws. |
| D3 — `issue` derived, never fabricated; `#` stripped from instruments | ✅ | `deriveIssue` grammar `^[a-z]+/issue-(\d+)(-|$)`; `collapseAndTruncate` at `capture-provenance.mjs:119` — `.replace(/#/g, '')` before `.slice(0, 64)` (MINOR-2 fix, `be19db89`, closes the `issueFromFuente` citation-forgery hole). |
| D4 — `@legacy` guard on the capture path | ✅ | Unit 7 pin in `plainfiles.save.test.mjs`; `RESERVED_ACTORS` refuses `@legacy` at `resolveActor`, before `buildRecord` is ever reached. |
| D5 — fresh-record audit target | ✅ (partial live measurement) | One real capture recorded at apply time: `rec-96965eb1cf95f9a0`, `actor: @csrinaldi`, `actorKind: agent` — confirmed as the only record added by the merge commit (`git show --stat 5a928804 -- .memory` → exactly `index.jsonl` + that one record file, 2 insertions). `real-store-roundtrip.integration.test.mjs` still reads the ~183 pre-existing branch-shaped historical actors and excludes them from W3 failure counts by name (`w3Count > 0` sanity assertion at line 268-270), proving the read gate still admits them unmodified. Full-population `memory:audit` re-run against the merged tree is W7 — not run by this verify pass (would require a real capture beyond the one already on record, out of scope for a read-only verify). |
| Interaction — malformed `--supersedes` id, zero store reads | ✅ | `plainfiles.mjs:159-206` comment block states the contract explicitly: `classifySupersedes`'s grammar check runs before either IO thunk, so a malformed id "touches no IO" regardless of gate order. |
| Interaction — valid `--supersedes` id + no actor ⇒ actor refusal fires first, no store read | ✅ | `plainfiles.mjs:159` — `resolveActor` gate runs and can throw BEFORE the `if (supersedes !== undefined)` block at `:186` is ever reached; source comment (`:140-154`) documents this ordering choice explicitly as the #738/#805 merge resolution. |
| Interaction — both valid ⇒ record carries actor, actorKind, supersedes | ✅ | `buildRecord({ ts, actor, actorKind, type, project, issue: issueResult.issue, supersedes, content, title, source })` at `plainfiles.mjs:208-211` — all three fields present in one call. |
| Drafts planned OK, not applied to `brain/core/**` | ✅ | `git diff origin/main -- brain/core/methodology/memory-format.md brain/core/methodology/memory-backend-contract.md` → empty (files match `origin/main` byte-for-byte on the merged tree). Both drafts exist at `openspec/changes/issue-738-provenance-at-capture/brain-drafts/{memory-format,memory-backend-contract}.draft.md`. |
| Epic 2.2 ticked | ✅ | `openspec/changes/issue-864-memory-2-0/tasks.md:31` — `[x] 2.2`, names PR #914 in its own text. |
| `.memory/` scope in the merge | ✅ | `git show --stat 5a928804 -- .memory` → `index.jsonl` (+1) and one record file (+1), 2 insertions total — minimal, matches W2/W3. |
| PR #914 merged with a posted verdict | ✅ (see WARNING 1) | `gh api .../pulls/914/reviews` — one review, GitHub `state: COMMENTED` (the repo's review-poster convention), body YAML `verdict: APPROVE`, `head_sha: e84b2ce3...`, `submitted_at: 2026-09-10T22:10:18Z`. Merge commit `5a928804` was created at `2026-09-10T23:09:31Z` — **after** the reviewed head, meaning the reviewed SHA (`e84b2ce3`) and the merged SHA (`5a928804`) differ. |

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| A1 — module named `capture-provenance.mjs`, not `actor-identity.mjs` (ratified departure) | ✅ Yes | Also derives `issue`, as the design's own Open Questions section anticipated. |
| A2 — `brain.agentEnv` is a comma-separated list, not a single override | ✅ Yes | `resolveActorKind` tested with a 3-name list, second name set ⇒ `agent` (spec scenario, `capture-provenance.test.mjs`). |
| A3 — CLI-spawn tests gain isolated-`HOME` fixture rather than a test-only seam | ✅ Yes | `git init` + local `brain.actor` + `GIT_CONFIG_GLOBAL=/dev/null` + `GIT_CONFIG_NOSYSTEM=1` pattern present in `cli.save-search.test.mjs` and three other CLI-spawn files (per apply-progress). |
| A4 — W3 lands in `validateWritableRecord` at `appendRecord`, not `buildRecord` | ✅ Yes | Confirmed at `format.mjs:236`; epic tick text (2.2) states this explicitly as a ratified departure. |
| A5 — `engram-export.mjs` soft-rejects | ✅ Yes | Confirmed above. |
| A6 — `PLAINFILES_ACTOR_KIND` retired | ✅ Yes | `plainfiles.actorkind-consistency.test.mjs` asserts it is "no longer exported" per tasks.md 4.1; not found in a grep of `plainfiles.mjs`. |

## PR & Review Evidence

- `gh pr view 914`: `MERGED`, `mergeCommit.oid: 5a928804955fb4c72e61e362e1a3eaf8a08034bb`,
  `mergedAt: 2026-09-10T23:09:31Z`, label `type:bug`, 33 files changed, +3036/-106 raw (includes the
  full SDD planning-artifact commit and the merge-with-main resolution — not the ~212-357 counted
  figure discussed in tasks.md/apply-progress, which excludes tests/openspec/lockfiles per
  `brain.config.json:18-29`).
- `gh api .../pulls/914/reviews`: one entry, verdict `APPROVE` at `head_sha: e84b2ce3`,
  `submitted_at: 2026-09-10T22:10:18Z` — **before** the merge commit `5a928804` (`23:09:31Z`) existed.
  See WARNING 1.
- `gh issue view 738`: `CLOSED` at `2026-09-10T23:09:32Z`, one second after the merge — correct
  auto-close timing (`Closes #738` in the PR body), unlike the recurring early-close artifact noted
  in `archive/888`/`archive/889`'s reports.
- `gh issue view 542`: already `MERGED`/closed since 2026-08-11 (a PR, not this change's target) —
  the D0 correction comment was posted on it as a durable pointer, not a close/reopen action; matches
  tasks.md 8.3's own framing ("posted on #738 and #542", not "reopened #542").
- `.memory/` scope in the merge commit: minimal, confirmed above.
- Merge conflict resolution against #912 (`#805` supersedes) and #913 (`#247` chunk read-back):
  `plainfiles.mjs:140` carries an explicit merged-comment block documenting the actor-gate-before-
  supersedes-gate ordering decision; no hunk from either parent was dropped — the lines absent from
  each side are exactly the ones the other side intentionally replaced (`getBranch`'s actor role and
  `PLAINFILES_ACTOR_KIND` retired by #738; the `buildRecord` call extended with `supersedes` by
  #805). Confirmed by direct source read, not re-derived independently in this pass — cited as
  orchestrator-measured and spot-checked true against the current tree.

## TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | ✅ | apply-progress (obs #3339) reports a full RED→GREEN table per unit (1–8), plus a separate review-corrections batch with explicit mutant-alive/mutant-dead evidence for MINOR-1/MINOR-2/MINOR-3. |
| All tasks have tests | ✅ | Every implementation task (1.1–8.1) is preceded by its own RED task in tasks.md; unit 7 is a test-only pin, correctly framed as such. |
| RED confirmed | ✅ | apply-progress documents RED states per unit including the unit-3 "full suite intentionally red here" case (10 pre-existing fixtures relying on old branch-as-actor behavior), correctly distinguished from a real regression. |
| GREEN confirmed | ✅ | 146/146 focused (this pass), 5257/5257 full suite (this pass) — matches apply-progress's own final count exactly. |
| Triangulation adequate | ✅ | `capture-provenance.test.mjs`'s multi-case tables for `resolveActor`/`resolveActorKind`/`deriveIssue`; `real-store-roundtrip.integration.test.mjs`'s bounded-exclusion assertions (NIT fix) prevent a silently-vacuous test. |
| Safety net for modified files | ✅ | Full `npm test` green after each commit per apply-progress; reconfirmed 5257/5257 in this pass on the merged tree. |

**TDD Compliance**: 6/6 checks passed.

### Assertion Quality

No tautologies found in the current test files touched by this change. The review-corrections batch
(`be19db89`, `feb2feca`) itself exists specifically because a fresh-context adversarial review found
and killed four previously-surviving mutants (a vacuous truncation regex, an undertested
no-derivation branch, an unwired `agentEnvConfig` case, and an unbounded exclusion-bucket assertion)
— visible in the current test files as the strengthened assertions, not left as gaps.

**Assertion quality**: ✅ All assertions verify real behavior.

### Quality Metrics

**Linter**: not run — no linter invocation configured for this verify pass; no lint failures reported
by apply-progress.
**Type Checker**: not applicable — plain `.mjs`, no TS build step.

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. **The posted review verdict (`APPROVE` at `head_sha: e84b2ce3`) was issued for a pre-merge head,
   not for the final merge commit `5a928804`.** The merge with `main` that resolved conflicts
   against #912/#913 happened after `e84b2ce3` was reviewed, and no fresh cold-review round ran
   against `5a928804` itself before or after the merge landed on `main`. This verify pass's
   post-merge audit (the source-level checks in the Correctness table above — call-order,
   `.memory/` scope, no dropped hunks, D1–D5 predicate checks, full 5257/5257 suite) stands in for
   that missing round and found no defect, but it is not a substitute for an actual fresh-context
   adversarial review of the merge resolution itself. Recommend `sdd-archive` note this explicitly
   as a residual gap rather than treat the pre-merge APPROVE as covering the merged head.
2. **W7 ("confirm `memory:audit`'s fresh-window handle count has moved off 0") is correctly left
   `[ ]` by design**, but its practical substance is already partially satisfied: one real capture
   (`rec-96965eb1cf95f9a0`, `actor: @csrinaldi`, `actorKind: agent`) already exists in the merged
   tree from wrap-up W3, meaning the fresh-window handle count is very likely already off 0 the
   moment `memory:audit` is next run — this verify pass did not re-run `memory:audit` against the
   live post-merge store (out of scope, would itself constitute a capture-adjacent action on a
   verify-only worktree). Recommend `sdd-archive` ask the maintainer to run `npm run memory:audit`
   once and tick W7, rather than carry it forward indefinitely as unverified.

**SUGGESTION**:
1. **Stale comment at `brain/scripts/memory/lib/format.mjs:55`.** The comment reads: *"`HANDLE_RE`
   is also the positive requirement `capture-provenance.mjs#resolveActor` enforces at the point a
   handle is minted (kept as a private literal there — see that module's header)."* This describes
   the PRE-MINOR-1 state. The MINOR-1 fix (commit `be19db89`, part of PR #914) changed
   `capture-provenance.mjs` to `import { HANDLE_RE } from './format.mjs'` (confirmed at line 14 of
   that file) — it is no longer a private literal copy. The comment should be updated to say
   `capture-provenance.mjs` imports `HANDLE_RE` directly, or simply removed since the import itself
   is now self-documenting. Cosmetic only — does not affect behavior or any spec scenario, and the
   #914 cold review already flagged and fixed the underlying code issue (MINOR-1); only the
   docstring narrating the old shape survived that fix.

## Verdict

**PASS WITH WARNINGS**

All 13 spec-derived requirement rows have passing covering tests (146/146 focused, 5257/5257 full
suite — matching the orchestrator's post-merge audit figure exactly); `check-refs.mjs` clean; every
code-bearing tasks.md item `[x]` except the intentionally-deferred W7; D0–D5 and all three
`--supersedes` interaction cases confirmed by direct source inspection against the current
(post-merge) tree; the two `brain-drafts/` amendments verified planned but NOT applied to
`brain/core/**`; epic task 2.2 ticked and names PR #914; `.memory/` scope minimal in the merge
commit (2 insertions: one index line, one record); PR #914 merged with a posted APPROVE verdict.
Zero CRITICAL — nothing blocks archive. Two WARNINGs: the posted APPROVE covers a pre-merge head
rather than the actual merged commit (this verify pass's own post-merge audit substitutes but does
not replace a real cold round), and W7's fresh-window audit re-run is still open though its
substance is very likely already satisfied by the one real capture already on record. One cosmetic
SUGGESTION: a stale docstring at `format.mjs:55` describing `HANDLE_RE` as a private literal copy in
`capture-provenance.mjs`, which the #914 review's own MINOR-1 fix turned into a real import.
