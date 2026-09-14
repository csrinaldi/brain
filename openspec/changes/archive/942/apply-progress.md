# Apply progress — issue #942: a deny list that cannot be read is not an empty deny list

Worktree: `brain-issue-942`, branch `fix/issue-942-deny-fail-closed`, base `8ec69885`.
Mode: **Strict TDD** (`node --test <file>` focused, `npm test` full before declaring done).
Delivery: single-pr (decided) — no chained/stacked PR split needed (counted diff well under budget).

## Status

32/32 tasks complete. `npm test`: **5267/5267 green**. Ready for verify.

## Commits (7, in order)

| Commit | Work unit | What |
|---|---|---|
| `1f89c453` | 1 | `feat(config)`: `loadBrainConfigOrThrow` in `lib/brain-config.mjs` (D1) |
| `eab44d60` | 2 | `fix(vcs)`: `actor-check.mjs`'s `defaultReadDenyActors` fails closed |
| `78a13391` | 3 | `fix(vcs)`: `brain-writes-reviewed.mjs`'s two deny readers + tier-aware catch + docstring correction |
| `72ef30bb` | 4 | `fix(approve)`: `approve/cli.mjs`'s two deny readers + call-site refusal wrap |
| `270b71cf` | fixup | `test(vcs)`: isolate T6 from an ambient git failure discovered during Phase 5 mutation-guard verification |
| `14c68caf` | 6 | `docs(brain)`: R2 doctrine draft for maintainer promotion |
| `44e65db8` | 7 | `docs(memory)`: closing record, `Closes #942` |

(Phase 5 — mutation guard — was verification-only, no commit, per tasks.md 5.1.)

## Diff totals

- `git diff --stat origin/main...HEAD | tail -1`: **11 files changed, 491 insertions(+), 61 deletions(-)**
- Counted diff (excludes `**/*.test.mjs`, `openspec/changes/**`, `.memory/**` — matches
  `brain.config.json`'s `governance.ignoreList` exactly, `vcs/diff-size-count.mjs`'s own filter):
  **4 files changed, 182 insertions(+), 55 deletions(-) = 237 counted lines.**
  Well inside the 400-line budget (tasks.md forecast: Low risk). Higher than the tasks.md
  estimate (~128) — see Deviations below.

## TDD Cycle Evidence

| Task / Test | RED | GREEN | REFACTOR | Notes |
|---|---|---|---|---|
| T1 `loadBrainConfigOrThrow` absent→`{}` | ✅ (`ERR_MODULE`, export missing) | ✅ | — | |
| T2 malformed→throws "could not be parsed" | ✅ | ✅ | — | |
| T3 dir-in-place→throws "could not be read" | ✅ | ✅ | — | |
| T4 actor-check unparseable→fail | ✅ (`'warn' !== 'fail'`) | ✅ | — | reworded catch reason strings (D4.1) |
| T5 actor-check absent→not fail, deny empty | pre-existing green (no behavior change expected) | ✅ | — | negative control |
| T6 brain-writes-reviewed unparseable→fail not warn | ✅ (`'warn' !== 'fail'`) | ✅ | ✅ (T6 isolation fixup, see Deviations) | |
| T7 brain-writes-reviewed absent→botAllowlist:[] | pre-existing green | ✅ | — | negative control |
| T8 forced detection-tier→warn arm reachable | ✅ (`did not match /detection-tier/`) | ✅ | — | required an injectable `resolveGatePolicy` override (see Deviations) |
| T9 approve/cli `defaultReadDenyActors` unparseable→throws | ✅ (export missing) | ✅ | — | |
| T10 approve/cli `defaultReadDenyActors` absent→`[]` | ✅ (export missing) | ✅ | — | |
| T9b/T10b `defaultReadAgentActors` (same shape) | ✅ | ✅ | — | |
| T11 `runApprove` readDenyActorsFn throws→exit 1, `/^✗/m`, no reject, 0 posts | pre-existing green (call site already guarded pattern existed for whoami) | ✅ | — | |
| T12 mutation guard (Phase 5) | n/a (verification, not TDD) | n/a | — | see below |

### Phase 5 mutation guard — verified by hand, no commit

- **actor-check.mjs**: reverted `defaultReadDenyActors` to `catch { return []; }` → T4 went red
  (`'fail' !== ...`, warn returned). Reverted the mutation; T4 green again.
- **brain-writes-reviewed.mjs**: reverting `defaultReadBotAllowlist` ALONE did **not** turn T6 red
  — the sibling reader `defaultReadApprovalActors` (also hardened, D3) still propagated the same
  failure, masking the mutation. Reverting **both** readers together still did not turn T6 red
  as originally written — the test ran in a non-git `testTmp()` dir with no `diffNameOnly`
  injected, so `defaultDiffNameOnly`'s real `git diff` call threw its own "not a repository"
  error, which the same tier-aware catch turns into an identical `fail` verdict, masking the
  reader regression entirely. **Fixed** by injecting a clean `diffNameOnly`/`fetchReviews` into
  T6 (commit `270b71cf`) so the only possible failure is the config reader; re-verified: reverting
  both readers now turns T6 red (`'pass' !== 'fail'`), confirming the fix.
