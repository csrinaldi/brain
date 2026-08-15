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

## Found on the way, NOT fixed here

`brain/scripts/lib/amendment-draft.mjs` cites
`brain/core/anti-patterns/one-rule-two-implementations.md` twice (lines 39 and
in `applyStatusAct`'s neighbourhood). **That file does not exist** — the same
dangling-citation shape #580, #586 and #499 have been closing. The comment this
change added cited it too and was rewritten to reference the issues instead;
the two pre-existing ones are left alone, because rewording signed-adjacent
comments is not what these tickets approved. Worth its own ticket.
