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
- [x] T3 — **HUMAN: signed** 04/08/2026 (Cristian Rinaldi), commit `0f54781`.
- [x] T4 — **HUMAN: `status:approved` on #418** applied.
- [x] T5 — `actor-check.mjs`: `isForeignCommit` + foreign-commit selection in the
      `lite` branch (REQ-418-1..5, 7); `standard`/`regulated` untouched (REQ-418-6).
      Added an explicit unreadable-`labelCreatedAt` guard: pre-amendment that
      invariant was implicit in the timestamp comparison, and the new
      no-foreign-commit path never reaches it.
- [x] T6 — tests: **5 red against pre-amendment code** (REQ-418-2/3/5, the
      case-folding case, REQ-418-7). REQ-418-1 (third-party re-arms) and REQ-418-4
      (unresolvable authorship is foreign) are green on both **by design** — the
      parity pin and the over-permissiveness control. One pre-existing test
      restated: it pinned the old rule using the approver's own commit; its intent
      is preserved with a foreign author.
- [x] T7 — ADR-0026 row replacement + appended Amendment 1 (commit `0f54781`,
      human-signed). PR carries the `decision` label.
- [x] T8 — PR to `main` closing #418.
- [ ] T9 — follow-up (out of this change): #418's relief does not reach GitLab
      (`login: null`) nor unattributed authors, including this repo's own
      `noreply@anthropic.com` session commits. Attributing session commits to an
      exempt account is an operator-side step, not a code change.
