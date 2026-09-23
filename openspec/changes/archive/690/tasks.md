---
status: draft
issue: 690
---

# Tasks — issue 690

## Done

- [x] **T1** — `complementControls` in `lib/controls.mjs`, derived from
      `CONTROL_CLASSES` (REQ-690-1/2).
- [x] **T2** — rendered as `controls_not_applied`, always, `[]` included
      (REQ-690-1/4).
- [x] **T3** — both halves read by one function in `parse-verdict.mjs`, with the
      same three-state answer and vocabulary check (REQ-690-4).
- [x] **T4** — e2e on a real `lite` → `/1` run (REQ-690-5).
- [x] **T5** — the structural pin rewritten to anchor on facts, not prose
      (REQ-690-6).

## Why not a `conditions` entry — measured, not assumed

`conditions` was the obvious home: §10 already uses it for *"the evidence behind
this verdict is weaker than it looks"*, and #552 gave the refuter's
`unchallenged` exactly that shape one level down.

Measured first:

```
conditions consumers, outside the renderer:  none
buildVerdict derives the conclusion from it: no — it only appends and renders
```

So it would have been **safe**. It was rejected for a different reason:
`conditions` is the channel a reader scans for something wrong with *this*
verdict, and an entry that fires on every verdict until #682 lands makes that
channel wallpaper. A permanent constant in the alarm channel is worse than an
informational field next to the thing it completes.

## Mutation proof

Each asserted to land by **observing the mutated behaviour**, shown red,
reverted byte-identical.

| # | mutation | result |
|---|---|---|
| Q1 | stop rendering the complement — back to inferring from absence | **2 red** unit, **1 red** e2e |
| Q2 | hardcode the complement instead of deriving it | **4 red** |
| Q3 | omit the complement when it is empty | **1 red** |
| Q4 | accept an unknown class in the complement at the reader | **2 red** |
| Q5a | remove the coverage guard from `cli.mjs` | **1 red** |
| Q5b | reformat that guard and **reword its message** | **0 red** — the requirement |

Q5 is the pair that proves REQ-690-6 rather than asserting it: the rewritten pin
must go red when the guard is gone and stay green when only its shape changed.
The old pin failed the second half, which is what made it teach people to loosen
it.

Q2 is the one that proves REQ-690-2 is a property and not three examples: the
hardcoded `['inferential']` satisfied the common case and broke the moment both
classes were applied.

## A mistake made and repaired in this change

The complement's import was inserted by a script that placed it after "the last
line starting with `import`" — which landed it **inside** `verdict.mjs`'s
multi-line import block, producing `SyntaxError: Unexpected reserved word`.
Caught by the first run, repaired by placing it after the closing `from` clause.
Recorded because the same heuristic will misfire again on any file whose imports
span lines.

## Limits, stated

**Nothing consumes either field yet.** Both are read by `parseVerdict` and by a
human; no gate forks on them. Their value today is entirely that a reader of a
posted verdict can tell what checked it — which is the whole of #575 Ruling 3
and none of #682.

**The complement is only as honest as `PRODUCES`.** It says which classes no
evaluator *declared*, not which checks were skipped inside a class that ran.
`checkControlsCoverFindings` (#683) is what keeps the positive half from lying;
nothing can keep an evaluator from under-declaring itself, and the anti-drift
guard catches only the opposite direction.
