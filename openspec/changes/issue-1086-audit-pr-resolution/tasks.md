# Tasks: Audit PR resolution from the merge commit (#1086)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~340 (excludes `**/*.test.mjs`, `.memory/**`, `openspec/**`, `AGENTS.md`): `uncomputable-cause.mjs` ~12, `github.mjs` ~45, `gitlab.mjs` ~45, `cli.mjs` ~1, `merge-walk.mjs` ~90, `brain-audit.mjs` ~35, `brain-metrics.mjs` ~5, fixtures ~80, `record-fixtures.mjs` ~25, `vcs-contract.md` ~3 |
| Tier-lite budget | 1000 — within budget, no `size:exception` needed |
| 400-line budget risk | Medium — fixtures are the volatile term |
| Chained PRs recommended | No |
| Suggested split (if ever chained) | Slice 1 = D1-D3 + fixtures (~210) · Slice 2 = D4-D6 (~130) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (risk is Medium, single PR expected) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `isNotFound` in `uncomputable-cause.mjs` | PR 1 (only PR) | Foundation — D2; every later unit reads this |
| 2 | `prView` additive `absent` on both providers + `vcs.contract.test.mjs:265` pin | PR 1 | Depends on unit 1 |
| 3 | `commitPrs` verb on both providers, fixtures, contract tests, `cli.mjs` VERBS entry | PR 1 | Depends on unit 1; independent of unit 2 |
| 4 | `fetchPrMeta` dispatch + `brain-audit.mjs`/`brain-metrics.mjs` accounting | PR 1 | Depends on units 2, 3 |
| 5 | Tier 2 draft (`brain-drafts/`) + #996 correction task + final verification | PR 1, last commits | Depends on unit 4 |

## Phase 1: `isNotFound` — the shared not-found predicate (D2)

- [x] 1.1 RED: `brain/scripts/vcs/lib/uncomputable-cause.test.mjs` — add cases asserting `isNotFound(text)` is `true` only when `classifyUncomputableCause(text) === NOT_FOUND`, `false` for every other reason, and that auth-worded 404 text (masked private repo) stays `false` per the existing ordering.
- [x] 1.2 GREEN: `uncomputable-cause.mjs` — export `isNotFound(text) { return classifyUncomputableCause(text) === UNCOMPUTABLE_REASONS.NOT_FOUND; }`; update the header comment (`:6`) to list `isNotFound` alongside `uncomputable()`/`isUncomputable()` as the module's approved exports.
- [x] 1.3 Verify: `node --test brain/scripts/vcs/lib/uncomputable-cause.test.mjs`.

## Phase 2: `prView` reports `absent` additively (D1)

