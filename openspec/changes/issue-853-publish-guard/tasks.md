---
issue: 853
phase: tasks
---

# Tasks — #853

```brain-slice-scope/1
{"slice": 1, "claims": ["R853-1", "R853-2"], "terminal_pr": "this PR -> main"}
```

- [x] T1. Extract the decision as a pure function over (tagged, head, isAncestor)
      and unit-test the four scenarios of R853-1.
- [x] T2. Wire it into the suite check via `git merge-base --is-ancestor`.
- [x] T3. Confirm the sibling workflow-guard test still passes (R853-2).
- [x] T4. Full suite green on main's real state; PR; cold review.
