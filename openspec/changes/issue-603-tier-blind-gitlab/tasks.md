---
issue: 603
phase: tasks
---

# Tasks — #603

```brain-slice-scope/1
{"slice": 1, "claims": ["R603-1", "R603-2", "R603-3"], "terminal_pr": "this PR -> main"}
```

- [x] T1. `run-check.mjs`: route through `mapDetectionToWarning` in `main()`;
      tests for the three scenarios of R603-1 (detection→0, required→1,
      uncomputable→2).
- [x] T2. Read every test that pins a detection-gate exit code; update only
      those that pin the defect, each with its reason (D5).
- [x] T3. `openspec/specs/governance/spec.md` provider-neutral (R603-2).
- [x] T4. `gitlab-governance.yml` header states where the tier is resolved (R603-3).
- [ ] T5. Full suite; memory record; PR; cold review rounds.
