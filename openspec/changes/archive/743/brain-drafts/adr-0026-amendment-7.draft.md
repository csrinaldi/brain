# ADR-0026 Amendment 7 — the tier answers the approval question, and nothing else

Promotion draft for the 2026-08-20 ruling on #743. Route B: drafted by the agent,
promoted and signed by the maintainer.

```brain-amendment/1
target: brain/project/decisions/adr-0026-governance-doctrine-tiers.md
amendment: 7
issue: 743
home-summary: **Amendment 7, 21/08/2026** — the reviewer verdict mode leaves the tier table: the protocol is always `brain-review/2` and the judgment half is a config capability, #743
body: ## Amendment 7 — the reviewer verdict mode is not a tier parameter (issue #743)
```

```amend-find
| reviewer verdict mode | deterministic checks only | single engine | panel ≥2, consensus-gated |
```

```amend-replace
| reviewer verdict mode | deterministic checks only | single engine | panel ≥2, consensus-gated | **[Amended by Amendment 7 (#743) — RETIRED. The review system is not tiered: the protocol is always `brain-review/2` and the judgment half is a config capability. See Amendment 7.]**
```

## Amendment 7 — the reviewer verdict mode is not a tier parameter (issue #743)

**Signed**: DD/MM/YYYY — <Name>

### What the row said, and why it was wrong by this ADR's own rule

The parameter table above carried a `reviewer verdict mode` row: *deterministic
checks only* at `lite`, *single engine* at `standard`, *panel ≥2, consensus-gated*
at `regulated`. Read as doctrine, it tiers the review system.

Invariant 7 of this ADR already forbade that:

> **7. Proportionality bounds relaxation** — position tiering applies only to
> **ceremony**, never to **correctness**, traceability, agent containment, or
> internal consistency.

A schema version is not ceremony: `brain-review/1` is not structurally
unsatisfiable at any tier, so evidence tiering does not admit it either. And the
judgment half of the reviewer is a control that FINDS DEFECTS — correctness,
which invariant 7 names as the thing position tiering may never touch.

### What the drift cost, measured

Not hypothetical. `tierParams()` shipped `standard` as
`{inferentialEnabled: true, reviewProtocol: 'brain-review/1'}` — a tier that ASKED
for the judgment half beside a protocol that structurally cannot carry or
challenge a reasoned finding. The producer was enabled and the gate refused it, so
every `standard` verdict carried a condition saying the half did not run.

Two adversarial cold reviews found it. No gate did, because both halves were
hiding inside a posture parameter and nothing compared them.

### The ruling

> *"The tiers do not define the review system. The judgment half is an on/off
> capability, and the protocol is always `brain-review/2`."*

with an addendum the same day: `reviewer.inferential.enabled` is **ON when the key
is absent**, off only on an explicit `false`.

### What changes

1. **`reviewProtocol`, `inferentialEnabled` and `challengerAxis` leave
   `tierParams()`.** The protocol is `PRODUCED_PROTOCOL` — one value, every tier.
   The capability is `reviewer.inferential.enabled`, and the axis is
   `reviewer.inferential.challenger.axis`, defaulting to `human`.
2. **REQ-682-2 is retired**, not amended: its subject was which tier decides.
3. **`brain-review/1` stays readable forever.** It is retired as an output, never
   as an input — every verdict already posted is a `/1` block, and `cold-boot.mjs`
   reads that history to compute `rev` and hold the anti-loop lock. An explicit
   `reviewer.protocol: 'brain-review/1'` is still honoured: the ruling retired a
   default, and reading it as forbidding an operator's explicit choice would be
   inventing doctrine (reviewer-protocol.md §5).
4. **A guard replaces the retired pins.** `governance-tiers.test.mjs` fails if any
   tier carries a review-system key, plus its complement — that the parameters
   answering the approval question are still there — so it cannot pass on an
   empty table. This is #743's acceptance criterion 5, and it exists because the
   previous instance of this drift was added by an agent extending this very ADR.

### The consequence, declared rather than discovered

Until #682 slice 3 supplies a transport, the judgment half is ON everywhere and
can run nowhere. Every verdict, in every repo, carries
`the judgment half is enabled but no transport is configured`. It is a condition
and not a blocker — `buildVerdict` never reads `conditions[]`, so it cannot move a
verdict. It is pinned end to end so that the day it stops being true, a test says
so; that day is slice 3 landing.

### What this amendment does NOT do

It does not remove a tier. Measured while ruling on #743: `regulated` differs from
`standard` on the approval axis in the strongest available way — `actor-check`
requires an approver who authored **no commit on the branch**, and
`brain-writes-reviewed` adds `codeowners-rung1`. That is evidence tiering, the
mechanism this ADR names as the one that resolves #329. The narrowing removes
non-approval parameters from every tier; it leaves `regulated` meaning *the tier
where a distinct approver is not enough*.

An earlier measurement in #743 concluded the opposite — that `regulated` had no
approval content left — and it was wrong: it varied `tierParams()` and gate
POSITIONS and reported that as the approval axis, which lives in the other
mechanism. The correction is recorded in the ticket rather than edited away.
