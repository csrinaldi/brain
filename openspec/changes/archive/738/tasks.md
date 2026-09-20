---
status: applied
issue: 738
---

# Tasks: #738 — provenance at capture: one configured handle, one measured kind, the branch demoted to `issue`

Implements `spec.md` under `design.md`'s A1–A6, ruling `sdd/issue-738-provenance-at-capture/ruling`
(D0–D6, 2026-09-10). Parent: `openspec/changes/issue-864-memory-2-0/spec.md`, task 2.2 (Wave 2);
prerequisite of #874. Delivery: `ask-on-risk`, already resolved by the design's forecast (~212
counted, Low risk) — **one PR**, `Closes #738`, `Parent: #864` in prose, label `type:bug`.

STRICT TDD MODE IS ACTIVE. Test runner: `npm test` (node:test). Every implementation task below is
preceded by its failing test task, naming the file and case titles from `spec.md`/`design.md`. Run
the focused `node --test` command after each RED/GREEN pair; run the full `npm test` before each
commit.

## 0. Live measurements apply must perform first (read before implementing — no code in this section)

Neither `sdd-design` nor `sdd-tasks` had Bash available. Before task 1 begins, apply MUST measure
each of the following, record the result in `apply-progress`, and adjust the tasks below if reality
disagrees with the design's assumption.

- **0.1** — `git config --get brain.actor` and `git config --get brain.agentEnv` in
  `/home/gandalf/IA/brain` and in the worktree — expected unset. Record the exit code; the refusal
  test in unit 4 asserts the resolver's reading of it.
- **0.2** — after `git config --local brain.actor @csrinaldi` in the MAIN checkout, run
  `git config --get --show-origin brain.actor` **from the worktree** — proves the one-command-per-
  clone claim (worktrees share `.git/config`, `bootstrap.worktree.test.mjs:14`). If it does not, the
  refusal message must say "per worktree" instead, and unit 4's message text changes.
- **0.3** — `git config --get nonexistent.key` with `cwd` = a non-git tmpdir, once bare and once
  under `GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null HOME=<tmp>` — confirms both the `null`
  contract unit 1 pins and the CLI-test isolation unit 5 depends on.
- **0.4** — the exact existing refusal bytes: `BRAIN_MEMORY_TEST_ROOT=<tmp> node
  brain/scripts/memory/cli.mjs save t c --type discovery --issue abc` → stderr text + exit code, so
  unit 4's new actor refusal matches shape-for-shape.
- **0.5** — `AI_AGENT` presence and value inside this session vs a plain login shell
  (`bash -lc 'echo ${AI_AGENT-unset}'`); the same probe for Antigravity/Gemini if either is reachable.
  If neither sets a marker, record it as a known gap in the verify report and name
  `git config brain.agentEnv '<VAR1>,<VAR2>'` as the remedy.
- **0.6** — the one real capture (requires 0.2 already set): `npm run memory:audit` before/after one
  real `memory:save --issue 738` in this worktree — paste the fresh-window handle count moving off
  an all-time 0, the resulting record line (`actor`/`actorKind`/`issue`), and — separately, from a
  checkout with `brain.actor` unset — the refusal message.
- **0.7** — the real counted diff against the ~212 forecast, run before opening the PR
  (`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**`).

---

## 1. Unit — `lib/git-config.mjs`: the one spawn (design A1)

- [x] 1.1 RED: `brain/scripts/lib/git-config.test.mjs` (new) — `--get <key>` argv asserted on a
  spawn spy; missing key ⇒ `null`; non-zero exit status ⇒ `null`; a spawn throw ⇒ `null`, never a
  rethrow. Focused: `node --test brain/scripts/lib/git-config.test.mjs` — RED (module absent).
- [x] 1.2 GREEN: `brain/scripts/lib/git-config.mjs` — export
  `gitConfigGet(key, cwd, { _spawn }) -> string|null`; one `git config --get <key>` with `cwd`
  (git's own precedence, never a hand-rolled local-then-global); never throws (~15 lines, beside
  `lib/git-branch.mjs`). Focused: same command — GREEN.

Commit: `feat(memory): add gitConfigGet, the one git-config spawn primitive (#738)`.

## 2. Unit — `memory/lib/capture-provenance.mjs`: the pure resolvers (design A1/A2; spec "a record carries its provenance")

