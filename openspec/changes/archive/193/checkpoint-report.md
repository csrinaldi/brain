# Checkpoint Report — CP-A0

> **Change:** `issue-193-ci-context-design` · **Slice:** A0 (design-only) · **Branch:** `feat/issue-193-ci-context-design`
> **Plan:** Adapter & Gap Completion Plan v3 — Track A, Wave 1.
> **Status: CP-A0 APPROVED (Rev 2) — checkpoint CLOSED, no Rev 3.** Editorial residuals R1/R2 applied (verified as evidence at CP-A1, not re-reviewed). A1 authorized — see §13.
> **CP-A0 verdict history:** Rev 0 → `REVISE` (show the boundary). Rev 1 → `REVISE` (architecture **APPROVED**; 4 contract corrections). Rev 2 → **APPROVE** + R1/R2 editorial closeout. See §12–§13.
> **Verdict requested:** validate the context-normalization **boundary** (the seam between CI env and the gates), reading the full artifact content delivered alongside this report. This slice writes NO code.

---

## 1. What was produced (CP-A0 evidence)

| Artifact | Lines | Notes |
|---|---|---|
| `proposal.md` | 99 | A0 slice intent, scope, acceptance |
| `design.md` | 235 | The boundary: `detectCi()` / `loadContext()`, GitHub extraction citations, GitLab source map, by-gate-type degrade policy, "evaluators unchanged" invariant |
| `specs/ci-context/spec.md` | 222 | Delta spec REQ-CIC-1..5 with GIVEN/WHEN/THEN scenarios |
| `tasks.md` | 58 | Design tasks — **16 checked** (satisfies L4 ≥1-checked) |
| `brain-drafts/adr-0016-ci-context-normalization.md` | 131 | ADR **DRAFT** — carries STATUS note, lives in `brain-drafts/`, **not** promoted to `brain/` (human promotes per Tier-2 / L6 / ADR-0013) |

- **No implementation code.** `brain/scripts/vcs/ci-context.mjs` was NOT created — it is designed here, built in A1.
- **`brain/` untouched.** `git status` shows zero writes under `brain/`.
- **Deliverable 5 (config/ADR drift fix):** `brain.config.json` `governance.ignoreList` `+ ".memory/**"` — a 1-line alignment with an already-accepted decision (ADR-0014), **not** a new decision → no `decision` label, no new ADR.

## 2. Diffstat

| Component | Lines | Counts toward 400 budget? |
|---|---|---|
| `brain.config.json` (deliverable 5) | +1 | ✅ **1 / 400** |
| Change-dir artifacts (`openspec/changes/**`) | 745 | ❌ in `governance.ignoreList` |
| `.memory/manifest.json` (day-start delta) | +8 | ❌ in `governance.ignoreList` (after deliverable 5) |

**Effective budget-counted diff = 1 line.**

## 3. Baseline — verbatim

```
# tests 822
# pass 822
# fail 0
# duration_ms ~2181
```
`brain:repo:check` → `✓ No prohibited references found. ✓ Artifact structure is valid.`
`brain:nav` → `✓ Navegación de brain/ íntegra: sin huérfanos, sin links rotos.`

## 4. Gate pre-flight (would this MR pass its own gates?)

| Gate | Class | Verdict | Basis |
|---|---|---|---|
| `phase-order` | DETECTION (L4) | **PASS** | `phase-order-check.mjs` `hasNestedSpec()` L282-293 + L327-328 accept `specs/ci-context/spec.md`; `tasks.md` has 16 `[x]` (Rule C skips); proposal+spec+design+tasks all present |
| `issue-link` | REQUIRED | **PASS** | #193 is `status:approved`, OPEN |
| `diff-size` | REQUIRED | **PASS (conditional)** | 1/400 — **provided `docs/inbox/PLAN-adapters-v3.md` is excluded from the commit** (see §7) |
| `decision-gate` | REQUIRED | **PASS** | ADR is a draft in `brain-drafts/` (no `brain/project/decisions/adr-*.md` match); `brain/HOME.md` untouched; no `decision` label |
| `memory-gate` | REQUIRED | **PASS on push** | satisfied via `memory:share` before push; `.memory/` already shows a delta |
| `brain-writes-reviewed` | DETECTION (L6) | **PASS** | `brain.config.json` is repo-root, not `brain/core|project/` |
| `actor-check` | DETECTION (L5) | **WARN (non-blocking)** | issue author = approver = `csrinaldi` (solo maintainer) — DETECTION, warns only |

## 5. Adversarial review (fresh context) — run before this checkpoint

Verdict was **"not ready as-is"**; all findings fixed:
- **MAJOR** — `design.md`/`spec.md`/`adr-0016` quoted a 4-item `REQUIRED_JOBS` as "verbatim" — the live constant (`governance-checks.mjs:27`) has **5** (adds `local-checks`). Corrected in all three; noted `local-checks` is REQUIRED but not a ci-context consumer.
- **MAJOR** — commit hygiene: stray 518-line `PLAN-adapters-v3.md` would trip `diff-size` if committed → §7.
- **MINOR** — `sourceBranch` / `isMergeRequest` had no pinned GitHub source → added `GITHUB_HEAD_REF` / `GITHUB_EVENT_NAME` (flagged net-new, not extractions).
- **NIT ×2** — off-by-one citations corrected.

