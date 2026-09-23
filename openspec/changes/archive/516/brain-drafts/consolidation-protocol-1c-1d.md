# Draft — `consolidation-protocol.md` §1c and §1d (issue #516, sites 1 and 2)

**Tier-2 promotion required.** Evidence in `what-decision-gate-actually-does.md`.

---

## Site 1 — §1c, the load-bearing sentence

This is what a human reads while deciding whether the `brain/HOME.md` step is skippable, and
it currently tells them a gate is behind them. It is not.

### Replace

```
The `brain/HOME.md` entry for that ADR is updated in the same commit to carry the amendment
marker — `decision-gate` requires an ADR change and a `brain/HOME.md` change to co-occur, so
omitting it fails the gate as well as leaving the index wrong.
```

### With

```
The `brain/HOME.md` entry for that ADR is updated in the same commit to carry the amendment
marker. **Nothing enforces this. You are the enforcement.**

`decision-gate` requires an ADR and a `brain/HOME.md` change to co-occur only when the ADR is
**added**. An amendment MODIFIES an existing ADR, and since #510 a modified ADR without a
`HOME.md` change PASSES — deliberately, because the previous behaviour blocked every PR that
corrected a line in an old ADR (PR #507). The other two nets do not close it either:
`brain:nav` passes because `HOME.md` already links the ADR — it is the *marker* that goes
missing, not the link — and `phase-order` is detection-only at `lite`.

So an amendment can land with the index still describing the previous version, and no gate
will say so. Until `brain:promote` gains the amendment path (#509), the three acts above and
this fourth one are convention held by whoever runs them.
```

---

## Site 2 — §1d act 2, the promotion cascade

§1d covers *"adding or amending any file under `brain/**`"*, so one clause has to hold for both
cases and currently does not.

### Replace

```
2. the `brain/HOME.md` entry (§1b) — required for `brain:nav` reachability _and_ by
   `decision-gate`'s ADR ⇔ `HOME.md` co-occurrence rule;
```

### With

```
2. the `brain/HOME.md` entry (§1b) — always required for `brain:nav` reachability, and
   enforced by `decision-gate` only when the ADR is **added**: `decision-gate` fails an added
   ADR with no `HOME.md` change, and fails a `HOME.md` change that touches no ADR at all, but
   passes a MODIFIED ADR alone (#510). On an amendment (§1c) this step therefore has no gate
   behind it;
```

---

## Why not simply restore the old behaviour

Option (2) in #516, rejected explicitly and worth keeping rejected in writing: re-imposing
co-occurrence on modified ADRs re-creates the exact defect #510 removed and re-blocks every PR
that corrects a line in an existing ADR. A protection whose first act is to block routine
correction teaches that gates are obstacles — the same argument #529's ruling turned on.

The net belongs in the **tool**, not in a check that catches the omission afterwards: a verb
that performs the cascade cannot forget it. That is #509, and #516's recommendation puts the
content-keyed guard there rather than here.
