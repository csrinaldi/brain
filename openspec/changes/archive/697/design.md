# Design: branch grammar (#697)

New pure module `lib/branch-grammar.mjs` with two anchored regexes (canonical tried first). Slug is required in both shapes, preserving the existing rejection of `feature/42`. Readers that already work with a stricter, purpose-built regex are left alone. `brain-start.mjs` unchanged; `harness-contract.md` needs no edit.

## Review round (one grammar, declared differences)
`branch-grammar.mjs` owns the canonical regex (`CANONICAL_BRANCH_RE`), `parseCanonicalIssueBranch`, `parseIssueBranch`, the lenient `findIssueInBranch` and `nonEmptySlug`. The slug is optional after the dash (`fix/issue-5-`, `feature/42-`); producers fall back to `task`. `memory/` lane branches and `YYYY-MM-` date segments are never issues.
- brain-ship: `parseIssueBranch` (canonical + legacy).
- capture-provenance, status snapshot: canonical only, deliberately (durable writes never guess; legacy is not the documented contract).
- brain-next: `findIssueInBranch`, lenient, so a numbered branch never fails open to `ready`.
- session-start: NOT routed. It matches `issue-N` anywhere, case-insensitively, to find change dirs; that is a different question.
Pinned by `lib/branch-grammar.parity.test.mjs`.
