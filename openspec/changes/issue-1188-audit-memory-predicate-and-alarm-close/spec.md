# Spec (#1188)

- REQ-1: The post-merge audit and the PR-time `memory-gate` evaluate the same function (`evaluateMemoryGate`, `checks/memory-gate.mjs`) with the same tier mapping (`mapDetectionToWarning`). For the same records, issue and tier their verdicts are equal. Pinned by a parity matrix (records: none-scoped, scoped summary in the tree, scoped summary on main via the lane, partial; tiers: lite, standard, regulated).
- REQ-2: At `lite`, where `memory-gate` is detection-only, the audit never turns a memory miss into a failure.
- REQ-3: A repository with no record file under `.memory/records/` has no memory history; a merge there passes with a visible note (`[memory: no history yet - abstained]`). From the first record on, the full predicate applies. A tree whose only record files are unreadable is history, not abstention.
- REQ-4: A real-git replay of the demo (adoption, then a lane-enable merge with no records, at `lite`) through the real `brain-audit.mjs` exits 0 with no `memoryPresence` failure.
- REQ-5: `alarm.mjs resolve <run-url> (audit|sweep|label)...` closes the open alarm for each label through the VCS port (`issueComment` with the run link, then `issueClose`), reading existing alarms with the same reader `fileAlarm` uses (`findOpenAlarm`). A non-passing run closes nothing. A failed comment does not stop the close; a failed close is a warning, never a thrown error or a red job.
- REQ-6: `governance-postmerge.yml` runs `resolve-audit` only on a clean audit (code 0, cursor advanced) and `resolve-sweep` only when the sweep succeeded. Every alarm label the workflow files belongs to the audit or sweep group.
- REQ-7: No permission scope is added: closing an issue is covered by `issues: write`. The scope set is pinned by test.
- REQ-8: `issueClose({project, number}) -> {ok:true}|{ok:false,error}` exists on both providers, carries `state` only, and never throws.
