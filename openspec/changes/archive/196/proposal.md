# Proposal — CI Context Normalization Implementation (slice A1, issue #196)

> **Status:** Implementation · Implements the CP-A0-APPROVED contract from
> [issue-193-ci-context-design](../issue-193-ci-context-design/design.md) and
> [its spec](../issue-193-ci-context-design/specs/ci-context/spec.md) (REQ-CIC-1..5).
> **Relates to:** [ADR-0016](../../../brain/project/decisions/adr-0016-ci-context-normalization.md)
> (Accepted), [ADR-0015](../../../brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md),
> [ADR-0014](../../../brain/project/decisions/adr-0014-workflow-governance.md),
> [ADR-0009](../../../brain/project/decisions/adr-0009-documentation-language-policy.md).

## Context

Slice A0 fixed the boundary of `brain/scripts/vcs/ci-context.mjs` without writing code.
This slice (A1) builds the module and rewires the five existing GitHub context readers
onto it, per the CP-A1 ruling that folded three amendments into the A0 contract (see
`design.md`).

## What this slice builds

1. `brain/scripts/vcs/ci-context.mjs` — `detectCi()` + `loadContext()` per REQ-CIC-1/2,
   plus the `repo` field (amendment 1: GitHub `GITHUB_REPOSITORY`, GitLab
   `CI_PROJECT_PATH`).
2. Refactors the 5 readers (`providers/github.mjs` `prView()`, `run-check.mjs`,
   `actor-check.mjs`, `brain-writes-reviewed.mjs`, `phase-order-check.mjs`) onto the
   seam — extract, don't rewrite, except the deliberate `null`-vs-`[]`/`''`
   correction already specified in A0.
3. A drift-guard test (CP-A0 ruling 2) asserting no gate reads pipeline env directly.
4. `brain.config.json` lockfile-glob alignment (ruling 3a — no `decision` label).
5. The PR_BODY binary policy (amendment 2): `body` is API-primary; REQUIRED consumers
   fail closed on `null` and never read `PR_BODY`; `resolveDetectionBody()` is the only
   sanctioned DETECTION-consumer fallback.
6. The `prView()` fix-at-source disposition: `brain-audit.mjs`/`audit-helpers.mjs` no
   longer collapse a null `pr.labels`/`pr.body` back into a fabricated `[]`/`''`.
7. Amendment 3 (DETECTION two-case rule) recorded in `design.md`, grounded in the
   existing `actor-check.mjs` warn/fail precedent.

## Out of scope

- GitLab CI wiring beyond `loadContext()`'s GitLab branch (no `.gitlab-ci.yml`, no
  `protectBranch` parity) — later slices.
- Any change to the pure evaluators (`evaluateActor`, `evaluatePhaseOrder`,
  `adrPresence`, `memoryPresence`, `diffSize`, `issueLink`) — REQ-CIC-4 forbids it.
- Promoting the `docs/inbox/**` zone-map row into
  `brain/core/methodology/consolidation-protocol.md` — drafted here for human
  promotion only (Tier-2, agents never write `brain/core/**`).

## Acceptance criteria

- [x] `ci-context.mjs` implements `detectCi()`/`loadContext()`/`resolveDetectionBody()`
  per REQ-CIC-1, REQ-CIC-2, REQ-CIC-5, and the delta spec in this change.
- [x] The 5 readers are refactored onto `ctx.*`; no pure evaluator changed
  (REQ-CIC-4 file-assertion proof).
- [x] A drift-guard test enforces "only `ci-context.mjs` reads pipeline env" with no
  exemptions.
- [x] `brain.config.json` carries the 3 lockfile globs.
- [x] `npm test` is green; `brain:repo:check` and `brain:nav` are unaffected by this
  slice's changes.
