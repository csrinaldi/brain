# Promotion checklist — the `decision-gate` claim (issue #516)

`brain/**` is Tier 2: the agent drafts, the human signs. This is a **five-site, four-file**
promotion plus a regenerated `AGENTS.md`, and it **amends a signed ADR**, so `brain:promote`
cannot do it (`brain-promote.mjs:335` refuses the amendment path — that is #509, and it is the
same absence this ticket is about).

## Before you sign

Three things to agree with, because they are the ruling and not just wording:

1. **The gate does not change.** Option (2) — restoring co-occurrence for modified ADRs — is
   refused, because it re-creates the defect #510 removed and re-blocks PR #507's whole class.
2. **The amendment marker becomes stated convention.** Until #509 ships the amendment verb,
   nothing mechanical catches a missing `brain/HOME.md` marker. Signing this is signing that
   accepted loss.
3. **The label divergence stays open and stays recorded.** ADR-0026's `standard` row still
   promises a hard `decision`-label step that has never shipped. Half the note closes; half
   does not.

If you disagree with any of them, the draft is wrong and should come back rather than be
promoted with an edit.

## Run it

```bash
git fetch origin fix/issue-516-doctrine-gate-claim
git checkout fix/issue-516-doctrine-gate-claim
bash openspec/changes/issue-516-doctrine-gate-claim/brain-drafts/promote-516.sh
git diff
git commit -am "docs(governance): decision-gate is added-only and label-blind — ADR-0026 Amendment 4 (#516)"
git push
```

The script anchors on exact strings and **refuses** if any anchor is not found exactly once,
rather than editing something adjacent. Running it twice reports *"already promoted"*.

It was executed and reverted before shipping — so what you are running is a path that has been
walked, not a checklist that has been written.

## What it touches, and why each one

| file | why |
|---|---|
| `brain/core/methodology/consolidation-protocol.md` | §1c (the load-bearing sentence) and §1d act 2 |
| `brain/core/methodology/workflow-governance.md` | invariant table row 4, the Invariant 4 section, and the Enforce/Guide boundary |
| `brain/project/decisions/adr-0026-…md` | `GATE_MATRIX` row + divergence note + §1c's three acts (Status line, in-place annotation, appended signed section) |
| `brain/HOME.md` | §1c act 4 — the Amendment 4 marker |
| `AGENTS.md` | **compiled**, not authored. `workflow-governance.md` and `HOME.md` are two of the five `SOURCE_DOCS`, and a drift guard fails CI on any byte difference. The script regenerates it. |

That last row is the one a hand-written checklist got wrong in #529: it described a two-file
edit for a three-file cascade and CI caught it on the human's signing commit. The script here
regenerates `AGENTS.md` through the backend's own `init()` — not `brain:env:init`, which
prompts for a PAT, upgrades tooling and reprojects memory to rewrite one file.

## Verify

```bash
npm run brain:repo:check
npm run brain:nav
npm test
```

`brain:nav` and `repo:check` do not read prose, so passing means only that nothing structural
broke. The two new tests in `run-check.test.mjs` are the part that will still be true in six
months: they pin the code facts the corrected prose describes, and their failure messages name
these files.

## After

- Close #516 **with the correction quoted in the closing comment**, not just a link. #519 and
  #368 both closed carrying an unmade decision inside them.
- #509 already carries the note: option (3)'s content-keyed guard, its shape, and this change's
  measurement. It is where the net belongs — a tool that performs the cascade cannot forget it.
