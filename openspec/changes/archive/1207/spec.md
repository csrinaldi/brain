# Spec (#1207)

- REQ-1: Before `issueViewFn`, `runShip` calls the injected `headPushedFn({branch})`; any state other than `in-sync` returns exit 1 with ZERO forge calls.
  - Scenario missing: message names `git push -u origin <branch>`.
  - Scenario behind (remote is an ancestor of HEAD): names `git push origin <branch>`.
  - Scenario diverged: says the remote has commits not in local history; suggests no push, no force.
  - Scenario unknown (ls-remote failed): names the cause.
- REQ-2: `checkHeadPushed` uses git plumbing only (`ls-remote`, `rev-parse`, `merge-base`), no forge call, and never pushes.
- REQ-3: Ordering is `checkFn` then `headPushedFn` then `issueViewFn`; a red check still makes zero further calls.
- REQ-4: A fresh consumer on an unpushed branch never sees a provider error (e2e).
