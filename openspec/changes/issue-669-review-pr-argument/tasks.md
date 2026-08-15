---
status: draft
issue: 669
---

# Tasks — issue 669

## Done

- [x] **T1** — Reproduce on `main` before changing anything. Measured:
      `665` → `pr: null`; `--pr abc` → `NaN`; `--pr` → `NaN`; `` → `null`.
      All four reach `git fetch origin <value>`.
- [x] **T2** — `parseArgs` accepts a positional and returns `error` instead of
      throwing (REQ-669-1/3).
- [x] **T3** — `main` refuses on `error` before `loadBrainConfig`, cold-boot or
      any port verb, exit 2 (REQ-669-2).
- [x] **T4** — Tests, including a case asserting cold-boot is never constructed
      on the refusal path, and one proving the positional form reaches a real
      verdict rather than merely parsing.
- [x] **T5** — Self-review, before opening the PR. Two defects of the class this
      ticket exists to close had been rebuilt inside its own fix:
      · `665 --pr 666` silently preferred the flag — a silently-chosen winner,
        which the same function refused two lines earlier for `665 666`;
      · `--pr 665 --pr abc` reported `"665" is not a PR number`, blaming a
        VALID number, because the raw token was re-derived with
        `indexOf('--pr')` (first flag) while `pr` held the last one's value.
      Both fixed by collecting every PR number the argv names into ONE list,
      whatever the syntax, and carrying the raw token instead of re-deriving
      it. Neither was caught by the suite, the mutation runs, or the reviewer
      protocol — only by re-reading the diff adversarially.
- [x] **T6** — Second self-review pass, after the PR was open. Three more:
      · **G1** — an unrecognised option was silently discarded, so
        `--dry-run=true`, `--dryrun` and `-n` all left `dryRun: false` and the
        run POSTED a verdict when a rehearsal was asked for. The safety flag
        disarmed itself. Now refused (REQ-669-6).
      · **G4** — `Number()` resolved `0x10` to PR 16 and `1e3` to PR 1000.
        Now digits-only (REQ-669-7).
      · **G5** — every regression test written so far probed the PR-NUMBER
        axis, which is exactly why G1 survived the fix AND the self-review that
        caught two other defects in it. The suite had the shape of the author's
        hypothesis, not of the input space. Covered now.
      Mutation note: the first attempt at the G4 mutation did NOT land (a bad
      shell escape) and the suite stayed green. A green run under a mutation
      that never applied is not evidence — redone until the mutated line was
      grep-confirmed, then 1 test red.

## Evidence — mutation testing

Each shown to **land**, to turn the suite **red**, and to revert
**byte-identical** (`diff -q`).

| # | mutation | result |
|---|---|---|
| 1 | `if (false && args.error)` — the guard stops firing | 2 tests red |
| 2 | drop the positional assignment | 5 tests red |
| 3 | stop refusing two PR numbers (restore the silent winner) | 3 tests red |
| 4 | ignore unrecognised options again (G1) | 3 tests red |
| 5 | restore the lenient `Number()` coercion (G4) | 1 test red |

Suite: **3645 tests, 3644 pass, 0 fail, 1 skipped**. `brain:repo:check` clean.

## Verified by hand

The exact command from the report now refuses at the identity gate instead of
throwing a stack trace about a remote ref:

```
$ node ./brain/scripts/review/cli.mjs 665
brain:review: refusing to run — could not verify the reviewer identity ...
```

(That refusal is this container's missing `gh`, which is the next gate — the
argument was parsed and accepted.)
