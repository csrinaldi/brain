# Spec Delta — GitLab Provider Verbs + Provider-Agnostic labelEvents (slice A3)

> Ships the `labelEvents` contract verb (both providers, runtime-dispatched), the `m3` actor-check close,
> the GitLab `prView`/`mrCreate` un-stub over `gitlabApiFetch`, a shared parameterized contract suite, and
> the recorded-from-real fixture infrastructure. See [design.md](design.md).

## REQ-A3-1: `labelEvents` is a provider-agnostic CONTRACT verb returning a normalized shape (D1, R1)

`cli.mjs` `VERBS` (`cli.mjs:19-23`) and `brain/core/methodology/vcs-contract.md` (`:22-34`) MUST include a
`labelEvents` verb. BOTH providers MUST implement it. Its signature is
`({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ actor: { login },
action: 'add'|'remove', label, at }> | null>`. The array MUST be ordered chronologically ASCENDING (oldest
first) so the pure `evaluateActor`'s "last element = most recent" invariant (`actor-check.mjs:81`) holds
identically across providers. `null` signals uncomputable (a fetch failure), NEVER a fabricated `[]`. The
verb MUST NOT leak provider-specific field names (`iid`, `username`, `created_at`, `resource_label_events`)
to the caller.

#### Scenario: GitLab resource-label-events normalize to the shared shape

- GIVEN a GitLab issue whose `GET /projects/:id/issues/:iid/resource_label_events` response contains
  `{ user: { username: 'alice' }, action: 'add', label: { name: 'status::approved' }, created_at: T1 }`
- WHEN `gitlab.labelEvents({ project, number, apiBase, token, proxyUrl, fetchImpl })` runs
- THEN it returns `[{ actor: { login: 'alice' }, action: 'add', label: 'status::approved', at: T1 }]`,
  ascending by `at`, with no `username`/`created_at`/`iid` keys visible

#### Scenario: GitHub labeled/unlabeled events normalize to the shared shape

- GIVEN a GitHub `issues/N/events` response containing an `{ event: 'labeled', label: { name:
  'status:approved' }, actor: { login: 'bob' }, created_at: T1 }` entry
- WHEN `github.labelEvents({ project, number })` runs
- THEN it returns `[{ actor: { login: 'bob' }, action: 'add', label: 'status:approved', at: T1 }]`, and an
  `event: 'unlabeled'` entry maps to `action: 'remove'`

#### Scenario: an uncomputable fetch yields null, never a fabricated empty array

- GIVEN the underlying API call throws (network/CLI failure)
- WHEN `labelEvents(...)` runs on either provider
- THEN it returns `null` (uncomputable), NOT `[]` — a caller distinguishing "no events" from "couldn't
  fetch" (the DETECTION actor-check) MUST see the difference

## REQ-A3-2: GitHub's inline events fetch is EXTRACTED onto the verb, behavior-preserving (D1, R1)

`actor-check.mjs`'s `defaultFetchLabeledEvents` (`actor-check.mjs:161-175`) MUST be DELETED. Its exact
behavior — the Events API call with the LOAD-BEARING `--paginate` (unpaginated drops page-2+ events =
fail-open) — MUST move INTO `github.mjs#labelEvents` unchanged. Re-running `actor-check.test.mjs` after the
extraction MUST pass with NO change to its assertions (behavior preservation is the proof). GitHub's
`labelEvents` STAYS on the `gh` CLI.

#### Scenario: the extraction preserves --paginate and actor-check behavior

- GIVEN the pre-A3 `actor-check.test.mjs` suite
- WHEN GitHub's inline fetch is moved into `github.mjs#labelEvents` and `actor-check.mjs` calls the verb
- THEN `actor-check.test.mjs` passes unchanged, and `github.mjs#labelEvents` still requests the Events API
  with `--paginate`

## REQ-A3-3: `actor-check.mjs` dispatches `labelEvents` on runtime `ctx.provider`; the pure core is untouched (D1)

`gatherActorCheckInputs` (`actor-check.mjs:230-250`) MUST obtain labeled events via `getVcs({ provider:
ctx.provider }).labelEvents(...)` (the finding #14 runtime-dispatch pattern already used by
`run-check.mjs#defaultFetchIssue`, `:167-177`), threading `{ apiBase, token, proxyUrl }` from
`gitlabApiConfig()`. An injected `deps.fetchLabeledEvents` MUST still bypass dispatch (as tests do). The
pure `evaluateActor` (`:65-109`) MUST NOT change (REQ-L5-1 both-authors check `:97`, REQ-L5-2 empty→warn
`:72` preserved). `filterLabeledEvents` (`:157-159`) MUST become a shared post-filter keeping
`action === 'add' && label === approvedLabel`, applied to the normalized events of EITHER provider.

#### Scenario: a GitLab self-approval now EVALUATES to fail, not a permanent warn (R3)

- GIVEN a GitLab MR whose referenced issue's `status::approved` label was added by the issue author
- WHEN the actor-check runs on the GitLab runner (no `gh` binary present)
- THEN it dispatches `labelEvents` to the GitLab provider, `evaluateActor` returns `fail` (self-approval,
  REQ-L5-1), identical to the verdict GitHub would produce for the same shape — NOT the pre-A3 permanent
  `warn`

