### [issue-install-home-scaffold] install-home-scaffold — 2026-07-13

# HOME.md Index Helper Specification

## Purpose

Provides an agent-agnostic, pure, unit-tested helper that inserts ADR links
into `brain/HOME.md`'s `### Architecture decisions` section, and rewires the
Claude adapter to delegate to it — removing the HOME.md-patch algorithm from
adapter prose so any current or future agent (Claude, Codex, ...) shares one
tested mechanism instead of re-implementing it per agent.

## Requirement Index

| Req | Name | Testable |
|-----|------|----------|
| REQ-1 | Append after last existing link | Unit (`node --test`) |
| REQ-2 | Insert after heading when section is empty | Unit (`node --test`) |
| REQ-3 | Fail-safe on unlocatable/ambiguous anchor | Unit (`node --test`) |
| REQ-4 | Idempotent re-insertion | Unit (`node --test`) |
| REQ-5 | Adapter delegates to the helper (no prose patch logic) | File assertion |
| REQ-6 | Post-index nav integrity | Fixture (`brain:nav`) |
| REQ-7 | Helper is agent-agnostic and distributed | Unit / file assertion |

---

### Requirement REQ-1: Append After Last Existing Link

`insertAdrLink(homeText, { number, slug, description })` MUST, when the
`### Architecture decisions` section already contains one or more
`- [ADR-NNNN](...)` link lines, insert the new link immediately after the
LAST such link line, leaving all prior lines unchanged.

#### Scenario: New link appended after the last existing one

- GIVEN a HOME.md section with `ADR-0001` and `ADR-0002` links already present
- WHEN `insertAdrLink()` is called with `ADR-0003`'s data
- THEN the resulting text has the `ADR-0003` link immediately after the `ADR-0002` line
- AND the `ADR-0001` and `ADR-0002` lines are unchanged

---

### Requirement REQ-2: Insert After Heading When Section Is Empty

When the `### Architecture decisions` heading is present but has zero link
lines beneath it, `insertAdrLink()` MUST insert the first link immediately
after the heading line — it MUST NOT abort or fail-safe in this case.

#### Scenario: First link inserted into an empty section

- GIVEN a HOME.md with `### Architecture decisions` present and no link lines under it
- WHEN `insertAdrLink()` is called with an ADR's data
- THEN the resulting text has the new link line immediately after the heading
- AND no orphan/abort condition is reported

---

### Requirement REQ-3: Fail-Safe on Unlocatable/Ambiguous Anchor

When the `### Architecture decisions` heading cannot be located, or its
location is ambiguous, `insertAdrLink()` MUST return the input text
completely unchanged and MUST report the exact lines that would have been
added. It MUST NOT perform a partial write.

#### Scenario: Missing heading returns input untouched plus a report

- GIVEN a HOME.md with no `### Architecture decisions` heading
- WHEN `insertAdrLink()` is called with an ADR's data
- THEN the returned text is identical to the input text
- AND the exact link line that should be added is reported to the caller

---

### Requirement REQ-4: Idempotent Re-Insertion

Calling `insertAdrLink()` with data for an ADR link already present in the
section MUST be a no-op: the returned text MUST be identical to the input,
and no duplicate link line MUST be produced.

#### Scenario: Re-inserting an existing link changes nothing

- GIVEN a HOME.md section already containing the `ADR-0003` link
- WHEN `insertAdrLink()` is called again with `ADR-0003`'s data
- THEN the returned text is unchanged from the input
- AND no duplicate `ADR-0003` link line appears

---

### Requirement REQ-5: Adapter Delegates to the Helper

`.claude/commands/project-bootstrap-adrs.md` Phase 4 MUST invoke the
`insertAdrLink()` helper (via `node brain/scripts/lib/home-index.mjs …` or an
equivalent documented invocation) instead of describing the HOME.md-patch
algorithm in prose. No step-by-step patch mechanics MUST remain described in
the adapter's Phase 4 text.

#### Scenario: Phase 4 calls the helper instead of describing patch mechanics

- GIVEN `.claude/commands/project-bootstrap-adrs.md` after the rewire
- WHEN Phase 4 is read
- THEN it instructs invoking the `home-index.mjs` helper
- AND it contains no prose description of how to locate/insert a link line

---

### Requirement REQ-6: Post-Index Nav Integrity

After `insertAdrLink()` is used to patch `brain/HOME.md` with a real ADR
link, `npm run brain:nav` MUST report no orphans and no dead links.

#### Scenario: brain:nav is clean after indexing an ADR

- GIVEN `brain/HOME.md` and a real `brain/project/decisions/adr-NNNN-*.md` file
- WHEN `insertAdrLink()` patches the link into `brain/HOME.md` and `npm run brain:nav` runs
- THEN the command exits 0 with no orphan or dead-link report

---

### Requirement REQ-7: Helper Is Agent-Agnostic and Distributed

`brain/scripts/lib/home-index.mjs` MUST contain no agent-specific mechanics
(no Claude-only, Codex-only, or other agent-coupled logic). It MUST be a pure
string-to-string function reachable via a CLI guard for shell invocation, and
MUST be included in a `managed` glob so it distributes to every consumer via
`brain:upgrade`.

#### Scenario: Helper contains no agent-specific branching

- GIVEN `brain/scripts/lib/home-index.mjs`
- WHEN its source is inspected
- THEN it contains no reference to a specific agent name or agent-specific invocation contract

#### Scenario: Helper ships to consumers via managed glob

- GIVEN `brain/core/managed-paths.mjs`
- WHEN the `managed` array is inspected
- THEN a glob covering `brain/scripts/lib/home-index.mjs` is present

---

## Gaps and Assumptions

| # | Gap / Assumption |
|---|-------------------|
| G1 | **Exact invocation contract** (CLI args/stdin-stdout shape of `home-index.mjs`) between the adapter and the helper is an implementation detail deferred to design; this spec only requires that Phase 4 delegates to the helper rather than embedding patch prose. |
| G2 | **Ambiguous-anchor detection criteria** (what exactly counts as "ambiguous" beyond "heading absent") is deferred to design; the spec only requires the fail-safe outcome (unchanged input + reported lines) whenever the anchor cannot be unambiguously resolved. |
