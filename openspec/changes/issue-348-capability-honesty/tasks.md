---
issue: 348
phase: tasks
---

# Tasks — #348

```brain-slice-scope/1
{"slice": 1, "claims": ["R348-1", "R348-2", "R348-3"], "terminal_pr": "this PR -> main"}
```

- [x] T1. `approvalCount` in both `capabilities()`, probed; contract tests for
      available / unavailable+remedy / unknown, and the two-axis independence.
- [x] T2. GitLab `branchProtect` names the unapplied approval count; silent at
      `requiredReviews: 0`; GitHub unchanged (R348-2).
- [x] T3. `brain:governance-status` prints the axis with its remedy (R348-3).
- [x] T4. Staged, full suite, PR, cold review to APPROVE.
