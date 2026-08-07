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
the maintainer. Three human acts remain OPEN and are marked below: T4c (sign ADR-0020
Amendment 2 — the correction, tracked as #491), T11b (promote the contract row) and T11c
(promote the `reviewer-protocol.md` §6 anchor). None is an agent act. Amendment 1 itself
was signed 06/08/2026 and is already in `main` — this header claimed otherwise for the
whole implementation.

**Two requirements were falsified by building them** — REQ-405-5 (T7) and REQ-405-8
(T12). Both are corrected in the spec with the measurement that falsified them, not
quietly rewritten. **A signed ADR was falsified too** and was NOT corrected until the
cold review said so (T16 · B1) — the change corrected every artefact it owned and none
of the one that outranks them.

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
- [x] T4b — Amendment 1 **signed and promoted 06/08/2026** (`697bbf3`, already an ancestor
      of `main`; `brain/HOME.md` and `AGENTS.md` moved with it). This line said "pending
      signature" for the whole implementation — a false status claim about the tree, caught
      by the cold review of PR #490 and not by anything in this repo.
- [ ] T4c — **HUMAN: sign** `brain-drafts/adr-0020-amendment-2.md`. Amendment 1 asserted
      that inline comments post "in the same provider call" and that there is "no second
      postable artifact"; the GitLab implementation falsified both (4 calls, 3 artifacts,
      measured). REQ-405-5, D5 and the contract row were all corrected when that happened
      and the ADR was not — the change corrected every artefact it owned and none of the
      one that outranks them. Amendment 1's draft in this folder is marked SUPERSEDED
      rather than rewritten: editing a signed decision in place would erase that it was
      once believed.
