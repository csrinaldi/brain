---
status: draft
issue: 518
---

# Tasks — #518

- [x] **T1** `workflow_dispatch` on `governance-postmerge.yml`, no `inputs:`.
- [x] **T2** `auditedBase(range)` — `auditedTip`'s mirror, `null` when there is no base.
- [x] **T3** The remedy emitted from the window, with a visible placeholder as the fallback
      and wording that says accepting covers the window.
- [x] **T4** Three guards, one of which EXECUTES the printed command.
- [x] **T5** Full suite: **2944 tests, 0 failures**.
- [x] **T6** Four mutations RED: the exact pre-#518 string · the credible half-fix
      (`<to>` added, `<from>` still the offender) · a fabricated base · the window wording
      dropped.

## Recorded

- [x] **T7** The mutation harness reported two false greens on its first run, because it
      diffed against HEAD while the working tree carried uncommitted work. One mutation had
      aborted on a perl interpolation error and one had hit a branch the tests never reach;
      both read as landed. Fixed by diffing against a pre-mutation snapshot with literal
      replacement. #409's lesson from a third direction: printing the diff is not enough if
      it is a diff of the wrong two things.
- [x] **T8** Residual (2) — 33 of 101 first-parent commits invisible — deliberately NOT
      closed here. It is a ruling that moves what the cursor, the exemption and `[FAIL-SHA]`
      key on, and it does not belong in a PR whose other two changes are mechanical.