- [x] 2.1 One task, live once (read-only): confirm the exact stderr `gh pr view <issue-number>` and the exact error `gitlabApiFetch` raises for `GET merge_requests/<issue-number>` emit for a number that is an issue, not a PR/MR, on a real repo; record both strings in `brain/scripts/vcs/fixtures/{github,gitlab}-prView-notfound.json` as `derived` provenance, and confirm each matches `NOT_FOUND_RE` before writing any provider code.
- [x] 2.2 RED: `brain/scripts/vcs/providers/vcs.contract.test.mjs` — widen the `:265` `deepEqual` pin to include `absent` (`false` on the happy fixture); add "prView reports absent:true on the not-found fixture" and "prView reports absent:null on the generic-failure fixture" cases for both providers, sourced from 2.1's fixtures plus the existing generic-failure fixture.
- [x] 2.3 GREEN: `github.mjs:407-428` — `prView` computes `absent: isNotFound(r.stderr)` on the `gh pr view` failure path (`false` on success, `true`/`null` from `isNotFound`'s boolean via the not-found predicate, `null` on the JSON-parse catch since a malformed response is not a negative); `labels`/`body` stay `null` in both failure branches, byte-identical to today.
- [x] 2.4 GREEN: `gitlab.mjs:292-313` — same shape, `absent: isNotFound(err.message)` from the `gitlabApiFetch` catch.
- [x] 2.5 Verify: `node --test brain/scripts/vcs/providers/vcs.contract.test.mjs` — confirm every existing `prView` consumer site (`merge-walk.mjs:307`, `ci-context.mjs:63,70`, `review/cold-boot.mjs:29,158`, `review/queue.mjs:55`, `governance/relabel-retrigger.mjs:88`, `status/cli.mjs:157`) is untouched by `rg -n "prView" --type js` diff review — none reads `absent` yet.

## Phase 3: `commitPrs` — the new port verb (D3)

- [x] 3.1 RED: `brain/scripts/vcs/providers/vcs.contract.test.mjs` — add `commitPrs` happy (`[991]` ascending), empty (`[]`), and failure (`null`, never throws) contract cases for both providers, wired through the fixture glue (`:75-90`) with provenance asserted (`:57-66`).
- [x] 3.2 Create fixtures `brain/scripts/vcs/fixtures/{github,gitlab}-commitPrs-{happy,empty,failure}.json`, `derived` provenance where unrecordable.
- [x] 3.3 GREEN: `github.mjs` — `commitPrs({ project, sha })` runs `gh api --paginate repos/{project}/commits/{sha}/pulls`, maps `r.number`, ascending; `[]` on a definitive empty list; `null` on any transport failure; never throws.
- [x] 3.4 GREEN: `gitlab.mjs` — `commitPrs({ project, sha })` runs `GET projects/:enc/repository/commits/:sha/merge_requests` over `gitlabApiFetch`, maps `r.iid`, same `[]`/`null` discipline.
- [x] 3.5 `cli.mjs` `VERBS` (`:48`) — add `'commitPrs'` next to `'commitStatus'`; this fires `verb-contract-drift-guard.test.mjs`'s `:82-91` check until Phase 5's draft lands as a real doc row (expected, tracked in Phase 5).
- [x] 3.6 `brain/scripts/vcs/fixtures/record-fixtures.mjs` — add a recorder for `commitPrs` following the existing per-verb recorder shape.
- [x] 3.7 Verify: `node --test brain/scripts/vcs/providers/vcs.contract.test.mjs`.

## Phase 4: `fetchPrMeta` dispatch + audit/metrics wiring (D4-D6)

- [x] 4.1 RED — fail-closed proof: `brain/scripts/lib/merge-walk.test.mjs` — a fake port where `prView` returns `{labels:null, body:null, absent:null}` asserts a `commitPrs` spy is called `0` times and `prMetaError` is set (transport failure never reaches the SHA fallback).
- [x] 4.2 RED — regression pin on the real shape: same file — subject `feat(setup): add conditional Codex readiness and routing (#978)`, fake `prView(978)` → `absent:true`, fake `commitPrs('d4cb7f8…')` → `[991]`, fake `prView(991)` → carries `Closes #978`; assert a real verdict (not uncomputable) and `prSource === 'commit-sha'`. Confirm this test fails against today's `fetchPrMeta` before Phase 4's GREEN task.
- [x] 4.3 RED: same file — the remaining dispatch-table rows from spec.md: exactly one containing PR → audit it; empty list → commit-body path (`prSource: null`); two-or-more containing PRs → uncomputable, neither evaluated; `commitPrs` unavailable/failing → uncomputable.
- [x] 4.4 GREEN: `merge-walk.mjs:298-330` — widen `fetchPrMeta(subject, vcs, config, sha)` (fourth positional, not an options object) so a `prView` result with `absent === true` calls `vcs.commitPrs({ project, sha })` and dispatches per the table; `absent === false`/`null` never calls `commitPrs`; a resolved commit-sha PR is re-read through the same local `prView` re-read helper (one level, no recursion) as the subject path; add `subjectRef` and `prSource: 'subject'|'commit-sha'|null` to the return shape; update the module's dispatch doc comment.
- [x] 4.5 Verify 4.1-4.3 now pass: `node --test brain/scripts/lib/merge-walk.test.mjs` — confirm the existing #474 `merge-walk.test.mjs:187-258` pins are still byte-identical (untouched).
- [x] 4.6 GREEN: `brain-audit.mjs` — pass `sha` into `fetchPrMeta` (`:321-340`); emission: `[UNCOMPUTABLE]` keeps its byte-identical `— PR #N metadata unreachable: …` suffix when `prNum !== null`, and prints `— <prMetaError>` when `prNum === null`; `[PASS]`/`[FAIL]` gain a bracketed suffix (` [pr #991 by commit-sha; (#978) is not a pull request]` or ` [(#978) is not a pull request; no pull request contains this merge — commit body audited]`) per D6 — no new line tag.
- [x] 4.7 RED+GREEN: `brain-audit.test.mjs` — emission assertions for: the legacy unreadable line stays byte-identical; the commit-sha-resolved suffix renders; the ambiguous (two-PR) uncomputable line names its own cause distinctly from the legacy unreadable line; capture stdout from the pure emission path only — no entrypoint spawn, no real `.git`.
- [x] 4.8 GREEN: `brain-metrics.mjs` — pass `sha` at `:472`; correct the stale `:135` comment describing the old `fetchPrMeta` signature.
- [x] 4.9 Verify: `node --test brain/scripts/lib/merge-walk.test.mjs brain/scripts/brain-audit.test.mjs brain/scripts/brain-metrics.test.mjs`.

## Phase 5: Tier 2 draft, #996 correction, closing verification

- [x] 5.1 Create `openspec/changes/issue-1086-audit-pr-resolution/brain-drafts/vcs-contract-commitprs-row.md` — a Tier 2 draft of `brain/core/methodology/vcs-contract.md`'s Required Verbs table adding the `commitPrs` row (mirrors `commitStatus`'s shape) and the `prView` `absent` field sentence, following the `issue-936` `vcs-contract-mrlist-row.md` precedent. Never write under `brain/**` directly. **Deviation**: written as `vcs-contract-commitprs-row.draft.md` (the actual `brain-amendment/1` promotable shape the `issue-936` precedent ships, matching `amendment-draft.mjs`'s `AMENDMENT_DRAFT_SUFFIX` contract) rather than the bare `.md` this task line names — verified against the real files with `planAmendment`, see apply-progress.
- Note (blocking hand-off, not a task): `verb-contract-drift-guard.test.mjs` stays RED for `commitPrs` (fired by Phase 3.5) until the maintainer promotes the 5.1 draft into `brain/core/methodology/vcs-contract.md` on this branch via `brain:promote`. This is expected and must be reported as a blocker, not silently worked around (no `DOCUMENTED_BUT_NOT_REQUIRED` allowlisting).
- [x] 5.2 Draft a comment for issue #996 stating: the `(#978)` merges are not a transient outage, re-running the audit can never clear them, and #1086 fixes the evaluator that misread an issue number as a pull request; post it under the session's standing forge-write authorization. **Not posted this batch** — text prepared in apply-progress.md, posting left to the orchestrator per its explicit instruction.
- [x] 5.3 Confirm live (already done in 2.1, cross-referenced here): both providers' not-found stderr/error text is pinned in `derived` fixtures rather than trusted from the design's reading.
- [x] 5.4 Full verification: `npm test` green except `verb-contract-drift-guard.test.mjs` pending 5.1's promotion (report explicitly, do not suppress); confirm `governance.auditBaseline` unchanged at `v1.0.0`; confirm the exit-code ladder (0/1/2) is unedited; confirm no test reads/writes the real repo `.git` or spawns a live entrypoint, and that only 2.1's single live confirmation touched a real remote, read-only.
- [x] 5.5 Confirm every proposal Success Criteria item: `brain:audit "v1.5.0..HEAD"` reports real verdicts for `d4cb7f8`/`789f6c2`/`c6ab10c`/`4d47e2f` instead of `[UNCOMPUTABLE]`; a simulated transport failure on the same merges still exits 2 with the lookup never called; two containing PRs stay uncomputable. **Verified by construction/regression-pin, not by a live `brain:audit` run** — see apply-progress (no further live calls authorized this batch).

## Commit plan (work-unit commits, STRICT TDD, tests travel with their code, no commit is red)

1. `fix(vcs): isNotFound classifies a definitive not-found cause (#1086)` — Phase 1.
   - Verify: `node --test brain/scripts/vcs/lib/uncomputable-cause.test.mjs`
   - Rollback: revert alone; new export, no caller yet.
2. `feat(vcs): prView additively reports whether a number is absent (#1086)` — Phase 2.
   - Verify: `node --test brain/scripts/vcs/providers/vcs.contract.test.mjs`
   - Rollback: revert alone; additive field, no existing consumer reads it.
3. `feat(vcs): commitPrs resolves the pull requests containing a commit (#1086)` — Phase 3.
   - Verify: `node --test brain/scripts/vcs/providers/vcs.contract.test.mjs`
   - Rollback: revert alone; new verb, unused until Phase 4.
4. `fix(audit): resolve a merge's PR by commit sha when the subject number is absent (#1086)` — Phase 4.
   - Verify: `node --test brain/scripts/lib/merge-walk.test.mjs brain/scripts/brain-audit.test.mjs brain/scripts/brain-metrics.test.mjs`
   - Rollback: revert alone; `fetchPrMeta`'s fourth argument is additive, dispatch only fires on `absent === true`.
5. `docs(sdd): issue-1086 Tier 2 draft, #996 correction, closing verification (#1086)` — Phase 5.
   - Verify: `npm test` (drift guard pending maintainer promotion, reported explicitly)
   - Rollback: revert alone; docs-only, no runtime code.

All commit subjects end `(#1086)`, no `Co-Authored-By` or AI-attribution trailers.

## Notes (not tasks)

- The two mandatory tests (fail-closed proof, regression pin) are 4.1 and 4.2 — do not merge them into other RED tasks.
- The live stderr/error confirmation (2.1) is the ONLY test permitted to touch a real remote, and it is read-only.
- 5.1 must be committed before 5.4's final verification task, per the blocking hand-off contract.
