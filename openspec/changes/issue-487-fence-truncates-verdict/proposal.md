---
status: draft
issue: 487
epic: 313
---

# Proposal — a code fence in a verdict value must not truncate the block

## What is wrong

`FENCE_RE` located the verdict block with an unanchored, non-greedy terminator:

```js
/```(?:yaml)?\s*\n([\s\S]*?)```/
```

The first ``` appearing **anywhere** — including inside a value — ended the block.

Not a corner case. `reviewer-protocol.md:187` defines evidence as *a command the reviewer
actually ran cold*, and command output is normally fenced. `checkpoint.mjs:137,139`
interpolates raw `brain:audit` / `brain:governance-status` stdout straight into
`evidence:`, so brain's own verdicts reached this path without anyone doing anything
unusual.

Measured on `main` @ `c9d2b36` through the real
`buildVerdict → renderVerdict → parseVerdict → reconcileBoardLabels` chain:

```
findings emitidos : 2
findings parseados: 1        ← and `'findings' in parsed === true`
evidence intacta  : false
sequencing        : undefined
board toRemove    : ["seq:after-411","seq:blocked-on-412"]
```

Three failures in one, and the third is the reason this is `priority:high`: `board.mjs`
reconciles labels **by name**, so every real `seq:*` label on the PR lands in `toRemove`.
Data loss on a live PR, not a display bug.

## The fix

Anchor the terminator to a line start. The failure is in the **locator**, not the payload.

Escaping ``` inside `yamlScalar` would also work and would make the posted comment less
readable for the human it exists to be read by — evidence that has to be decoded is
evidence nobody checks. Greedy would be worse still: it swallows a later legitimate block
(pinned by a test, and proven by mutation M2).

Why the anchor suffices rather than merely helps: `yamlScalar` escapes `\n` (#481), so a
fenced value is emitted on **one physical line** and its ``` is never preceded by a real
newline. Mutation M3 removes that escape and the fix collapses — the dependency is real
and now pinned.

## What it also closes, and what it does not

**Closes, as a consequence rather than a goal:** a *tagged* prose fence above the verdict
(```` ```bash ````) used to make `parseVerdict` return `null`, and `board.mjs` then
reconciles from an **older** verdict. The anchored opener accepts only ``` or ```yaml, so
a tagged fence is skipped. Measured before and after; pinned.

**Does not close:** an **untagged** ``` fence in prose above the verdict still shadows the
block, identically before and after. Closing it means letting the reader scan past a fence
that does not parse, which contradicts `design.md` §E2 rule 17 (*"only the first fence is
ever read"*) — a documented rule with a stated reason, not an oversight to patch in
passing. Pinned as a limitation test that objects the day rule 17 changes.
