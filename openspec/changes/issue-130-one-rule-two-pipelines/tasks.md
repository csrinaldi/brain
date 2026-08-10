---
status: draft
issue: 130
---

# Tasks — #130

- [x] **T1** Measure the six-week-old ticket against `main` first: the portable checks, the
      GitLab fragment, its managed-path entry, the dogfooded include and the #479 blocker are
      all already done.
- [x] **T2** Identify the real gap: the parity guards compare NAMES, not behaviour — and
      `issue-link` had already diverged into bash-on-GitHub vs the portable check on GitLab.
- [x] **T3** Migrate `governance.yml`'s `issue-link` to `run-check.mjs issue-link`, with the
      context inputs and `VCS_TOKEN`.
- [x] **T4** Per-job command parity guard across both pipelines, with teeth against the
      `run: |` blind spot.
- [x] **T5** Rewrite REQ-A2-3 to assert its requirement instead of the old mechanism.
- [x] **T6** Five mutations RED (M5 needed a guard written for it).
- [x] **T7** Full suite: **3037 tests, 0 failures**.
- [ ] **T8** *(not in this change)* `approveIssue` — needs a sanctioned path through a port
      that refuses the approval label unconditionally (#124, #528). A `decision` change.