- [x] T5 — **UNBLOCKED** (#478 merged at `ba4921e`) and done: `file`/`line` on the finding
      schema — **not gated on protocol**, see REQ-405-2 — with the render/parse round trip
      over the REAL pair (REQ-405-2, -3).
      This line said "`/2` finding schema" and was the THIRD copy of that falsified claim.
      Round 3 was chartered to hunt exactly this and corrected the ADR and the proposal;
      the change's own task list was not opened. Found in round 4. Starting before #478
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
- [x] T7b — red-proof: no-op on `comments` → red; drop the count → red. A fourth mutation
      meant to reverse the post order turned out **inert**, and its green said nothing —
      which exposed that the ORDER was pinned by nothing. Added a case where the transport
      dies mid-sequence: summary-first survives, summary-last loses the verdict. Proven by
      a real order-reversal mutation (diff printed) → red.
      **This line also claimed "unreadable `diff_refs` reported silently → red". It was
      false** — that mutation is green, and so is the weaker `if (!refs) refs = {}`. The
      cold review re-ran the ledger instead of reading it (T16 · C1). A red-proof ledger is
      itself a normative claim about the tree, and this one had a fabricated row in it.
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
- [ ] T11c — **HUMAN: promote** `brain-drafts/reviewer-protocol-anchor.md` into
      `brain/core/methodology/reviewer-protocol.md` §6.1/§6.2. Found missing by round 2 of
      the cold review (C-6): §6 names ITSELF the schema authority, and this change added
      two per-finding fields to that schema while drafting the `vcs-contract.md` row and
      the ADR amendment and nothing for it.
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
      **Residual, RULED by the maintainer: the producer belongs to #408.** No evaluator
      anchors, so this path has no production caller — the `validateSchemaV2` shape (#483)
      again. It ships as plumbing; #408, which already owns the evaluator work that would
      emit `pre-existing`/`base-only`/`inferential`, is where the first `file`/`line`
      producer lands. The CLI tripwire in `test/review-regulated/` is the detector that
      fires the day it does — it belongs to #408 from that moment, not here.
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
- [x] T14 — gates, recorded as COMMANDS rather than as frozen numbers. Two rounds of this
      row were wrong in two different ways, and the second failure is the instructive one.
      ```
      npm test                                                    # 0 fail
      npm run repo:check                                          # ✓
      npm run brain:nav                                           # ✓
      git diff origin/main...HEAD --numstat \
        | node brain/scripts/vcs/diff-size-count.mjs              # well under lite's 1000
      node -e "…tierParams('lite').diffBudget"                    # 1000
      ```
      **First version:** "1001 added vs lite's 1000 — over by one", escalating a
      `size:exception`-or-split ruling to the maintainer. That was raw `git diff` additions;
      the GOVERNED metric runs the numstat through `governance.ignoreList`, which excludes
      `**/*.test.mjs` and `openspec/changes/**`. The real figure was 225 and the gate passed
      with room to spare. The instinct — refuse to shave a line to clear a governance
      measurement — was right and was applied to a number nobody had read.
      **Second version** wrote `225` down. One commit later it was 272 (round-2 cold review,
      C-5): the conclusion held, the measurement did not. A number in a ledger is a claim
      about a tree that keeps moving, so this row now records what to RUN. The suite count
      is omitted for the same reason — it changes with every test added, and "0 fail" is the
      claim that matters.
- [x] T15 — PR **#490** to `main`, `Closes #405`.
- [x] T16 · round 1 — cold review of PR #490 @ `1bbc455`. Zero-context reviewer, own
      worktree, given no conclusions and told to derive the standards from `brain/` itself.
      It answered the stopping criterion **NO**: one defect in executable behaviour, four
      protections pinning nothing, four false normative claims. Every finding below was
      independently reproduced before being acted on.
      - **B1** — the SIGNED ADR-0020 Amendment 1 still asserted "in the same provider call"
        and "no second postable artifact", both falsified by the GitLab implementation
        (4 calls, 3 artifacts, measured). → `brain-drafts/adr-0020-amendment-2.md` (T4c);
        Amendment 1's draft marked SUPERSEDED rather than rewritten.
      - **B2** — the GitLab `position` payload pinned by nothing: reducing it to
        `{ new_path, new_line }`, deleting `position_type`, both shas and the entire
        justification for the extra `diff_refs` GET, left the suite green. The only
        assertion was a `JSON.stringify` substring scan that `new_path` alone satisfied.
        → asserted key-by-key. The reviewer also flagged, as `inferential` (no live GitLab
        to run against), that GitLab documents `old_path` as required on a text position;
        we send it now. What was RUNNABLE is the part that mattered: if the shape is wrong,
        nothing in this repo would ever say so — every anchor 400s and the run reports a
        plausible count.
      - **C1** — the unreadable-`diff_refs` drop count pinned by nothing, and T7b claimed
        otherwise. Two mutations were green. Fixed, and the fixture RECORDS discussion
        attempts rather than throwing on them: a throw is indistinguishable from a refused
        anchor, which is why the first repair still let `if (!refs) refs = {}` pass.
      - **C2** — `inlineDropped`'s MAGNITUDE pinned by nothing on either provider: every
        test used exactly one anchor, so a hardcoded `1` satisfied the suite. The count is
        the entire mechanism of REQ-405-4. → a three-anchor case per provider.
      - **C3** — the worst one. Lock 2 was enforced only by a source scan for the literal
        `APPROVE`. Adding `event = 'COMMENT'` as a PARAMETER and threading it through left
        the whole suite green — after which `prReviewComment({ ..., event: 'APPROVE' })`
        posts an approval with the reviewer's own token. The lock is stated as "no
        parameter, flag or branch selects a different event" and had never been asserted
        the way an attacker would reach it. → a case that passes a hostile `event`.
        **That case covered ONE of the verb's THREE payload sites** and said so nowhere;
        see rounds 8 and 9.
        Part of the gap pre-dates this change; this change is the first widening of the
        signature it guards, and its own draft row argues that widening a signature without
        restating the lock invites the next widening to reach it.
      - **C4** — a behavioural REGRESSION this change introduced and shipped through three
        tasks: the url derivation moved outside the `try`, so a 2xx with a null body threw
        where `main` returned `{ url: null, error }`. → moved back, and pinned.
      - **C5** — the T14 diff-budget measurement was false; see T14.
      - **E1/E2/E3** — `postVerdict`'s JSDoc had been orphaned onto `deriveInlineComments`;
        both providers' JSDoc still declared the pre-#405 signature; "absent and empty are
        the same request" was true and forced by nothing.
      Nine mutations re-run after the fixes, diffs printed: nine reds. Full suite 2566.
      **Two of the nine were still green on the first repair** (C1's weaker form and C4,
      which had no test at all) — the fix for a finding needs its own red-proof, because
      a plausible repair is exactly what the original defect also looked like.
- [x] T16 · round 2 — cold review of `3b87a07`, told explicitly not to trust round 1's
      repairs. **Stopping criterion still NO, but on two of three axes instead of three:**
      no defect in executable behaviour (it could not produce a wrong result from either
      provider with real inputs, and all 9 round-1 repairs red under their own mutations),
      one protection pinning nothing, four false normative claims.
      - **C-1** — `design.md` D3 said *"Never the reverse order (summary first, inline
        second)"*. That is the order GitLab ships, and has no alternative. D5, REQ-405-5 and
        the contract row all got correction banners when the implementation falsified them;
        D3 sat two paragraphs away and got none. Round 1's B1 was this same shape against a
        signed ADR — *"corrected everywhere it was noticed and nowhere it was not"* — and it
        recurred inside the change's own design doc while that lesson was being written up.
        The reasoning was wrong twice over: the anti-loop lock counts parseable verdicts,
        not posts, so a window between two calls is not a second postable artifact.
      - **C-2** — the round-1 repair for E3 (`comments: []` ≡ absent) was forced on GitHub
        only. It asserted the BODIES sent, and GitLab's fixture answered the `diff_refs` GET
        before recording, so a call carrying no payload was invisible: making `[]` an inline
        request cost an extra provider call and could return `inlineDropped: 0` — the one
        value this change forbids — with a green suite. The fixtures now log every REQUEST,
        and the case compares two runs as call SEQUENCES, which is the only form of the
        claim both providers can fail.
      - **C-3** — `brain-drafts/promotion-checklist.md`, **not in the diff**, still told the
        human to promote Amendment 1 and quoted a `HOME.md:69` that no longer exists. A
        human following it would have re-promoted a superseded, falsified amendment. An
        untouched artefact still makes claims about the tree; being outside the diff is why
        nothing caught it.
      - **C-4** — spec REQ-405-5 and design D7-4 both asserted "a run that posts inline
        comments must still skip with anti-loop", and no test passed anchored findings to
        `postVerdict` twice. The behaviour was already safe; the coverage claim was fiction.
        Now a real case, red when the lock is removed.
      - **C-5** — T14's own repair went stale in one commit; see T14.
      - **C-6** — REQ-405-2 said the anchor is "on a `/2` finding" and nothing gated it: a
        `/1` verdict renders `file:`/`line:` and drives inline comments, measured. Correct
        behaviour, wrong requirement — `renderVerdict` treats `evidence_class` the same way
        and `cli.mjs` records why. Spec corrected rather than code gated, and the schema half
        drafted for `reviewer-protocol.md` §6, the document that names ITSELF the schema
        authority and that this change had added two fields to while drafting nothing for it.
      - **E-1/E-2** — `Number(f.line)` and the `**id** — ` prefix both pinned by nothing. The
        coercion is not cosmetic: `parseVerdict` returns `line` as TEXT (`'42'`, pinned in
        `verdict.test.mjs`), GitHub rejects a string line, and a round-tripped verdict would
        have lost every anchor and reported them as un-anchorable diff lines.
      - **E-3** — the GitHub retry comment claimed the attribution was "sound rather than
        assumed". It is not: the retry fires on any non-zero exit, so a transient 5xx is
        reported as dropped anchors. Retrying anyway is the right trade (a lost verdict costs
        more than an over-count); the CLAIM was corrected, not the behaviour.
      - **E-4** — the "rejects by SHAPE" paragraph documented one fixture and sat on another:
        round 1's orphaned-JSDoc finding, recurring in the file that fixed it.
      - **E-5/E-6** — the SUPERSEDED banner sat below the instruction block telling a reader
        to promote; D1's return shape omitted the `inlineDropped` this change added, and D7-5
        still said "no harness change is needed" two commits after the spec recorded that
        claim as falsified.
      **The pattern across both rounds**, worth more than any single finding: every artefact
      that was WRITTEN got corrected, and every artefact that was merely NEARBY did not.
      D3 two paragraphs from D5; the checklist beside the draft it describes; the protocol
      document behind the contract row. A correction is not applied until something asks
      which OTHER artefacts said the same thing.
- [x] T16 · round 3 — cold review of `ca6ab5a`, told about the pattern the first two
      rounds named and asked to look for surviving instances of it. **No blocker, no
      defect in executable behaviour**, and all 25 mutations aimed at production behaviour
      red where they should. Criterion still NO on two axes, and the pattern held a third
      time, in the same shape:
      - **C1** — GitHub's never-throws guard, **on the retry path this change created**,
        pinned by nothing: deleting `parse`'s try/catch left all 2569 tests green, and a
        throw escapes `postVerdict` (which catches nothing) and kills the run. This is
        round 1's C4 — the identical failure mode, which this change had already shipped
        once on GitLab. The repair added a GitLab-only case. The GitHub twin got nothing.
        Now in the SHARED loop, plus a GitHub case for the retry: a guarantee asserted for
        one provider is a guarantee for one provider.
      - **C2** — that block's header said "the two halves the shared loop cannot reach"
        and contained three tests, the third of which was not GitLab-only at all. Round
        2's E-4 (a comment documenting something other than what follows it) recurring in
        the file that fixed it.
      - **C3** — the `/2`-only claim about the anchor survived in the two artefacts round 2
        did not open: the SIGNED `ADR-0020:155`, and `proposal.md:63`. Worse, the sentence
        sits **twelve lines** from one Amendment 2 already corrects — so the draft written
        specifically to repair Amendment 1's falsified claims fixed two and walked past the
        third. The same failure, committed inside its own fix.
      - **C4 (AI attribution)** — six of this branch's commits carry
        `Co-Authored-By: Claude…`, which `agent-authorities.md` lists under **Tier 3 —
        Prohibited**, *"even if explicitly asked"*, and which `openspec/config.yaml` bans
        in the same words. Not agent-fixable and left for the maintainer: the obvious
        remedy — amending published commits — is Tier 3 as well. See T17.
      - **E1** — a test titled "yields NO array, not an empty one" whose assertion is
        `deepEqual(…, [])`, contradicting itself and the function's own JSDoc.
      - **E2** — "only the findings array is supplied by the test" was false in three
        places: those cases hand-write `renderedBody`, so it carries no findings at all,
        which made one assertion message describe something the fixture cannot observe.
      - **E3** — a second unforced claim in the same GitHub function ("only reachable when
        anchors were sent"): making the retry unconditional left the suite green, so a
        regression that re-POSTs the verdict on every transient failure would ship silently.
        Now pinned by a failing transport that still LOGS — the first attempt at that case
        spread `capture()` and `fail()` into one call, and since both set the same seam the
        second silently won and the call-count assertion passed having observed nothing.
      Three mutations re-run after the fixes, diffs printed: three reds.
      **Three rounds, one lesson, stated plainly because it cost three rounds to learn:**
      a correction is not finished when the sentence that was wrong is fixed. It is
      finished when something has asked which OTHER artefacts, and which OTHER provider,
      assert the same thing. Every round found the fix applied exactly where the defect was
      noticed and nowhere else — sibling provider, sibling protocol claim, sibling proposal
      bullet, sibling block header, sibling ADR sentence twelve lines down.
- [x] T16 · round 4 — cold review of `ec153ea`. **No blocker, no defect in executable
      behaviour, and — for the first time — NO protection that nothing pins.** 25 mutations
      across five production files all red, including the ones the earlier rounds' own
      repairs added, on both providers; the reviewer additionally instrumented the three
      most vacuity-prone new cases to prove none observes an empty collection. Two of the
      three axes are now clean. Findings, all normative:
      - **C1** — `reviewer-protocol.md` §4 carries the pre-#405 signature (line 121) and the
        pre-#405 return set (line 116). It is the THIRD copy of that signature — after
        `vcs-contract.md` (drafted T11b) and `ADR-0020` (drafted as Amendment 2) — and was
        the only one with no draft, **in the file this change had already opened a draft
        for** in round 2. Drafted now. `docs/reviewer-setup.md` said the same thing and is
        Tier 1, so it was fixed directly.
      - **C2** — the sharpest finding of the round, and the only one that was about
        behaviour. `renderVerdict` emits `file`/`line` in BOTH branches; `cli.mjs` hands the
        poster `verdict.findings` alone, so an anchored `follow_ups[]` entry renders and is
        never posted inline. Real, deliberate, and asserted the OTHER way by the Tier-2
        draft about to become schema authority — the document would have shipped saying the
        implementation does something it does not.
        The rule, now stated instead of implied: a follow-up carries `pre-existing` or
        `base-only`, which IS the verdict's own statement that the defect is not this
        change's doing. Anchoring one would put a comment on a line in this author's diff
        about something the same verdict says they did not introduce — causal admission
        inverted at the point a human reads it. Recorded in the spec, in `cli.mjs`, in the
        draft, and pinned at the poster (the CLI's half is the drift guard, which reds for
        `findings + follow_ups` as well as for the evaluator's own list — verified for the
        spread form, and NOT for `.concat(...)`, which the guard's substring match let
        through; see round 6).
      - **E1** — `tasks.md` T5 still said "`/2` finding schema". Round 3 was chartered to
        hunt exactly that claim and corrected the ADR and the proposal; the change's own
        task list was the third copy and was not opened.
      - **E2** — a comment describing a skip that does not exist, plus the dead binding it
        left behind: round 3's orphaned-comment fix, containing an orphaned comment.
      - **E3** — "six of this branch's eight commits" was nine commits by the time it was
        read. The frozen-number defect T14 taught itself about, committed one paragraph
        after recording it. The denominator is gone; the six is the claim that matters.
      Two mutations re-run after the fixes, diffs printed: two reds.
- [x] T16 · round 5 — cold review of `e43be3c`. **No blocker, no defect in executable
      behaviour, no protection that nothing pins** — 12 mutations, 12 reds, plus vacuity
      probes on the three cases most exposed to it, confirming none observes an empty
      collection. Round 4's clean bill re-verified independently rather than taken on trust.
      One axis left, and the pattern found a place nobody had looked:
      - **C1 — the PR BODY.** The one artefact of this change that lives OUTSIDE the tree,
        that no round had opened, and that the maintainer reads at merge time. It still
        carried FIVE claims the branch had corrected everywhere else: the `/2`-gated anchor
        (the fifth copy of that claim); an instruction to sign Amendment 1, which is signed,
        merged and marked SUPERSEDED; the "1001 vs 1000, over by one" budget escalation that
        T14 records as false; a stale suite count; and the #408 residual described as
        awaiting a ruling it has been given. Its list of open human acts named T4b — closed
        — and omitted T11c entirely.
        Four rounds hunted this exact pattern inside `openspec/` and `brain/`, and the
        largest surviving instance was the document those four rounds were summarised INTO.
      - **C2** — T17's base rate: `main` carries **13** such commits, not 6. `6` counts one
        SPELLING; GitHub's squash-merge writes `Co-authored-by:` and this repo's own
        detector is case-insensitive. Written one sentence below the paragraph round 4 had
        just rewritten to remove a frozen number.
      - **C3** — T17 escalated six commit trailers and walked past the `_Generated by
        [Claude Code]_` footer on the body of the PR it is written in. Not Tier 3 (that list
        names commits) and required by the agent's harness, so it is named for the
        maintainer rather than removed unilaterally. The instrument is the real finding:
        `AI_ATTRIBUTION_RE` matches `generated with [claude`, not `Generated by [Claude`, so
        the one surface the repo scans is scanned by a regex that misses what the agent
        actually writes.
      - **E1** — "Exactly ONE payload carries the verdict body" is false on GitHub's own
        fallback path: it SENDS the body twice and normally one lands. `github.mjs` names
        that residual in its own comment; both Tier-2 drafts asserted the invariant without
        it. Now "at most one payload the provider ACCEPTS" — the documents about to outrank
        the code should not be less honest than it.
      - **E2** — GitLab's position sends `new_line` only, so an anchor on a context or
        deleted line cannot attach. `inferential` (no live GitLab) and unreachable today,
        bounded by the drop count. Named in the code and in the contract-row draft so the
        next person to widen the anchor shape finds the constraint, not the symptom.
- [x] T16 · round 6 — cold review of `6ed288d`, ~35 fresh mutations, every diff printed;
      34 red. **No blocker and no defect in executable behaviour** (the axis has failed at
      rounds 1 and 11 only — round-24 cold review struck the ordinal here too).
      Vacuity probes on every case exposed to it came back non-vacuous, including
      a measurement that the lock-2 source scan really scopes 2952/4973 chars of function
      body rather than an empty slice. But the "no unpinned protection" bill from rounds 4
      and 5 did **not** survive re-verification:
      - **F1 — the CLI drift guard was satisfied by the exact population it forbids.** It
        matched `/findings: verdict\.findings/`, a SUBSTRING, so
        `verdict.findings.concat(verdict.follow_ups)` passed it — the causal-admission
        inversion `cli.mjs`'s own comment and REQ-405-2 exist to prevent — with the whole
        suite green. Round 4 red-proofed it with the SPREAD form only and wrote "verified"
        into the spec and this file. A substring match on a source guard is not a guard: it
        constrains a prefix. Now anchored to the whole line; red for `.concat(...)`, the
        spread form, and the evaluator's own list.
        This is the shape the change kept producing, arriving in the mechanism built to
        detect that shape — a test whose message names two wrong populations while catching
        one.
      - **F2** — round 5's "at most one payload the provider ACCEPTS" was applied to the
        RATIONALE bullet of the contract-row draft and not to the row itself — the text a
        human pastes into `brain/core/` — nor to `spec.md`'s bolded invariant, nor to the
        sentence claiming it is "asserted on the payloads actually SENT" (no test asserts
        that on the fallback path), nor to `design.md`, nor to Amendment 2's `HOME.md` line.
        The correction landed on the explanation and missed the thing being promoted.
      - **F3** — the PR body's governed-diff figure was `308`, measured at `e43be3c`; at the
        head the body claims to describe it is `315`. The frozen-number defect, in the body
        round 5 rewrote to fix that class.
      - **F4** — T17's two recorded commands lack `--oneline`, so they print 831 and 402
        (log lines) rather than 13 and 6 (commits). The conclusion is right and the
        reproduction instruction is wrong, in the row T14 rewrote specifically to record
        *what to run*.
      - **F5** — design D3 rule 2 and the SIGNED `ADR-0020:146` both say the retry fires "on
        an inline-specific rejection" and that un-anchorable findings are "folded back into"
        the block. Neither describes the implementation: `github.mjs` retries on ANY
        non-zero first exit (deliberately — gating on a 422 shape would let a transient
        failure cost the verdict), and nothing is folded, because the retry re-sends the
        body byte-identical with the findings already in it. Amendment 2 now covers that
        paragraph too; it is the "sentence twelve lines down" one section further along.
- [x] T16 · round 7 — cold review of `5469b3c`, ~55 mutations across five production
      files, every diff printed, and every natural drift spelling tried rather than one.
      **No defect in executable behaviour** (clean on that axis since round 2). Two findings:
      - **F1 — GitLab's inline comment BODY was pinned by nothing.** Replacing `body: c.body`
        with a constant left all 2574 tests green: every anchor still attaches,
        `inlineDropped` stays absent, and the run reports a perfectly healthy inline review
        that says nothing at all. The GitHub twin reds — but only incidentally, via an e2e
        case — because the shared contract case substring-scanned
        `JSON.stringify(anchored)` for the PATH and the LINE and never the body.
        That is the exact weakness B2 was fixed for in round 1 (*"a substring scan for the
        path passed against a position missing everything else"*), surviving one field over,
        on the sibling provider. The assertion is now in the SHARED loop, so it cannot be
        one provider's guarantee again — red on both.
      - **F3 (from round 6, unfixed)** — the PR body's governed-diff figure. Round 6
        recorded it, fixed F1/F2/F4/F5 in the tree, and left this one because **it lives
        outside the tree**. The change's own recurring defect, reproduced against the very
        artefact round 5 added to close it. The body now carries the COMMAND, not a number.
      - **E1 (editorial, fixed anyway)** — the `line === null` half of the half-anchor guard
        was unpinned: dropping it left the suite green, and under it a `{file, line: null}`
        finding posts at `Number(null)` = line 0 while `renderVerdict` — which guards both —
        omits `line:` from the block. Text on the diff the posted verdict does not support,
        which is the one thing the anchor rule exists to prevent. Both spellings red now.
      The reviewer also re-tested round 6's own axis: the lock-2 SOURCE scan is still
      bypassable by spelling (`'APPROV' + 'E'`), and the behavioural companion case catches
      it — which is the argument for having added that case rather than tightening the scan.
      (True of the FIRST payload only. Round 8 found the companion case never reached the
      bare retry at all.)
- [x] T16 · round 8 — cold review of `2e8e2a9`, ~40 mutations, every diff printed and
      parse-checked. **No defect in executable behaviour** (clean on that axis since round 2), and
      every one of the seven previous rounds' repairs held under multiple spellings. But it
      found a **BLOCKER**, and it is the most serious finding of the whole sequence:
      - **B1 — lock 2 was asserted on ONE of the verb's payload sites.** (Round 8 wrote
        "one of TWO". There are THREE — round 9.) Before #405 `prReviewComment` built one
        payload; this change builds three: the ternary's two branches and the bare retry. Round 1's C3 closed the
        lock-2 gap with a behavioural case driven by `capture()`, whose transport **always
        succeeds** — so on GitHub the retry never fired and its payload was never inspected.
        Parameterising `event` on the retry alone left all 2574 tests green (both source
        scans miss it — the mutated `event` is a variable, not a literal), after which
        `prReviewComment({ ..., event: 'APPROVE' })` with one out-of-diff anchor posts an
        **APPROVED review with the reviewer's own token**, satisfying `main`'s
        `required_approving_review_count`. **NOT L6** — round 8 claimed that too and was
        wrong: `evaluateBrainWritesReviewed` fails a bot-only approval, because L6 counts a
        non-author, NON-ALLOW-LISTED approval. Lock 3 holds independently under a lock-2
        breach, which is exactly what §2 promises — and the sentence asserting the L6 breach
        cited §2 as its authority (round 9, C4).
        The fixture REFUSES the anchored payload and logs every one; after round 9 the case
        ALSO drives the no-anchor shape, and asserts across every payload from both. Red-
        proofed on each of the three sites independently.
        **The rule this earns:** a widening that creates a call site owns proving the lock
        still covers it. Round 1 fixed the lock where the defect was — and #405's own new
        call site was the sibling nobody checked, for seven rounds, in the guard on the one
        mechanism that keeps the automated reviewer unable to approve a merge.
        Eight artefacts asserted that coverage as complete, two of them outside the tree.
        **Round 8's commit said "All corrected". Four were not** — the two Tier-2 drafts,
        the PR body and issue #491 — which is this change's own recurring defect committed
        inside the sentence claiming it had been avoided (round 9, C2).
      - **E1** — `renderVerdict`'s `!== null` half, on BOTH branches, pinned by nothing.
        Round 7 pinned the POSTER's null guard and justified it by citing this one. Under
        its removal the block advertises `line: null`, an anchor the poster then refuses —
        the inverse of the case round 7 fixed. The correction had landed where it was
        noticed and not on the thing it cited.
      - **E2** — round 6's "nothing is folded back" reached D3 and the signed ADR and not
        D7-2, 110 lines down in the same file.
- [x] T16 · round 9 — cold review of `f9a19e6`, ~45 mutations, every diff printed AND
      `node --check`ed. **No defect in executable behaviour** (clean on that axis since round 2).
      A second **BLOCKER**, and it is round 8's own fix falling one site short:
      - **B1 — three payload sites, not two.** `github.prReviewComment` builds THREE
        `event`-carrying literals: the ternary's anchored branch, its bare branch, and the
        retry. `main` built one. Round 8 covered 1 and 3 and wrote "both call sites",
        because a ternary reads as one site. **Site 2 is the only one a production run
        reaches today** — no evaluator anchors, so `comments` is never sent — and
        parameterising it alone left all 2575 tests green.
        Fixed by driving BOTH call shapes and asserting across every payload of each.
        Red-proofed on each site independently. **My first three red-proofs of this fix
        were INERT**: I destructured a property named `ev` instead of aliasing `event: ev`,
        so the diff printed clean and the mutation changed nothing. Printing the diff is
        necessary and not sufficient — a substitution can land on executable code and still
        be semantically dead.
      - **C2 — round 8's commit said "All corrected" of eight artefacts. Four were not**:
        both Tier-2 drafts (including the §4 row the commit named explicitly as the one that
        would promote the overstatement into doctrine), the PR body, and issue #491. The
        recurring defect, committed inside the sentence claiming it had been avoided.
      - **C4 — round 8 overstated the exploit.** It claimed the forged APPROVE satisfies
        `main`'s branch protection AND L6's approver set. The first is true and is why it is
        a blocker; the second is false, measured: L6 counts a non-author, NON-ALLOW-LISTED
        approval, so lock 3 holds independently — which is precisely what §2 promises, in
        the sentence the claim cited as its authority. Overstating a breach is the same
        defect class as understating one.
      - **C3/E1** — the PR body was a round stale again, and T17 asserted a PR-body
        attribution footer that the round-5 rewrite had removed.
- [x] T16 · round 10 — cold review of `12f62ff`, ~50 mutations, each printed,
      `node --check`ed, and each red confirmed to be the INTENDED assertion firing.
      **CLEAN at blocker and correction severity on all three axes** — the first round to
      be. The reviewer enumerated the three `event` sites independently rather than
      trusting the count, confirmed the guard's mutations are semantically live (the
      failure message carries `{"body":"verdict","event":"APPROVE"}` off the wire), and
      probed every fixture for always-succeeding behaviour. Two editorials, both fixed
      because the stopping criterion is not severity-qualified:
      - **E1** — the half-anchor guard was pinned for `undefined` and `null` and not for
        `file: ''`, and worse: it tested PRESENCE, not usability. `line: 'abc'` went out as
        `line: null` and `line: ''` as `line: 0`, and diff lines are 1-based — anchors
        already known not to attach, which is the exact cost the guard's own JSDoc says it
        exists to avoid. Tightened to "non-empty file AND a line that coerces to a positive
        integer", which is also what the round-tripped `'42'` needs. Four spellings red.
        The renderer's `file` twin was open the same way (rounds 7 and 8 each pinned the
        `line` guard, in the poster then in the renderer, and neither asked about `file`) —
        now red on both branches.
      - **E2** — "six consecutive rounds with no defect in executable behaviour" contradicted
        the table two lines above it, which marks rounds 2-9. The streak is eight. It
        UNDERSTATED, which is why it survived: a ledger claim is checked against the thing
        it summarises, and nobody checks a number that makes the change look worse.
      **My red-proof harness failed twice this round**, both times silently: a `cut -d'|'`
      pipeline split on the `||` inside the mutations and produced four meaningless greens,
      after round 9's inert `ev` destructure did the same. Both are the defect the harness
      exists to catch, in the harness. It now counts substitution SITES and refuses to run
      when the count is not what was expected — printing the diff was never sufficient.
