---
status: draft
issue: 518
epic: 313
---

# Proposal — two of rung 3's three residuals

#518 carries three residuals from #462. This closes **(1)** and **(3)**. **(2) is a
decision and is deliberately left open** — see below.

## (3) No `workflow_dispatch` — one line

`governance-postmerge.yml` fired on `push` to `main` and a daily `schedule`. A halted
cursor could therefore only be re-run by pushing to `main` or waiting for 06:00 UTC — and
a halt is precisely the state in which nobody wants to push to `main` to find out whether
it recovered. #462 was a 12-day rung-3 outage found by hand.

No `inputs:`. The window comes from the **cursor**, never from a caller-supplied range
(REQ-D2-1, the skip-over theorem): an operator-chosen range could silently skip an offender
that landed while an earlier run was pinned, which is the one thing the cursor model exists
to prevent.

## (1) The printed remedy was not a runnable command

Next to a surviving `adrPresence` failure the audit printed:

```
cursor.mjs accept <offending-sha> --reason "<why…>"
```

Wrong three times over, and the third is the one a plausible fix would have preserved:

1. **It omitted `<to>`.** The contract is `accept <from> <to> --reason`.
2. **It did not fail on arity.** `rest = [sha, '--reason', '<why…>']` binds `to` to the
   literal `'--reason'`; all three bindings are truthy, `usage()` never fires, and
   `acceptManually` writes `accept: <reason>` to **stdout** before `advanceCursor` rejects
   the non-hex target. A success-shaped line, then a failure.
3. **It named the offending merge as `<from>`.** `from` is the human's assertion of the
   **cursor** value they reviewed — that is what gives the CAS its function — and `accept`
   advances a **window**. There is no per-merge accept. The old line therefore also
   misdescribed what accepting *does*.

The audit already knows the window, so the command is emitted from it: `auditedBase(range)`
mirrors the existing `auditedTip(range)`. When the range names no base (a bare revision —
a local `brain:audit` with no `origin/main`), the placeholder stays **visibly** a
placeholder. A fabricated sha inside a `--force-with-lease` is worse than an obvious blank.

## (2) Not here: a third of `main` is invisible to the audit

Re-measured on this branch: **101 first-parent commits in 60 days, 68 merges, 33
invisible** — PR squashes, which `--first-parent --merges` never selects.

This is a **ruling**, not a fix. The three options — record the gap and enforce
merge-commits at the platform · extend the walk to first-parent non-merges · report
squashes as `uncomputable` — each change what the cursor, the reverter-exemption and
`[FAIL-SHA]` key on. Bundling it with two mechanical corrections would smuggle a
governance decision through a chore PR.

#518 stays open for it.
