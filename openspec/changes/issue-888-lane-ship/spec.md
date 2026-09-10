---
status: tasked
issue: 888
---

# Lane Ship Specification (#888)

Refines `archive/862/spec.md`'s requirement "the ship trigger and credential are separated"
(`archive/862/spec.md:76-88`, owning slice 3.1b, ADR-0034 L1/L2/L5) into `shipLane`'s own
testable contract. D1–D6 ratified 2026-09-10 (`sdd/issue-888-lane-ship/ruling`). Builds on
`issue-887-lane-collector/spec.md` (`collectLane`, landed `2ec28558`).

## Requirements

### Requirement: the ship sequence and outcome shape (D1/D2)

`shipLane({root, project, tier, dryRun, collectFn, git, mrList, mrCreate, mrAutoMerge})` MUST
run `collect → push → find-or-create PR → arm auto-merge` in order and return
`{ref, commit, pushed, pr, autoMerge, collected, skipped, duplicates}` (plus `collectLane`'s own
`baseFetched`, and `dryRun`).

#### Scenario: a full run produces the outcome shape
- GIVEN a candidate exists and every injected fn is a fake that succeeds
- WHEN `shipLane` runs
- THEN it returns the shape populated, with `pushed: true` and `pr.number` set

#### Scenario: nothing to ship is a no-op
- GIVEN `collectFn` returns `commit: null`
- WHEN `shipLane` runs
- THEN it exits 0 with `pushed: false`, `pr: null`, and `git`/`mrList`/`mrCreate`/`mrAutoMerge`
  are never called

### Requirement: the push is a fast-forward, never forced (D2, ADR-0034 L9)

`shipLane` MUST push `${ref}:${ref}` to `origin` with `--no-verify`. `--force` MUST NOT appear
in the argv or source. A non-fast-forward remote MUST be reported as `diverged`, exit non-zero,
with no PR call.

#### Scenario: a fast-forward push succeeds
- GIVEN the local ref is ahead of `origin`'s matching ref
- WHEN `shipLane` pushes
- THEN the argv contains `--no-verify` and never `--force`, and `pushed: true`

#### Scenario: a diverged remote is refused
- GIVEN the remote ref is not an ancestor of the local ref
- WHEN the push runs
- THEN `shipLane` reports `diverged`, exits non-zero, and calls no PR function

### Requirement: PR lookup and creation are idempotent (D2)

`shipLane` MUST call `mrList({project, state:'open'})` and match `headBranch` against the local
branch before calling `mrCreate`. When a match exists, `mrCreate` MUST NOT be called.

#### Scenario: first run creates a PR
- GIVEN `mrList` returns no PR with the matching head
- WHEN `shipLane` runs
- THEN `mrCreate` is called once and its result becomes `pr`

#### Scenario: a same-day re-run opens no second PR
- GIVEN `mrList` returns an open PR with the matching head
- WHEN `shipLane` runs again after new commits are pushed
- THEN `mrCreate` is never called and `mrAutoMerge` is still called

### Requirement: PR grammar and target (D2, ADR-0034 L1)

`mrCreate` MUST be called with `title`/body line `Memory lane: <host> <date>`, no closing
keyword, no issue reference, `base: 'main'`, `labels: []`.

#### Scenario: the body matches the grammar exactly
- GIVEN a ship run creates a PR
- WHEN the `mrCreate` call is inspected
- THEN `title` and the body's first line equal `Memory lane: <host> <date>` verbatim, with no
  closing keyword or issue number anywhere in the body

### Requirement: the PR number is derived, never guessed (D2)

The PR number MUST be parsed as the trailing integer of `mrCreate`'s `url`. On a parse failure,
one `mrList` re-scan MUST recover it. If both fail, `pr.number` MUST be `null` and step 5 MUST
be skipped.

#### Scenario: the number parses from the URL
- GIVEN `mrCreate` returns a URL ending in an integer
- WHEN `shipLane` derives the number
- THEN `mrAutoMerge` is called with that number

