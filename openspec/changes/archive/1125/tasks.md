---
status: draft
issue: 1125
---

# Tasks — #1125

Strict TDD. Runner: `npm test` (`node --test`).

- [x] **T1** Inventory every default site (design.md, "Every place that picks a platform").
      There are two: `platform.mjs#resolvePlatform` and `bootstrap.sh` §6. Every other
      `antigravity` hit is explicit, a comment or a path.
- [x] **T2** Refactor with no behavior change: name the default and the membership in
      `platform.mjs` (`DEFAULT_PLATFORM`, `AGENT_PLATFORMS`) while they are still the old
      values, so the RED run fails on behavior and not on a missing export.
- [x] **T3** RED on `resolvePlatform` (`cli.test.mjs`, `agent-runtime.test.mjs`): 4 failures,
      each `expected 'claude' / actual 'antigravity'` or the membership order.
      "A stated antigravity on every path" passed before the change as well. It is a
      regression guard, not a RED.
- [x] **T4** GREEN: `DEFAULT_PLATFORM = 'claude'`, `AGENT_PLATFORMS = ['claude','antigravity','plain']`,
      with comments pointing at #1114. The two files run 59 pass, 0 fail.
- [x] **T5** Write `bootstrap.default-platform.test.mjs`, which lifts §6 verbatim, as in
      #657/#1093. It covers the default, `.env` recording it, stated `antigravity` on all four
      shell inputs, process env vs `.env`, an engine name as the legacy key, and the 90-case
      parity table against `resolvePlatform`.
- [x] **T6** RED against the original `bootstrap.sh` (first cut of the test): 5 of 7 fail, and
      the parity table reports mismatches on the process-env, legacy-key and default rows. After
      the persistence rule was tightened (T8), all 7 fail against the original, because the
      lifter no longer finds the old shape.
- [x] **T7** GREEN: §6 takes `resolvePlatform`'s precedence and default. 7 of 7 pass.
- [x] **T8** A packed-tarball run showed `brain:upgrade` printing
      `AGENT_PLATFORM=antigravity npm run brain:env:init` to a fresh consumer. The test for
      "a process-env platform on a fresh `.env`" was inverted to "is NOT persisted" and the
      shell was changed to match: REQ-1125-6, design decision 2.
- [x] **T9** Update the tests that pinned the old default or would become vacuous, with a reason
      in each (design.md table). Nothing was deleted.
- [x] **T10** Source-tree smoke `node test/bootstrap-smoke/smoke.mjs`: RED on
      `AGENTS.md (harness init ran)` after the flip, then GREEN once the post-condition was
      `.claude/settings.json` (deleted from the fixture first) plus `.env` stating
      `AGENT_PLATFORM=claude`.
- [x] **T11** ADR-0036 check on a consumer built from the packed tarball (design.md, "ADR-0036
      evidence"). A, B and C all resolve as expected. This surfaced the three known gaps.
- [x] **T12** Draft `brain-drafts/adr-0024-amendment-2.draft.md`. `planAmendment` returns
      `ok: true`, and both `amend-find` anchors occur exactly once (1, 1).
- [x] **T13** Full `npm test`: 6432 tests, 6429 pass, 0 fail, 3 skipped. `npm run brain:repo:check`
      exits 0.
- [ ] **T14** (maintainer) Promote the amendment with `brain:promote` on this branch. Rule on
      known gap 1 (the `.claude/settings.json` clobber) before shipping.
