# Apply progress — issue #975

## Mode
Strict TDD — `GIT_CONFIG_GLOBAL=/dev/null npm test` (node --test).

## Completed tasks
- [x] 1.1 RED tests `T4`-`T7` — `loadBrainConfigOrThrow` throws on `null`/`[]`/`42`/`"x"`
- [x] 1.2 RED regression pins `T8`-`T9` — absent config / valid object unchanged (both passed immediately — genuinely unchanged behaviour, not new RED)
- [x] 1.3 RED fixture test — `brain-audit.mjs` fails closed on a non-object config
- [x] 1.4 RED tests — `approve/cli.mjs`'s real `defaultReadDenyActors`/`defaultReadAgentActors`, plus a `runApprove` fixture test wiring the real reader
- [x] 1.5 Confirmed RED against unmodified `brain-config.mjs` (below)
- [x] 2.1 GREEN — `isPlainObject`/`describeJsonType` helpers + shape check added to `loadBrainConfigOrThrow`
- [x] 2.2 Confirmed GREEN (below)
- [x] 3.1 Every `loadBrainConfigOrThrow` call site listed (10, not the issue's non-exhaustive 6) — table below, mirrors `proposal.md`
- [x] 3.2 `loadBrainConfig()` classified — 17 call sites, none DENY-direction, decision: leave unchanged — table below, mirrors `proposal.md`
- [x] 3.3 Doctrine draft written (`brain-drafts/loader-shape-gap-closed.draft.md`), anchored on the doctrine paragraph text as `gh pr diff 980` shows it landing
- [x] 3.4 Draft proven: parses; `assessEdit` against the REAL current (pre-#980) file returns `blocked` (anchor not found, ordering-safe); against a simulated post-#980 file (built by applying #980's own diff in memory, never written to disk) returns `pending`
- [x] 4.1 Mutation table (below)
- [x] 4.2 Full suite run, both post-revert and post-restore (below)
- [x] 4.3 Production diff counted against `governance.ignoreList`; repo tier confirmed `lite`, budget 1000 (below)
- [x] 5.1 Commit test+fix (commit SHA recorded below, filled in by the follow-up commit per the `#962` precedent — `git log` shows that batch used a fourth, small "mark tasks complete" commit to record its own record-first commit's SHA, since a commit cannot cite the SHA of a commit that does not exist yet)
- [x] 5.2 Commit SDD docs + doctrine draft (SHA recorded below)
- [x] 5.3 Record-first commit (SHA + record ID recorded below)

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| `loadBrainConfigOrThrow` throws on a non-object parsed value | `brain-config.test.mjs` — `T4`-`T7` added; ran against unmodified `brain-config.mjs`: all 4 fail ("Missing expected exception") | Added `isPlainObject`/`describeJsonType` + the shape-check throw; `T4`-`T9` all pass; full `brain-config.test.mjs` 25/25 pass | None needed — the two helpers are pure and already minimal; JSDoc on both exports updated to document the third failure kind |
| `brain-audit.mjs`'s `loadConfig` fails closed on a non-object config | `brain-audit.test.mjs` — 1 new fixture test added; ran against unmodified loader: fails ("must not read as a clean release gate") | No `brain-audit.mjs` change needed — `loadConfig` already delegates to `loadBrainConfigOrThrow` (#962); the new test passes once the loader itself is fixed; full `brain-audit.test.mjs` 56/56 pass | None — this call site required zero production changes, confirming the fix is isolated to the shared primitive |
| `approve/cli.mjs`'s `defaultReadDenyActors`/`defaultReadAgentActors` fail closed on a non-object config | `cli.test.mjs` — 3 new tests added (2 direct + 1 `runApprove` fixture wiring the real reader); ran against unmodified loader: all 3 fail | No `approve/cli.mjs` change needed — same transitive protection; full `cli.test.mjs` 33/33 pass | None |

## Files changed

| File | Action | What was done |
|---|---|---|
| `brain/scripts/lib/brain-config.mjs` | Modified | Added `isPlainObject`/`describeJsonType` helpers and a shape check inside `loadBrainConfigOrThrow`: after `JSON.parse` succeeds, throws `brain.config.json at <path> must contain a JSON object, got <type>` when the result is `null`, an array, or a primitive. `ENOENT` still returns `{}`; a valid object is still returned unchanged. Extended both exports' JSDoc. `loadBrainConfig()`'s body is untouched; its doc comment gained a classification note. +69/-5 lines. |
| `brain/scripts/lib/brain-config.test.mjs` | Modified | Added `T4`-`T9`: shape-check throws for `null`/`[]`/`42`/`"x"`, plus unchanged-case regression pins (absence, valid object). |
| `brain/scripts/brain-audit.test.mjs` | Modified | Added `#975: a non-object brain.config.json ([]) fails the release gate closed…` — drives the real CLI via `spawnSync` against a temp git repo, mirroring the `#962` test's genuinely-empty-range technique so no sibling reader ever runs. |
| `brain/scripts/approve/cli.test.mjs` | Modified | Added three `#975` tests: two direct calls to the real `defaultReadDenyActors`/`defaultReadAgentActors` against a fixture dir, and one `runApprove` fixture test that wires the real `defaultReadDenyActors` (not a stub) — the real entry point, not the loader alone. |
| `openspec/changes/issue-975-config-shape/proposal.md` | Created | Intent, scope, acceptance criteria, the fix, the full 10-call-site table, the `loadBrainConfig()` classification table and decision, the doctrine-draft summary. |
| `openspec/changes/issue-975-config-shape/spec.md` | Created | Delta requirements (WHEN/THEN scenarios) — required by the repo's `lite`-tier `check-refs` gate on every active change dir. |
| `openspec/changes/issue-975-config-shape/tasks.md` | Created | Task breakdown, Review Workload Forecast (Low risk, single PR, budget 1000 not 400). |
| `openspec/changes/issue-975-config-shape/apply-progress.md` | Created | This file. |
| `openspec/changes/issue-975-config-shape/brain-drafts/loader-shape-gap-closed.draft.md` | Created | Tier 2 `brain-amendment/1` DRAFT ONLY (never promoted) — see below. |

## Every `loadBrainConfigOrThrow` call site — key, direction, proof

(Full narrative in `proposal.md`; mirrored here.)

| # | File:Line | Reader | Key | Direction | Proven how |
|---|---|---|---|---|---|
| 1 | `approve/cli.mjs:124` | `defaultReadDenyActors` | `governance.reviewActors ∪ governance.agentActors` | DENY | Direct — unit test + `runApprove` entry-point test |
| 2 | `approve/cli.mjs:139` | `defaultReadAgentActors` | `governance.agentActors` | DENY | Direct — unit test |
| 3 | `vcs/actor-check.mjs:1109` | `defaultReadDenyActors` | `governance.reviewActors ∪ governance.agentActors` | DENY | Transitive (same shared loader; loader-level `T4`-`T9`) |
| 4 | `vcs/brain-writes-reviewed.mjs:259` | `defaultReadBotAllowlist` | `governance.reviewActors` | DENY | Transitive |
| 5 | `vcs/brain-writes-reviewed.mjs:284` | `defaultReadApprovalActors` | `governance.approvalActors` | ALLOW (hardened anyway, #942 D3) | Transitive |
| 6 | `brain-audit.mjs:181` | `loadConfig` | `governance.reviewActors` | DENY | Direct — `spawnSync` fixture test against the real CLI |
| 7 | `governance/lane-scrub.mjs:70` | `defaultReadConfig` | `governance.memorySecretPatterns`/`memorySecretAllowPatterns` | Mixed, DENY-dominant | Transitive |
| 8 | `memory/backends/engram.mjs:458` | `_defaultLoadBrainConfig` | same mixed pair | Mixed, DENY-dominant | Transitive |
| 9 | `memory/backends/plainfiles.mjs:50` | `_defaultLoadBrainConfig` | same mixed pair | Mixed, DENY-dominant | Transitive |
| 10 | `memory/lane/collect.mjs:101` | `_defaultLoadConfig` | same mixed pair | Mixed, DENY-dominant | Transitive |

Measured via `rg -n "loadBrainConfigOrThrow\(" brain/scripts` against
`origin/main` at `dd3ace05`: **10 call sites across 8 files** — the issue's
own evidence section names 6 across 5 files and does not claim to be
exhaustive (same disclaimer #976/PR #980 used for its own roster). All 10
are protected by the one shared primitive; only #1 and #6 are independently
re-driven through their real entry points, per the acceptance criteria's
explicit minimum ("at least `brain-audit.mjs` and `approve/cli.mjs`").

## `loadBrainConfig()` classification (Expected item 3)

Full 17-row caller table in `proposal.md`. Summary: no caller reads a
DENY/exclusion identity list (`governance.reviewActors`/`agentActors`/
`approvalActors` — all three are read exclusively through
`loadBrainConfigOrThrow`'s ten call sites above, never through
`loadBrainConfig()`). `governance/run-check.mjs:172-178` and
`vcs/phase-order-check.mjs:487-493` already wrap the call in
`try { … } catch { return {}; }`; `i18n/t.mjs:18` wraps it in its own
`try/catch`; `governance/approved-label.mjs` degrades to a ratified constant
on its own guarded path; `review/evaluators/tranche.mjs`'s
`governance.ignoreList` and `vcs/governance-tiers.mjs`'s `resolveTier` are
already-established ALLOW/exemption and fixed-fallback readers per the
doctrine. **Decision: `loadBrainConfig()` is left unchanged** — a shape
check would only change one observable case (a top-level `null` stops
crashing with an unguarded `TypeError` on the caller's first `.` access;
every other rejected shape already degrades silently the same way it does
today), which is a clearer-crash improvement, not a fail-open fix. This
extends #942's R8 ("`loadBrainConfig()` keeps throwing on absence and
malformation, unchanged") to cover shape as well.

## Doctrine draft (Tier 2, draft only)

`brain-drafts/loader-shape-gap-closed.draft.md` — a `brain-amendment/1` draft
targeting `brain/core/anti-patterns/evidence-reader-empty-on-failure.md`,
anchored on the "Applied at" paragraph text AS IT WILL STAND after PR #980
(issue #976) merges — **#980 is still OPEN** at the time of this change
(verified via `gh pr view 980`). #980's own PR description names this exact
gap: "`loadBrainConfigOrThrow` still accepts JSON that parses but is not an
object … That is #975, open and approved" — a "known gap, not closed here"
framing that becomes stale once #975 lands. The draft appends one sentence
to the promoted paragraph recording the closure, without touching anything
#980 itself changes.

Proof (throwaway script, never touches the target file, never invokes
`brain:promote`):

```
$ node /tmp/claude-1000/-home-gandalf-IA-brain/71e1249b-9491-4e33-857a-096458f6eeb2/scratchpad/sim-roster-975.mjs
parse: ok
contract: {
  "target": "brain/core/anti-patterns/evidence-reader-empty-on-failure.md",
  "isAdr": false,
  "adrNumber": null,
  "slug": null,
  "amendment": null,
  "issue": "975",
  "homeSummary": null,
  "bodyHeading": null,
  "bodyEndHeading": null
}
edits count: 1
pre-#980 edit 1: {"state":"blocked","f":0,"r":0,"k":1,"free":0}
post-#980 (simulated) edit 1: {"state":"pending","f":1,"r":0,"k":1,"free":1}
OK: draft parses; anchor is NOT FOUND against the real pre-#980 file (safe ordering); anchor IS pending against the simulated post-#980 file.
```

Against the REAL current file (still pre-#980 on this branch, forked from
`origin/main` at `dd3ace05`), the edit is `blocked` (`f:0`, find-count zero)
— the draft's anchor genuinely does not exist yet, so promoting it now would
be a safe no-op refusal, never a corruption. The "post-#980 (simulated)"
text was built by applying #980's own diff (read verbatim via
`gh pr diff 980`, not paraphrased) to the real current file in memory only
— never written to disk — and against THAT text the edit assesses
`pending` (`f:1`, `r:0`, `free:1`): found exactly once, the replacement text
not already present. The script imports `parseAmendmentDraft`/`assessEdit`
directly from the real `brain/scripts/lib/amendment-draft.mjs`. `brain:promote`
was never invoked.

## Mutation table

| Mutation | Command | Result |
|---|---|---|
| Baseline (fix applied) — `brain-config.test.mjs` only | `node --test brain/scripts/lib/brain-config.test.mjs` | 25/25 pass |
| Baseline (fix applied) — `approve/cli.test.mjs` only | `node --test brain/scripts/approve/cli.test.mjs` | 33/33 pass |
| Baseline (fix applied) — `brain-audit.test.mjs` only | `node --test brain/scripts/brain-audit.test.mjs` | 56/56 pass |
| Baseline (fix applied) — full suite | `GIT_CONFIG_GLOBAL=/dev/null npm test` | **5371 pass / 0 fail** |
| Revert the shape check only (`git stash push -- brain/scripts/lib/brain-config.mjs`), test files untouched — full suite | `GIT_CONFIG_GLOBAL=/dev/null npm test` | **5363 pass / 8 fail** — exactly `T4`-`T7` (`brain-config.test.mjs`), the 3 new `#975` tests in `cli.test.mjs`, and the 1 new `#975` test in `brain-audit.test.mjs`; nothing else in the 5371-test suite is affected |
| Restore fix (`git stash pop`) — full suite | `GIT_CONFIG_GLOBAL=/dev/null npm test` | 5371/5371 pass (confirmed twice, before and after the mutation run) |

Failing-test list under the mutation, captured directly (`rg "^not ok"` on
the `npm test` output):

```
not ok - #975: defaultReadDenyActors(tmpDir) — non-object brain.config.json ([]) → throws, names the type
not ok - #975: defaultReadAgentActors(tmpDir) — non-object brain.config.json (null) → throws, names the type
not ok - #975: runApprove refuses closed when the REAL defaultReadDenyActors hits a non-object config — the real entry point, not the loader alone
not ok - #975: a non-object brain.config.json ([]) fails the release gate closed, naming the type found
not ok - T4: loadBrainConfigOrThrow — brain.config.json is `null` → throws, names the path and "got null"
not ok - T5: loadBrainConfigOrThrow — brain.config.json is `[]` → throws "got array"
not ok - T6: loadBrainConfigOrThrow — brain.config.json is `42` → throws "got number"
not ok - T7: loadBrainConfigOrThrow — brain.config.json is `"x"` → throws "got string"
```

Exactly the 8 new tests, in both directions, isolating the mutation cleanly.

## Production line count

`git diff --stat -- brain/scripts/lib/brain-config.mjs`: **69
insertions(+), 5 deletions(-)**, 74 changed lines. Tests
(`brain-config.test.mjs`, `brain-audit.test.mjs`, `cli.test.mjs`) and
`openspec/**` are excluded from the counted production surface per
`brain.config.json`'s `governance.ignoreList` (`**/*.test.mjs`,
`openspec/changes/**`). The repo's `governance.tier` is `lite`
(`brain.config.json:17`), whose review budget is **1000** changed lines, not
the generic 400 — 74 is well under it. Single PR, no chaining needed.

## Deviations from design
None — the fix matches the issue's "Expected" section verbatim: the error
message text (`brain.config.json at <path> must contain a JSON object, got
<type>`), the ENOENT/valid-object unchanged cases, and the two named
DENY-direction callers proven at their real entry points.

## Issues found
None beyond the pre-existing count mismatch already addressed: the issue's
own evidence section names 6 call sites (not exhaustive, no claim otherwise)
and this change's orchestrator prompt separately estimated "nine callers" —
neither matches the measured 10; `proposal.md` and this file record the
measured count with the `rg` command used, rather than repeating either
estimate.

## Sweep result (stale/false statements, pre-commit)

`rg` across this change folder and every touched file for "pending", "not
yet", "will", stated line numbers, stated counts, and bare `memory:<verb>`
names:

- `brain-audit.test.mjs:227,350,1253,1287` — pre-existing lines, not touched
  by this change (test-fixture narrative comments predating #975, e.g.
  "will be merged before the baseline tag"). Left as-is: out of scope, and
  rewriting untouched historical test comments is not this change's job.
- `proposal.md`/`tasks.md`/this file: "as it will stand after PR #980
  merges" — accurate conditional language about a verified-OPEN external
  PR (`gh pr view 980` confirms `"state":"OPEN"` as of this session), not a
  stale claim about this change's own status. The throwaway script proves
  the draft's anchor does NOT match the current file, so the "will" is
  honest, not aspirational.
- `loader-shape-gap-closed.draft.md:3` — "Not yet promoted." — true at the
  time of this commit (mirrors the `#962` draft's identical wording), and
  stays true until a human runs `brain:promote`, which this change never
  does.
- No bare `memory:<verb>` script name found — the one reference
  (`tasks.md:41`) already carries the `brain:` prefix (#961/#963).
- All stated line numbers were re-verified against the current file state
  with `rg -n` immediately before this sweep (not carried over from an
  earlier draft of this file).
- All stated counts (25/25, 33/33, 56/56, 5371/5371, 5363/5371, 74 changed
  lines) were captured from the actual command output in this session, not
  computed by hand.

## Risks
- The doctrine draft (`brain-drafts/loader-shape-gap-closed.draft.md`) is
  UNAPPLIED and cannot be safely promoted until PR #980 merges (proven
  above — its anchor does not exist in the current file). Left for a human
  decision after #980 lands, per the hard constraint never to run
  `brain:promote` and never to edit `brain/core/**` directly.
- `loadBrainConfig()` is left unchanged by design (see classification
  above); if a future caller of `loadBrainConfig()` ever reads a
  DENY/exclusion list, this decision should be revisited.

## Remaining tasks
None. All 20 tasks complete.

## Status
20/20 tasks complete. Commits: `4db97ac2` (test+fix), `646e80bb` (SDD docs +
doctrine draft), `9f7a8438` (record-first commit, record
`rec-126c024bef05133d`), and this follow-up commit recording all three SHAs
— mirroring the `#962` precedent (`git log` shows that batch used a fourth
commit for the same reason: a commit cannot cite the SHA of a commit that
does not exist yet). Ready for `sdd-verify`.
