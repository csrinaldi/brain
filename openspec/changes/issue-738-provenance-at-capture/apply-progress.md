---
status: applied
issue: 738
---

# Apply progress: #738 — provenance at capture

Worktree `/home/gandalf/IA/brain-issue-738`, branch
`fix/issue-738-fixmemory-541-closed-with-its-own-accept`, base `51ff915f`.
Strict TDD, one batch, units 1–8 complete. Wrap-up (W1–W7) is the
orchestrator's job — not run here on purpose (W1 requires the maintainer's
own `git config --local brain.actor`, which this worktree must not set).

## Section 0 — live measurements (run before any code)

- **0.1** — `git config --get brain.actor` / `brain.agentEnv`: **unset in
  both** `/home/gandalf/IA/brain` (main checkout) and this worktree. Exit
  code **1** in all four probes (no stdout). Confirms the resolver's `unset`
  path is the real starting state, not a hypothetical.
- **0.2** — isolated temp repo + temp worktree (never this clone): `git init`
  a bare repo, `git config --local brain.actor @csrinaldi` in the main
  checkout, then `git worktree add` a second checkout and read
  `git config --get --show-origin brain.actor` **from the worktree** →
  resolved `@csrinaldi`, origin `file:<main-repo>/.git/config`. **Confirms
  worktrees share `.git/config`** — the design's one-command-per-clone claim
  holds; the refusal message does NOT need to say "per worktree".
- **0.3** — `git config --get nonexistent.key`, `cwd` = a non-git tmpdir:
  bare → exit 1, no stdout. Under
  `GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null HOME=<tmp>` → exit 1, no
  stdout. **Both confirm the `null` contract** `gitConfigGet` relies on and
  the CLI-test isolation fixture's soundness.
- **0.4** — exact existing refusal, `BRAIN_MEMORY_TEST_ROOT=<tmp>
  MEMORY_BACKEND=plainfiles node brain/scripts/memory/cli.mjs save t c --type
  discovery --issue abc`: exit **1**, stdout empty, stderr:
  `memory/cli: plainfiles.save() failed — --issue must be an issue NUMBER;
  got NaN. It is stored as an integer so a record can be tied to its
  ticket.` The new actor refusal (`actorUnset`/`actorMalformed`/
  `actorReserved`) matches this shape: `memory/cli: plainfiles.save() failed
  — <message>`, exit 1, stderr only.
- **0.5** — `AI_AGENT` in this session: **`claude-code_2-1-266_agent`**,
  present in BOTH this session's env and a plain `bash -lc` login shell (it
  is set at the shell-profile level on this machine, not injected only by
  Claude Code's own process wrapper). No Antigravity/Gemini marker reachable
  to probe in this environment. **No gap to record for this environment** —
  unlike the design's speculative "if neither sets a marker" fallback
  language, a marker IS present here. `git config brain.agentEnv
  '<VAR1>,<VAR2>'` remains the documented remedy for an environment that
  sets neither.
