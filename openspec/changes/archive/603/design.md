---
issue: 603
phase: design
---

# Design — #603

## D1 — one seam, already built

`mapDetectionToWarning(result, tier, gate)` exists and is exactly this
transform: it returns the result untouched unless `pass === false`, the result
is not `uncomputable`, AND `resolveGatePolicy(gate, tier) === 'detection'`.
Three guards, all already written. `run-check.mjs` simply never called it.

So the change is one call in `main()`, not a new mechanism. The gate NAME is
already `checkName`; the tier comes from `resolveTier(readConfig())`, the same
resolution the diff-size branch in this file already performs.

## D2 — where the call goes, and why not in `runCheck`

In `main()`, between `runCheck()` and `resultToExit()`. Not inside `runCheck`,
because that function returns the *evaluation*, and a caller that wants the raw
verdict (tests, future callers, a reporting surface) must be able to have it.
The softening is an EXIT-CODE policy, so it belongs where the exit code is
computed. `phase-order-check.mjs` makes the same split.

## D3 — the tier is read once, from the same source as the rest of the file

`resolveTier(loadConfig())`, matching `runDiffSizeCheck`'s existing resolution
rather than introducing a second path. An unreadable config degrades to
`standard` (REQ-TIER-10) — which is the SAFE direction here: an unknown tier
softens nothing.

## D4 — the spec becomes a statement over the emission table

`SCAFFOLD_DELIVERY` (contributor-scaffold.mjs) already maps
`github → .github/PULL_REQUEST_TEMPLATE.md` and
`gitlab → .gitlab/merge_request_templates/Default.md`. The spec quantifies over
its entries instead of naming one; the concrete GitHub path stays as an
example, so the requirement gains providers without losing precision.

## D5 — read the pinned exit codes, do not bulk-update them

Tests that assert exit 1 for a detection gate encode today's behaviour, which
this change deliberately alters. Each one is read: if it pins `required`-tier
behaviour it stays untouched; if it pins the defect it is updated with the
reason in the test's own words. A green suite obtained by editing assertions
until they agree is not evidence.
