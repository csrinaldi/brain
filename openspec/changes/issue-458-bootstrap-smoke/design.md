---
status: draft
issue: 458
---

# Design — bootstrap-smoke (issue 458)

## D1 — No docker, unlike its two siblings

`test/fresh-install` installs from a published tag and needs `VCS_TOKEN`;
`test/upgrade` builds a git remote and runs real `npm i`s. This one runs three
verbs that must work with nothing available, and redirects `HOME` into its
scratch dir. A container would buy isolation already obtained and would make the
suite unrunnable on a machine without a docker daemon — which is where a
maintainer usually is when a bootstrap breaks.

## D2 — One entry point, and it is node

The initial `run.sh` wrapper failed `auditWorkflowAuth`'s drift guard: `bash` is
not on its inert list, so `bash …/run.sh` reads as a step reaching the server
with no credential declared. The guard is right to be conservative; the fix is
an entry point it can classify, not a wider list.

## D3 — The single relaxation: `.env` compared as a set

Measured: a second run writes the same three keys in a different order
(`AGENT_PLATFORM` moves from line 1 to line 3). A real non-idempotency in
`bootstrap.sh`, outside the claim. The set of `KEY=value` lines is compared
instead: a key gained, lost or re-valued still fails, and a guard stops an empty
set turning the relaxation into "accept anything".

## D4 — What the review round changed

- **F1 — the trigger missed `brain/core/**`.** `bootstrap.sh` runs
  `brain-config.mjs ensure`, which imports `core/config-migrations.mjs`.
  Breaking it turns 11 assertions red, and a PR touching only it never started
  the job — #446's failure mode one level up. A YAML line with nothing
  asserting it is not a protection, so `workflow-triggers.e2e.test.mjs` defends
  it, and lives in `npm test` because a guard over a trigger cannot be gated on
  that trigger.
- **F2 — the `brain/HOME.md` post-condition was vacuous.** The fixture copies
  it and did not delete it, so removing the scaffold call from `bootstrap.sh`
  left the suite fully green.
- **F3 — "no token, no network" was a property of the machine.** The fixture
  inherited the parent environment wholesale.
- **F4, F5** — a fallback that could only weaken the day:start check, and an
  exclusion comparing paths where it meant names.

## Hot micro-decisions

- No offline flag was needed on `day-start.mjs` (the ticket's criterion 3 said
  "a flag exists or gets one"): the three verbs exit 0 with no network. The
  compensating assertion is that `day:start` reaches `6/6`, since exiting early
  also exits 0.
- The #446 replay used the exact defect `1170df4` fixed: renaming
  `memory.import.stateUnreadable` back to the hyphenated form. It reproduced
  exit 127 and the partial-bootstrap signature.
- These artifacts were written in Spanish and rewritten to English on review:
  ADR-0009 makes `openspec/` follow `docs.language`, which this repo declares as
  `en`. The scaffold emits Spanish and never reads that key — #605.
