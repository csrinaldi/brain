---
status: tasks
issue: 405
epic: 313
artifact_store: openspec
topic_key: sdd/issue-405-inline-review-comments/tasks
---

# Tasks — inline per-line review comments (issue #405)

**Status: DESIGN PASS COMPLETE, IMPLEMENTATION BLOCKED.** Two blockers, both deliberate:
PR #478 owns `verdict.mjs`/`parse-verdict.mjs`, and D6 + the ADR amendment are human
acts. The ticket's own body asks for a design pass first — this is it.

- [x] T1 — measurements taken BEFORE designing (the five decisions each change the size
      of the work, so guessing them would have mis-sized the whole change):
      - GitHub `prReviewComment` → one POST to `/reviews` carrying `{body, event}`;
        `comments[]` rides the SAME payload (`github.mjs:435`).
      - GitLab `prReviewComment` → `/notes`, which has no line anchoring; inline needs
        `/discussions` + a `position` object built from the MR's `diff_refs`
        (`gitlab.mjs:448`).
      - `poster.mjs:93` is the single call site: `postFn({project, number, body})`.
      - **`validateSchemaV2` is exported and called NOWHERE in production** — which
        resizes deliverable 3 and became D6.
- [x] T2 — SDD artefacts: proposal / spec (REQ-405-1..8) / design (D1-D7) / tasks.
      Baseline on `main` @ `d2fdf13`.
- [ ] T3 — **HUMAN: rule D6** — wire `validateSchemaV2` into `buildVerdict` (a change to
      what brain refuses to post, deserving its own ticket) or restate the deliverable
      and ticket the validator's inertness separately. Recommendation: the latter.
      Not filed as an issue on agent authority — #473's addendum.
- [ ] T4 — **HUMAN: ratify the ADR-0020 amendment** recording D1-D5. Three-step cascade:
      ADR → `brain/HOME.md` → regenerate `AGENTS.md`.
- [ ] T5 — BLOCKED ON #478: `file`/`line` on the `/2` finding schema, with the
      render/parse round trip over the REAL pair (REQ-405-2, -3). Starting before #478
      merges would conflict on the two files three review rounds have already rewritten.
- [ ] T6 — widen `prReviewComment` on GitHub: `comments[]` into the existing payload,
      `event: 'COMMENT'` untouched (REQ-405-1).
- [ ] T7 — GitLab: `notes` when `comments` is absent, `discussions` + `position` when
      present, `diff_refs` fetched inside the verb (D4).
- [ ] T8 — REQ-405-4, the one that matters: the un-anchorable fallback. Stub rejects the
      inline payload → summary still posts, findings fold in, count reported. **Write
      this before the success path** — it is the deliverable, not an edge case.
- [ ] T9 — `poster.mjs` wiring, one call, anti-loop and anti-stale unchanged (REQ-405-5).
- [ ] T10 — `vcs.contract.test.mjs` parity, including the fallback (REQ-405-6).
- [ ] T11 — `brain-drafts/vcs-contract-row.md` → **human promotes** (REQ-405-7, Tier 2).
      The agent must never write `brain/core/methodology/vcs-contract.md`.
- [ ] T12 — e2e on #409's harness: assert the captured `comments` array (REQ-405-8).
- [ ] T13 — red-proof pass per design D7, **printing every mutation's diff before its
      run** — four silently missed during PR #478 and produced meaningless greens.
- [ ] T14 — full suite + `repo:check` + `brain:nav`; diff budget.
- [ ] T15 — PR to `main`, `Closes #405`.
- [ ] T16 — cold review round(s). Three were needed on PR #478, each finding a blocker
      inside the previous round's correction; budget for more than one here too.