- **approve/cli.mjs**: reverted `defaultReadDenyActors` to swallow → T9 went red (`Missing
  expected exception`). T11 (which injects its own `readDenyActorsFn`) was unaffected, as
  expected — it does not exercise the default reader. Reverted the mutation; T9 green again.

## Files changed

| File | Action | What |
|---|---|---|
| `brain/scripts/lib/brain-config.mjs` | Modified | New `loadBrainConfigOrThrow(root)` export (D1); `loadBrainConfig()` untouched (R8) |
| `brain/scripts/lib/brain-config.test.mjs` | Modified | T1–T3 |
| `brain/scripts/vcs/actor-check.mjs` | Modified | `defaultReadDenyActors` hardened; `runActorCheck` catch reason reworded (D4.1) |
| `brain/scripts/vcs/actor-check.test.mjs` | Modified | T4–T5 |
| `brain/scripts/vcs/brain-writes-reviewed.mjs` | Modified | `defaultReadBotAllowlist`/`defaultReadApprovalActors` hardened; catch made tier-aware via a locally duplicated `resolveTierForFailure`; stale "detection-only" docstring corrected (R7) |
| `brain/scripts/vcs/brain-writes-reviewed.test.mjs` | Modified | T6–T8, plus one pre-existing test updated (see Deviations) and the T6 isolation fixup |
| `brain/scripts/approve/cli.mjs` | Modified | `defaultReadDenyActors`/`defaultReadAgentActors` gain optional `root`, exported, hardened; call site wrapped in try/catch (D4.3) |
| `brain/scripts/approve/cli.test.mjs` | Modified | T9–T11 (plus T9b/T10b for the agent-actors twin) |
| `openspec/changes/issue-942-deny-fail-closed/brain-drafts/deny-readers-fail-closed.draft.md` | New | R2 doctrine draft |
| `.memory/records/2026-09-rec-0dc0cba56156e57c.jsonl`, `.memory/index.jsonl` | New / Modified | Closing record |
| `openspec/changes/issue-942-deny-fail-closed/tasks.md` | Modified | All 32 tasks marked `[x]` |

## Deviations from design

1. **Counted diff (237) exceeds the tasks.md estimate (~128).** The three hardened-reader
   commits carry substantially more inline documentation than the estimate assumed — matching
   this codebase's existing convention of load-bearing docblocks on every reader (every
   surrounding function in these three files already carries multi-paragraph rationale
   comments; a one-line reader with no comment would be inconsistent with the file, not
   minimal). Still 237 < 400 (Low risk unchanged); no chained/stacked PR split triggered.
2. **`resolveGatePolicy` made deps-injectable in `brain-writes-reviewed.mjs`'s catch** (`deps.resolveGatePolicy ?? resolveGatePolicy`), not shown in design.md's D4 code sample.
   Required to drive T8 ("the `warn` arm is reachable") at all: `brain-writes-reviewed` is
   `required` at every real tier in `GATE_MATRIX` today, so no live tier value reaches the
   `warn` branch — mirrors this file's own pre-existing pattern (every other I/O call —
   `readBotAllowlist`, `readConfig`, `fetchReviews`, `diffNameOnly` — is already
   deps-injectable). Production default is unchanged (`resolveGatePolicy`, the real imported
   function); zero behavior change on any real call site.
3. **One pre-existing test updated**, not newly added: `brain-writes-reviewed.test.mjs`'s
   `"gh api failure inside the wrapper → warn + pass, never throws"` pinned the OLD unconditional-
   warn behavior the catch is being fixed to *not* have (R6's explicit target: "a throwing deny
   reader behind an unconditional warn is cosmetic — the fail-open survives the fix"). Updated
   to assert `fail` at the `standard` tier, matching `actor-check.mjs`'s pre-existing discipline
   for the same failure class. This is the ratified behavior change (R6, R7), not a deviation
   from it.
4. **T6 test isolation fixup** (see Phase 5 mutation guard above) — a legitimate correction to
   a test committed in Phase 3, found during Phase 5's own required verification step. Committed
   separately (`270b71cf`) for a clean, reviewable diff.

No deviation from R1–R12, no deviation from D1–D8, and no `brain/core/**`/`brain/project/**`
edit. `defaultReadApprovalActors`'s hardening is in-scope (D3) but behaviorally unobservable in
production, as design predicted — not presented as carrying the fix.

## Issues found

None.

## Review response batch (fresh adversarial review, post-32/32)

Answers a second, fresh adversarial review of this fix. New commits `af425cd5`, `bea5eedd`
on top of the 7 already recorded above (still on `fix/issue-942-deny-fail-closed`, worktree
`brain-issue-942`). Strict TDD throughout.

### F1 (HIGH) — T6 was guarded only transitively, not isolated — FIXED

Confirmed the reviewer's measurement: with the 270b71cf fixup alone (diffNameOnly/fetchReviews
injected), reverting `defaultReadBotAllowlist` (`:257-262`, the DENY reader R6/R7 exist for)
back to `catch { return [] }` left T6 green (47/47) — the sibling ALLOW reader
`defaultReadApprovalActors` (`:282-287`) throws on the same malformed config right after
`readBotAllowlist` runs (`:392-393`), producing the identical `fail` verdict and masking the
regression.

