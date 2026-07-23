# CI Context Normalization Specification

## Purpose

Specifies the boundary of `brain/scripts/vcs/ci-context.mjs` — a single seam that detects
the CI provider and returns one **normalized context object** for a pipeline run, so every
governance gate consumes identical evidence regardless of provider (GitHub Actions, GitLab
CI, or local). This is a **design-only** delta (slice A0): it fixes the contract the module
must satisfy; the module itself is implemented in slice A1.

The spec enforces the OUTPUTS of the seam — the fields it guarantees per provider, and the
policy each gate class applies when a needed field is uncomputable — not the internal
implementation, which A1 chooses.

## Epic Invariant (restated — non-goal boundary)

`ci-context.mjs` MUST NOT let any governance gate branch on which provider, harness, or
agent produced the run. It normalizes provider-specific inputs into one shape **before**
any evaluator sees them; the evaluators inspect evidence, never the producing tool
(ADR-0015 Epic Invariant). Introducing the seam MUST NOT alter any pure evaluator
(REQ-CIC-4). The seam is a *gathering* refactor, not a behavior change.

## Requirement Index

| Req | Name | Testable |
|-----|------|----------|
| REQ-CIC-1 | `detectCi()` provider resolution | Unit (`node --test`) |
| REQ-CIC-2 | `loadContext()` normalized field guarantees per provider | Unit (`node --test`) |
| REQ-CIC-3 | Missing-variable behavior BY GATE TYPE (REQUIRED fail-closed / DETECTION warn) | Unit (`node --test`) |
| REQ-CIC-4 | Pure evaluators unchanged by the seam | Unit + file assertion |
| REQ-CIC-5 | GitLab MR description via one API call; proxy from standard env | Unit (`node --test`) |

> These are **design requirements** for slice A1 to satisfy. A0 produces no code; the
> `[unit-testable]` notes describe the tests A1 must write.

---

## Requirement REQ-CIC-1: `detectCi()` Provider Resolution

`ci-context.mjs` MUST export `detectCi()` returning exactly one of
`'github' | 'gitlab' | 'local' | 'unknown'`, resolved in **strict precedence order
`github` → `gitlab` → `unknown` → `local`** (first match wins): `GITHUB_ACTIONS === 'true'`
→ `'github'`; else `GITLAB_CI === 'true'` → `'gitlab'`; else `CI === 'true'` (the de-facto CI
marker) → `'unknown'`; else a git repo present → `'local'`. `'unknown'` MUST be evaluated
**before** `'local'` and MUST be distinct from it — a generic `CI=true` run in a git repo
resolves to `'unknown'`, never `'local'`.

[**unit-testable**: set/unset env markers via an injectable env seam; assert each branch]

#### Scenario: GitHub Actions detected

- GIVEN `GITHUB_ACTIONS` is `'true'`
- WHEN `detectCi()` runs
- THEN it returns `'github'`

#### Scenario: GitLab CI detected

- GIVEN `GITLAB_CI` is `'true'` and `GITHUB_ACTIONS` is unset
- WHEN `detectCi()` runs
- THEN it returns `'gitlab'`

#### Scenario: Local run distinguished from unknown CI

- GIVEN no `GITHUB_ACTIONS` and no `GITLAB_CI` marker, in a git repo
- WHEN `detectCi()` runs
- THEN it returns `'local'` (not `'unknown'`)

#### Scenario: Unsupported CI is unknown, not local

- GIVEN `CI` is `'true'` and neither `GITHUB_ACTIONS` nor `GITLAB_CI` is set
- WHEN `detectCi()` runs
- THEN it returns `'unknown'` (not `'local'`)

---

## Requirement REQ-CIC-2: `loadContext()` Normalized Field Guarantees

`ci-context.mjs` MUST export `loadContext()` returning an object with the fields
`{ provider, prNumber, baseSha, headSha, sourceBranch, targetBranch, labels, body,
author, isMergeRequest }`. Every field MUST be its value or `null` when the provider cannot
supply it. For `labels` (a `string[]`) and `body` (a `string`), `[]` / `''` mean *genuinely
none / empty* while `null` means **uncomputable** (the fetch failed); the two MUST be
distinguished — a `null` collapsed to `[]` / `''` would fail-open a REQUIRED gate (see
REQ-CIC-3). `baseSha` is defined as **the commit the diff is computed against** (the merge
base). `loadContext()` MUST NOT throw; an internal failure MUST yield `null` on the affected
fields, never an exception.

`author` MUST be sourced from the provider's PR/MR **API payload** (`author.login` on
GitHub, `author.username` on GitLab) — it MUST NOT be read from any environment variable.
Pipeline env (`GITLAB_USER_LOGIN`, `CI_MERGE_REQUEST_ASSIGNEES`, a workflow-set `PR_AUTHOR`)
identifies the pipeline trigger or an assignee, not the MR author, and diverges on re-runs
and foreign pushes. The payload is one the seam already reads (GitHub `prView()` extended
with `author`; GitLab the single MR call of REQ-CIC-5) — no extra request.

