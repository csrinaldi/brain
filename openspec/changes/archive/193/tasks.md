# Tasks: CI Context Normalization (design-only, slice A0)

> **Status:** Design-only · Stops at checkpoint **CP-A0** for external review.
> This slice authors DOCS ONLY — no code in `ci-context.mjs`, no wrapper refactor
> (slice A1), no `.gitlab-ci.yml` / provider verbs (A2/A3).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Docs only (~well under 400) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single design MR, stops at CP-A0 |

Decision needed before apply: No

---

## Phase 1: Boundary design (design.md)

- [x] 1.1 Author `design.md` — `detectCi()` + `loadContext()` contracts, the CI→seam→evaluator shape
- [x] 1.2 Cite the exact GitHub-context source files/functions being EXTRACTED (not rewritten): `providers/github.mjs` `prView()` L126–139, `actor-check.mjs` L219–223, `brain-writes-reviewed.mjs` L213–216, `phase-order-check.mjs` L372–373, `run-check.mjs` L36–37
- [x] 1.3 Map GitLab sources (`CI_MERGE_REQUEST_*`, `CI_COMMIT_SHA`) + the one MR-description API call via `VCS_TOKEN`; state proxy is read from standard `HTTP(S)_PROXY`, never hard-coded
- [x] 1.4 State the central invariant — pure evaluators do NOT change — and tie it to ADR-0015's Epic Invariant (gates inspect evidence, never the producing tool)
- [x] 1.5 Specify the fail-closed (REQUIRED) / degrade-to-warn (DETECTION) policy by gate type

## Phase 2: Delta spec (specs/ci-context/spec.md)

- [x] 2.1 REQ-CIC-1 `detectCi()` provider resolution (github/gitlab/local/unknown)
- [x] 2.2 REQ-CIC-2 `loadContext()` per-provider field guarantees (`labels`/`body` never null; other fields value-or-null; never throws)
- [x] 2.3 REQ-CIC-3 missing-variable behavior by gate type (REQUIRED fail-closed, DETECTION warn+reason, never silent exit 0 in a required gate)
- [x] 2.4 REQ-CIC-4 pure evaluators unchanged, as a testable requirement
- [x] 2.5 REQ-CIC-5 GitLab MR description via one API call + env proxy

## Phase 3: ADR draft

- [x] 3.1 Draft `brain-drafts/adr-0016-ci-context-normalization.md` with the DRAFT status note; do NOT write to `brain/` (Tier-2 — a human promotes it later per the consolidation protocol / ADR-0015 L6)

## Phase 4: Config alignment (Deliverable 5 — ALREADY DONE by orchestrator)

- [x] 4.1 `brain.config.json` `governance.ignoreList` aligned with ADR-0014 by adding `.memory/**` (already applied by orchestrator; `diff-size-count.mjs` reads `config.governance.ignoreList` directly with no augmentation — verified L69). **No further config edit in A0 scope.**

## Deferred to later slices (NOT this MR)

- [ ] A1 — implement `ci-context.mjs`; rewire the five gate wrappers onto the seam; keep evaluators unchanged (REQ-CIC-4)
- [ ] A1 — add a drift-guard test asserting no gate reads `process.env.PR_*`/`BASE_SHA`/`HEAD_SHA` directly (open question)
- [ ] A2/A3 — `.gitlab-ci.yml`, GitLab provider verbs, `protectBranch` parity
- [ ] Follow-up — reconcile brain.config.json's `ignoreList` with its canonical migration default (lock files + `**/*.test.mjs` divergence — secondary drift, out of A0 scope)

---

## Closure Checklist (CP-A0)

- [x] C.1 All four artifacts authored: `proposal.md`, `design.md`, `specs/ci-context/spec.md`, `brain-drafts/adr-0016-*.md`
- [x] C.2 `tasks.md` has ≥1 checked item (L4 phase-order requirement)
- [x] C.3 ADR draft carries the DRAFT status note and does not touch `brain/`
- [x] C.4 No code written this slice; boundary only — ready for CP-A0 external review
