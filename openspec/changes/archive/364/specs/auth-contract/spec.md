# Delta for auth-contract

Issues #364 (`authLogin`, rank 5) and #365 (`authCheck`, rank 6) — M10 Phase 2. Both verbs are
local/interactive-only (no CI caller) per the epic's framing, but uncovered per the #336 audit —
zero contract-parity coverage and zero per-provider unit coverage exist for either today. New
capability spec, sibling to `mrlist-contract`, `issueList-contract`, `vcs-pr-reviews-contract`.

**Correction to the originating task brief, verified before this spec was written:** the brief
assumed `authLogin -> { username, email, apiBase }` and `authCheck -> { username }`. Both
`brain/core/methodology/vcs-contract.md` rows 24–25 and both provider implementations
(`github.mjs:20-28`, `gitlab.mjs:22-29`) show the real, documented contract is `-> boolean` for
both verbs — `run()`-based, never `runJson()`-based, and never throws (a non-zero exit normalizes
to `false`, it does not reject). This spec asserts the real contract; see `design.md` for the full
verification trail.

## ADDED Requirements

### Requirement: `authCheck` contract shape assertion across providers

The system MUST have an automated contract test asserting that both provider normalizers
(`github`, `gitlab`) emit `authCheck` results as a plain boolean — `true` when the underlying CLI
call exits zero, `false` otherwise — parameterized across both providers in
`vcs.contract.test.mjs`, following the existing loop pattern. `authCheck` MUST NEVER reject or
throw regardless of the underlying CLI's exit status.

#### Scenario: Authenticated session returns exactly `true`

- GIVEN a fixture representing a successful `gh auth status` / `glab auth status` invocation (exit 0)
- WHEN `authCheck` is called against each provider's normalizer
- THEN the result is `true` (`assert.equal`, not merely truthy)

#### Scenario: Unauthenticated or failed check returns exactly `false`, never throws

- GIVEN a fixture representing a failed `gh auth status` / `glab auth status` invocation (non-zero exit)
- WHEN `authCheck` is called against each provider's normalizer
- THEN the result is `false` (`assert.equal`, not merely falsy)
- AND the call resolves — it does not reject or throw — the opposite divergence from
  `mrList`/`issueList`, which are pinned as throwing

#### Scenario: Host-argument divergence is locked per provider

- GIVEN `host` is omitted from the call
- WHEN the underlying spawn call is inspected
- THEN GitHub's argument list omits `--hostname` entirely (its `authCheck` branches on a falsy
  `host`), AND GitLab's argument list always includes `--hostname` followed by the (possibly
  `undefined`) `host` value — GitLab's implementation does not branch

### Requirement: `authLogin` contract shape assertion across providers

The system MUST have an automated contract test asserting that both provider normalizers
(`github`, `gitlab`) emit `authLogin` results as a plain boolean — `true` when the underlying CLI
login call exits zero, `false` otherwise — parameterized across both providers, following the
same loop pattern as `authCheck`. `authLogin` MUST NEVER reject or throw regardless of the
underlying CLI's exit status.

#### Scenario: Successful login returns exactly `true`

- GIVEN a fixture representing a successful `gh auth login --with-token` / `glab auth login
  --stdin` invocation (exit 0)
- WHEN `authLogin` is called against each provider's normalizer
- THEN the result is `true`

#### Scenario: Failed login returns exactly `false`, never throws

- GIVEN a fixture representing a failed login invocation (non-zero exit)
- WHEN `authLogin` is called against each provider's normalizer
- THEN the result is `false`, and the call resolves — it does not reject

#### Scenario: The token is delivered via stdin, never via argv, on both providers

- GIVEN a token string is passed to `authLogin`
- WHEN the underlying spawn call's arguments and options are inspected
- THEN the token appears only in the spawn options' `input` field (stdin) on both providers, and
  the token string does not appear anywhere in the argument array — a real credential-leak guard,
  not decoration

#### Scenario: Host-default divergence is locked per provider

- GIVEN `host` is omitted from the call
- WHEN the underlying spawn call's argument list is inspected
- THEN GitHub's argument list substitutes the literal default `'github.com'`, AND GitLab's
  argument list passes the omitted `host` value through unguarded (no default substitution)

### Requirement: `authCheck`/`authLogin` fixture provenance

The system MUST provide `github-authCheck-happy.json`, recorded from a real, non-mutating `gh auth
status` invocation, carrying `_provenance.recorded`. All other fixtures —
`github-authCheck-failure.json`, both `gitlab-authCheck-{happy,failure}.json`, and all four
`{github,gitlab}-authLogin-{happy,failure}.json` — MUST be hand-authored and carry
`_provenance.derived`, because: (a) forcing a real authentication failure would require logging
out of the live session used elsewhere in this suite's recording, an unacceptable side effect; (b)
no live `glab` session is reachable from this environment (the standing constraint already
documented for every other GitLab fixture in this suite); and (c) `authLogin` is a MUTATING verb on
both providers — recording it live would overwrite the sandbox's real stored credentials, the same
reason `github-mrCreate-happy.json` is derived rather than recorded.

#### Scenario: Every fixture passes provenance assertion

- GIVEN all eight `authCheck`/`authLogin` fixtures (four GitHub, four GitLab)
- WHEN `assertProvenance` runs against each
- THEN each carries exactly one of `_provenance.recorded` / `_provenance.derived`, never both,
  never neither

#### Scenario: The recorded fixture is honest about what the contract actually reads

- GIVEN `github-authCheck-happy.json`
- WHEN inspected against `github.mjs#authCheck`'s implementation
- THEN the fixture's `status` field is the only field the verb's return value depends on — the
  recorded `stdout`/`stderr` text is preserved as real evidence of a live invocation but is not
  itself asserted on by the contract test, and this is documented in-fixture, not left implicit

## MODIFIED Requirements

### Requirement: `vcs-contract.md` `authCheck`/`authLogin` rows document the host-argument-building divergence

The `vcs-contract.md` `Required verbs` table rows for `authCheck` (row 24) and `authLogin` (row
25) already document the `-> boolean` shape correctly. This change amends both rows to additionally
document: (1) `authCheck`'s host-argument divergence — GitHub omits `--hostname` when `host` is
falsy, GitLab always includes it; (2) `authLogin`'s host-default divergence — GitHub defaults to
`'github.com'` when `host` is omitted, GitLab does not default; (3) that the token is delivered via
stdin on both providers, never via argv.

(Previously: both rows stated only the normalized boolean return shape and a one-line parameter
description, silent on the host-handling asymmetry and the stdin-delivery guarantee.)

#### Scenario: Documentation reflects the host-argument-building divergence

- GIVEN a reader consults the `vcs-contract.md` `authCheck`/`authLogin` rows
- WHEN checking whether host-argument construction is identical across providers
- THEN the rows state explicitly that it is not — GitHub conditionally omits `--hostname`
  (`authCheck`) or defaults it (`authLogin`), GitLab never does either
