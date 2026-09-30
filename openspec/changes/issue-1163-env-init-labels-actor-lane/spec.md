# Spec — env:init labels, actor and lane notice (#1163, #1164, #1166)

## REQ-1163-1 labels are created through the port
`env:init` MUST create, through the VCS port and never a raw `gh`/`glab` call, every label of `desiredLabels`: the provider-resolved `governance.approvedLabel`, every `TYPE_LABELS` entry (GitLab scoped `type::x`), `size:exception`, `skip:memory-gate` and, on GitHub, every `governance:*` label the postmerge workflow files (`ALARM_LABELS`, pinned to the workflow by test).

## REQ-1163-2 idempotent and reported
It MUST read `labelList` first and create only what is absent; a second run MUST make no create call. It MUST print what it created, or that all already exist.

## REQ-1163-3 degrades to pending
When the label set cannot be read (VCS unreachable or unauthenticated), the project slug is empty, or the remote refuses a create, the step MUST NOT crash and MUST NOT write blindly: it is a pending step whose text carries `npm run brain:env:init` and the hand command for the approved label. `env:init` still exits 0.

## REQ-1163-4 the port verb
`labelCreate({ project, name, color?, description? })` returns `{ ok: true, created }` or `{ ok: false, error }`, never throws. An already-existing label (GitHub 422 `already_exists`, GitLab 409) is `{ ok: true, created: false }`. It applies the label to nothing.

## REQ-1164-1 actor resolution
`env:init` MUST resolve `brain.actor` in this order: an existing valid value is kept and never overwritten; else the authenticated VCS identity (`whoami`) as `@<username>`, written ONLY with `git config --local`; else a pending step with `git config --local brain.actor @<handle>`. It MUST NOT read `user.name`. A username that is not a `HANDLE_RE` handle is pending.

## REQ-1166-1 the lane notice
`env:init` MUST state the lane's state on every run through the tier-notice mechanism: on, or off with why it is off by default and the exact command `npm run brain:config -- set memory.lane.enabled true`. An absent key reads as off. Both catalogs (en, es) carry the keys.

## REQ-FC-1 failure classes
The labels and actor steps exit 0 (done), 3 (pending, optional with its next step) or another code (a defect of the step: REQUIRED). New catches and `||` sites carry swallow-guard markers and the new module is in the guard's scope.

## REQ-DOC-1 the guide describes 1.9.0
`docs/adoption.md` gains only what is true in the published 1.9.0: the lane is off by default and how to enable it, the `brain.actor` command, and creating `status:approved` by hand. The new `env:init` behaviour text lives in `release-notes.md`.
