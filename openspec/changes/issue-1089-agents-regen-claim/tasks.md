# Tasks: Antigravity `init()` Reports What It Could Not Read

## Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `init()` returns `{ missingDocs, agentsWritten, geminiWritten }`; `REGENERATE_HINT` exported | PR 1 (single PR) | Tests included; `antigravity.mjs` + `antigravity.test.mjs` |
| 2 | `brain-upgrade.mjs` words its regen message from the report | PR 1 (single PR) | Tests included; `brain-upgrade.mjs` + `brain-upgrade.test.mjs` |

## Phase 1: `init()` Return Shape (RED → GREEN)

- [x] 1.1 RED: in `antigravity.test.mjs`, extend test `2.1` to also assert
      `init()`'s resolved value equals `{ missingDocs: [], agentsWritten: true,
      geminiWritten: true }` on the all-readable, all-writable happy path.
- [x] 1.2 RED: add a test asserting that when `_readDoc` throws for
      `brain/core/methodology/sdd-layout.md` (reuse test `2.3`'s fixture),
      `init()` resolves with `missingDocs: ['brain/core/methodology/sdd-layout.md']`.
- [x] 1.3 RED: add a test asserting that when `_writeAgents` throws (reuse
      test `2.3`'s second fixture), `init()` resolves with `agentsWritten:
      false`, and still resolves (never throws).
- [x] 1.4 RED: add a test asserting that when `_writeGeminiSettings` throws,
      `init()` resolves with `geminiWritten: false`.
- [x] 1.5 RED: add a test asserting the resolved object has no `ok` property
      under any of the above, so `harness/cli.mjs:266`'s `r.ok === false`
      check never matches.
- [x] 1.6 GREEN: in `antigravity.mjs`'s `init()` (`:217-251`), accumulate
      `missingDocs` in the existing read-failure `catch` (`:229-234`), and set
      `agentsWritten`/`geminiWritten` booleans in the existing write
      try/catches (`:239-243`, `:245-250`). Return the three fields.
- [x] 1.7 GREEN: add `export` to `const REGENERATE_HINT` (`:63`).
- [x] 1.8 Update test `2.4` (end-to-end dispatch) to assert the resolved
      value's shape too, alongside its existing `scratchWrites`/`settingsWrites`
      assertions.

## Phase 2: `brain-upgrade.mjs` Wording (RED → GREEN)

- [x] 2.1 RED: in `brain-upgrade.test.mjs`, add
      `makeUpgradableConsumer()` call with no `brain/HOME.md` written (new
      variant or optional param), run `runBrainUpgrade`, and assert the output
      names `brain/HOME.md` as absent, points at
      `AGENT_PLATFORM=antigravity npm run brain:env:init`, and does NOT
      contain the byte-identical line "Regenerated AGENTS.md from YOUR
      brain/HOME.md (it is compiled, not shipped — see #397)."
- [x] 2.2 RED: extend the existing happy-path test (`:217-232`) with an exact
      `assert.match`/`includes` on the byte-identical success line, so a
      regression in the branching is caught even when the file exists.
- [x] 2.3 GREEN: in `brain-upgrade.mjs` (`:672-687`), import `REGENERATE_HINT`
      from `./harness/backends/antigravity.mjs`; capture `antigravityInit(...)`'s
      return into `report`; replace the unconditional `ok(...)` at `:680` with
      a branch: byte-identical line when `report.missingDocs.length === 0 &&
      report.agentsWritten`; a `brain/HOME.md`-naming message when
      `report.missingDocs.includes('brain/HOME.md')`; a generic
      missing-docs message otherwise; a write-failed message when
      `!report.agentsWritten`.
- [x] 2.4 Run `npm test` (full suite) and confirm the antigravity drift-guard
      (`antigravity.drift.test.mjs`) is still green — it calls `compileAgentsMd`
      directly and is unaffected, but confirm rather than assume.

## Phase 3: Sweep Confirmation

- [x] 3.1 Re-read `brain-upgrade.mjs` end to end and confirm no other
      `ok(...)` call follows a swallowed `catch` the way `:680` did — record
      the result in the PR description (already swept during design: only
      this one instance found).
- [x] 3.2 Confirm no test asserts the OLD unconditional wording as the only
      possible output (already verified during design — none do), so no
      pre-existing test needs deletion.

## Phase 4: Remediation (verify FAIL — closes coverage gap)

- [x] 4.1 RED/GREEN: extend `makeUpgradableConsumer` with an optional
      `missingMethodologyDocs` param (list of methodology doc slugs to leave
      unwritten), add a `brain-upgrade.test.mjs` case where `brain/HOME.md`
      IS present but a methodology doc is not, and assert the generic
      "compiled without N missing source doc(s)" wording appears, names the
      missing doc, the byte-identical success line is absent, and the
      `brain/HOME.md`-specific message is absent. Covers spec.md's "A
      different source doc is missing" scenario, which `tasks.md` Phase 2
      under-planned.
- [x] 4.2 Harden `antigravity.test.mjs` tests `1.2` and `1.3` (new, non-
      hermetic per the verify SUGGESTION) with an injected
      `_writeGeminiSettings: () => {}`, matching test `2.1`'s existing fix.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~90–130 (source) + ~90–130 (tests) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
- [x] 4.3 Cover the write-failure wording at the brain-upgrade level: a directory where `AGENTS.md` belongs makes the write fail for real (EISDIR). Red proven against `origin/main`'s unconditional line.
