# Draft — `workflow-governance.md` invariant 4 (issue #516, the FIFTH site)

**Tier-2 promotion required.** Evidence in `what-decision-gate-actually-does.md`.

#516 listed four sites. There are five, and the fifth is the one whose description is
**entirely** fictional rather than stale in one direction: `workflow-governance.md` describes a
two-step, label-conditional gate, and **neither step exists**. It was found by measuring rather
than by reading the ticket, and it falls squarely inside #516's first acceptance criterion —
step 1 as written claims co-occurrence for a `decision`-labelled PR that modifies an ADR.

It matters more than an ordinary stale sentence because this file is one of the five
`SOURCE_DOCS` compiled into `AGENTS.md` — **the file every agent actually reads**. The claim is
not sitting in a corner of the doctrine; it is in the agent's own instructions.

---

## Site 5a — the invariant table, row 4

### Replace

```
| 4 | ADR exists for labeled decisions | `decision-gate` _(S4)_ | label-conditional (see below) | Mixed |
```

### With

```
| 4 | An ADDED ADR co-occurs with a `brain/HOME.md` entry | `decision-gate` _(S4)_ | _(none — the gate reads no labels)_ | Hard, in one direction — see §Invariant 4 scope |
```

---

## Site 5b — the "two-step `decision-gate`" section

### Replace the whole section

```markdown
### Invariant 4 — two-step `decision-gate` (S4)

- **Step 1 (hard)**: if the PR carries the `decision` label, require an `adr-NNNN-*.md` AND
  a `brain/HOME.md` change in the diff. Fails the PR if either is missing.
- **Step 2 (heuristic)**: scan known architectural surfaces (`scripts/.*/providers/`,
  `brain/core/`, `config-migrations.mjs`, `package.json`) for changes without the `decision`
  label → emit `::warning::`, always `exit 0`. **Never a hard block** — the heuristic can be
  wrong; it raises attention, not a veto.
```

### With

```markdown
### Invariant 4 scope — what `decision-gate` does and does not check

**It reads no labels, and it runs on every PR.** `adrPresence` takes the changed-file list and
the added-file list; no call site passes labels and the workflow job carries no condition. The
`decision` label changes nothing about the verdict.

**It fails in exactly two cases** (measured 2026-08-11, issue #516):

| condition | verdict |
|---|---|
| an ADR is **added** and `brain/HOME.md` is not in the diff | fail |
| `brain/HOME.md` is in the diff and **no** ADR path is touched | fail |
| anything else, including a **modified** ADR alone | pass |

The two are keyed differently on purpose: the first reads the ADDED list, the second the
TOUCHED list. That asymmetry is #510's content — a PR correcting one line of an old ADR must
not be forced to re-index it (the previous behaviour blocked PR #507 for months) — and its
consequence is that **an amendment's `brain/HOME.md` marker has no gate behind it** (§1c of
`consolidation-protocol.md` now says so; the net belongs in the amendment verb, #509).

**There is no step-2 heuristic.** This file described one — a scan of
`scripts/.*/providers/`, `brain/core/`, `config-migrations.mjs` and `package.json` emitting a
`::warning::` for changes without the `decision` label. Nothing scans those surfaces and
nothing emits that warning; the description was aspirational and read as shipped. An
architectural change carrying no ADR simply passes, in silence.

Both facts are pinned by test (`run-check.test.mjs`, #516), each proven a real detector by a
mutation that IMPLEMENTS the claim. If either is ever built, those tests fail and name this
section, so the doctrine cannot silently fall behind the code again.
```

---

## Site 5c — the Enforce/Guide boundary table, and the paragraph under it

The boundary table's row and the paragraph after it both rest on the label-conditional story.

### Replace

```
| ADR exists when `decision` label is set | Whether the PR actually made a new decision |
```

### With

```
| An added ADR is indexed in `brain/HOME.md` | Whether the PR actually made a new decision |
```

### Replace

```
This boundary is **not a gap to close** — it is the line between what a machine can verify
and what requires a human mind. The heuristic in step 2 of `decision-gate` warns and
`exit 0`s precisely because "is this a decision?" is judgment. Only the label-conditional
step is hard.
```

### With

```
This boundary is **not a gap to close** — it is the line between what a machine can verify
and what requires a human mind. *"Is this a decision?"* is judgment, and `decision-gate` does
not attempt it: it verifies a cascade (an added ADR is indexed) and says nothing about whether
an ADR was owed. Applying the `decision` label is a human act with no gate reading it.
```

---

## Cascade

`workflow-governance.md` is one of the five `SOURCE_DOCS` compiled into `AGENTS.md`, and a
drift guard fails CI when the committed copy is not byte-equal to the compile. The promotion
script regenerates it — it is a build step, not a signature. This is the step a hand-written
checklist missed in #529 and CI caught on the human's signing commit.
