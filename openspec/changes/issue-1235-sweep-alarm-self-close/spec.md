# Spec

- REQ-1: `resolve-sweep` MUST run only when the sweep step succeeded AND recorded no `alarm` output in this run.
- REQ-2: Every path in the `sweep` step that files an alarm MUST write `alarm=<label>` to `GITHUB_OUTPUT`.
- REQ-3: `resolve-audit` MUST NOT run in a run that filed an audit-class alarm.
