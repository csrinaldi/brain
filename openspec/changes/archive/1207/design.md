# Design (#1207)

`headPushedFn` is injected like `checkFn`/`labelPreflightFn`, so `runShip` stays testable; the real one is `checkHeadPushed({branch, gitFn})` with `gitFn` injected, so classification is tested without a repository. It sits after `checkFn` and before `issueViewFn` because it is a local+git check: it needs no forge and fails faster and more cheaply than any forge read, and the gate still goes first (a red tree changes nothing about the remote).

The behind-case hint is `git push origin <branch>` rather than a bare `git push`: branches made by `ticket:start` use `--no-track` (#785), so a bare push may have no upstream. Remote name is `origin`, as everywhere else in the verbs. The header comment's steps and ordering line are updated. The e2e fixture now pushes the feature branch, as an operator must.
