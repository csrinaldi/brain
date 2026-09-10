---
status: tasked
issue: 889
---

# Lane Governance Specification (#889)

Refines `archive/862/spec.md`'s L1 (lane recognition), L3 (index off the lane), C1 (secret
scrub required check), and L6 (template wording) into testable contracts, per ADR-0034 and
the ruling `sdd/issue-889-lane-governance/ruling`. Grouped by delivery slice: **A** (#905,
closed by PR 1 — the gate surface) and **B** (#889, closed by PR 2 — audit + index).

## Slice A — gate surface (#905)

### Requirement: the lane predicate is narrow and structural (L1, refines archive/862/spec.md:14-18)

`classifyLane({sourceBranch, changedFiles, addedFiles})` MUST return `lane: true` only when
`sourceBranch` matches `^memory/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}(-\d+)?$` AND every path in
the three-dot diff (`baseSha...headSha`) is present in the added-only diff, under
`.memory/records/`. Any modification, deletion, rename, out-of-prefix path, or `index.jsonl`
MUST classify as not-a-lane. When `sourceBranch` is absent or a diff is uncomputable, the PR
MUST NOT be classified as a lane.

#### Scenario: a clean lane vs a foreign path
- GIVEN a PR head `memory/host1-2026-09-10` whose diff adds only files under `.memory/records/`
- WHEN `classifyLane` runs, THEN it returns `lane: true`
- AND WHEN any path is a modification/deletion/rename or lies outside the prefix (incl.
  `index.jsonl`), THEN it returns `lane: false`

#### Scenario: an uncomputable diff refuses the exemption
- GIVEN `sourceBranch` is null or the diff cannot be computed
- WHEN `classifyLane` runs, THEN it returns `lane: false` — an unverifiable lane is not a lane

Test: `governance/checks/lane.test.mjs` — branch+paths lane; branch-only/paths-only/modified/
`index.jsonl`/null-branch not-lane; date-suffix grammar.

### Requirement: `issue-link` recomputes the predicate before exempting (D1a, L1)

`runIssueLinkCheck` MUST call `classifyLane` on `ctx` before evaluating `issueLink(ctx.body)`.
A lane PR MUST skip the closing-keyword requirement. A `memory/*` head carrying any non-lane
path MUST be refused under the ordinary `issueLink` rule — the exemption MUST NEVER be wider
than the predicate it recomputes.

#### Scenario: a lane skips the keyword; a code-carrying memory branch does not
- GIVEN a lane-classified PR whose body has no closing keyword
- WHEN `runIssueLinkCheck` runs, THEN it passes with no keyword required
- AND WHEN a `memory/x-2026-09-10` branch's diff includes one code path
- THEN it is refused by the standard `issueLink` rule, not silently exempted

Test: `governance/run-check.test.mjs` — lane ctx skips `issueLink`; code-carrying `memory/*`
branch refused by ordinary rule; uncomputable diff ⇒ standard rules, never a silent exemption.

### Requirement: `actor-check` stays unmodified; two regressions pin it (D2)

`actor-check` MUST NOT gain lane-specific code. `evaluateActor` on a lane-shaped PR (no issue
number, `labeledEvents: []`) MUST continue to return `level: warn`, exit 0. A labeled PR whose
approver is in `denyActors` MUST continue to `fail`, exit 1.

#### Scenario: pinned behaviour on and off the lane
- GIVEN a lane-shaped PR body with no issue number
- WHEN `actor-check` runs, THEN it returns `warn` and exits 0
- AND WHEN a labeled PR's approver is in `denyActors`
- THEN it returns `fail` and exits 1

Test: `vcs/actor-check.test.mjs` — lane-shaped PR ⇒ warn/exit 0; labeled PR + denied approver
⇒ fail/exit 1.

### Requirement: `lane-paths` is a required, self-reporting context (D3)

`lane-paths` MUST run `classifyLane` over the three-dot diff and exit 1 naming the first
offending path when the PR is not a lane by the path predicate. On a non-lane PR it MUST run
and exit 0, printing "not a lane — nothing to check" — never skipped.

#### Scenario: named refusal and explicit pass
- GIVEN a diff with a path outside `.memory/records/`
- WHEN `lane-paths` runs, THEN it names the path and exits 1
- AND WHEN the PR is not lane-shaped at all
- THEN it exits 0 printing "not a lane — nothing to check"

Test: `governance/lane-paths.test.mjs` — offending path named; exit 1 foreign path; exit 0
non-lane; three-dot argv asserted.

### Requirement: `lane-scrub` is a required, non-waivable secret check (C1, D3)

`lane-scrub` MUST run `scrubRecordsFile` over every lane-added record and fail closed on any
match, printing only `pattern` and `lineNumber` — never the matched line. It MUST honour
`memorySecretAllowPatterns`. On a non-lane PR it MUST run and exit 0.

#### Scenario: fail-closed without leaking the secret
- GIVEN a planted `ghp_…` token in an added record
- WHEN `lane-scrub` runs, THEN it exits 1, printing pattern + line number, never the line
- AND WHEN the PR is not a lane, THEN it exits 0

Test: `governance/lane-scrub.test.mjs` — planted secret fails closed; output has pattern +
lineNumber, never the line; allow-patterns honoured; exit 0 non-lane.

### Requirement: job registration is atomic (D3)

`lane-paths` and `lane-scrub` MUST be registered as two independent jobs in `GOVERNANCE_JOBS`,
two `GATE_MATRIX` rows, and `.github/workflows/governance.yml` in one commit. A drift guard
MUST fail red if any of the three is missing a job the others declare.

#### Scenario: drift guard sees ten jobs or fails
- GIVEN the eight pre-existing jobs plus `lane-paths`/`lane-scrub`
- WHEN the drift guard runs, THEN it passes only when all three sources list ten matching names

Test: `vcs/governance-checks.test.mjs` + `governance-tiers.test.mjs` — drift guard red until
`GOVERNANCE_JOBS`, `GATE_MATRIX`, and the YAML all list ten jobs.

### Requirement: `brain:protect` arms both contexts as required (D3, D7)

`npm run brain:protect` MUST derive `checkContexts(tier)` from `GATE_MATRIX` including
`lane-paths` and `lane-scrub`, and `npm run brain:governance-status` MUST report both armed
after the maintainer runs it. No real `memory:ship` run is valid before both show armed.

#### Scenario: arming is a maintainer act, verified
- GIVEN slice A has merged
- WHEN the maintainer runs `brain:protect` then `brain:governance-status`
- THEN both `lane-paths` and `lane-scrub` report as required contexts on `main`

Verified by: `npm run brain:governance-status` (maintainer act, not unit-tested — exercised by
`vcs/governance-checks.test.mjs`'s `checkContexts` derivation).

### Requirement: the template sentence describes the lane (L6, D5)

`contributor-scaffold.mjs`'s emitted `.github/PULL_REQUEST_TEMPLATE.md` memory line MUST read:
"captured as a record (`memory:save --issue N`); it reaches `main` on the lane."

#### Scenario: emitted template matches committed byte-for-byte
- GIVEN the scaffold regenerates the template
- WHEN compared to the committed file, THEN they match byte-for-byte including the new sentence

Test: `vcs/contributor-scaffold.test.mjs` — emitted template matches committed, byte-for-byte.

## Slice B — audit + index (#889)

### Requirement: `brain:audit` reports `[LANE]` on both signals (D4)

`brain-audit.mjs`'s walk loop MUST classify a merge as a lane, before calling `evaluateMerge`,
only when every changed path is an addition under `.memory/records/` AND the commit body
matches `/^Memory lane: /m`. A lane merge MUST print `[LANE] <sha7> <subject>` and skip
`evaluateMerge`. Paths alone or the marker alone MUST NOT classify as a lane.

#### Scenario: a squashed lane merge is recognized; a marker-less records PR is not
- GIVEN a squashed merge whose diff is records-only and whose body carries the lane marker
- WHEN the walk runs, THEN it prints `[LANE]` and never calls `evaluateMerge`
- AND WHEN a records-only merge lacks the marker
- THEN it is evaluated normally, not classified as a lane

Test: `brain-audit.test.mjs` — squashed lane merge ⇒ `[LANE]`, `evaluateMerge` never called;
records-only merge without the marker ⇒ evaluated normally.

### Requirement: `local-checks` warns on index lag, never fails (L3, refines archive/862/spec.md:49-58)

A new pure `compareIndexToRecords({indexLines, records})` MUST report `{lagged, indexed,
rebuilt}`. `local-checks` MUST run it as a step that prints a warning when the committed
`index.jsonl` differs from `rebuild(records)`, always exits 0, and never writes any file.

#### Scenario: lag warns; sync is silent; nothing is written
- GIVEN the committed index no longer equals a rebuild from `.memory/records/`
- WHEN `local-checks` runs, THEN it prints a lag warning and exits 0
- AND WHEN the index is in sync, THEN it is silent and exits 0
- AND in both cases no file is written

Test: `memory/index-lag.test.mjs` — lag ⇒ warning, exit 0; in sync ⇒ silent, exit 0; no file
written.

## Non-goals

No change to `collect`/`plan`/`ship`/`mrCreate`/`mrList`/`mrAutoMerge`/`vcsToken()` or the
record format. No `memory-gate` logic change (it reads the PR tree, not the diff). No `SessionEnd`
hook or `day:start` sweep (sub-ticket, gated behind `memory.lane.enabled`, default `false`). No
#805 auto-merge-enable machinery. No #890 feature-PR surface retirements. No new VCS port verb,
no head-branch field on `fetchPrMeta`. No `--force`. No branch-protection API call from CI
(`brain:protect` is a maintainer act with an admin token). No `type:*` label exemption.
