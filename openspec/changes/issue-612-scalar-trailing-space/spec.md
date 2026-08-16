# yaml-block-scalar Specification

## Purpose

`scalar(block, key)` is the shared `key: value` reader behind every fenced-YAML
consumer in this repo (`parse-verdict.mjs`, `decision-block.mjs`,
`epic-graph.mjs`, `actor-check.mjs`'s `lite` path, `checkpoint-block.mjs`'s
`integerField`). This spec pins its three-state contract for the
whitespace-only case and the governance invariance the repair must preserve.

## Requirements

### Requirement: `scalar` distinguishes a value from whitespace-only

`scalar(block, key)` MUST return the captured value when the key line carries
one, and MUST return `null` when the key line carries only whitespace
(space, tab, or a mix) after the colon. Whitespace-only is the ABSENT state,
not an empty-string value.

#### Scenario: key line with a real value

- GIVEN a block containing `protocol: brain-review/1`
- WHEN `scalar(block, 'protocol')` is called
- THEN it returns `'brain-review/1'`

#### Scenario: key line with a single trailing space and nothing else

- GIVEN a block containing `findings: ` (one trailing space, no value)
- WHEN `scalar(block, 'findings')` is called
- THEN it returns `null`

#### Scenario: key line with a tab or mixed whitespace and nothing else

- GIVEN a block containing `findings:\t` or `findings: \t `
- WHEN `scalar(block, 'findings')` is called
- THEN it returns `null` in both cases

### Requirement: a trailing-space key line with an indented entry list parses through the BLOCK branch

When `scalar` answers `null` for a key line that is whitespace-only, callers
that read entry lists (`parseEntryList` in `parse-verdict.mjs`) MUST fall
through to the block-scan branch and read the indented entries under that
key, exactly as they do for a clean `key:` line with no trailing space.

#### Scenario: findings with trailing space and two entries

- GIVEN a fenced block containing `findings: ` (trailing space) followed by
  two indented `- id:` / `severity:` entries
- WHEN the block is parsed
- THEN the result has a `findings` array with exactly 2 entries
- AND `malformed` does NOT contain `'findings'`

### Requirement: the `#452/#478-F2` pin is rewritten, not deleted

The existing test `#452/#478-F2` in `parse-verdict.test.mjs` MUST be updated
in place to assert the repaired behavior (trailing-space key line with
entries now parses to those entries), keeping its `#452/#478-F2` identifier
and comment trail so the record of why the prior behavior existed is not
lost.

#### Scenario: F2 pin asserts the repair

- GIVEN the test named containing `#452/#478-F2` in `parse-verdict.test.mjs`
- WHEN the suite runs after the repair
- THEN the test passes and its assertion is that `findings: ` with entries
  now yields those entries (not `null`/absent)
- AND the test's comment still references `#452` and `#478-F2`

### Requirement: `brain-decision/1` governance admission never WIDENS, and narrows in exactly one named case

The repair to `scalar` MUST NOT make any `brain-decision/1` block admissible
under `actor-check.mjs`'s `lite` path (ADR-0026 Amendment 2, #473) that was
not admissible before. That direction is absolute: a block that starts being
admissible is a forged approval.

The other direction is **not** universal, and the carve-out is named here
rather than left in design prose. An **NBSP-led value** (`protocol:
<U+00A0>brain-decision/1`) WAS admissible before the repair — JS `.trim()`
strips U+00A0 while `\S` excludes it — and is silent after. That is a
narrowing, it is accepted, and it is the safe direction: a block that stops
being admissible costs a re-sign. It MUST be pinned by a test at the
governance layer, not only at `scalar`'s.

For the whitespace-only class, admission is unchanged in both directions. A
test MUST pin, for each of the six governance keys (`protocol`, `decision`,
`head_sha`, `actor`, `at`, `in_reply_to`), that a whitespace-only value
produces the identical admission/refusal outcome before and after the repair.

#### Scenario: gating keys stay refused when whitespace-only

- GIVEN a `brain-decision/1` block where `protocol`, `decision`, `head_sha`,
  or `actor` is present with a whitespace-only value
- WHEN `actor-check.mjs`'s `lite` path evaluates the block
- THEN the block is refused, identically before and after the repair

#### Scenario: audit-only keys stay non-gating when whitespace-only

- GIVEN a `brain-decision/1` block where `at` or `in_reply_to` is present
  with a whitespace-only value
- WHEN the block is evaluated
- THEN the field is omitted/audit-only in both cases and never affects
  admission, identically before and after the repair

### Requirement: `findings:` with a trailing space and no entries yields `[]`

An intended, pinned widening: a key line with a trailing space and NOTHING
indented under it MUST now answer the same as the byte-equivalent clean form
(`findings:` with no trailing space and no entries) — an empty array,
`[]` — because trailing whitespace is not significant in YAML and
consistency with the clean form is the standard.

#### Scenario: trailing space, no entries, end of block

- GIVEN a fenced block containing `findings: ` as the last line, with no
  entries under it
- WHEN the block is parsed
- THEN `findings` is `[]`
- AND `malformed` does NOT contain `'findings'`

### Requirement: all five consumers keep working

`scalar`'s repair MUST NOT break any of: `parse-verdict.mjs`,
`decision-block.mjs`, `epic-graph.mjs`, `actor-check.mjs`'s `lite` path, and
`checkpoint-block.mjs`'s `integerField`. Each MUST have a test for the
whitespace-only class after the repair.

#### Scenario: checkpoint-block integerField on whitespace-only value

- GIVEN a `brain-checkpoint/1` block where `counted_lines:` carries only a
  trailing space
- WHEN `integerField(content, 'counted_lines')` is called
- THEN it returns `{ ok: false, error: "... missing the required \`counted_lines:\` key." }`
  (the "missing key" message, since `scalar` now answers `null`)

#### Scenario: epic-graph track field on whitespace-only value

- GIVEN a hand-written graph block where `track:` carries only a trailing
  space
- WHEN the block is read
- THEN the track is treated as absent/unclassified, not as an empty-string
  group, and a test pins this outcome

#### Scenario: full suite passes with exactly one intentional change

- GIVEN the full test suite on this branch
- WHEN it is run before and after the repair
- THEN the only test whose assertion direction changes is `#452/#478-F2`,
  and it is rewritten (not deleted) per the requirement above
