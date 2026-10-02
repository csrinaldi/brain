# Proposal: the archive-sweep alarm must not close itself (#1235)

## Problem
`resolve-sweep` in `governance-postmerge.yml` ran on `steps.sweep.outcome == 'success'`. The sweep step
exits 0 after filing `governance:archive-sweep-failed`, so `alarm.mjs resolve` closed the alarm the same
run had just filed, citing its own URL (run 36938538725: alarm #1233 filed and closed in one run).

## Change
- `resolve-sweep` also requires `steps.sweep.outputs.alarm == ''`.
- A drift test pins the gate and that every alarm-filing path in `sweep` writes `alarm=`.
- `resolve-audit` is audited and pinned (no change needed).

## Release impact
The workflow is REFUSE-managed: `brain:upgrade` does not overwrite a consumer's edited copy. The next
CHANGELOG entry must tell consumers with an edited `governance-postmerge.yml` to apply the one-line gate by hand.

## Non-goals
No change to `alarm.mjs`, the sweep script, or permissions.