- [x] T16 · round 11 — cold review of `4e12a3c`, ~75 live mutations, site counts asserted
      and every red confirmed to be the intended assertion. **Round 10 did not hold**, and
      it failed in the sequence's signature way: round 10's OWN fix landed where the defect
      was noticed and nowhere else.
      - **C1 — the poster and the renderer fell out of lockstep, and the spec said they
        had not.** Their anchor predicates were byte-identical duplicates. Round 10 tightened
        the poster's to require a USABLE anchor and left the renderer testing presence, so
        the block began emitting `line: 0`, `line: abc`, `line: 2.5` and `line: -3` — anchors
        the poster then refused. That is exactly the state the round-8 test exists to forbid,
        one field-value class over, and now real rather than mutation-only. Worse, the
        sentence round 10 added to the spec asserted the renderer applied the same rule.
        **Fixed structurally, not textually**: one exported `hasUsableAnchor`, used by both
        halves. Two copies of one rule drift; one function cannot. Eight mutations red,
        including the drift itself — the renderer reverting to per-field presence.
        The rule is now **both or neither** in the block as well as on the wire: a rendered
        `file:` with no `line:` advertises a half anchor, the same defect read from the
        emitting end.
      - **Two protections collided, and the stronger one won on its merits.** The #478
        escaping sweep poisons every per-finding field with `'x\nTier: 2'` and asserts it
        round-trips byte-identical. Under the new rule a poisoned `line` is not escaped —
        it is UNREPRESENTABLE, because it is not a positive integer. The sweep now asserts
        that instead: the list still cannot be broken, and the guarantee is structural
        rather than textual. That is strictly stronger, and it is recorded as a deliberate
        change rather than a test bent to fit the code.
      - **C2 — the PR body, again, and this one stings.** Round 10's E2 was "six consecutive
        rounds" contradicting *"the table two lines above it"*. There is no such table
        anywhere in the tree — the only one is in the PR body. The fix landed in `tasks.md`
        and never reached the artefact the finding was actually about. The body was also a
        full round stale.
      - **C3** — `brain-drafts/reviewer-protocol-anchor.md` still stated the pre-round-10
        rule ("carries both"), which is now necessary but not sufficient. The Tier-2 text a
        human pastes into `brain/core/`, missed by the same correction for the second time
        (rounds 4 and 6 each flagged this same artefact class).
      - **E2** — three defensive guards on new code (`Array.isArray(comments)` on both
        providers, `findings ?? []`) survive mutation. They guard shapes no in-tree caller
        produces and no artefact claims null-safety, so they are pinned rather than removed.
