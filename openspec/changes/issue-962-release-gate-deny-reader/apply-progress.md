# Apply progress — issue #962

## Mode
Strict TDD — `GIT_CONFIG_GLOBAL=/dev/null npm test` (node --test).

## Completed tasks
- [x] 1.1 RED test — unparseable `brain.config.json` fails the release gate closed
- [x] 1.2 RED test (companion) — absent config, behaviour unchanged
- [x] 1.3 Confirmed RED against unmodified code
- [x] 2.1 GREEN — `loadConfig` now delegates to `loadBrainConfigOrThrow(cwd)`
- [x] 2.2 Removed unused `readFileSync` import
- [x] 2.3 Confirmed GREEN
- [x] 3.1 Consumer classification (below, mirrors `proposal.md`)
- [x] 3.2 Doctrine draft written (`brain-drafts/deny-readers-roster-sixth.draft.md`)
- [x] 3.3 Draft proven to parse/assess with a throwaway script against the real module
- [x] 4.1 Mutation table (below)
- [x] 4.2 Full suite run, both post-revert and post-restore (below)
- [x] 5.1 Commit test+fix (commit `442912c`)
- [x] 5.2 Commit SDD docs + draft (this commit)
- [ ] 5.3 Record-first commit (pending)

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| `loadConfig` fails closed on unparseable config | `brain-audit.test.mjs` — 2 new tests added; ran against unmodified `brain-audit.mjs`: 1 fail ("an unparseable brain.config.json must not read as a clean release gate: … actual: 0 expected: notStrictEqual 0"), 1 pass (absent-config companion, already true) | Replaced `loadConfig`'s `try{…}catch{return {}}` with a delegate to `loadBrainConfigOrThrow(cwd)`; both new tests pass; full `brain-audit.test.mjs` 55/55 pass | Removed the now-dead `readFileSync` import; no further restructuring needed — `loadConfig`'s call site and all its consumers were untouched |

## Files changed

| File | Action | What was done |
|---|---|---|
| `brain/scripts/brain-audit.mjs` | Modified | `loadConfig(cwd)` now delegates to `loadBrainConfigOrThrow(cwd)` (`./lib/brain-config.mjs`) instead of swallowing any read/parse failure to `{}`. Removed the now-unused `readFileSync` import. +23/-7 lines. |
| `brain/scripts/brain-audit.test.mjs` | Modified | Added two fixture tests: `#962: unparseable brain.config.json fails the release gate closed…` (RED→GREEN) and `#962: no brain.config.json at all — behaviour unchanged…` (regression pin for R11). Both drive the real CLI via `spawnSync` against a temp git repo, never the real clone. |
| `openspec/changes/issue-962-release-gate-deny-reader/proposal.md` | Created | Intent, scope, acceptance criteria (copied from the issue), full consumer classification table. |
| `openspec/changes/issue-962-release-gate-deny-reader/spec.md` | Created | Delta requirements (WHEN/THEN scenarios), added because the repo's declared `lite` tier requires `spec.md` on every active change dir (`governance-tiers.mjs`'s `TIER_PARAMS.lite.artefacts`) — enforced by a local commit hook the orchestrator's generic SDD template did not anticipate for a bugfix-only change. |
| `openspec/changes/issue-962-release-gate-deny-reader/tasks.md` | Created | Task breakdown, Review Workload Forecast (Low risk, single PR). |
| `openspec/changes/issue-962-release-gate-deny-reader/apply-progress.md` | Created | This file. |
| `openspec/changes/issue-962-release-gate-deny-reader/brain-drafts/deny-readers-roster-sixth.draft.md` | Created | Tier 2 `brain-amendment/1` DRAFT ONLY (never promoted) — see below. |

## Consumer classification — every config consumer in `brain-audit.mjs`

