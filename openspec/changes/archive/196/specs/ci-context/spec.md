# CI Context Normalization Specification — Delta (slice A1)

> Delta over [issue-193-ci-context-design/specs/ci-context/spec.md](../../../issue-193-ci-context-design/specs/ci-context/spec.md)
> (REQ-CIC-1..5, CP-A0-APPROVED). This delta adds the `repo` field to REQ-CIC-2 and
> the PR_BODY binary policy scenarios (amendment 2), per the CP-A1 ruling recorded in
> `../../design.md`.

## Delta to REQ-CIC-2: `repo` field mapping

`loadContext()`'s normalized object additionally guarantees a `repo` field: the
`"owner/repo"` (GitHub) or `"group/project"` (GitLab) slug, or `null` if
uncomputable.

| Field | GitHub source | GitLab source |
|-------|---------------|----------------|
| `repo` | `GITHUB_REPOSITORY` | `CI_PROJECT_PATH` |

#### Scenario: `repo` is normalized per provider

- GIVEN `GITHUB_ACTIONS=true`, `GITHUB_REPOSITORY=org/repo`
- WHEN `loadContext()` runs
- THEN `repo` is `'org/repo'`

- GIVEN `GITLAB_CI=true`, `CI_PROJECT_PATH=group/project`
- WHEN `loadContext()` runs
- THEN `repo` is `'group/project'`

#### Scenario: `repo` is null when uncomputable

- GIVEN no `GITHUB_REPOSITORY` / `CI_PROJECT_PATH` set
- WHEN `loadContext()` runs
- THEN `repo` is `null`, never an empty string or a fabricated default

## Delta to REQ-CIC-2: GitHub `author` is API-only; actor-check job provides PR_NUMBER (CP-A1 Rev 2)

GitHub `author` MUST be sourced from the `prView` API payload (`author.login`) ONLY — NEVER
from any environment variable (ADR-0016 Never-do #3). So the author is computable in the
actor-check gate, the actor-check job in `governance.yml` MUST set
`PR_NUMBER: ${{ github.event.pull_request.number }}` so `prView` runs. When `PR_NUMBER` is
absent, `author` is `null` (uncomputable), never an env value.

#### Scenario: author is null (not PR_AUTHOR) when no PR_NUMBER

- GIVEN `GITHUB_ACTIONS=true`, `PR_AUTHOR=alice`, and no `PR_NUMBER`
- WHEN `loadContext()` runs
- THEN `author` is `null` — it MUST NOT be read from `PR_AUTHOR` env

## New requirement: PR_BODY binary policy (amendment 2)

`body` on the normalized context is **API-primary only** — `loadContext()` never
reads `PR_BODY` (or any env var) to populate it. A REQUIRED consumer of `body`
(e.g. `issue-link`) MUST read `ctx.body` directly and MUST NEVER read `PR_BODY`; on
`ctx.body === null` it fails closed per REQ-CIC-3, regardless of any `PR_BODY` value
present in the environment. A DETECTION consumer (e.g. `actor-check`) MAY fall back
to `PR_BODY` via `resolveDetectionBody(ctx, deps)` — the only sanctioned reader of
`PR_BODY` — when `ctx.body` is `null`.

#### Scenario: API failure + PR_BODY set — a REQUIRED-style consumer fails closed, ignoring PR_BODY

- GIVEN the PR body API fetch fails (`ctx.body` resolves to `null`)
- AND `PR_BODY` is set in the environment to a value containing `Closes #N`
- WHEN a REQUIRED consumer reads `ctx.body` directly
- THEN it observes `null` and fails closed — `PR_BODY` is never consulted

#### Scenario: API failure + PR_BODY set — a DETECTION consumer falls back

- GIVEN the same uncomputable `ctx.body === null`
- WHEN a DETECTION consumer calls `resolveDetectionBody(ctx, deps)`
- THEN it receives the `PR_BODY` value as a best-effort fallback

#### Scenario: Genuinely empty API body is not overridden

- GIVEN the API succeeds and returns a genuinely empty body (`ctx.body === ''`)
- AND `PR_BODY` is set to a non-empty value
- WHEN `resolveDetectionBody(ctx, deps)` is called
- THEN it returns `''` (the real API value) — `PR_BODY` never overrides a genuine
  (non-null) value, empty or not