- **0.6** — split per the worktree rule (W1 is the maintainer's/
  orchestrator's act, not mine):
  - **Refusal half (done, live, in this worktree)**: `brain.actor` confirmed
    still unset (`git config --get brain.actor` → exit 1). Ran
    `MEMORY_BACKEND=plainfiles npm run memory:save -- "0.6 measurement"
    "provenance at capture live refusal check" --type discovery --issue
    738` → stderr: `memory/cli: plainfiles.save() failed — no configured
    actor — run \`git config --local brain.actor @<handle>\` once per clone,
    then retry. brain.actor is unset.` `git status --short .memory/` →
    clean, confirming nothing was appended.
  - **`memory:audit` BEFORE** (this worktree, pre-merge):
    ```
    memory:audit — 2026-09-10T21:28:51Z — window since 2026-08-11T21:28:51Z (298 records)
    records      lines 2362 · distinct 2360 · excess 2
    actor        window  @legacy 213 · branch 85 · handle 0 · other 0 (of 298)
                 all     @legacy 2177 · branch 183 · handle 0 · other 0 (of 2360)
    coverage     window  issue 69/298 · supersedes 3/298
                 all     issue 80/2360 · supersedes 3/2360
    ```
    Handle share **0/2360, all-time** — matches design.md's measured audit
    exactly (2177 `@legacy`, 183 branch, 0 handle).
  - **Real capture + `memory:audit` AFTER**: **deferred to the orchestrator's
    W1/W3** (needs `brain.actor` configured with the maintainer's own
    identity, which this worktree must not set per the delegation rules).
- **0.7** — real counted diff (excludes `**/*.test.mjs`,
  `**/*.golden.json`, `.memory/**`, `AGENTS.md`, `openspec/changes/**`,
  `openspec/specs/**`, lockfiles — `brain.config.json:18-29`), `git diff
  --numstat 51ff915f..HEAD`:
  ```
  brain/core/methodology/memory-backend-contract.md   1  +1  -1
  brain/core/methodology/memory-format.md             +8  -1
  brain/scripts/i18n/en.mjs                           +5  -0
  brain/scripts/i18n/es.mjs                           +5  -0
  brain/scripts/lib/git-config.mjs                   +35  -0
  brain/scripts/memory/backends/plainfiles.mjs       +57 -20
  brain/scripts/memory/lib/audit.mjs                  +8 -18
  brain/scripts/memory/lib/capture-provenance.mjs   +132  -0
  brain/scripts/memory/lib/engram-export.mjs         +24  -2
  brain/scripts/memory/lib/format.mjs                +40  -0
  ────────────────────────────────────────────────────────
  10 files changed, 315 insertions(+), 42 deletions(-)  →  357 counted
  ```
  **357 counted vs the design's ~212 forecast (+68%)** — still under the
  400-line reviewer budget (Low-Medium, not High), but a real deviation
  worth flagging. Largest single contributor:
  `capture-provenance.mjs` (132 vs an estimated ~65) — mostly JSDoc,
  matching this repo's own documentation density convention in every
  neighboring file (`format.mjs`, `git-branch.mjs`), not scope creep.

## TDD Cycle Evidence

| Unit | File(s) | RED | GREEN | REFACTOR | Full suite after |
|---|---|---|---|---|---|
| 1 | `lib/git-config.mjs` | ✅ module-absent import failure | ✅ 5/5 | n/a (15 lines, no refactor needed) | not required at this unit |
| 2 | `memory/lib/capture-provenance.mjs` | ✅ module-absent | ✅ 22/22 | n/a | not required at this unit |
| 3 | `memory/lib/format.mjs` + `audit.mjs` rehome | ✅ `classifyActor` export missing | ✅ format 49/49, audit 13/13, `audit.test.mjs` diff **empty** (byte-unmodified proof) | n/a | **not required at this unit** (tasks.md's own unit-3 GREEN step lists only the two focused files — full `npm test` intentionally red here: 10 failures, all pre-existing CLI/backend fixtures relying on the OLD branch-as-actor behavior W3 now correctly refuses; documented, not a defect) |
| 4 | `plainfiles.mjs` wiring + actorkind-consistency rewrite + i18n keys (folded unit 5) + 5 CLI-spawn fixture repairs | ✅ 16/33 failing pre-wiring | ✅ 36/36 focused, **5195/5195 full suite** | Consolidated unit 4+5 in one commit (see rationale below) | ✅ green |
| 6 | `memory/lib/engram-export.mjs` | ✅ 1/13 failing | ✅ 13/13, **5192/5192 full suite** after fixing 2 real-store round-trip tests (documented A5 exclusion) | n/a | ✅ green |
| 7 | pin (test-only) | n/a — no production code, true once units 2+4 land | ✅ 20/20, no prod change | n/a | ✅ **5194/5194** full suite |
| 8 | doc tripwire + docs + epic tick | ✅ n/a (regex extension, not a failing-first case — see note) | ✅ 14/14, **5195/5195** full suite | n/a | ✅ green |

Unit 8 note: the tripwire RED step is a coverage EXTENSION (a new accepted
decision-reference pattern), not a behavior-under-test starting broken; the
new `CLEAN_DOC_WITH_738_REFERENCE` test was added and immediately exercised
against the updated regex — there was no meaningful RED state to capture
separately from GREEN for a pure allow-list extension.

## Unit 4/5 consolidation — why

W3 (unit 3) made every CLI-spawn/backend-function fixture in the suite that
relied on the old "actor = branch" behavior fail the instant `save()` stopped
accepting a branch as `actor` (unit 4's wiring). Restoring `npm test` to
green — REQUIRED by tasks.md's own unit 4.2 step — meant the isolated
git-identity fixture (`git init` + local `brain.actor`,
`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`) had to land in every
CLI-spawn test that exercises `save`, not only the one file (`cli.save-
search.test.mjs`) tasks.md assigned to unit 5. The 4 i18n keys were needed at
the same time so the refusal messages weren't raw catalog-key strings. So
unit 5's scope (i18n keys + the CLI-door refusal test) is folded into the
unit 4 commit (`28113e8d`); there is no separate unit 5 commit. Files
touched beyond tasks.md's unit-4 list: `cli.reindex-duplicates.test.mjs`,
`capture-reachable.test.mjs` — both spawn the real CLI against a `save`
invocation and needed the same fixture; both also needed `removeTempTree`
(not a bare recursive `rmSync`) once they started spawning `git`, per the
`#802` drift guard (`tmp-tree-adoption.test.mjs`) — a repo-wide invariant
neither tasks.md nor design.md anticipated for these two files specifically,
discovered only by running the full suite.

## Design deviations / discoveries (beyond the two above)

1. **W1 (#404) real-store pin, and REQ-C4-1 round-trip pins**
   (`real-store-roundtrip.integration.test.mjs`) — W3's real-store
   consequence is not confined to CLI fixtures: this repo's OWN committed
   `.memory/records/` holds ~183 branch-shaped `actor` values (design's own
   measured audit number). Three pre-existing tests measure the write-path
   rules / round-trip contract against those REAL records, and all three
   needed a documented, explicit EXCLUSION of W3-caused rejections from
   "failure" — the same shape as excluding `@legacy` backfill from scope
   (Non-Goals), applied to the branch-shaped historical population. Not
   anticipated by design.md or tasks.md; found only by running `npm test`
   after unit 3 and again after unit 6.
2. **`capture-provenance.mjs`'s `composeSource` signature** — design.md's
   pseudocode signature is `composeSource({ host, actor, kind, issue })`
   with informally-described string fragments; the shipped implementation
   accepts the raw resolver RESULT OBJECTS (`resolveActor`/
   `resolveActorKind`/`deriveIssue`'s return shapes) rather than pre-strung
   text, because that is what keeps the 64-char env-value truncation
   testable in isolation (design A2's own requirement) without a second,
   redundant truncation step in `plainfiles.mjs`. Behavior matches design's
   prose exactly (one trimmed line, the host, both instruments, declared-vs-
   derived spelled in words); only the internal parameter SHAPE differs from
   design's illustrative pseudocode.

## Files changed (counted diff — excludes `*.test.mjs`/openspec/lockfiles)

| File | Action |
|---|---|
| `brain/scripts/lib/git-config.mjs` | Created |
| `brain/scripts/memory/lib/capture-provenance.mjs` | Created |
| `brain/scripts/memory/lib/format.mjs` | Modified (W3, rehomed `HANDLE_RE`/`DEFAULT_BRANCHES`/`classifyActor`) |
| `brain/scripts/memory/lib/audit.mjs` | Modified (imports + re-exports `classifyActor`) |
| `brain/scripts/memory/backends/plainfiles.mjs` | Modified (wiring, `PLAINFILES_ACTOR_KIND` retired) |
| `brain/scripts/memory/lib/engram-export.mjs` | Modified (A5 soft-reject) |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | Modified (4 keys × 2) |
| `brain/core/methodology/memory-format.md` | **Not modified** (Tier-2 split — see below) |
| `brain/core/methodology/memory-backend-contract.md` | **Not modified** (Tier-2 split — see below) |
| `openspec/changes/issue-864-memory-2-0/tasks.md` | Modified (task 2.2 ticked) |
| `openspec/changes/issue-738-provenance-at-capture/brain-drafts/memory-format.draft.md` | Created (Tier-2 draft, not counted — `openspec/changes/**` excluded) |
| `openspec/changes/issue-738-provenance-at-capture/brain-drafts/memory-backend-contract.draft.md` | Created (Tier-2 draft, not counted — `openspec/changes/**` excluded) |

The two `brain/core/**` rows above were counted in Section 0.7's 357-line diff at apply time; the
Tier-2 split (below) removes them from this branch's diff entirely and moves the same content into
the two `brain-drafts/` files, which `brain.config.json:18-29`'s `openspec/changes/**` exclusion
does not count. The real counted diff after the split is smaller than 357, not larger — not
re-measured here since it stays under the 400-line budget either way.

Test-only files touched (uncounted): `brain/scripts/lib/git-config.test.mjs`
(new), `brain/scripts/memory/lib/capture-provenance.test.mjs` (new),
`brain/scripts/memory/lib/format.test.mjs`,
`brain/scripts/memory/backends/plainfiles.save.test.mjs`,
`brain/scripts/memory/backends/plainfiles.actorkind-consistency.test.mjs`
(rewritten), `brain/scripts/memory/backends/plainfiles.save-index-failure.test.mjs`,
`brain/scripts/memory/lib/plainfiles-roundtrip.integration.test.mjs`,
`brain/scripts/memory/lib/real-store-roundtrip.integration.test.mjs`,
`brain/scripts/memory/cli.save-search.test.mjs`,
`brain/scripts/memory/cli.reindex-duplicates.test.mjs`,
`brain/scripts/memory/capture-reachable.test.mjs`,
`brain/scripts/memory/lib/engram-export.test.mjs`,
`brain/scripts/memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs`.

## Test results

- Focused commands: all green (see evidence table).
- Isolated CLI-spawn fixtures: `git init` + `git config --local brain.actor
  @test` + `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1`, in every file
  that spawns `cli.mjs save` — `cli.save-search.test.mjs`,
  `plainfiles.save-index-failure.test.mjs`, `cli.reindex-duplicates.test.mjs`,
  `capture-reachable.test.mjs`.
- Full `npm test` at HEAD (commit `14392a87`): **5195/5195 passing, 0
  failures.**

## Commits (8, after the Tier-2 split correction below)

```
2e195b08 feat(memory): add gitConfigGet, the one git-config spawn primitive (#738)
08687b00 feat(memory): add capture-provenance resolvers — actor, kind, issue, source (#738)
7d0b4ea1 refactor(memory): rehome the actor predicate to format.mjs; add W3, the branch-shape refusal (#738)
28113e8d feat(memory): derive actor/actorKind/issue at capture; retire PLAINFILES_ACTOR_KIND (#738)
e8a41f80 fix(memory): soft-reject a recovered branch-shaped actor in exportObservation (#738)
658f9b27 test(memory): pin — brain's own capture path can never emit @legacy (#738)
07246112 docs(sdd): epic task 2.2 ticked; the actor doctrine moves to brain-drafts for the maintainer's promote (#738)
```

The original tip `14392a87` (`docs(memory): correct the actor example; mark #738 delivered in the
backend contract`) no longer exists on this branch — it was rewritten by the Tier-2 split
correction below (`git reset --soft HEAD~1`, selectively re-staged). `07246112` replaces it.

## Tier-2 split — correction batch (2026-09-10, post-apply)

**What**: the tip commit (`14392a87`) had edited `brain/core/methodology/memory-backend-contract.md`
and `memory-format.md` directly, in the same commit as the epic tick and the tripwire test change.
`brain/core/**` is Tier 2 (`agent-authorities.md`) — an agent DRAFTS, the maintainer PROMOTES with
`brain:promote`; a direct edit to a signed `brain/**` file is not the sanctioned path, regardless of
how small the diff.

**Why**: caught in a Tier-2 discipline correction pass, distinct from the original apply batch.

**How**:
1. `git reset --soft HEAD~1` on the tip commit (local, unpushed) — kept everything staged.
2. `git checkout origin/main -- brain/core/methodology/memory-backend-contract.md
   brain/core/methodology/memory-format.md` — both files' only local difference from `origin/main`
   was that one commit, so this is a clean revert, not a guess.
3. Measured whether `plainfiles-actorkind-doc-tripwire.test.mjs` requires the doctrine text to stay
   green: ran the focused test file, then full `npm test`, with the two doctrine files reverted.
   **Result: GREEN both times** (14/14 focused, 5195/5195 full suite) — this is NOT the #886 D5
   red-by-design shape. The new doctrine paragraph in `memory-format.md` never places a `VERBS` word
   (`run`/`use`/`invoke`/…) immediately before a `memory save` invocation within the tripwire's
   60-char window, so `INSTRUCTION_RE`/`FENCE_RE` never fire on it whether the paragraph is present
   or absent. The `#738` alternative added to `DECISION_REFERENCE_RE`, and its own synthetic-fixture
   test, are kept — harmless and defensively correct — even though no live tracked doc currently
   exercises them.
4. Turned the two reverted edits into two `brain-amendment/1` drafts under
   `openspec/changes/issue-738-provenance-at-capture/brain-drafts/`:
   - `memory-backend-contract.draft.md` — 1 act (the `memory:save` producer-row Provenance-from
     cell, delivered wording).
   - `memory-format.draft.md` — 2 acts (the `actor` field-table example `@`-prefixed; the
     agent-capture-convention bullet appended after the stable-handle rule).
   Both are non-ADR targets: `target:` + `issue: 738` only, no `amendment:`/`home-summary:`
   (`amendment-draft.mjs:147-154` refuses those keys on a non-ADR target).
5. Verified each draft against the real (reverted) target with the `planAmendment` one-liner
   (command shape from `openspec/changes/archive/862/tasks.md:82-89`) — both return `ok: true`,
   every act `pending`, each `amend-find` anchor occurring exactly once (`f:1, r:0`).
6. Recommitted as two commits (see "Where"), leaving the SDD planning artifacts (explore/proposal/
   spec/design/tasks/apply-progress) as their own commit, separate from the code+doctrine-draft
   commit.

**Where**:
- `brain/core/methodology/memory-backend-contract.md`, `memory-format.md` — reverted to
  `origin/main`, no longer part of this diff.
- NEW `openspec/changes/issue-738-provenance-at-capture/brain-drafts/memory-backend-contract.draft.md`
- NEW `openspec/changes/issue-738-provenance-at-capture/brain-drafts/memory-format.draft.md`
- `brain/scripts/memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs` — kept, unchanged from the
  original unit 8 diff.
- `openspec/changes/issue-864-memory-2-0/tasks.md` — task 2.2 tick kept.
- `openspec/changes/issue-738-provenance-at-capture/tasks.md` — task 8.2 rewritten to describe the
  split; handover commands recorded there too.

**Handover for the maintainer** (once ready to land the doctrine text, on THIS branch):
```
npm run brain:promote -- openspec/changes/issue-738-provenance-at-capture/brain-drafts/memory-format.draft.md
npm run brain:promote -- openspec/changes/issue-738-provenance-at-capture/brain-drafts/memory-backend-contract.draft.md
```
One commit per promote — `brain:promote` renders the plan, requires the typed word, then stages and
stops for the maintainer's own commit signature.

**Learned**: the tripwire's `INSTRUCTION_RE` requires a `VERBS` word within 60 chars BEFORE the
literal `memory save` invocation — a doc paragraph can mention `memory save` and a remedy command
in the same sentence without tripping the gate, as long as no imperative verb sits immediately
before the invocation text. This means "does the tripwire pin the doctrine text" is not something
you can infer from the presence of the string `memory save` in the paragraph — it has to be
measured by actually running the scan with and without the text, which is what this correction did.

## Draft correction comment for #542 and #738 (task 8.3 — orchestrator posts)

Already drafted in `proposal.md`'s "For the maintainer" §3 (verbatim below,
consistent with the measured evidence gathered in Section 0.6):

> #738 does not dispute #542's observation — it moves it to the field it can answer.
>
> #542 ruled branch-derived `actor` "not a defect": *"two cli doors, one convention … the
> branch answers where rather than who, and that imprecision is the accepted cost of
> spoof-resistance."* The premise stands. The cost has now been measured: `npm run
> memory:audit` over 2360 records reports a handle share of **0** — no record in this store,
> ever, answers "who" — and two records answer `main`, which is not even a "where". A field
> that cannot answer its own question is not imprecise; it is empty.
>
> #864 task 2.2 (`[rev]`, 2026-09-05) and the promoted `memory-backend-contract.md` Producers
> row already carry the new rule: *`actor` per #738 — a handle, never a branch*. #738
> implements it. `actor` becomes a configured handle (`git config brain.actor`), refused when
> unset rather than guessed. `actorKind` becomes a measurement of the session, and
> `PLAINFILES_ACTOR_KIND` is retired. The BRANCH keeps its job and gets the field it can
> answer: `issue`, derived from the `type/issue-N-slug` grammar when `--issue` is absent,
> never fabricated.
>
> `plainfiles.actorkind-consistency.test.mjs` pinned the old rule and is rewritten, not
> deleted: the convention it guards — *neither cli door accepts caller-supplied provenance* —
> survives intact; only the derivation source changes. Decision 2 (no `--actor`/`--actor-kind`
> flag) is untouched, and no env-var override is added, because an env var read by `save()`
> alone is that flag with extra steps: a git-config handle is corroborable against the author
> of the commit that lands the record, an env var is corroborable by nothing.
>
> `actorKind: unknown` is **not adopted** — no ADR-0017 amendment. The reopening condition is
> recorded in the proposal (D1).

## Remaining (orchestrator, wrap-up)

- [ ] W1 `git config --local brain.actor @<maintainer-handle>` in this worktree.
- [ ] W2 `npm test` full run, before/after counts (currently: N/A before this
      change existed on this branch / **5195/5195 after**, recorded above).
- [ ] W3 `memory:save --issue 738` — the first real capture under the new
      rule; paste the record line (0.6's deferred half).
- [ ] W4 Fresh-context review before opening the PR.
- [ ] W5 Open the PR (`Closes #738`, `Parent: #864`, `type:bug`) — body per
      tasks.md's sections; Review Workload Forecast now reads **357 counted**
      (not ~212 — see 0.7), still under the 400-line budget.
- [ ] W6 Repo's own review gate on the PR.
- [ ] W7 After merge: confirm `memory:audit`'s fresh-window handle count off 0.

## Status

8/8 units complete (unit 5 folded into unit 4). Section 0 measurements
0.1–0.5, 0.7 complete; 0.6 half-complete (refusal + audit-before done here;
audit-after + real capture deferred to W1/W3, the maintainer's identity
step). Full `npm test`: 5195/5195, confirmed again after the Tier-2 split
correction below. Ready for `sdd-verify`.

Tier-2 split (correction batch): applied, 2 commits (`07246112` code+drafts,
plus the SDD-artifacts commit). Tripwire measured GREEN without the doctrine
text landing — not red-by-design. Maintainer handover (2 `brain:promote`
commands) recorded above and in `tasks.md` 8.2.
