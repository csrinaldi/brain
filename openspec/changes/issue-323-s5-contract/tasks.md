# Tasks: #323 S5 — single PR (slice ticket at PR time; #323 lives to S7)

- [x] 1.1 RED+GREEN: parseSliceScopes — two blocks parsed in order; JS,
      bad-claims, missing-terminal refused; absence → [].
- [x] 1.2 RED+GREEN: the structure check — declared-but-broken goes red
      naming the file; absence passes repo-wide.
- [x] 1.3 RED+GREEN: strandedTrackers pure + the brain:status line —
      feature/* only, open-PR-carried excluded, REPORT.
- [x] 1.4 Dogfood: THIS tasks.md carries the first real block.
- [x] 1.5 Follow-up ticket (reviewer consumption + new-change enforcement);
      slice ticket; suite; gates; memory; PR; review.

```brain-slice-scope/1
{"slice": 1, "claims": ["S5-D1", "S5-D2", "S5-D3", "S5-D4", "S5-D5"], "terminal_pr": "this PR -> main"}
```
