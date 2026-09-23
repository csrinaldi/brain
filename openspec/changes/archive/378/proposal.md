---
status: draft
issue: 378
artifact_store: openspec
topic_key: sdd/issue-378-brain-promote/proposal
---

# Proposal: `brain:promote` — a read-confirm-stage verb for Tier 2 draft promotion (issue #378)

Issue #378. Change folder: `openspec/changes/issue-378-brain-promote/`.

## Intent

Promoting a Tier 2 draft into `brain/` is a hand-executed checklist at the exact moment
the human is thinking about *content*, not paths. Automate the **mechanics**; make it
structurally impossible for an agent to supply the **judgment**.

The deliverable is **not** the promoter. The deliverable is the promoter *plus the locks*.
A working promoter without the locks is worse than no promoter, because the two
anti-patterns it sits next to — `ia-escribe-brain-sin-gate.md` and
`ia-promueve-sus-propios-artefactos.md` — describe exactly the failure a one-command
promoter makes trivial. The second one names the cause: *"for an agent, 'completing the
task' includes leaving the artifact in its terminal state."*

## What the measurements say (taken before designing)

Four measurements changed the shape of this change. Each is reproducible.

**M1 — the issue's acceptance fixture no longer exists.** The issue names
`brain/project/decisions/adr-0025-l5-deny-set.md` as the expected output. On `main` @
`0401871`, `adr-0025` is already taken by `adr-0025-release-audit-gate-ordering.md`.

```
$ ls brain/project/decisions/ | grep 0025
adr-0025-release-audit-gate-ordering.md
```

The literal acceptance criterion is stale. What it was testing is not: it is testing that
the tool produces the house artefact at the `adrPresence`-matching path. That is preserved
here, with the number the human picks, and it directly motivates REQ-378-6 (**refuse when
the destination already exists**) — which the issue does not list and which this
measurement shows is a live hazard, not a hypothetical one.

**M2 — the `AGENTS.md` step DOES fail a gate.** Comment 5217778764 adds a third cascade
step (regenerate `AGENTS.md`, since `brain/HOME.md` is one of five `SOURCE_DOCS`) and
justifies putting it in the tool on the grounds that *"that step fails no gate."*
Measured on `main` @ `0401871`, appending one line to `brain/HOME.md` and running the
existing drift guard:

```
$ node --test brain/scripts/harness/backends/antigravity.drift.test.mjs
not ok 1 - drift-guard: compileAgentsMd() over the REAL 5 SOURCE_DOCS is byte-equal to
          the committed AGENTS.md
```

`antigravity.drift.test.mjs` matches `npm test`'s glob, so the step fails `npm test` —
a required gate. **The step belongs in the tool anyway**, but for the honest reason: it
saves a red CI round trip on a cascade nobody remembers, not because nothing catches it.
Shipping the stated rationale unchecked would have put a false claim in an ADR.

**M3 — the HOME.md insert algorithm already exists and is pure.**
`brain/scripts/lib/home-index.mjs` exports `insertAdrLink(homeText, adr)`, with the
anchor-ambiguity and idempotence branches already decided and tested. This change
**calls** it. Two copies of that algorithm would drift; the red-proof anti-pattern's
rule 7 says delete one before it exists.

**M4 — `git config user.name` in the agent's own shell is the agent.**

```
$ git config user.name
Claude
```

This is the honest limit the ADR must record, stated as a measurement rather than a
caveat: the stamped name is a *record of who ran the tool*, not proof of who signed.

**M5 — ADR titles contain backticks.** `adr-0027-…`'s H1 is
``# ADR-0027 — `brain:upgrade` Rollback Is Restorable, Not Atomic``. Step 5 of the issue
prints a `git commit` command for the human to paste. Printed inside double quotes, that
title executes `brain:upgrade` on paste. REQ-378-8 makes the printed command
single-quoted and escaped.

## Scope of the first slice — and what it deliberately leaves out

**In:** new-file ADR promotion (`adr-NNNN-<slug>.md` → `brain/project/decisions/`), the
house header rewrite, the `brain/HOME.md` entry, the `AGENTS.md` regeneration, staging,
and the printed conforming commit command.

**Out, and this is the uncomfortable part:** in-place edits to an already-signed
`brain/**` file. Comment 5217778764 measured that shape and found it is the **majority**
of pending promotions — three of five open human acts on #405. A first slice that
automates the minority case is automating the easy half, and the artefacts say so rather
than implying coverage.

The reason it is still deferred is not difficulty, it is **ordering**. The in-place shape
carries an unwritten convention: an amendment to a signed ADR replaces lines in the
original body *and* appends a signed `## Amendment N` section (precedent: `git show
0f54781`, ADR-0026 Amendment 1). That rule exists nowhere except in a commit. A tool
cannot encode an unwritten rule — encoding it *is* writing it, and writing doctrine is
the Tier 2 act this whole change exists to keep human. So the prerequisite is a doctrine
edit, which this change **drafts** (`brain-drafts/amendment-convention.md`) and does not
promote. Slice 2 is unblocked the moment a human signs it. See design D2.

Also out: promoting anything outside `brain/`; deleting the source draft; opening the PR;
`--list` mode; assigning the ADR number (read from the draft filename — open question 2,
settled by the issue's own reasoning and reinforced by M1).

## Does this need its own ADR? Yes (open question 3)

Not for the tool. For the **limits**. The ADR exists so nobody later reads
"`brain:promote` refuses on a non-TTY" as enforcement. It is drafted at
`brain-drafts/adr-0028-brain-promote-read-confirm-stage.md` and left for a human.
