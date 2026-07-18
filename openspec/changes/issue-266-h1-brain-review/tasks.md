---
status: draft
issue: 266
slice: H1
---

# Tasks — `brain:review`, the human-invoked cold reviewer (issue 266, phase H1)

> **STRICT TDD MODE IS ACTIVE** for all code tasks: each is a RED → GREEN pair — the failing test
> is written and observed failing *first*, then the minimum code that makes it pass. Runner:
> `npm test` → `node --test "brain/scripts/**/*.test.mjs"` (node:test + `assert/strict`, colocated
> `*.test.mjs`, DI seams — no network, no real clone). Docs/artifacts in English (ADR-0009).
> Binding rulings R1–R6, D1–D3 in `design.md` §0.
>
> **Slice boundary.** Group **H1-1** is this PR (identity + cold-boot + verdict emitter + dry-run —
> the runner skeleton). Groups **H1-2..H1-5** are later PRs and are marked **(deferred)** with their
> task lists, so all of H1 is visible in one plan. Each slice ≤400 **counted** lines; tests are
> budget-free (`**/*.test.mjs` ∈ `governance.ignoreList`, `brain.config.json:16-27`). PRs target
> the `issue-266` tracker (feature-branch-chain), `Part of #266`.
>
> **Reviewer invariants that hold across every slice:** the reviewer NEVER applies
> `status:approved` / `size:exception` / `skip:*` / `override:*` (deny-set §7, H1-5);
> `governance.reviewActors` stays **absent** (fixture-identity tests, protocol §11); no APPROVE
> path exists on any provider (ADR-0020); the human approves and merges, the command never does.

---

# Group H1-1 — infra + identity (this PR)

## Phase 1 — SDD planning artifacts

- [x] **1.1** `proposal.md` — H1 intent, the command/modes/queue/board/identity, the 5-slice plan, H2 deferral.
- [x] **1.2** `spec.md` — REQ-H1-1..14 with scenarios, mapped to protocol §; slice map.
- [x] **1.3** `design.md` — module layout under `brain/scripts/review/`, DI-seam pattern, package scripts, setup-doc location, §0 binding rulings, Fork A/B.
- [x] **1.4** `tasks.md` — this checklist.

## Phase 2 — identity fail-closed gate + config (REQ-H1-1)

- [x] **2.1 RED** — `review/identity.test.mjs`: `evaluateIdentity` with `env[tokenEnv]` **absent**
      returns `{ ok:false, missingVar, patSetupUrl, setupDocPath }` and drives a non-zero exit with
      NO server call. Assert the output names the missing var, the `patSetupUrl`, and the setup doc.
      Observed RED (module absent).
- [x] **2.2 RED** — same suite: `env[tokenEnv]` **present** returns `{ ok:true, handle, token }`.
      Observed RED.
- [x] **2.3 GREEN** — implement `review/identity.mjs`: pure `evaluateIdentity` + `gatherIdentity({
      deps })` (`readConfig` → `loadBrainConfig().reviewer`, `readEnv` → `process.env`, `getPatUrl`
      → `getVcs().patSetupUrl`). Fail-closed, mirrors `run-check.mjs`. Default env name
      `BRAIN_REVIEWER_TOKEN`.
- [x] **2.4** — `docs/reviewer-setup.md` (D3, Fork B): env var name, where the team stores it, who
      grants access, the `patSetupUrl` the gate prints. **No token value.** **SHIPS IN ITS OWN
      MICRO-PR** (pre-authorized "split before hiding" — comment 4993202904 — to keep the H1-1 fix
      under 400; the doc content is written, removed from this branch, opened separately). The gate
      references `docs/reviewer-setup.md` regardless; the micro-PR lands the file.

## Phase 3 — cold boot: headRefOid, detached, doctrine load (REQ-H1-2, REQ-H1-3)

- [x] **3.1 RED** — `review/lib/parse-verdict.test.mjs`: parsing a review body extracts the
      `brain-review/1` block's `head_sha`, `rev`, `verdict`, and author; a body with no block →
      `null`. Observed RED.
- [x] **3.2 GREEN** — implement `review/lib/parse-verdict.mjs` (used by cold-boot, anti-loop, board).
- [x] **3.3 RED** — `review/cold-boot.test.mjs`: with an injected `fetchHead` returning
      `headRefOid: <sha>`, `bootReview` checks out **detached at `<sha>`** (assert the injected
      `cloneDetached` seam receives the sha, not a branch name) and sets `head_sha = <sha>`.
      Observed RED.
