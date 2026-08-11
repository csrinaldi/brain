# Draft — ADR-0026 Amendment 4 (issue #516, sites 3 and 4)

**Tier-2 promotion required, and this one is an AMENDMENT to a signed ADR** — `brain:promote`
refuses the amendment path by design (`brain-promote.mjs:335`) and #509 is unbuilt, so the
human executes §1c's three acts by hand. The promotion script beside this file performs them
deterministically and regenerates `AGENTS.md`; the commit is the signature.

Evidence in `what-decision-gate-actually-does.md`.

---

## Act 1 — the Status line

### Replace

```
**Status**: Accepted · **amended 09/08/2026** (Amendments 1-3 — see below)
```

### With

```
**Status**: Accepted · **amended 11/08/2026** (Amendments 1-4 — see below)
```

---

## Act 2 — the body, amended in place

### Site 3 — the `GATE_MATRIX` row (never-tiered table)

A reader who never scrolls to the amendment must not be left with the superseded rule, so the
row is annotated rather than silently rewritten (§1c act 2).

#### Replace

```
| `decision-gate` | ADR ⇔ `brain/HOME.md` co-occurrence | + the `decision`-label step hard | + the ADR carries a recorded human signature |
```

#### With

```
| `decision-gate` | ADR ⇔ `brain/HOME.md` co-occurrence **[Amended by Amendment 4 (#516) — only in the ADDED direction: an added ADR requires a `HOME.md` change, and a `HOME.md` change requires some ADR to be touched, but a MODIFIED ADR alone passes (#510). See Amendment 4.]** | + the `decision`-label step hard — **not implemented; the gate reads no labels at any tier (Amendment 4)** | + the ADR carries a recorded human signature |
```

### Site 4 — the recorded divergence note

The existing note is wrong about the thing it is noting: it calls the shipped check
*"unconditional ADR ⇔ `brain/HOME.md` co-occurrence"*, and since #510 the co-occurrence is not
unconditional in the added/modified sense. **The label half of the divergence is still open and
must stay recorded** — the gate is still label-blind while the documentation described it as
label-conditional.

#### Replace

```
- **Negative (pre-existing, now load-bearing)**: `decision-gate`'s shipped check
  (unconditional ADR ⇔ `brain/HOME.md` co-occurrence) does not match its documentation
  (label-conditional with a heuristic second step). The `standard` evidence row above
  describes the documented behaviour. This divergence must be resolved before that row
  means anything.
```

#### With

```
- **Negative (pre-existing, PARTLY resolved by Amendment 4, #516)**: `decision-gate`'s shipped
  check does not match its documentation. Two halves, and they are in different states.
  **Resolved**: the check was described as an *unconditional* ADR ⇔ `brain/HOME.md`
  co-occurrence. Since #510 it is added-only in one direction and touched-keyed in the other;
  the documentation (this row, `workflow-governance.md` invariant 4, `consolidation-protocol.md`
  §1c/§1d) was corrected to match, and the code half is pinned by test.
  **Still open**: the check is LABEL-BLIND at every tier, while the doctrine described a
  label-conditional step 1 and a heuristic step 2 — neither of which exists in any code path.
  The `standard` evidence row above (*"+ the `decision`-label step hard"*) therefore still
  describes behaviour that has never shipped, and still means nothing until it does.
```

---

## Act 3 — the appended signed section

Append at the end of the file:

```markdown

---

## Amendment 4 — `decision-gate` is added-only and label-blind; the doctrine said otherwise (issue #516)

**Signed**: 11/08/2026 — Cristian Rinaldi

### What changed

Nothing in the gate. This amendment changes only what the doctrine CLAIMS about it, and the
claims were wrong in two independent ways.

**One: direction.** #510 (PR #515) made `adrPresence` distinguish an ADDED ADR from a MODIFIED
one, because the previous behaviour forced a `brain/HOME.md` re-index for correcting a line in
an ADR from months ago — it blocked PR #507 for months. Correct fix, and four doctrine
statements kept describing the old check. One of them, `consolidation-protocol.md` §1c, told a
human amending a signed ADR that *"omitting it fails the gate"*. It does not.

**Two: labels.** `workflow-governance.md` described a two-step gate — step 1 hard *"if the PR
carries the `decision` label"*, step 2 a heuristic scanning architectural surfaces and warning.
**Neither has ever existed.** `adrPresence` takes two file lists, no call site passes labels,
and the workflow job carries no condition. That claim also reached `AGENTS.md`, which is
compiled from that file, so it was in the agent's own instructions.

### The measurement

Driven on `main` at `eb8810d` (2026-08-11):

| condition | verdict |
|---|---|
| an ADR is **added**, no `brain/HOME.md` | **fail** |
| an ADR is added **+** `HOME.md` | pass |
| a **modified** ADR, no `HOME.md` | **pass** ← the case §1c claimed was caught |
| a modified ADR + `HOME.md` | pass |
| `HOME.md` alone, no ADR touched | **fail** |

All three enforcement surfaces (`run-check.mjs`, `brain-check.mjs`, `merge-walk.mjs`) pass the
added-file list, so there is no surface on which the old behaviour survives.

### Why option (1) and not a restored gate

Re-imposing co-occurrence on modified ADRs re-creates the defect #510 removed and re-blocks
PR #507's whole class. A protection whose first act is to block routine correction teaches that
gates are obstacles — the argument #529's ruling turned on.

The content-keyed guard #516 sketches — *"the Status line's amendment count increased ⇒ that
ADR's `HOME.md` line changed"* — is the right net and belongs in the amendment-promotion verb
(#509), not in a check that catches the omission afterwards. **A tool that performs the cascade
cannot forget it.**

### The accepted loss

Until #509 ships, the amendment marker in `brain/HOME.md` is convention with nothing mechanical
behind it. `brain:nav` does not catch it (the link is already there; the *marker* goes missing)
and `phase-order` is detection-only at `lite`. **This amendment is itself an instance**: it was
executed by hand, and nothing but the human would have caught the marker being omitted.

What is bought is that no one reads a guarantee that is not there. An apparent protection is
worse than a stated absence — that is #499's class, and it is why this was worth a ticket.

### What is still open

The label divergence. The `standard` row's *"+ the `decision`-label step hard"* still describes
behaviour that has never shipped. Both facts — label-blindness and the absent heuristic — are
now pinned by test (`run-check.test.mjs`, #516), each proven a real detector by a mutation that
IMPLEMENTS the claim, and those tests name this ADR and `workflow-governance.md` in their
failure messages. The doctrine cannot silently fall behind the code again; it can still be
ahead of it, which is exactly what that row is.
```

---

## The `brain/HOME.md` marker (§1c act 4)

Append to the ADR-0026 line, inside the existing parenthesis, after Amendment 3's entry:

```
; **Amendment 4, 11/08/2026** — `decision-gate` is added-only (#510) and label-blind; the doctrine describing it was corrected, #516
```
