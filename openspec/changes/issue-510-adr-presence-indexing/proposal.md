---
status: draft
issue: 510
epic: 313
---

# Proposal — adrPresence keeps the indexing invariant, and only that

## What is wrong

`brain/scripts/governance/checks/adr-presence.mjs` decides on file **names**:

```js
const ADR_RE = /^brain\/project\/decisions\/adr-\d+-.+\.md$/;
const hasAdr = files.some(f => ADR_RE.test(f));
if (hasAdr) return { pass: false, reason: 'ADR file added but brain/HOME.md was not updated' };
```

Its input is `git diff --name-only BASE...HEAD`, which lists added, modified and deleted
paths without distinguishing them. So the rule *"a new ADR must be indexed in
`brain/HOME.md`"* fires on any PR that merely **touches** an existing ADR.

PR #507 corrects one dead path citation inside `adr-0013-auto-adr-onboarding.md` — an ADR
from months ago, already indexed — and `decision-gate` fails. It has been blocked on this
since it opened.

The reason string is a second defect. **Nothing in the check establishes that anything was
added.** A verdict that asserts more than its evidence supports sent PR #507's author
looking for a file that was never there.

## What it fixes

`adrPresence` takes an added-only path list alongside the touched one, and the "missing
`HOME.md` entry" branch keys on the added list. Everything else about the check is
unchanged.

The asymmetry is deliberate: the *other* branch — "`HOME.md` changed but no ADR" — keeps
reading the **touched** set. A PR that edits an existing ADR and its index entry together
is coherent and passed before this change; keying that branch on the added set would turn
the fix into a regression.

All three enforcement surfaces pass the added list, so they cannot disagree about the same
merge: `governance/run-check.mjs` (CI), `brain-check.mjs` (local), and
`lib/merge-walk.mjs` (the post-merge audit, shared by `brain-audit` and `brain-metrics`).
That is the #340 lesson — a local green that CI rejects is the same defect wearing a
different hat.

`addedFiles` defaults to `null`, meaning *"assume every touched ADR is new"* — exactly the
pre-#510 behaviour — so `brain-promote` and `postmerge/resolution`, which call the check
with one argument, are untouched.

## What it costs, and why that is the interesting part

The imprecision was **load-bearing**. It is what caught **A10**, the frozen finder fixture
from the #297 finder≠patcher ruling: *an ungoverned ADR edited back in and live at HEAD
must always be reported.* On the audit surface `adrPresence` had quietly become a content
tripwire — a role documented only in a docstring belonging to another module and another
ruling.

That second invariant now has a real owner. #511 shipped `writesGoverned` (PR #512): *an
ADR change on merged history carries a human gate*. So the sequencing this ticket agonised
over is settled by arithmetic — #511 landed first, and A10 can be re-pointed at the
invariant that does the work rather than at the accident.

A10 is therefore **reinforced, not retired**, per the maintainer's ruling on this ticket
(option 3). Its frozen invariants (`^M`, no `^A`, live at HEAD, never `[SKIP]`) are
untouched; it gains a resolvable PR whose only review is a comment, and one assertion that
the report comes from `writesGoverned`.

## Scope

- `adrPresence` takes the added-only list; three surfaces thread it.
- A10 reinforced; A10d added (the exemption must not swallow the new owner).
- ADR-0029 — evidence is time-dependent, and a proxy is recorded rather than trusted.
- The guards the mutations proved missing (see `tasks.md`).

## Out of scope

- The **pre-evaluation resolved-skip's** reach over review evidence. `resolvedSkipLine`
  drops a merge whose contribution is net-absent at the tip *before any check runs*, so an
  ungoverned `brain/` write that someone later reverted is never evaluated for a human gate
  at all. That is documented, deliberate (design §3.5 / REQ-D2-10), and predates both this
  ticket and #511 — but nobody wrote down that it also governs `writesGoverned`. Found
  while building A10d; recorded in ADR-0029 and raised separately rather than changed here.
