# Design (#1188)

## One predicate
`evaluateMemoryGateFallback` (run-check.mjs) moves, with `extractIssueNumber` and `requiresClosingKeyword`, into `governance/checks/memory-gate.mjs` as `evaluateMemoryGate` (steps 2-6 of the gate, unchanged). `memoryGateVerdict` = that plus `mapDetectionToWarning`. run-check imports it; `evaluateMerge` calls `auditMemoryVerdict`, which calls `memoryGateVerdict`. The module imports no port (git only, through an injected reader), so the audit does not inherit run-check's port-reach profile.

The audit's inputs, mapped to the gate's: records = HEAD's `.memory/records/` (already contains whatever the default branch holds, so the gate's `origin/<default>` source is stubbed empty); body = the merge's `issueLinkBody`; target = default (closing-keyword extraction, as for a default-branch PR). `skip:memory-gate` is NOT replayed: the audit has no label-event evidence for the applier. Residual: an honored skip at `standard` still surfaces as a `memoryPresence` failure in the audit (as it did before); out of scope here.

## Early merges: abstain, do not fail
A consumer with no record file has nothing the evidence could come from: no record can exist before the first save. Failing it summons a human (`audit-unrevertible`, cursor pinned) for a precondition the consumer could not have met. `memoryPresence` was never auto-revertible, so abstaining removes no revert, only a false alarm. It is the ONLY divergence from the gate; it is keyed on "no record file exists" (not "no session_summary"), is visible in the `[PASS]` line, and ends at the first record. The gate itself is unchanged: at `standard` a PR with no scoped record still fails at PR time. `brain-audit` and `brain-metrics` share `readMemoryHistory(cwd)` so their verdicts stay equal.

## Alarms close themselves
`alarm.mjs` gains `findOpenAlarm` (extracted from `fileAlarm`, which now uses it), `resolveAlarms` and the `resolve` CLI. Writes go through the port: `issueComment` (existing) and the new `issueClose`. `issueUpdate` deliberately cannot carry `state`, so closing needed its own verb; it carries `state` only. The vcs-contract row is drafted in `brain-drafts/` (brain/core is read-only here); `issueClose` sits in the drift guard's `PENDING_PROMOTION` until promoted.

Groups: a clean audit resolves cursor-missing, cursor-unknown, audit-unrevertible, revert-blocked, audit-uncomputable, postmerge-unreported. A clean sweep resolves archive-sweep-failed. A test derives every `label="governance:..."` in the workflow and fails if one is in neither group.

GitLab: the governance fragment files no post-merge alarms and has no post-merge job, so nothing there files or needs to close one. The port verbs exist on both providers.

## Permissions
None added. `issues: write` (held for filing, #462) covers closing.
