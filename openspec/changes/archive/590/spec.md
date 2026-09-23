---
status: draft
issue: 590
---

# Spec — adr-0018-gitlab-fragment (issue 590)

## REQ-590-1 — ADR-0018 exists and describes the current mechanism

The draft records what the tree does today. Every divergence from the
2026-07-10 draft is tabulated inside the ADR itself, not reconciled in silence.

## REQ-590-2 — No live file cites an ADR that cannot be opened

A check fails naming file, line and number for every citation that does not
resolve to `brain/project/decisions/adr-NNNN-*.md`.

**Scanned surface** — every tracked file, minus exactly three kinds of
exclusion, each of which the check itself defends:

| exclusion | why | how it is bounded |
|---|---|---|
| `.memory/`, `openspec/`, `brain-drafts/` | a citation there is not a pointer to live doctrine — an append-only log, or a draft, which is what a not-yet-real number means | `REQUIRED_ROOTS` asserts every other root still contributes scanned files |
| the check's own file (`SELF`) | its registries must NAME the numbers they exempt, so scanning itself produced 8 self-inflicted findings out of 13 | a guard derives the path from `import.meta.url`, so the exclusion cannot be re-pointed at a second file |
| `FIXTURE_CITATIONS` / `KNOWN_GAPS` | deliberate fakes in test material; real rot owned by another ticket | exact `(file, number)` pairs, staleness-guarded, `KNOWN_GAPS` entries must name an issue |

Stated as a table because the first version of this spec named the first row
and stopped, while the implementation carried all three.

## REQ-590-3 — Exemptions are exact and expire

`(file, number)` pairs, never patterns. An entry that no longer matches a real
citation fails. `ADR-0018` is not registrable as an exemption: a test forbids
it, because baselining it would record the defect instead of repairing it.

## REQ-590-4 — Readers fail loudly

No reader returns empty on failure: "the scan did not run" and "the tree is
clean" must stay distinguishable. Verified by driving both readers against
unreadable inputs.

## REQ-590-5 — A draft's links resolve at the path it will be promoted to

Sibling `](adr-NNNN-….md)` links in an ADR draft are relative to
`brain/project/decisions/`, not to the `brain-drafts/` dir the draft sits in.
They are checked before promotion, so a broken link fails on the author's side
rather than on the signing commit.

## Declared limits (not defects — recorded so they are not discovered)

- **Untracked files are invisible.** The reader is `git ls-files`. Locally, a
  rotted citation in an unstaged file passes. CI is unaffected: everything
  there is committed.
- **Resolution, never correctness.** A citation aimed at the *wrong* ADR passes.
- **Case-sensitive.** `adr-0018` in prose is not matched; matching
  case-insensitively would fire on every `adr-….md` path.
