---
status: draft
issue: 606
---

# Spec — the rollup reports its cause

Delta spec for `openspec/changes/issue-606-rollup-reports-its-cause/proposal.md`. This
document states what MUST be true after the change lands. It does not prescribe
implementation.

## ADDED Requirements

### Requirement: `prStatusRollup` never returns bare `null`

`prStatusRollup` (both `github.mjs` and `gitlab.mjs`) MUST return either the normalized
`Array<{name, status, conclusion}>` on success, or a frozen object of shape
`{ uncomputable: true, reason: string, detail: string }` when it could not read the
rollup. It MUST NOT return bare `null` on any path, and it MUST NOT return `[]` as a
stand-in for a failure it did not actually observe as empty.

`[]` is reserved exclusively for the case where the fetch succeeded and the provider
reported a genuinely empty rollup (no checks configured on the PR/MR).

#### Scenario: successful fetch with checks configured

- **GIVEN** the provider's read call succeeds and returns one or more status checks
- **WHEN** `prStatusRollup` is called
- **THEN** it resolves to a non-empty `Array` of `{name, status, conclusion}` entries

#### Scenario: successful fetch, genuinely no checks

- **GIVEN** the provider's read call succeeds and the PR/MR has no checks configured
- **WHEN** `prStatusRollup` is called
- **THEN** it resolves to `[]`
- **AND** this is distinguishable from every failure path, which never resolves to `[]`

#### Scenario: fetch throws (rate-limited, unauthenticated, network down, not-found)

- **GIVEN** the provider's underlying call throws for any reason (rate limit,
  authentication failure, network error, not-found, or any other exception)
- **WHEN** `prStatusRollup` is called
- **THEN** it resolves to a frozen object `{ uncomputable: true, reason, detail }`
- **AND** it does NOT resolve to `null`
- **AND** it does NOT resolve to `[]`

#### Scenario: fetch succeeds but the rollup field is not an array

- **GIVEN** the provider's read call succeeds but the response's rollup field
  (`statusCheckRollup` for GitHub, the resolved statuses payload for GitLab) is not an
  array
- **WHEN** `prStatusRollup` is called
- **THEN** it resolves to a frozen object `{ uncomputable: true, reason, detail }`
- **AND** it does NOT resolve to `null` or `[]`

#### Scenario: GitLab — MR head sha cannot be resolved

- **GIVEN** the GitLab MR lookup succeeds but neither `sha` nor `diff_refs.head_sha` is
  present on the response
- **WHEN** `prStatusRollup` is called
- **THEN** it resolves to a frozen object `{ uncomputable: true, reason, detail }`
- **AND** it does NOT resolve to `null`

### Requirement: the provider's verbatim words always reach `detail`

`detail` MUST carry the provider's own error text (or an equivalent verbatim
description of what happened) on every failure path, regardless of whether the
classifier recognized it. The classifier is NEVER load-bearing for whether the operator
sees the underlying words — only for the `reason` label attached to them.

#### Scenario: a recognized cause carries its own words

- **GIVEN** a fetch fails with a message the classifier recognizes as rate-limiting
- **WHEN** the failure is classified
- **THEN** `reason` is `'rate-limited'`
- **AND** `detail` is the provider's original error text, unmodified

#### Scenario: a rotted or unrecognized classifier still surfaces the words (the collapse case)

- **GIVEN** a fetch fails with an error message the classifier's corpus does not match
  (e.g. a new `gh`/`glab` spelling, or an invented message no rule was written for)
- **WHEN** the failure is classified
- **THEN** `reason` is `'unclassified'`
- **AND** `detail` is STILL the provider's original error text, unmodified — it is never
  dropped, replaced, or reduced to a generic phrase
- **AND** this proves the degradation path is `rate-limited: <text>` → `unclassified:
  <text>`, never `rate-limited: <text>` → silence

#### Scenario: `detail` is present even when `reason` cannot be computed at all

- **GIVEN** a failure path where no error object or message is available (e.g. an
  unresolvable head sha with no thrown error)
