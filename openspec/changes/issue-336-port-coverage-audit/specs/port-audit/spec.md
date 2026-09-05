---
issue: 336
phase: spec
capability: port-audit
---

# Spec — the port's coverage is measured, not remembered

## Requirement: every exported verb appears (R336-1)

The report MUST list every verb each provider adapter exports as a function,
derived from the adapter source. A verb cannot be missing because nobody
remembered to add it.

### Scenario: a verb is added to an adapter
- WHEN a new `export async function` lands in `providers/github.mjs`
- THEN the next run lists it, with no edit to the audit script.

## Requirement: provenance is read, never assumed (R336-2)

Each verb's fixture provenance MUST be read from `_provenance` in the fixture
files themselves, and reported as `recorded`, `derived`, `mixed`, or `none`.

### Scenario: a derived fixture
- WHEN a fixture carries `_provenance.derived === true`
- THEN the verb's provenance counts that fixture as derived.

### Scenario: a verb whose fixtures disagree
- WHEN one fixture is recorded and another derived for the same verb
- THEN the provenance is `mixed` — never collapsed to whichever came first.

### Scenario: a fixture that cannot be parsed
- WHEN a fixture file is unreadable or not JSON
- THEN it is reported as `unreadable` and NEVER silently counted as `none`;
  absent evidence is not evidence of absence.

## Requirement: the gap list is ranked by blast radius (R336-3)

Uncovered verbs MUST be ordered by consumer count, descending — the ranking
that makes Phase 2 sliceable.

### Scenario: prReviews, the worked example
- WHEN the report is generated against today's tree
- THEN `prReviews` appears with its consumers counted, and the report states
  what its gap cost (#317) rather than leaving the reader to infer it.

## Requirement: it is a script, not a document (R336-4)

The report MUST be produced by `brain:port:coverage`, in markdown by default
and JSON under `--json`, so it cannot rot the way a hand-written table does.

### Scenario: machine consumption
- WHEN `--json` is passed
- THEN stdout is valid JSON carrying the same rows as the markdown.
