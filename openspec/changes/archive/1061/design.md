# Design: Heal the Engram Store's Pre-Guard Duplicate Rows (#1061, #864 task 1.2a)

## Technical Approach

The work splits into two parts. The first is a pure planner, `lib/engram-heal.mjs`. It follows the precedent of `lib/engram-import.mjs` and `lib/engram-export.mjs`: it takes a parsed export and returns keep, delete or refuse. The second is an executor, `healDuplicates`, exported from `backends/engram.mjs`. The contract says the adapter deletes its own rows (`memory-backend-contract.md:92-94`). The executor reuses the `#445` cross-check `topicKeysFromExport` (`engram.mjs:1383-1418`) and `explainEngramFailure` (`:1349`).

`cli.mjs` gets a dedicated `heal-duplicates` block, placed next to `split-records` (`cli.mjs:250`). It reports only by default and needs `--apply` to delete anything. The block runs before backend selection (`:742`) because it only means something on engram. The spec is `specs/memory-backend/spec.md` REQ-MB-1..5.

## Measurement status (item 1): NOT MEASURED in this phase

This executor had no shell. Only Read, Write, Grep and Glob were available, and there were no `mem_*` tools. No `engram` command was run, so the soft vs hard question, the `delete` id form and the `version` output are all **unmeasured**. They become the first RED test of apply (T-INT-0 below), run against a throwaway `ENGRAM_DATA_DIR`. Known facts with their sources:

- `ENGRAM_DATA_DIR` isolates the store, measured on engram 1.20.0 (`archive/874/apply-progress.md:58-72`).
- `engram import` inserts rather than upserts: importing the same payload twice doubles the rows (`engram.mjs:308-311`, `:417-419`). That is how the real duplicates were born, and it is how the tests reproduce them.
- `engram save --topic` upserts (`874/apply-progress.md:99`), so it cannot create a duplicate.

T-INT-0 must record the exact commands and their output in `apply-progress.md`:

1. `engram version` (or `--version`), and whether the output goes to stdout or stderr.
2. Import one payload twice, which gives 4 rows.
3. `engram delete <numeric id>`. If that fails, try `<sync_id>`.
4. `engram export`: is the soft-deleted row gone, or still present with `deleted_at` set?
5. `engram delete <id> --hard`, then export again.

The results set `HEAL_DELETE_ARGS` and `HEAL_ID_FIELD`.

## Architecture Decisions

| Decision | Rejected | Rationale |
|---|---|---|
| The planner goes in the new `lib/engram-heal.mjs`. The executor `healDuplicates` goes in `backends/engram.mjs` | Everything in `lib/`; a new `backends/engram-heal.mjs` | The contract gives deletion to the adapter. Any file in `backends/` can be selected as a backend (`cli.mjs:787` imports `./backends/${BACKEND}.mjs`), so `MEMORY_BACKEND=engram-heal` would load it. A pure planner can be tested with no binary. |
| A dedicated `if (op === "heal-duplicates")` block before `selectBackend`. It refuses with `memory.heal.notEngram` when `MEMORY_BACKEND !== "engram"` | Generic dispatch (`:959-990`) | Generic dispatch has no exit code for a refusal and prints only duplicates. `plainfiles` would fail with "does not implement", which names the wrong fix. |
| Flags: `--apply` only. Any other argument is refused as `memory.heal.badFlag` | Add `--json` | This is a one-shot maintainer run whose human-readable output gets pasted on #1061. `audit --json` already gives the machine-readable check. Refusing unknown arguments fails closed (the `ship` precedent, `archive/1012/design.md:14`). |
| Exit 0: nothing to heal, plan printed, or apply verified. Exit 1: every refusal, a partial apply, or a failed verification | A distinct code for partial | One maintainer reads the output. The message carries the detail. |
| Plan and results go to stdout; refusals and failures go to stderr, prefixed `memory/cli:` | Everything on stdout | Mirrors `split-records` (`:265-283`). |
| Any refused group refuses the **whole run**, and nothing is deleted | Heal the good groups and skip the bad ones | REQ-MB-3. A partial heal on a store we do not fully understand is the unsafe case. |
| Keeper = lowest numeric `id`. Equality is strict `===` on `content`, `title` and `type` | Latest wins; compare `project` too | This is the proposal's decision record. Keys hash the project (`format.mjs`), so an equal key already means an equal project. |
| Shape refusal when: `observations` is neither an array nor `null`; the stdout count does not match (`topicKeysFromExport` throws); or a `rec-` row lacks an integer `id` or string `content`, `title` or `type` | Skip malformed rows | Skipping would under-count, which is the `evidence-reader-empty-on-failure` class (`engram.mjs:1303-1328`). |
| Version guard: `TESTED_ENGRAM = { major: 1, minor: 20 }`. `parseEngramVersion(stdout)` takes the first `\d+.\d+.\d+` on **stdout only**. Out of range or unparseable means `memory.heal.refused.version`, in dry-run too | Warn and continue; read stderr | The update banner on stderr contains two versions (`engram.mjs:1335`). engram 2.0.0 exists and is untested. Widening the range is a code change plus a re-run of T-INT. |
| Delete one id at a time, in ascending order. Stop at the first failure and report what was deleted and what was not | Batch or continue past a failure | You cannot reason about a half-healed store unless the report is exact. |
| After apply, re-export and re-plan. Require zero duplicated `rec-` groups, every keeper present and every deleted id absent | Trust the exit status of `delete` | REQ-MB-5. This is the check that exposes a soft delete the export ignores. |
| No `MANAGED_SCRIPT_KEYS` entry, so no Tier 2 commit | Add `brain:memory:heal-duplicates` | No doctrine says `npm run` for it, so the drift guard (`managed-script-keys-doctrine.test.mjs:119`) stays green. Consumers get `cli.mjs` through the `brain/scripts/**` glob and can run `node ./brain/scripts/memory/cli.mjs heal-duplicates`. Like `split-records` and `migrate-v1`, which are also not managed. |

