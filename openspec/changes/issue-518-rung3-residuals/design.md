---
status: draft
issue: 518
---

# Design

`auditedBase(range)` is `auditedTip`'s mirror, three-dot split first for the same reason,
returning `null` where `auditedTip` returns `'HEAD'` — because an absent tip has a sensible
default and an absent base does not.

## Why the test executes the command

The ticket named this: *"a unit test on the emitter's text would go green on a string that
still does not execute."* The defect's whole character is that the string **looks** right.
So the guard extracts the printed command from the audit's real stdout and spawns it,
asserting it reaches the CAS — never `usage`, never `to must be a 40-hex sha`. The push
fails (no remote in the fixture) and that is fine; the push is not what is under test.

## The mutations, and a harness bug they exposed

The first run reported M1 and M3 **green**. Both were lies: `git diff` was comparing the
mutated file against **HEAD**, and the working tree already carried this change
uncommitted — so the diff showed the change, not the mutation, and a substitution that had
silently failed to match read as one that landed. M1 had in fact aborted (perl interpolated
`${sha.slice(...)}` as a subroutine call) and M3 had mutated a branch the tests never reach.

The harness now diffs against a pre-mutation snapshot and uses literal replacement. That is
the #409 lesson arriving from a third direction: it is not enough to print the diff — the
diff has to be of the right two things.
