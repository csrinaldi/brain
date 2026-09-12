---
status: draft
issue: 712
base: bef6f867
---

# Design — a secret policy that cannot be read is not the default secret policy

Line numbers re-verified against `bef6f867` in worktree `brain-issue-712b`.

## Technical approach

Four module-local readers each own a `catch { return {} }`. Each becomes a call to the primitive
#942 shipped — `loadBrainConfigOrThrow(root)` (`lib/brain-config.mjs:77`) — with **no catch**.
ENOENT still returns `{}` (R12); every other read/parse failure throws a message naming the path and
the failure kind. The refusal is then whatever each call site's **existing** error path already does.
No new primitive (R3), no new i18n key (R10), no new CI context, no config schema change.

This mirrors #942's shape exactly: reader propagates, call site refuses, the reader never decides the
remediation.

```
brain.config.json ──┬─ ENOENT ──────────────→ {} → DEFAULT_SECRET_PATTERNS → op proceeds (R12)
                    └─ present, unreadable ─→ throw ──┬→ cli.mjs:839  → exit 1  (memory:save)
                                                      ├→ cli.mjs:364  → exit 1  (memory:collect)
                                                      ├→ cli.mjs:518  → exit 1  (memory:ship)
                                                      └→ lane-scrub main() → uncomputable → exit 2
```

## Architecture decisions

### D1 — Propagate through the reader; the existing catch arms carry the message

**Choice**: the three `memory/` readers throw; `cli.mjs`'s three catch arms surface
`err.message` through the keys they already use (`memory.collect.failed`, `memory.ship.failed`, the
`${BACKEND}.save() failed — ` literal at `:856`).
**Rejected**: tagging the error (`err.configUnreadable`) and adding a named arm + i18n key, the shape
`raced`/`badHost` use.
**Rationale**: R10 — `activeLang()` resolves the locale from the config that is unreadable, so any
`es.mjs` twin is dead by construction until #715, and `i18n/coverage.test.mjs:96-103` forces the twin
to exist. The primitive's message already names the file, the path and the parse offset, which is the
whole diagnostic value the tag would have added.

### D2 — `lane-scrub` gets its OWN try/catch, not the existing compile one

**Choice**: a new try/catch wrapping `readConfig()` alone, placed **between** the
`recordPaths.length === 0` early return (`lane-scrub.mjs:142-147`) and the pattern-compile block
(`:161-173`), with its own reason string.
**Rejected**: (a) extending the compile block's try to cover the read; (b) moving the read above the
early return.
**Rationale**: (a) PR #907's cold review split those two failures apart on purpose — "a config
problem and a read problem are both UNCOMPUTABLE (2), but they are different failures and must report
different reasons" (`:151-158`). Folding the read in re-merges what that review separated, and an
unreadable config would print "invalid secret pattern in config", which is a lie. (b) R8 and #908's
cold review: the config is only relevant when there is at least one `.memory/records/*.jsonl` path to
scan. Reading it earlier makes one broken config red every PR in the repo instead of only the ones
that add lane records — the exact regression `:135-141` was written to prevent, and
`lane-scrub.test.mjs:159-171` already pins it (`readConfigCalls === 0`).

### D3 — Export `defaultReadConfig(root)` in `lane-scrub`; export nothing in `memory/`

**Choice**: `lane-scrub.mjs`'s `defaultReadConfig` becomes `export function defaultReadConfig(root)`
and forwards `root` to `loadBrainConfigOrThrow(root)` (omitted → the primitive's own `REPO_ROOT`
default, so the production call site at `:119` is unchanged). The three `memory/` readers stay
module-local.
**Rejected**: exporting all four; exporting none.
**Rationale**: `main()` has no `root` seam and `defaultReadConfig` today reads brain's own repo root
via `loadBrainConfig()` — without the export there is **no way** to drive the real reader against a
fixture, only an injected fake, which is the thing this design is trying not to do. The `memory/`
readers need no export: `save()` and `collectLane()` both take `root`, so a test drives the real
default by pointing `root` at a temp dir. Exactly #942's reasoning for `defaultReadDenyActors`
(`approve/cli.mjs:119-122`), applied where the same constraint exists and not where it does not.

### D4 — `dualWriteRecords`'s read (`engram.mjs:364`) is hardened, deliberately

