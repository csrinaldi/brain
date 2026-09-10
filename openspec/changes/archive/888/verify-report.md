---
change: issue-888-lane-ship
status: PASS WITH WARNINGS
verified_at: 2026-09-10T13:19:53Z
head: 204b467de481475d518b8553c61e8ee5ce4e857d
---

# Verification Report — #888 the lane ships: one push, one PR, and a credential the verb never holds

**Mode**: Strict TDD. Both slices landed: PR #902 (library, `Closes #901`, merged `16493771`) and
PR #903 (CLI op, `Closes #888`, merged `2d97cf61`), plus one cherry-picked cold-review fix
(`204b467d`, this worktree's HEAD) refusing a set-but-blank `BRAIN_MEMORY_TOKEN`. Ruling
`sdd/issue-888-lane-ship/ruling` (D1–D6) confirmed against the current tree.

## Completeness

| Metric | Value |
|---|---|
| tasks.md checkbox items (sections 1–6, 7.1–7.4, 9.1–9.2) | all `[x]` (`rg '^\s*- \[ \]' tasks.md` → no matches) |
| Uncommitted local edit | `tasks.md` ticks for 7.2–7.4, 9.1, 9.2 — matches actual PR/issue state verified below |

## Build & Tests Execution

**Focused** (`node --test` on `lane/ship.test.mjs`, `lane/ship.integration.test.mjs`,
`memory/cli.ship.test.mjs`, `lib/credential-env.test.mjs`, `hooks/pre-push.test.mjs`):
`70 pass / 0 fail` (30 + 5 + 22 + 10 + 3).

**CI-parity re-run**, isolated identity (`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
HOME=$(mktemp -d)`), same five files: `70 pass / 0 fail`.

**Full suite** (`npm test`): `5027 pass / 0 fail / 0 todo`, duration ~24.0s.

**`check-refs.mjs`**: `✓ No prohibited references found.` / `✓ Artifact structure is valid.` (exit 0).

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Sequence + outcome shape (D1/D2) | full run populates shape | `ship.test.mjs` "full run" | ✅ COMPLIANT |
| Sequence + outcome shape | `commit:null` no-op | `ship.test.mjs` (A1's qualified `commit===null && ahead===0`) | ✅ COMPLIANT |
| Safe push, never forced (D2, ADR-0034 L9) | fast-forward succeeds, argv has `--no-verify` never `--force` | `ship.test.mjs` push-argv test | ✅ COMPLIANT |
| Safe push | diverged remote refused, zero port calls | `ship.integration.test.mjs` bare-remote divergence | ✅ COMPLIANT |
| Idempotent PR lookup/creation (D2) | first run creates PR | `ship.test.mjs` | ✅ COMPLIANT |
| Idempotent PR lookup/creation | re-run opens no 2nd PR, still arms | `ship.test.mjs` + `ship.integration.test.mjs` fast-forward re-run | ✅ COMPLIANT |
| PR grammar and target (D2, ADR-0034 L1) | title/body match spec's literal grammar verbatim | `ship.test.mjs` — asserts the **ticket's** grammar (task 0.1 delta), not spec.md's literal wording | ⚠️ PARTIAL (see WARNING 2) |
| PR number derived, never guessed (D2) | URL parse / `mrList` fallback / both-fail → `null`, arm skipped | `ship.test.mjs` (3 cases) | ✅ COMPLIANT |
| Tier-gated arm, refusals never fatal (D2, ADR-0034 L2) | `requiredReviews:0` arms; `:1` refusal reported, exit 0 | `ship.test.mjs` (+ every refusal reason: `requires-human-approval`, `unsupported`, `transport`) | ✅ COMPLIANT |
| Credential read once, threaded (D3, ADR-0033) | token present binds every call; absent → ambient | `ship.test.mjs` credential-threading test | ✅ COMPLIANT |
| `MEMORY_TOKEN_ENV` denylisted by default (D3) | leak regression, no `extra` arg needed | `credential-env.test.mjs` | ✅ COMPLIANT |
| `--dry-run` zero calls (D5) | zero `git`/`mrList`/`mrCreate`/`mrAutoMerge`, plan printed | `ship.test.mjs` dry-run test | ✅ COMPLIANT |
| CLI never throws, exit codes, i18n (D1) | success/no-op exit 0 `--json`; diverged/error exit 1, never throws | `cli.ship.test.mjs` | ✅ COMPLIANT |
| CLI never throws | blank `BRAIN_MEMORY_TOKEN` refused loudly, never reported bound | `cli.ship.test.mjs` (2 tests, `204b467d`) | ✅ COMPLIANT |
| Trigger/credential boundary (D4) | `pre-push` never invokes `ship`, behavioural | `pre-push.test.mjs` (`!ops.includes('ship')`) | ✅ COMPLIANT |
| Trigger/credential boundary | unattended host binds token, no ambient fallback | `ship.test.mjs` unattended-host test | ✅ COMPLIANT |
| Scope boundary — no gate/hook/port change (D6) | only the declared file list touched | `git diff --stat` (source inspection, below) | ✅ COMPLIANT |

**Compliance summary**: 16/17 scenario rows fully COMPLIANT with passing covering tests; 1 PARTIAL
(PR grammar — the covering test is green and the deviation is disclosed, but it proves the
**ticket's** grammar, not spec.md's own literal Requirement text — see WARNING 2).

## Correctness (Static + Runtime Evidence)

| Decision | Status | Evidence |
|---|---|---|
| D1 dispatch before backend selection | ✅ | `cli.mjs:129` (`"ship"` in `VALID_OPS`), `:446` dispatch block, `process.exit()` on every branch, never reaches `:736`'s `backendPath` resolution. `package.json:74` — `"memory:ship"`. |
| D2 full sequence | ✅ | `lane/ship.mjs` — `collect → surveyRef → push --no-verify origin ref:ref → findOrCreatePr (mrList/mrCreate) → mrAutoMerge(tierParams(tier).requiredReviews)`, exactly as `design.md` A1. `commit===null && ahead===0` is the qualified nothing-to-ship predicate (A1's refinement over D2's literal form, correctly implemented). |
| D2 push safety | ✅ | `rg "force\|'\+'" lane/ship.mjs` → zero matches (only a docstring word "force-push" inside an error message string, no argv/flag). |
| D3 credential threading | ✅ | `cli.mjs:461-478` — `MEMORY_TOKEN_ENV` read exactly once (`process.env[MEMORY_TOKEN_ENV]`), never read in `ship.mjs`; blank value refused before the ternary (`204b467d`); bound port passed to `shipLane`, never the token. |
| D3 denylist | ✅ | `credential-env.mjs:118,147` — `MEMORY_TOKEN_ENV` exported and in `credentialEnvNames()`'s default `names` array, no `extra` needed. |
| D4 no hook, no day:start, no settings.json | ✅ | `git diff --stat a9156d5f..HEAD -- '.claude/settings.json' '.gemini/settings.json'` → empty; `brain/scripts/hooks/` diff touches only `pre-push.test.mjs` (+10 lines, a pin); the only "SessionEnd"/"day:start" string in the diff is a **comment** stating the deferral, not code. |
| Test seam containment | ✅ | `resolveVcsTestModulePath()` (`cli.mjs`) constrains `BRAIN_VCS_TEST_MODULE` to resolve (via `realpathSync`, symlink-safe) inside `FIXTURE_ROOT` (`__fixtures__/`); blank value refused (L1); fixture module reads only `BRAIN_VCS_TEST_SCRIPT` (a JSON **data** path, `JSON.parse`d, never `import()`ed/`eval`ed) and never echoes parse-failure content (L2). |
| Test seam usage | ✅ | `cli.ship.test.mjs`'s `runCli()` sets `BRAIN_VCS_TEST_MODULE: FAKE_VCS_MODULE` on every call; source-guard test (`C1`) pins this and that `getVcs()` is gated behind the seam's absence. |
| `no-verify-bypass` exemption scope | ✅ | `check-refs-rules.mjs`'s `exempt` array adds only `lane/ship.mjs` and `lane/ship.test.mjs` for this change (plus `check-refs-rules.mjs` itself and pre-existing, unrelated entries). |
| D6 scope boundary | ✅ | `git diff --stat a9156d5f..HEAD` (excluding `openspec/`, `.memory/`) touches exactly: `ship.mjs`+test, `ship.integration.test.mjs`, `cli.mjs`, `cli.ship.test.mjs`, `__fixtures__/fake-vcs-port.mjs`, `credential-env.mjs`+test, `i18n/{en,es}.mjs`, `package.json`, `check-refs-rules.mjs` (the pre-authorized exemption). No `collect.mjs`/`plan.mjs`/`vcs/**`/`brain/core/**` touched. |
| Epic task 3.1b ticked | ✅ | `openspec/changes/issue-864-memory-2-0/tasks.md:38` — `[x] 3.1b`. |

## PR & Review Evidence

- `gh pr view 902 --json state,mergedAt,mergeCommit`: `MERGED`, `mergeCommit.oid: 16493771`, `mergedAt: 2026-09-10T11:58:09Z`.
- `gh pr view 903 --json state,mergedAt,mergeCommit`: `MERGED`, `mergeCommit.oid: 2d97cf61`, `mergedAt: 2026-09-10T13:10:23Z`.
- `gh api repos/csrinaldi/brain/pulls/902/reviews`: one `csrinaldibot` review, `verdict: APPROVE`, one `correction`-severity finding (`tier2-frontier` on `check-refs-rules.mjs`, plus a `judgment:cold-1` finding on the pre-fix diff-status bug, both already reflected as corrections landed before merge).
- `gh api repos/csrinaldi/brain/pulls/903/reviews`: one `csrinaldibot` review, `verdict: APPROVE`, one `correction`-severity finding (`judgment:cold-1` — the blank-`BRAIN_MEMORY_TOKEN` `identityBound` misreport) — this is exactly the finding fixed by the cherry-picked commit `204b467d` on top of the merge, confirmed present and green in this tree.
- Issue #901 (`gh issue view 901`): `state: CLOSED`, `closedAt: 2026-09-10T11:58:11Z` (auto-closed alongside PR #902's merge).
- Issue #888 (`gh issue view 888`): `state: CLOSED`, `closedAt: 2026-09-10T11:58:11Z` — see WARNING 1 below (closed manually, same second as PR #902/#901's merge, ~72 minutes before PR #903 — the PR that actually `Closes #888` and carries the CLI verb — merged).
- PR #903 body: contains the D4 trigger-wiring scope deviation, the PR-grammar reconciliation, the ADR-0034 Risk 5 statement, and the #805 auto-merge enablement gate — all four reconciliation items tasks.md section 9.1 required.
- `.memory/` scope: `git show --stat 16493771 -- .memory` → exactly `index.jsonl` + one record (`rec-bc8b2c1a93dee0f3`). `git show --stat 2d97cf61 -- .memory` → exactly `index.jsonl` + one record (`rec-b92ccb361910a065`).

## TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | ✅ | apply-progress (engram #3269) reports RED→GREEN per task across 6 batches, including the cold-review correction batches. |
| All tasks have tests | ✅ | Every implementation task (sections 2–6) is preceded by its RED task. |
| RED confirmed | ✅ | apply-progress documents RED states for tasks 2.1, 3.1, 4.1, 6.1, and the batch-6 blank-token fix (2 new tests failed against the unfixed code). |
| GREEN confirmed | ✅ | 70/70 focused (both normal and identity-isolated runs), 5027/5027 full suite, this verify pass. |
| Triangulation adequate | ✅ | `ship.test.mjs` covers full-run, no-op, recovery (`ahead:1`), diverged, idempotent re-run, `mrList` throw, 3 refusal reasons, 3 PR-number-derivation cases, credential-bound/unbound, dry-run, JSON-leak check — no single-case behaviors with multi-scenario specs. |
| Safety net for modified files | ✅ | Full `npm test` green after each commit per apply-progress; reconfirmed in this pass. |

**TDD Compliance**: 6/6 checks passed.

### Assertion Quality

No tautologies or ghost loops found in `ship.test.mjs`, `ship.integration.test.mjs`,
`cli.ship.test.mjs`, or `credential-env.test.mjs`. The no-force invariant is asserted structurally
(source-grep + argv inspection), not by a weaker proxy; the credential leak-regression test asserts
against the `JSON.stringify`d result object directly, not a mocked serializer.

**Assertion quality**: ✅ All assertions verify real behavior.

### Quality Metrics

**Linter**: not run — no linter invocation configured for this verify pass; no lint failures reported by apply-progress.
**Type Checker**: not applicable — plain `.mjs`, no TS build step.

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. **Issue #888 closed manually before the PR that actually implements it (`Closes #888`) merged.** GitHub's timeline shows `#888` closed at `2026-09-10T11:58:11Z` — the same second PR #902 (`Closes #901`, the library slice) merged — with `commit_id: null` (a manual close by `csrinaldi`, not an auto-close keyword; PR #902's body correctly says `Closes #901`, never `#888`). PR #903, the PR that carries the CLI `ship` op and whose body says `Closes #888`, did not merge until `2026-09-10T13:10:23Z`, ~72 minutes later. This is the identical failure mode flagged as WARNING 1 in `archive/887/verify-report.md` for the sibling change (#887/#901's own sub-ticket split) — the issue reads closed while the code it names still doesn't exist for over an hour. Functionally harmless now that PR #903 also merged and #888's final state is correct, but the pattern has now recurred across two consecutive lane-slice changes; worth a process note (e.g. never manually close a sub-ticket's parent issue until the closing PR itself has merged) rather than relying on each `sdd-verify` pass to catch it after the fact.
2. **`spec.md`'s own literal "PR grammar and target" Requirement text is not what the implementation does, and `spec.md` itself was never amended.** The Requirement says title and the body's first line must be "the SAME string," verbatim `Memory lane: <host> <date>`. The implementation (per `tasks.md` section 0.1's ticket reconciliation, ratified during apply) instead builds `title: "memory: <host> <date> (<n> records)"` — a different string that carries a record count the body's first line does not. The covering test (`ship.test.mjs`) asserts the **ticket's** grammar, not `spec.md`'s literal scenario text, and passes. The delta is disclosed in `tasks.md` section 0.1 and in PR #903's body (both correctly flagged for maintainer confirmation, and the PR merged), so this is a ratified, not silent, deviation — but `spec.md`'s Requirement/Scenario prose still describes the pre-ticket-reconciliation form. Recommend `sdd-archive` update `spec.md`'s "PR grammar and target" Requirement text to match the ticket's grammar (the form actually shipped and tested) so a future reader of the archived spec is not misled by prose the code no longer follows.

**SUGGESTION**:
1. Carry forward, not a gap of this change: the first real lane PR (which measures `gh pr merge --auto` on this repo for the first time) and re-arm stderr capture are named exit criteria of **#889**, per the ratified ruling D4 and design.md's own "Risks and residuals" table. `sdd-verify` for #889 should treat these as blocking that slice's own exit, not re-open them here.
2. `apply-progress`'s "Remaining tasks (after batch 6)" note lists `brain:review` and "any further PR #903 review rounds" as left for the orchestrator — both are now resolved (PR #903 merged with APPROVE, `204b467d` cherry-picked for the one correction) and can be dropped from any forward-looking note in the archive report.

## Verdict

**PASS WITH WARNINGS**

All 17 spec-derived requirement rows have passing covering tests (70/70 focused, reconfirmed 70/70
under CI-parity identity isolation); full suite 5027/5027 green; `check-refs.mjs` clean; every
tasks.md item `[x]`; D1–D6 confirmed by source inspection against the current tree, including the
`no-verify-bypass` exemption's narrow scope and the test seam's real-path containment; `.memory/`
scope minimal in both merge commits; epic task 3.1b ticked; the PR-body reconciliation (D4
deviation, PR-grammar delta, Risk 5, #805 gate) is present in PR #903 as tasks.md required. Zero
CRITICAL — nothing blocks archive. Two WARNINGs, both evidence/documentation gaps rather than code
defects: issue #888 was closed ~72 minutes before its own closing PR merged (a recurrence of the
same pattern #887's verify report flagged), and `spec.md`'s literal PR-grammar Requirement text
still describes the pre-reconciliation string even though the ratified, tested, and disclosed
implementation correctly follows the ticket's grammar instead — `sdd-archive` should carry both
forward and update `spec.md`'s prose.
