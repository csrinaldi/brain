---
status: designed
issue: 375
epic: 313
artifact_store: openspec
topic_key: sdd/issue-375-l5-deny-set/design
---

# Design — L5 deny-set (issue 375)

## D1 — Option A, and the R2 exception

`governance.reviewActors` gains a second reader rather than a new key being introduced. This
knowingly excepts binding ruling **R2** from #266 ("no key feeds two gates"), and the exception is
the whole design decision — see the ADR draft for the full argument. In short:

R2 was adopted against the hazard in `reviewer-protocol.md` §3, where `approvalActors` was read by
**L5 as permissive** ("authorized to apply the approved label") and **L6 as restrictive** ("excluded
from the human-approver count"). One registration produced two **opposite** effects.

Under Option A both readings are **restrictive and co-directional** — each means *this identity is
not a human authority*. One registration tightens both gates together; no configuration exists where
satisfying one violates the other. Option A reproduces R2's **form**, not its **substance**.

Option B (`denyApprovalActors`, L5-only) honours R2 literally and introduces a **silent fail-open**:
the reviewer must be registered in two lists, and forgetting one disables the denial with no signal.
Closing a fail-open by opening another is not a fix.

## D2 — where the check sits in the decision order

Inserted as step 3, i.e. **above** the allow-list and **below** `adminOverride`:

| Placement | Reason |
|---|---|
| **Above** `botAllowlist` | Deny must beat allow. `reviewer-identity-config.test.mjs` already asserts the lists never overlap in the shipped config, so this ordering only decides a *contradictory* config — and it must resolve **fail-closed**. A misregistration must not hand the reviewer the merge keystroke. |
| **Below** `adminOverride` | `override:*` is the documented, logged human recovery path (`workflow-governance.md`), and #375 scopes rule 2 out. Changing it would be a separate decision. |
| Below rule 1 (missing evidence) | REQ-L5-2's fail-open is deliberate and explicitly out of scope. |

Placing it above the allow-list is a stronger claim than #375's stated "ahead of rule 5", and it is
made deliberately: "ahead of rule 5" is satisfied either way, and only this ordering is fail-closed.

## D3 — separate readers, not one merged list

`defaultReadDenyActors` is a distinct function from `defaultReadBotAllowlist`, each reading its own
key. They are never unioned. This is what keeps the R2 exception narrow: **one key is read by two
gates, but no gate reads two keys into one meaning.** A merged reader would erase the distinction the
whole two-key split exists to preserve.

## D4 — why the existing #266 t1 could not catch this

`actor-check.test.mjs`'s t1 sets the PR author, the issue author AND the label actor all to the same
reviewer identity, so rule 4 (self-approval) fires. Its own assertion message admits it —
*"self-approval is caught instead"*. t1 asserts the reviewer does not pass via the **allow-listed
branch**, which is a strictly weaker claim than "it fails", and it would pass identically with no
deny-set at all.

Every new test therefore makes the actor **differ from both authors**, so nothing but the deny-set
can produce the failure. t1's `level` assertion is untouched; only its `reason` assertion is widened,
because the reviewer is now caught earlier and for the stronger reason.

## D5 — shape tests and behaviour tests are different claims

`reviewer-identity-config.test.mjs` asserted the shipped config's **shape** (handle present, in
`reviewActors`, absent from `approvalActors`). REQ-375-4 adds a **behaviour** assertion: the shipped
config fed into the real evaluator must produce a refusal.

Shape alone would stay green if the shipped handle stopped matching the deny list. That is the
green-in-test / inert-in-production class M10 exists to close, and the one that produced #374's
transient `actor-check` SUCCESS.

## Contract / API impact

`evaluateActor` gains an optional `denyActors` parameter (defaults `[]`, so every existing caller is
unaffected). `gatherActorCheckInputs` gains a `denyActors` field in its return shape and a
`deps.readDenyActors` injection point, mirroring `deps.readBotAllowlist`. No provider, no VCS port,
and no L6 code is touched.

## Rejected alternatives

- **Option B** — see D1.
- **Deriving the denial from `reviewer.handle` directly** (no list): single source, nothing to
  synchronise, but covers exactly one identity and couples L5 to the `reviewer` config block rather
  than to `governance`. Worth revisiting if a second reviewer identity ever exists.
- **Placing the deny check below the allow-list**: would make a contradictory config fail-OPEN.
- **Making rule 5 verify humanness directly** (e.g. querying the account type): a network call inside
  a pure evaluator, provider-specific, and defeated by a human operating a bot session — which is
  exactly the observed failure mode.
