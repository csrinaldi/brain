# Draft — write down the promotion cascade and the ADR-amendment convention (issue #378)

> **Tier 2 draft.** `brain/core/**` is human-promoted (`agent-authorities.md` Tier 2). This file is
> the proposed edit, not the edit itself.
>
> **Target:** `brain/core/methodology/consolidation-protocol.md`, a new **§1c** immediately after
> §1b ("HOME.md maintenance rule"). English, because `brain/core/**` ships to consumers.
>
> **Why this draft exists:** it is the **prerequisite for slice 2 of #378** (automating in-place
> edits to signed `brain/**` files — measured on #405 as the majority shape). The rule below
> currently exists *only* as precedent in one commit. A tool cannot encode an unwritten rule;
> encoding it would *be* writing it, which is the Tier 2 act #378 exists to keep human. So: write
> it first, sign it, then build against it.

---

## The rule as it exists today — nowhere

On #405, promoting ADR-0020 Amendment 2 required knowing that an amendment to a signed ADR
does **three** things, not one. That knowledge came from running `git show 0f54781` and reading
what a human had done to ADR-0026 four days earlier. Nothing states it.

Verified against that commit:

| # | act | evidence in `0f54781` |
|---|---|---|
| 1 | the **Status line** gains an amended marker | `**Status**: Accepted` → `**Status**: Accepted · **amended 04/08/2026** (Amendment 1 — see below)` |
| 2 | every **superseded line in the original body** is amended **in place** | five replacements, each either rewritten or annotated `**[Amended by Amendment 1 (#418) — …]**` |
| 3 | a **signed `## Amendment N` section** is appended | `## Amendment 1 — …(issue #418)` carrying `**Signed**: 04/08/2026 — Cristian Rinaldi` |

Act 2 is the one that is easy to skip and expensive to skip: without it the ADR's body still
asserts the rule the amendment exists to replace, and a reader who stops at the body — which is
what a reader does — gets the superseded answer.

## Proposed §1c

> ### 1c. Amending a signed ADR
>
> An ADR that has been signed is never edited silently and never rewritten in place. Amending one
> is **three acts in one commit**:
>
> 1. **Mark the Status line.** `**Status**: Accepted · **amended DD/MM/YYYY** (Amendment N — see below)`.
> 2. **Amend the original body in place.** Every line the amendment supersedes is rewritten, or
>    annotated `**[Amended by Amendment N (#issue) — <what changed>]**`. A reader who never scrolls
>    to the amendment must not be left with the superseded rule.
> 3. **Append a signed section.** `## Amendment N — <title> (issue #N)`, opening with
>    `**Signed**: DD/MM/YYYY — <Name>`, recording what changed, why, the measurement, and the
>    accepted losses.
>
> The `brain/HOME.md` entry for that ADR is updated in the same commit to carry the amendment
> marker — `decision-gate` requires an ADR change and a `brain/HOME.md` change to co-occur, so
> omitting it fails the gate as well as leaving the index wrong.
>
> Precedent: ADR-0026 Amendment 1 (`git show 0f54781`).

## Proposed §1d — the promotion cascade, in full

> ### 1d. The promotion cascade
>
> Adding or amending any file under `brain/**` is not one edit. In this repo it is three:
>
> 1. the `brain/**` file itself;
> 2. the `brain/HOME.md` entry (§1b) — required for `brain:nav` reachability *and* by
>    `decision-gate`'s ADR ⇔ `HOME.md` co-occurrence rule;
> 3. **`AGENTS.md`, regenerated** — `brain/HOME.md` is one of the five `SOURCE_DOCS` the file is
>    compiled from, so a `HOME.md` change without a regeneration leaves the compiled file every
>    agent actually reads carrying stale content.
>
> Regenerate with `AGENT_PLATFORM=antigravity npm run brain:env:init`. Never hand-edit `AGENTS.md`.
>
> **Step 3 does fail a gate.** `antigravity.drift.test.mjs` asserts byte-equality between the
> committed `AGENTS.md` and a fresh compile of the five sources, and it runs under `npm test`.
> Measured on `main` @ `0401871`: appending one line to `brain/HOME.md` turns that test red. The
> reason to automate step 3 is that it is a cascade nobody remembers, so forgetting it costs a red
> CI round trip — not that nothing catches it.

## Note for the promoter — a correction worth carrying

Comment 5217778764 on #378 states that regenerating `AGENTS.md` *"fails no gate — which is exactly
why it needs to be in the tool."* The first half does not reproduce (see the measurement above).
The conclusion still holds on the second reason, so the recommendation is unchanged and only its
justification is corrected. Recorded here rather than silently building against the corrected
version.
