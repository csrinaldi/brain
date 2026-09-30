# Release notes draft (#1188)

- A fresh consumer's second merge no longer summons a human. The post-merge audit now evaluates the same memory-gate predicate as the PR-time gate: same scope (issue-scoped, #1024) and same tier mapping (`lite` is detection-only there and in the audit).
- A repository with no `.memory/records/*.jsonl` yet has no memory history: its merges pass post-merge with `[memory: no history yet - abstained]`. From the first record on, the full predicate applies. At `standard`, a PR with no scoped record still fails at PR time; only the post-merge audit abstains.
- A `governance:*` alarm issue now closes itself, with a comment linking the passing run, when a later run clears the condition (audit-class alarms on a clean audit, `archive-sweep-failed` on a clean sweep). No new workflow permission: closing uses `issues: write`, already required to file alarms. A close that cannot happen is a `[WARN]`, never a red run. Alarms filed before you upgrade close on the next clean run.
- New VCS port verb `issueClose` (GitHub and GitLab).
- Known residual: a `skip:memory-gate` honored at `standard` is not replayed by the audit, which has no label-event evidence, so it can still surface post-merge as a memory failure.
