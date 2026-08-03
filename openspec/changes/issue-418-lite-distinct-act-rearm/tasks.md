---
status: tasks
issue: 418
epic: 313
artifact_store: openspec
topic_key: sdd/issue-418-lite-distinct-act-rearm/tasks
---

# Tasks — `lite` distinct-act over foreign commits (issue #418)

- [x] T1 — ADR-0026 Amendment 1 draft, with accepted losses + residuals
      (`brain-drafts/adr-0026-amendment-1-distinct-act-rearm.md`).
- [x] T2 — proposal / spec / design for the contingent implementation.
- [ ] T3 — **HUMAN: sign the amendment** (accept / amend / reject). Gate for
      everything below. Rejection closes #418 with the recorded reason; the
      pre-approved retreat position is approver-exemption-only (design.md D4).
- [ ] T4 — **HUMAN: `status:approved` on #418** (#124 — agent never self-applies).
- [ ] T5 — `actor-check.mjs`: foreign-commit selection in the `lite` branch
      (REQ-418-1..5, 7); `standard`/`regulated` untouched (REQ-418-6).
- [ ] T6 — tests: REQ-418-2/3/5 red against pre-#418 code; REQ-418-4 green on both
      by design (documented negative control); full-tier parity suite green.
- [ ] T7 — ADR-0026 row replacement + appended Amendment 1 in the same PR, with the
      `decision` label (Tier-2, signed text only — verbatim from the draft).
- [ ] T8 — PR to `main` closing #418; diff budget; the epic's #418 row updated.
