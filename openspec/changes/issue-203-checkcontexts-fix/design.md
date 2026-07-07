# Design — Fix `checkContexts()` workflow-name prefix bug (issue #203)

## Decision 1 — bare job names, not "{workflow} / {job}"

`checkContexts()` now returns `[...REQUIRED_JOBS]` verbatim. GitHub Actions' check-run
identity is the job's own `name:` field; the workflow name is a UI grouping label only.
The erroneous comments claiming otherwise (module header + JSDoc) are corrected in the
same commit as the code fix, since a stale comment restating the wrong mental model is
exactly what let the bug ship unnoticed.

## Decision 2 — drift-guard mirrors the existing YAML pattern

`governance-checks.test.mjs` already has a drift-guard that parses `governance.yml` and
asserts `GOVERNANCE_JOBS` (the REQUIRED ∪ DETECTION union) matches the YAML `name:`
fields. That guard protects the job **list**, but never asserted anything about what
`checkContexts()` itself returns versus the literal YAML — so it did not, and could not,
have caught this bug. The new drift-guard test filters the YAML job names down to the
REQUIRED subset (preserving YAML order) and asserts `checkContexts()` equals that array
exactly. Any future re-introduction of a prefix, suffix, or other transform turns this
test red immediately.

## Decision 3 — arm-and-verify: warn, never fail; single note on zero runs

**Mechanism.** After `providerModule.branchProtect()` returns `{enforced:true}`,
`brain-protect.mjs` calls a new `verifyArmedProtection({ checks, project, branch,
listCheckRuns, log })` helper (exported, independently unit-tested). It:

1. Calls the injected `listCheckRuns({ project, branch })` to fetch the check-run names
   reported for the branch's latest commit.
2. Delegates classification to `diffArmedChecks(requiredContexts, existingCheckRunNames)`
   (pure, in `governance-checks.mjs`, alongside `checkContexts()` since both are about
   the required-contexts contract):
   - `existingCheckRunNames.length === 0` → `{ unverifiable: true, missing: [] }`. A
     freshly protected branch (or one with no PR yet) legitimately has zero check-runs;
     treating that as N missing-context warnings would be false-positive noise on every
     first arm. One "unverifiable — check again after the first PR" note is emitted
     instead.
   - Otherwise → `{ unverifiable: false, missing: [...contexts not present] }`, and one
     WARNING line is logged per missing context (never a hard failure/non-zero exit —
     branch protection was already armed successfully; this step is advisory).

**Why warn, not fail:** the PUT to GitHub's branch-protection API already succeeded by
the time this step runs. Failing the command here would falsely suggest the arm itself
failed, when the actual (and only fixable-by-a-human) signal is "double-check your job
names," which a warning conveys without blocking the operator's workflow.

**Dependency injection.** `listCheckRuns` is a plain injected async function — no `gh`
process is ever spawned in `verifyArmedProtection`'s own tests. The production wiring in
`activateProtection()` passes `providerModule.checkRuns` (GitHub) when the provider
exposes it, or a no-op `async () => []` otherwise (GitLab today) — which degrades
gracefully to the single "unverifiable" note rather than crashing or silently skipping
verification.

`checkRuns({ project, branch })` (GitHub-only, `providers/github.mjs`) is deliberately
**not** added to `vcs-contract.md`'s required-verb table: it is a best-effort,
provider-optional convenience for this one CLI's advisory step, not a normalized verb
every provider must implement (unlike `branchProtect`, `commitStatus`, etc.). It never
throws — a fetch failure degrades to `[]`, same as "no runs yet."

## Decision 4 — `WORKFLOW_NAME` disposition: remove

Grepped `brain/scripts/**` (code + tests) for `WORKFLOW_NAME`: the only consumers were
the buggy `checkContexts()` prefix and a test asserting its literal value
(`'governance'`). No logging, display, or other legitimate use exists. Removed the
constant, its export, and its module-header/JSDoc mentions in the same commit as the
`checkContexts()` fix.
