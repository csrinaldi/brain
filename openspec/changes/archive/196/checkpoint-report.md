# Checkpoint Report — CP-A1

> **Change:** `issue-196-ci-context-impl` · **Slice:** A1 (implementation) · **Branch:** `feat/issue-196-ci-context-impl` (base `feature/v2.0.0` @ `04ae992`)
> **Issue:** #196 (`status:approved`). **Depends on:** #193 (A0, merged to the tracker).
> **Status: STOPPED at CP-A1 — Revision 2 (post-REVISE).** Working tree only, no PR, nothing pushed. `brain:nav` is now GREEN (human fixed adr-0016 on the tracker via #198/#199; branch synced to `04ae992`). Awaiting the external Rev 2 verdict.
> **CP-A1 verdict history:** Rev 1 → REVISE (BLOCKER real & well-caught, but the chosen fix — a `PR_AUTHOR` fallback — contradicted the **accepted** ADR-0016 Never-do #3). Rev 2 substitutes the fix per the ruling. The Rev 2 review is scoped to the point-1 diff (governance.yml + ci-context.mjs + tests) + the point-2 comment.
> **Verdict requested:** validate the Rev 2 substitution — author now sourced from the API via a job-provided `PR_NUMBER`, no env fallback, honoring the accepted ADR.

---

## 1. What was built

`brain/scripts/vcs/ci-context.mjs` (new, 199 lines) — `detectCi()` + `loadContext()` + `resolveDetectionBody()`, implementing REQ-CIC-1..5 plus the `repo` field. The 5 GitHub readers refactored onto the seam; the `prView` fail-open fixed at source; the actor-check job gets `PR_NUMBER` (Rev 2); config lockfile alignment; SDD scaffold + a zone-map draft.

## 2. Files changed (working tree, uncommitted)

**Production (counted 356/400):**
| File | Change |
|---|---|
| `brain/scripts/vcs/ci-context.mjs` | NEW — the seam (199 lines) |
| `.github/workflows/governance.yml` | actor-check job: `+PR_NUMBER`, `−PR_AUTHOR` (Rev 2) |
| `brain/scripts/vcs/providers/github.mjs` | `prView` gains `author`; returns `null` (not `[]`/`''`) on failure |
| `brain/scripts/governance/run-check.mjs` | reads `ctx.baseSha/headSha` |
| `brain/scripts/vcs/actor-check.mjs` | `ctx.author/repo/targetBranch`, body via `resolveDetectionBody()` |
| `brain/scripts/vcs/brain-writes-reviewed.mjs` | `ctx.baseSha/headSha/prNumber/repo/author/labels` |
| `brain/scripts/vcs/phase-order-check.mjs` | `ctx.baseSha/headSha` |
| `brain/scripts/brain-audit.mjs` | stops collapsing `prView`'s `null` back to `[]`/`''` (fail-open killed at source) |
| `brain.config.json` | ignoreList += 3 lockfile globs |

**Tests (excluded from budget):** new `ci-context.test.mjs`, `ci-context-drift-guard.test.mjs`, `governance-ignorelist.test.mjs`; updated `providers.test.mjs`, `run-check.test.mjs`, `actor-check.test.mjs`, `brain-writes-reviewed.test.mjs`, `phase-order-check.test.mjs`, `brain-audit.test.mjs`.

**OpenSpec (excluded):** `openspec/changes/issue-196-ci-context-impl/{proposal,design,tasks}.md`, `specs/ci-context/spec.md`, `brain-drafts/consolidation-protocol-zone-map-docs-inbox.md`, this report.

## 3. Budget

**356 / 400** counted (157 modified — incl. `governance.yml` +4/−1 — plus 199 new `ci-context.mjs`; `*.test.mjs`, `openspec/changes/**`, `.memory/**`, lockfiles all excluded). **No split needed.** `docs/inbox/PLAN-adapters-v3.md` stays untracked (commit hygiene, R5).

## 4. Tests — verbatim

```
# tests 871
# pass 871
# fail 0
```
`brain:repo:check` → clean. `brain:nav` → green (adr-0016 fixed on the tracker).

Every unit was written **RED then GREEN** (strict TDD): ci-context (incl. the Rev 2 no-fallback test), prView, the 4 wrappers, brain-audit, drift-guard + REQ-CIC-4 + the Rev 2 CI-wiring test, ignoreList.

## 5. Adversarial review (fresh context) — run before this checkpoint

Verdict was **"not ready — fix the BLOCKER first."** All findings addressed:

- **BLOCKER (fixed — Rev 2)** — the refactor moved `actor-check`'s `author` from `process.env.PR_AUTHOR` (which the actor-check job sets) to `ctx.author` (populated only via `prView`, which needs `PR_NUMBER` — a var that job does NOT set). Effect: L5 self-approval detection would silently **no-op on every GitHub PR** — invisible to the injected-`ctx` tests. **Rev 1 fix (REJECTED by the reviewer):** a `PR_AUTHOR` fallback in `ci-context.mjs` — it contradicts the accepted ADR-0016 Never-do #3 ("never the author from env"); overriding accepted doctrine in code is the drift the system fights. **Rev 2 fix (accepted path):** `governance.yml`'s actor-check job now sets `PR_NUMBER` (it already carries `GH_TOKEN`) so `prView` supplies the author from the API as the ADR mandates; the fallback is removed; the drift-guard covers `PR_AUTHOR` again with no exception; a new **CI-wiring test** asserts the job provides `PR_NUMBER` and does NOT set `PR_AUTHOR`.
- **MINOR (fixed)** — drift-guard pattern was incomplete: it missed `GITHUB_ACTOR` (the exact trigger-vs-author confusion ruling 1 exists to prevent), `GITHUB_SHA/BASE_REF/REF`, `CI_COMMIT_*`, `CI_API_V4_URL`, and `GATE_FILES` omitted `brain-audit.mjs`. **Widened the pattern + added `brain-audit.mjs`; guard passes (no gate reads the newly-covered vars).**
- **NIT (fixed)** — non-numeric `PR_NUMBER` → `NaN` reached `prView`. Added an integer guard.
- **MINOR (noted, not changed)** — `brain-writes-reviewed`'s job now gets author/labels from a live `gh pr view` (it sets `PR_NUMBER`), so its `PR_AUTHOR`/`PR_LABELS` env vars are redundant fallbacks (harmless; a governance.yml cleanup for A2, not this slice).
- **Residual (accepted)** — GitLab proxy: `undici`/`ProxyAgent` degrades silently in this zero-dep repo; a proxy-mandatory fetch then fails → fields `null` (fail-safe, warn for detection). GitLab isn't live until A2. Noted for the A2 tracker.

### Verified SOLID by the review (evidence)
- **REQUIRED gates fail closed on `null` end to end** — `run-check.mjs` awaits `loadContext()`, `defaultDiffNameOnly` throws on falsy base/head, `runCheck` catches → `{ pass:false, reason:'cannot compute diff — failing closed' }` → exit 1. A `null` never collapses to `[]`/`''` and passes.
- **`loadContext()` never throws** (try/catch around prView + whole dispatch → `emptyContext`), so the entrypoint `await` cannot crash a gate.
- **REQ-CIC-4** — `diff-size.mjs` / `issue-link.mjs` untouched; `evaluateActor`/`evaluatePhaseOrder`/`evaluateBrainWritesReviewed` bodies untouched (only imports + thin wrappers + CLI entrypoints changed). Drift-guard proves it.
- **`brain-audit` null-safe & behavior-identical**; **`prView` fix-at-source correct**; **detectCi precedence correct**; **PR_BODY binary split enforced in code** (issue-link never reads `PR_BODY`).

## 6. The four amendments (recorded in design.md + spec.md, not code-only)
1. **`repo` field** added to `loadContext()` (GitHub `GITHUB_REPOSITORY` / GitLab `CI_PROJECT_PATH`) — closes the last direct-env read so the drift-guard needs no exemption.
2. **PR_BODY binary policy** — body from API; REQUIRED (issue-link) fails closed on null, never reads `PR_BODY`; `PR_BODY` is a DETECTION-only fallback.
3. **DETECTION two-case rule** — uncomputable context → warn+exit 0; real finding → visible fail (non-zero) + non-required. (A2 ports this per case into GitLab `allow_failure`.)
4. **actor-check gets `PR_NUMBER`** (the BLOCKER fix, §5) — author from the API, no env fallback (ADR-0016 Never-do #3 honored).

## 7. Pre-existing blocker (needs a HUMAN fix — not A1)
`brain:nav` is **RED**: 4 broken relative links in `brain/project/decisions/adr-0016-ci-context-normalization.md`, introduced by the promotion commit `cd572a3` (PR #197) **before A1**. The promoted ADR kept the draft's `../../../../brain/project/decisions/adr-XXXX.md` paths; now that it lives in `brain/project/decisions/`, they must be sibling `adr-XXXX.md`. It is a **Tier-2 (`brain/`) file — the agent must not edit it**. **A1 touched zero `brain/` files (verified).** Human fix (4 links, drop the `../../../../brain/project/decisions/` prefix) on `feature/v2.0.0`, then `brain:nav` goes green and `local-checks` passes on the A1 PR.

## 8. Substrate — public repo (CP-A1 evidence, ruling 1 of the context updates)
`brain:governance-status` now reports **`platform available (branch protection APIs accessible)`** — the rung-1 gap cited in #194's pre-flight ("403 private free-tier") is **gone**. Active rung is still **2** (release/tag audit) because branch protection is not *activated* (remedy: `brain:protect`, human). `substrate.mjs` detection updated correctly for public — **no stale-detection bug**. Not touched in A1.

## 9. Convention asserted for slice PRs (CP-A1 evidence)
Verified against the evaluator `brain/scripts/governance/checks/issue-link.mjs` (`CHAIN_RE = /\bpart\s+of\s+#\d+/i`, L12) + `governance.yml` (base != main): slice PRs into `feature/v2.0.0` use **`Part of #196`** (chain ref, does not close the issue); `Closes #N` is reserved for the final integration PR to `main`. The A1 PR will use `Part of #196`.

## 10. Next steps (after verdict)
1. Human fixes the `adr-0016` links on `feature/v2.0.0` → `brain:nav` green.
2. External CP-A1 verdict on this report + the evidence bundle.
3. On approve: `memory:share`, commit, push, open PR (`Part of #196`, base `feature/v2.0.0`, no `decision` label), hand to the human to merge.

## 11. Rev 2 revision log + rulings recorded

**Rev 1 → REVISE. Rev 2 changes (scope: the point-1 diff + the point-2 comment):**
1. **Author fix substituted (point 1).** Removed the `PR_AUTHOR` fallback from `ci-context.mjs`; added `PR_NUMBER` to the actor-check job in `governance.yml` so the author comes from the `prView` API (ADR-0016 Never-do #3). A new wiring test guards the YAML; the no-fallback test guards the code. Budget: +1 YAML line, −the fallback.
2. **`brain-writes-reviewed` `ctx.labels ?? []` (point 2)** — added a one-line comment: collapsing null→`[]` here is the SAFE/stricter direction for this DETECTION gate (no labels ⇒ no admin-override), not the empty-on-failure anti-pattern.
3. **Doctrine correction recorded (point 3, origin: reviewer Rev 2 ruling).** The A0 REQ-CIC-3 scenario naming `decision-gate` as a *labels* consumer is INCORRECT — `adrPresence` (decision-gate) is **file-based** (confirmed in #198). The real labels consumers are on the audit path (`shouldSkipSize` / `selectIssueLinkBody` in `brain-audit`), where the A1 fix correctly landed. Spec-wording fix, applied at A0-spec consolidation; **no code impact**. (The A1 artifacts never named decision-gate as a labels consumer — verified.)
4. **GitLab proxy residual (point 4)** — accepted, moved to the A2 tracker: the consumer's GitLab is internal / `NO_PROXY`; the proxy matters only for external calls. `ci-context.mjs` reads `HTTP(S)_PROXY` correctly and never hard-codes a host.

**Governance lesson (saved to memory):** a correct re-derivation does not license overriding an *accepted* ADR in code. If the doctrine is wrong, amend the ADR with a human signature; otherwise obey it. Rev 1's `PR_AUTHOR` fallback was the exact drift the system exists to catch.

---

**Awaiting the external CP-A1 Rev 2 verdict. No PR opened, nothing pushed. `brain:nav` green.**