#### Scenario: URL parse fails, `mrList` recovers it
- GIVEN the URL does not end in a parseable integer
- WHEN `shipLane` derives the number
- THEN it re-scans via `mrList` and, if found, calls `mrAutoMerge` with the recovered number

#### Scenario: both derivations fail, arm is skipped
- GIVEN neither the URL nor the `mrList` re-scan yields a number
- WHEN `shipLane` completes
- THEN `pr.number` is `null`, `mrAutoMerge` is never called, and the run still exits 0

### Requirement: tier-gated arm, refusals are never fatal (D2, ADR-0034 L2)

`mrAutoMerge` MUST be called unconditionally with `requiredReviews: tierParams(tier).requiredReviews`.
A refusal (`requires-human-approval`, `unsupported`, `transport`) MUST be reported in
`autoMerge.reason` and MUST NOT fail the run.

#### Scenario: `lite` arms auto-merge
- GIVEN `requiredReviews: 0`
- WHEN `mrAutoMerge` is called
- THEN `autoMerge.enabled: true` and the run exits 0

#### Scenario: `standard`/`regulated` refusal is reported, not fatal
- GIVEN `requiredReviews: 1`
- WHEN `mrAutoMerge` refuses with `requires-human-approval`
- THEN `autoMerge.reason` carries it, the PR stays open, and the run still exits 0

### Requirement: credential is read once and threaded (D3, ADR-0033)

`ship.mjs` MUST read `process.env.BRAIN_MEMORY_TOKEN` exactly once and pass it as
`identity` to `getVcs`. Absent, `identity` MUST be `null`, letting `getVcs` fall through to
ambient resolution.

#### Scenario: token present binds every port call
- GIVEN `BRAIN_MEMORY_TOKEN` is set
- WHEN `shipLane` calls `mrList`/`mrCreate`/`mrAutoMerge`
- THEN each call runs through `getVcs({identity: <token value>})`

#### Scenario: token absent falls to ambient
- GIVEN `BRAIN_MEMORY_TOKEN` is unset
- WHEN `shipLane` runs
- THEN `identity` is `null` and `getVcs` resolves the ambient credential

### Requirement: `MEMORY_TOKEN_ENV` is denylisted by default (D3)

`lib/credential-env.mjs` MUST export `MEMORY_TOKEN_ENV = 'BRAIN_MEMORY_TOKEN'` and include it in
`credentialEnvNames()`'s default set, with no `extra: [...]` argument required.

#### Scenario: leak regression — the token is stripped by default
- GIVEN an env containing `BRAIN_MEMORY_TOKEN` and `withoutCredentials(env, credentialEnvNames())`
  called with no `extra` argument
- WHEN the scrubbed env is inspected
- THEN `BRAIN_MEMORY_TOKEN` is absent

### Requirement: `--dry-run` performs collect's plan only (D5)

`--dry-run` MUST run `collectFn` (or its planning equivalent) and report the computed ref,
branch, title, and body with `pushed: false`, `pr: null`, and MUST make zero calls to `git`,
`mrList`, `mrCreate`, or `mrAutoMerge`.

#### Scenario: dry-run makes zero network or port calls
- GIVEN `--dry-run` is set
- WHEN `shipLane` runs
- THEN `git`, `mrList`, `mrCreate`, and `mrAutoMerge` are never invoked, and the plan is printed

### Requirement: the CLI never throws; exit codes and i18n (D1)

`memory/cli.mjs`'s `ship` op MUST own its `try/catch`, print `memory.ship.*` keys (en/es), send
`--json` to stdout only and evidence to stderr, and MUST NOT re-throw on any failure.

#### Scenario: success or no-op exits 0 with `--json`
- GIVEN a successful or no-op run
- WHEN invoked with `--json`
- THEN the outcome shape is the only stdout content and the process exits 0

#### Scenario: diverged or a genuine error exits non-zero, never throws
- GIVEN a diverged push or an unexpected error inside `shipLane`
- WHEN the CLI runs
- THEN it prints `memory.ship.failed` (or `diverged`), exits 1, and the process never throws
  uncaught

### Requirement: trigger and credential boundary (D4, refines `archive/862/spec.md:76-88`)

