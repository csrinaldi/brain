---
status: draft
issue: 599
---

# Spec — adr-0023-citation-gap (issue 599)

No capability is added or modified (per proposal `## Capabilities`). This is a
full spec for the change's own acceptance surface — the governance rewording
and registry cleanup — following the `issue-590-adr-0018-gitlab-fragment`
precedent (flat `spec.md`, no existing domain spec to delta against).

## REQ-599-1 — No unresolved `ADR-0023` citation remains in the scanned surface

The three reworded lines MUST NOT leave a bare uppercase `ADR-0023` token that
`test/adr-citation-resolves.e2e.test.mjs`'s `CITATION_RE`
(`/ADR-(\d{4})(?!\d)/g`) reads as an unresolved citation. Since 0023 stays
RESERVED (no file at `brain/project/decisions/adr-0023-*.md`), the reword MUST
avoid the bare token form — it MUST NOT merely resolve it another way.

#### Scenario: e2e scan runs against reworded MASTER-PLAN-1.0.md

- GIVEN both MASTER-PLAN-1.0.md lines (around 72, 93) have been reworded
- WHEN `adr-citation-resolves.e2e.test.mjs` collects citations across the scanned surface
- THEN neither line contributes an unresolved-citation finding for number `0023`

#### Scenario: e2e scan runs against reworded brain-v2-epic-plan.md

- GIVEN the brain-v2-epic-plan.md line (around 114) has been reworded
- WHEN the e2e scan runs
- THEN it does not contribute an unresolved-citation finding for number `0023`

## REQ-599-2 — Reworded lines stay truthful about the draft's status

Each reworded line MUST tell the reader three facts: the draft exists at
`brain-drafts/adr-0023-sdd-role-port.md`, the number `0023` is RESERVED (not
promoted, no ADR on disk), and `#312` is the ticket that will produce the ADR
from shipped code.

#### Scenario: reader follows a reworded MASTER-PLAN-1.0.md line

- GIVEN a reader reads either reworded MASTER-PLAN-1.0.md line
- WHEN they look for what "0023" refers to
- THEN they find the draft path, its reserved status, and the `#312` reference — never a claim the ADR exists

#### Scenario: reworded brain-v2-epic-plan.md line preserves its language

- GIVEN the reworded brain-v2-epic-plan.md line
- WHEN read
- THEN it stays Spanish-language prose, and still names the draft path, reserved status, and `#312`

## REQ-599-3 — Registry deletions and all three rewordings land together; full suite is green

The two `KNOWN_GAPS` entries — `(docs/inbox/MASTER-PLAN-1.0.md, '0023')` and
`(docs/inbox/brain-v2-epic-plan.md, '0023')` — MUST be deleted in the same
change as all three rewordings. `npm test` MUST pass, exercising both the
resolution check ("every cited `ADR-NNNN` resolves") and the staleness guard
("no registry entry outlives the citation it exempts").

#### Scenario: partial rewording fails

- GIVEN only one of the two MASTER-PLAN-1.0.md lines is reworded while both `KNOWN_GAPS` entries are deleted
- WHEN `npm test` runs
- THEN the still-bare line produces an unresolved-citation failure

#### Scenario: rewording without deletion fails

- GIVEN all three lines are reworded to no longer carry the bare token
- WHEN the `KNOWN_GAPS` entries are NOT deleted
- THEN the staleness guard fails because an entry no longer matches a real citation

#### Scenario: full rewording with deletion passes

- GIVEN all three lines are reworded AND both `KNOWN_GAPS` entries are removed
- WHEN `npm test` runs
- THEN both the resolution check and the staleness guard pass

## REQ-599-4 — Nothing else changes

The change MUST NOT create or modify any ADR file under
`brain/project/decisions/`, MUST NOT edit
`brain-drafts/adr-0023-sdd-role-port.md`, MUST NOT edit `.gitlab-ci.yml`, and
MUST NOT touch any `brain/` source file beyond
`test/adr-citation-resolves.e2e.test.mjs`.

#### Scenario: diff scope check

- GIVEN the committed diff for this change
- WHEN inspected
- THEN it touches exactly `docs/inbox/MASTER-PLAN-1.0.md`, `docs/inbox/brain-v2-epic-plan.md`, and `test/adr-citation-resolves.e2e.test.mjs`, and no other tracked file
