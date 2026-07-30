# ADR-0025 — L5 gets a deny-set: `governance.reviewActors` is read by two gates, on purpose

> **status:** proposed — pending human promotion | **date:** 2026-07-30 | **owner:** @crinaldi
> **supersedes:** nothing | **amends:** ADR-0020 (reviewer port verbs + the two-key split)

> **Tier 2 draft.** `brain/project/decisions/**` is human-promoted (`agent-authorities.md` Tier 2;
> `consolidation-protocol.md` §2 — the human moves it *"in a commit authored by them"*). Promoting
> this file also requires updating `brain/HOME.md`'s decisions list, both because
> `consolidation-protocol.md` §1b demands it and because `adrPresence` fails a diff that adds an ADR
> without touching `HOME.md`.

## Context

`actor-check` (L5) exists to enforce that the approved label — the merge keystroke — carries a
**human** signature. It does not. Its decision order ends:

```
3. Actor in botAllowlist (governance.approvalActors) → pass
4. Actor === author OR === issueAuthor               → fail   (self-approval)
5. Otherwise                                         → pass   ← "human-applied approval"
```

Rule 3 is a **pass branch, not a requirement**. Absence from `approvalActors` causes no failure: the
actor falls through and, if it is not an author, passes as though it were a distinct human. Rule 5's
comment asserts "human-applied" and the code never verifies it. **There is no deny-set anywhere.**

### Measured, not reasoned

Two PRs, identical authorship, opposite verdicts — the only variable was which session applied the
label:

| Issue → PR | Applied by | Rule | `actor-check` |
|---|---|---|---|
| #367 → #374 | **`csrinaldibot`** (the reviewer identity) | 5 | **SUCCESS** |
| #372 → #373 | `csrinaldi` | 4 | FAILURE |

Reproduced on one PR within five minutes: re-applying #374's label from the maintainer's own session
flipped `actor-check` from SUCCESS to FAILURE. **The reviewer applying the merge keystroke produced a
PASS; the human applying it produced a FAIL.**

### Why nobody noticed — the doctrine asserted a backstop that never existed

`reviewer-protocol.md` §9 states:

> **Defense in depth.** `actor-check` independently rejects a misapplied `status:approved` from any
> identity **not in** `governance.approvalActors` (`actor-check.mjs:90`) — and the reviewer is never
> in `governance.approvalActors` (§3) — so even a deny-set bug is still caught at L5.

That is **backwards**. `actor-check.mjs:90` is the *pass* branch. Not being in the list is precisely
what lets an identity through. The claimed backstop was the reason the gap went unexamined.

Two further reinforcements of the same false confidence:

- §3's two-key table records L5's effect on the reviewer as *"Not admitted by the allow-listed branch
  → cannot self-approve."* The first clause is true; the second does not follow from it.
- #266's mandatory test `t1` asserts the reviewer "does NOT pass `actor-check`", but its fixture makes
  the reviewer the PR author, the issue author **and** the label actor at once — so rule 4 fires and
  the assertion holds for a reason unrelated to `reviewActors`. Its own message says so:
  *"self-approval is caught instead"*. `t1` would pass identically with no deny-set at all.

§9 also says the deny-set is *"hardcoded in the caller, not left to the model to remember"*. True for
`brain:review` runs, and it does not cover the **label surface**: a human driving the web UI while
signed in as the reviewer bypasses the caller entirely. §2's three locks guard the *review* surface;
none guards the *label* surface. This has happened twice by accident in this repo — the #367 label
above, and the merge of PR #360 (`e999a36`), the only merge in this repository's first-parent history
attributed to `csrinaldibot`.

## Decision

**L5 reads `governance.reviewActors` as a DENY list**, evaluated **above** the allow-list and
**below** `adminOverride`.

| Gate | Reads `governance.reviewActors` as |
|---|---|
| L6 `brain-writes-reviewed.mjs` | does NOT count as the human reviewer (existing) |
| L5 `actor-check.mjs` | may NOT apply the approved label (**new**) |

No new configuration key. The reviewer identity is registered once, in `reviewActors`, and **never**
in `approvalActors` (§3, §11 — unchanged and still absolute).

## Why ruling R2 is knowingly excepted