No automatic caller ships in this slice. `pre-push` MUST NOT invoke `ship`. When
`BRAIN_MEMORY_TOKEN` is present (an unattended host), the port MUST bind to it rather than the
capturing session's own ambient credential — satisfying the ruling's two scenarios without a
`SessionEnd` hook or `day:start` sweep (deferred to #889).

#### Scenario: `pre-push` does not invoke ship
- GIVEN a feature branch is pushed
- WHEN `pre-push` runs
- THEN it does not call `memory:ship`, asserted behaviourally (no fixture invokes it), not by
  source grep

#### Scenario: an unattended host authenticates with the token, not the session's own credential
- GIVEN `BRAIN_MEMORY_TOKEN` is set and no other VCS credential is exported
- WHEN `shipLane` runs
- THEN every port call succeeds bound to the token, with no fallback to a session-ambient
  credential

### Requirement: scope boundary — no gate, hook, or port change (D6)

This slice MUST NOT modify `collect.mjs`, `plan.mjs`, `mrCreate`, `mrList`, `mrAutoMerge`,
`vcsToken()`, `.claude/settings.json`, `.gemini/settings.json`, or any `brain/core/**` file.

#### Scenario: no source outside the declared file list is touched
- GIVEN the PR diff for this change
- WHEN it is inspected
- THEN only `lane/ship.mjs`, the `cli.mjs` dispatch block, `credential-env.mjs`, i18n catalogs,
  `package.json`, and the four test files appear

## STRICT TDD test map

| Requirement | Test file | Case |
|---|---|---|
| sequence + outcome shape | `lane/ship.test.mjs` | full run returns populated shape |
| sequence + outcome shape | `lane/ship.test.mjs` | `commit: null` → no push/list/create/arm |
| safe push | `lane/ship.test.mjs` | argv contains `--no-verify`, never `--force` |
| safe push | `lane/ship.integration.test.mjs` | diverged local bare remote is refused, no push |
| idempotent PR | `lane/ship.test.mjs` | PR-already-open ⇒ `mrCreate` never called, `mrAutoMerge` still called |
| idempotent PR | `lane/ship.integration.test.mjs` | second run fast-forwards, opens no second PR |
| PR grammar | `lane/ship.test.mjs` | body matches L1 grammar exactly, base `main`, `labels: []` |
| PR number | `lane/ship.test.mjs` | number parses from URL; `mrList` fallback; both-fail ⇒ `null`, arm skipped |
| tier-gated arm | `lane/ship.test.mjs` | `requiredReviews: 0` arms; `requiredReviews: 1` ⇒ refusal reported, exit 0, PR open |
| credential threading | `lane/ship.test.mjs` | token present ⇒ `identity` bound on every call; absent ⇒ `identity: null` |
| credential denylist | `lib/credential-env.test.mjs` | `MEMORY_TOKEN_ENV` in default set; `withoutCredentials` strips it with no `extra`; pinned count moves by one |
| dry-run | `lane/ship.test.mjs` | `--dry-run` ⇒ zero calls on every injected IO fn |
| CLI exit/i18n | `cli.ship.test.mjs` | `--json` on stdout only, exit 0 success/no-op, exit 1 diverged/error, never throws |
| CLI exit/i18n | `cli.ship.test.mjs` | no token printed under either credential path |
| trigger boundary | `lane/ship.integration.test.mjs` | `pre-push` fixture never invokes ship |
| trigger boundary | `lane/ship.test.mjs` | unattended-host identity binds the token, no ambient fallback |
| scope boundary | `lane/ship.integration.test.mjs` | ref lands on remote with expected tree; no `collect`/port source touched |

## Non-goals (D6)

`issue-link`/`actor-check` lane recognition and `lane-paths`/`lane-scrub` required contexts
(#889); the `SessionEnd` hook and `day:start` sweep (#889); `pre-push:70`'s `share` retirement
and the other feature-PR surfaces (#890); any change to `collect`, `plan`, `mrCreate`, `mrList`,
`mrAutoMerge`, `vcsToken()`, `memory-gate`, or the record format; a `mrMerge`/"is auto-merge
armed" read verb; `--force` in any form.
