# Report — phase-1 exit on 1.11.0 (2026-10-01)

## Exit clauses

| Clause | Result | Evidence |
|---|---|---|
| 1. Fresh plainfiles and engram installs need no step outside install, bootstrap or upgrade | **Yes, by maintainer ruling (2026-10-01)**, with #1190 open as a known limitation | See "Ruling", "What still needed a human" and "What changed since 1.10.1" below |
| 2. No credential committed | **Scan result: no match.** `rg -n "ghp_\|github_pat_\|gho_\|ghs_\|ghu_\|glpat-"` over `evidence/` returned no match (rg exit 1). `.env` is not tracked (`git ls-files .env` prints nothing) and is ignored (`.gitignore:2:.env`) in all four clones; checkout B has no `.env` in both repos | `credential-scan.txt` |
| 3. #1081's four seams (and #1118) recover | **Yes** for seams 1, 2, 3, 4 and #1118, per the table below. Seam 2's first attempt hit #1190 and needed the maintainer's branch deletion first | Per seam below |

## Ruling

The maintainer ruled clause 1 **Yes** on 2026-10-01. The four human steps this run recorded fall into three groups:

- **The merges** are required by doctrine. An agent never merges a change it produced (`agent-authorities.md` Tier 3), and in mode A the human merges (ADR-0037). They are the design, not a step outside it.
- **The `type:*` label and the push** are ordinary development acts: labelling the ticket and pushing its branch. They are not install, bootstrap or upgrade steps. Since 1.11.0 the product asks for each one before any work or remote call and names the exact fix (#1206, #1207), which is what 1.10.1 failed.
- **The remote lane-branch deletion** is a real manual workaround for a defect (#1190). It sits on a lane's second same-day ship, not on the install, first-PR or first-merge path. It is documented in `docs/KNOWN-LIMITATIONS.md` and moves to phase 2 as a priority, because it reproduced in every exit run (1.10.0, 1.10.1, 1.11.0).

Phase 1 of #1121 closes on this ruling.

## What changed since 1.10.1

Both refusals that 1.10.1 left to the operator now name the fix before any work or remote call:
- `brain:ticket:start -- 1` on an issue with no `type:*` label refuses up front, before creating a branch: "✗ Issue #1 has no type:* label (labels found: [status:approved]) — brain:ship would refuse it later. Add one on the issue now (for example type:feature, type:bug or type:chore; type::feature on GitLab), then re-run." (#1206; `plainfiles-12`, `engram-12`, exit 1).
- `brain:ship` before the push refuses with the command to run, no GraphQL error: "the head branch ... is not on the remote at your HEAD — no PR was opened. The branch was never pushed. Run: git push -u origin feat/issue-1-add-a-demo-line-to-the-readme. Then re-run brain:ship." (#1207; `plainfiles-17`, `engram-17`, exit 1).

The ruling question for the maintainer: does a step the product itself names (label, push) count as "outside install, bootstrap or upgrade"?

## What still needed a human

| Step | Evidence |
|---|---|
| `type:feature` label added by hand after `ticket:start` refused (now named up front by the product) | `plainfiles-12`, `-13`; `engram-12`, `-13` |
| `git push -u origin <branch>` run by hand after `brain:ship` named it | `plainfiles-17`, `-18`, `-19`; `engram-17`, `-18`, `-19` |
| Remote lane branch deleted for #1190 (done by the maintainer) | `plainfiles-66` (the refusal), `plainfiles-67` (deletion) |
| Merges, each done by the maintainer: feature PR #2 and lane PR #3 in both repos, plainfiles PR #4 | `plainfiles-21`, `-60`, `-79`; `engram-21`, `-60` |

Also done by the agent as a stand-in (harness, see `design.md`): `status:approved` on issue #1 (`plainfiles-11`, `engram-11`).

## The stretch that ran clean

- Issue created with no labels (`plainfiles-10`, `engram-10`), `ticket:start` worktree, `brain:config set memory.lane.enabled true`: `plainfiles-14`, `-15`; `engram-14`, `-15`.
- `brain:ship` after the push opened PR #2 with no `gh pr create` fallback: `plainfiles-19`, `engram-19`. All 11 checks passed: `plainfiles-20`, `engram-20`.
- Post-merge runs for the feature merge, the lane merge and PR #4 succeeded; the issue list shows only closed #1, so no alarm: `plainfiles-21`..`-23`, `-60`..`-62`, `-79`..`-81`; `engram-21`..`-23`, `-60`..`-62`.
- Memory chain: R1, R2 saved with `--issue 1`, shipped through the lane (PR #3 in both repos, 11 checks green): `plainfiles-30`, `-31`, `-52`; `engram-30`, `-34`, `-50`..`-52`.
- Checkout B had no `.env`; before the lane merge search found nothing, after `brain:memory:pull` it found the records: `plainfiles-40`..`-42`, `-63`; `engram-40`..`-42`, `-63`.
- Main checkout pulled its own lane merge cleanly: `plainfiles-64`, `engram-64`.

## Seams

| Seam | Where | Result | Evidence |
|---|---|---|---|
| 1. hydration deferred while engram is unavailable, then recovered | engram | recovered. With no engram on PATH, `save` exited 0 with "hydrating it into engram was deferred"; `engram search` found nothing; `brain:memory:pull` imported 1/1; the search found R1 | `engram-30`, `-31`, `-32`, `-33` |
| 2. `mrCreate` failure after the push, then retry | plainfiles | recovered. First attempt: `memory.ship.diverged` (#1190), `plainfiles-66`. After the maintainer's branch deletion (`-67`) the injected failure printed `memory.ship.prCreateFailed`, left the branch pushed with no PR (`-68`); the retry opened PR #4 (`-69`) | `plainfiles-65`..`-69` |
| 3. foreign path makes a gate red, then revert makes it green | plainfiles | recovered. Hooks allowed the foreign-path commit and push once the message had `#N`. `issue-link` and `lane-paths` failed (`-75`); after the revert all 11 passed (`-78`) | `plainfiles-70`..`-78` |
| 4. checkout B before and after the lane merge | both | recovered | plainfiles `-40`..`-42`, `-63`; engram `-40`..`-42`, `-63` |
| #1118, the capturing checkout pulls its own lane merge | both | recovered: fast-forward, no conflict, records verified in HEAD | `plainfiles-64`; `engram-64` |

## Findings

- (#1231) `brain:memory:ship -- --help` does not show help: it runs a real ship (`plainfiles-50`, transcribed after the fact).
- (#1231) `brain:memory:save -- --help` errors instead of showing help: "--type is required and has no safe default" (`plainfiles-83`, a re-run recorded afterwards; the first occurrence was unrecorded, in the engram main checkout, and saved nothing).
- #1190 reproduced for the third time: `memory.ship.diverged: refs/heads/memory/...-2026-10-01 is behind origin's matching ref — refusing to force-push.` (`plainfiles-66`). The maintainer deleted the remote branch (`plainfiles-67`).
- #1189: `memory/cli: backend 'plainfiles' does not implement op 'import'` printed on the plainfiles main-checkout pulls `plainfiles-24` and `plainfiles-64`. It did not print on the checkout-B pull (`plainfiles-63`) nor on the engram pulls.
- #1168: `.memory` is dirty after ship and pull: plainfiles ` M .memory/index.jsonl` (`plainfiles-64`, also `-70`); engram `?? .memory/` (`engram-24`) and `?? .memory/index.jsonl` (`engram-64`).
- The commit-msg hook stops a message with no `#N` (`plainfiles-72`: "✗ commit-msg: message must reference a ticket (#N)."), but nothing local stops a foreign path on a lane branch; only CI does (`plainfiles-75`).
- The `*-16-commit` transcripts' `exit=0` line reflects the final `git status`, not the commit; the commit's success is the `[feat/... 3a8a8a0]` / `[... 7c61bf4]` line.
- Both lane ships print `auto-merge was refused (unsupported)` (the known `allow_auto_merge: false` setting) and `BRAIN_MEMORY_TOKEN is not set` (`plainfiles-50`, `engram-50`, `plainfiles-69`).
- Expected-open and unchanged: #1115, #1117, #1167 (`brain:memory:ship` prints no PR URL; `brain:ship` does).

## PRs and issues created

- plainfiles: issue #1; PR #2 (feature, `brain:ship`); PR #3 (lane, R1/R2); PR #4 (lane, R3, seams 2/3).
- engram: issue #1; PR #2 (feature, `brain:ship`); PR #3 (lane, R1/R2).

## A note on what the evidence contains

The transcripts carry the operator's hostname (in lane branch names and record provenance) and absolute home paths. They contain no credential: `credential-scan.txt`.