- [x] T16 · round 12 — cold review of `c0cab56`, ~72 live mutations with asserted
      substitution-site counts. **No blocker and no defect in executable behaviour**, and
      the reviewer independently confirmed the round-11 repair on the point that mattered:
      renderer and poster agree on all 13 `line` value classes it drove through the real
      chain, and the both-or-neither change weakened nothing on `file`. Four findings, and
      **the two protection findings are both inside round 11's own repair** — the third
      round running where that is true:
      - **C1 — the `line:` push on the FOLLOW_UPS branch was pinned by nothing.** Deleting
        it, or freezing its value, on that branch ALONE left the suite green — while the
        identical mutation on the `findings` branch reds. The block would then emit a
        follow-up with `file:` and no `line:`: a rendered half anchor, the state three
        artefacts and round 11's own commit message declare impossible "in both branches".
        **Why round 11 missed it is the lesson**: its drift mutation changed BOTH branches
        at once, so the asymmetry was never probed. A both-branch mutation cannot detect a
        one-branch gap, and this change has now been bitten by per-branch asymmetry three
        times (rounds 5, 8, 12). Every render mutation in this round's proof runs per
        branch as well as together — nine of them, nine reds.
      - **C2 — the `Number()` coercion at both render sites was pinned by nothing**, and it
        is the sole mechanism making the block's `line:` agree with the wire's. Without it
        `line: '  42  '` renders as `"  42  "` while the poster sends `42`, and `line: true`
        renders as `true`, which re-parses to `'true'` and is then not a usable anchor at
        all. That is precisely the block-vs-wire divergence `hasUsableAnchor` exists to
        eliminate, one deletion away with a green suite. It is the fourth defensive line on
        new code to survive mutation; round 11's E2 pinned three and did not ask the
        question of the line it was itself rewriting.
      - **C3** — both in-code copies of the anchor comment still said "emitted only when
        present". False of the code directly beneath them since round 10. Round 11 rewrote
        that exact sentence in the spec and in the Tier-2 draft and left both copies
        standing on the lines it was changing.
      - **C4** — this ledger's own axis count recorded round 10 as `1`. Round 10's entry
        records findings on two axes (E1 unpinned protection, E2 false claim); the sequence
        counts at ANY severity, which is the criterion `4e12a3c` states explicitly. It
        understated — the property round 10's E2 identified as why such a number survives,
        reproduced two rounds later in the line that cites it.
      Corrected: rounds 1-11 answered YES on **3, 2, 2, 1, 1, 2, 2, 2, 2, 2 and 3** axes.
