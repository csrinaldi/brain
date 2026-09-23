---
status: draft
issue: 473
artifact_store: hybrid
topic_key: sdd/issue-473-approval-signature-on-diff/tasks
---

# Tasks: issue-473 — approval signature lands on the diff

Source: spec `sdd/issue-473-approval-signature-on-diff/spec` (#2724), design `sdd/issue-473-approval-signature-on-diff/design` (#2725). REQ ids assigned here for traceability (spec has no numeric ids):

REQ-473-1 brain-decision/1 additional sufficient evidence | REQ-473-2 head_sha freshness | REQ-473-3 review author == actor field | REQ-473-4 block author not in reviewActors | REQ-473-5 unreadable/incomplete blocks fail closed | REQ-473-6 monotonicity | REQ-473-7 write-side identity verification | REQ-473-8 write-side head-race safety | REQ-473-9 no new port verb / no APPROVE review | REQ-473-10 status:approved stays authorization-only, L6 unaffected.

Runner: `node --test "brain/scripts/**/*.test.mjs"` (package.json:39), or a single file for the RED/GREEN steps below. Strict TDD: every numbered pair is RED (test written, run, confirm fail) then GREEN (minimal code, run, confirm pass).

## Review Workload Forecast

| Field | Value |
|---|---|
| Gate-counted lines (repo diff-size gate: excludes `**/*.test.mjs`, `AGENTS.md`, `openspec/**`, `.memory/**`) | Slice1 ~250 (actual 249), Slice2 ~130 forecast (actual 227), Slice3 ~201 forecast (actual 295), **Total updated ~771** |
| Full reviewer diff (incl. tests + ADR draft, what a human actually reads) | Slice1 ~540, Slice2 ~420 forecast (actual 692), Slice3 ~681 forecast (actual 804, ADR draft NOT included — see Deviation 1), **Total updated ~2036** |
| 400-line budget risk (reviewer-diff convention) | High |
| Repo gate risk (1000 lite budget) | Low (771 < 1000, and each slice individually well under 1000) |
| Chained PRs recommended | Yes |
| Suggested split | PR1 parser → PR2 reader → PR3 CLI+ADR draft (sequential, matches design H4) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain (resolved by orchestrator for this session) |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

Rationale for High despite Low gate risk: `**/*.test.mjs` and the ADR draft under `openspec/**` are excluded from the repo's automated gate but are NOT excluded from what a human reviewer reads. Slice 3 alone (~804 full-diff lines actual: cli.mjs 295, cli.test.mjs, locks.test.mjs, package.json — ADR draft content exists but is NOT on disk, see Deviation 1) exceeds the 400-line reviewer-cognitive-load convention on its own; slice 2 also exceeded its own forecast (692 actual vs ~420 forecast) once the full 17-sub-case E2 matrix plus mutation-axis-closing tests were written. The design already names three independently-revertible, dependency-ordered slices (H4); this forecast confirms that boundary is also the right review-size boundary — no further splitting needed inside a slice.

Natural boundaries for the human's chain-strategy pick: PR1 (parser, pure move + new shared module) has zero production coupling to PR2/PR3 and is independently revertible; PR2 (reader) is a provable production no-op until PR3 exists (no `brain-decision/1` block can be posted without the CLI) — safe to merge to main standalone; PR3 (CLI+ADR draft) is the only slice with a HUMAN-run step in its own definition of done (task 3.17's draft is promoted by a human, not this pipeline). `stacked-to-main` fits if the team wants PR2 live (as a no-op) before PR3 lands; `feature-branch-chain` fits if the team wants nothing user-visible until all three are reviewed together.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Parser extraction: `yaml-block.mjs` + `decision-block.mjs`, `parse-verdict.mjs` untouched behaviorally | PR 1 | Base: main (or tracker). Independently revertible. **DONE — commit cf1c63f on feat/issue-473-s1-parser-extraction, round-1 fix 2678e99.** |
| 2 | Reader: `evaluateSignedDecision` peer source + input threading + fail-closed matrix | PR 2 | Base: PR 1 branch/tracker. Production no-op until PR 3 exists. **DONE — commit 3160478 on feat/issue-473-s2-actor-check-reader, round-1 fix 38fd26f.** |
| 3 | Writer: `brain:approve` CLI + ADR-0026 Amendment 2 draft | PR 3 | Base: PR 2 branch/tracker. Only slice needing a human follow-up outside CI. **DONE (agent portion) — commit 32539a7 on feat/issue-473-s3-approve-cli. Task 3.17's draft CONTENT is complete (saved to engram topic `sdd/issue-473-approval-signature-on-diff/adr-draft`, obs #2728) and has now been persisted to disk at `brain-drafts/adr-0026-amendment-2.draft.md` as part of the hybrid-store materialization (see apply-progress topic).** |

