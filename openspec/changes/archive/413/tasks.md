---
status: tasks
issue: 413
epic: 313
artifact_store: openspec
topic_key: sdd/issue-413-reviewer-identity-verified/tasks
---

# Tasks — reviewer identity verified against the token (issue #413)

- [x] T1 — widen `github.whoami({ token? })`: `GH_TOKEN` env precedence, zero-arg
      path untouched (REQ-413-4, REQ-413-5).
- [x] T2 — widen `gitlab.whoami({ token?, apiBase?, proxyUrl?, fetchImpl? })`:
      token path over `gitlabApiFetch`, rejects preserved (REQ-413-4, REQ-413-7).
- [x] T3 — `identity.mjs`: `evaluateVerifiedIdentity` (pure, case-folded) +
      verification in `gatherIdentity` behind a `whoami` dep seam; default verifier
      threads `gitlabApiConfig()` for GL (REQ-413-1/2/3/6).
- [x] T4 — `cli.mjs`: render the `mismatch` and `verifyError` refusals; gate order
      preserved (D3).
- [x] T5 — tests: 8 new in `identity.test.mjs`, 3 new in `cli.test.mjs` (+ shared
      fixture gains the `whoami` fake), 4 new in `providers.test.mjs`.
- [x] T6 — verify new tests against pre-#413 code: **6 red** (REQ-413-1/2/4/7);
      the case-insensitivity control green on both **by design** (REQ-413-3).
- [x] T7 — Tier-2 draft `brain-drafts/vcs-contract-whoami-row.md` (exact
      replacement row) — **human promotion pending**.
- [ ] T8 — HUMAN: promote the contract row into
      `brain/core/methodology/vcs-contract.md`.
- [ ] T9 — follow-up (out of this change): #418's `lite`-tier distinct-act
      relaxation, now unblocked — needs its own ADR-0026 amendment.