## Data Flow

```
cli heal-duplicates [--apply]
  └─ healDuplicates({apply, _probe, _exec, _read})
       probe → `engram version` → guard
       export#1 → topicKeysFromExport (count check) → planDuplicateHeal
         refuse? → stderr, exit 1, 0 deletes
         dry-run → print plan, exit 0
         apply  → for id asc: `engram delete <id> ...HEAL_DELETE_ARGS` (stop on first throw)
                → export#2 → planDuplicateHeal → assert healed → exit 0 | 1
```

The executor never takes `root` and never touches `.memory/`.

## Interfaces

```js
// lib/engram-heal.mjs (pure)
planDuplicateHeal(parsed) →
  { ok: true, rows, distinct, groups: [{ key, keep: id, delete: [id] }] }
| { ok: false, refusal: 'divergent'|'tooMany'|'shape', key?, fields?, count?, reason? }
parseEngramVersion(stdout) → { major, minor, patch } | null
isTestedVersion(v) → boolean
// backends/engram.mjs
healDuplicates({ apply = false, _probe, _exec, _read, _log, _warn })
  → { outcome: 'none'|'planned'|'healed'|'refused'|'partial'|'unverified', deleted: [], notDeleted: [], ... }
```

The i18n keys go into both `en.mjs` and `es.mjs`, next to `memory.splitRecords.*`: `memory.heal.none`, `.plan`, `.deleted`, `.done`, `.partial`, `.unverified`, `.notEngram`, `.badFlag`, `.failed`, `.refused.divergent`, `.refused.tooMany`, `.refused.shape`, `.refused.version`. Each refusal ends with "Nothing was deleted." The per-group line is raw text, `  {key} — keep #{keep}, delete #{ids}`, the same way as `cli.mjs:272`.

## Testing Strategy (STRICT TDD: each row is written RED first)

| RED test | Proves |
|---|---|
| `lib/engram-heal.test.mjs` (RED: the module is missing) | Rows out of order still keep the lowest id. Non-`rec-` keys are ignored. `content`, `title` and `type` each refuse on a difference, naming the key and the field. 3 rows refuse as `tooMany`. A missing `id` or `content` refuses as `shape`. `observations: null` gives no groups. The fixture of the three measured pairs plans deletes `[3092,3093,3094]`. `parseEngramVersion` handles `1.20.0` (in range), `2.0.0` (out) and garbage (`null`). |
| `backends/engram.heal.test.mjs` (seams in the style of `audit-io.test.mjs:85-91`) | A dry-run makes 0 delete calls. Apply deletes in ascending order with `HEAL_DELETE_ARGS`. A throw on the 2nd delete gives `partial` with `deleted=[a]`, `notDeleted=[b,c]` and no further calls. A post-verify export that still has a duplicate gives `unverified`. A version outside the range or a probe that says absent means no export and no delete. A count mismatch is a shape refusal. A second run makes 0 deletes. `_read` throws on any path under `.memory`. |
| `memory/cli.heal-duplicates.test.mjs` (spawns `cli.mjs`) | `MEMORY_BACKEND=plainfiles` refuses with `notEngram` and exit 1. `--bogus` refuses with `badFlag`. To reach the binary it uses a fake `engram` sh shim first on `PATH`, plus `ENGRAM_DATA_DIR` and `HOME` pointed at `testTmp`. It checks the plan text and exit 0, and a refusal with exit 1. This needs a new allowlist entry in `test-spawn-hygiene.test.mjs`: `{file:'brain/scripts/memory/cli.heal-duplicates.test.mjs', entrypoint:'brain/scripts/memory/cli.mjs', reason:'no-vcs-capability'}`. |
| `backends/engram.heal.integration.test.mjs`. It uses `{ skip }` when `probeBinary(ENGRAM_BIN).available !== true` or when the installed version is outside the tested range. The skip reason names which. | **T-INT-0**: the soft-delete fact, pinned. **T-INT-1**: `buildImportPayload` with 2 records, `engram import` ×2 gives 4 rows; the dry-run leaves the export unchanged; apply leaves 2 rows with distinct = rows; a second apply is a no-op. **T-INT-2**: two imports of the same key with different content refuse, and the row count is unchanged. **T-INT-3**: 3 imports refuse as `tooMany`. |