- **WHEN** `prStatusRollup` returns its uncomputable result
- **THEN** `detail` still contains a concrete, non-empty description of what failed
  (never an empty string, never `undefined`)

### Requirement: the cause classifier is conservative, ordered, and defaults to `unclassified`

A pure classifier function MUST label a failure's `detail` text with a `reason` from a
fixed, conservatively-matched vocabulary (e.g. `rate-limited`, `unauthenticated`,
`network`, `not-found`), evaluated in a defined order, falling through to
`'unclassified'` when no rule matches. The classifier MUST NOT be able to produce a
`reason` that reads as "clean" or "no problem" — every `reason` value implies
"uncomputable," none implies success.

This mirrors the precedent already shipped in `review/identity.mjs`'s
`evaluateNegativeControl` (lines 85-92): ordered pattern tests, an explicit terminal
`unusable`/default branch, and the original message preserved on every branch including
the default.

#### Scenario: recognized causes are matched in a defined, documented order

- **GIVEN** a message that could plausibly match more than one rule (e.g. a message
  containing both an HTTP status code and rate-limit language)
- **WHEN** the classifier evaluates it
- **THEN** the match follows the documented precedence, and that precedence is fixed by
  a test (mirroring `identity.test.mjs`'s "lockout is tested BEFORE the auth-rejection
  match")

#### Scenario: the recognized-cause corpus is pinned by test

- **GIVEN** the classifier's set of recognized real-world provider messages (`gh`'s and
  `glab`'s actual observed spellings for rate-limit, auth failure, network failure,
  not-found)
- **WHEN** the corpus test runs
- **THEN** each pinned message classifies to its expected `reason`, and `detail` equals
  the input message verbatim — the same discipline `identity.test.mjs:296-304` applies
  to `evaluateNegativeControl`

#### Scenario: an unmatched message never falls back to any label but `unclassified`

- **GIVEN** an arbitrary string that matches none of the classifier's rules
- **WHEN** the classifier evaluates it
- **THEN** `reason` is exactly `'unclassified'`
- **AND** no other default value is produced

### Requirement: `evaluateTranche` names the cause without changing its verdict

`evaluateTranche` (`tranche.mjs`) MUST continue to return `REVISE` — never `APPROVE` —
when `requiredGates` is not an `Array` (the existing `!Array.isArray(requiredGates)`
guard at `tranche.mjs:133` is unchanged and remains the fail-closed gate). What changes
is the `conditions` entry it produces: it MUST name the cause and quote the detail
instead of emitting the bare, unexplained string `'evidence uncomputable'`.

#### Scenario: before/after — bare uncomputable string is replaced with a named cause

- **GIVEN** `requiredGates` is the new `{ uncomputable: true, reason: 'rate-limited',
  detail: 'gh: API rate limit exceeded (HTTP 403)' }` shape
- **WHEN** `evaluateTranche` is called
- **THEN** `conclusion` is `'REVISE'` (unchanged from today)
- **AND** the `conditions` array no longer contains the bare string `'evidence
  uncomputable'`
- **AND** the `conditions` array contains an entry that names `'rate-limited'` and
  quotes `'gh: API rate limit exceeded (HTTP 403)'` verbatim

#### Scenario: an unrecognized cause still reaches the evaluator's conditions verbatim

- **GIVEN** `requiredGates` is `{ uncomputable: true, reason: 'unclassified', detail:
  '<some never-seen provider message>' }`
- **WHEN** `evaluateTranche` is called
- **THEN** `conclusion` is `'REVISE'`
- **AND** the `conditions` entry names `'unclassified'` and quotes the detail text
  verbatim — the operator reads the provider's actual words even when the classifier
  did not recognize them

#### Scenario: `requiredGates` is a plain array — unaffected

- **GIVEN** `requiredGates` is a normal `Array` of gate entries (the success case)
- **WHEN** `evaluateTranche` is called
- **THEN** behaviour is byte-for-byte unchanged from today — the `Array.isArray` branch
  at `tranche.mjs:133` is never entered, and no new field or condition is introduced

