---
status: draft
issue: 479
---

# Tasks — #479 + #475

- [x] **T1** Settle #479's scope question: the fallback belongs in `getVcs()`, not threaded
      through the audit path. Measured first — **1 of 20+ call sites** bound an identity.
- [x] **T2** `getVcs()` falls back to `vcsToken(provider)`; an explicit `identity` still wins.
- [x] **T3** `_token` seam, because `vcsToken()` reads `.env` before `process.env` and the
      pre-existing "unbound" assertion was passing by accident.
- [x] **T4** `governance-postmerge.yml`: the audit step receives `VCS_TOKEN`, not `GH_TOKEN`.
      `${{ github.token }}` stays — only the name it arrives under changes.
- [x] **T5** `release.yml` (#475): `VCS_TOKEN` on the audit step **and**
      `pull-requests: read` in the permissions block, together.
- [x] **T6** The drift guard — written from scratch, not extended: the one both tickets
      credit to #467 **does not exist**. Shape-independent, teeth on each condition.
- [x] **T7** End-to-end guard through the REAL adapter: the neutral credential arrives as
      `GH_TOKEN` on the child env.
- [x] **T8** Six mutations RED (design.md carries the table).
- [x] **T9** Full suite: **3009 tests, 0 failures**.
- [ ] **T10** *(follow-on, not in this change)* #130 — ship GitLab CI gates. Its stated
      precondition was this issue; it is now met.
