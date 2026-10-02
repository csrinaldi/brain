# Design

## Gate
`if: steps.sweep.outcome == 'success' && steps.sweep.outputs.alarm == ''`. An unset step output
evaluates to the empty string, so a clean sweep (or a skipped nothing-to-do exit 0) still resolves.

## Sweep alarm paths
The sweep step files alarms at four sites (sweep failure, commit/push failure, no-App-token branch,
PR creation failure). Each calls `alarm.mjs "$label"` and is followed by `echo "alarm=${label}" >> "$GITHUB_OUTPUT"`.
The test counts filings against output writes, so a new path without the write fails.

## resolve-audit: no change
Its gate is `steps.audit.outputs.code == '0' && steps.advance.outcome == 'success'`.
- `window` alarm path ends `exit 2` (a failing step, no `always()` downstream except `terminal`), so `audit` never runs.
- `revert` is gated on code `'1'` and `uncomputable` on code `'2'`; both are mutually exclusive with code `'0'`.
- `revert`'s alarm paths end `exit 1` and `uncomputable` ends `exit 2`.
So no audit-class alarm can coexist with a true `resolve-audit` condition. Pinned by test.
