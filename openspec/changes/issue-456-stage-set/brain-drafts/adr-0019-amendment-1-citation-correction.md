# DRAFT — ADR-0019 Amendment 1 citation correction (issue #456 slice A, Phase 7)

**Status: DRAFT, NOT APPLIED.** Target file `brain/project/decisions/adr-0019-harness-port.md`
is Tier 3 — this apply run is prohibited from writing to `brain/project/**`
directly. Recorded here for human promotion. Not acted on in this slice
(design §8, "Recorded, not resolved").

## What is wrong, measured (design §8)

1. **Module count.** The amendment says *"Twelve modules import that layout."*
   Measured (design §1): **ten production** call sites import from
   `sdd-layout.mjs`, plus **eight test files** (eighteen total counting tests).
   "Twelve" is neither number.
2. **`ARTEFACT_FILE` entry count.** The amendment quotes it with **four**
   entries (`proposal`, `spec`, `design`, `tasks`). The tree has **five** —
   `verification: 'verify-report.md'` is missing from the quoted block.
3. **Line-number citations.** `reviewer-protocol.md` §2 (#580) warns against
   citing doctrine by line number rather than by symbol, precisely because
   line numbers rot. This amendment cites `sdd-layout.mjs:28-32` and
   `sdd-layout.mjs:96-99` — both will drift the moment slice A's
   `resolveStageSet` and `LIFECYCLE_STAGES` land above them in the file.

## Proposed edit

In `brain/project/decisions/adr-0019-harness-port.md`, in the "What the
evidence contract actually is" section:

Replace:

```
sdd-layout.mjs:28-32   ARTEFACT_FILE = { proposal: 'proposal.md', spec: 'spec.md',
                                         design: 'design.md',     tasks: 'tasks.md' }
sdd-layout.mjs:96-99   openspec/changes/issue-<id>-<slug>/<file>
```

with (citing by symbol, not line number, per reviewer-protocol.md §2):

```
sdd-layout.mjs ARTEFACT_FILE = { proposal: 'proposal.md', spec: 'spec.md',
                                  design: 'design.md',     tasks: 'tasks.md',
                                  verification: 'verify-report.md' }
sdd-layout.mjs artifactPaths()   openspec/changes/issue-<id>-<slug>/<file>
```

Replace:

```
Twelve modules import that layout. Three of them are gates on every pull request —
```

with:

```
Ten production modules import that layout (eighteen counting tests). Three of them
are gates on every pull request —
```

No other changes to this ADR. This is a citation-accuracy correction; it does
not reopen or alter the amendment's conditions.
