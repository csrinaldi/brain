# Spec — Fix `checkContexts()` workflow-name prefix bug (issue #203)

## Requirement Index

| Req | Name | Testable |
|-----|------|----------|
| REQ-203-1 | `checkContexts()` returns bare check-run names | Unit (`node --test`) |
| REQ-203-2 | Static drift-guard: `checkContexts()` ↔ YAML REQUIRED job `name:` fields | Unit (`node --test`) |
| REQ-203-3 | `brain:protect` arm-and-verify: warn-not-fail, single note on zero runs | Unit (`node --test`), injectable `listCheckRuns` |
| REQ-203-4 | `WORKFLOW_NAME` removed (no legitimate consumer) | Static grep + unit (import must not export it) |

## REQ-203-1: Bare check-run names

`checkContexts()` MUST return `REQUIRED_JOBS` verbatim (order preserved, no prefix,
suffix, or transform). GitHub Actions' check-run identity is the job's `name:` field
alone; a `"{workflow} / {job}"` prefix produces a required context no check-run can
ever match, hard-blocking every PR to a protected branch.

[**unit-testable**: `checkContexts()` deep-equals `['issue-link', 'diff-size',
'local-checks', 'memory-gate', 'decision-gate']`.]

## REQ-203-2: Static wiring drift-guard

A unit test MUST parse `.github/workflows/governance.yml`, extract the REQUIRED
subset of job `name:` fields (in YAML order), and assert it deep-equals
`checkContexts()`. This MUST fail closed on divergence (turn red), so a future
regression is caught before merge — not discovered on a live PR as issue #203 was.

[**unit-testable**: mutate a copy of `checkContexts()` to reintroduce a prefix in a
throwaway REPL and confirm the guard fails; in the committed test it MUST pass against
the fixed implementation.]

## REQ-203-3: Arm-and-verify (warn, never fail)

After `branchProtect()` reports `{enforced:true}`, `brain:protect` MUST best-effort
verify the armed contexts against the branch's actual check-run names via an
injectable query function, and:

- Emit ONE warning line per required context with no matching check-run.
- Emit a SINGLE "unverifiable" note (not one warning per context) when the branch has
  zero check-runs at all.
- Never exit non-zero or throw because of this step — the branch-protection PUT already
  succeeded; this step is advisory only.

The check-run query function MUST be injectable so unit tests never invoke a real `gh`
process.

[**unit-testable**: `verifyArmedProtection()` with a fake `listCheckRuns` covering (a) a
missing required context → one warning logged; (b) all contexts present → no warning;
(c) zero runs → exactly one unverifiable note.]

## REQ-203-4: `WORKFLOW_NAME` removed

The `WORKFLOW_NAME` constant, its export, and comments describing it MUST be removed
from `governance-checks.mjs` once confirmed to have no consumer besides the fixed
`checkContexts()` and its own test.

[**unit-testable**: `governance-checks.mjs` no longer exports `WORKFLOW_NAME`; a
repo-wide grep for `WORKFLOW_NAME` under `brain/scripts/**` returns no matches.]