- [x] T16 · round 13 — cold review of `f6978ed`, ~40 live mutations, each with an asserted
      site count and each green re-confirmed against the FULL suite. **No blocker and no
      defect in executable behaviour** (the axis has failed at rounds 1 and 11 only —
      round-24 cold review struck the ordinal here too; this entry carried a wrong one in its
      header while its own B2 corrected the same counter three paragraphs down). Five
      findings, and the first is again inside the previous round's repair:
      - **B1 — the usability rule was pinned for 3 of the 5 value classes the change's own
        JSDoc enumerates.** Round 12 correctly diagnosed "a both-branch mutation cannot find
        a one-branch gap" and fixed per-BRANCH blindness — with a case driving ONE positive
        value class per branch. The negative side was covered only by `null` (→0) and a
        poison string (→NaN), so a PARTIAL re-inline of the predicate — one that still
        rejects both of those — let `2.5` and `-3` render on both branches with the suite
        green. Round 12 fixed blindness by branch and left blindness by value class.
        **My first repair for it was green under R8** (the path check dropped), because the
        empty-path fixture carried `line: null` — the line check excluded it and the path
        check was never consulted. A negative fixture has to fail for the reason under test
        and no other; it now carries `line: 12`. Five mutations, five reds.
      - **B2 — "Six rounds running with no behavioural defect" contradicted the axis list in
        its own bullet.** Round 11 is recorded as `3`, which is only reachable if the
        behavioural axis is one of them — and it is: round 11's C1 says the block "began
        emitting `line: 0` … now real rather than mutation-only". The streak ending at round
        12 was ONE. This is round 10's E2 with the sign flipped: that one understated, this
        one OVERSTATED, which is the harder direction to catch — and it appeared in the
        successor of the sentence round 10 corrected, in the round written to fix the
        ledger's axis counts.
      - **B3** — the PR body was a full round stale, in the paragraph asserting its round
        counts come from `git log`. Fourth occurrence against that artefact.
      - **B4** — issue #491 says the cascade covers "three paragraphs" and then lists four.
        The fourth was added by round 6 and the numeral was left frozen. **The string exists
        nowhere in the tree**, which is why six rounds of in-tree sweeps never saw it.
      - **B5 (editorial)** — GitLab's `!refs` guard was exercised only through a THROWING
        read; a 2xx whose body simply has no `diff_refs` reaches it too, and fabricating
        shas on that path was green. Round 3's C1 was this same input class on the notes
        POST; it did not follow the other read #405 added.
      Corrected: rounds 1-12 answered YES on 3, 2, 2, 1, 1, 2, 2, 2, 2, 2, 3 and 2 axes. The
      behavioural axis failed at rounds 1 and 11 ONLY, so the streak ending at round 13 is
      two, not six.
- [x] T16b — **CRITERION RULED by the maintainer**: the review rounds stop after **two
      consecutive rounds with nothing at blocker or correction severity**. An editorial
      finding does not break the streak; each reviewer is told this explicitly, so it can
      neither inflate an editorial to hold the streak open nor deflate a correction to close
      it. The superseded criterion — "one round finds nothing on any axis at ANY severity" —
      is recorded as not converging: thirteen rounds, none clean, against reviewers who can
      always find one more assertion to tighten. Round 10 met half the new form and round 11
      broke it, which is the evidence that two rounds is the right length rather than that no
      criterion works.