---

## Phase 1 (PR 1) — Parser extraction — **COMPLETE (9/9)**

Files: `brain/scripts/review/lib/yaml-block.mjs` (new), `brain/scripts/review/lib/decision-block.mjs` (new), `brain/scripts/review/lib/parse-verdict.mjs` (edit: import shared primitives, zero behavior change), `brain/scripts/review/lib/yaml-block.drift.test.mjs` (new), `brain/scripts/review/lib/decision-block.test.mjs` (new), `brain/scripts/review/lib/parse-verdict.test.mjs` (must show **zero diff** — confirmed).

- [x] 1.1 RED — `decision-block.test.mjs`: `parseDecision()` returns `null` on an unreadable body (module does not exist yet). REQ-473-5. Done: `node --test brain/scripts/review/lib/decision-block.test.mjs` fails (module not found). **Confirmed via real run.**
- [x] 1.2 GREEN — create `decision-block.mjs` with an inline copy of primitives; minimal `renderDecision`/`parseDecision`. Done: 1.1 passes.
- [x] 1.3 RED — round-trip: `parseDecision(renderDecision(x))` returns every E1 field (`protocol`, `decision`, `head_sha`, `actor`, `at`, `in_reply_to`). REQ-473-1. Done: fails.
- [x] 1.4 GREEN — implement full E1 field set in render/parse. Done: 1.3 passes.
- [x] 1.5 RED — one case per E2 parse-level rule (3, 4, 5, 6, 7, 8, 9, 12, 17, 18, 19, 20). REQ-473-1, REQ-473-2, REQ-473-3, REQ-473-5. Done: each new case fails before its fix.
- [x] 1.6 GREEN — implement remaining field validation (protocol-version check, `decision` exact-literal check, `head_sha` 40-hex format check, first-fence-only selection). Done: 1.5 all green.
- [x] 1.7 RED — `yaml-block.drift.test.mjs`: cross-parser equivalence table (~10 pathological rows) rendered into both `brain-review/1` body and `brain-decision/1` bodies; fails because `decision-block.mjs` still owns its own inline copy of `scalar`/`FENCE_RE`/`decodeYamlEscapes` that can diverge from `parse-verdict.mjs`'s copy. REQ-473-5 (design B3 guard 1). Done: **2 of 7 rows disagreed, confirmed via real `node --test` run** (fence-tag-trailing-space, CRLF-line-endings — both traced to FENCE_RE's missing `\s*` tolerance in the independent inline copy).
- [x] 1.8 GREEN — extract `yaml-block.mjs` (`FENCE_RE`, `extractFencedBlock`, `scalar`, `decodeYamlEscapes`, `unyamlScalar`, `parseJsonScalar`); both `parse-verdict.mjs` and `decision-block.mjs` import it. Done: 1.7 green AND `parse-verdict.test.mjs` green (7/7 drift rows, 33/33 parse-verdict tests).
- [x] 1.9 Verify — `parse-verdict.mjs`'s two-protocol allowlist (~line 214) unchanged; full suite green; `parse-verdict.test.mjs` diff is exactly zero lines. REQ-473-9 (no behavior drift). Done: `node --test "brain/scripts/**/*.test.mjs"` green (2738/2738); `git diff --stat brain/scripts/review/lib/parse-verdict.test.mjs` empty — **confirmed**.

