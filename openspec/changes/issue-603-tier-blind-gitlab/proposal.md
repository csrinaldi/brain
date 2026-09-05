---
issue: 603
phase: proposal
---

# Proposal — the tier reaches both providers, and the spec stops naming one

## Intent

A `lite` consumer on GitLab is blocked today by two gates doctrine defines as
`detection`. Fix it where the divergence actually lives — in the shared
checker, not in one provider's YAML — so both providers get the same answer
from one implementation.

## What was measured (main @ e49faf60)

1. `memory-gate` and `phase-order` resolve to **`detection`** at `lite`
   (`GATE_MATRIX`, governance-tiers.mjs).
2. **REQ-TIER-3's own scenario** (openspec/specs/governance-tiers/spec.md:100)
   is normative: *"every job whose lite policy is `detection` **exits 0** with a
   warning annotation stating the tier as the reason."*
3. `run-check.mjs` — the entrypoint for `memory-gate`, `decision-gate`,
   `issue-link`, `diff-size` — contains **zero** calls to
   `mapDetectionToWarning`. `main()` is `runCheck()` + `resultToExit()`, with no
   tier between them, and `resultToExit({pass:false})` is `1`.
4. `phase-order-check.mjs` and `actor-check.mjs` DO route through the helper —
   run-check is the outlier, not the rule.
5. `brain/scripts/ci/gitlab-governance.yml` carries **zero** `allow_failure:`
   across its eight jobs (the three matches are header prose).

So: at `lite`, a failing `memory-gate` exits 1. On GitHub that is red-but-not-
required, because branch protection filters it. On GitLab there is no such
layer — the MR is blocked by a gate the tier says is advisory.

## Why the fix is NOT `allow_failure:` in the fragment

The fragment is static YAML and cannot resolve a tier. Adding `allow_failure`
would hardcode one tier's answer into one provider's file — a second
declaration of what `GATE_MATRIX` already owns, drifting the moment a policy
changes, and leaving GitHub still exiting 1 where doctrine says 0.

Routing `run-check.mjs` through the existing shared helper fixes the exit code
ONCE, for every provider and every caller, and makes
`brain:governance-status` — the command brain tells consumers to trust — finally
agree with what their pipeline does.

## Scope

1. `run-check.mjs` applies `mapDetectionToWarning(result, tier, gate)` before
   computing its exit code. Behaviour changes ONLY where the policy is
   `detection`; `required` gates are untouched, and `uncomputable` keeps
   failing closed (the helper already refuses to soften either).
2. `openspec/specs/governance/spec.md`: REQ-S1-2 and the managed-array
   requirement become provider-neutral, stated over `SCAFFOLD_DELIVERY` —
   already the one source, with `github` and `gitlab` entries.
3. The GitLab fragment's header states where tier resolution now happens, so
   the next reader does not go looking for `allow_failure`.

## Non-goals

No new config key, no tier table change, no change to which gates exist. The
`decision-gate` label-conditional wording in the same spec files stays with
#600, which owns that claim.

## Risks

- A `detection` gate that used to exit 1 now exits 0. That is the point, and it
  is what REQ-TIER-3 already requires — but it is a real behaviour change on
  GitHub too, and the tests that pin today's exit codes must be read, not
  bulk-updated.
