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
- [x] T3 — **D6 RULED (b) by the maintainer, 2026-08-06**: the deliverable is restated,
      `schema-v2.mjs` is untouched here, and the validator's inertness is **#483** — filed
      under that ruling, not on agent authority. What replaces "validator coverage" as
      schema evidence: the REAL render/parse round trip (REQ-405-3) and the poster's own
      anchor validation (REQ-405-4), both of which actually run.
- [x] T4a — ADR-0020 Amendment 1 **DRAFTED** for signature:
      `brain-drafts/adr-0020-amendment-1.md`, recording D1-D5, plus
      `brain-drafts/promotion-checklist.md` with the three-step cascade spelled out
      (ADR → `brain/HOME.md` same commit — `decision-gate` enforces co-occurrence →
      regenerate `AGENTS.md`, since HOME.md is one of the five SOURCE_DOCS).
- [ ] T4b — **HUMAN: sign and promote** the amendment. `brain/**` is Tier 2; the agent
      must never write the destination files.
- [x] T5 — **UNBLOCKED** (#478 merged at `ba4921e`) and done: `file`/`line` on the `/2` finding schema, with the
      render/parse round trip over the REAL pair (REQ-405-2, -3). Starting before #478
      merges would conflict on the two files three review rounds have already rewritten.
- [x] T6 — GitHub widened: `comments[]` rides the EXISTING `/reviews` payload,
      `event: 'COMMENT'` untouched. Baseline `main` @ `ba4921e`: **2531 / 2530 pass**.
- [x] T8a — REQ-405-4 written BEFORE the success path, as this file instructed. The
      `rejectInline` fixture makes the first attempt fail and every later one succeed, so
      a verb that retries without anchors gets a url and one that gives up gets nothing.
      `inlineDropped` is **absent** when nothing was dropped, never `0` — "none requested"
      and "all dropped" must not be the same answer.
      Red-proof, diff printed before each run: ignore `comments` → the payload case reds;
      remove the fallback → REQ-405-4 reds; report `0` instead of omitting → two cases red.
      Each mutation kills a DIFFERENT test, so each pins a distinct property.
- [x] T6a — the parity case asserts the payload SENT, not the value returned. Its first
      version passed against a verb that ignored `comments` entirely — decorative, and
      caught here rather than by a reviewer (round 5 of PR #478 is why I looked).
- [x] T7 — GitLab: `notes` when `comments` is absent; **summary note FIRST**, then one
      `discussions` POST per anchor with a `position` built from `diff_refs`, read inside
      the verb (D4). Unreadable `diff_refs` reports every anchor as dropped rather than
      skipping silently.
      **The implementation falsified REQ-405-5.** It read *"inline comments post in the
      SAME provider call"* — true of GitHub, structurally impossible on GitLab, where
      discussions are one-per-position so N anchors are N+1 calls whatever the order. A
      requirement only one provider can satisfy is GitHub's implementation promoted to
      doctrine. Corrected to the provider-agnostic invariant the anti-loop lock actually
      needs: **exactly one payload carries the verdict body**, because the lock counts
      PARSEABLE VERDICTS, not posts. D5 corrected the same way.
      Order follows from REQ-405-4: when calls cannot be atomic, the verdict is the one
      that must already be safe if anything after it fails.
- [x] T7a — the rejection fixture rejected by call ORDER, which silently encoded
      GitHub's sequence and would have rejected GitLab's SUMMARY — the opposite of what
      it claimed to model. Now rejects by SHAPE (any payload carrying an anchor), which
      is provider-agnostic and is what the real providers do.
- [x] T7b — red-proof: no-op on `comments` → red; drop the count → red; unreadable
      `diff_refs` reported silently → red. A fourth mutation meant to reverse the post
      order turned out **inert**, and its green said nothing — which exposed that the
      ORDER was pinned by nothing. Added a case where the transport dies mid-sequence:
      summary-first survives, summary-last loses the verdict. Proven by a real
      order-reversal mutation (diff printed) → red.
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