This is the load-bearing paragraph of this ADR. Without it, a future reader finds one key feeding two
gates and reasonably concludes it is the very bug §3 was written to prevent.

Binding ruling **R2** (#266) states *"no key feeds two gates"*. It was adopted against a specific
hazard, documented in §3:

> `governance.approvalActors` was read by **L5 as permissive** — in the list ⇒ *authorized* to apply
> the approved label — and by **L6 as restrictive** — in the list ⇒ *excluded* from counting as the
> human reviewer. One registration produced two **opposite** effects; you could not satisfy both
> requirements with one entry, because they pulled the same key in opposite directions.

Under this decision, both readings are **restrictive and co-directional**. Each says the same thing
in substance: *this identity is not a human authority.* One registration tightens both gates
together, and **no configuration exists in which satisfying one reading violates the other**.

So this reproduces R2's **form** (one key, two gates) without its **substance** (opposing semantics).
R2 is a form rule adopted to prevent a substance problem that does not arise here.

The narrowness matters and is preserved deliberately: **one key is read by two gates, but no gate
reads two keys into one meaning.** `defaultReadDenyActors` and `defaultReadBotAllowlist` remain
separate functions reading separate keys; they are never unioned. A merged reader would erase exactly
the distinction the two-key split exists to preserve, and that would be a genuine R2 violation.

## Alternatives considered

**Option B — a new `governance.denyApprovalActors`, L5-only.** Honours R2 literally. Rejected: it
requires the reviewer in **two** lists, so an operator registering a new automation identity in one
and forgetting the other produces a **silent fail-open** — the denial simply does not apply and
nothing reports it. The purpose of this decision is to close a fail-open; trading it for a
fail-open-by-omission is not a fix. This was the deciding argument, not aesthetics.

**Derive the denial from `reviewer.handle` directly**, with no list. Single source, nothing to
synchronise. Set aside because it covers exactly one identity and couples L5 to the `reviewer` config
block rather than to `governance`. Worth revisiting if a second reviewer identity ever exists.

**Place the deny check below the allow-list.** Rejected: a contradictory config (an identity in both
lists) would then resolve **fail-open**, handing the reviewer the merge keystroke on a
misregistration. `reviewer-identity-config.test.mjs` already forbids the overlap, so this ordering
only decides a config that should never exist — which is exactly when fail-closed matters.

**Make rule 5 verify humanness directly** (query the account type). A network call inside a pure
evaluator, provider-specific, and defeated by a human operating a bot session — the observed failure
mode.

**Remove `push` from the reviewer identity** so it cannot merge regardless. Complementary rather than
alternative, and untested: public repositories accept reviews from non-collaborators, so `push` may
be unnecessary. Belongs with #94 / #124.

## Consequences

**Positive.** The invariant "the reviewer is never an approver" becomes enforced code rather than a
documented intention. A misregistration resolves fail-closed. The reviewer identity is registered
once, in one place.

**Negative, and honest.** `governance.reviewActors` is no longer a single-gate key, so R2 no longer
holds unconditionally — future readers must find this ADR to know the exception is deliberate. That
is a documentation dependency, and it is why §3's table and §9's defense-in-depth paragraph must be
corrected in the same promotion.

**Unchanged.** L6's reading of `reviewActors`. `approvalActors` stays L5-only for the allow branch
and override resolution. Rule 1's fail-open on missing label evidence (REQ-L5-2) and rule 2's
`override:*` recovery path are untouched — both deliberate, both out of scope.

**Not fixed by this decision.** L5 still cannot verify that an *unlisted* actor is human. It verifies
only that the actor is not one this repo has named. A second, unregistered automation identity would
still pass rule 6. Closing that would require identity-type verification, which is rejected above.

## References

- Issue #375 (this defect), #266 (Track H, ruling R2, tests t1/t2), #374 (registered the identity),
  #124 (approval as human signature), #94 (branch-protection tier).
- `brain/core/methodology/reviewer-protocol.md` §2 (three locks), §3 (two-key split), §9 (deny-set),
  §11 (reviewer handle).
- `brain/scripts/vcs/actor-check.mjs` (`evaluateActor`), `brain/scripts/vcs/brain-writes-reviewed.mjs`.
- ADR-0020 (reviewer port verbs + the two-key split), amended by this decision.