The per-provider source mapping MUST be:

| Field | GitHub source | GitLab source |
|-------|---------------|---------------|
| `prNumber` | `PR_NUMBER` | `CI_MERGE_REQUEST_IID` |
| `baseSha` | `BASE_SHA` | `CI_MERGE_REQUEST_DIFF_BASE_SHA` |
| `headSha` | `HEAD_SHA` | `CI_COMMIT_SHA` |
| `targetBranch` | `BASE_BRANCH` | `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` |
| `sourceBranch` | `GITHUB_HEAD_REF` (net-new) | `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME` |
| `labels` | `gh pr view --json labels` | MR API payload `labels[]` (**not** `CI_MERGE_REQUEST_LABELS` — frozen at pipeline creation) |
| `body` | `gh pr view --json body` / `PR_BODY` | one MR API call (REQ-CIC-5) |
| `author` | PR API payload `author.login` | MR API payload `author.username` |
| `isMergeRequest` | `GITHUB_EVENT_NAME==='pull_request'` (net-new) | `CI_MERGE_REQUEST_IID` present |

[**unit-testable**: feed fixture env objects for github and gitlab; assert the mapped
fields; assert `labels` / `body` are `null` on a simulated fetch failure and `[]` / `''` only
when genuinely empty; assert no throw on empty env]

#### Scenario: GitHub context is normalized

- GIVEN `GITHUB_ACTIONS=true`, `PR_NUMBER=193`, `BASE_SHA=aaa`, `HEAD_SHA=bbb`
- WHEN `loadContext()` runs
- THEN `provider` is `'github'`, `prNumber` is `193`, `baseSha` is `'aaa'`, `headSha` is `'bbb'`
- AND `labels` is a `string[]` (or `null` if the label fetch failed) and `body` is a `string` (or `null`)

#### Scenario: GitLab context is normalized to the same shape

- GIVEN `GITLAB_CI=true`, `CI_MERGE_REQUEST_IID=42`, `CI_MERGE_REQUEST_DIFF_BASE_SHA=ccc`, `CI_COMMIT_SHA=ddd`
- WHEN `loadContext()` runs
- THEN `provider` is `'gitlab'`, `prNumber` is `42`, `baseSha` is `'ccc'`, `headSha` is `'ddd'`
- AND the returned object has the identical field set as the GitHub case

#### Scenario: Missing field yields null, never a throw

- GIVEN a run where `BASE_SHA` / `CI_MERGE_REQUEST_DIFF_BASE_SHA` is unset
- WHEN `loadContext()` runs
- THEN `baseSha` is `null`
- AND no exception is raised

#### Scenario: Uncomputable labels/body are null; genuinely-empty are []/''

- GIVEN one run where the label/description fetch FAILS, and another for a PR that genuinely
  has no labels and an empty description
- WHEN `loadContext()` runs for each
- THEN on fetch failure `labels` is `null` and `body` is `null`
- AND on the genuinely-empty PR `labels` is `[]` and `body` is `''`

#### Scenario: Author comes from the API payload, not env

- GIVEN a run where a pipeline env var (`GITLAB_USER_LOGIN` / `CI_MERGE_REQUEST_ASSIGNEES`,
  or a stale `PR_AUTHOR`) differs from the MR/PR author in the API payload
- WHEN `loadContext()` resolves `author`
- THEN `author` is the API payload's author (`author.username` / `author.login`)
- AND no environment variable is consulted for it

---

## Requirement REQ-CIC-3: Missing-Variable Behavior By Gate Type

When a gate needs a context field that `loadContext()` returned as `null` (uncomputable
context), the gate's response MUST follow its class:

- A **REQUIRED_JOBS** consumer of the context (`issue-link`, `diff-size`, `memory-gate`,
  `decision-gate`) MUST **fail closed** — the gate fails; it MUST NOT exit 0. (The full
  `REQUIRED_JOBS` set in `governance-checks.mjs` L27 also includes `local-checks`, which
  consumes no PR/MR context and is therefore not a `ci-context` consumer.)
- A **DETECTION_JOBS** consumer (`phase-order`, `actor-check`, `brain-writes-reviewed`)
  MUST **degrade to `warn` with a documented reason** and exit 0.

A REQUIRED gate MUST NEVER silently exit 0 on uncomputable context. `ci-context.mjs` MUST
signal the uncomputable state as `null` (Decision: no fabricated default), leaving the
fail-closed/degrade decision to the gate. This split MUST match ADR-0015's verified
precedent (`run-check.mjs` fails closed on an uncomputable diff; `phase-order-check.mjs`,
`actor-check.mjs`, `brain-writes-reviewed.mjs` degrade to warn).