- [x] T16 · round 14 — first round judged under the ruled criterion. **No blocker and no
      defect in executable behaviour.** Two corrections, so the streak did not start.
      **Two claims in this very entry were false and are corrected here** (round 15):
      - *"the first time in fourteen rounds with NO false normative claim — the PR body and
        #491 were both current, also a first."* The body was NOT current. The criterion
        ruling landed at `4a0fd11` (12:51) and round 14 reviewed `5d54f53` (13:22), so the
        body already asserted the criterion was unruled while the tree recorded it ruled.
        Written by the same commit that recorded the ruling.
      - *"(eighth round)"*. It reconciles with nothing. Round 13's own B2 established the
        behavioural axis failed at rounds **1 and 11 only**, which makes round 14 the
        twelfth behaviour-clean round, or the third consecutive. "Eighth" counts neither.
      Two corrections, so the streak does not start. Both are the same axis: **the FAILURE
      had one value class.** Round 13 widened the value classes of the finding's `line`;
      nobody had varied what a failure looks like, or what protocol the verdict is on.
      - **C1 — the retry's TRIGGER was pinned by nothing.** Every anchored-rejection fixture
        in the tree emits `HTTP 422`. Narrowing the trigger to a 422 shape left all 2579
        tests green and LOST THE VERDICT on a transient 502:
        `attempts 1 → { url: null, error: 'HTTP 502' }`.
        `github.mjs` had named that exact mutation and rejected it in a comment — *"gating on
        a 422-shaped stderr would make a transient failure lose the VERDICT"* — while
        REQ-405-4 above it still said *"when a provider rejects the inline payload (GitHub
        422…)"*. **The requirement never asked for the test.** Round 6 corrected D3 and the
        ADR draft on this same point and left the requirement, so the correction had nowhere
        to land. Requirement corrected to "for any reason"; one shared contract case now
        drives both providers at 502, which also covers GitLab's sibling property — its drop
        count must not depend on why the anchor failed. Red-proofed in four spellings
        (422-shape, any-4xx, the word "diff", and GitLab's position-shaped catch): four reds.
      - **C2 — "not gated on protocol" was pinned by nothing.** All twelve anchored render
        fixtures set `protocol: 'brain-review/2'`; round 13 varied `line` across five value
        classes and both branches and held `protocol` constant across every one. Adding
        `proto === 'brain-review/2' &&` to the guard survived, and reintroduced exactly the
        drift round 11 restructured the code to prevent: the block advertises no anchor while
        the poster posts one. `/1` is the default at `lite` AND `standard` — the majority
        protocol, and the one this repo runs on.
        The new case asserts the AGREEMENT rather than either half: for both protocols, both
        branches, the block emits the pair and `deriveInlineComments` derives exactly what it
        advertises. Red on the mutation applied to both branches and to each one alone.
      **What this round teaches about the shared predicate**, worth keeping: one function
      stops drift by FIELD VALUE and cannot stop drift introduced at the CALL SITE by an
      input dimension the predicate never receives. `hasUsableAnchor` never sees `protocol`.
      A shared rule is not the same as a shared decision.
- [x] T16 · round 15 — cold review of `7115ab1`, ~15 live mutations. **No blocker, no defect
      in executable behaviour** (the axis has failed at rounds 1 and 11 only — round-23
      cold review struck the running ordinal here), and every round-14 red-proof claim
      independently re-verified as holding. Three corrections, so the streak stays at zero.
      **The first two are round 14's own lesson applied to round 14**, which is the
      instructive part:
      - **C1 — the drop count was unpinned along the PARTIAL axis.** Round 14 varied WHY an
        anchor fails (422 → 502) and held constant HOW MANY: every anchored-rejection
        fixture in the tree refuses ALL anchors or none. On GitLab `dropped` is a per-anchor
        counter — the only reason that variable exists, since GitHub's is `inline.length` by
        construction — so its arithmetic was pinned by nothing. Both `inlineDropped:
        inline.length` and `dropped = inline.length` survived. With 3 anchors and 1 refused,
        each reports 3, which is REQ-405-4's own failure mode: the count stops distinguishing
        "no anchors" from "the anchors would not attach". And the partial case is the
        DESIGNED one — `gitlab.mjs` names an anchor on a context line as the expected drop.
      - **C2 — the poster's CALL SITE was unvaried along `mode` and along anchor count.**
        Round 14's C2 asserted the block-vs-wire agreement by calling `deriveInlineComments`
        directly, bypassing `postVerdict` — the one place that drift can enter. Every
        anchored poster fixture used `tranche`; only the anchorless ruling case varied
        `mode`. Gating `checkpoint` alongside `ruling` survived, and `checkpoint` is a live
        production mode. `.slice(0, 1)` survived too, because every fixture supplied exactly
        one anchor.
        **Round 14 wrote the lesson and did not apply it to its own repair**: it said a
        shared predicate cannot stop drift introduced at the call site by a dimension the
        predicate never receives — and then tested the predicate instead of the call site.
      - **C3** — the PR body stale for the sixth time, plus the two false claims in the
        round-14 entry, corrected above.
      Six mutations, six reds, per-spelling and per-dimension.
- [x] T16 · round 16 — cold review of `cb3539a`. **The closest yet: no blocker, no defect in
      executable behaviour (failed at rounds 1 and 11 only), NO false normative claim, and exactly ONE
      correction.** Every prior round's red-proof claim independently re-verified as holding.
      - **C1 — CARDINALITY AND CORRESPONDENCE.** Round 15 varied how many anchors are
        REFUSED and how many are DERIVED. It held constant how many are **delivered**, and
        whether the k-th comment still belongs to the k-th finding. Every assertion in the
        tree that inspects an anchor's CONTENT drove exactly one anchored finding; the two
        multi-anchor fixtures assert a PROJECTION — `(path, line)` at the poster, `path`
        alone on GitLab. Seven mutations green because of it, across four files.
        The sharp one is a single token on the provider production actually uses:
        `comments: inline` → `comments: inline.slice(0, 1)`. Every anchor after the first is
        discarded and **`inlineDropped` stays ABSENT** — the run reports a healthy inline
        review that delivered one comment out of five. That is REQ-405-4's own failure mode
        with the sign flipped: the count does not merely fail to distinguish "no anchors"
        from "they would not attach", it positively asserts nothing was lost.
        Fixed at all four layers, asserting the FULL TRIPLE per anchor rather than a
        projection — a projection is precisely what let `line` and `body` collapse to the
        first anchor's on both providers while `path` stayed right. Seven mutations, seven
        reds.
      **The lesson, and it is the same one three rounds running:** a repair fixes the
      dimension it was pointed at and leaves the next one constant. Round 14 varied the
      failure's value class; round 15 varied refusal count and call-site mode; round 16
      varied delivery count and per-entry correspondence. Each was invisible to the one
      before because a fixture with N=1 makes correspondence trivially true.
- [x] T16 · round 17 — cold review of `765c6df`. **No blocker, no defect in executable
      behaviour (failed at rounds 1 and 11 only), no false normative claim. Two corrections**, so the
      streak stays at zero.
      - **C1 — the repair's own assertion was still a projection.** Round 16 fixed four
        layers by asserting the full triple per anchor, and wrote in its own test comment
        that a projection is what let `line` and `body` collapse while `path` stayed right.
        `deriveInlineComments`'s own test was left as three projections — `out.map(c =>
        c.path)`, two `line` reads, and `assert.match(out[0].body, /e1/)`. So the
        correspondence between a finding and its comment was unpinned in the one function
        that establishes it. `body` taken from `findings[out.length]` instead of from `f`
        left the whole 2588-test suite green, and the live probe showed the payload it
        produces: a comment on `w.mjs:7` carrying the text of finding `b` — a finding
        `renderVerdict` emits with no `file:` and no `line:` at all. Text on the diff the
        posted verdict does not support, which is the single thing the anchor rule exists
        to prevent, reintroduced by the round that thought it had removed it.
        Fixed with one whole-list `deepStrictEqual` over the existing mixed fixture — two
        anchors SEPARATED by ten unanchored findings, so an index shift is observable, and
        strict so `line: '7'` surviving as a string cannot pass. Five mutations, five reds
        (index shift, body smear, line smear, id prefix dropped, `Number()` dropped); the
        last two were invisible to `match(/e1/)` and to loose `deepEqual` respectively.
      - **C2 — T18b claimed the anti-pattern ships inside PR #490.** It does not: after the
        maintainer's ruling it went to `main` as `013845d` via PR #493 (issue #492). The
        entry was written before that ruling and never revisited. Corrected, and E1 gives
        the drafted copy the same ⛔ banner `promotion-checklist.md` carries, since a draft
        that reads as a live instruction is how a second promotion happens.
      **The lesson:** the axis a round is blind along can be one the SAME round named. Round
      16 diagnosed projections, repaired four call sites, and did not apply the diagnosis to
      the function under test. Knowing the failure mode is not the same as sweeping for it.
      **Owed to `brain/core/anti-patterns/red-proof-blind-along-an-unvaried-axis.md`:** four
      axes have been found since it was promoted — FAILURE VALUE CLASS (14), CALL-SITE
      DIMENSION (14/15), SUBSET-VS-TOTAL (15), CARDINALITY/CORRESPONDENCE (16). That doc is
      Tier 2 and on `main`; folding them back is a human promotion, drafted once this
      settles rather than piecemeal. Rounds 17-19 add a fifth item that is not an axis but a
      rule about repairs, and each round strengthened it: **a repair must be applied by
      SEARCH, and the search recorded, or the next round finds the sibling.** Three rounds
      running, each one's correction was the previous one's repair stopping at the instance
      the reviewer had pointed at — 17 caught 16's, 18 caught 17's, 19 caught 18's, and 19's
      gap was three lines below 18's fix in the same file.
- [x] T16 · round 18 — cold review of `a03a63e`. **No blocker, no defect in executable
      behaviour (failed at rounds 1 and 11 only), no false claim, ONE correction.** Streak stays at zero.
      Round 17's lesson applied as the round's method: sweep the diagnosis rather than the
      instance. Twelve mutations across three probes, eleven RED — ORDER at all three layers,
      wire-level type coercion at both providers, the two `inlineDropped` totals, the printed
      count. All already pinned, several by assertions written two rounds before the axis had
      a name.
      - **C1 — the diagnosis swept, and it landed one layer past where round 17 stopped.**
        Round 17 replaced a projection with a whole-value assertion in *one* test. The same
        shape survived in `cli.test.mjs`: a filter on `/could not be anchored/` plus
        `assert.match(reported[0], /\b2\b/)` pins that a number and a phrase are present and
        leaves **everything between them free**. Degrading the message to
        `brain:review: 2 could not be anchored` left the suite green.
        That message is the failure REQ-405-4 cites by name. A reader told two things were
        lost — not told WHAT was lost, nor that the text survives in the summary block —
        concludes the findings are gone. `evidence-reader-empty-on-failure`, relocated from
        the evidence to the recovery instruction. And it is the single path where the tool
        has *already* failed at something, so it is the worst place to be vague.
        Fixed with an exact-string `strictEqual` on the whole line, deliberately brittle:
        rewording what a human is told on the failure path should cost a test edit. Three
        mutations that were green (count hardcoded, pointer deleted, message degraded) are
        now three reds.
      **The lesson:** round 17 said a round is not immune to the failure mode it names.
      Round 18 says the same thing about the *repair*: fixing the instance the reviewer
      pointed at is not the same as sweeping the class. The correction round 17 made was
      correct and incomplete, and the incompleteness was one `grep` away.
- [x] T16 · round 19 — cold review of `5109b7d`. **No blocker, no defect in executable
      behaviour (failed at rounds 1 and 11 only), no false claim, ONE correction.** Streak stays at zero.
      - **C1 — round 18's sweep stopped three lines short of itself.** Round 18's whole
        lesson was "fixing the instance is not sweeping the class", and it removed the
        `assert.match(reported[0], /\b2\b/)` projection from one CLI test while the
        identical `assert.match(reported[0], /\b1\b/)` sat in the very next test in the same
        file. Both green: the singular case can be special-cased into its own message —
        including `1 inline comment(s) could not be anchored — no findings were affected.`,
        which prints the count and asserts the **opposite** of what happened — and the suite
        never notices. Fixed with the same whole-line `strictEqual`. Two mutations, two reds.
        Swept the rest of the diff for the class rather than eyeballing it: the remaining
        `assert.match` on a comment body (`poster.test.mjs`, the id+evidence case) and the
        e2e's `comments[0].body` are both N=1 fixtures whose correspondence is pinned at the
        contract layer by round 16's full-triple list — verified by mutation, not assumed.
      **The lesson, third round running and now unmistakable:** the reviewer's finding names
      a location; the class it belongs to is always larger, and the round that repairs it is
      not exempt from it. Rounds 17, 18 and 19 each caught the previous round's repair
      leaving one sibling untouched — 17 caught 16's, 18 caught 17's, 19 caught 18's, and
      each gap was one `grep` from the fix. That is the fifth item owed to the anti-pattern,
      and it is a stronger claim than the one drafted after round 17: not merely "the round
      that names a failure mode is not immune to it", but **a repair must be applied by
      search, and the search recorded, or the next round will find the sibling.**
- [x] T16 · round 20 — cold review of `176b1fb`. **No blocker, no correction, no false
      claim. The FIRST clean round; the streak is 1 of 2.**
      Method: rounds 17-19 each found the previous repair's untouched sibling, so this round
      swept the class MECHANICALLY before looking at anything else — every assertion in the
      diff that projects over a value the change produces, mutation-tested rather than read.
      Eleven mutations, and the two that mattered most were aimed at the one layer rounds
      16-19 never reached, the RENDERED block:
      - **Anchors ROTATED among the findings** and **among the follow_ups** — every path and
        every line still present in the block, each under the WRONG finding. Every assertion
        on the block is a `/^ {4}file: X$/m` presence regex, which cannot see this. Both RED
        anyway: the `#381` round-trip tests parse the block back and compare per finding, so
        correspondence there is pinned by the parser, not by the regexes. Same for the
        half-rotation (own path, next finding's line).
      - **`follow_ups` posted inline** (5 red), **the CLI handing the poster a list the block
        never rendered** — both the follow-ups spread and the raw pre-gate list (1 red each,
        the source drift guard).
      - **GitLab's summary-first ordering**: the reorder mutation came back GREEN and was
        **INERT** — it moved nothing. Recorded as such rather than as a finding, which is the
        rule this branch's own harness failures taught: a green from a mutation that did not
        substitute measures nothing. The real axis is already pinned by the `dieAfterFirst`
        contract case, whose comment records that the same inert mutation is what led to it.
      One provenance note, below correction severity: round 19's line "verified by mutation,
      not assumed" about the two remaining `assert.match` body projections rests on rounds
      16-18's mutation results, re-read, not on mutations run that round. The claim is true
      as written; the renderer sweep above is the fresh evidence.
- [x] T16 · round 21 — cold review of `33b09ca`. **No blocker, no defect in executable
      behaviour (failed at rounds 1 and 11 only), ONE correction.** The streak breaks at 1 and returns
      to zero.
      - **C1 — the ledger asserted a two-artefact repair it had made in one.** Round 17's E2
        was "T17 and the PR body name different commits for the trailer boundary". The repair
        edited T17 and closed with *"Both now say both."* The PR body still said only
        `ec153ea`, and had said only that for four more rounds. The sentence was **false when
        written** — round 15's C3 exactly, and round 19's stopped-short repair exactly, in
        one line.
        Not an isolated slip: the ledger records the PR body going stale or lagging a repair
        at rounds **6, 7, 8, 9, 11, 13, 14 and 15** — eight — and **round 11's** C2 has the
        same shape verbatim: *"the fix landed in `tasks.md`"* while the only copy that
        mattered was the body. (This sentence first read "rounds 6, 7, 10, 12, 13, 14 and 15
        … round 12's C2 … seven occurrences", written from memory rather than from the file;
        round 22's C1 corrected it against a scan that attributes every `PR body` mention in
        this ledger to the round it sits under. A paragraph about unverified claims,
        unverified.)
        **Eight occurrences of one defect is a process defect, not eight mistakes.** The
        cause is ordering: the PR body was refreshed LAST, after the ledger entry claiming
        it. From round 22 the body is rewritten in the same edit as the entry that describes
        it, before the commit — the claim and the artefact land together or neither does.
      Everything else swept clean: the change's own artefacts (spec, design, proposal, the
      five drafts) re-read against the code for claims rounds 17-20 could have falsified —
      none, because rounds 18-20 changed only test assertions and the ledger. `origin/main`
      merged in (the branch was `behind`, #493 having landed the anti-pattern there); 2627
      tests, 0 fail; `repo:check` ✓, `brain:nav` ✓.
- [x] T16 · round 22 — cold review of `f5aba07`. **No blocker, no defect in executable
      behaviour (failed at rounds 1 and 11 only), TWO corrections**, both in round 21's own entry, both
      found by checking its claims against the file instead of against memory.
      - **C1 — round 21's list of prior occurrences was wrong.** It said the PR body had
        gone stale at "rounds 6, 7, 10, 12, 13, 14 and 15 … round 12's C2 … seven
        occurrences". A scan attributing every `PR body` mention in this ledger to the round
        it sits under gives **6, 7, 8, 9, 11, 13, 14, 15** — eight — and the verbatim
        "the fix landed in `tasks.md`" line is **round 11's** C2. A paragraph about claims
        made without checking, made without checking. Corrected, with the scan recorded.
      - **C2 — `T18c` was cited in two artefacts and defined in none.** Round 21's PR body
        lists it twice under open human acts, and round 17's ⛔ banner on
        `anti-pattern-mutation-blind-by-axis.md` names it as what is still owed. No such task
        existed. A reader following either citation lands nowhere — and the banner's whole
        job is to stop a second promotion by pointing at the amendment instead. T18c now
        exists, spelling out all five items and why `brain:promote` cannot do it.
      Verified rather than assumed this round: `013845d` is an ancestor of `origin/main`;
      #491 is open with `status:approved`; the trailer boundary (`ca6ab5a` last, `ec153ea`
      first clean) re-measured from `git log --format=%(trailers)`; the merge dropped
      `brain/core/**` out of this PR's diff entirely, so T18b's "does not ship inside PR #490"
      is now true of the diff and not only of the history. 2627 tests, 0 fail; governed diff
      **360** of 1000.
