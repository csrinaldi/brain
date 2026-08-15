---
status: draft
issue: 675
---

# Tasks — issues 675 and 674

## Done

- [x] **T1** — `checkSingleStatusLine` extracted from `applyStatusAct` as a
      **pure move** (REQ-675-1). Not a copy: the amendment path calls the same
      function, so the two halves of the verb cannot drift on what "well formed"
      means.
- [x] **T2** — `lib/shipped-hostnames.mjs`: the #648 classifier extracted from
      its test as a **pure move** (REQ-674-1). The test keeps the tree walk and
      imports the rule.
- [x] **T3** — `lib/promote-guards.mjs`: the registry, both guards, and the
      honest reporting of what ran (REQ-675-1/2/4, REQ-674-1/2).
- [x] **T4** — wired into `brain-promote.mjs`'s read-only precondition slot,
      before the plan and before the typed word (REQ-675-3).
- [x] **T5** — lock-2's import classification closed transitively over the
      verb's own modules, keyed on resolved paths (REQ-675-5).
- [x] **T6** — end-to-end reproductions of both tickets through the real verb,
      with a `readLineFn` that throws.
- [x] **T7** — the refusal locates the offending lines and derives its guidance
      from where they are (REQ-675-2). Found by cold review of this change, and
      **measured**: the guard fires on the amendment path too, where the first
      message described a header the verb never writes.
- [x] **T8** — every applicable guard reports, with a completeness claim that is
      withdrawn when a guard could not run (REQ-674-3). Also found by cold
      review: the artefact that motivated both tickets carried both defects, so
      the first cut would have cost two promote cycles to clear.

## What the mutation proof measured

Every mutation was asserted to LAND before the suite was run, shown red, and
reverted byte-identical (`diff -q`).

| # | mutation | result |
|---|---|---|
| M1 | `single-status-line.applies` → `() => false` | **6 red** |
| M2 | `shipped-hostnames.applies` → `() => false` | **6 red** |
| M3 | the guard call moved to AFTER the confirmation | **8 red** |
| M4 | a throwing guard scored as a pass (`continue`) | **1 red** |
| M5 | `foreignHostsIn` → `[]` | **4 red**, across all three suites |
| M6 | stop at the first finding again | **3 red** |
| M7 | drop the body-position guidance | **1 red** |
| M8 | claim completeness over a guard that threw | **1 red** |

**M1's first attempt did not land, and the suite stayed green.** The mutation
inserted `applies: () => false` as an *earlier* key in the object literal, where
the real `applies` below it overrides it. `grep` confirmed the bytes and the
behaviour was unchanged — the precise trap this line of work hit once before.
Every mutation after it is verified by **observing the mutated behaviour**
(importing the module and printing what the guard now answers), not by finding
the string in the file.

M5 is the proof the pure move is live rather than decorative: breaking the
classifier breaks the tree walk *and* the verb, because there is one of it.

## Limits, stated

**The verb was not run end to end.** `brain:promote` refuses on a non-TTY
before it reads anything (lock 1), and this container has no TTY. What is proven
here is `runPromote` driven in-process against a real git fixture repo — real
writes, real staging, real `git status` — plus the pure modules by mutation. The
interactive run is the maintainer's.

**Both guards are lexical, and neither claims completeness.** `single-status-line`
answers one question about one line shape; `shipped-hostnames` matches
`scheme://host` and nothing else. They catch the two defects that actually
occurred. A guard advertising more than it checks is the apparent protection
`cites-resolve.test.mjs` exists to refuse (#499).

## The corruption is already on `main`, and it is not a one-off

Running the new guards over every signed ADR on disk, before changing anything:

```
30 signed ADRs on disk, 1 would be refused by the new guards.
WOULD REFUSE: brain/project/decisions/adr-0029-two-sources-one-graph.md
    2 `**Status**:` line(s), expected exactly 1
```

`ADR-0029` carries the identical shape — the draft's `**Status**: Proposed` /
`**Date**: draft for …` pair surviving under the signed header — and has since
it was signed on 2026-08-11. **The incidence is 2 of 30, not 1.**

Measured, not inferred: `applyStatusAct` **already** refuses that file today,
without this change. ADR-0029 has therefore been unamendable by the sanctioned
route since the day it was signed — #675's trap, live, in `main`.

This change neither introduces nor worsens that; it makes it visible. Repairing
it is a `brain/project/decisions/**` edit, Tier 3 for the agent, and the
amendment path is precisely what cannot run on it. Filed separately, with the
CI-level gap it exposes: **nothing measures this invariant anywhere**, which is
why three months passed unnoticed.

## Found on the way, NOT fixed here

`brain/scripts/lib/amendment-draft.mjs` cites
`brain/core/anti-patterns/one-rule-two-implementations.md` twice (lines 39 and
in `applyStatusAct`'s neighbourhood). **That file does not exist** — the same
dangling-citation shape #580, #586 and #499 have been closing. The comment this
change added cited it too and was rewritten to reference the issues instead;
the two pre-existing ones are left alone, because rewording signed-adjacent
comments is not what these tickets approved. Worth its own ticket.