### Requirement: `brain-metrics.mjs`'s `detectionConclusion` is a no-regression guarantee

`detectionConclusion` (`brain-metrics.mjs:178-191`) MUST continue to return `null` for
any input where `!Array.isArray(rollup)` is true — including the new
`{uncomputable, reason, detail}` object — with no behavioural change. This requirement
exists so a future edit cannot quietly start truthy-checking the new object instead of
checking `Array.isArray`.

#### Scenario: the new uncomputable object is treated exactly like the old `null`

- **GIVEN** `rollup` is `{ uncomputable: true, reason: 'not-found', detail: '...' }`
- **WHEN** `detectionConclusion(rollup, jobName)` is called for any `jobName`
- **THEN** it returns `null`, identical to what it returned for `rollup === null` before
  this change

#### Scenario: a plain array rollup is unaffected

- **GIVEN** `rollup` is a normal `Array` of gate entries
- **WHEN** `detectionConclusion(rollup, jobName)` is called
- **THEN** behaviour is unchanged from today

### Requirement: both providers implement the identical contract

`prStatusRollup` on `github.mjs` and `prStatusRollup` on `gitlab.mjs` MUST both satisfy
every requirement above, using the same shared classifier from `vcs/lib/`. A one-provider
fix is not acceptable: `verb-contract-drift-guard.test.mjs` treats any function exported
by both providers as a contract verb, and a divergence here would either trip that guard
or — worse — pass it while leaving one provider silently behind the other.

#### Scenario: GitHub and GitLab produce the same shape for the same failure class

- **GIVEN** a rate-limit failure on GitHub and an equivalent rate-limit failure on
  GitLab
- **WHEN** each provider's `prStatusRollup` is called
- **THEN** both resolve to `{ uncomputable: true, reason: 'rate-limited', detail: ... }`
  — same keys, same `reason` vocabulary, provider-specific `detail` text

#### Scenario: the shared contract test table covers both providers

- **GIVEN** `vcs.contract.test.mjs`'s `ROLLUP_PROVIDERS` table-driven tests
- **WHEN** the failure-path test (`vcs.contract.test.mjs:1231`, currently `assert.equal(result, null, ...)`) runs for each provider
- **THEN** the assertion is revised to check the frozen `{uncomputable, reason, detail}`
  shape instead of `null`, for BOTH `github` and `gitlab` entries in the table — not one

### Requirement: the 13 remaining cause-discarding sites are filed, not fixed here

This change touches exactly one verb (`prStatusRollup`) on both providers. The
remaining cause-discarding read sites are explicitly OUT of scope for this change, but
MUST be filed as a follow-up issue naming each site by file and line number.

#### Scenario: a follow-up issue exists naming all remaining sites

- **GIVEN** this change is applied
- **WHEN** the follow-up issue is filed
- **THEN** it lists all remaining cause-discarding sites with file:line references
  (`github.mjs:204 :309 :402 :524 :587 :630`, `gitlab.mjs:230 :307 :360 :393 :493 :554
  :672 :1010`)
- **AND** `github.mjs:309` (`checkRuns`) is named specifically and prioritized first,
  because it degrades to a fabricated `[]` on failure rather than an unnamed `null` —
  the anti-pattern in its purest form, and a worse case than this issue's own starting
  point

#### Scenario: this change does not silently touch any of the 13 filed sites

- **GIVEN** the diff for this change
- **WHEN** it is reviewed against the filed list
- **THEN** none of the 13 sites' source is modified by this change — only
  `prStatusRollup` on both providers, the new `vcs/lib/uncomputable-cause.mjs`, and
  `tranche.mjs`'s rendering of the cause are touched

## Out of scope (explicitly not required by this spec)

- Migrating `prStatusRollup`'s transport from GraphQL-backed `gh pr view` to REST (filed
  separately per the proposal's ruling 4).
- Fixing any of the 13 filed sibling sites' own `catch {}` behaviour.
- Changing `evaluateTranche`'s verdict logic for any case other than the `conditions`
  string it emits when evidence is uncomputable.