Mutation/red-proof evidence (both guards proven to bite via live mutation, then reverted — see apply-progress topic for full detail): (1) yaml-block.drift.test.mjs re-tested against a temporarily-reintroduced divergent copy — 2/7 rows red again; (2) parse-verdict.test.mjs re-tested against a temporarily-mutated two-protocol allowlist — 17/33 rows red. Both reverted, suite confirmed clean before commit.

Commit: `cf1c63f` — `refactor(review): extract shared fenced-YAML primitives into yaml-block.mjs (#473)` on branch `feat/issue-473-s1-parser-extraction` (targets tracker `feat/issue-473-approval-signature-on-diff`). Gate-counted ~249 changed lines (forecast ~250). Round-1 review fix `2678e99` — `test(review): drift guard asserts protocol on both parsers + case-folded key row (#473)` — added a `protocol` assertion + case-folded-key row to the drift guard.

## Phase 2 (PR 2) — actor-check reader — **COMPLETE (11/11)**

Depended on Phase 1 (`decision-block.mjs`'s `parseDecision`) — dependency satisfied. Files: `brain/scripts/vcs/actor-check.mjs` (edit), `brain/scripts/vcs/actor-check.test.mjs` (extend).

- [x] 2.1 RED — success criterion: a `brain-decision/1 APPROVE` at the current head passes `lite` even though the label predates a later foreign commit. REQ-473-1. Done: `evaluateSignedDecision`/`LITE_SIGNED_EVIDENCE_SOURCES` didn't exist — confirmed red (SyntaxError, missing export).
- [x] 2.2 GREEN — added `evaluateSignedDecision`, `LITE_SIGNED_EVIDENCE_SOURCES`, composite seam in `evaluateActor`'s `lite` branch (design C2). Done: 2.1 passes.
- [x] 2.3 RED→GREEN, per E2 rule 1, 4-17 (17 sub-cases): protocol mismatch silent(rule3)/refuse(rule4); decision absent(5)/wrong(6); head_sha absent(7)/malformed(8)/prefix(9)/mismatch(10)/unresolvable(11); actor absent(12)/mismatch(14)/unresolvable-author(13); denyActors block(15); multiple reviews first-admissible-wins(16); multiple fences first-only(17). REQ-473-2, REQ-473-3, REQ-473-4, REQ-473-5. Done: each case red before fix, file green after (117/117 final).
- [x] 2.4 RED — `standard`/`regulated` tiers make zero `fetchDecisions` calls (injected spy). REQ-473-10. Done: fails without tier gating.
- [x] 2.5 GREEN — added `needsDecisionEvidence(tier)`, threaded through **both** `gatherActorCheckInputs` return statements (early return, normal return). Done: 2.4 passes.
- [x] 2.6 RED — composite honors an injected `signedEvidenceSources` list (order + first-admitted-wins), not a hardcoded call. REQ-473-1. Done: fails with hardcoded call.
- [x] 2.7 GREEN — `signedEvidenceSources` becomes a defaulted input field on `evaluateActor`, defaulting to `LITE_SIGNED_EVIDENCE_SOURCES`. Done: 2.6 passes.
- [x] 2.8 RED — no labeled event → warn+pass even with an admissible block present (label stays required precondition, C5 property 1). REQ-473-10. Done: fails if a block alone can pass without a label — passes for FREE off the existing pre-tier-dispatch early return, no new code needed.
- [x] 2.9 Verify — 2.8 passes with no `actor-check.mjs` diff beyond 2.2-2.7 (structural property, not new prod code). Done: green, confirmed no additional code path added.
- [x] 2.10 Verify — full pre-existing `evaluateDistinctAct` matrix re-run unedited; byte-for-byte reason strings. REQ-473-6. Done: `actor-check.test.mjs` pre-existing cases (lines 1-1227) pass unmodified — confirmed via diff (new content only appended).
- [x] 2.11 Mutation-axis coverage — PATH (`null`/`[]`/non-decision-review), SPELLING (deny-check removed — caught; deny-check-target-swap mutation found STRUCTURALLY UNOBSERVABLE given rule ordering, documented as deviation), FIELD (reason string names refused block+reason — multi-review note-truncation gap found+closed), SITE (both `gatherActorCheckInputs` return-statement sites), VALUE CLASS (head_sha case-fold, 7-char-prefix-collision gap found+closed) — every mutation temporarily broke the suite red, then reverted green; two genuine fixture gaps found DURING this drill and closed with new permanent tests (prefix-collision case, multi-note-collection case). REQ-473-4, REQ-473-5. Done — full detail in apply-progress topic (#2727).

Commit: `3160478` — `feat(vcs): brain-decision/1 admissible as lite actor-check evidence (#473)` on branch `feat/issue-473-s2-actor-check-reader` (targets `feat/issue-473-s1-parser-extraction`). Gate-counted 227 changed lines (forecast ~130 — see apply-progress deviations for why it ran over). Round-1 review fix `38fd26f` — `fix(vcs): actor-check fail-closed on non-string headSha, byte-identical legacy reasons, deny-check hardening (#473)`.

## Phase 3 (PR 3) — `brain:approve` CLI + ADR-0026 Amendment 2 draft — **COMPLETE (17/17)**

Depended on Phase 1 (`renderDecision`, done) and Phase 2 (read-side semantics, done — for manual smoke). Files: `brain/scripts/approve/cli.mjs` (new), `brain/scripts/approve/cli.test.mjs` (new), `brain/scripts/approve/locks.test.mjs` (new), `package.json` (added `brain:approve` script), `openspec/changes/issue-473-approval-signature-on-diff/brain-drafts/adr-0026-amendment-2.draft.md` (content complete, now persisted to disk — see task 3.17).

- [x] 3.1 RED — `locks.test.mjs`: non-TTY stdin refuses before any read/write (lock 1). REQ-473-7. Done: fails, `cli.mjs` doesn't exist (confirmed via real `node --test` run, ERR_MODULE_NOT_FOUND).
- [x] 3.2 GREEN — minimal `cli.mjs`: `parseArgs` + TTY gate only, then built out fully. Done: 3.1 passes.
- [x] 3.3 RED — any option-shaped argv token hard-aborts (lock 2). REQ-473-7. Done: fails (confirmed live during the initial full-suite RED run, and independently RE-confirmed by live mutation drill after GREEN — see apply-progress mutation evidence item 2).
- [x] 3.4 GREEN — implement `parseArgs` (mirror `brain-promote.mjs:87-97`). Done: 3.3 passes.
- [x] 3.5 RED — identity resolves via `whoami()`; refuses if resolved login ∈ `governance.reviewActors` (deny-before-allow). REQ-473-7. Done: fails pre-GREEN; re-confirmed via live mutation drill (item 6).
- [x] 3.6 GREEN — wire `vcs.whoami({})` (ambient credentials, no token param per design §F3) + `defaultReadDenyActors()` (via `loadBrainConfig()`) + deny check. Done: 3.5 passes.
- [x] 3.7 RED — composes `renderDecision` block with `head_sha` from `prView().headRefOid`; refuses to post if head moved between compose and re-read. REQ-473-8. Done: fails pre-GREEN; re-confirmed via live mutation drill (item 4).
- [x] 3.8 GREEN — implement compose + confirmation prompt + re-read-head guard (exactly 2 `vcs.prView(` call sites, literal in source, not behind a shared helper). Done: 3.7 passes; `locks.test.mjs` asserts the call-site count == 2 via a SOURCE occurrence count (SITE axis) — proven live via mutation drill.
- [x] 3.9 RED — confirmation word must be exactly `SIGN`, typed in full. REQ-473-7. Done: fails pre-GREEN; re-confirmed via live mutation drill (item 8, case-fold).
- [x] 3.10 GREEN — implement confirmation gate (case-sensitive, whitespace-tolerant exact match). Done: 3.9 passes.
- [x] 3.11 RED — posts via `prReviewComment` with no `event` key, no `comments`, zero labels written (zero-label lock). REQ-473-9. Done: fails pre-GREEN; re-confirmed via live mutation drill (item 7).
- [x] 3.12 GREEN — implement post step, existing verb only. Done: 3.11 passes; mirrors `vcs.contract.test.mjs:1670` hostile-`event` guard (both a behavioral AND a structural source-scan test independently guard this).
- [x] 3.13 RED — post-then-verify: re-reads `prReviews()`, exits non-zero with instructions if landed author ≠ block `actor`; `{url:null}` also exits non-zero; `prReviews()===null` also exits non-zero. REQ-473-8. Done: fails pre-GREEN; re-confirmed via live mutation drill (item 5, one guard covers all three cases).
- [x] 3.14 GREEN — implement verify step + exit codes; prints PR URL only after verify passes. Done: 3.13 passes; full E3 write-side matrix green (19/19 in cli.test.mjs).
- [x] 3.15 Wire — added `"brain:approve": "node ./brain/scripts/approve/cli.mjs"` to `package.json` next to `brain:promote`/`brain:review`. Done: `node ./brain/scripts/approve/cli.mjs --help` on a non-TTY exits via lock 1 (exit code 2) — real, verified run, proving wiring resolves.
- [x] 3.16 Verify — `VERBS` gained nothing, `event:'COMMENT'` still hardcoded provider-side (ADR-0020 Locks 1-3 regression, alongside `vcs.contract.test.mjs:1670`). REQ-473-9. Done: `node --test "brain/scripts/**/*.test.mjs"` full suite green (2864/2864); zero edits to `vcs/cli.mjs`, `vcs.contract.test.mjs`, `brain-writes-reviewed.test.mjs` — a dedicated locks.test.mjs case source-scans `vcs/cli.mjs` for the literal `'approve'`/`"approve"` and confirms absence.
- [x] 3.17 Draft (documentation) — CONTENT complete per design G1 (Context/Decision/monotonicity+proof-ref/accepted-losses/honest-residuals/§1c-style paste-ready promotion blocks/references), verified against ADR-0026's real current text, `consolidation-protocol.md` §1c's real "three acts" shape, and `destinationFor()`'s real behavior on the `.draft.md` suffix (confirmed live: returns `null`). Persisted to the on-disk path `openspec/changes/issue-473-approval-signature-on-diff/brain-drafts/adr-0026-amendment-2.draft.md` as part of the hybrid artifact-store materialization: the change folder now carries proposal.md/spec.md/design.md/tasks.md, satisfying `repo:check`'s `openspec-incomplete` structural rule, so the draft file no longer trips the pre-commit hook. Source of truth for the text remains engram topic `sdd/issue-473-approval-signature-on-diff/adr-draft` (obs #2728); the disk copy is now the canonical materialized copy.

## Human-only follow-up (not agent work — do not delegate)

- [ ] H.1 Promote the ADR draft: a human manually edits `brain/project/decisions/adr-0026-governance-doctrine-tiers.md` in-file, mirroring Amendment 1's shape — new `## Amendment 2 (#473)` section, status-line update to `**amended DD/MM/2026** (Amendments 1-2)`, inline `[Amended by Amendment 2 (#473) — …]` marker in the `lite` evidence-table row (design G1 steps 1-7). Full paste-ready text lives at `brain-drafts/adr-0026-amendment-2.draft.md` on disk and at engram topic `sdd/issue-473-approval-signature-on-diff/adr-draft` (obs #2728). Reason it's human-only: `brain:promote` refuses to overwrite a signed artifact (`brain-promote.mjs:348-352`), and agents never write `brain/**` directly. Gated by L6 `brain-writes-reviewed` + CODEOWNERS as usual.
- [ ] H.2 After the LAST agent push on this change's own PR chain, a human re-applies `status:approved` / re-signs a fresh `brain-decision/1` (actor-check re-arm) — required because each push invalidates the prior `head_sha`-bound evidence (REQ-473-2). This is the human closing their own gate; an agent cannot do it on its own PR (write-side identity check, REQ-473-7).