- [x] **3.4 RED** — same suite: doctrine load includes `type: decision|architecture` records (via an
      injected `readRecords`) AND prior `brain-review/1` blocks (via injected `fetchReviews`), and
      **excludes** `resume.md` and any branch-name fetch (assert no such seam exists / is called).
      Observed RED.
- [x] **3.5 RED** — same suite: when `reviewer.handle === prView.author`, `bootReview` **abstains**
      (returns an abstain result; no doctrine load, no verdict). Observed RED.
- [x] **3.6 GREEN** — implement `review/cold-boot.mjs`: `gatherColdBoot({ deps })` with `fetchHead`,
      `cloneDetached`, `readRecords` (`readRecordObservations`), `fetchReviews` (`prReviews`),
      `fetchPr` (`prView` for author). No `resume.md` / branch-ref seam exists (R2 by construction).

## Phase 4 — `brain-review/1` verdict emitter, §6 hard rules + §7 bound (REQ-H1-4, REQ-H1-6)

- [x] **4.1 RED** — `review/verdict.test.mjs`: a finding with **no `evidence:`** is excluded from
      `findings[]` in the emitted block (inadmissible). Observed RED.
- [x] **4.2 RED** — same suite: a `severity: blocker` finding with **no `cites:`** is emitted as
      `severity: correction`. Observed RED.
- [x] **4.3 RED** — same suite: assembling a verdict with **no `head_sha`** throws (no headless
      verdict is representable). Observed RED.
- [x] **4.4 RED** — same suite: with three prior blocks (`rev` would be 3) and a REVISE conclusion,
      the emitted verdict is `STOP` + `escalate: human` (§7). Observed RED.
- [x] **4.5 GREEN** — implement `review/verdict.mjs` (pure builder): evidence gate, cites
      downgrade, head_sha requirement, rev>=3 → STOP. Emits fenced `protocol: brain-review/1` YAML.

## Phase 5 — CLI skeleton + `--dry-run` (REQ-H1-5)

- [x] **5.1 RED** — `review/cli.test.mjs`: `brain:review --pr N --dry-run` with an injected **spy
      VCS** writes the verdict to stdout and invokes **zero** write verbs (`prReviewComment` /
      `issueComment` / `labelAdd` / `labelRemove` all un-called). Observed RED.
- [x] **5.2 RED** — same suite: absent `BRAIN_REVIEWER_TOKEN` → the CLI exits non-zero with the
      fail-closed message (wires Phase 2). Observed RED.
- [x] **5.3 GREEN** — implement `review/cli.mjs`: arg parse (`--pr`, `--mode`, `--dry-run`), wire
      identity → cold-boot → (H1-1: a stub/tranche-less) verdict → print; on `--dry-run` never
      construct the poster. `main(deps={})` for injection; CLI entry mirrors `vcs/cli.mjs`.
- [x] **5.4** — add `brain:review` / `brain:review:queue` / `brain:review:board` to `package.json`
      scripts (`design.md` §9). Queue/board dispatch stubs land in H1-5.

## Phase 6 — H1-1 close-out

- [x] **6.1 GATE** — `npm test` green (new suites included); `npm run repo:check` clean.
- [x] **6.2** — re-derive the counted budget cold (`git diff --numstat base...head | node
      brain/scripts/vcs/diff-size-count.mjs`); confirm ≤400; **no `size:exception`**.
- [ ] **6.3** — open PR H1-1 → `issue-266` tracker, `Part of #266`. The reviewer never approves or
      merges — the human keystroke stays human.

### Review Workload Forecast — H1-1

| Field | Value |
|-------|-------|
| Est. counted lines | **~350.** Production: `identity.mjs` (~55), `cold-boot.mjs` (~90), `verdict.mjs` (~80), `lib/parse-verdict.mjs` (~45), `cli.mjs` (~55), `docs/reviewer-setup.md` (~35), `package.json` (+3). Tests + `fixtures/` are budget-free. |
| 400-line budget risk | **Med.** The setup doc is the only non-ignored doc; if it or `cold-boot.mjs` overshoots, trim the doc or split cold-boot's reader into `lib/`. |
| Chained PRs | H1-1 → H1-2..H1-5, feature-branch-chain against the `issue-266` tracker. H1-1 has no code dependency on later slices. |
| Decision needed before apply | **Fork A** (`headRefOid` via cold-boot DI reader vs. widening `prView`) — design recommends the reader for H1-1 (no port change). **Fork B** (setup doc at `docs/reviewer-setup.md`, counts) — confirm the owner accepts the ~35 counted lines. |