Confirmed clean by the review: fail-closed-by-gate-type policy accurate; extraction citations accurate; spec requirements testable; ADR draft placement/status correct; boundary correctly scopes out gate-specific label-history queries.

## 6. Drift findings surfaced during design (dispositioned by CP-A0 rulings)

1. **`brain.config.json` ignoreList drifted BELOW its own consumer default** (`config-migrations.mjs` L52-60 already ships `.memory/**` + lockfiles). Deliverable 5 fixed `.memory/**`. **Ruling 3 splits the remainder:**
   - **(a) Lockfile globs** — alignment with the shipped default (same nature as Deliverable 5): **folded into A1**, no `decision` label.
   - **(b) `**/*.test.mjs`** — a **policy** decision, not the agent's: **its own micro-slice** with a `decision` label + an ADR-0014 amendment, on human approval. Registered as an **intentional divergence** until then.
2. **ADR-0015.md L74 is stale** (`REQUIRED_JOBS` shows 4; live `governance-checks.mjs:27` has 5 incl. `local-checks`). **Ruling 4: do NOT touch** — it is a write into `brain/`, a human correction. **Suggested fix: in the same human MR that promotes ADR-0016** to `brain/project/decisions/`.

## 7. Commit hygiene (CP-A0 ruling 5 — confirmed)

`docs/inbox/PLAN-adapters-v3.md` (untracked, 518 lines) **stays untracked — not committed.** The eventual commit includes **only** the change-dir artifacts + the 1-line `brain.config.json` + `.memory/**`. The membership of `docs/inbox/**` in `governance.ignoreList` is **not decided here** — it is argued and drafted inside **A1's `consolidation-protocol.md §3` zone-map row** (the agent argues the inclusion in the draft; the human signs).

## 8. Open questions — dispositioned by CP-A0 rulings

- [x] **`author` source (ruling 1) — RESOLVED.** API payload (`author.login` / `author.username`) in both providers, never env. Applied to design.md (Decision 2/3/4), spec.md (REQ-CIC-2 + REQ-CIC-5 + new scenario), adr-0016 (Decision + Never-do) in Rev 1.
- [ ] **Drift-guard test (ruling 2) — APPROVED for A1.** A1 asserts no gate reads `process.env` pipeline context directly (all context via `ci-context.mjs`).
- [ ] **`brain.config.json` reconciliation (ruling 3) — SPLIT.** (a) lockfiles → A1, no label; (b) `**/*.test.mjs` → own `decision`-labeled micro-slice + ADR-0014 amendment, human-approved; intentional divergence meanwhile.
- [ ] **ADR-0015.md L74 doc-drift (Rev 1 ruling 4) — human-only.** Fix suggested in the same human MR that promotes ADR-0016.
- [ ] **`baseSha` semantics parity (Rev 2 ruling 4) — verify in A1.** Confirm on a real pipeline that GitHub `BASE_SHA` and GitLab `CI_MERGE_REQUEST_DIFF_BASE_SHA` compute the diff against the same base (`diff-size` is REQUIRED, so divergence = different budgets per provider).

## 9. PLAN-DEVIATIONs

- **Minor (naming):** the human framed this effort as `v2.0.0`; the plan is titled *v3* and §9 says alias removal is "v1.0 major housekeeping." No conflict with any ADR/spec — release naming vs work content.
- **Minor (CP-A0 evidence scope):** the plan's CP-A0 lists "ADR draft + design.md". This slice ALSO ships `spec.md` + `tasks.md` because L4 phase-order requires them (folded into the approved issue #193 acceptance). Not a deviation from the issue; a deliberate expansion beyond the plan's literal CP-A0 list.

**Both PLAN-DEVIATIONs accepted by the CP-A0 reviewer.**

## 10. Proposed next slice — A1 (scope confirmed/expanded by CP-A0 rulings)

Implement `ci-context.mjs` + refactor the 5 GitHub wrappers onto it (no behavior change on GitHub; existing workflow tests stay green). Unit tests: fixture env-sets for both providers incl. missing-variable degradation per gate class, and **`author` sourced from the API payload, never env** (ruling 1). Now also in A1 scope:
- **Drift-guard test** — no gate reads `process.env` pipeline context directly (ruling 2).
- **Lockfile-glob alignment** of `brain.config.json` with `config-migrations.mjs`, no `decision` label (ruling 3a).
- **Piggyback:** draft the `docs/inbox/**` zone-map row for `consolidation-protocol.md §3`, arguing its `ignoreList` membership (ruling 5).

## 11. Canonical-layout tolerance note (CP-A0 ruling 6 — affects B0, not A0)

