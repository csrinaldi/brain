---
status: draft
issue: 518
---

# Design

## The change, in three lines of git

```diff
-['log', '--first-parent', '--merges', '--format=%H%x09%s', range]   # offender walk
-['rev-list', '--first-parent', '--merges', `${offender}..${tip}`]   # revert, half-open
-['rev-list', '--first-parent', '--merges', `${from}^1..${to}`]      # revert, full-window
+['log', '--first-parent', '--format=%H%x09%s', range]
+['rev-list', '--first-parent', `${offender}..${tip}`]
+['rev-list', '--first-parent', `${from}^1..${to}`]
```

Everything else is contract, naming and proof. The exemption primitives are untouched, and that
is the finding: the design question the ticket held the fix on — what `<sha>^1..<sha>` means for
a linear commit — resolves to *its own diff*, which the model already handles.

## `readMergeParent`'s contract, weakened and still sufficient

It justified itself with *"a `--merges`-qualified commit always has ≥2 parents"*. That premise is
gone. The replacement is weaker and holds: `%P` is empty **only** for the root commit. So the
throw now fires exactly when a range reaches the root — genuinely uncomputable for a
diff-against-parent model, and fail-closed rather than a silent skip.

## The advisory is removed rather than kept

Option (a)'s `[WARN] N … were NOT audited` counted what the merges-only walk skipped. After the
widening that count is structurally zero, and **a warning that can never fire is a protection
that only looks like one**. What replaces it is not another runtime line but a source guard: no
enumerator on the audited path may carry `--merges` again. Completeness is a property of the
command, so that is where it is pinned — a runtime re-count would issue the same query and agree
with itself.

## Red-proof

| mutant | the lie it would tell | red |
|---|---|---|
| M1 the offender walk filters to merges again | the whole defect returns | 8 |
| M2 the revert side stays narrow | a genuine revert unseen; the offender never clears | 1 |
| M3 the full-window enumerator stays narrow | exemption measured in a smaller set than the audit | 1 |
| M4 a missing parent reads as computable | the root passes instead of failing closed | 1 |
| M5 `--first-parent` dropped | nested slice merges audited as if on main | 6 |

**M4 survived the first pass, and it corrected a test of mine.** The CLI-level root test goes red
for a *different* reason — the exemption model reads `windowFrom^1` and git rejects it before
`readMergeParent` is consulted — so the guard itself had no coverage and returning the sha
instead of throwing stayed green through the whole suite. It is now driven as a unit. Same lesson
as the `||`-in-an-assertion finding on #518's own earlier slice: an outcome satisfied by a second
path proves nothing about the first.

## What the fixtures had to change, and why that is signal

Three pre-existing fixtures carried helper commits with no issue reference — `chore: add audit
config` and friends — which were invisible to the old walk and now fail `issueLink`. They were
given a closing reference so each test isolates its own subject (baselines, parity) rather than a
helper commit's incidental compliance.

One test was **testing the defect**: `no merges in range — exits 0 with info message`, over a
range holding one ordinary commit. That is not an empty range. It is split into the property that
survives (a genuinely empty range exits 0) and its inverse (an ordinary commit in range is now
audited).

The metrics denominator moved from 4 to 6 in the parity fixture. That is the correct reading —
a squashed PR is a change that merged, and a throughput number omitting a third of them was
measuring the walk's blind spot rather than the repo. Both CLIs had to move together, which is
precisely what the parity test exists to catch.

Full suite: **3041 tests, 0 failures**. The frozen A-series: **zero lines edited**.