- [x] T16 · round 23 — cold review of `2afcc10`. **No blocker, no defect in executable
      behaviour, ONE correction.** Streak back to zero.
      Round 22's own claims re-verified first, mechanically, since round 22's finding was a
      claim written from memory: the eight-occurrence list, the round-11 attribution, T18c's
      existence, `013845d`'s ancestry, #491's state and label, the trailer boundary, the test
      count and the governed diff all check out.
      - **C1 — the running "Nth consecutive behaviour-clean round" is wrong in every entry
        that carries it, and this is the FOURTH time it has been found wrong.** Round 10's
        E2 and round 13's B2 both caught it contradicting the axis list; round 14 caught
        *"(eighth round)"* reconciling with nothing and fixed that instance. It broke again
        immediately. Round 14's own correction establishes the axis failed at **rounds 1 and
        11 only**, which puts round 12 first in the current run — so round 15 is fourth, not
        third, and every ordinal from 15 to 22 is off by one. Rounds 21 and 22 are off by
        two, because round 21 counted from round 19 and skipped round 20, which was clean and
        carried no ordinal at all.
        Four repairs of one numeral is the signal that the numeral is the defect. The remedy
        is the one round 14 already chose for the trailer denominator, and wrote down as
        such: **do not carry a number that has to be re-derived every round.** All seven
        ordinals are struck and replaced with *"the axis has failed at rounds 1 and 11 only"*
        — checkable against this ledger in one scan, and unable to go stale by the passage of
        rounds. The PR body already stated it as a boundary ("no round since 11"), which is
        the same invariant and needs no change.
- [x] T16 · round 24 — cold review of `5785062`. **No blocker, no defect in executable
      behaviour, ONE correction.** Streak back to zero.
      - **C1 — round 23's sweep matched one spelling and missed two entries.** It struck
        every *"Nth consecutive"* and left *"for the third round running"* (round 6) and
        *"— seventh round"* (round 13), both of which are wrong: under the axis list round 6
        is the fifth behaviour-clean round and round 13 the eleventh, or the second
        consecutive. Round 13's is the sharp one — that entry carries a wrong counter in its
        header while its own **B2**, three paragraphs down, corrects the same counter.
        This is round 19's finding again, applied to round 23: **a repair applied by search
        is only as complete as the pattern searched for.** The rule needs the corollary:
        search for the CLAIM, not for its wording. Struck both, then re-swept with a pattern
        covering every ordinal spelling — the three remaining hits are round 14's and round
        23's quotations of the defect and round 19's unrelated (and correct) count of the
        repair-stopped-short streak.
      **A judgement for the maintainer, not a finding.** Rounds 21-24 have produced four
      corrections and every one of them is in this ledger or the PR body — a wrong list of
      round numbers, an undefined task id, a stale ordinal, a sweep that matched one
      spelling. The code has been clean on the behavioural axis since round 11 and on the
      unpinned-protection axis since round 20. The ruled criterion counts corrections without
      regard to what they are about, so it is now measuring the accuracy of the record rather
      than the safety of the change. Both are worth having; they are not the same thing, and
      the criterion cannot currently distinguish them. Continuing under the ruling as given.
- [x] T16 · round 25 — cold review of `ba535b4`. **No blocker, no defect in executable
      behaviour, ONE correction.** Streak back to zero.
      Round 24's own claims re-verified first and all held: round 6 is the fifth
      behaviour-clean round, round 13 the eleventh (second consecutive), and the ordinals
      surviving the re-sweep are quotations of the defect plus one unrelated, correct count.
      - **C1 — T18c said "Four rounds running", and it is wrong twice over.** The instances
        it lists (17→16, 18→17, 19→18, 22→21) are **not consecutive** — round 20 was clean
        and round 21's finding was a different class — and the list is now **five**, because
        round 24 caught round 23's strike. A streak claim about the very pattern "the count
        goes stale between rounds", going stale between rounds.
        This is the fourth ordinal struck since round 23, so the remedy is applied at the
        level of the rule rather than the instance: **no NEW entry carries a count of rounds
        — it enumerates.** Numbers measured once and never re-derived (the test count, the
        governed diff, the axis list) stay; numbers that grow with the review do not.
        Re-swept afterwards for every ordinal spelling: what remains is rounds 12, 16 and
        19's local streak counts, each closed at the time and each verified correct against
        the entries it refers to, plus three quotations of the defect.
        (This paragraph first read *"the ledger no longer carries counts of rounds anywhere"*
        and then listed three it still carries — round-26 cold review, C1. Corrected to the
        rule that was actually adopted.)
- [x] T16 · round 26 — cold review of `61d30d0`. **No blocker, no defect in executable
      behaviour, TWO corrections**, both in round 25's entry.
      - **C1 — the paragraph contradicted itself in three sentences.** It declared *"the
        ledger no longer carries counts of rounds anywhere"* and then listed three it still
        carries. Round 13's B4 shape exactly ("the cascade covers three paragraphs" followed
        by four). Corrected to the rule actually adopted: no NEW entry carries a count.
      - **C2 — round 21's own rule was broken at round 25.** The rule is that the PR body and
        the ledger entry describing it land in one edit or neither does. Round 25 committed
        the entry and left the body at round 24. Applied here for both.
      **Entries from here are terse by construction.** Every correction in rounds 21-26 is in
      this ledger or the PR body; none is in the code. Enumerated: 21/C1 a two-artefact claim
      verified against one; 22/C1 a list of round numbers written from memory; 22/C2 `T18c`
      cited and undefined; 23/C1 a stale ordinal in every entry carrying it; 24/C1 a strike
      that matched one spelling; 25/C1 a streak count gone stale; 26/C1 a paragraph
      contradicting itself; 26/C2 round 21's rule broken at round 25.
      Each round writes a paragraph of narration and the paragraph becomes the next round's
      finding. The change is not getting less correct — the record is getting longer. So the
      narration stops: commit, verdict, findings, evidence.
- [x] T16 · round 27 — cold review of `c207de7`. **No blocker, no defect in executable
      behaviour, ONE correction.**
      - **C1 — round 26 said "seven corrections" where the enumeration gives eight**
        (21/C1, 22/C1, 22/C2, 23/C1, 24/C1, 25/C1, 26/C1, 26/C2), in the entry that had just
        banned carrying counts. Replaced with the enumeration, here and in the PR body.
      Verified this round: round 26's other claims; the axis list; `013845d` on `origin/main`;
      #491 open and `status:approved`; the trailer boundary; 2627 tests, 0 fail; governed diff
      360 of 1000; `repo:check` ✓; `brain:nav` ✓.