#### Scenario: the actor-check job REPORTS, it never blocks (DETECTION honesty)

- GIVEN the actor-check returns `fail` on GitLab
- WHEN the pipeline runs the actor-check job
- THEN the job is DETECTION / `allow_failure: true` — the failure is VISIBLE (red) but does NOT block the
  MR; no code path or artifact wording treats actor-check as blocking

#### Scenario: missing evidence still warns, never fails closed

- GIVEN `labelEvents` returns `null` or an empty add-filtered list
- WHEN `runActorCheck` runs
- THEN it returns `warn` (REQ-L5-2 — never fail on missing evidence), preserving the A2 degrade contract

## REQ-A3-4: GitLab `prView`/`mrCreate` are real direct-API verbs over `gitlabApiFetch`, config threaded (D2)

`gitlab.mjs`'s `prView` stub (`:79-82`) and `mrCreate` stub (`:221-224`) MUST be replaced with real
implementations over the shared `gitlabApiFetch` transport (`gitlab-api.mjs`). `{ apiBase, token, proxyUrl }`
MUST be threaded in as PARAMETERS from the caller (resolved by `ci-context.mjs#gitlabApiConfig`), with
LOCAL/non-CI defaults (public `gitlab.com` API base, `vcsToken()`, no proxy) exactly like A2's `issueView`
(`gitlab.mjs:62-72`). `gitlab.mjs` is a GATE_FILE and MUST NOT read `CI_API_V4_URL`/pipeline vars directly
(forbidden by `ci-context-drift-guard.test.mjs`). Both verbs MUST return the contract's normalized shapes
(`prView` → `{ number, labels, body, author }` with `null` fields on failure; `mrCreate` →
`{ url }` on success or `{ url: null, error }` on failure — never throws).

#### Scenario: prView returns normalized MR metadata over the shared transport

- GIVEN a GitLab MR fetched via `GET /projects/:id/merge_requests/:iid`
- WHEN `gitlab.prView({ project, number, apiBase, token, proxyUrl, fetchImpl })` runs
- THEN it returns `{ number, labels, body, author }` normalized (GL `iid`/`description`/`source_branch`
  hidden), and `null` fields when the fetch fails (uncomputable, never a fabricated empty)

#### Scenario: mrCreate posts and returns the URL, degrading gracefully on failure

- GIVEN valid `{ project, title, body, head, base, labels }`
- WHEN `gitlab.mrCreate(...)` runs against `POST /projects/:id/merge_requests`
- THEN it returns `{ url }` on success and `{ url: null, error }` on failure — never throwing — matching
  the GitHub `mrCreate` contract (`github.mjs:197-221`)

#### Scenario: the GATE_FILE reads no pipeline env directly

- GIVEN `gitlab.mjs` after A3
- WHEN it is inspected for `CI_API_V4_URL` / pipeline-var reads
- THEN it contains none — `{ apiBase, token, proxyUrl }` arrive only as parameters (drift-guard stays green)

## REQ-A3-5: One shared parameterized contract suite asserts parity over BOTH providers (D3)

A single shared, parameterized contract spec MUST assert the SAME contract (normalized shapes, `null`
semantics, ordering, never-throws) over BOTH providers for `labelEvents`, `prView`, and `mrCreate`. Parity
means IDENTICAL assertions applied to each provider — not two divergent test files. Every provider fetch
MUST be an injected `fetchImpl`/exec reading fixtures; the suite MUST NOT touch the live network in
`npm test`.

#### Scenario: both providers pass the same normalized-shape assertions

- GIVEN the shared contract suite parameterized over `['github', 'gitlab']`
- WHEN it runs `labelEvents`/`prView`/`mrCreate` against each provider's recorded fixtures
- THEN both providers satisfy the identical assertions (shape, ordering, `null` on uncomputable)

#### Scenario: the suite performs no live network I/O

- GIVEN `npm test`
- WHEN the contract suite runs
- THEN no real HTTP request or CLI process is spawned — all transport is the injected fixture reader

## REQ-A3-6: Fixtures are RECORDED from real APIs by a committed script; synthetic cases marked DERIVED (D4, R2)

A COMMITTED recording script MUST hit the real APIs ONCE (GitLab: the live mirror; GitHub: this repo) and
write raw JSON responses into a fixtures directory, each file STAMPED with its source `endpoint + date`. The
contract suite's injected `fetchImpl` MUST read these files (no live network in `npm test`). Cases that
cannot be recorded from a real API (synthetic edge cases — e.g. a fabricated self-approval that does not
exist on any real issue) MUST be marked `DERIVED`. Recorded-vs-derived MUST be ALWAYS visible in the
fixture set (lesson #12 — provenance is never ambiguous).

#### Scenario: recorded fixtures carry endpoint + date provenance

- GIVEN a fixture produced by the recording script
- WHEN it is inspected
- THEN it records the source `endpoint` and the recording `date`, and is distinguishable from a `DERIVED`
  (synthetic) fixture

#### Scenario: the recording script is committed and re-runnable

- GIVEN the repo after A3
- WHEN the recording script is located
- THEN it is committed (not a throwaway), documents which real endpoints it hits, and can be re-run to
  refresh the recorded fixtures without editing the contract suite
