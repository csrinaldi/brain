---
status: draft
issue: 458
---

# Tasks — bootstrap-smoke (issue 458)

- [x] Resolve #590 first, so the placement is decided with a frame rather than guessed
- [x] Measure the three verbs in a fresh fixture: all three exit 0 offline
- [x] Harness `test/bootstrap-smoke/smoke.mjs` + README
- [x] Its own workflow, `timeout-minutes` set, not required, `.brain-source`-gated
- [x] #446 replay → exit 127 and 6 assertions red (acceptance criterion 1)
- [x] Mutation proof: 6 mutations, each diff printed, re-read off disk, reverted
- [x] `npm test`, `brain:repo:check`, `brain:nav` green with the workflow in place
- [x] Re-verify the replay through the final entry point
- [x] Review round: F1 (trigger missed `brain/core/**`), F2 (vacuous post-condition),
      F3 (credentials inherited), F4 (weakening fallback), F5 (exclusion by path,
      not name) — each fixed, each re-proven by mutation
- [x] Second round: these artifacts were in the wrong language (ADR-0009); rewritten

## Hot micro-decisions

See `design.md`.

## Out of scope, reported

- `.env` is not byte-idempotent across `env:init` runs (it reorders keys).
  Written by `brain/scripts/bootstrap.sh`, outside the claim. Deserves a ticket.
- No `package.json` alias (outside the claim): the workflow invokes by path.
- `brain:project:feature` scaffolds in Spanish and never reads `docs.language`
  — **#605**, which is why these artifacts started in the wrong language.