- [x] 2.1 RED: `brain/scripts/memory/lib/capture-provenance.test.mjs` (new) —
  - `resolveActor`: `@csrinaldi` ⇒ ok; unset/empty/whitespace ⇒ `{ok:false, reason:'unset'}`;
    `Cristian Rinaldi`/`csrinaldi`/`feat/x`/an email ⇒ `reason:'malformed'`; **`@legacy`** ⇒
    `reason:'reserved'`
  - `resolveActorKind`: marker present ⇒ `agent`; absent ⇒ `human`; set-but-EMPTY marker ⇒
    `human` + evidence naming "set but empty"; a 3-name `brain.agentEnv` list with the second
    name set ⇒ `agent`, that name in the evidence
  - `deriveIssue`: declared wins over the branch; `feat/issue-738-x` ⇒ `738` derived; `main`,
    `unknown`, `feat/issue-abc` ⇒ absent, never fabricated
  - `composeSource`: one trimmed line; a 300-char env value is whitespace-collapsed and sliced
    to 64; "declared via --issue" vs "derived from branch" spelled in words
  Focused: `node --test brain/scripts/memory/lib/capture-provenance.test.mjs` — RED (module absent).
- [x] 2.2 GREEN: `brain/scripts/memory/lib/capture-provenance.mjs` — export `AGENT_ENV_DEFAULT`,
  `RESERVED_ACTORS`, `ISSUE_BRANCH_RE`, `resolveActor({configured})`,
  `resolveActorKind({env, agentEnvConfig})`, `deriveIssue({declared, branch})`,
  `composeSource({host, actor, kind, issue})` per design A1/A2's signatures. Pure — no `fs`, no
  `child_process`. Focused: same command — GREEN.

Commit: `feat(memory): add capture-provenance resolvers — actor, kind, issue, source (#738)`.

## 3. Unit — `format.mjs` W3 + the rehomed actor predicate (design A4; spec "the write gate refuses a branch-shaped actor" / "the actor predicate is owned by format.mjs")

- [x] 3.1 RED: extend `brain/scripts/memory/lib/format.test.mjs` —
  - W3 refuses `feat/x` and each of `main`/`master`/`develop`/`trunk`
  - `validateRecord` (the READ gate) still ADMITS all five, unchanged
  - `@legacy`, `@csrinaldi`, and a bare `crinaldi` pass the write gate
  - `classifyActor` exported from `format.mjs` with identical behavior to its current
    `audit.mjs:62-68` definition
  Focused: `node --test brain/scripts/memory/lib/format.test.mjs` — RED (new assertions absent).
- [x] 3.2 GREEN: `brain/scripts/memory/lib/format.mjs` — add W3 to `validateWritableRecord` after
  W2 (`if (classifyActor(record.actor) === 'branch') writeErrors.push(...)`, refusing the
  SHAPE only, never "not a handle"); move `HANDLE_RE`, `DEFAULT_BRANCHES`, `classifyActor` from
  `audit.mjs:15-68` into `format.mjs`. `brain/scripts/memory/lib/audit.mjs` — replace the local
  definitions with an import from `./format.mjs` and re-export `classifyActor` for its own
  callers. Focused: `node --test brain/scripts/memory/lib/format.test.mjs
  brain/scripts/memory/lib/audit.test.mjs` — GREEN, **`audit.test.mjs` passes UNMODIFIED** — the
  proof the move is behavior-preserving.

Commit: `refactor(memory): rehome the actor predicate to format.mjs; add W3, the branch-shape refusal (#738)`.

## 4. Unit — `plainfiles.save` wiring + the actorkind-consistency rewrite (design A3/A6; spec "a record carries its provenance" / "capture refuses without a configured handle" / "an agent capture carries the operator's handle")

- [x] 4.1 RED: extend `brain/scripts/memory/backends/plainfiles.save.test.mjs` — `actor` is the
  configured handle, never the injected branch; `actorKind` follows the injected env; `source`
  names host + both instruments; `--issue` absent + a matching branch ⇒ derived + a stdout
  notice; a non-matching branch ⇒ `issue` absent; `brain.actor` unset ⇒ throws, nothing appended
  (records dir stays empty); add `getGitConfig`/`getEnv` to this file's ~12 existing seam bags.
  REWRITE `brain/scripts/memory/backends/plainfiles.actorkind-consistency.test.mjs` — neither CLI
  door accepts caller-supplied `actor`/`actorKind`; the capture door's `actor` is the handle
  while a seam-derived branch value reaches only `issue`/`source`; `featureCheckpoint` still
  branch-scopes its own working memory (not a record producer); `PLAINFILES_ACTOR_KIND` is no
  longer exported. Add the same two seams (mechanical) to
  `plainfiles.save-index-failure.test.mjs` (12 call sites) and
  `plainfiles-roundtrip.integration.test.mjs` (4 call sites).
  Focused: `node --test brain/scripts/memory/backends/plainfiles.save.test.mjs
  brain/scripts/memory/backends/plainfiles.actorkind-consistency.test.mjs
  brain/scripts/memory/backends/plainfiles.save-index-failure.test.mjs
  brain/scripts/memory/backends/plainfiles-roundtrip.integration.test.mjs` — RED.
