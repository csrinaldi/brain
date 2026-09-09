---
status: tasked
issue: 862
---

# Explore: #862 — the surfaces a memory lane touches, measured

Parent: #864 (memory 2.0), task 1.1, Wave 1. Measured on `main` @ `96cd30c8` (after #863).

## 1. The backlog the lane would carry today

Across 82 worktrees of this clone, **9 record files** are untracked and absent from
`origin/main`. The same file sits in up to **seven** worktrees (`brain`, `brain-864`,
`brain-issue-820/851/863/864/870`): `pre-push`'s `share` exports the whole machine's backend
into every worktree that pushes. Filenames are content-addressed, so the collector's dedup is
`Set(filename)` — but the duplication is the cross-contamination #863 D2 named, live.

## 2. Governance: what a lane PR would hit

| gate | today | for a lane PR |
|---|---|---|
| `issue-link` | on the default branch a **closing keyword** is mandatory; `Part of #N` is refused (`run-check.mjs:340-350`); the issue must carry `status:approved` | a lane PR closes no issue. A standing issue with `Closes` would be **closed on merge** (the #867 lesson). Needs a ruling: a narrow exemption for the lane class, or one issue per run via `issueCreate` |
| `diff-size` | `.memory/**` is on `governance.ignoreList` | 0 counted lines — green by construction |
| `local-checks`, `decision-gate`, `phase-order` | structural | green: no `brain/`, no `openspec/`, no ADR |
| `actor-check` | `lite`: distinct act over foreign commits; evidence = the approved label on the linked issue | depends on the `issue-link` ruling — the lane class needs its own answer |
| `brain-writes-reviewed` | nothing under `brain/` | green |
| `memory-gate` | reads `<cwd>/.memory/records/*.jsonl` — **the tree, not the diff** (`run-check.mjs:80-87`); scoped to the linked issue when the pipeline hands it the body | for a feature PR after the lane: its tree carries `main`'s records once rebased/merged, so a record for issue N that reached `main` via the lane satisfies the scoped gate **without changing the gate** |

Tier: this repo is `lite` (`brain.config.json:17`); `requiredReviews` is **0** at `lite`, **1** at
`standard` and `regulated` (`governance-tiers.mjs:265,277,292`). `regulated` cannot be declared
by brain itself (`:344`).

## 3. Branch grammar

`pre-commit` refuses commits on `main`/`master` and a task branch in the main checkout; nothing
in hooks or CI validates a branch-name regex. `brain:ship` reads the issue from `/<N>-`
(`brain-ship.mjs:83`). A `memory/<host>-<date>` branch is refused nowhere and recognised
nowhere.

## 4. The port

`vcs-contract.md` has `mrCreate`, `prView`, `prStatusRollup`, `branchProtect`, `issueCreate`
… and **no merge verb**: no `mrMerge`, no auto-merge, on either provider. Task 2.5
(`mrAutoMerge`) is new surface: GitHub `gh pr merge --auto`, GitLab merge-when-pipeline-succeeds.

## 5. Credential

ADR-0033: *the producer never holds a credential* — the cold review's poster runs in a
process whose `env` is handed explicitly (`withoutCredentials`), and the token stays on the
environment axis (Amendment 1, #773). The lane's push + PR is the same shape: the capturing
session must not be the one holding the token that pushes.

## 6. The index

`.memory/index.jsonl` is derived and regenerable (ADR-0017). No `.gitattributes` rule for it
today; `post-merge` runs `resolve-index` after every pull. Two lanes from two hosts each
committing a regenerated `index.jsonl` would conflict on `main` — the "two lanes, one index"
scenario the epic's spec names.

## 7. The feature-PR surfaces that carry records today (3.1d's inventory)

- `brain/scripts/hooks/pre-push:70` — `cli.mjs share` on every push, any branch.
- `brain/scripts/i18n/en.mjs:279` — `ticket.nextSteps.step3`: *"memory:share && git add .memory/ before pushing"* (and `es`).
- `brain/scripts/brain-save.mjs` — "materialise and commit session memory" on the task branch.
- `brain/scripts/vcs/contributor-scaffold.mjs:274` — the PR template's "Session memory captured with `memory:share`" line.
- `day.done.checkCmd` (`en.mjs:88`) — `repo:check && memory:share`.

## 8. Doctrine

`consolidation-protocol.md §5`: *"Once the MR is merged, the team absorbs the memory"* — the
sentence #862 exists to replace. `openspec/README.md` rule 3: *"Artifacts travel with the code
in the same MR"* (task 5.3). ADR-0002's "canonical flow" bullets describe share/pull/hooks.

## 9. Latency, the number to beat

`memory:audit` baseline on #864: **p50 21.6 h, p90 399.7 h** learn→main (first-parent, n=350
since 2026-08-01). Spec targets proposed for `lite`: p50 ≤ 1 h, p90 ≤ 24 h.