---

# Group H1-2 — tranche + post *(deferred to a later PR)*

> **Fork A retirement (binding, issue #266 comment 4993202904, condition 2) — DONE in H1-2b.**
> H1-1's cold-boot `fetchHead` DI-seam reader (`cold-boot.mjs`'s `defaultFetchHead`) is RETIRED. The
> port widened — `headRefOid` on `prView` + a new `prStatusRollup` read verb — under its own
> `decision` label + ADR (ADR-0021, protocol §4: "adding verbs to the port is itself a decision"),
> driven by H1-2's real need for the full status rollup (which `commitStatus` cannot provide — it
> needs the sha as input and returns only `check_runs[0]`). `cold-boot.mjs` now reads `headRefOid`
> from `prView`; the reader and its `TODO(#266)` comments are deleted — no parallel mini-port
> survives past this group.

## Phase 6b — H1-2b: port widening + cold-boot seam retirement (ADR-0021)

- [x] **6b.1 RED/GREEN** — `prView` on both providers returns `headRefOid`: github adds the field to
      `gh pr view --json` (`github.mjs`); gitlab reads the MR payload's `sha`, falling back to
      `diff_refs.head_sha`. The uncomputable path returns `headRefOid: null`, matching the existing
      fail-safe shape.
- [x] **6b.2 RED/GREEN** — new READ verb `prStatusRollup({ project, number })` on both providers,
      normalized `[{ name, status, conclusion }]`, no write/APPROVE/label-mutation path; added to
      `VERBS` (`cli.mjs`) and the `vcs-contract.md` required-verbs table (doctrine-sync per ADR-0021);
      the contract drift-guard (`vcs.contract.test.mjs`) runs it over `['github','gitlab']`.
- [x] **6b.3 REFACTOR** — retire `defaultFetchHead`/its `TODO(#266)` comments from `cold-boot.mjs`;
      `gatherColdBoot` now reads `headRefOid` straight from `prView` (already fetched via `fetchPr`
      for the self-review check) — no separate `fetchHead` seam. `cold-boot.test.mjs` updated
      (injects `prView.headRefOid` instead of `fetchHead`) + a source-scan test proving the seam is
      gone. COLDBOOT-CWD isolation (real-git test) stays green, unchanged.
- [ ] **6b.4** — open PR H1-2b → `issue-266` tracker, `Part of #266`. The reviewer never approves or
      merges — the human keystroke stays human.

### Review Workload Forecast — H1-2b

| Field | Value |
|-------|-------|
| Est. counted lines | Production only (`*.test.mjs`/`fixtures/` are budget-free): `github.mjs` (+~45), `gitlab.mjs` (+~55), `cli.mjs` (+3), `cold-boot.mjs` (-13 net, seam removed). Re-derive cold at task 6b.4. |
| 400-line budget risk | **Low.** Two small provider additions + one net-negative refactor. |
| Decision before apply | Resolved — ADR-0021 Accepted, this slice implements Decision 1-3. |

## Phase 7 — mode derivation (REQ-H1-7)
- [x] **7.1 RED/GREEN** — `review/mode.mjs`: pure `deriveMode({ labels, changedPaths })` →
      needs-ruling→ruling / touches `checkpoint-report.md`→checkpoint / else→tranche. Table-driven test.

## Phase 8 — tranche evaluator (REQ-H1-8)
- [x] **8.1 RED/GREEN** — required gates from the server `statusCheckRollup` re-derived cold
      (`REQUIRED_JOBS`); detection warns quoted verbatim; budget re-derived via `diff-size-count`,
      never read from a report; Tier-2 frontier (`brain/core`,`brain/project`) agent-author flag;
      Tier-3 AI-attribution flag.
- [x] **8.2 RED/GREEN** — uncomputable evidence (`gh` down) → `REVISE` + `conditions:[evidence
      uncomputable]`, never APPROVE (fail-closed, §10).

