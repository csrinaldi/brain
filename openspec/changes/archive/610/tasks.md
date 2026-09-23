---
status: draft
issue: 610
---

# Tasks — preflight-runbook (issue 610)

- [x] Measure the actual state: repo public, no pre-flight artifact anywhere
- [x] Establish the reframing: gate already passed → rotation, not authorisation
- [x] Enumerate the expected benign fixture hits with counts
- [x] Locate the #410/#427 scrub-bypass records (10, all `@legacy`/session_summary)
- [x] Measure the §2b surface (2070 of 2177 human session summaries)
- [x] Inventory the internal references with file counts
- [x] Record why the agent's own pass does not satisfy §1 (shallow clone)
- [x] Deepen the clone (`git fetch --unshallow`) — 218 → 1170 reachable, 1114 on main
- [x] Execute §1.1 (gitleaks, all history): 853 commits, 19 findings, 17 fixtures + 2 false positives
- [x] Execute §1.3 (commit messages, deleted blobs, `.env`): clean
- [x] Execute §2a: 4 records (not 10 — regex corrected), all clean; zero full-form tokens in `.memory/` history
- [x] Record in §4.0 that two of the three claimed blockers were false
- [ ] **HUMAN**: §1.2 `--only-verified`, the §2b decision, and the §4.1 signature

## Out of scope

Executing it. Full clone, maintainer's machine, credential output.

## Blocked on it

The rest of #435: scoped name, `private: false`, install spec, README and
`test/fresh-install` corrections, ADR-0006 superseded. `files` and the licence
already landed in #607, deliberately first.
