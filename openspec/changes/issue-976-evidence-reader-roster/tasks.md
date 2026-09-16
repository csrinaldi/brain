# Tasks — issue #976

## Review Workload Forecast
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No
- Estimated changed lines: ~1 new draft file (~90 lines) plus SDD docs
  (`proposal.md`, `spec.md`, `tasks.md`, `apply-progress.md`); no production
  code changes. No edits to `brain/core/**`, `brain/project/**`,
  `brain/HOME.md`, or `AGENTS.md`.

## Phase 1: Move and update the draft

- [x] 1.1 Create `openspec/changes/issue-976-evidence-reader-roster/` with
      `brain-drafts/`.
- [x] 1.2 Copy `deny-readers-roster-sixth.draft.md` from
      `openspec/changes/issue-962-release-gate-deny-reader/brain-drafts/`
      into the new folder. Set the contract's `issue:` to `976`. Rewrite the
      preamble so every sentence is true now: #962 is CLOSED, PR #969 merged
      and fixed `brain-audit.mjs`, and #975 (the non-object-config-shape gap)
      is OPEN and NOT fixed.
- [x] 1.3 Verify the `amend-find` block is byte-identical to the current
      "Applied at" paragraph in
      `brain/core/anti-patterns/evidence-reader-empty-on-failure.md` on this
      branch (fresh off `origin/main`).
- [x] 1.4 Do NOT edit anything under
      `openspec/changes/issue-962-release-gate-deny-reader/`.

## Phase 2: Verify every named reader against source

- [x] 2.1 Read and classify (file:line, direction, failure behavior):
      `approve/cli.mjs`'s `defaultReadDenyActors`/`defaultReadAgentActors`,
      `vcs/actor-check.mjs`'s `defaultReadDenyActors` (DENY) and its
      `approvalActors`/`agentActors` readers (ALLOW),
      `vcs/brain-writes-reviewed.mjs`'s `defaultReadBotAllowlist`/
      `defaultReadApprovalActors`, `brain-audit.mjs`'s `loadConfig` and
      `ignoreList` consumer, `governance/approved-label.mjs`'s
      `resolveApprovedLabel`/`main()`, `vcs/governance-tiers.mjs`'s
      `resolveTier`.
- [x] 2.2 Also check `governance/lane-scrub.mjs`,
      `memory/backends/engram.mjs`, `memory/backends/plainfiles.mjs` — confirm
      they are a different reader category (secret-scrub config, not an
      actor deny/allow/exemption list) and do not belong in the roster.
- [x] 2.3 Record the classification table in `proposal.md` and mirror it in
      `apply-progress.md`. Fix the draft if any claim is wrong or
      incomplete.

## Phase 3: Prove promotable without promoting

- [x] 3.1 Write a throwaway script in the scratchpad directory that imports
      the real `brain/scripts/lib/amendment-draft.mjs`
      (`parseAmendmentDraft`, `assessEdit`, `applyEdits`,
      `amendmentCommitSubject`). Never call `npm run brain:promote`.
- [x] 3.2 Confirm: parse `ok`; the edit assesses `state: pending`, `free: 1`
      against the real target; `applyEdits` succeeds; the resulting text has
      no leftover "tracked in #962"/"still swallows the failure" claim; no
      other line in the target file changes.
- [x] 3.3 Compute the promotion commit subject via the real
      `amendmentCommitSubject()`.
- [x] 3.4 Record the simulation table, the promote command, the computed
      commit subject, and the maintainer's post-promotion checklist in
      `apply-progress.md`.

## Phase 4: Suite baseline and repo checks

- [x] 4.1 Run the full suite once
      (`GIT_CONFIG_GLOBAL=/dev/null npm test`) and record pass/fail counts.
- [x] 4.2 Run `npm run brain:repo:check` (or the equivalent check-refs /
      repo-hygiene gate) and record the result.

## Phase 5: Commit + record

- [x] 5.1 Commit the moved/updated draft plus the SDD docs
      (`proposal.md`, `spec.md`, `tasks.md`, `apply-progress.md`) as one or
      two work units citing `#976`.
- [x] 5.2 Record-first commit:
      `npm run brain:memory:save -- "<title>" "<content>" --issue 976 --type decision`
      (both positionals required), staging only the new
      `.memory/records/*.jsonl` plus `.memory/index.jsonl`.
