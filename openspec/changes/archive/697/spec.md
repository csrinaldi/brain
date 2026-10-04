# Spec: branch grammar (#697)

- REQ-1: `parseIssueBranch` returns `{issueNumber,type,slug,shape}` for `{type}/issue-{N}-{slug}` (canonical) and `{prefix}/{N}-{slug}` (legacy); `null` otherwise, never a fabricated number.
- REQ-2: `brain:ship` resolves N from both shapes and derives the PR title slug from the parsed slug.
- REQ-3: A branch with no number refuses (exit 1) with a message naming both shapes and `brain:ticket:start`.
- REQ-4: `brain:next` reads the issue through the same parser.