- [x] 4.2 GREEN: `brain/scripts/memory/backends/plainfiles.mjs` — wire
  `resolveActor(getGitConfig('brain.actor'))` → refuse `actorUnset`|`Malformed`|`Reserved`;
  `resolveActorKind(getEnv(), getGitConfig('brain.agentEnv'))`;
  `deriveIssue({declared: issue, branch})` → stdout notice when derived; `composeSource(...)` →
  `buildRecord`. Keep the `type` and `--issue` refusals FIRST (unchanged ordering); W3 stays
  inside `appendRecord`, after the secret scan (unchanged chokepoint). Delete
  `PLAINFILES_ACTOR_KIND` and its docblock (`:42`); rewrite the JSDoc at `:53-67`. Refusal shape
  stays byte-identical to `issueInvalid` (`throw new Error(await t(key, params))` →
  `cli.mjs:815` → `process.exit(1)`). Focused: same four commands — GREEN. `npm test` — full
  suite green.

Commit: `feat(memory): derive actor/actorKind/issue at capture; retire PLAINFILES_ACTOR_KIND (#738)`.

## 5. Unit — the refusal reaches the CLI door + i18n keys (design's cli.save-search / i18n rows; spec "capture refuses without a configured handle")

- [x] 5.1 RED: extend `brain/scripts/memory/cli.save-search.test.mjs` — with an isolated `HOME`
  and no `brain.actor` set (`git init` the tmp root, `HOME=<isolated>`,
  `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1` — the `cli.collect.test.mjs:199-213`
  / #897 precedent), a save exits non-zero and the message names
  `git config --local brain.actor`; the existing no-`--actor`/`--actor-kind`/`--ts`-flag test
  still passes. Extend `brain/scripts/i18n/coverage.test.mjs` if the four new keys are not yet
  covered by its generic parity assertion. Focused:
  `node --test brain/scripts/memory/cli.save-search.test.mjs
  brain/scripts/i18n/coverage.test.mjs` — RED.
- [x] 5.2 GREEN: `brain/scripts/i18n/en.mjs`, `es.mjs` — add `actorUnset`, `actorMalformed`,
  `actorReserved`, `issueDerived` (4 keys × 2 catalogs, neutral professional en/es). Confirm
  `cli.mjs` needs no code change (the refusal already propagates through the existing
  throw → `t(...)` → `cli.mjs:815`/`:817` path); touch it only if the message needs CLI-level
  wording beyond the i18n string. Focused: same two commands — GREEN. `npm test` — full suite
  green.

Commit: `feat(i18n): add actor refusal and issue-derived notice strings (#738)`.

## 6. Unit — `engram-export.mjs` soft-rejects a recovered branch actor (design A5; spec "the write gate refuses a branch-shaped actor", scenario "export soft-rejects, never throws")

- [x] 6.1 RED: extend `brain/scripts/memory/lib/engram-export.test.mjs` — a genuine §4 block
  recovers exactly as today; a recovered branch-shaped actor ⇒ `{ rejected: { id, title, type,
  reason } }` before `buildRecord`, never a throw; the no-block `@legacy`/`human` historical
  fallback path is UNCHANGED. Focused:
  `node --test brain/scripts/memory/lib/engram-export.test.mjs` — RED.
- [x] 6.2 GREEN: `brain/scripts/memory/lib/engram-export.mjs` — add the branch-shape check on a
  §4-recovered actor before `buildRecord`, returning `{rejected}`; add a comment at `:11-17`
  naming #874 as the `@legacy`/`human` fallback's retirement point; the no-recovery path is
  untouched. Focused: same command — GREEN. `npm test` — full suite green.

Commit: `fix(memory): soft-reject a recovered branch-shaped actor in exportObservation (#738)`.

## 7. Pin — brain's own capture path never emits `@legacy` (spec "brain's own capture path never emits a legacy sentinel")

- [x] 7.1 RED → pin: extend `brain/scripts/memory/backends/plainfiles.save.test.mjs` (same file
  as unit 4) — driven twice: `brain.actor=@legacy` ⇒ refused, `reason: 'reserved'` (from unit
  2's `resolveActor`); a normal-handle capture ⇒ the resulting record's `actor !== '@legacy'`.
  Kills the mutant "a fallback in `buildRecord` defaults to `@legacy`". No new production code —
  true once units 2 and 4 land. Focused: same command as 4.1 — GREEN without further changes.

Commit: `test(memory): pin — brain's own capture path can never emit @legacy (#738)`.

## 8. Docs — the doc tripwire, the correction comment, the epic tick (design's doc-tripwire row; D0's correction note; spec Non-Goals)

- [x] 8.1 RED→GREEN: extend `brain/scripts/memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs` —
  `#738` accepted by `DECISION_REFERENCE_RE` (`:43`) alongside `obs #578`, plus its own synthetic
  test (a `#738`-only reference is accepted). Focused:
  `node --test brain/scripts/memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs` — GREEN.
- [x] 8.2 **Tier-2 split (correction batch, post-apply, 2026-09-10):** `brain/core/**` is Tier 2 —
  an agent drafts, the maintainer promotes with `brain:promote`. The first pass of this unit had
  edited `memory-backend-contract.md` and `memory-format.md` directly in the same commit as the
  epic tick, which is not the sanctioned path for a signed `brain/**` doc. Corrected:
  - `brain/core/methodology/memory-format.md` and `memory-backend-contract.md` — reverted to
    `origin/main` content. No direct edit lands in this diff.
  - The same two edits (the `:58` actor example `@`-prefixed; the `:276` agent-capture-convention
    bullet; the `:82` Producers-row "#738" promise marked delivered) now live as two
    `brain-amendment/1` drafts under `brain-drafts/`:
    `memory-format.draft.md` (2 acts) and `memory-backend-contract.draft.md` (1 act). Each
    verified against the real target with `planAmendment` — `ok:true`, every act `pending`, each
    anchor (`amend-find`) occurring exactly once (`f:1`). Neither `amendment:` nor `home-summary:`
    is set — both targets are non-ADR, which `amendment-draft.mjs:147-154` refuses on.
  - **The tripwire does not gate on the doctrine text landing.** Measured directly: running
    `node --test brain/scripts/memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs` with both
    doctrine files reverted to `origin/main` stays GREEN (14/14), including the live "REAL tracked
    *.md docs report clean today" scan — the new doctrine paragraph never places a `VERBS` word
    immediately before a `memory save`/`MEMORY_BACKEND=... memory save` invocation within 60 chars,
    so `INSTRUCTION_RE`/`FENCE_RE` never match it either with or without the paragraph. This is
    **not** the #886 D5 red-by-design shape — the branch is fully green without the maintainer's
    promote. The `#738`-alternative in `DECISION_REFERENCE_RE` and its synthetic test are kept
    (harmless, defensively correct) even though no live doc currently needs them.
  - `openspec/changes/issue-864-memory-2-0/tasks.md:31` — task 2.2 stays ticked; the doc-doctrine
    sub-claim in its own text now reads through the drafts rather than a landed edit.
  - **Handover for the maintainer** — once ready to land the doctrine text, on THIS branch:
    ```
    npm run brain:promote -- openspec/changes/issue-738-provenance-at-capture/brain-drafts/memory-format.draft.md
    npm run brain:promote -- openspec/changes/issue-738-provenance-at-capture/brain-drafts/memory-backend-contract.draft.md
    ```
    One commit per promote (the verb's own contract) — `brain:promote` renders the plan, requires
    the typed word, then stages and stops for the maintainer's own commit.
  Focused: `node --test brain/scripts/memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs` —
  GREEN. `npm test` — full suite green (5195/5195), both before and after this correction.
- [x] 8.3 (posted on #738 and #542 at archive time) Non-code, orchestrator act (not part of this diff): post the draft correction comment
  (`proposal.md`, "For the maintainer" §3) on #542 and #738 once the PR opens.

Commit (a): `docs(sdd): epic task 2.2 ticked; the actor doctrine moves to brain-drafts for the maintainer's promote (#738)`.

---

## Wrap-up

- [x] W1 (done: `brain.actor @csrinaldi` set `--local` on the clone, chosen by the maintainer over `@crinaldi`) **Pre-step, maintainer act, not a diff**: `git config --local brain.actor @csrinaldi` in
  this worktree, before W3 — the maintainer's own identity. Worktrees share `.git/config` (0.2),
  so one command covers both checkouts. This makes W3 the **first real capture under the new
  rule**.
- [x] W2 (5195 after apply, 5202 after the review corrections, 5257 on main after the merge with #912/#913) `npm test` full run — record before/after counts in `apply-progress`.
- [x] W3 (`rec-96965eb1cf95f9a0`: actor `@csrinaldi`, actorKind `agent` — the first real capture under the rule; committed ce7f724c) **Record-first**: `memory:save --issue 738` — depends on W1. Paste the resulting record
  line and the separately-captured refusal message (0.6) in `apply-progress`.
- [x] W4 Fresh-context review before opening the PR: REVISE (the `#` forging hole in `source`, a comment claiming a test that did not exist, four surviving mutants, unbounded exclusion buckets), all landed (be19db89, feb2feca).
- [x] W5 Shipped as PR #914, merged 5a928804 on 2026-09-10 after a merge with main resolving #912/#913 (both gates kept before `buildRecord`). Original: open the PR: `Closes #738`, `Parent: #864` in prose, label `type:bug`. Body sections:
  - **The #542 reversal** — D0's correction: #542 ruled branch-derived `actor` "not a defect";
    the premise stands, the conclusion is reversed; `plainfiles.actorkind-consistency.test.mjs`
    is rewritten, not deleted.
  - **The one-command setup and the fresh-clone refusal** — `git config --local brain.actor
    @<handle>`, once per machine (0.2); a fresh clone's first capture is refused until then, by
    design.
  - **The operator-handle rule for agent captures** — an agent capture carries the OPERATOR's
    handle with `actorKind: agent`, never an agent identity; consistent with
    `hooks/commit-msg`'s refusal of AI co-authorship.
  - **`AI_AGENT` fail-open, recorded in `source`** — an absent marker degrades to
    `actorKind: human`; the evidence names the instrument so a wrong measurement is visible in
    the record, not silent.
  - **The three settled departures** (design's Open Questions, each confirmed in the design
    body): A1 — the module is `capture-provenance.mjs`, not the proposal's
    `actor-identity.mjs`, because it also derives `issue`; A2 — `brain.agentEnv` is a
    comma-separated LIST, not a single overridable name; A6 — the CLI-spawn tests gain a
    `git init` + isolated-`HOME` fixture rather than a test-only capture seam.
  - **Non-goals** (spec.md): no change to engram's `mem_save`/`mem_session_summary` MCP tools or
    `save()` stub (#874); no backfill of the 2177 `@legacy` historical records (#864 task 1.2a /
    #368); no `HANDLE_RE` grammar change; no ADR-0017 amendment, no `actorKind: unknown`; no
    `--actor`/`--actor-kind`/`BRAIN_ACTOR` flag or env var; no network call on the capture path.
  - **Review Workload Forecast** — verbatim, below.
- [x] W6 (cold review APPROVE posted at e84b2ce3, pre-merge; the post-merge head was audited by the orchestrator — see verify-report) Repo's own review gate (`brain:review` or equivalent) on the PR; land any corrections
  before merge.
- [ ] W7 (open — the fresh-window audit is the maintainer's after their next capture) After merge: confirm `npm run memory:audit`'s fresh-window `handle` count has moved off
  the all-time 0 (D5, feeds #864 exit 6.1).

## Non-goals

No change to engram's `mem_save`/`mem_session_summary` MCP tools or `save()` stub (#874). No
backfill of the 2177 `@legacy` historical records (#864 task 1.2a / #368). No `HANDLE_RE` grammar
change. No ADR-0017 amendment, no `actorKind: unknown`. No `--actor`/`--actor-kind`/`BRAIN_ACTOR`
flag or env var. No network call on the capture path. No `supersedes` writer (#805). No
chunk-materialization work (#247). No change to the cold-review poster (`review/poster.mjs`), which
already carries a token-verified handle and is not a record producer yet.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~212 counted (design's forecast; ~700 reviewer-visible with tests) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR closing #738 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not applicable — single PR, under budget) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1–2 | `git-config.mjs` + `capture-provenance.mjs` primitives | PR 1 (only PR) | pure, no seams needed beyond the spawn spy |
| 3 | `format.mjs` W3 + rehomed predicate | PR 1 | `audit.test.mjs` unmodified is the acceptance gate |
| 4 | `plainfiles.save` wiring + consistency rewrite | PR 1 | largest reviewer-visible unit (~30 seam bags) |
| 5 | CLI refusal + i18n | PR 1 | isolated-HOME fixture rule, no ambient config |
| 6 | `engram-export.mjs` soft-reject | PR 1 | measured vacuous today (0/278) |
| 7 | `@legacy` guard pin | PR 1 | test-only, no production code |
| 8 | Docs + doc-tripwire | PR 1 | `#738` anchor required before doc edits pass the tripwire |

All eight units ship in one PR — the design's Low-risk forecast and the ruling's D6 both settle
this before apply; no maintainer decision is needed on splitting.
