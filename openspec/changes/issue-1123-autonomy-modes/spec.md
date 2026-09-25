---
status: draft
issue: 1123
---

# Autonomy modes — Delta Spec

This change ships doctrine, not code. Each requirement names the observation that would prove it
false. `ADR` is `brain-drafts/adr-0037-autonomy-is-configurable-modes-a-b-c.md`; `AMEND` is
`brain-drafts/agent-authorities-tier3.draft.md`; `TARGET` is
`brain/core/methodology/agent-authorities.md` on `origin/main`.

## Requirements

### Requirement: the ADR draft is a promotable new ADR

`ADR`'s basename MUST match `DRAFT_BASENAME_RE`, its H1 number MUST equal its filename number,
`0037` MUST be free in `brain/project/decisions/` and `brain/HOME.md` on `origin/main`, and
`transformDraft`, `insertAdrLink` and `checkShippedContent` MUST succeed on it.

**Falsified by:** any of those returning `ok: false` / `inserted: false`; an
`adr-0037-*` file or an `ADR-0037` line on `origin/main`.

#### Scenario: planner run
- **WHEN** the planner functions run on `ADR` with a non-empty git user name
- **THEN** the destination is `brain/project/decisions/<ADR basename>`, the text has exactly one
  `**Status**:` line, `brain/HOME.md` gains exactly one ADR-0037 line, and both guards pass

### Requirement: the amendment draft plans cleanly

`AMEND` MUST parse as `brain-amendment/1` targeting `TARGET`; every `amend-find` MUST occur
exactly once in `TARGET` (`assessEdit` → `free = 1`, `state = pending`); `planAmendment` MUST
return a plan with every act pending.

**Falsified by:** `parseAmendmentDraft` failing, any edit `blocked` or `done`, or
`planAmendment` returning `ok: false`.

### Requirement: three modes, each with its approver and merger

`ADR` MUST define A (human intent, human merge), B (human intent; platform merge only when every
required gate passes and a cold review posted by a non-producer identity approves; the default)
and C (non-producer agent intent approval, platform merge as B), and MUST define "the platform"
as a governed step outside any agent session, under the automation identity (#1107), through the
port's merge verb (#1133).

**Falsified by:** a mode missing its approver or merger; B's merge condition omitting the gates or
the reviewer's distinctness; "the platform" admitting the producing agent's session.

### Requirement: the producing identity never approves or merges, in every mode

`ADR` and `AMEND` MUST state the invariant for every mode, MUST define the producing identities
(commit authors, PR/MR author), MUST name #1134 as the code gate and MUST state that an
unresolvable identity is never assumed distinct. Any exception MUST be named, bounded to `lite`
and mode A, reported, and flagged for ratification.

**Falsified by:** a mode in which the producer may merge without a named exception; an exception
available above `lite` or in B/C.

### Requirement: C is refused at `regulated`, and never silently downgraded

`ADR` MUST state that a declared C at `regulated` is a configuration error and that no automatic
merge runs until it is corrected.

**Falsified by:** `ADR` allowing C at `regulated`, or falling back to B silently.

### Requirement: the reviewer gains no authority

`ADR` MUST state that the cold review's verdict is necessary and never sufficient for an
automatic merge, and that ADR-0026's never-tiered reviewer rule and `reviewer-protocol.md`'s
locks are unchanged.

**Falsified by:** `ADR` giving the reviewer an approve path, a merge verb, or a key that
authorizes either.

### Requirement: honest reporting and an explicit transition

`ADR` MUST require brain to report the declared and the effective mode separately, MUST list the
conditions for an effective B, and MUST state that until #1133 and #1134 land the effective
default is A.

**Falsified by:** `ADR` implying B is effective at promotion, or reporting a single mode.

### Requirement: the declaration and its relations are stated

`ADR` MUST name the config key (`governance.autonomy`, values `A`/`B`/`C`, absent = `B`) and MUST
relate the decision to ADR-0015, ADR-0020, ADR-0026, ADR-0031, ADR-0033, ADR-0034 and ADR-0036,
and to `governance.agentActors` / `governance.reviewActors`.

**Falsified by:** a missing relation, or a statement that a tier parameter or required check
changes in this ADR.

### Requirement: no `brain/**` edit

This change MUST NOT modify any path under `brain/`.

**Falsified by:** `git diff --name-only origin/main...HEAD` listing a `brain/` path.