- [x] T16 · round 28 — cold review of `2f7b9c9`. **No blocker, no defect in executable
      behaviour, no correction, no false claim. Clean. Streak 1 of 2.**
      Evidence: rounds 16 and 17's mutation batches re-run against the MERGED tree — 13
      mutations, 13 red, including the two sharpest (`comments: inline.slice(0, 1)` on the
      provider production uses, and `body` taken from `findings[out.length]` in the poster).
      Round 27's claims re-verified and all hold. `origin/main` touched none of this change's
      files, so the merge could not have weakened anything, and the batches confirm it did
      not. 2627 tests, 0 fail; governed diff 360 of 1000; `repo:check` ✓; `brain:nav` ✓.
      **CI: eight green, `actor-check` RED, and it is not a finding against this change.**
      L5′ requires `status:approved` to be applied strictly AFTER the newest foreign commit;
      the label was applied 02/08 and every review round has pushed since. The gate is
      working exactly as written. It is also **not agent-fixable**: #124 forbids the agent
      applying `status:approved` under any circumstance. Consequence worth stating plainly —
      **every further round invalidates the approval again**, so the round loop now has a
      per-round cost to the maintainer that the criterion does not account for.
- [ ] T16 · round 29 — the axis has failed at rounds 1 and 11 only; round 28 was clean. One
      more clean round meets the ruled criterion and the review ends.
- [x] T18 — **the transferable finding, drafted for the reviewer line (#313).** Maintainer's
      call that this knowledge outlives #405: `brain-drafts/anti-pattern-mutation-blind-by-axis.md`,
      for `brain/core/anti-patterns/`.
      The claim it records: a red-proof measures the pair (mutation, test), not the code, so
      a green means nothing until the axis the mutation did NOT vary has been named. Six axes,
      each found the round after the previous was fixed — PATH, BRANCH, VALUE CLASS, SPELLING,
      FIELD, SITE — plus three harness failure modes that produce meaningless greens
      (semantically inert substitution, silent non-substitution, and a negative fixture that
      fails for the wrong criterion).
      It belongs to the reviewer line specifically because the reviewer's three locks are
      where a false green is most expensive: on this PR, two rounds of false greens sat
      between `prReviewComment` and a postable APPROVE carrying the reviewer's own token.
- [x] T18b — **PROMOTED by the maintainer** at `4447f60` on this branch, and then — on the
      maintainer's ruling that the other agents should have it without waiting on #490 —
      cherry-picked onto `main` as `013845d` via PR #493 (issue #492). It is on `main` now, and
      it does **not** ship inside PR #490. `brain:nav` ✓ (the README entry landed with it),
      `repo:check` ✓, L6 `pass` — the PR author is the maintainer, not a listed bot, which is
      the whole evidence form at `lite`. Original instruction below, kept as the record of
      what was asked for:
      **HUMAN: promote** the anti-pattern to
      `brain/core/anti-patterns/red-proof-blind-along-an-unvaried-axis.md`, and add its entry
      to `brain/core/anti-patterns/README.md` — the index is not optional, `check-brain-nav.mjs`
      requires every `brain/**/*.md` to be reachable from `HOME.md` and that README is the
      index that reaches this folder. Tier 2, and the README's rule 3 asks for promotion in
      the same commit as the change that discovered it.
      **English, title and filename** — corrected on maintainer feedback. The first draft
      carried both in Spanish. `core/**` is the generic half that ships to consumers, which is
      the same reason `check-brain-nav.mjs` refuses a `core → project` link; every title in
      that folder is already English, and the two most recently promoted files
      (`evidence-reader-empty-on-failure`, `pre-v0-8-0-upgrade-clobber-lockout`) had already
      moved the filenames that way too. Worth recording rather than silently fixing: the
      agent reached for the language of the conversation instead of the language of the
      destination.
- [ ] T18c — **HUMAN: amend the promoted anti-pattern with what rounds 13-21 added.**
      `brain/core/anti-patterns/red-proof-blind-along-an-unvaried-axis.md` is on `main`
      (`013845d`) and names six blindness axes. Five items have been found since it was
      signed and none of them is in it:
      - **FAILURE VALUE CLASS** (round 14) — every anchored-rejection fixture emitted
        `HTTP 422`, so what an inline failure LOOKS like was never varied, and both
        providers had a live protection resting on that.
      - **CALL-SITE DIMENSION** (rounds 14-15) — a shared predicate stops drift by field
        value and cannot stop drift introduced at the call site by a dimension the predicate
        never receives.
      - **SUBSET vs TOTAL** (round 15) — every refusal fixture refused all or none, so a
        partial loss reported as a total one was invisible.
      - **CARDINALITY / CORRESPONDENCE** (round 16) — a fixture with N=1 makes "the k-th
        comment belongs to the k-th finding" trivially true.
      - **A repair must be applied by SEARCH, not to the instance** — not an axis but a rule
        about axes. The instances, enumerated rather than counted (round-25 cold review
        struck "Four rounds running", which was wrong twice over — they are not consecutive,
        and there are five): **17** caught 16's diagnosis unapplied to the function it was
        about; **18** caught 17's projection surviving in the CLI message; **19** caught 18's
        fix stopping three lines short in the same file; **22** caught 21's list of prior
        occurrences written from memory; **24** caught 23's strike matching one spelling of
        the claim it was striking.
        Two corollaries the instances forced: from round 21, when a repair spans two
        artefacts they land in one edit or neither does; from round 24, **search for the
        CLAIM, not for its wording**.
      This is an **amendment to a live file**, not a promotion — `brain:promote` slice 1
      accepts only new-file ADR promotions, so it cannot be used here. Tier 2: the agent
      drafts, a human signs. Draft lives at
      `brain-drafts/anti-pattern-mutation-blind-by-axis.md`, which carries a ⛔ banner saying
      exactly this.
      **This task was cited by the PR body and by that draft's banner before it existed**
      (round-22 cold review, C2) — an id referenced in two artefacts and defined in none.
      Created here so the citations resolve.
- [ ] T17 — **HUMAN: rule on the AI-attribution trailer.** Six commits on this branch
      carry `Co-Authored-By: Claude…`. `brain/core/methodology/agent-authorities.md`
      (Tier 3) and `openspec/config.yaml` both forbid it, the former with the words *"even
      if explicitly asked"* — and the agent's own harness instructions require it, which
      is exactly the conflict that phrase anticipates. **Doctrine wins; the trailer stops
      here.** The last commit that carries it is `ca6ab5a` (round 2); every commit from
      `ec153ea` (round 3) onward is clean. Round 17 flagged that this sentence and the PR
      body named different commits for the same boundary — both were true, one naming the
      last dirty commit and the other the first clean one, which is precisely the kind of
      "two spellings of one fact" this branch keeps finding.
      **This paragraph then said "Both now say both", and that was FALSE when written**
      (round-21 cold review, C1): the edit landed here and the PR body was left as it was.
      A claim about two artefacts, verified against one. Corrected in round 21, in both.
      (The denominator is deliberately not written down: an earlier version said "six of
      eight" and was nine commits later the same day — the exact defect T14 taught itself
      about, committed one paragraph after recording it.)
      What is NOT agent-fixable: the six already published. Amending published commits is
      Tier 3 too, so the remedy is a maintainer call — squash-merge with a clean message,
      or accept them. Causality is `worsened`, not `introduced` — and the base rate was
      measured wrong on the first attempt, one sentence below the paragraph round 4 had
      just rewritten to remove a frozen number:
      ```
      git log origin/main --oneline -i --grep='co-authored-by: claude' | wc -l   # 13
      git log origin/main --oneline    --grep='Co-Authored-By: Claude' | wc -l   #  6
      ```
      `6` counts ONE SPELLING. GitHub's squash-merge normalises the trailer to
      `Co-authored-by:`, and this repo's own detector is case-insensitive
      (`tranche.mjs:43`), so the doctrine-relevant count on `main` is **13**, all inside
      02-04/08. This branch's six take it to 19 — a 46% increase, not the "doubling" the
      first version of this line claimed.
      **And the agent's GitHub COMMENTS**, which round 5 found T17 escalating past. Every
      comment the agent posts ends with `_Generated by [Claude Code](...)_` — AI
      attribution. It is not a Tier-3 item (that list names commits) and the agent's harness
      requires it, so it is raised here rather than removed unilaterally.
      Round 5 wrote this as "the PR body itself", which was true then and stopped being true
      when round 5's own rewrite of that body dropped the footer — leaving T17 asking the
      maintainer to rule on a fact that no longer held (round 9, E1). `tranche.mjs` scans
      `prBody` and nothing else, so the surface that DOES carry the footer — comments — is
      the surface nothing scans. What deserves attention is the instrument, not the footer:
      ```
      AI_ATTRIBUTION_RE.test('_Generated by [Claude Code](...)_')   -> false
      AI_ATTRIBUTION_RE.test('Co-Authored-By: Claude Opus 5')       -> true
      ```
      `tranche.mjs:43` matches `generated with [claude`, not `Generated by [Claude`. The one
      surface the repo scans is scanned by a regex that misses the exact string the agent
      writes, and nothing scans commit messages at all — which is why this reached the
      eighth commit instead of the first. Two gate gaps, both `pre-existing`, neither this
      change's doing and neither fixed here.
