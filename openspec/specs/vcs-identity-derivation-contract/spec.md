# vcs-identity-derivation-contract Specification

Issue #385 — epic #335, M10 Phase 2, final Gap-A batch. Five verbs carry zero contract-parity
coverage per the #336 audit: `whoami`, `commitStatus`, `repoCloneUrl`, `patSetupUrl`,
`projectResolve`. New capability spec, sibling to `mrlist-contract`, `issueList-contract`, and
`auth-contract` (issues #355, #362, #364/#365). Test-only, additive — zero production files
touched; two latent production defects (below) are locked as current behavior, not fixed.

## ADDED Requirements

### Requirement: `whoami` contract shape assertion across providers

The system MUST have an automated contract test asserting that both provider normalizers
(`github`, `gitlab`) emit `whoami` results as exactly `{ username }`, parameterized across both
providers in `vcs.contract.test.mjs`, reusing the `jsonSpawnCallArgs` glue already established for
`mrList`/`issueList`. The field-name divergence (GitHub `resp.login`, GitLab `resp.username`) MUST
be fully absorbed by the adapter — the caller never sees either raw field name.

#### Scenario: Authenticated identity resolves to `{ username }` on both providers

- GIVEN a fixture representing a successful `/user` lookup (GitHub `{login: '<value>'}`, GitLab
  `{username: '<value>'}`)
- WHEN `whoami` is called against each provider's normalizer
- THEN the result is exactly `{ username: '<value>' }` (`deepEqual` on sorted keys) — no `login`
  or other raw field name leaks through

#### Scenario: Transport failure is asserted as a throw, not fabricated as a default identity

- GIVEN the underlying `runJson` call rejects on a non-zero exit or malformed JSON
- WHEN `whoami` is called against each provider's normalizer
- THEN the call is asserted via `assert.rejects` on both providers — `whoami` has no null-shape
  fallback, so a failed lookup surfaces as a rejection, not a fabricated `{username: null}`

*(Two scenarios, not three: `whoami` has no meaningful "empty" state — a single-user lookup either
resolves or the transport call rejects. A third scenario would only pad, not add information.)*

### Requirement: `commitStatus` contract shape assertion across providers

The system MUST have an automated contract test asserting that both provider normalizers
(`github`, `gitlab`) emit `commitStatus` results as either one member of the canonical enum
(`'success'|'failed'|'running'|'pending'|'canceled'`) or `null`, parameterized across both
providers, reusing the `jsonSpawnCallArgs` glue. `commitStatus` MUST reject (not resolve to
`null`) when the underlying `runJson` call fails — the same divergence family as `mrList`/
`issueList`, the opposite of `authCheck`/`authLogin`.

#### Scenario: A completed check maps to the correct enum value on both providers

- GIVEN a fixture representing a single completed check (GitHub `check_runs[0]` with
  `status:'completed', conclusion:'success'`; GitLab `arr[0]` with `status:'success'`)
- WHEN `commitStatus` is called against each provider's normalizer
- THEN the result equals the corresponding canonical enum value
- AND on GitHub, the two-field read is proven: an unfinished check (`status:'in_progress'`)
  normalizes from `status`, not `conclusion`, while a `completed` check normalizes from
  `conclusion`, not `status`
- AND GitHub's first-check-wins selection (`check_runs[0]`, chosen client-side from a multi-entry
  fixture) and GitLab's server-side `per_page=1` request are both proven to select the same
  single-check semantics by different means

#### Scenario: No computable status normalizes to `null`, including the undocumented neutral/skipped collapse

- GIVEN GitHub's `check_runs` array is empty and GitLab's status array is empty (`arr[0]` is
  `undefined`)
- WHEN `commitStatus` is called against each provider's normalizer
- THEN the result is `null` on both providers
- AND a completed GitHub check whose `conclusion` is `neutral` or `skipped` ALSO normalizes to
  `null` — indistinguishable from "no checks ran", an undocumented collapse this scenario locks
  explicitly rather than leaving implicit

#### Scenario: Transport failure is asserted as a throw, not fabricated as null

- GIVEN the underlying `runJson` call rejects on a non-zero exit or malformed JSON
- WHEN `commitStatus` is called against each provider's normalizer
- THEN the call is asserted via `assert.rejects` on both providers, matching the divergence
  already pinned for `mrList`/`issueList` and opposite `authCheck`/`authLogin`'s never-throws
  discipline

### Requirement: `projectResolve` identity assertion across both providers

The system MUST have an automated contract test asserting that `projectResolve` returns its
`project` argument unchanged, byte-for-byte, on both provider normalizers — the identity
extension point documented in `vcs-contract.md`.

#### Scenario: The returned slug is exactly the input slug on both providers

- GIVEN an arbitrary project slug string (e.g. `'owner/repo'` on GitHub, a URL-encodable path on
  GitLab)
- WHEN `projectResolve` is called against each provider's normalizer
- THEN the result strictly equals (`assert.equal`) the input, unchanged, on both providers — no
  transformation, encoding, or trimming occurs

*(Deviation: one scenario, not 2-3. `projectResolve` is a single-line synchronous identity return
(`return project`) with no branch, no transport, and no provider-specific behavior to diverge on.
A second or third scenario would re-run the identical assertion against a different string
literal — padding, not new information. Deliberate, not an oversight.)*

### Requirement: `repoCloneUrl` credential-position and host-default divergence across providers

The system MUST have an automated contract test asserting that `repoCloneUrl` embeds the token in
the exact provider-specific credential position, keeps the provider's user literal an
implementation detail invisible to the caller's inputs, and locks the GitHub-vs-GitLab host-default
divergence as current behavior (a production fix is out of scope for this slice).

