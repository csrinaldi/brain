# ADR-0019 Amendment 4 — Amendment 2's narrative still states the superseded count (issue #456)

> Amendment 3 corrected the evidence-contract citation. It did **not** touch
> Amendment 2's own prose, which repeats the same wrong measurement as its
> rationale — a live false statement sitting in signed doctrine, three sections
> below the correction.
>
> The annotation carries the corrected number **inline**, not a pointer. A reader
> who stops at that sentence must leave with the right value; a cross-reference
> they have to follow is a reader who leaves with the wrong one.

```brain-amendment/1
target: brain/project/decisions/adr-0019-harness-port.md
amendment: 4
issue: 456
home-summary: Amendment 2's narrative still stated ten/eighteen — annotated in place with the measured eleven/sixteen so no reader takes the superseded count as current, #456
body: ## Amendment 4 — the superseded count, annotated where it is still written (issue #456)
body-end: ### Notes for the promoter
```

```amend-find
2. **"Twelve modules import that layout" was never true.** Measured during
   #456: **ten** production modules import `sdd-layout.mjs`, eighteen counting
   test files. Twelve is neither number.
```

```amend-replace
2. **"Twelve modules import that layout" was never true.** Measured during
   #456: **ten** production modules import `sdd-layout.mjs`, eighteen counting
   test files. Twelve is neither number.
   **[SUPERSEDED BY AMENDMENT 4 (#456) — the replacement stated here is ALSO
   wrong. The measured figures are ELEVEN production modules and FIVE test
   files, SIXTEEN in total. Do not read "ten" or "eighteen" from this sentence
   as current; they are recorded here only as what this amendment believed.]**
```

---

## Amendment 4 — the superseded count, annotated where it is still written (issue #456)

**Signed**: — Cristian Rinaldi

### What changed

Amendment 2's item 2 keeps its original wording — a signed act is not rewritten —
and gains an inline bracket carrying the measured figures: **eleven** production
modules, **five** test files, **sixteen** total.

The bracket states the corrected values rather than pointing at Amendment 3. A
pointer is only as good as the reader who follows it, and the failure this
annotation exists to prevent is precisely a reader who does not.

### Why the correction did not already cover this

Amendment 3 anchored one sentence — the evidence-contract citation the ADR uses to
say what the contract *is*. It did not anchor Amendment 2's narrative, which
repeats the same measurement as the reason the earlier count was wrong. One
measurement, two places, one of them fixed.

That is the same shape as the defect being corrected: a claim copied to a second
location, and only the first one maintained. **The correction reproduced the error
it was correcting, one level in.**

### Three layers deep, and why that is the point

`Twelve` (Amendment 1) → `ten / eighteen` (Amendment 2) → `eleven / sixteen`
(Amendment 3) → this annotation. Four acts on one count.

A reader entering this document at Amendment 2 has no way to know they are standing
on a superseded layer. Nothing about that paragraph looks provisional; it reads as a
correction, which is exactly what makes it dangerous. The bracket is the only thing
in the document that tells them where they are.

**The house pattern this follows** is already in the tree: ADR-0033's warrant table
carries `**[Amended by Amendment 1 (#773) — this row is now a RULED position…]**`
inline in the row it supersedes, rather than leaving the reader to reconcile the
table with a later section. Same act, one level in.

### The honest cost

Four amendments to fix one number is disproportionate, and saying so is part of the
record. What made it cost this much was not the number — it was that the same
measurement was copied into four documents (the ADR, `proposal.md`, `design.md`, and
the amendment draft) from a grep nobody restated, so each correction found one copy
and left the others. The count was never the expensive part; the copying was.

### Notes for the promoter

The `amend-find` block is Amendment 2's item 2 in full, across its three source
lines including the exact indentation of the continuation lines. It must match
byte-for-byte. If Amendment 3 has not been promoted yet, promote it first — this
draft assumes the document state Amendment 3 leaves behind, though the anchored
text itself is untouched by it.
