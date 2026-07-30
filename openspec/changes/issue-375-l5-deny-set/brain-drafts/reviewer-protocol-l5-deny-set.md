# Draft — `reviewer-protocol.md`: L5 enforces the deny-set (issue #375)

> **Tier 2 draft.** `brain/core/**` is human-promoted (`agent-authorities.md` Tier 2). This file is
> the proposed edit, not the edit itself.
>
> **Target:** `brain/core/methodology/reviewer-protocol.md`, §3 (line 95) and §9 (lines 232-235).
> Satisfies REQ-375-5. Promote together with **ADR-0025** — these edits reference it.

## Why these two passages must change

Both currently assert protection that does not exist, and between them they are the reason this gap
went unexamined for as long as it did.

---

## Edit 1 — §3's two-key table (line 95)

The L5 row's second clause does not follow from its first. Being absent from the allow-listed branch
means the reviewer is *not admitted by it* — it does **not** mean the reviewer is rejected. Absence
falls through to the final rule and **passes**.

```diff
-| L5 `actor-check.mjs` | `governance.approvalActors` | **No** | Not admitted by the allow-listed branch → cannot self-approve |
+| L5 `actor-check.mjs` | `governance.approvalActors` (allow) **and** `governance.reviewActors` (deny, ADR-0025) | **No** / **Yes** | Not admitted by the allow-listed branch, **and** explicitly denied by the `reviewActors` branch → cannot apply the approved label at all |
```

**Note for the promoter — this table row is now the one place a reader learns that `reviewActors`
feeds two gates.** §3's surrounding prose still describes the split as "L6-only", which ADR-0025
knowingly excepts. Consider adding one sentence after the table:

> `governance.reviewActors` is read by **two** gates as of ADR-0025 — L6 (excluded from the
> human-approver count) and L5 (may not apply the approved label). This is a deliberate exception to
> ruling R2: unlike the `approvalActors` hazard above, both readings are **restrictive and
> co-directional**, so one registration tightens both gates and no configuration can satisfy one
> while violating the other. See ADR-0025 for the full argument.

Without that sentence, a reader who finds one key feeding two gates has every reason to conclude it
is the very bug §3 was written to prevent.

---

## Edit 2 — §3's mandatory-tests line (line 99)

`t1`'s stated claim is stronger than what `t1` actually tests. Its fixture makes the reviewer the PR
author, the issue author and the label actor simultaneously, so rule 4 (self-approval) is what fires;
its own assertion message says *"self-approval is caught instead"*. `t1` would pass identically with
no deny-set at all.

```diff
-`t1` — the reviewer identity does NOT pass `actor-check` when applying `status:approved`;
+`t1` — the reviewer identity is not admitted by `actor-check`'s allow-listed-automation branch
+(note: `t1`'s fixture also makes it the author, so self-approval is what its assertion catches — the
+*denial* is pinned separately by issue #375's tests, which make the actor differ from both authors);
```

---

## Edit 3 — §9's "Defense in depth" paragraph (lines 232-235)

**This paragraph is factually wrong today**, and it is the most consequential of the three edits.

`actor-check.mjs:90` is the **pass** branch: `if (actor && botAllowlist.includes(actor)) → pass`.
Being *not* in `governance.approvalActors` is precisely what lets an identity through — it falls to
the final rule and passes as "human-applied approval". The claimed independent backstop never
existed.

```diff
-**Defense in depth.** `actor-check` independently rejects a misapplied `status:approved` from any
-identity not in `governance.approvalActors` (`actor-check.mjs:90`) — and the reviewer is never in
-`governance.approvalActors` (§3) — so even a deny-set bug is still caught at L5. The actor-check is
-the independent backstop; the deny-set is the first line.
+**Defense in depth (corrected — ADR-0025, issue #375).** The deny-set in the caller is the first
+line, and L5 is the independent backstop — but only since ADR-0025 gave L5 a deny-set of its own.
+`actor-check` now **fails** when the approving actor appears in `governance.reviewActors`, evaluated
+ahead of the allow-listed branch so a contradictory registration resolves fail-closed.
+
+> **Historical note, kept deliberately.** This paragraph previously claimed that `actor-check`
+> "independently rejects a misapplied `status:approved` from any identity not in
+> `governance.approvalActors`". That was **backwards**: `actor-check.mjs:90` is the *pass* branch, so
+> absence from the allow-list granted passage rather than denying it. The asserted backstop did not
+> exist, and that false assurance is why the gap survived — a reviewer identity applying the approved
+> label produced a green `actor-check` on PR #374 until the label was re-applied by a human. Recorded
+> rather than quietly rewritten: doctrine that promises a lock it does not hold is worse than
+> doctrine that admits the lock is missing.
+
+The caller-side deny-set remains necessary and is **not** redundant with L5: it stops the reviewer
+*process* from ever forming the request, while L5 catches the label however it arrives — including
+from a human driving the web UI under the reviewer's session, which no caller-side check can see.
```

---

## What is NOT changing

- §2's three structural locks — untouched. They guard the *review* surface; this change adds a guard
  on the *label* surface, which none of them covered.
- §11's absolute: the reviewer handle is **never** registered in `governance.approvalActors`.
- §9's monotonic-tightening rule and the human-only status of the approved label.
- L6's reading of `governance.reviewActors`.

## Note for the human reviewer — NOT part of the proposed edit

§10's failure-mode table lists **Self-review** as *"a reviewer whose handle equals the PR author MUST
abstain — the same rule `actor-check` enforces at L5"*. After ADR-0025 that sentence is true for a
second, stronger reason, but it is worth deciding whether to say so explicitly: L5 now denies the
reviewer even when it is **not** the author, which is a broader guarantee than the row currently
claims. Proposed, not applied — it is a row this change did not otherwise touch.
