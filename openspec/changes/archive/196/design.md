# Design — CI Context Normalization Implementation (slice A1)

> Records the CP-A1 ruling's three amendments to the CP-A0-APPROVED contract
> ([issue-193-ci-context-design/design.md](../issue-193-ci-context-design/design.md)).
> The A0 contract (Decisions 1–5) is unchanged and is not restated here except where
> an amendment modifies it.

## Amendment 1 — `repo` field

A0's `loadContext()` contract did not include a normalized `repo` field, but three of
the five wrappers already resolve the repo slug from provider env
(`actor-check.mjs`, `brain-writes-reviewed.mjs` read `GITHUB_REPOSITORY` directly).
CP-A1 folds `repo` into the normalized object:

| Field | GitHub source | GitLab source |
|-------|---------------|----------------|
| `repo` | `GITHUB_REPOSITORY` (`owner/repo` slug) | `CI_PROJECT_PATH` (`group/project` path) |

This closes the last direct-env read in the 4 wrappers (`ctx.repo` replaces
`process.env.GITHUB_REPOSITORY` everywhere) and is covered by the drift-guard test
(amendment/ruling 2, below).

## Amendment 2 — PR_BODY binary policy

A0's Decision 3 table noted `PR_BODY` as a historical "env fallback" source for
`body` (`actor-check.mjs` L220), without pinning how that fallback interacts with the
seam's `null`-on-uncomputable contract. CP-A1 makes the policy binary and load-bearing:

- `loadContext()`'s `body` field is **always API-primary** — it is populated from
  `prView()` (GitHub) or the single MR call (GitLab), **never** mixed with `PR_BODY`.
  A failed fetch yields `body: null`, full stop.
- **REQUIRED consumers** (e.g. `issue-link`, which parses `body` for
  `Closes/Fixes/Resolves #N`) MUST read `ctx.body` directly and MUST NEVER read
  `PR_BODY` — on `null` they fail closed (REQ-CIC-3), exactly as they do for any other
  uncomputable REQUIRED field. `PR_BODY` is never consulted on this path.
- **DETECTION consumers** (e.g. `actor-check.mjs`, which only needs `body` to extract
  an issue number for its own best-effort self-approval check) MAY fall back to
  `PR_BODY` when `ctx.body` is `null` — via `resolveDetectionBody(ctx, deps)`, the
  **only** sanctioned place this fallback is read. This keeps the "only
  `ci-context.mjs` reads pipeline env" invariant intact: the actual `process.env.PR_BODY`
  read lives inside `ci-context.mjs`, even though a DETECTION wrapper calls the helper.
- A genuinely empty API body (`''`) is a **real value**, not "uncomputable" — it must
  never be overridden by a stale `PR_BODY`.

This is tested directly (`ci-context.test.mjs`): API-fail + `PR_BODY` set →
`ctx.body` stays `null` (a REQUIRED consumer reading `ctx.body` directly fails closed,
ignoring `PR_BODY`); `resolveDetectionBody()` on that same `null` falls back to
`PR_BODY` (the DETECTION-only path).

## Amendment 3 — DETECTION two-case rule

REQ-CIC-3 already states DETECTION consumers "degrade to warn + a documented reason"
on uncomputable context. CP-A1 makes explicit that a DETECTION gate has **two**
distinct terminal outcomes, not one, and both must exit differently:

1. **Uncomputable context** (a needed field is `null` — the seam could not determine
   it) → **warn + exit 0** with a reason string documenting *why* it could not be
   verified. Ground truth: `actor-check.mjs`'s "no labeled event found" branch
   (`evaluateActor`, L63-69) and `runActorCheck`'s "author/repo not set" branch
   (L225-230) — both `warn`, both exit 0, both because the evidence needed to prove
   OR disprove the finding is simply absent.
2. **A real finding** (the evidence was computable and shows the violation the gate
   checks for) → **visible fail** (non-zero exit for `main()`'s CLI purposes) but the
   job stays **non-required** at the CI level (`DETECTION_JOBS`, not `REQUIRED_JOBS` —
   `governance-checks.mjs` L36) — it does not block the merge on its own, but it is
   never silently swallowed into a `pass`. Ground truth: `evaluateActor`'s
   self-approval branch (L88-94, `level: 'fail'`) and `main()`'s exit-code mapping
   (`result.level === 'fail' ? 1 : 0`, L258) — a real self-approval finding **does**
   propagate as a failing exit code from the script itself, distinct from case 1's
   warn/exit-0.

The distinction matters because collapsing case 2 into case 1 ("can't be sure, so
warn") would silently hide a genuine, provable self-approval; collapsing case 1 into
case 2 ("no evidence, so fail") would violate REQ-L5-2's zero-false-positive goal and
fail PRs on missing data rather than missing compliance. Both existing evaluators
(`evaluateActor`, `evaluateBrainWritesReviewed`) already implement this two-case split
correctly — A1 does not change them (REQ-CIC-4); this amendment only names the pattern
so future DETECTION gates copy it deliberately rather than by accident.

## Amendment 4 — actor-check gets `PR_NUMBER` so `author` comes from the API (CP-A1 Rev 2)

A CP-A1 review caught a real BLOCKER: the refactor moved `actor-check`'s `author` from
`process.env.PR_AUTHOR` (which the actor-check job set) to `ctx.author` (populated only via
`prView`, which runs only when `PR_NUMBER` is set). The actor-check job did not set
`PR_NUMBER`, so `author` → `null` and L5 self-approval detection silently no-op'd on every
GitHub PR — invisible to the injected-`ctx` tests.

**Resolution (Rev 2):** honor **ADR-0016 Never-do #3** ("Never source the MR/PR author from an
environment variable") rather than contradict the accepted doctrine in code. The actor-check
job in `governance.yml` now sets `PR_NUMBER: ${{ github.event.pull_request.number }}` (the job
already carries `GH_TOKEN`), so `prView` runs and `author` arrives from the API as the ADR
mandates. The earlier `PR_AUTHOR` fallback is removed from `ci-context.mjs` entirely; the
drift-guard covers `PR_AUTHOR` again with no exception, and a new wiring test asserts the job
provides `PR_NUMBER`. An accepted ADR that were genuinely wrong would be changed by a **human
ADR amendment**, not silently overridden in code — that override is the drift this system fights.

## `prView()` fix-at-source disposition

A0's Decision 2 already specifies that `prView()` distinguishes `null` (uncomputable)
from `[]`/`''` (genuinely empty) on failure — the one deliberate behavior change from
the pre-seam contract. A1 implements that in `providers/github.mjs`, and additionally
closes the one place that change could be silently undone: `brain-audit.mjs`'s PR
metadata gather (L189-199 pre-A1) collapsed `pr.labels`/`pr.body` back to `[]`/`''`
via `?? []` / `?? ''` before handing them to `shouldSkipSize()`/`selectIssueLinkBody()`
(`audit-helpers.mjs`). Both of those pure helpers already treat `null` correctly
(`shouldSkipSize(null) === false`; `selectIssueLinkBody(null, commitBody)` falls back
to the commit body) — the only fix needed was to stop fabricating a default *before*
the null reached them, so the fix "dies at source" (in `prView()`) rather than being
silently re-introduced on this parallel (audit) consumption path.
