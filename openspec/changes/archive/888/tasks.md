---
status: tasked
issue: 888
---

# Tasks: #888 — the lane ships: one push, one PR, and a credential the verb never holds

Implements `spec.md` under the ratified ruling `sdd/issue-888-lane-ship/ruling` (D1–D6,
2026-09-10) and `design.md`'s A1–A7. Parent: #864 task 3.1b, ADR-0034 L1/L2/L5/L9.
Branch: `feat/issue-888-lane-ship`. Delivery: `ask-on-risk`, single PR pre-agreed, split at the
library/CLI seam (`stacked-to-main`) only if apply overruns the 400-line budget.

**Slice split, realized.** Apply landed as design.md's own pre-agreed fallback split: **#901 (the
library)** — sections 1–5 below (status bumps, the credential denylist, `lane/ship.mjs` +
`ship.test.mjs`, the bare-remote integration test, the `pre-push` non-invocation pin) — and
**#888 (the CLI)** — section 6 (the `ship` op, i18n, `package.json`), still pending. The split
needed the maintainer's `no-verify-bypass` exemption for `ship.mjs`/its tests, landed as its own
commit `4e3625ed` ahead of #901's library work (`check-refs-rules.mjs` is outside this slice's
edit authority — `brain/project/**`).

STRICT TDD MODE IS ACTIVE. Every implementation task below is preceded by its failing test task.
Test runner: `npm test` (node:test). Run the focused `node --test` command after each RED/GREEN
pair; run the full `npm test` before each commit.

## 0. Ticket reconciliation (read before implementing — no code in this section)

The ticket body of #888 (`gh issue view 888`) was read for the first time in this phase — neither
`sdd-propose` nor `sdd-design` had Bash available. Reconciled against the ratified ruling and
`design.md`:

- **0.1 — PR grammar, ticket WINS over `design.md` A4.** The ticket's literal grammar (ADR-0034
  L1) is:
  ```
  TITLE:      memory: <host> <date> (<n> records)
  BODY line1: Memory lane: <host> <date>
  BODY line2: Records: <n>
  BODY line3+: - .memory/records/<file>.jsonl   (one per path, sorted)
  ```
  This is a **delta** from `design.md` A4, which built `title` as the *lowercase, no-count*
  string `memory lane: <host> <date>` (title === body's first line). It is also a narrower reading
  than `spec.md`'s Requirement "PR grammar and target," which says `title`/body line are the SAME
  string. Task 4.2's title/body builder produces the ticket's form — `title` carries the `(<n>
  records)` suffix, the body's first line does not. Task 4.1's test asserts this exact ticket
  grammar, not `design.md`'s literal wording. **This delta must be called out again in the PR body**
  (see section 9) so the maintainer can confirm it before merge — `spec.md`'s scenario text itself
  is not amended by this file; `sdd-verify` should read the ticket-grammar test as satisfying the
  spirit of the "matches verbatim" scenario with the corrected string.
- **0.2 — Trigger wiring (ticket item b) stays deferred to #889, per ruling D4.** The ticket asks
  #888 to own "the trigger wiring (session-end hook, `day:start` sweep, manual; never feature
  `pre-push`)." The ratified ruling D4 measured that `.claude/settings.json` is compiler-emitted
  with a byte-equality drift test shared with `.gemini/settings.json`, and that `issue-link`
  refuses a lane PR until #889 lands lane recognition — so wiring a live hook now would either
  make an unmeasured cross-platform settings claim or open a PR nothing can merge. **This is an
  explicit scope deviation from the ticket's item (b), not an oversight** — stated in the PR body
  (section 9) for the maintainer to confirm. The ticket's acceptance item (e) is mapped instead of
  dropped:
  - *"`pre-push` never invokes ship"* → proven now, task 5 (behavioural, not source grep).
  - *"a record does not wait for its feature"* → becomes #889's exit criterion (no live lane PR is
    possible against this repo's gates before #889 lands `issue-link`/`actor-check` lane
    recognition — measured in `explore.md`).
  - *"an unattended host authenticates with `BRAIN_MEMORY_TOKEN`"* → proven now, task 2's
    credential-threading tests (spec.md's two credential scenarios).
- **0.3 — Credential rule (ticket item c) is exactly D3/A5, already the shape below.** Separate
  process, ambient identity at `lite`, `BRAIN_MEMORY_TOKEN` on unattended hosts, `withoutCredentials`
  (`credential-env.mjs:158`) strips it elsewhere by DEFAULT membership. The ADR-0034 Risk 5
  statement is carried into the PR body verbatim (section 9) — the ticket asks for it explicitly.
- **0.4 — Auto-merge enablement gate (ticket item f).** `allow_auto_merge` stays `false` on
  `csrinaldi/brain` until #805; this slice's `mrAutoMerge` call still runs unconditionally
  (design A6/A7) and its refusal is reported, never fatal. The PR body states #805 as the
  enablement gate for the auto-merge *path*, not for this PR's mergeability.
- **0.5 — Non-goals (ticket + D6, restated in section 10).**

## 1. Artifact status bumps

- [x] 1.1 Bump `status:` frontmatter on `explore.md`, `proposal.md`, `spec.md`, `design.md` from
      `draft`/`proposed` to `tasked`, alongside this file — one shared value across the change dir
      (`phase-order-check.mjs`'s `STATUS_LADDER` is forward-only). No code touched by this task.

## 2. Unit — `lib/credential-env.mjs`: `MEMORY_TOKEN_ENV` in the default denylist (D3/A5)

- [x] 2.1 RED: extend `brain/scripts/lib/credential-env.test.mjs`:
      - a new test asserting `MEMORY_TOKEN_ENV === 'BRAIN_MEMORY_TOKEN'` is exported and appears in
        `credentialEnvNames()`'s default set with **no** `extra: [...]` argument (mirrors the
        existing `DEFAULT_TOKEN_ENV`/`REVIEWER_TOKEN_ENV` membership tests at `:29,34`);
      - a leak-regression test: `withoutCredentials(env, credentialEnvNames())` on an env
        containing `BRAIN_MEMORY_TOKEN` strips it, called with no `extra` argument;
      - **update the pinned test** `cold-5: the scrubbed set is pinned, so no prose can state a
        stale count` (`credential-env.test.mjs:83`) — the sorted list gains `'BRAIN_MEMORY_TOKEN'`
        at index 0 (sorts before `'BRAIN_REVIEWER_TOKEN'`), 8 → 9 entries. This edit is the
        intended RED signal for the whole file, not a side effect.
      Focused: `node --test brain/scripts/lib/credential-env.test.mjs` — RED (`MEMORY_TOKEN_ENV`
      undefined, pinned list mismatches).
- [x] 2.2 GREEN: `brain/scripts/lib/credential-env.mjs` — export
      `MEMORY_TOKEN_ENV = 'BRAIN_MEMORY_TOKEN'` beside `REVIEWER_TOKEN_ENV`, add it to
      `credentialEnvNames()`'s default `names` array (design A5: "derived where there is a source,
      literal where there is not" — this is a literal, labelled as one, same treatment as
      `FORGE_TOKEN_ENV`).
      Focused: same command — GREEN. `npm test` — green project-wide (nothing else imports the
      new export yet).

Commit: `feat(memory): denylist BRAIN_MEMORY_TOKEN by default (#888)`.

## 3. Unit — `lane/ship.mjs` (D1/D2/A1–A7)