This slice placed its delta spec at `specs/ci-context/spec.md` (nested) where issue #193 said `spec.md` (flat), and it **passed L4 because `phase-order-check.mjs` already tolerates both** — `hasNestedSpec()` (L282-293) + `buildChangeDir()` (L327-328) accept `specs/*/spec.md` OR a flat `spec.md`. **That tolerance exists in code but is written nowhere.** Recorded per ruling 6: **B0 (`sdd-layout.md`, the canonical evidence contract) MUST document this tolerance as part of the contract.** An unwritten tolerance is the *same class of drift* this slice corrected in `governance.ignoreList` (config diverged from ADR-0014) — the fix is to make the implicit standard explicit before Track B's second harness relies on it.

## 12. Revision log

- **Rev 0** → CP-A0 verdict: **REVISE.** Show the boundary (full artifact content), not only describe it; plus rulings 1–6.
- **Rev 1** (this report):
  - **Ruling 1 applied** — `author` sourced from the PR/MR API payload in both providers (design.md Decision 2/3/4, spec.md REQ-CIC-2 + REQ-CIC-5 + new scenario, adr-0016 Decision + Never-do).
  - **Rulings 2, 3, 4, 5, 6 recorded** (§6, §7, §8, §10, §11).
  - **Both §9 PLAN-DEVIATIONs accepted.**
  - Full content of `design.md` + `spec.md` + `adr-0016` delivered for external review.
- **Rev 2** (this report) — boundary architecture **APPROVED** by Rev 1; four scoped contract corrections applied (only these diffs):
  1. **`labels` / `body` nullability (MAJOR).** Both are now value-or-`null`: `null` = uncomputable (fetch failed), `[]` / `''` = genuinely empty. REQUIRED consumers (`issue-link` on `body`; `diff-size` / `memory-gate` / `decision-gate` on `labels`) **fail closed on `null`**. Documented as THE deliberate exception to "extract, don't rewrite" — `prView()`'s `[]`/`''`-on-failure was a pre-existing latent fail-open. (design.md Dec 2/4, spec REQ-CIC-2/3/5 + new scenarios, adr-0016 Decision + Consequences.)
  2. **GitLab `labels` source.** Primary = the single MR API call's live payload (with `author`/`body`), not the frozen `CI_MERGE_REQUEST_LABELS`; fetch failure → `null`, **no** stale fallback.
  3. **`detectCi()` `'unknown'` pinned** to `CI === 'true'` without `GITHUB_ACTIONS`/`GITLAB_CI` — now testable (spec REQ-CIC-1 scenario).
  4. **`baseSha` semantics pinned** in spec REQ-CIC-2 ("the commit the diff is computed against"); A1 open question added to verify `BASE_SHA` ≡ `CI_MERGE_REQUEST_DIFF_BASE_SHA` on a real pipeline.
  - Everything else in the artifacts is unchanged and pre-approved.

---

## 13. CP-A0 closeout + A1 authorization

**Editorial residuals applied (verified at CP-A1, not re-reviewed):**
- **R1** — ADR-0016 Decision: removed `CI_MERGE_REQUEST_LABELS` from the GitLab mapped-env list (it rides the single MR API call); the promoted artifact now has zero internal contradiction.
- **R2** — design Decision 1 + REQ-CIC-1: declared strict precedence `github → gitlab → unknown → local` (`'unknown'` evaluated BEFORE `'local'`), so a generic `CI=true` in a git repo resolves to `'unknown'`.

**A1 authorized — confirmed scope:**
- `ci-context.mjs` + refactor of the 5 GitHub wrappers (evaluators intact — REQ-CIC-4 with a file assertion; fail-closed-on-`null` lives in the wrappers).
- Per-provider fixture tests incl. gate-class degradation + the new `null` vs `[]` / `''` scenarios.
- Drift-guard: no gate reads `process.env` pipeline context directly (Rev 1 ruling 2).
- Lockfile-glob alignment in `brain.config.json`, no `decision` label (Rev 1 ruling 3a).
- Piggyback: draft the `docs/inbox/**` zone-map row (Rev 1 ruling 5).
- **NEW disposition (1 line in design):** GitHub `PR_BODY` env fallback — same frozen nature as `CI_MERGE_REQUEST_LABELS`; asymmetry with the GitLab no-fallback rule on a field `issue-link` (REQUIRED) consumes. Decide: DETECTION-only fallback with `null` for REQUIRED, OR accepted fallback with a documented fail-direction analysis.
- **NEW disposition:** inventory remaining `prView()` legacy consumers (`[]` / `''` on failure) and dispose (deprecate or fix at source) — the fail-open must not survive on a path parallel to the seam.

**CP-A1 evidence:** diffstat, verbatim test output, proof GitHub workflows unchanged in behavior, R1/R2 verified, the zone-map draft, and the two dispositions (PR_BODY, legacy `prView`). Delivered as uploadable files.

**Anti-pattern:** "empty-on-failure default in evidence readers = fail-open in REQUIRED gates" kept as a memory candidate (id 351) for human promotion alongside ADR-0016.

---

**CP-A0 is CLOSED (APPROVE). A1 is authorized; work proceeds toward CP-A1.**
