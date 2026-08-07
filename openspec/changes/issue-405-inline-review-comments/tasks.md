---
status: tasks
issue: 405
epic: 313
artifact_store: openspec
topic_key: sdd/issue-405-inline-review-comments/tasks
---

# Tasks — inline per-line review comments (issue #405)

**Status: IMPLEMENTED, awaiting cold review.** Both original blockers cleared — PR #478
merged at `ba4921e` (it owned `verdict.mjs`/`parse-verdict.mjs`), and D6 was ruled (b) by
the maintainer. Two human acts remain OPEN and are marked below: T4b (sign the ADR
amendment) and T11b (promote the contract row). Neither is an agent act.

**Two requirements were falsified by building them** — REQ-405-5 (T7) and REQ-405-8
(T12). Both are corrected in the spec with the measurement that falsified them, not
quietly rewritten.

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
- [x] T8 — done as **T8a** above (the fallback WAS written before the success path, which
      is why it carries the `a` suffix — the numbering slipped, not the order of work).
      Both providers: an anchor-rejecting transport leaves the verdict posted and the
      dropped count reported.
- [x] T9 — `poster.mjs` wiring. `deriveInlineComments` is exported and PURE, so the
      anchor→comment mapping is testable without a transport; `postVerdict` gained a
      `findings` param and passes `comments` **only on the PR path** (`issueComment` has
      no inline surface — a silently-ignored argument is worse than an absent one) and
      **only when at least one anchor exists** (`comments: []` would ask both providers to
      do inline work for zero anchors, and on GitHub it is the key's PRESENCE that arms
      the retry-without-inline fallback). `inlineDropped` is re-surfaced under the verbs'
      own rule: absent when nothing was dropped, never `0`.
      Anti-loop and anti-stale are untouched — both still run before any verb is chosen,
      and the anti-loop early return is still reached with no `getVcs` call at all.
      Red-proof, **diff printed before every run** — 6 mutations, 6 distinct reds:
      half-anchor guard removed → the anchored-only case; ruling exclusion removed → the
      ruling case; `comments: []` always sent → the ruling AND the no-anchor case; count
      never surfaced → REQ-405-4; count reported as `0` → the absent-not-zero case;
      evidence dropped from the comment body → the anchored-only case.
      Two of those cases (no-anchor payload, absent-not-zero) did not exist until the
      red-proof asked what pinned them: nothing did.
- [x] T10 — `vcs.contract.test.mjs` parity landed WITH T6/T7 rather than after them,
      because the contract cases are what proved each provider's half. Both providers run
      the SAME fixtures — `rejectAnchoredRequests` rejects by SHAPE (any payload carrying
      an anchor), never by call order, so it cannot encode one provider's sequence as the
      contract (the defect T7a found).
- [x] T11 — `brain-drafts/vcs-contract-row.md` DRAFTED (REQ-405-7). The verb COUNT does
      not move; one signature widens. The row restates lock 2 inside itself — a reader
      checks the row to learn what may reach `event`, and widening a signature without
      restating the lock invites the next widening to reach it. It also names GitLab's
      extra `GET .../merge_requests/{number}` (a real cost, a real failure mode) and says
      plainly that no caller sends `comments` yet.
- [ ] T11b — **HUMAN: promote** the row into `brain/core/methodology/vcs-contract.md`.
      Tier 2 — the agent must never write the destination file.
- [x] T12 — e2e on #409's harness. **This task found the change's real defect.** The
      three cases are the wire path (real `postVerdict` → `github.mjs` → `spawnSync('gh')`
      → the captured payload), the 422 fallback against the real binary
      (`GH_STUB_REJECT_INLINE`, refusals to a separate `rejected.jsonl` so a post count
      cannot read a refusal as a success), and a CLI-level tripwire for the day an
      evaluator anchors.
      Building the tripwire required asking what would make it red, and the answer was
      **nothing**: patching `tranche.mjs` to anchor its budget finding left the posted
      keys at `["body","event"]`, because `cli.mjs` never passed `findings` to the poster.
      T9's wiring was complete at the module and dead at its only caller, with the whole
      suite green. Fixed here — `findings: verdict.findings` (the BUILT verdict's list;
      `buildVerdict` drops evidence-less findings and routes `pre-existing`/`base-only`
      into `follow_ups`, and a comment must annotate something the summary claims) — and
      the same mutation now yields `["body","event","comments"]`.
      Also added, because the count was reaching the caller and dying there: the CLI
      PRINTS the dropped-anchor count. Red-proofed behaviourally through the poster seam
      (a verb returning `inlineDropped: 2`), since deleting the log left the suite green.
      Red-proof, diffs printed: poster never passes comments → both anchored cases;
      github ignores `comments` → both; no bare retry → the fallback case; the stub stops
      refusing → the fallback case; `cli.mjs` passes `findings: []` → the drift guard;
      the log removed → the print case.
      **Residual, escalated not decided:** no evaluator anchors, so this path has no
      production producer — the `validateSchemaV2` shape (#483) again. Ship as plumbing,
      widen the anchor so `tier2-frontier` becomes the first producer, or follow-up: a
      maintainer ruling (#473), not an agent one.
- [x] T13 — red-proof, run per task rather than saved for the end, and every mutation's
      diff PRINTED before its run. 18 mutations across T6/T7/T9/T12; two were **inert**
      and their greens said nothing — one of those (T7b's order reversal) is what exposed
      that the GitLab post order was pinned by nothing.
      Two mutations found real defects rather than confirming tests: T12's evaluator-
      anchoring mutation exposed `cli.mjs` never passing `findings`, and the same reading
      exposed the dropped-anchor count reaching the caller and never being printed.
      **The stopping criterion this change is measuring** (maintainer's question): a round
      stops being worth running when it finds (1) no defect in executable behaviour,
      (2) no protection that nothing pins, (3) no false normative claim in the artefacts.
      T12 failed (1) and (2) simultaneously, so the criterion had not been met before it.
- [x] T14 — full suite **2557 / 2556 pass, 0 fail** (1 skip: pre-existing, root ignores
      mode bits). `repo:check` ✓, `brain:nav` ✓.
      **Diff budget: 1001 added vs lite's 1000 — over by one line.** Reported, not
      engineered around: shaving a line to pass a governance measurement is gaming it.
      The split is 167 production code / 599 tests+harness / 235 SDD prose. Whether to
      take `size:exception` (honored at lite) or split the PR is a maintainer call.
- [ ] T15 — PR to `main`, `Closes #405`.
- [ ] T16 — cold review round(s). Three were needed on PR #478, each finding a blocker
      inside the previous round's correction; budget for more than one here too.
