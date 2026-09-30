# Spec: post-merge cursor bootstrap (#1162)

- REQ-1: When `refs/governance/audit-cursor` is absent on origin AND no prior run of `governance-postmerge.yml` ever succeeded, the window step creates the cursor and resolves the window; no `governance:cursor-*` issue is filed.
- REQ-2: The created cursor is the ADOPTION COMMIT itself (first commit on the first-parent line that added the workflow), in every shape (root, direct push, merge commit). The first window audits everything after it; the adoption commit is never an audit subject.
- REQ-3: When the cursor is absent and a prior successful run exists (the cursor was deleted), the step files `governance:cursor-missing`, emits no range, exits 2, and the body says why automatic initialization was refused.
- REQ-4: When the prior-run evidence cannot be read (including a provider answering `unsupported`), or no adoption commit is found, the step halts with an alarm and creates no cursor.
- REQ-5: Creation is a remote compare-and-swap with empty expectation; a cursor that appears in the race is never overwritten. A present cursor is never touched; a lost race re-reads the ref and proceeds when it now exists.
- REQ-6: Prior-run evidence comes only through the VCS port verb `workflowRunSucceeded({project, workflow, branch})` -> `{state: 'succeeded'|'none'|'unknown'|'unsupported'}`, filtered by the default branch. `cursor.mjs` never spawns `gh`.

## Scenarios
- (a) fresh repo, no cursor, no prior success: bootstrapped, range emitted, no alarm.
- (b) deleted cursor, prior success exists: alarm, no range, no cursor.
- (c) after bootstrap, the window holds every commit after the adoption and not the adoption.
- (d) end to end: an over-budget direct-push or merge-commit adoption, then a compliant commit: the real `brain-audit.mjs` over the window exits 0 with no `[FAIL-SHA]`.