| Consumer | Location | Key read | Direction | Disposition |
|---|---|---|---|---|
| `loadConfig` | `:159-179` (was `:159-165`) | loads the whole `brain.config.json` | N/A — the loader itself | **FIXED (#962)**: now delegates to `loadBrainConfigOrThrow(cwd)`; propagates any read/parse failure instead of swallowing to `{}`. The throw reaches the top-level `.catch` (REQ-D2-12) and exits 2 before any consumer below runs. |
| `ignoreList` | `:201-203` | `governance.ignoreList` | ALLOW/exemption — paths excluded from certain checks | Unchanged. Empty is already the strict (safe) answer — named explicitly in `evidence-reader-empty-on-failure.md`'s doctrine. |
| `tier` | `:208` (`resolveTier(config)`) | `governance.tier` | Not a deny/allow list — a ratified fixed fallback (`'standard'`) | Unchanged. Covered by the doc's own "Exemption" paragraph for `governance-tiers.mjs`'s `resolveTier` — doctrine choosing one fallback value on purpose, not a deny/allow reader at all. |
| `rawBaseline` | `:218` | `governance.auditBaseline` | Not an identity list — an audit-scope ref, not deny/allow at all | Unchanged. Absent/unreadable → `null` → NO merges are pre-baseline-skipped → **more** merges get audited, which is strictly the safer direction — already fail-strict on absence. |
| `vcs` | `:227`, `:321` (`resolveVcs(config)`, `fetchPrMeta(subject, vcs, config)`) | `vcs.provider`, `project.slug` (adapter wiring) | Not an identity list — VCS adapter configuration | Unchanged. REQ-TS-3 already documents an explicit, visible `[WARN]` degrade by design ("a configuration state, not a fetch failure") — never silent. |
| `botAllowlist` | `:370` | `governance.reviewActors` | **DENY/exclusion** — identities excluded from the human-approver count | **FIXED (#962)** — protected transitively by `loadConfig`'s throw: this line is never reached on a broken config; the whole release gate fails closed. |

No other DENY consumer exists in `brain-audit.mjs` beyond `botAllowlist`
(`governance.reviewActors`). No ALLOW consumer's degrade behaviour needed to
change — each is either already fail-strict on absence (`auditBaseline`) or
already explicitly documented as a visible, deliberate degrade (`ignoreList`,
`tier`, `vcs`).

## Tier 2 doctrine follow-up (draft only)

`brain-drafts/deny-readers-roster-sixth.draft.md` — a `brain-amendment/1`
draft targeting `brain/core/anti-patterns/evidence-reader-empty-on-failure.md`.
Rewrites the "Applied at" paragraph in place:

1. Moves `brain-audit.mjs`'s `loadConfig` into the fixed-reader list (six
   readers now propagate a config-read failure, not five).
2. Reclassifies `approved-label.mjs`'s `resolveApprovedLabel` OUT of the
   ALLOW-reader bullet list. **Verified directly** against
   `brain/scripts/governance/approved-label.mjs`: `governance.approvedLabel`
   is a single string, not a list; `main()` (`:52-62`) catches a config-read
   failure and degrades to `DEFAULT_APPROVED_LABEL = 'status:approved'`
   (`:19`) — a ratified fixed-fallback constant, the same shape the doc
   already carves out for `governance-tiers.mjs`'s `resolveTier` in its own
   "Exemption" paragraph. The prior classification (an ALLOW-direction list
   reader) was imprecise, since it is not a list at all — this draft corrects
   it.

Proof (throwaway script, never touches the target file, `brain:promote`
never invoked):

```
$ node /tmp/claude-1000/-home-gandalf-IA-brain/71e1249b-9491-4e33-857a-096458f6eeb2/scratchpad/sim-roster-962.mjs
parse: ok
contract: {
  "target": "brain/core/anti-patterns/evidence-reader-empty-on-failure.md",
  "isAdr": false,
  "adrNumber": null,
  "slug": null,
  "amendment": null,
  "issue": "962",
  "homeSummary": null,
  "bodyHeading": null,
  "bodyEndHeading": null
}
edits count: 1
edit 1: {"state":"pending","f":1,"r":0,"k":0,"free":1}
OK: draft parses and every edit assesses as pending against the real target file.
```

The script imports `parseAmendmentDraft`/`assessEdit` directly from
`brain/scripts/lib/amendment-draft.mjs` (the real module) and reads the real
target file on disk — it never calls `brain:promote` or writes to the target.

## Mutation table

| Mutation | Command | Result |
|---|---|---|
| Baseline (fix applied) — `brain-audit.test.mjs` only | `node --test brain/scripts/brain-audit.test.mjs` | 55/55 pass |
| Baseline (fix applied) — full suite | `GIT_CONFIG_GLOBAL=/dev/null npm test` | **5343 pass / 0 fail** |
| Revert `loadConfig` fix only (`git stash push -- brain/scripts/brain-audit.mjs`), test file untouched — `brain-audit.test.mjs` only | `node --test brain/scripts/brain-audit.test.mjs` | **54 pass / 1 fail** — exactly `#962: unparseable brain.config.json fails the release gate closed…` goes red; the absent-config companion test stays green |
| Revert `loadConfig` fix only — full suite | `GIT_CONFIG_GLOBAL=/dev/null npm test` | **5342 pass / 1 fail** — exactly the same one test, nothing else in the 5343-test suite is affected |
| Restore fix (`git stash pop`) — `brain-audit.test.mjs` only | `node --test brain/scripts/brain-audit.test.mjs` | 55/55 pass (confirmed twice, before and after the full-suite mutation run) |

The mutation isolates to exactly one test in both the file-scoped run and the
full 5343-test suite, in both directions — confirming the RED test's
neutralization claim: no sibling reader (issueLink, memoryPresence,
diffSize, adrPresence, baseline, lane classification, uncomputable-PR
handling, etc.) is exercised by the fixture, because the genuinely-empty git
range (`HEAD..HEAD`) means `listAuditedCommits` is never reached — `loadConfig`
throws unconditionally before it.

## Production line count

`git diff --stat -- brain/scripts/brain-audit.mjs`: **23 insertions(+), 7
deletions(-)**, 30 changed lines. Tests (`brain-audit.test.mjs`) and this
`openspec/**` folder are excluded from `governance.ignoreList`'s counted
production surface (tests, `.memory/**`, `openspec/**`, `AGENTS.md`). Well
under the 400-line PR review budget — single PR, no chaining needed.

## Deviations from design
None — the fix is exactly what the issue's "Expected" section specifies:
route through `loadBrainConfigOrThrow`, fail closed on the throw via the
existing top-level catch, absent-config behaviour unchanged.

## Issues found
None beyond the doctrine staleness the issue itself flagged (the Tier 2
draft addresses it, as a draft only).

## Risks
- The doctrine draft (`brain-drafts/deny-readers-roster-sixth.draft.md`) is
  UNAPPLIED. `evidence-reader-empty-on-failure.md`'s roster paragraph will
  read as stale (still naming `brain-audit.mjs` as broken, and
  `approved-label.mjs` as an ALLOW-list reader) until a human runs
  `brain:promote` on it — deliberately left for a human decision, per the
  hard constraint never to run `brain:promote` and never to edit
  `brain/core/**` directly.

## Remaining tasks
- [ ] 5.3 Record-first commit (`npm run memory:save`)

## Status
18/19 tasks complete. Test+fix committed (`442912c`); this commit lands the
SDD docs and the doctrine draft. Only the record-first commit remains.
