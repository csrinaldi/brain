# Proposal: Antigravity `init()` Reports What It Could Not Read, So `brain-upgrade`'s Regen Claim Matches Reality

## Intent

`brain-upgrade.mjs:680` unconditionally prints "Regenerated AGENTS.md from YOUR
brain/HOME.md" after `antigravityInit()` resolves. But
`antigravity.mjs:217-235`'s `init()` swallows a per-doc read failure — it warns
and substitutes `''`, then compiles anyway (`init()` "never throws" by design,
issue #256). Measured live 2026-09-20 on a real consumer with no
`brain/HOME.md`: the run prints the read-failure warning, then the success
line naming the very file it could not read. The claim is false in the one
case it names. The same swallow-then-claim shape also covers a real
`writeAgents` failure inside `init()` (`antigravity.mjs:239-243`): the outer
`try/catch` in `brain-upgrade.mjs:672-687` can never fire, because `init()`
resolves normally either way — so a disk-write failure gets the same false
"Regenerated" line.

## Scope

### In Scope
- `init()` (`antigravity.mjs`) returns an additive report: which `SOURCE_DOCS`
  it could not read, and whether the `AGENTS.md` write itself succeeded.
- `brain-upgrade.mjs`'s post-regen message reads that report and words itself
  accordingly — byte-identical to today when nothing is missing and the write
  succeeded.
- Exporting `REGENERATE_HINT` so both files quote the same recovery command.
- Updated unit tests for the new return shape and the new wording branches.

### Out of Scope
- `.gemini/settings.json`'s write path: `brain-upgrade.mjs` neutralizes that
  seam (`_writeGeminiSettings: () => {}`), so it cannot fail there; the report
  field is added for symmetry but this caller never branches on it.
- i18n: `brain-upgrade.mjs` has zero `i18n/` imports today (verified — all
  output is raw English via local `ok/warn/info` helpers); adding i18n only to
  the lines this issue touches would be new, unrelated inconsistency.
- Making `init()` throw, or return `{ ok: false }`, on a missing doc or a
  write failure. That would flip the CLI dispatch path's exit code
  (`harness/cli.mjs:266-269` already treats `ok === false` as fatal) and the
  `env:init`/day-start self-heal path with it — a behavior change nobody asked
  for. `init()` keeps its "never throws" contract; only its return value grows.

## Capabilities

### New Capabilities
- `agents-md-regen-reporting`: `init()`'s additive read/write report, and the
  wording contract it gives `brain-upgrade.mjs` for its regeneration claim.

### Modified Capabilities
None — no existing `openspec/specs/` capability governs this behavior.

## Approach

Track, inside `init()`, which `SOURCE_DOCS` paths hit the existing
read-failure `catch` (`antigravity.mjs:229-234`) and whether `writeAgents`
succeeded (`:239-243`). Return `{ missingDocs, agentsWritten, geminiWritten }`.
`brain-upgrade.mjs:679-680` captures that value and picks one of four
messages: byte-identical success, "AGENTS.md compiled from methodology only —
brain/HOME.md missing" (naming `AGENT_PLATFORM=antigravity npm run
brain:env:init` as the fix), "N other source doc(s) missing", or "the write
itself failed". Existing callers that discard the return (today, both of
them) are unaffected — nothing about the resolved value's absence changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `brain/scripts/harness/backends/antigravity.mjs` | Modified | `init()` returns a report; `REGENERATE_HINT` exported |
| `brain/scripts/brain-upgrade.mjs` | Modified | Regen message branches on the report |
| `brain/scripts/harness/backends/antigravity.test.mjs` | Modified | Assert new return shape |
| `brain/scripts/brain-upgrade.test.mjs` | Modified | Assert new wording branches + byte-identical happy path |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A test pins the old unconditional success wording | Low (searched — none do) | Verified via grep before writing |
| Return-shape change breaks a caller checking truthiness | Low | Object is still truthy; no caller checks `=== undefined` |

## Rollback Plan

Revert the two source files and their tests in one commit; `init()`'s
external contract (writes `AGENTS.md` + `.gemini/settings.json`, never
throws) is unchanged, so no other caller needs a follow-up revert.

## Dependencies

None.

## Success Criteria

- [ ] A consumer missing `brain/HOME.md` sees a message naming that file, not
      a false "Regenerated ... from YOUR brain/HOME.md" claim.
- [ ] A consumer with all 5 source docs present and a successful write sees
      byte-identical wording to today.
- [ ] `npm test` passes, including the new assertions.