Fix: injected `readOverrideActors: () => []` and `readConfig: () => ({})` into T6
(`brain-writes-reviewed.test.mjs`), with a comment naming why all four deps are pinned.
Commit `af425cd5`.

**Isolation proof (mutation guard, re-run after the fix):**
- Reverted ONLY `defaultReadBotAllowlist` (`:257-262`) to `catch { return []; }`.
  `node --test vcs/brain-writes-reviewed.test.mjs` → **46/47, T6 RED**
  (`AssertionError: 'pass' !== 'fail'`, `expected: 'fail'`, `actual: 'pass'`).
- Reverted the mutation. Re-ran → **47/48 → 47/47 GREEN** (T13 didn't exist yet at that point
  in the sequence; both proof runs were against the T6-isolation-only state).

**T9/T9b (approve/cli.mjs) checked, found already genuinely isolated — no change needed.**
Both call `defaultReadDenyActors(dir)`/`defaultReadAgentActors(dir)` DIRECTLY as standalone
unit tests (`approve/cli.test.mjs:315-342`) — no wrapper, no sibling reader in the call path,
so there is nothing for a sibling to mask. T4 (`actor-check.test.mjs:2468`) independently
re-confirmed genuinely isolated for the same reason the reviewer gave (sibling readers there
still swallow, so only `defaultReadDenyActors`'s own throw can produce the `fail`).

### F2 (LOW) — resolveTierForFailure's never-throws contract had a real hole — FIXED

Confirmed via RED test before fixing: `deps.tier` was returned unvalidated
(`if (deps.tier) return deps.tier;`), and the caller's `resolveGatePolicy(gate, tier)`
(`:468`, OUTSIDE `resolveTierForFailure`'s own try) throws for a tier with no matrix cell —
escaping uncaught. Added T13, ran RED first:
`runBrainWritesReviewedCheck must never throw: governance-tiers: gate "brain-writes-reviewed"
has no matrix cell for tier "bogus-tier"` (48 tests, 1 failing).

**Choice**: made the helper genuinely never-throwing (did NOT just correct the docstring).
Reason: `resolveTierForFailure` runs INSIDE a catch that is already handling a prior failure —
correcting only the docstring would leave `runBrainWritesReviewedCheck` able to throw from
inside its own catch block, which is a worse contract for a function whose entire purpose is
"attribute a failure to a tier without ever failing itself." Validated `deps.tier` against
the imported `TIERS` set before trusting it; an invalid value now falls through to the
existing config-based resolution path (and its catch), mirroring how `resolveTier()` already
fail-closes to `'standard'` for an unrecognized `governance.tier` read from disk. Re-ran → GREEN
(48/48). Commit `bea5eedd`.

`actor-check.mjs:1181` carries the IDENTICAL pre-existing hazard (unvalidated `deps.tier` fed
to `resolveGatePolicy` outside its own try). Left untouched per explicit scope — filed as a
separate pre-existing issue, not fixed here, and noted in the commit message so it isn't lost.

### F3 (trivial) — stale line references — FIXED

In `brain-writes-reviewed.mjs`'s docstrings: `:354` → `:392` (readBotAllowlist call site),
`:407-415` → `:458-476` (tier-aware catch), and `:358` → `:396` (`overrideLabelPresent`,
found stale in the same block while fixing the other two, same commit).

### Out of scope (explicitly, not touched)

- `actor-check.mjs`/`approve/cli.mjs` read/write root asymmetry — pre-existing, filed
  separately by the reviewer.
- Rebase onto current `origin/main` — left to the maintainer before push (branch still 8
  ahead / 1 behind `origin/main` at the time of this batch; no push/PR/gh performed here).
- `.memory/index.jsonl`/`.memory/manifest.json` and the record commit `44e65db8` — untouched,
  as instructed.

### Test counts after this batch

- Focused (`lib/brain-config.test.mjs` + `vcs/actor-check.test.mjs` +
  `vcs/brain-writes-reviewed.test.mjs` + `approve/cli.test.mjs`): **256/256 pass**.
- Full `npm test`: **5268/5268 pass** (5267 baseline + T13).

### Status (updated)

34/34 tasks + 2 review-response commits complete. Working tree clean. Ready for verify.
No `brain/core/**`/`brain/project/**` edit; no push/PR/`gh`/`--force`/`--no-verify`/
merge/rebase performed.