**Isolation from `~/.engram`.** The integration test never uses the default exec. It injects the `_exec` wrapper `isolatedExec(dir)`, which merges `{ENGRAM_DATA_DIR: dir, HOME: dir}` into `env`. Before every call it asserts that `dir` is under the `testTmp` run root and is not `join(homedir(), '.engram')`. Setting `HOME` too means that even if the variable were ignored, the default resolves inside the temp directory. `engram` as the first argument is not a spawn-hygiene hit (`test-spawn-hygiene.test.mjs:245-265`).

## File Changes and Review Workload Forecast

| File | Action | Governed lines (est.) |
|---|---|---|
| `brain/scripts/memory/lib/engram-heal.mjs` | Create | ~70 |
| `brain/scripts/memory/backends/engram.mjs` | Add `healDuplicates`, `HEAL_DELETE_ARGS`, and the default version and delete execs | ~75 |
| `brain/scripts/memory/cli.mjs` | Add `VALID_OPS` entry, the header usage line, and the block | ~45 |
| `i18n/en.mjs`, `i18n/es.mjs` | 13 keys each | ~26 |
| `package.json` | `brain:memory:heal-duplicates` | 1 |
| `CHANGELOG.md` Unreleased | Add a note | ~4 |
| Tests, `openspec/changes/**` | — | not governed (`brain.config.json:23-34`) |

About 220 governed lines against the `lite` tier. That is under 400, so a single PR. Decision needed before apply: No. Chained PRs recommended: No. 400-line budget risk: Low.

## Migration / Rollout: maintainer runbook (post-merge, Tier 2)

1. Run `engram version` and expect 1.20.x. Otherwise the tool refuses. Stop.
2. Run `engram doctor --json | rg -c 'obs-9229525d73068f1b|obs-41d07c12dfe03bd1|obs-9ed0ba42b887011f|obs-93acd79f338334ba|obs-24accc8cd4b8356c|obs-13a6bb5c7e7c3431'`. Expect `0`.
3. Run `MEMORY_BACKEND=engram npm run brain:memory:audit` and keep the backend line from before.
4. Take a recovery snapshot, which is read-only: `engram export ~/engram-pre-1061.json`.
5. Dry-run: `npm run brain:memory:heal-duplicates`. It must list exactly 3092, 3093 and 3094.
6. Apply: `npm run brain:memory:heal-duplicates -- --apply`.
7. Run the audit again. Expect `distinct = rows`, with `duplicated 0`.
8. Re-run step 5 and expect `memory.heal.none`. Then `git status --porcelain .memory` should be empty.

Paste on #1061: the version, the doctor count, the dry-run output, the apply output, the before and after audit lines, the second-run output, and the delete mode used.

## Open Questions

- [ ] Soft vs hard, the id form for `delete`, and the version command are settled by T-INT-0 at the start of apply. If soft deletes stay in the export, use `--hard`. The step-4 snapshot is then the only recovery path.
- [ ] Task 6.1 must say its "distinct = rows" measures backend rows. The record-layer excess of 2 stays out of scope.

## Measured by the orchestrator (2026-09-19, engram 1.20.0, throwaway `ENGRAM_DATA_DIR`)

The design agent had no shell; these replace T-INT-0's unknowns. `~/.engram/engram.db` was checked unchanged (mtime and size) before and after every probe.

| Question | Result |
|---|---|
| Does a soft delete remove the row from `engram export`? | **No.** `engram delete <id>` prints `Observation #N soft-deleted`; the row stays in the export with a `deleted_at` field (the key is present only when set). `readBackendKeys` does not filter it, so the audit would still count it. |
| Does a hard delete? | **Yes.** `engram delete <id> --hard` prints `Observation #N hard-deleted`; the row is gone from the export. |
| Which id does `delete` take? | The numeric observation `id`. `engram delete obs-…` fails with `invalid observation id`. Argument order: `delete <id> --hard` (`--hard` first, or a `observation` subcommand, is rejected). |
| Version output | `engram version` prints `engram 1.20.0` on stdout. |
| How to reproduce a real-shaped duplicate | Re-importing the same export does NOT duplicate on 1.20.0 (deduped by `sync_id`). Importing a copy of the export with the `sync_id`s changed does: two live rows share one `topic_key`, which is the shape of the three real pairs. |
| Hard delete of an already soft-deleted row | Prints `engram: observation not found`; the heal must only target live rows. |

Consequences for this design:

- `HEAL_DELETE_ARGS = ['delete', String(id), '--hard']` and `HEAL_ID_FIELD = 'id'` (numeric). Per the maintainer's rule (soft if the test proves it suffices, otherwise hard), the heal hard-deletes. Nothing is lost: each deleted row is a byte-identical copy of the kept row, and the record lives in `.memory/records/`. Runbook step 4's snapshot export stays as the recovery path.
- Detection counts only live rows: a row with `deleted_at` set is not a duplicate candidate and is never a delete target.
- The integration test builds duplicates by importing a `sync_id`-rewritten copy of an export into a throwaway store.
