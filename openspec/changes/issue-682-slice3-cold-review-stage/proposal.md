# Slice 3 — the cold review is an SDD stage, and its artifact reaches the PR

**Issue:** #682 (slice 3) · **Tracker:** `feature/issue-682-slice3-cold-review-stage`

## What is missing, measured on `main @ 005dc35`

The judgment half of the reviewer is built and wired end to end — one gate
(`resolveJudgment`), a producer (`evaluateInferential`), a challenger
(`evaluateRefuter`), and a verdict builder that reads them. It cannot run:

```
$ grep -c 'deps.generate' brain/scripts/review/cli.mjs     → 0 production callers
$ grep -n 'VALID_OPS' brain/scripts/harness/cli.mjs        → VALID_OPS = ['init']
```

`gatherInferentialInputs` returns `{generated: null}` with no `deps.generate`, and
`main()` is invoked with **no arguments** from the entrypoint — `inferentialDeps` is
populated only by tests. The DI seam exists; nothing can reach it.

So every verdict in every repo currently carries `the judgment half is enabled but no
transport is configured`, which the #743 ruling's addendum declared in advance.

## What this change does

Makes the cold review a **stage of the SDD**, with the same shape every other stage
will have once M8 lands — because that is the premise M5 and M8 are being built on:
a stage, an engine, and a model, all declared.

```
sdd.map['cold-review'] → { engine, model }
        │
        ├─ the orchestrator spawns the engine through the harness, with the role's prompt
        │
        └─ the engine writes openspec/reviews/pr-NNN/  ← the stage's artifact. A file.
                   │
                   └─ brain:review reads it, merges, challenges, and POSTS:
                      the fenced verdict + inline comments on the changed lines
```

Three properties this buys, and each answers something already open:

1. **The producer needs no credential.** It reads a cold worktree and writes a file.
   Every identity problem #604 measured belongs to the poster, and the poster does not
   move.
2. **Inline review appears in the PR for the first time.** `deriveInlineComments`
   already turns any finding carrying `file` + a positive-integer `line` into a comment
   riding the same `prReviewComment` call as the verdict (#405). Nothing produced
   anchored findings until now. M3's exit criterion — *"a developer sees inline code
   review in the PR"* — was never blocked by the transport to the PR.
3. **A reasoned finding gains a legitimate channel** (#760): it enters `findings[]`
   through the artifact, computed by the verb, without anyone hand-writing a verdict
   block and without violating §13.

## Why now, and why shaped like M8

The alternative is to wait for M5 (0%) and M8 (blocked by M5), leaving #682 open for
weeks with the judgment half on and unable to run in every repo.

The repo has a written pattern for exactly this, in `resolve-challenger.mjs`'s own
header: a provisional inhabitant with its debt recorded, deleted when the port lands.
This change is the second use of that pattern, on the same ticket.

## Not in this change

- `same-model` and `cross-family` as challenger axes. `human` is the built axis and the
  untiered default (#743); the challenger question is separate from the producer's
  transport.
- The `brain:config` verb (#761), and the borderline-row rulings.
- M5's role port. The prompt is a provisional inhabitant; #576's Adversary archetype
  takes it over, which is what closes #754.
