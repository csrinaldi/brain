# Tasks — CI Context Normalization Implementation (slice A1, issue #196)

---
status: applying
---

## Phase 1: `ci-context.mjs` core (REQ-CIC-1, REQ-CIC-2, amendment 1)

- [x] 1.1 Implement `detectCi()` with strict `github → gitlab → unknown → local`
  precedence, injectable `env` seam.
- [x] 1.2 Implement `loadContext()` GitHub branch: `prNumber`, `baseSha`, `headSha`,
  `sourceBranch`, `targetBranch`, `repo`, `isMergeRequest`, plus `labels`/`body`/`author`
  via `prView()` (single call).
- [x] 1.3 Implement `loadContext()` GitLab branch: env-mapped fields + `repo` +
  single MR API call for `labels`/`body`/`author` (REQ-CIC-5).
- [x] 1.4 `resolveDetectionBody()` — PR_BODY binary policy helper (amendment 2).
- [x] 1.5 RED→GREEN unit tests for all of the above (`ci-context.test.mjs`).

## Phase 2: `providers/github.mjs` — `prView()` extraction fix (Decision 2 exception)

- [x] 2.1 Add `author` to the `gh pr view --json` fields.
- [x] 2.2 Change failure/malformed-JSON returns to `{ labels: null, body: null, author: null }`.
- [x] 2.3 Update `providers.test.mjs` fixtures for the new null-on-failure contract.

## Phase 3: Rewire the 4 wrappers onto `ctx.*`

- [x] 3.1 `governance/run-check.mjs` — `ctx.baseSha`/`ctx.headSha` via `deps.ctx`.
- [x] 3.2 `vcs/actor-check.mjs` — `ctx.author`/`ctx.repo`/`ctx.targetBranch`, body via
  `resolveDetectionBody()`.
- [x] 3.3 `vcs/brain-writes-reviewed.mjs` — `ctx.baseSha/headSha/prNumber/repo/author`,
  `ctx.labels` replaces `PR_LABELS` env parsing.
- [x] 3.4 `vcs/phase-order-check.mjs` — `ctx.baseSha`/`ctx.headSha`.
- [x] 3.5 Each wrapper's CLI entrypoint calls `loadContext()` and passes `{ ctx }`.
- [x] 3.6 Existing sync test suites for all 4 wrappers pass unmodified (precedence:
  `deps.X` still wins over `deps.ctx.X`).

## Phase 4: Drift guard + REQ-CIC-4 proof

- [x] 4.1 Drift-guard test: no gate wrapper reads a pipeline env var directly — only
  `ci-context.mjs` may (no exemptions).
- [x] 4.2 REQ-CIC-4 file-assertion: the 4 generic evaluators don't import `ci-context.mjs`.
- [x] 4.3 REQ-CIC-4 file-assertion: `evaluateActor`/`evaluateBrainWritesReviewed`/
  `evaluatePhaseOrder` function bodies don't reference the seam.

## Phase 5: Config + audit fix-at-source

- [x] 5.1 `brain.config.json`: add the 3 lockfile globs to `governance.ignoreList`
  (ruling 3a, no `decision` label).
- [x] 5.2 `brain-audit.mjs`/`audit-helpers.mjs`: stop collapsing `pr.labels`/`pr.body`
  null back to `[]`/`''` before the pure helpers see it.
- [x] 5.3 Test the audit path (source-scan proving the fabricated defaults are gone).

## Phase 6: Piggyback draft

- [x] 6.1 Draft the `docs/inbox/**` zone-map row for
  `consolidation-protocol.md §3` in `brain-drafts/` (human-promoted).

## Phase 7: Verification

- [x] 7.1 Full `npm test` green.
- [x] 7.2 `brain:repo:check` green.
- [x] 7.3 `brain:nav` — pre-existing unrelated breakage from a prior commit
  (`adr-0016-ci-context-normalization.md` broken relative links) noted as a blocker
  out of this slice's scope (Tier-2 file, not touched by A1).