`engram.mjs:266` and `:939` are two wiring points of **one** function, `_defaultLoadBrainConfig`.
Hardening it hardens both; there is no second reader to rule on, only a choice about whether to give
`:266` a lenient reader of its own.

**Choice**: leave `:266` wired to the hardened default. Add two lines to the docblock naming O1 and
this decision.
**Rejected**: a second, lenient `_defaultLoadBrainConfigLenient` for the callerless path; or keeping
`:266` on the old swallowing body.
**Rationale**: (1) O1 (ratified, #874 split B) keeps the function intact until epic task 2.4 —
a function kept **for a future caller** must not be kept with the wrong failure policy, or 2.4
inherits the fail-open by construction. (2) Two implementations of one rule is the exact shape
`brain/core/anti-patterns/` names and that `approve/cli.mjs:105-113` documents as having already bitten
this repo three times. (3) Cost of being wrong is zero today: no production caller, and both test
files that reach `dualWriteRecords` inject `_loadConfig: () => ({})`
(`engram.dualwrite-hydrated-gate.test.mjs:66,86`; `engram.upstream-scope.test.mjs`, 9 sites), so they
never touch the default and stay green untouched.
**Consequence, stated before review asks**: `:266` contributes **no** test to the mutation table. It
cannot — there is no production path to refuse. The function's behaviour is covered by `save()`'s test
(T-E1), since it is the same function.

### D5 — `cli.mjs`'s collect comment is corrected, the string is not

`cli.mjs:365-366` asserts "everything else is a genuine git failure". After this change that is false.
The comment changes; `memory.collect.failed` (`en.mjs:334`) is already neutral —
`'✗ collect failed — {message}'` — so no i18n edit (R10, R7). No `es.mjs` touch, `i18n/coverage.test.mjs`
stays green untouched.

## Call-site table

| # | File:line | Reader | Reached by | Refusal | Carried by |
|---|-----------|--------|-----------|---------|-----------|
| 1 | `memory/lane/collect.mjs:94-100` → read at `:226` | `_defaultLoadConfig` | `memory:collect` (`cli.mjs:333`); `memory:ship` via `shipLane`→`collect()` (`ship.mjs:254`) | exit 1, `memory/cli: ✗ collect failed — brain.config.json at <root>/brain.config.json could not be parsed: …` | `cli.mjs:364-375` (`failed` arm, `:372`) |
| 2 | `memory/backends/engram.mjs:451-457` → read at `:952` | `_defaultLoadBrainConfig` | `memory:save` under `MEMORY_BACKEND=engram` (`cli.mjs:835`) | exit 1, `memory/cli: engram.save() failed — brain.config.json at … could not be parsed: …` | `cli.mjs:839-859` (`:856`, `BACKEND` literal) |
| 2b | same function → read at `:364` | `_defaultLoadBrainConfig` | **nothing** (no production caller since #874 split B) | n/a — D4 | n/a |
| 3 | `memory/backends/plainfiles.mjs:41-47` → read at `:112`, used `:127` (`deriveProject`) and `:213` (scan) | `_defaultLoadBrainConfig` | `memory:save` under the plainfiles backend | exit 1, `memory/cli: plainfiles.save() failed — …` | `cli.mjs:856` |
| 4 | `governance/lane-scrub.mjs:53-59` → called at `:149` | `defaultReadConfig` | the `secret-scan` required context, all three tiers (`governance-tiers.mjs:230-234`) | **exit 2**, stdout `lane-scrub: cannot read the secret config — failing closed (uncomputable): brain.config.json at … could not be parsed: …` | new try/catch at `:149`, `{pass:false, uncomputable:true}` → `resultToExit` |

`memory:ship` refuses at **both** layers and nothing is threaded between them (R6): `cli.mjs:463`'s
`loadBrainConfig()` already throws for brain's own root; the internal `collectLane` read now throws
for `BRAIN_MEMORY_TEST_ROOT ?? repoRoot`. Whichever fires first, `cli.mjs:518-532`'s `failed` arm
carries it to exit 1. Order matters only for the message, and the message names its own path.

The read at row 3 precedes the append at `:225` (and row 2's at `:1023`), so a throw loses no capture
(R5). Row 1's read is step 5 of `collectLane`, before any blob is written.

## File changes

| File | Action | Description |
|------|--------|-------------|
| `memory/lane/collect.mjs` | Modify | reader → `loadBrainConfigOrThrow(root)`, no catch; import edge to `../../lib/brain-config.mjs`; docblock states the direction rule |
| `memory/backends/engram.mjs` | Modify | same; + 2-line D4 note on the `:266` wiring point |
| `memory/backends/plainfiles.mjs` | Modify | same |
| `governance/lane-scrub.mjs` | Modify | `loadBrainConfig` import → `loadBrainConfigOrThrow`; `defaultReadConfig(root)` exported, no catch; new uncomputable arm at `:149` |
| `memory/cli.mjs` | Modify | comment at `:365-366` corrected (D5) |
| `lib/brain-config.mjs`, `memory/lib/secret-scrub.mjs`, `i18n/*` | Unchanged | reused as-is |

## Test plan (STRICT TDD, `node --test`)

**The rule every test below obeys**: neutralize every sibling seam on the path to a value that would
make the op **succeed**, so the only thing that can fail is the reader under test. A test whose
sibling can also throw pins the sequence, not the unit — #942's own review lesson.

| id | File | Scenario | Sibling deps injected to neutral, and why |
|----|------|----------|-------------------------------------------|
| T-C1 | `lane/collect.integration.test.mjs` | unparseable `brain.config.json` in `root` → `collectLane` throws, message matches `/brain\.config\.json/` and `/could not be parsed/` | `git`: a canned seam returning `{status:0,…}` for `fetch`, a sha for `rev-parse`, one `worktree …` stanza for `worktree list`, `''` for `ls-tree` and `status` (pattern already in the file at `:312,:343,:363`). Without it a git failure throws first and the test passes for the wrong reason. `loadConfig` is **not** injected — it is the unit. |
| T-C2 | same | no config at all → `collectLane` returns normally, `result.ref` minted (R12) | same canned `git`. Kills the "throw on ENOENT too" trap (explore §7) by name instead of by 8 unrelated files going red. |
| T-E1 | `backends/engram.save.test.mjs` | unparseable config in `root` → `save()` rejects with the primitive's message, and `_appendRecord` was never called | `getGitConfig: () => 'valid-handle'` (an **unset** actor throws at `:964`, three lines after the read — the single most likely false green), `getBranch: () => 'main'`, `getTimestamp` fixed, `getEnv: () => ({})`, `_appendRecord`/`_rebuildIndex`/`_hydrate` no-ops that succeed, `project: 'brain'` passed so `deriveProject` is not the thing being measured. `_loadConfig` **not** injected. |
| T-E2 | same | no config → `save()` resolves, record written (R12) | same seams. |
| T-P1 | `backends/plainfiles.save.test.mjs` | unparseable config in `root` → `save()` rejects, `_appendRecord` never called | same list minus `_hydrate`, plus `_readRecordIds`/`_upstreamRecordEntries` (only reached with `--supersedes`, injected anyway so the seam list is one shape across both backends). |
| T-P2 | same | no config → resolves (R12) | same. |
| T-L1 | `governance/lane-scrub.test.mjs` | `defaultReadConfig(tmpDir)` with an unparseable file → throws, message names the path | none — a direct unit call, the #942 T9 shape. |
| T-L1b | same | `defaultReadConfig(tmpDir)` with no file → `{}` (R12) | none. #942 T10 shape. **First ever coverage** of this reader: every existing test injects `readConfig`. |
| T-L2 | same | `main({readConfig: throwing})` → returns **2**, stdout matches `/uncomputable/` and `/cannot read the secret config/` | `diffNameOnlyAdded: () => ['.memory/records/2026-09-x.jsonl']` (must match `LANE_PATH_RE`, else the early return passes with 0), `readFile: () => '{"clean":true}'`, `execFileSync` never reached. This is the **call-site** test (#942 T11 shape), not reader coverage — see the mutation table. |
| T-L3 | same | `main({diffNameOnlyAdded: () => ['docs/x.md'], readConfig: counting})` still never calls `readConfig` | the existing `:159-171` test, re-asserted after the new arm is inserted — proof the arm sits **after** the early return (R8). |

## Mutation table (what the reviewer will run)

| # | Mutation | Test that must go red | Isolated? |
|---|----------|----------------------|-----------|
| M1 | `collect.mjs` reader → `catch { return {} }` | **T-C1** | Yes. No other test writes a malformed config under a collect root. |
| M2 | `engram.mjs` reader → `catch { return {} }` | **T-E1** | Yes. Every other engram test that reaches a config either injects `_loadConfig` or has no config file. |
| M3 | `plainfiles.mjs` reader → `catch { return {} }` | **T-P1** | Yes, same argument. |
| M4 | `lane-scrub.mjs` reader → `catch { return {} }` | **T-L1** | Yes. T-L2 injects a throwing reader and does **not** die here — declared, not discovered. |
| M5 | delete the new `try/catch` at `lane-scrub.mjs:149` (let the throw escape `main()`) | **T-L2** | Yes — this is the call-site mutation, distinct from M4. |
| M6 | move the new arm **above** the `recordPaths.length === 0` early return | **T-L3** | Yes. |
| — | `engram.mjs:266` (`dualWriteRecords`) | **none, by construction** | No production caller (O1/D4). The function's behaviour is M2's test, since it is literally the same function. Stated up front. |

## Absent stays green (R12) — existing evidence, checked for fakes

| Call site | Existing tests that would catch an ENOENT regression | Real reader? |
|-----------|------------------------------------------------------|--------------|
| `collect.mjs` | `lane/collect.integration.test.mjs:192,228,245,258,282,289,326,363,415` — `collectLane({root: repo.mainDir,…})`, temp git repo, **no `loadConfig` seam anywhere in the file**; plus `cli.collect.test.mjs` under `BRAIN_MEMORY_TEST_ROOT` | Yes |
| `engram.mjs` `save()` | `backends/engram.save.test.mjs` — `mkdtempSync(tmpdir(),'engram-save-')` root, **no `_loadConfig` injection in the file**; `backends/save-parity.test.mjs` likewise | Yes |
| `plainfiles.mjs` `save()` | `backends/plainfiles.save.test.mjs` — real reader everywhere **except** `:363,:382,:397`, which inject and therefore do **not** count | Yes (majority) |
| `lane-scrub.mjs` | **none** — `:69,104,116,128,139,163,183,200` all inject `readConfig`. The absent case is uncovered today; T-L1b is the first assertion of it | **No — gap closed by this change** |
| (excluded as fakes) | `engram.duplicates.test.mjs:53`, `engram.upstream-scope.test.mjs` (9 sites), `engram.dualwrite-hydrated-gate.test.mjs:66,86` — all inject `_loadConfig: () => ({})` | — |

## Line budget

`**/*.test.mjs` and `openspec/changes/**` are in `governance.ignoreList` (`brain.config.json:18-29`),
so only production lines count.

| File | Counted (add+del) | Composition |
|------|------|-------------|
| `collect.mjs` | ~24 | reader body 7→3, docblock rewrite, +1 import |
| `engram.mjs` | ~24 | same + 2-line D4 note |
| `plainfiles.mjs` | ~18 | same, shorter docblock |
| `lane-scrub.mjs` | ~34 | import swap, export + `root` param + docblock (~14), new uncomputable arm (~12) |
| `cli.mjs` | ~4 | comment correction |
| **Total** | **~104** | |

**400-line budget risk: Low. Chained PRs recommended: No.** One PR, `Closes #712` (R13). This is ~34
lines above R13's ~70 estimate, all of it `lane-scrub`'s export + `uncomputable` arm — R13 anticipated
that drift and conditioned a PR1/PR2 split on it; at 104 of 400 the condition is not met, so the
single-PR ruling stands unchanged.

## Failure modes

| Failure | Behaviour after this change | Exit |
|---------|---------------------------|------|
| No `brain.config.json` | `{}` → default patterns, empty allowlist — unchanged | 0 |
| Present, malformed JSON | refusal naming path + parse offset | 1 (memory) / 2 (lane-scrub) |
| Present, path is a directory / EACCES | `could not be read` refusal | 1 / 2 |
| Valid config, invalid regex in `memorySecretPatterns` | unchanged — `lane-scrub`'s existing `:165-172` arm | 2 |
| Malformed config, PR adds **no** lane record | `lane-scrub` passes before reading the config (R8, T-L3) | 0 |
| Malformed config, read path (`memory:search`) | unchanged — never reaches `resolveSecretConfig` (R11) | 0 |

## Open questions

None blocking. One note for `sdd-spec`: no published spec covers the secret scan today, so
`REQ-SCAN-*` lands as new `governance-v3` text rather than an amendment.
