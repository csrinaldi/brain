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

## Evidence — mutation testing

Each shown to **land**, to turn the suite **red**, and to revert
**byte-identical** (`diff -q`).

| # | mutation | result |
|---|---|---|
| 1 | `if (false && args.error)` — the guard stops firing | 2 tests red |
| 2 | drop the positional assignment | 5 tests red |

Suite: **3636 tests, 3635 pass, 0 fail, 1 skipped**. `brain:repo:check` clean.

## Verified by hand

The exact command from the report now refuses at the identity gate instead of
throwing a stack trace about a remote ref:

```
$ node ./brain/scripts/review/cli.mjs 665
brain:review: refusing to run — could not verify the reviewer identity ...
```

(That refusal is this container's missing `gh`, which is the next gate — the
argument was parsed and accepted.)