## Phase 9 — poster: anti-stale + anti-loop (REQ-H1-9)
- [x] **9.1 RED/GREEN** — post via `prReviewComment`/`issueComment` (spy VCS asserts no APPROVE path).
- [x] **9.2 RED/GREEN** — anti-stale: head moved mid-run ⇒ post nothing, `reviewed:stale`.
- [x] **9.3 RED/GREEN** — anti-loop: last block is this reviewer's AND `head_sha` unchanged ⇒ skip.

### Review Workload Forecast — H1-2
| Field | Value |
|-------|-------|
| Est. counted lines | **~320** (`mode.mjs` ~40, `evaluators/tranche.mjs` ~180, `poster.mjs` ~100). |
| 400-line budget risk | **Med.** If the tranche evaluator + poster overshoot, split the poster into H1-2b. |
| Decision before apply | Resolve Fork A (a) vs (b) for `statusCheckRollup` — a port widening here is a `decision`+ADR. |

---

# Group H1-3 — checkpoint *(deferred to a later PR)*

## Phase 10 — checkpoint evaluator (REQ-H1-10)
- [x] **10.1 RED/GREEN** — report-vs-tree drift: every number in `checkpoint-report.md` recomputed
      cold; overstatement is a **blocker**.
- [x] **10.2 RED/GREEN** — artifact completeness per `sdd-layout` `REQUIRED_ARTIFACTS` + ≥1 `- [x]`
      in `tasks.md`.
