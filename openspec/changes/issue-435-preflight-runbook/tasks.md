---
status: draft
issue: 435
---

# Tasks — preflight-runbook (issue 435)

- [x] Measure the actual state: repo public, no pre-flight artifact anywhere
- [x] Establish the reframing: gate already passed → rotation, not authorisation
- [x] Enumerate the expected benign fixture hits with counts
- [x] Locate the #410/#427 scrub-bypass records (10, all `@legacy`/session_summary)
- [x] Measure the §2b surface (2070 of 2177 human session summaries)
- [x] Inventory the internal references with file counts
- [x] Record why the agent's own pass does not satisfy §1 (shallow clone)
- [ ] **HUMAN**: execute the runbook on a full clone and post the §4.1 block to #435

## Out of scope

Executing it. Full clone, maintainer's machine, credential output.

## Blocked on it

The rest of #435: scoped name, `private: false`, install spec, README and
`test/fresh-install` corrections, ADR-0006 superseded. `files` and the licence
already landed in #607, deliberately first.
