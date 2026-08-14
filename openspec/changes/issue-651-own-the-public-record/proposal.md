---
status: draft
issue: 651
---

# Proposal — own the public session record (issue 651)

## What

A README section stating that `.memory/`'s 2,000+ session summaries are public
deliberately, what is in them, that they were audited, and that they do not ship
— plus a guard so the decision cannot revert in silence.

## Why

§2b of the #610 pre-flight is that runbook's only judgment call, and its finding
was not that the records are dangerous. It is that they were public **by
omission**. #435 put it exactly:

> arguably brain's best advertisement — the methodology working in the open — but
> it is a choice to make deliberately, not by omission.

The decision is **keep and own it**, and the other two options are closed rather
than rejected:

- **Prune** lost its rationale when §1 finished — two scanners over the full
  published history, 23 findings, every one characterised, **zero credentials**.
  Nothing to rotate, and the runbook's own note applies: deletion does not
  retract what is already cloned or cached.
- **Stop shipping forward** is not an alternative; it is done (#607), and it
  addresses the tarball rather than the repository.

So exactly one thing changes, and it is the thing that was missing: the README
says why they are there.

## Why a test for a paragraph

Because the decision's entire artifact IS the paragraph. Tidy it away and the
state reverts to precisely what the pre-flight objected to, with nothing failing.

The guard checks the **claims**, not the wording — five things the section has to
carry, each with the reason it is load-bearing. A rewrite that keeps all five is
welcome. The mutation that matters is M2: keeping the section but stripping "on
purpose" puts it back to by-omission, and the guard catches that, not just
deletion.

## Scope

- **In:** the README section, and `test/readme-memory-disclosure.e2e.test.mjs`.
- **Out:** `.memory/` itself, the memory backends, and `files` in `package.json`.
  The tarball question is #607's and is settled.

The guard lives in `test/`, not `brain/scripts/`: it asserts facts about **this**
repository's README, and vendored into a consumer it would describe the wrong
project — #397's shape, the same reason brain's own `AGENTS.md` never ships.