- [x] **10.3 RED/GREEN** — prior pins applied, each cited `file:line`.
- [x] **10.4 RED/GREEN** — **TDD-RED by reversion**: `git checkout <base> -- <impl-files>`, run the
      PR's new tests, require them to **fail**; a passing test against base is a **blocker**. Fixture:
      a deliberately vacuous test (issue #266 acceptance).
- [x] **10.5 RED/GREEN** — `brain:audit` + `brain:governance-status` output quoted; `decision-gate`
      step-2 warn converted into a ruling ("is this a decision?").

### Review Workload Forecast — H1-3
| Field | Value | 
|-------|-------|
| Est. counted lines | **~280** (`evaluators/checkpoint.mjs` + a small reversion runner). |
| 400-line budget risk | **Med-high.** The reversion runner shells git; keep its seam thin. |
| **Actual counted lines (re-derived cold, `44b88be...HEAD`)** | **367/400** — `checkpoint.mjs` (327), `cli.mjs` delta (40, wiring). Tests/fixtures excluded (`**/*.test.mjs` ignoreList). Under budget, no `size:exception`. |
| **Open PR** | **Not opened.** Per owner ruling (issue #266 comment 5008243569, "Lectura i"), this slice's PR does not open until ADR-0022's `baseRefOid` port widening lands (tracked #266 H1-2C-BASE). Branch `feat/issue-266-h1-3-checkpoint` stays local, ready. |

---

# Group H1-4 — ruling *(deferred to a later PR)*

## Phase 11 — ruling evaluator (REQ-H1-11, Option (B) — owner ruling, issue #266 comment 5009584044)
- [x] **11.1 RED/GREEN** — entry requires `## FORK` with ≥2 options each with cost+consequence and
      exactly one `Recommendation:` line; a fork without ≥2 options (or missing cost/consequence,
      or not exactly one Recommendation) ⇒ **REVISE**, not a ruling.
- [x] **11.2 RED/GREEN** — Option (B): the evaluator NEVER auto-rules. §5's elimination path
      ("rule only if exactly one survives") does NOT exist here — a structurally valid fork ALWAYS
      ⇒ `STOP` + `escalate: human`. The elimination-annotation format + citation resolver (§5
      option (A)) are out of scope, gated on #284.
- [x] **11.3 RED/GREEN** — output carries a `pin:` payload (the durable-record seed, protocol §8):
      `{ fork, options: [{id,cost,consequence}], recommendation }`.
- [x] **11.4** — pin the Option (B) decision as a `.memory/records/` durable record
      (`rec-c2c162a51dc7b046`), citing issue #266 comment 5009584044 and findings H14-FORK-PREMISE
      + H14-FORK-LAUNDERING (reviewer verification comment 5009577822).
- [ ] **11.5** — open PR H1-4 → `issue-266` tracker, `Part of #266`. The reviewer never approves or
      merges — the human keystroke stays human.

### Review Workload Forecast — H1-4
| Field | Value |
|-------|-------|
| Est. counted lines | **~150** (`evaluators/ruling.mjs`). |
| 400-line budget risk | **Low.** |
| **Actual counted lines (re-derived cold)** | See apply-progress / PR description — `ruling.mjs` + `cli.mjs`/`mode.mjs` wiring delta. Tests/fixtures excluded (`**/*.test.mjs` ignoreList). |

---

# Group H1-5 — queue + board + deny-set *(deferred to later PRs)*

> **Budget re-split (issue #266, owner ruling in-session).** H1-5 was already cut into H1-5a
> (deny-set authority lock, PR #286 ✅) + H1-5b (queue+board). H1-5b re-derived cold at **422
> counted** production lines — 22 over the 400 ceiling — so it is split again on the real
> **read/write seam**: **H1-5b = queue + escalation inbox (READ-ONLY)** and
> **H1-5c = board (WRITE-reconcile, the only path that removes labels)**. Both land comfortably
> under 400 (H1-5b re-derived at 176). feature-branch-chain: H1-5b → tracker `issue-266`;
> H1-5c → H1-5b.

> **Candidate (issue #266 comment 4993202904) — DECIDED IN by plan 5011584432, H1-5b.** On
> `escalate: human`, apply a `needs-decision` label (pure tightening, §9-legal) and have
> `brain:review:queue` list pending escalations alongside the review queue. Implemented in H1-5b:
> `poster.mjs` applies `needs-decision` via `guardedLabelAdd` once a verdict with
> `escalate: 'human'` actually posts (never on an anti-stale/anti-loop skip); `queue.mjs` lists
> `needs-decision` PRs as a separate "pending escalations" section alongside the review queue.
> Removing `needs-decision` once the human decides stays OUT OF SCOPE for H1 — human/manual.

## Phase 12 — queue (REQ-H1-12) — **H1-5b**
- [x] **12.1 RED/GREEN** — `review/queue.mjs`: list open `needs-review`/`needs-ruling` PRs, oldest
      first; read-only (no labels, no posts). **H1-5b, done.** Composes SHIPPED verbs only
      (`mrList` + per-PR `prView`), no port change. **Ordering (owner ruling, issue #266 comment
      5011731983, Option A):** sorted by PR **number ascending** — documented as **EXACT creation
      order**, not a proxy (PR/issue numbers are monotonic at creation on both providers; verified
      by the reviewer, comment 5011702460, finding H15B-FORK-BFREE; the fork itself was comment
      5011695053). Pinned as a durable record (`rec-fd2cc044376e5e4c`). The N+1 `prView` cost is
      accepted at H1 scale (ruling §2), folded into the holistic prView/list-read unification
      fast-follow, not optimized here. **Escalation inbox (queue half):** also lists PRs carrying
      `needs-decision` as a separate "pending escalations" section.

## Phase 13 — deny-set ADD + escalation inbox (REQ-H1-14) — **H1-5b**
- [x] **13.1a RED/GREEN** — `review/deny-set.mjs`: hardcoded tightening-allow / loosen-deny; refuses
      `status:approved`/`size:exception`/`skip:*`/`override:*` before `labelAdd` (spy VCS asserts
      never sent); allows `decision`/`seq:*`/`reviewed:*`/`needs-ruling`. **Fixture identities.**
      **H1-5a, done.** ALLOW-LIST (fail-closed) is the fence — an unknown label not in the deny
      examples is refused too. **Standing condition 1 folded in the same slice** (issue #266 comment
      5004345710, "the constant is the seed, not the fence"): `poster.mjs`'s `reviewed:stale`
      anti-stale labelAdd now routes through `guardedLabelAdd` instead of calling `vcs.labelAdd`
      bare — behavior unchanged (`reviewed:stale` matches `reviewed:*`, still allowed), but the
      label now clears the same hardcoded chokepoint `board.mjs` (H1-5c) will share.
      **H1-5b addendum:** `needs-decision` joins the ADD allow-list (escalation inbox), applied by
      `poster.mjs` on `escalate: 'human'` once the verdict actually posts.
- [x] **13.3a** — wire the `queue` dispatch in `review/cli.mjs` (stub from 5.4). **H1-5b, done.**
      The first positional argv token `queue` dispatches to `gatherQueue` before
      identity/cold-boot/the evaluators; anything else falls through to the single-PR flow. (`board`
      dispatch is H1-5c.)

### Review Workload Forecast — H1-5b (queue + escalation inbox)
| Field | Value |
|-------|-------|
| **Actual counted lines (re-derived cold, `81b9fa5...HEAD`)** | **176/400** — `queue.mjs` (77), `cli.mjs` queue-dispatch delta, `deny-set.mjs` needs-decision ADD delta, `poster.mjs` escalation delta. Tests/fixtures/`.memory`/`openspec` excluded (governance.ignoreList). Under budget, no `size:exception`. |
| 400-line budget risk | **None** — read-only slice, 176 counted. |

---

# Group H1-5c — board (WRITE-reconcile) *(deferred to a later PR)*

## Phase 13c — board + deny-set REMOVE (REQ-H1-13, REQ-H1-14 remove allow-list) — **H1-5c**
- [ ] **13.1b RED/GREEN** — extend `review/deny-set.mjs` with `guardedLabelRemove` + a REMOVE
      allow-list **narrower than ADD**: only `seq:*`/`reviewed:*` (the reviewer's own derived index)
      may ever be removed — `decision`/`needs-ruling`/`needs-decision` (human/circuit intent —
      adding is tightening, removing is loosening) and `status:approved` (human-only) are refused on
      the remove path even though the first three are allowed on the add path. Fail-closed and
      spy-proven (`labelRemove` never invoked for a denied removal); `board.mjs` is the first and
      only caller.
- [ ] **13.2 RED/GREEN** — `review/board.mjs`: rebuild `seq:*`/`reviewed:*` from the verdict blocks
      (`lib/parse-verdict`, extended with an optional `sequencing` payload); a desynced label is
      rebuilt; reconciles via `guardedLabelAdd`/`guardedLabelRemove` within those namespaces only.
      Composes `mrList` + per-PR `prReviews` + `prView`; the LATEST verdict denormalizes to
      `reviewed:approved`/`reviewed:revised`/`reviewed:stopped`. An already-synced PR makes zero
      write calls.
- [ ] **13.3b** — wire the `board` dispatch in `review/cli.mjs` (stub from 5.4).

### Review Workload Forecast — H1-5c (board)
| Field | Value |
|-------|-------|
| Est. counted lines | **~230** (`board.mjs` ~130, `lib/parse-verdict.mjs` sequencing ~34, `deny-set.mjs` REMOVE ~50, `cli.mjs` board dispatch). |
| 400-line budget risk | **Low.** Re-derive cold at PR time (`H1-5b-tip...HEAD`). |

---

## Hot micro-decisions (session agreements — promote at MR time)

- **Identity is in slice 1, not with queue+board.** Cold-boot needs the token to resolve
  `headRefOid` and clone; the fail-closed gate is the command's entry precondition. Divergence from
  the originally-suggested cut, recorded for the reviewer (issue #266 comment 4992769106). Movable if
  the owner prefers core-on-fixtures-first.
- **`headRefOid` via a cold-boot DI reader in H1-1 (Fork A / D2).** `prView` does not expose it
  today (`github.mjs:157-171`); widening the port is a `decision`+ADR, deferred to when H1-2 needs
  `statusCheckRollup`. Ship H1-1 unblocked on the reader.
- **`governance.reviewActors` stays absent.** No reviewer bot account exists (protocol §11); all
  identity/deny-set tests use fixture identities. Account creation is a decoupled human keystroke.
- **The deny-set is the first line, `actor-check` (L5) is the backstop.** The reviewer is never in
  `governance.approvalActors` (§3), so a deny-set bug is still caught — but the reviewer never emits
  the human keystroke by design.
- **No watchers/crons/hooks in H1.** Every run is a human invocation; Actions hosting + per-PR
  concurrency mutex is H2, a separate human-opened track, deferred to evidence (issue #266 §H2).
- **CORE-BOUNDARY resolved: option (a) (comment 4997595427).** The `reviewer` config key ships as a
  versioned additive migration in `brain/core/config-migrations.mjs` — ratified as the implementer's
  lane FOR CONFIG PLUMBING ONLY (ADR-0006 pattern, 6 prior slices incl. #231); doctrine files
  (`brain/core/methodology/`, `brain/project/decisions/`) stay draft-and-promote (ADR-0013). L6
  reviews the migration at PR.
- **COLDBOOT-CWD fixed (protocol §8).** `defaultCloneDetached` now `git worktree add --detach`s into
  an isolated tmp worktree — it NEVER `git checkout`s the operator's cwd. A real-git test proves the
  operator's HEAD does not move. `gatherColdBoot` returns `worktreePath` for H1-2's evaluators.
