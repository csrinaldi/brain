# Report — phase-1 exit on 1.10.1 (2026-09-30)

## Exit clauses

| Clause | Result | Evidence |
|---|---|---|
| Fresh plainfiles and engram installs need no step outside install, bootstrap or upgrade | **No** | The first PR needed two manual steps in both repos. `brain:ship` refused for a missing `type:*` label, so the label was added by hand: F1, #1206, `evidence/plainfiles-14-ship.txt`, `evidence/engram-14-ship.txt`. It then failed with a raw GraphQL error until the branch was pushed by hand: F2, #1207, `evidence/plainfiles-15-ship-retry-type-label.txt`, `-16`, and the engram counterparts. A same-day lane re-ship also needed a hand-deleted remote branch: #1190, `evidence/plainfiles-61-seam2-inject.txt`, `-62`. What the 1.10.1 fixes targeted does hold. Once the push was done, `brain:ship` opened PR #2 with no `gh pr create` fallback (#1186/#1187): `-17`. The first real merge's post-merge run succeeded and opened no alarm (#1188): `evidence/plainfiles-20-postmerge-pr2.txt`, `evidence/engram-20-postmerge-pr2.txt` |
| No credential committed | **Yes** | `credential-scan.txt`; `.env` untracked and ignored in both repos and both checkout-B clones |
| #1081's four seams recover | **Yes** | Per seam in the table below |

## Ruling

The cold review of PR #1208 (rev 1, `judgment:cold-1`) found that an earlier draft of this report answered the clause above with "Yes, with two usability findings". The clause is binary, so that answer was a misreport. The maintainer ruled on 2026-09-30:

- the clause is **No**, and phase 1 of #1121 stays open;
- #1205, #1206 and #1207 ship in a 1.10.2 cut;
- the first-PR stretch is then re-run on fresh consumers.

## The stretch that ran clean

- `brain:ticket:start` (isolated worktree by default), `brain:config set memory.lane.enabled true`: `plainfiles-11`, `-12`; `engram-11`, `-12`.
- `brain:check` inside `brain:ship`: `diffSize`, `adrPresence`, `issueLink`, `memoryPresence`, `repoCheck`, `navCheck`, `indexLag` pass; `npmTest` is N/A on a consumer. The first-PR gates no longer block (#1186, #1187).
- All 11 checks on the feature PR (#2) and the lane PR (#3) green in both repos: `plainfiles-18`, `-33`; `engram-18`, `-35`.
- Post-merge runs for the feature merge and the lane merge succeeded; the issue list shows only the closed demo issue, no alarm: `plainfiles-20`, `-35`, `-75`; `engram-20`, `-37`.
- Memory chain: R1, R2 saved with `--issue 1`, shipped through the lane, merged: `plainfiles-30`..`-34`; `engram-33`..`-36`.
- Checkout B had no `.env`; search before the merge found nothing, and after `brain:memory:pull` found both records: `plainfiles-40`, `-41`; `engram-40`, `-41`.
- The capturing checkout pulled its own lane merge (#1118): `plainfiles-42`; `engram-42`.

## What still needed a human

| Id | What needed a human |
|---|---|
| F1 (#1206) | `brain:ship` refused: `brain:ship: no type:* label found on issue #1. Labels found: [status:approved] Add a type:* label before shipping.` (`plainfiles-14`, `engram-14`). A documented prerequisite, but nothing in `ticket:start` or the adoption flow says a `type:*` label is needed; the demo added `type:feature` by hand (`-15`) |
| F2 (#1207) | `brain:ship` before the branch is pushed fails with `pull request create failed: GraphQL: Head sha can't be blank, Base sha can't be blank, No commits between main and feat/issue-1-demo-first-feature, Head ref must be a branch (createPullRequest)` (`plainfiles-15-ship-retry-type-label.txt`, `engram-15-ship-retry-type-label.txt`). `ticket:start` lists the push as step 4, but `brain:ship` does not push or say the branch is missing on the remote. After `git push`, `brain:ship` opened PR #2 (`-17`) |
| #1190 | Reproduced: same-day lane re-ship after a squash merge: `memory.ship.diverged: refs/heads/memory/...-2026-10-01 is behind origin's matching ref — refusing to force-push.` (`plainfiles-61-seam2-inject.txt`). The merged remote lane branch was deleted by hand (`plainfiles-62`), the same workaround as #1185 |
| E6 (#1205) | See below |

### E6 (#1205) — `env:init`'s backend prompt has a default

`env:init` asks `Which memory backend do you use? [engram]:` and accepts Enter. The Enter path writes `engram` into tracked `brain.config.json` and indexes the doctrine into the operator's real engram store. That contradicts ADR-0004 Amendment 3, which says the selector has no default. Evidence: `evidence/plainfiles-02-env-init-enter-default.txt`. (The plainfiles repo then got `plainfiles` through the explicit run, `plainfiles-02-env-init.txt`.)

## Seams

| Seam | Where it ran | Result | Evidence |
|---|---|---|---|
| 1. hydration deferred while engram is unavailable, then recovered | engram | recovered. With no engram on PATH, `save` exited 0 with "hydrating it into engram was deferred"; `engram search` found nothing; after `brain:memory:pull` it imported 1/1 and the search found R1 | `engram-30`, `-31`, `-32` |
| 2. `mrCreate` failure after the push, then retry | plainfiles | recovered. The injected failure left the branch pushed and no PR (`memory.ship.prCreateFailed`); the retry opened PR #4 | `plainfiles-60` (R3), `-61` (first hit #1190), `-62` (injection), `-63` (retry) |
| 3. foreign path makes a gate red, then revert makes it green | plainfiles | recovered. The injection commit and push went through the hooks with no `--no-verify` and no `core.hooksPath` override; the hooks allowed it. `issue-link` and `lane-paths` failed; the revert turned all 11 green; the lane PR merged and its post-merge run succeeded | `plainfiles-70`, `-71`, `-72`, `-73`, `-74`, `-75` |
| 4. index lag in checkout B, then `pull` | both | recovered | plainfiles `-40`, `-41`; engram `-40`, `-41` |
| #1118, the capturing checkout pulls its own lane merge | both | recovered | plainfiles `-42`; engram `-42` |

## Expected-open, still failing

- #1115: `session:start` delivers no memory content (not exercised this run).
- #1117: search does not mark superseded records (not exercised).
- #1167: `brain:memory:ship` prints no PR URL (`plainfiles-32`, `engram-34`). `brain:ship` now prints it.
- #1168: `.memory` tracking differs by backend. After the pulls, plainfiles main showed ` M .memory/index.jsonl` and engram main showed `?? .memory/index.jsonl` (`plainfiles-42`, `engram-42`).
- #1189: `memory/cli: backend 'plainfiles' does not implement op 'import'` still printed on every plainfiles `pull` (`plainfiles-41`, `-42`).
- #1190: reproduced, see above.
- #1115, #1117, #1167, #1168, #1189 and #1190 are open and unchanged by this run; the lane PR's `auto-merge was refused (unsupported)` line is the known `allow_auto_merge: false` setting, so a human or the demo merged.

## PRs and issues created

- plainfiles: issue #1; PR #2 (feature, via `brain:ship`); PR #3 (lane, R1/R2); PR #4 (lane, R3, seam 2/3).
- engram: issue #1; PR #2 (feature, via `brain:ship`); PR #3 (lane, R1/R2).

## A note on what the evidence contains

The transcripts carry the operator's hostname, in lane branch names and record provenance, and absolute home paths. They contain no credential: the token scan returns no match.
