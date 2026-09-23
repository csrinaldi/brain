---
status: draft
issue: 607
---

# Design — licence-and-files-allowlist (issue 607)

## D1 — The allowlist is derived, and the derivation is asserted

`files` is written by hand in `package.json` because npm needs it there, but it
is **checked** against `managed`. Nobody has to remember to update it: adding a
managed path without adding it to `files` turns the suite red.

## D2 — Measure `npm pack`, not the array

The half most likely to surprise is npm's own handling of dot-directories
(`.github/`, `.claude/`, `.gemini/`). Measured after the change: all four
dot-entries did make it in. Asserting over the array would not have shown that.

## D3 — `AGENTS.md` is absent on purpose

It is `regenerate`, not `copy`. `SOURCE_DOCS` is `brain/HOME.md` (consumer-owned)
plus four `brain/core/methodology/*` docs, all of which ship — so the consumer
can compile its own. Shipping brain's would be #397's defect.

## D4 — A size canary, explicitly not a budget

4.13 MB today, canary at 8 MB. It exists to catch bulk that no named rule
anticipated. The comment says to read what was added before raising it, because
raising it is the obvious wrong fix.

## Hot micro-decisions

- Measured before: 1053 files / 16.8 MB. After: **423 / 4.13 MB**.
- `.brain-source` is excluded. It was probably harmless to ship — both readers
  resolve it at the *consumer repo root*, not inside `node_modules` — but #435
  asked for that assumption to be tested rather than trusted, and excluding it
  makes the test unnecessary.
- `private: true` deliberately stays. This change makes a future publish safe;
  it does not perform one.