#### Scenario: The token appears in the expected credential position; the user literal is provider-internal

- GIVEN a synthetic placeholder token (e.g. `'sample-tok-4f2'`, never a realistic secret) and a
  host/project pair
- WHEN `repoCloneUrl` is called against each provider's normalizer
- THEN GitHub's result contains `x-access-token:<token>@` immediately before the host, and
  GitLab's result contains `oauth2:<token>@` immediately before the host — mirroring the
  `authLogin` stdin-not-argv precedent (`vcs.contract.test.mjs:738-750`), applied here to string
  construction instead of spawn args

#### Scenario: A falsy `host` diverges — GitHub defaults to `github.com`, GitLab does not

- GIVEN `host` is omitted (falsy) from the call
- WHEN `repoCloneUrl` is called against each provider's normalizer
- THEN GitHub's result substitutes the literal `github.com` in the host position, AND GitLab's
  result passes the falsy `host` through unguarded, producing a URL with a broken host segment —
  locked as current behavior, not fixed in this slice (see proposal Risks)

### Requirement: `patSetupUrl` path/param shape and host-ignored-on-GitHub divergence across providers

The system MUST have an automated contract test asserting each provider's PAT-creation URL shape
and locking GitHub's divergence of ignoring the `host` parameter entirely.

#### Scenario: Each provider's URL path and query parameters match its actual shape

- GIVEN a `{host, name, scopes}` triple
- WHEN `patSetupUrl` is called against each provider's normalizer
- THEN GitHub's result is `https://github.com/settings/tokens/new?description=<name>&scopes=<scopes.join(',')>`
  and GitLab's result is `https://<host>/-/user_settings/personal_access_tokens?name=<name>&scopes=<scopes.join(',')>`
- AND the query-parameter KEY itself diverges for the same `name` argument (GitHub `description`,
  GitLab `name`) — an additional divergence this scenario locks alongside the path shape

#### Scenario: GitHub ignores `host` entirely — a latent GHES-breaking divergence, locked not fixed

- GIVEN a non-default `host` (e.g. a GitHub Enterprise Server hostname)
- WHEN `patSetupUrl` is called against GitHub's normalizer
- THEN the result still hardcodes `github.com`, never the passed `host` — locked as current
  behavior per the proposal's Risks table, not fixed in this slice
- AND GitLab's result DOES interpolate `host` correctly, so this is a one-sided divergence, not
  symmetric between providers

### Requirement: `whoami`/`commitStatus` fixture provenance

The system MUST provide `github-whoami-happy.json`, recorded from a real, non-mutating `gh api
/user` invocation, carrying `_provenance.recorded`. All other `whoami`/`commitStatus` fixtures
(`github-whoami-failure.json`, `gitlab-whoami-{happy,failure}.json`,
`{github,gitlab}-commitStatus-{happy,empty,failure}.json`) MUST be hand-authored and carry
`_provenance.derived` — GitLab has no reachable live session in this environment (the standing
deferral already documented for every other GitLab fixture in this suite), and a real
commit-status empty/failure fixture would require an unreliable live-repo state to reproduce
deterministically.

#### Scenario: Every new fixture passes provenance assertion

- GIVEN all ~10 new `whoami`/`commitStatus` fixtures (roughly 3 GitHub + 3 GitLab for
  `commitStatus`, 2 GitHub + 2 GitLab for `whoami`)
- WHEN `assertProvenance` runs against each
- THEN each carries exactly one of `_provenance.recorded` / `_provenance.derived`, never both,
  never neither

## MODIFIED Requirements

### Requirement: `vcs-contract.md` rows for the five verbs document this batch's locked divergences

The `vcs-contract.md` `Required verbs` table rows for `whoami` (row 26), `commitStatus` (row 35),
`repoCloneUrl` (row 36), `patSetupUrl` (row 37), and `projectResolve` (row 38) already document the
normalized shapes correctly. This change amends them to additionally document: (1)
`commitStatus`'s GitHub two-field read (`status` while running, `conclusion` once `completed`),
its first-check-wins selection (`check_runs[0]` client-side on GitHub vs. `per_page=1`
server-side on GitLab), the undocumented `neutral`/`skipped` → `null` collapse, and the
throw-on-failure semantics (matching `mrList`/`issueList`, opposite `authCheck`/`authLogin`); (2)
`repoCloneUrl`'s host-default divergence (GitHub defaults `github.com`, GitLab does not); (3)
`patSetupUrl`'s host-parameter-ignored-on-GitHub divergence and the `description`-vs-`name`
query-key mismatch. Each amended row MUST also gain an inline cross-reference to this change.

(Previously: rows 26/35-38 stated only the normalized return shapes with no divergence detail and
no cross-reference to a covering issue.)

#### Scenario: Documentation reflects the commitStatus two-field read, selection mechanism, and null-collapse

- GIVEN a reader consults the `vcs-contract.md` `commitStatus` row
- WHEN checking how GitHub selects and reads a single check's status
- THEN the row states GitHub reads `status` while running and `conclusion` once `completed`,
  selects `check_runs[0]` client-side, and that `neutral`/`skipped` conclusions collapse to the
  same `null` as "no checks ran"

#### Scenario: Documentation reflects the repoCloneUrl and patSetupUrl host divergences

- GIVEN a reader consults the `vcs-contract.md` `repoCloneUrl`/`patSetupUrl` rows
- WHEN checking whether host handling is identical across providers
- THEN the rows state it is not — GitHub defaults a falsy host to `github.com` in `repoCloneUrl`
  but ignores `host` entirely in `patSetupUrl`, while GitLab does not default in `repoCloneUrl`
  and correctly interpolates `host` in `patSetupUrl`