[**unit-testable**: feed each gate a context with the needed field `null`; assert
REQUIRED gates return fail / non-zero and DETECTION gates return warn / exit 0 with a
reason string]

#### Scenario: Required gate fails closed on uncomputable context

- GIVEN `loadContext()` returns `baseSha: null` / `headSha: null`
- WHEN a REQUIRED gate (`diff-size` or `decision-gate`) evaluates
- THEN it fails closed (non-zero) with a "cannot compute — failing closed" reason
- AND it does NOT exit 0

#### Scenario: decision-gate fails closed when labels are uncomputable

- GIVEN `loadContext()` returns `labels: null` (the label fetch failed — distinct from `[]`)
- WHEN `decision-gate` (REQUIRED) evaluates
- THEN it fails closed with a "cannot fetch labels" reason — it MUST NOT read the absence of a
  `decision` label as "not a decision PR" and exit 0
- AND the same fail-closed-on-`null` holds for `diff-size` (`size:exception`) and
  `memory-gate` (`skip:memory-gate`), and for `issue-link` on `body: null`

#### Scenario: Detection gate degrades to warn on uncomputable context

- GIVEN `loadContext()` returns `baseSha: null` / `headSha: null`
- WHEN a DETECTION gate (`phase-order`) evaluates
- THEN it degrades to `warn` with a documented reason and exits 0

#### Scenario: No silent pass in a required gate

- GIVEN any REQUIRED gate with an uncomputable needed field
- WHEN it evaluates
- THEN it never returns a passing/exit-0 result without having evaluated

---

## Requirement REQ-CIC-4: Pure Evaluators Unchanged By The Seam

Introducing `ci-context.mjs` MUST NOT change any pure governance **evaluator**
(`evaluateActor`, the phase-order rule, `adrPresence`, `memoryPresence`, `diffSize`,
`issueLink`). These evaluators take their inputs as plain arguments, not from the
environment; the seam changes only how the thin **wrapper** gathers those arguments.
Evaluator signatures, bodies, and existing fixtures MUST remain byte-identical after A1.

[**unit-testable**: after A1, the evaluators' existing test suites pass unmodified; a file
assertion confirms no evaluator source imports `ci-context.mjs` (only wrappers do)]

#### Scenario: Evaluator suites pass unmodified

- GIVEN slice A1 has wired the wrappers to `ci-context.mjs`
- WHEN the existing evaluator unit tests run
- THEN they pass without any change to the evaluator sources or their fixtures

#### Scenario: Only wrappers depend on the seam

- GIVEN the A1 diff is inspected
- WHEN evaluator source files are checked for a `ci-context.mjs` import
- THEN no pure evaluator imports it; only the thin wrappers do

---

## Requirement REQ-CIC-5: GitLab MR API Call — Body, Author, Labels In One Request, Proxy From Env

For GitLab, the MR `body`, `author`, and `labels` MUST be fetched with exactly **one** API call
(`glab api .../merge_requests/:iid` or the equivalent raw REST
`GET /projects/:id/merge_requests/:iid`), authenticated with `VCS_TOKEN`. That single call
yields `author.username`, the MR description, and the live `labels[]` (REQ-CIC-2) — the three
share **one** request, never three. The corporate
proxy MUST be read from the standard `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`
environment — it MUST NOT be hard-coded. A failure of this call MUST yield `body: null`,
`labels: null`, and `author: null` (MUST NOT throw, MUST NOT fall back to the stale
`CI_MERGE_REQUEST_LABELS`). Because `body` and `labels` are consumed by REQUIRED gates
(`issue-link` parses `body`; `diff-size` / `memory-gate` / `decision-gate` read `labels`),
those gates MUST fail closed on the resulting `null` — never exit 0.

[**unit-testable**: stub the API call via an injectable fetch seam; assert single
invocation, `VCS_TOKEN` auth header, proxy read from env not a literal, and
`body: null` / `labels: null` / `author: null` on failure (no fallback to `CI_MERGE_REQUEST_LABELS`)]

#### Scenario: MR description fetched with token auth

- GIVEN a GitLab run with `CI_MERGE_REQUEST_IID` and `VCS_TOKEN` set
- WHEN `loadContext()` gathers `body`
- THEN exactly one API call is made, authenticated with `VCS_TOKEN`

#### Scenario: Proxy is read from standard env, never hard-coded

- GIVEN `HTTPS_PROXY` is set in the environment
- WHEN the MR description call is made
- THEN the request honors the env proxy and no proxy host is hard-coded in source

#### Scenario: MR API call failure yields null (fails REQUIRED gates closed), never throws

- GIVEN the MR API call fails (network / proxy / 5xx)
- WHEN `loadContext()` runs
- THEN `body`, `labels`, and `author` are each `null`, and no exception is raised
- AND no fallback to `CI_MERGE_REQUEST_LABELS` occurs
- AND a REQUIRED gate consuming `body` / `labels` fails closed (never exit 0)
