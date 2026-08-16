---
status: draft
issue: 633
---

# Proposal — the hooks keep the stream the tool speaks on

## The ruling

Drop the stderr redirection on all three offending lines, keep `>/dev/null` and keep
`|| true` / `|| exit 0`, state the rule in both hook headers — and **enforce it over every hook
invocation, present and future**, rather than trusting the next author to have read the comment.

## Measured before writing anything

The three lines, on `main` at `6aad799`:

```
pre-push:39    cli.mjs share             >/dev/null 2>&1 || exit 0
pre-push:49    cli.mjs feature-checkpoint            2>/dev/null || true
post-merge:43  cli.mjs resolve-index     >/dev/null 2>&1 || true
post-merge:35  cli.mjs import            >/dev/null      || true      ← the one that was right
```

And what each verb actually writes, measured rather than assumed:

| verb | stdout | stderr |
|---|---|---|
| `share` | 0 lines | **3 lines** — the duplicate report |
| `reindex` | 1 line | **3 lines** |
| `feature-checkpoint` | **0 lines** | **2 lines** |

`feature-checkpoint` is the one the ticket only suspected and the measurement settles: it writes
**nothing at all** to stdout, so `2>/dev/null` discarded the only stream it uses. The message it
silenced is the hook's own documented A2 limitation announcing itself:

```
ℹ memory: feature-resolution: ambiguous active feature … — skipping checkpoint
```

So the known failure mode was invisible in practice, and `|| true` meant the exit code said
nothing either. A skip nobody can see is the same outage as a skip that never reports.

## Both directions, on a real store

The report has to fire when there is something to say and stay quiet when there is not —
otherwise it is a check that fires on everything, which informs nobody.

```
store WITH a duplicate  → the operator sees 3 lines:
  ⚠ 1 duplicate record id(s) in .memory/records/ — 1 excess physical line(s) collapsed …
store CLEAN             → the operator sees 0 lines
```

Worth noting when this landed: #636 had just reconciled the corpus to zero, so the clean
direction is now the repository's real state. The standing 12-line warning that used to fire on
every verb is gone, which is exactly what makes the next firing mean something.

## The tampered record, which is the sharper half

`pre-push`'s `|| exit 0` is deliberate and stays — a tooling problem must not block a push. But
it throws away the exit code, and `2>&1` threw away the explanation, so **both** channels were
empty. The one refusal `rebuildIndex` still has reached nobody and blocked nothing:

```
BEFORE (2>&1):   exit 0  |  the operator sees 0 lines
AFTER  (>/dev/null): exit 0  |  the operator sees:
  memory/cli: plainfiles.share() failed — rebuildIndex: id mismatch at 2026-07.jsonl:1 —
  stored id 'rec-ac0777a…' does not match the recomputed id 'rec-0e11d03…' (tampered or stale record)
```

Same exit code. Not blocking was the decision; being silent was not.

## Why prose was not enough

`post-merge:35` already carried the correct reasoning, in its own comment, in the same file:

> *"stdout is discarded … but **STDERR is not**. A hydration that SKIPPED … reports there, and
> swallowing it would make the skip as invisible as the duplication it replaced."*

The line eight lines below it carried `2>&1` anyway. A rule that lives in one comment decays —
that is #575's thesis, and here it is inside a single 46-line file.

So the rule is written in both headers **and** enforced: `hooks.stream-discipline.test.mjs` scans
every hook for `cli.mjs` invocations and fails on any that discards stderr. Not just the three
lines this ticket repaired — the one somebody adds next year. The acceptance asks that "the next
line added follows it by reading rather than by accident"; reading is optional, a failing test is
not. M6 below proves it works by adding exactly that future line.

## The rule

> **stdout is PROGRESS. stderr is SOMETHING A HUMAN NEEDS.
> A hook discards the first and NEVER the second.**

`|| true` / `|| exit 0` are a separate decision and they stay. But once the exit code is thrown
away, stderr is the only channel left — discarding both leaves nothing at all.

## Acceptance

- [x] With a duplicate present, the push path surfaces the report; with a clean store it stays
      silent. Both measured on a real store.
- [x] A tampered record surfaces its refusal on the push path while still exiting 0.
- [x] The hook comments state the rule — and a test pins that they still do, so a later edit
      cannot quietly remove the reasoning and leave the guard unexplained.
- [x] `pre-push:49` decided on the same rule rather than left inconsistent, with the measurement
      that makes it the most severe of the three.

## Links

- #598 / #574 — the report this delivers, and why it is on stderr · #631 — same polarity in the
  reviewer · #636 — the reconciliation that makes the next firing meaningful ·
  `evidence-reader-empty-on-failure`
