---
status: draft
issue: 669
---

# Spec — the PR number is required, and answerable when it is wrong (issue 669)

## REQ-669-1 — A bare positional PR number is accepted

`brain:review -- 665` resolves the same PR as `brain:review -- --pr 665`, and
composes with `--mode` and `--dry-run`.

This aligns the verb with `brain:approve`, which already takes the number
positionally. Two verbs teaching opposite conventions for the same act is what
produced the crash this ticket exists for.

`queue` and `board` are unaffected: `main` dispatches those off `rawArgv[0]`
and returns before `parseArgs` runs, so a positional reaching the parser is a
PR number or a mistake — and both are answerable.

## REQ-669-2 — Every unusable PR number refuses before any git or network call

Absent, non-numeric, a `--pr` with no value after it, zero or negative, or more
than one positional: each refuses with exit code **2** — distinct from a
governance refusal — and neither cold-boot nor any port verb runs.

Nothing may be fetched for a run that cannot name its PR.

## REQ-669-3 — The refusal reports what was TYPED, and how to call it

The message names the offending input as the operator wrote it — never `NaN`,
which names the coercion rather than the mistake — and prints the usage,
including both accepted forms and the `queue`/`board` subcommands.

## REQ-669-4 — Two PR numbers are refused, whatever syntax each was written in

`665 666`, `--pr 665 --pr 666` and `665 --pr 666` are the same ambiguity and
refuse identically, showing **every** number given. A rule that refused only
one of those spellings would leave a silently-chosen winner in the others —
which is the defect this ticket exists to close, in a different syntax.

## REQ-669-5 — The refusal never blames a valid input

The raw token is carried from the point it was read, never re-derived from
`argv` afterwards. Re-deriving it located the *first* `--pr` while the parsed
value came from the *last*, so `--pr 665 --pr abc` blamed `665` — a perfectly
valid PR number. Naming the wrong input is the same failure as naming no input.

## REQ-669-6 — An unrecognised option is refused, never ignored

Any token starting with `-` that is not `--pr`, `--mode` or `--dry-run` refuses
the run, quoting what was typed. A `--flag=value` near-miss additionally names
the correct spelling, and knows which flags take a value — suggesting
`--dry-run true` for `--dry-run=true` would send the operator straight into a
second refusal, since `--dry-run` is a boolean and `true` would then parse as a
PR number.

This is the strict half of `brain:approve`'s parser, which this verb cited as
its model while copying only the positional half.

The cost of not having it was the worst thing in the first cut: `--dry-run=true`,
`--dryrun` and `-n` all parsed clean with `dryRun: false`, so an operator asking
for a **rehearsal** got a real run that **posted a verdict to the pull request**.
The safety flag disarmed itself silently.

## REQ-669-7 — A PR number is digits, not whatever `Number()` will swallow

The token must match `/^\d+$/` before the range check. `Number()` alone
accepted spellings no human typed on purpose and resolved them to a
**different, valid-looking** PR: `0x10` → 16, `1e3` → 1000, `" 665 "` → 665.

A reviewer aimed at the wrong pull request is worse than one that refuses.
