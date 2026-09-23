---
status: draft
issue: 669
---

# Proposal — the PR number is required, and answerable when it is wrong (issue 669)

## What

`brain:review` accepts a **bare positional** PR number, and refuses every
unusable one **before any git or network call**, with a message that names the
mistake.

## Why

Found running the verb by hand while validating #604/#575. Pre-existing on
`main`; nothing in flight touches `parseArgs`.

```
$ npm run brain:review -- 665
fatal: couldn't find remote ref null
Error: Command failed: git fetch origin
    at doFetch (brain/scripts/review/cold-boot.mjs:48:36)
```

Two defects behind one symptom:

**The verbs disagreed.** `brain:approve` takes the number positionally
(`brain:approve -- 640`); `brain:review` took only `--pr <n>` and discarded a
positional silently. Same repo, same operator, opposite conventions.

**The unusable value travelled.** `parseArgs` never validated, so `null` and
`NaN` alike reached `git fetch origin <value>` and threw an unhandled
`execFileSync` error six layers down.

## The part that makes it worth a ticket

The stack trace's top line is about a **remote ref**. Nothing in it says the PR
number was missing, so **a typo in the argv reads as a broken remote** and the
operator debugs the wrong subsystem.

That is the reader-shaped half of `evidence-reader-empty-on-failure`: not an
empty answer this time, but a confident answer about the wrong thing. Same
cost — the reader cannot tell what actually happened.

## Scope

`brain:review`'s argument handling only. `brain:approve`'s parser is the model
being copied and is untouched.
