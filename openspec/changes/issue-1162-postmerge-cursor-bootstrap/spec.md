# Spec: post-merge cursor bootstrap (#1162)

- REQ-1: When `refs/governance/audit-cursor` is absent on origin AND no prior run of `governance-postmerge.yml` ever succeeded, the window step creates the cursor and resolves the window; no `governance:cursor-*` issue is filed.
- REQ-2: The created cursor is the parent of the adoption commit (first commit on the first-parent line that added the workflow); the first window therefore contains the adoption commit. If the adoption commit is the root, the cursor is the root itself.
- REQ-3: When the cursor is absent and a prior successful run exists (the cursor was deleted), the step files `governance:cursor-missing`, emits no range, exits 2, and the body says why automatic initialization was refused.
- REQ-4: When the prior-run evidence cannot be read, or no adoption commit is found, the step halts with an alarm and creates no cursor.
- REQ-5: Creation is a remote compare-and-swap with empty expectation; a cursor that appears in the race is never overwritten. A present cursor is never touched.

## Scenarios
- (a) fresh repo, no cursor, no prior success: bootstrapped, range emitted, no alarm.
- (b) deleted cursor, prior success exists: alarm, no range, no cursor.
- (c) after bootstrap, `rev-list <range>` contains the adoption commit.
