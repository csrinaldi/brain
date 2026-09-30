# Proposal: the local gates are the CI gates (#1186, #1187)

## Problem
The 1.10.0 exit demonstration (#1185) could not open a fresh consumer's first PR with `brain:ship`, although the same PRs opened by hand passed all 11 CI checks. Evidence: `issue-1185-phase-1-exit-demo-1-10-0/evidence/brain-test-plainfiles-13..17`, `brain-test-engram-12`.

- #1186: `brain:check` built `govCtx` without `repo`, so `issue-link` asked the port for `repos/undefined/issues/1` (404). The default branch came only from `refs/remotes/origin/HEAD`, which a fresh `git remote add` + push never sets, so the checks were UNVERIFIED until an undocumented `git remote set-head`.
- #1187: `memoryPresence` was evaluated by the RAW evaluator, while CI exits through `mapDetectionToWarning`; at `lite` (the default tier of every fresh consumer) CI demotes `memory-gate` to detection and the local gate did not. `npmTest` ran `npm test` everywhere, while CI runs it only where `.brain-source` exists; a consumer's `npm init` placeholder script (`echo "Error: no test specified" && exit 1`) failed it.

## Approach (reuse, never duplicate)
- One composition for "evaluate, then apply the tier": `run-check.mjs#runCheckWithPolicy`. CI's `main()` and `brain:check` both call it.
- One module for what a local gate must know before a PR exists: `lib/local-gate-context.mjs` (project slug, default branch, `npm test` applicability). No new rule; each answer is the one the rest of the product already gives.
- Default branch: `DEFAULT_BRANCH` -> recorded `origin/HEAD` -> `git ls-remote --symref origin HEAD` via `postmerge/cursor.mjs#resolveDefaultBranch` (#1162). Unresolvable stays `null` -> UNVERIFIED; `main` is never guessed.

## Decisions
- Fallback to the remote instead of `env:init` running `set-head`: the read works on every consumer including one that never ran `env:init`, it is one read instead of a mutation of the operator's repo, and `brain:check` stays read-only. Cost: one `ls-remote` when `origin/HEAD` is unset (local otherwise); offline it degrades to UNVERIFIED, as before.
- `npm test` follows CI's own condition (`.brain-source`), then "no `test` script". Both are "not applicable", printed as `[N/A]`, never a failure.
- `diffSize` and `adrPresence` stay on the pure predicates CI calls (same function, same tier budget); the `size:exception` divergence remains the safe direction (#340).

## Out of scope
- CI's `local-checks` also runs `brain:nav` and `memory:index-lag`; `brain:check` does not. That is local laxer than CI, pre-existing, not a fresh-consumer blocker. Left for a follow-up.
- `docs/adoption.md` and `brain/core|project/**` are untouched; guide text is in `release-notes.md`.
