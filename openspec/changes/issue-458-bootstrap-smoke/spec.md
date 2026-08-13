---
status: draft
issue: 458
---

# Spec — bootstrap-smoke (issue 458)

## REQ-458-1 — `brain:env:init` finishes cold, and finishes complete

Exit 0 **and** the post-conditions that only exist if the run reached its end:
`brain.config.json` with the full schema and the identity derived from the
fixture's origin, `brain/HOME.md`, `AGENTS.md`, `.env`, `core.hooksPath`.

Exit 0 alone is not enough: #446 died *after* writing the config and HOME.md.
Each post-condition must be for a file the fixture does not already carry —
`brain/HOME.md` was checked against the fixture's own copy until review finding
F2, which made it prove nothing.

## REQ-458-2 — `brain:session:start` exits 0

## REQ-458-3 — `brain:day:start` exits 0 and reaches its last step

Nothing is stubbed: measured, it degrades on its own with no network and no
token. Sequencing is what is asserted, not ecosystem updates — and reaching
`6/6` specifically, because an early exit is also 0.

## REQ-458-4 — A second `env:init` run changes nothing

sha256 manifest before and after, excluding `.git` and `node_modules` **by name
at any depth**. One measured exception: `.env` is compared as a set of
`KEY=value` lines, because `env:init` reorders them.

## REQ-458-5 — The fixture is a consumer, not the source tree

`.brain-source` absent, asserted. Seeded by copy, never by the verb under test.
No credential or proxy reaches it, and `HOME` is redirected — both asserted by
asking a child process what it received, not by trusting the parent's map.

## REQ-458-6 — Bounded runtime, outside the ratified job set

`timeout-minutes` set. Its own workflow, not `governance.yml`, not a managed
path, not a required context.

## REQ-458-7 — The job runs whenever the bootstrap can break

The trigger covers every path a change to which can break a verb — including
`brain/core/**`, which `brain-config.mjs` imports and whose breakage turns 11
assertions red. A guard fails if any required path is removed.
