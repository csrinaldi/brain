# AGENTS.md Regen Reporting Specification

## Purpose

The antigravity harness backend compiles `AGENTS.md` from 5 canonical
`SOURCE_DOCS` and never throws (issue #256). When a source doc cannot be read,
or the compiled file cannot be written, `init()` must say so through its
return value — not only through a `console.warn` a caller may not be
watching — so any caller that makes a claim about the outcome (today,
`brain-upgrade.mjs`) can word that claim to match reality.

## Requirements

### Requirement: Init Reports Unreadable Source Docs

`init()` MUST return an object whose `missingDocs` field is an array of every
`SOURCE_DOCS` relative path it could not read in this call, in `SOURCE_DOCS`
order. `missingDocs` MUST be `[]` when every doc was read successfully.

#### Scenario: One doc unreadable

- GIVEN `_readDoc` throws for `brain/HOME.md` and returns content for the
  other 4 `SOURCE_DOCS`
- WHEN `init()` runs
- THEN it still compiles and writes `AGENTS.md` from the 4 readable docs
- AND its resolved value's `missingDocs` equals `['brain/HOME.md']`

#### Scenario: All docs readable

- GIVEN `_readDoc` returns content for every `SOURCE_DOCS` path
- WHEN `init()` runs
- THEN its resolved value's `missingDocs` equals `[]`

### Requirement: Init Reports the AGENTS.md Write Outcome

`init()` MUST return `agentsWritten: true` when `writeAgents` completes
without throwing, and `agentsWritten: false` when it throws. The existing
`console.warn` on a write failure MUST still fire — this requirement adds a
field, it does not replace the warning.

#### Scenario: Write fails

- GIVEN `_writeAgents` throws
- WHEN `init()` runs
- THEN `init()` still resolves (never throws)
- AND its resolved value's `agentsWritten` is `false`

#### Scenario: Write succeeds

- GIVEN `_writeAgents` does not throw
- WHEN `init()` runs
- THEN its resolved value's `agentsWritten` is `true`

### Requirement: Return Shape Stays Backward Compatible

`init()`'s resolved object MUST NOT include an `ok` field, and MUST NOT throw
under any combination of read/write failure. A caller that discards or never
inspects the resolved value MUST observe no behavior change from before this
capability existed.

#### Scenario: Existing CLI dispatch caller is unaffected

- GIVEN `harness/cli.mjs`'s dispatch checks `result.ok === false` to decide
  whether an op failed
- WHEN `init()` resolves with `missingDocs` non-empty or `agentsWritten: false`
- THEN `result.ok` is `undefined`, so the dispatch does not treat the call as
  failed
- AND the CLI's exit code is unchanged from before this capability

### Requirement: brain-upgrade's Regen Claim Matches the Report

After calling `init()`, `brain-upgrade.mjs` MUST select its printed message
from the returned report, and MUST NOT print the unconditional "Regenerated
AGENTS.md from YOUR brain/HOME.md" line unless `missingDocs` is empty and
`agentsWritten` is `true`.

#### Scenario: Nothing missing, write succeeded (byte-identical wording)

- GIVEN `init()` resolves with `missingDocs: []` and `agentsWritten: true`
- WHEN `brain-upgrade.mjs` reports the result
- THEN it prints the exact, unchanged line: "Regenerated AGENTS.md from YOUR
  brain/HOME.md (it is compiled, not shipped — see #397)."

#### Scenario: brain/HOME.md missing

- GIVEN `init()` resolves with `missingDocs` containing `brain/HOME.md`
- WHEN `brain-upgrade.mjs` reports the result
- THEN it prints a message naming `brain/HOME.md` as absent and that
  `AGENTS.md` was compiled from the methodology docs only
- AND it names `AGENT_PLATFORM=antigravity npm run brain:env:init` as the
  command that creates `brain/HOME.md` and regenerates `AGENTS.md` from it
- AND it does NOT print the byte-identical success line

#### Scenario: A different source doc is missing

- GIVEN `init()` resolves with `missingDocs` containing a methodology doc but
  not `brain/HOME.md`
- WHEN `brain-upgrade.mjs` reports the result
- THEN it names the missing doc(s) and says `AGENTS.md` was compiled without
  them
- AND it does NOT print the byte-identical success line

#### Scenario: The AGENTS.md write itself failed

- GIVEN `init()` resolves with `agentsWritten: false`
- WHEN `brain-upgrade.mjs` reports the result
- THEN it reports that `AGENTS.md` could not be written, regardless of
  `missingDocs`
- AND it does NOT print the byte-identical success line