- [x] 3.1 RED: `brain/scripts/memory/lane/ship.test.mjs` — unit, every injected fn a fake, per
      `spec.md`'s STRICT TDD test map and `design.md`'s testing-strategy row 1/1a/1b:
      - full run: fakes all succeed → the outcome shape populated, `pushed: true`, `pr.number` set;
      - `commit: null` **and** `ahead: 0` ⇒ zero `git`/`mrList`/`mrCreate`/`mrAutoMerge` calls, exit
        0 (A1's qualified predicate — NOT `commit === null` alone);
      - `commit: null` **and** `ahead: 1` (A1's recovery case — a prior push failed) ⇒ the run
        still pushes and opens/arms;
      - push argv contains `--no-verify` and **never** `--force`/a leading `+`, on any argv and in
        no source line (grep-based source guard, mirrors `auto-merge-outcome`-style precedent);
      - `behind > 0` (diverged) ⇒ `diverged`, exit non-zero, zero port calls;
      - PR already open by `headBranch` ⇒ `mrCreate` never called, `mrAutoMerge` still called
        (idempotent re-run via `mrList`);
      - `mrList` throwing ⇒ fatal, exit non-zero, `mrCreate` never called (A6 — the one un-caught
        port verb);
      - `requiredReviews: 0` ⇒ armed; `requiredReviews: 1` ⇒ refusal reported in `autoMerge.reason`,
        run still exits 0, PR stays open; **every** refusal reason (`requires-human-approval`,
        `unsupported`, `transport`) is non-fatal;
      - PR number: parses from `…/pull/123` and `…/-/merge_requests/12`; an unparseable URL
        triggers exactly one `mrList` re-scan; both failing ⇒ `pr.number: null`, `mrAutoMerge`
        never called, run still exits 0;
      - title/body match the **ticket's grammar** (task 0.1) byte for byte: title
        `memory: <host> <date> (<n> records)`, body line 1 `Memory lane: <host> <date>`, `Records:
        <n>` where `n === paths.length` from the three-dot diff (never `collected`), `base: 'main'`,
        `labels: []`;
      - credential threading: `BRAIN_MEMORY_TOKEN` present ⇒ every `vcs.*` call runs bound
        (assert via a spy `vcs` object); absent ⇒ `identityBound: false`, no ambient-credential
        assertion needed at this layer (that is `getVcs`'s job, out of scope — D6);
      - `--dry-run` ⇒ `vcs: null` passed in, a `git` fake that **throws** on any `push`/`fetch`
        argv still lets the run complete with `pushed: false`, `pr: null`;
      - the result object, `JSON.stringify`d, contains no value of `BRAIN_MEMORY_TOKEN` under
        either credential path (`identityBound` is a boolean, never the token).
      Focused: `node --test brain/scripts/memory/lane/ship.test.mjs` — RED (module does not exist).
- [x] 3.2 GREEN: `brain/scripts/memory/lane/ship.mjs` — `shipLane({root, project, tier, host, date,
      dryRun = false, identityBound = false, collect = collectLane, git = defaultGit, vcs})`
      implementing design A1's six-step sequence exactly (resolve branch → collect → survey → push
      → find → create → arm), A2's single bound `vcs` port parameter (never three separate
      function params), A3's push argv (`--no-verify`, full ref both sides, never `--force`/`+`),
      A4's pure title/body builders reading the three-dot diff for `Records:`/the path list, A6's
      exit-code table (`mrList` throw is fatal; `mrAutoMerge` refusal never is), A7's dry-run
      short-circuit before step 3. No import that touches the machine beyond the four injected
      seams.
      Focused: same command — GREEN. `npm test` — green (nothing else imports `ship.mjs` yet).

Commit: `feat(memory): add shipLane orchestration (#888)`.

## 4. Integration — `lane/ship.integration.test.mjs` (D2/D5/D6, design A3/A7)

- [x] 4.1 RED: `brain/scripts/memory/lane/ship.integration.test.mjs` — `testTmp('brain-lane-ship-')`
      temp repo + a **local bare remote** as `origin` + real `git` + a recording fake `vcs` port
      (no network):
      - the pushed ref lands on the remote with the expected tree;
      - a second same-day run **fast-forwards** and opens **no** second PR (`mrCreate` call count
        stays 1);
      - a remote ref moved behind our back ⇒ `diverged`, exit non-zero, the remote sha
        **unchanged** (nothing forced);
      - a killed push (remote ref absent, local ref ahead — A1's recovery case) recovers on re-run;
      - the main checkout's `git status --porcelain -uall` and `rev-parse HEAD` are byte-identical
        before and after (the ship touches no working tree — D6's scope boundary, "no source
        outside the declared file list").
      Focused: `node --test brain/scripts/memory/lane/ship.integration.test.mjs` — RED (module
      under test does not exist yet / fixtures absent).
- [x] 4.2 GREEN: no new production code — this test exercises `ship.mjs` (task 3.2) against a real
      git repo. If it goes red on anything beyond fixture setup, fix `ship.mjs`'s push/survey logic,
      not the test's assertions.
      Focused: same command — GREEN. `npm test` — green.

Commit: `test(memory): integration-test the lane push against a bare remote (#888)`.

## 5. `pre-push` non-invocation — behavioural, not source grep (D4, spec.md's own scenario)

Ticket item (5) asks for a test that "the hook never calls `memory:ship`." `spec.md`'s own
Requirement text for this scenario is explicit: *"asserted behaviourally (no fixture invokes it),
not by source grep."* The existing `pre-push.test.mjs` harness already IS that behavioural fixture
— a mock `node` records every op name (`$2`) the hook invokes to a call log. Extending it satisfies
the ticket's ask without adding a source-grep guard the spec rules out; noted here so `sdd-verify`
does not flag a missing grep test.

- [x] 5.1 RED: extend `brain/scripts/hooks/pre-push.test.mjs` with one more assertion on the
      existing call log (reuse `createMockBin`/`runHook`/`readCallLog`, no new fixture shape): after
      running the hook, `ops` contains `share` and `feature-checkpoint` (already asserted) and
      **does not** contain `ship`. Since `ship` is never invoked, this assertion is true against the
      *current* `pre-push` unmodified — so it is a **pin**, not a red-then-green pair on the hook
      itself: RED comes from the test file not yet containing the assertion at all (a missing test
      is a gap, not a failing one). Focused: `node --test brain/scripts/hooks/pre-push.test.mjs` —
      confirm the new assertion is present and passing without touching `hooks/pre-push`.
      `npm test` — green.

No commit-worthy production change in this unit — folded into the wrap-up commit (section 6) or its
own `test(hooks):` commit, whichever keeps the story readable at review time.

Commit: `test(hooks): pin that pre-push never invokes memory:ship (#888)`.

## 6. CLI — the `ship` op, i18n, `package.json` (D1, design A5, ticket item (d))

**Deferred to #888** (the slice split, see the note at the top of this file) — pending, not part
of #901's library PR.

- [x] 6.1 RED: `brain/scripts/memory/cli.ship.test.mjs` — under `BRAIN_MEMORY_TEST_ROOT`, reusing
      `cli.collect.test.mjs`'s bare-origin fixture (network-free by construction):
      - `"ship"` added to `VALID_OPS`, dispatched **before backend selection** (mirrors `collect`,
        `cli.mjs:306-359`);
      - success or no-op ⇒ exit 0, `--json` prints the outcome shape on stdout only, evidence on
        stderr;
      - `--dry-run` prints the plan, makes zero of ship's own network calls;
      - a pre-seeded divergent origin lane ⇒ exit 1 + `memory.ship.diverged`, this path never
        reaches the port;
      - the CLI never re-throws on any failure inside `shipLane` — caught, mapped to a
        `memory.ship.*` key, exit 1;
      - `BRAIN_MEMORY_TOKEN=<sentinel>` appears in **neither** stdout nor stderr on any path;
      - the op reads `process.env.BRAIN_MEMORY_TOKEN` exactly **once**, passes it as `getVcs`'s
        `identity`, and passes `shipLane` only the bound `vcs` port plus `identityBound: boolean`
        (never the token string — A5);
      - `npm run memory:ship` resolves from `package.json` (added in 6.2).
      Focused: `node --test brain/scripts/memory/cli.ship.test.mjs` — RED (`"ship"` not in
      `VALID_OPS`, no dispatch block, no npm script).
- [x] 6.2 GREEN: `brain/scripts/memory/cli.mjs` — add `"ship"` to `VALID_OPS` (`:103-119`), a
      dispatch block beside `collect`'s (`:359`) that: `loadBrainConfig()` for `project.slug`,
      `vcs.provider`, `governance.tier`; reads `BRAIN_MEMORY_TOKEN` once
      (`const identity = process.env[MEMORY_TOKEN_ENV] ?? null`); `vcs = dryRun ? null : await
      getVcs({config, identity})`; calls `shipLane({..., vcs, identityBound: identity !== null})`;
      owns its own `try/catch`, never re-throws; reads `--dry-run`/`--json` from
      `process.argv.slice(3)` (E4's scoping, never bare `process.argv.includes`).
      `package.json`: add `"memory:ship": "node ./brain/scripts/memory/cli.mjs ship"`.
      Focused: same command — GREEN. `npm test` — still red on i18n coverage until 6.3.
- [x] 6.3 RED → GREEN: add the fourteen `memory.ship.*` keys to
      `brain/scripts/i18n/en.mjs` **and** `es.mjs` in the same commit, matching design's exit table
      (A6) and `en.mjs:319-327`'s shape: `done`, `nothing`, `dryRun`, `pushed`, `prExisting`,
      `armed`, `autoMergeRefused`, `identityAmbient`, `diverged`, `pushFailed`, `prLookupFailed`,
      `prCreateFailed`, `prNumberUnknown`, `failed`.
      Focused: `node --test brain/scripts/i18n/coverage.test.mjs` — RED before, GREEN after both
      catalogs carry all fourteen keys. `npm test` — full suite green.

Commit: `feat(memory): add the ship CLI op, i18n and npm script (#888)`.

**PR 2 — closing note (this apply batch).**

- **Split, realized**: #901 (the library — `lane/ship.mjs`, `credential-env.mjs`'s denylist,
  sections 1–5 above) merged as **PR #902**, commit `16493771`. This change (#888, the CLI `ship`
  op, section 6) is **PR 2**, and closes the ticket.
- **Ruling D4's scope deviation, reconfirmed here**: trigger wiring (a `SessionEnd` hook, a
  `day:start` sweep) stays deferred to #889 per task 0.2 above. `pre-push`'s non-invocation was
  already pinned in PR 1 (section 5) — not re-tested in this batch.
- **PR grammar**: this slice implements the ticket's literal grammar (task 0.1), a delta from
  `design.md`'s original A4 wording — `title` carries `(<n> records)`, the body's first line does
  not. Reconciled, not re-opened.
- **cold-1 (PR #902's cold review) fixed in this batch**: `buildTitleAndBody()` ran unconditionally
  right after `collect()`, so a ref that had never been created locally (first run, nothing to
  ship) made the three-dot diff against `origin/main` fail on a bad revision — misreported as
  "origin/main could not be fetched" rather than "this ref never existed." Deferred the call to the
  two places it is actually needed (the `--dry-run` report, and once more just before
  find/create-PR after a real push), both of which already proved the ref exists. Full RED→GREEN
  evidence: `sdd/issue-888-lane-ship/apply-progress` (engram).
- **CLI test hardening**: `cli.ship.test.mjs` constructed the real, bound `vcs` port via `getVcs()`
  on every non-dry-run case, one fixture mistake away from reaching the real GitHub provider (see
  that file's own near-miss account). Added `BRAIN_VCS_TEST_MODULE`, a test-only seam in
  `cli.mjs`'s `ship` block that imports a fake port module directly instead of ever calling
  `getVcs()`, plus a full success-path test through the real CLI and a source-guard test pinning
  `getVcs()` behind the seam's absence — both proven to catch a real mutation before landing.
  **Correction (fresh cold review, next batch)**: this claim overstated the fix — `runCli()`, the
  helper FOUR of this file's own tests used, never set the new seam, so those four cases still
  constructed the real `getVcs()` port on every run (never invoked a verb, but bound a real
  credential to a real provider all the same). See "PR 2 review corrections" below for the actual
  closing state.

**PR 2 review corrections (fresh cold review, this batch)** — B1/C1/C2/C3/E1/E2/E3/E4 fixed, see
`sdd/issue-888-lane-ship/apply-progress` (engram) for full RED→GREEN evidence per finding:
- **B1 (blocker)**: `BRAIN_VCS_TEST_MODULE` is now constrained to resolve inside a committed
  `brain/scripts/memory/__fixtures__/` directory (`resolveVcsTestModulePath()` in `cli.mjs`) —
  an env-selected arbitrary-path import in the same process that reads `BRAIN_MEMORY_TOKEN` is a
  credential-adjacent attack surface no other seam in `brain/scripts/**` carries. The fixture
  module itself (`__fixtures__/fake-vcs-port.mjs`) is committed, reviewed code; its per-test
  answers are driven by DATA from a second, unconstrained env var, `BRAIN_VCS_TEST_SCRIPT`.
- **C1**: `runCli()` now sets the constrained seam on every call; a source-guard test pins this,
  and the prior batch's overstated closing note above is corrected.
- **C2**: `identityBound` is now proven both directions (bound `true` + unbound `false`, with the
  matching stderr message) — the mutant `identityBound: false` (hardcoded) is confirmed dead.
- **C3**: `shipLane`'s nothing-to-ship branch now returns `title: null, body: null` (was: the keys
  absent entirely), matching design.md's module map — see that file's own new C3 note.
- **E1**: a fixture script driving `mrCreate` to an unparseable URL + an empty `mrList` rescan
  proves the `prNumberUnknown` exit path (exit 0).
- **E2**: `shipLane` wraps `vcs.mrAutoMerge()` in try/catch — a throw maps to a non-fatal refusal
  (`{enabled:false, reason}`) rather than propagating and failing a run whose push and PR already
  landed.
- **E3**: `cli.mjs`'s `ship` catch now passes through `raced`/`badHost` the same way `collect`'s
  own catch does, with the matching `memory.ship.raced`/`memory.ship.badHost` i18n keys (en/es).
- **E4**: the divergent-lane CLI test now asserts the fixture's own pre-seeded `ref` appears in
  the CLI's diverged-error output — a UTC-midnight straddle between fixture setup and the CLI's
  own independent `hostname()`/date computation now fails loudly instead of silently taking the
  port path.

## 7. Wrap-up before the push

- [x] 7.1 `npm test` full run — record pass count before the promotion/handover note.
      **5022/5022 pass** (this batch's PR 2 review corrections; was 5015/5015 before this batch,
      +7: 6 new `cli.ship.test.mjs` tests — B1 escape/positive, C1 guard, C2, E1, E3 — and 1 new
      `ship.test.mjs` test — E2). Focused
      (`cli.ship.test.mjs` + `ship.test.mjs` + `ship.integration.test.mjs`), both in the normal
      shell and under `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 HOME=$(mktemp -d)`:
      52/52 pass. Two mutants proven dead by scratch-copy mutation (never via `git checkout`): B1's
      `FIXTURE_ROOT` containment check removed → the escape test fails; C2's `identityBound`
      hardcoded to `false` → the bound-token assertion fails. Both restored from a pre-mutation
      backup, confirmed byte-identical, before continuing.
- [x] 7.2 Record-first per PR: `rec-bc8b2c1a93dee0f3` (`--issue 901`, PR #902) and
      `rec-b92ccb361910a065` (`--issue 888`, PR #903), each committed before its push.
- [x] 7.3 Epic task 3.1b ticked in PR #903.
- [x] 7.4 Fresh cold reviews before each push: PR #902 APPROVE with three corrections landed first;
      PR #903 REVISE (a blocker: the first test seam imported an arbitrary env-selected path in the
      token-holding process) → constrained to the committed fixture directory by real path →
      APPROVE on re-verification with three hardenings folded in.

## 8. Non-goals (D6 — restated, no work items)

This slice ships the verb and its own tests only. Explicitly out of scope, unchanged by this PR:

- `issue-link`/`actor-check` lane recognition and the `lane-paths`/`lane-scrub` required contexts
  (#889).
- The `SessionEnd` hook and the `day:start` sweep (#889 — deferred by ruling D4, task 0.2).
- `pre-push:70`'s `share` retirement and the other feature-PR surfaces (#890).
- Any change to `collect.mjs`, `plan.mjs`, `mrCreate`, `mrList`, `mrAutoMerge`, `vcsToken()`,
  `memory-gate`, `.claude/settings.json`, `.gemini/settings.json`, or `brain/core/**`.
- A `mrMerge`/"is auto-merge armed" read verb.
- `--force` in any form, anywhere.
- Enabling `allow_auto_merge` on the repository itself — gated by #805 (task 0.4).

## 9. The PR

- [x] 9.1 Shipped as two PRs (the maintainer chose a sub-ticket for the library, as #887 did):
      PR #902 (`Closes #901`, merged 16493771) and PR #903 (`Closes #888`, merged 2d97cf61,
      2026-09-10), the second carrying every body section below. Original instructions, for the
      record — body, in this order:
      1. Summary — three bullets: the push, the idempotent find-or-create PR, the tier-gated arm.
      2. Changes table (design.md's File changes table).
      3. Test plan — the `npm test` output and each `node --test` command from section-by-section
         above.
      4. **Ticket reconciliation** (verbatim from section 0, condensed):
         - the PR-grammar delta (0.1) — ticket's title/body form vs. `design.md`'s, and which one
           this PR implements;
         - the trigger-wiring scope deviation (0.2) — explicit, asking the maintainer to confirm
           the D4 deferral to #889 against the ticket's item (b);
         - the ADR-0034 **Risk 5** statement verbatim (0.3): *"`BRAIN_MEMORY_TOKEN` widens the
           credential surface ADR-0033 narrowed — scoped to the ship process alone, asserted via
           `withoutCredentials` everywhere else."*
         - the **#805 enablement gate** (0.4): `allow_auto_merge` stays `false` on
           `csrinaldi/brain` until #805; this PR's `mrAutoMerge` call is unconditional and its
           refusal path is exercised and non-fatal, but the armed path is unmeasured against the
           live repo until #805 flips the setting.
      5. **For #889** (three-dot, no label needed — these are exit criteria of the next slice, not
         open items of this one):
         - the first real lane PR (measures `gh pr merge --auto` on this repo for the first time);
         - re-arm stderr capture, if the first real lane PR is a same-day re-run;
         - `issue-link`/`actor-check` lane recognition + `lane-paths`/`lane-scrub` contexts;
         - the `SessionEnd` hook + `day:start` sweep.
      6. Contributor checklist per `branch-pr` skill.
- [x] 9.2 `brain:review`: #902 APPROVE at 766874cb (one correction, carried into #903 as the
      title/body-after-decision fix); #903 APPROVE at 1350b876 (one correction — a set-but-blank
      `BRAIN_MEMORY_TOKEN` was reported as bound while the port ran ambient — fixed as a loud
      refusal in the archive PR, 204b467d). Both verdicts posted on GitHub.

## Review Workload Forecast

- Estimated changed lines (counted per `brain.config.json:18-29`, excluding `**/*.test.mjs` and
  `openspec/changes/**`): `lane/ship.mjs` ~200, `cli.mjs` dispatch block + `VALID_OPS` ~60,
  `i18n/en.mjs` + `es.mjs` (14 keys × 2) ~30, `lib/credential-env.mjs` ~14, `package.json` ~1 —
  **counted total ~305, Medium risk** (~24% headroom under the 400-line budget).
- Reviewer-visible total, including ignore-listed test paths (`ship.test.mjs` ~260,
  `ship.integration.test.mjs` ~240, `cli.ship.test.mjs` ~180, `credential-env.test.mjs` extension
  ~25, `pre-push.test.mjs` extension ~15): counted ~305 + visible ~720 ≈ **~1025 reviewer-visible**.
- 400-line budget risk: Medium (counted stays under budget; visible total is large but tests/docs
  are excluded from the gate by `brain.config.json`'s own ignore list — named here, not hidden).
- Chained PRs recommended: No, for the first attempt — ~305 counted is inside budget and the
  design's own recommendation is one PR. **Pre-agreed fallback if apply overruns**: split at the
  A2/A5 seam — PR 1 (library: `lane/ship.mjs`, `lib/credential-env.mjs`, tests from sections 2–4,
  ~214 counted, nothing invocable, reverts by deleting one file) → PR 2 (verb: `cli.mjs`, both
  i18n catalogs, `package.json`, test from section 6, ~91 counted, reverts by dropping the op).
  Chain strategy if triggered: `stacked-to-main` (each slice merges to `main` independently, per
  the epic's own rule, `archive/862/design.md:240-241`).
- Decision needed before apply: No — D1–D6 were ratified 2026-09-10
  (`sdd/issue-888-lane-ship/ruling`, engram #3264) and this file's section 0 resolves the one open
  item (the unread ticket body) without reopening any ratified decision. The only maintainer-facing
  confirmation is the PR-body reconciliation in section 9 — informational, not blocking apply.
