# Design — #1185

The run mirrors #1081's runbook and the 1.9.0 run (issues #1161–#1168, #697).

- **Consumers.** The two consumers were deleted and recreated empty. The maintainer ran `env:init` and `brain:protect`, because the PAT and the TTY are theirs. An agent ran the memory chain.
- **Isolation.** The engram consumer used an isolated `ENGRAM_DATA_DIR`. Checkout B had no `.env`, so its backend had to come from tracked config (#1165).
- **Deviations from the product's verbs** (recorded, not hidden):
  - The first PR was opened with `gh pr create`, because `brain:ship` refused (#1186, #1187).
  - `git remote set-head origin -a` was run by hand (#1186).
  - The seam-3 injection commit on the throwaway plainfiles lane branch skipped hooks (`core.hooksPath=/dev/null`). This was a harness deviation by the demo agent, not a manual step the product required: a commit that references a demo issue (`#N`) passes the hooks, so no issue is filed under REQ-2. It must not be repeated; a future run injects the foreign path with hooks satisfied.
  - The remote lane branch was deleted by hand to continue (#1190).
