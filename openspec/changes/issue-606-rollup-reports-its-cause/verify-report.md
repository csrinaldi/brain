---
status: verified
issue: 606
verdict: PASS WITH WARNINGS
---

# Verify Report — issue #606 (the rollup reports its cause)

Full report persisted to Engram: `sdd/issue-606-rollup-reports-its-cause/verify-report` (project `brain`).

## Verdict: PASS WITH WARNINGS

## Summary

- Tier-3 correction (commit `89c9f99` writing directly to `brain/core/`) is independently
  confirmed fully reverted: `git diff main --stat -- brain/core/ brain/project/` is empty,
  no net change across `main..HEAD`. The intended edit lives in `brain-drafts/` for a human
  to sign.
- 6 of spec.md's 7 requirements fully satisfied with runtime-passing tests, verified by
  direct source read plus independent test execution.
- Requirement 7 ("the 13 remaining sites are filed") is PARTIAL: none of the 13 sites'
  source was touched (confirmed), but the follow-up GitHub issue has not actually been
  filed yet (`gh issue list --search "606"` shows none) — task 9.1 correctly left
  unchecked. **CRITICAL — blocks archive** until the issue is filed or the gap is
  explicitly accepted.
- Mutation battery: 8 of 13 IDs independently re-run this session (M3b, M9, M5a, M6, M6b,
  M7, M10, M11) — all confirmed RED as claimed, each reverted cleanly via `git checkout --`.
- Corpus provenance: 4 rows independently reproduced against a real installed `gh 2.46.0`
  binary this session — all matched the pinned corpus text exactly. No fabricated rows
  found.
- Verdict-unchanged constraint (`evaluateTranche` never APPROVEs on uncomputable evidence)
  holds structurally and under M5a/M10 mutation.
- Test counts independently reproduced: `main@7439608` = 3821/3821, `HEAD` (8 commits) =
  3875/3875, 0 failures. `git status --short` clean at session end. No AI-attribution
  trailers in any of the 8 commits.

## Issues

**CRITICAL**: spec.md's "a follow-up issue exists naming all remaining sites" scenario is
not yet true — file GitHub issue for the 13 filed sites (`github.mjs:204,309,402,524,587,630`
`gitlab.mjs:230,307,360,393,493,554,672,1010`, with `checkRuns:309` prioritized first) before
archiving, or explicitly accept the gap in the archive report.

**WARNING**: none.

**SUGGESTION**: resolve the two flagged claims in `brain-drafts/README.md` (enum size,
"13 sites" count vs `gitlab.mjs:360` now falling inside `prStatusRollup` itself) in the same
pass as filing the 9.1 follow-up issue, since both touch the same site list.

See the Engram observation for the full requirement-by-requirement matrix, mutation-by-mutation
evidence, and corpus spot-check detail.
