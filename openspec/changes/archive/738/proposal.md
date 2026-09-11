---
status: proposed
issue: 738
epic: 864
---

# Proposal — #738 provenance at capture: the branch keeps its job and loses the field it could never answer

Parent: #864 (memory 2.0), task 2.2 — Wave 2. Prerequisite of #874 (3.2, record-first).
Predecessor: #541, closed by PR #542, which shipped the COUNTER and not the fix.

## What is wrong today, measured

`memory:save` is the only capture door brain owns (engram's `save` is `unsupportedOp` until
#874). It stamps two constants and calls them provenance:

| field | today | where | why it is wrong |
|---|---|---|---|
| `actor` | `getBranch(root)` — the git **branch name** | `backends/plainfiles.mjs:93` | the branch names the WORK, not the AUTHOR. `memory:audit` over 2360 records: `handle` **0**, `branch` 183, `@legacy` 2177. Two records carry `actor: "main"` — not even a "where" |
| `actorKind` | `PLAINFILES_ACTOR_KIND = "agent"`, hardcoded | `backends/plainfiles.mjs:42,94` | a constant standing in for a measurement; a human running the CLI by hand is recorded as an agent |
| `issue` | `--issue` only, no default | `cli.mjs:790` | the branch grammar `type/issue-N-slug` (`ticket-start.mjs:119`) already holds the answer and nothing reads it |

The export half asserts the opposite constant: `LEGACY_ACTOR_KIND = 'human'`
(`lib/engram-export.mjs:17,93`) — 2177 records claim a human author on zero evidence, and
0/278 observations ever recover a §4 block, because no producer emits one on the door
knowledge enters through (engram's own MCP tools, outside brain — #874's problem, not this
slice's).

## Decisions

### D0 — #542's ruling: the premise stands, the field changes

PR #542 ruled branch-derived `actor` **not a defect** — *"two cli doors, one convention …
the branch answers where rather than who, and that imprecision is the accepted cost of
spoof-resistance"* — pinned by `backends/plainfiles.actorkind-consistency.test.mjs:19-38`
(obs #578). The epic's `[rev]` line (2026-09-05, `issue-864-memory-2-0/tasks.md:31`)
reverses the conclusion: *"`actor` is a handle, never a branch name."*

| option | what it means | cost |
|---|---|---|
| (a) implement quietly, patch the test to match the new code | the reversal exists only as a diff | a named, tested ruling dies with no reader; the next contributor re-derives #542's argument and re-opens it |
| **(b) record the correction, cite both, REWRITE the test to pin the new rule** | #542's observation is kept (*the branch answers where*) and acted on: the branch moves to the field it can answer (`issue`), and `actor` gets a source that answers "who" | one comment on #542/#738, a rewritten consistency test, three refreshed anchors (`PLAINFILES_ACTOR_KIND`'s comment, the doc-tripwire's `DECISION_REFERENCE_RE`, `memory-format.md`) |
| (c) a new ADR / ADR-0017 amendment for the reversal | maximal ceremony | the doctrine has **already moved**: `memory-backend-contract.md:82` shipped *"`actor` per #738 (a handle, never a branch)"*. An ADR would ratify what a promoted contract already says |

**Recommendation: (b).** The later word is the maintainer's (the `[rev]` line) and the
contract already carries it. What #738 owes is not a new ruling but an honest correction
note and a test that fails if the fix is undone. Passing
`plainfiles.actorkind-consistency.test.mjs` **unchanged means the fix did not happen** — its
rewrite is an acceptance criterion, not cleanup. Draft comment: **For the maintainer**, below.

### D1 — Where a handle comes from at capture, and what happens when there is none

Constraint that does not move: **no `--actor`/`--actor-kind` flag, anywhere**
(`cli.mjs:761-763`, Decision 2). The fix DERIVES a handle; it never accepts one.

| option | what it means | cost |
|---|---|---|
| `BRAIN_ACTOR` env var | an explicit per-invocation override | it is `--actor` with extra steps. An env var read by `save()` alone is corroborated by nothing; Decision 2 would survive in letter and die in substance |
| `git config user.name` / `user.email` | reuse the identity git already has | `user.name` is a **legal name** (`Cristian Rinaldi`) — `memory-format.md:276` says actor is a handle, *never PII*; `EMAIL_ACTOR_RE` (`format.mjs:46,153`) already refuses the email. Slugging either mints PII into a durable, world-readable store, 2360 records deep |
| **`git config brain.actor` — a namespaced, per-checkout, explicitly-chosen handle** | the same shape as `reviewer.handle` ("configured, not claimed", `review/identity.mjs`) and the same mechanism as `brain.aiAgents`, which `hooks/commit-msg:75` already reads | one command to set, once per machine; unset means a refusal (below) |
| the forge login (`gh api user`) | authoritative | a network call on the capture path. No |

**`actorKind` is measured, not configured**: a static `git config brain.actorKind` would be
`PLAINFILES_ACTOR_KIND` relocated. It is read from the session environment — the agent-marker
env var (`AI_AGENT`, measured live as `claude-code_2-1-266_agent`; the name overridable by
`git config brain.agentEnv`, mirroring `brain.aiAgents`). Present ⇒ `agent`, absent ⇒ `human`.

**The precedence chain, in one line:**
`actor` ← `git config brain.actor` (handle-shaped, else refuse) · `actorKind` ← agent-marker
env present ? `agent` : `human` · `issue` ← `--issue`, else the branch (D3) · and the
**evidence** for each travels in `source`: `plainfiles save on <host>; actorKind from
AI_AGENT=claude-code_2-1-266_agent; issue from branch fix/issue-738-...`. `source` is excluded
from the id hash (`format.mjs:83`), so recording the instrument cannot fragment dedup, and W1
keeps it one trimmed line.

**One handle space, not two.** An agent capture carries the OPERATOR's handle with
`actorKind: agent`; the agent is named in `source`. This repo already rules that a human owns
what an agent produces — `hooks/commit-msg:75-77` and `pre-receive:91-93` **refuse AI
co-authorship in a commit message**. Minting `@claude-code` as an author of durable record
would contradict a tested rule, and it answers Q4 of the exploration without touching
`HANDLE_RE`: the `@` prefix is normative, and `memory-format.md:58`'s bare
`claude-sonnet-4-6` example is the outlier, corrected in the same PR.

**Nothing resolves ⇒ refuse the save**, by name, with the command:

| option | cost |
|---|---|
| **fail closed: `memory:save` refuses when `brain.actor` is unset or not handle-shaped** | one refusal message + i18n. Same discipline `type` already has (`plainfiles.mjs:112`, refused by name with the list). One command per machine: `git config --local brain.actor @csrinaldi` |
| a typed `actorKind: unknown` | an **ADR-0017 Amendment 3** (Tier 2 — a maintainer sitting) that reopens a two-value enum in `format.mjs:144`, `memory-format.md`, and every reader — and still does not produce a handle. It answers a different question |

**Recommendation: fail closed, and `actorKind: unknown` is NOT adopted.** The epic's *"ruling
on `actorKind: unknown` lands as an ADR-0017 amendment if adopted"* is hereby answered **not
adopted**, with the reopening condition stated: a producer that must capture where no human
can configure a handle (a CI runner) — which does not exist today, and would configure
`brain.actor` in the runner rather than reopen the enum. Recorded so the epic line closes
instead of silently deferring.

### D2 — Where the "never a branch" rule is enforced, and by which module

The epic says *"`buildRecord` refuses a `/`"*. **Departure, with a reason**: `buildRecord`
validates nothing today by contract (`format.mjs:114` — *"without validation"*), and making
it throw would change every caller including `exportObservation`, whose discipline is
*counted, never thrown* (`engram.mjs:338-349`, the #529 trap).

| where | what it refuses | why there |
|---|---|---|
| **`validateWritableRecord` (new W3)** | an `actor` containing `/` **or** equal to `main`/`master`/`develop`/`trunk` | it is the ONE chokepoint every in-tree producer passes (`store.mjs:105-118` says so). The READ gate stays looser, so the 183 branch-shaped historical records still parse — the existing W1/W2 split |
| **`resolveActor` (the producer)** | an `actor` that is not `@`-handle-shaped | the positive requirement belongs to the derivation, not the schema. W3 refusing everything non-`@` would brick `migrate-v1`/export paths on records brain cannot migrate |
| **`exportObservation` (soft)** | a §4-recovered branch-shaped actor ⇒ `{ rejected }`, not a throw | keeps `share`'s counted-not-thrown discipline. **Measured vacuous**: 0/278 observations recover today |

**One rule, one home**: `HANDLE_RE`, `DEFAULT_BRANCHES` and `classifyActor` live in
`audit.mjs:15-68` today and would be needed in `format.mjs`. They MOVE to `format.mjs` (the
schema owner) and `audit.mjs` imports them — the repo's own `issue-ref-patterns.mjs` /
`credential-env.mjs` pattern. `audit.test.mjs` stays green **unchanged**; that is the proof
the move is behaviour-preserving.

### D3 — `issue`: the branch's actual job

| option | cost |
|---|---|
| keep `--issue` only | the field stays empty on every capture where the operator forgets, which is the coverage number #368 already reports |
| **`--issue` wins; absent, derive from a branch matching `^[a-z]+/issue-(\d+)(-\|$)`; no match ⇒ absent** | ~10 lines. The derivation is recorded in `source`, so a reader can tell a DECLARED issue from a DERIVED one — the exact discipline #461 exists to restore ("a `source` citing an undeclared issue fabricates `issue`") |
| derive from anything looser (commit trailers, PR lookup) | fabrication, network, or both |

**Recommendation: derive-with-explicit-override, never fabricate.** `issue` is in the id
hash, so a derived value changes the record id — which is correct: a record about #738 is a
different record from one about nothing. The branch answers *where*; this is the field where
that answer is true.

### D4 — `exportObservation`: freshness is a DOOR, not a date

#738's acceptance item 5 asks for a guard. The exploration's Q5 asks how to tell a historical
observation from a fresh one.

| option | cost |
|---|---|
| a date cutoff ("created after this merge") | a timestamp heuristic baked into code, wrong the moment a store is imported |
| refuse every unprovenanced observation | refuses the 2070 historical observations and makes `share` unusable — the #529 trap #542 already declined |
| **rule it by the door**: every observation reaching `exportObservation` came through a door brain does not own, so it is legacy **by construction**. The `@legacy`/`human` pair stays as ONE documented sentinel for that path, and retires WITH the door under #874 | the headline "2177 records claim `human`" is answered by making the pair unmistakably a sentinel and unreachable for brain's own producers, not by an enum change |

**Recommendation: rule it by the door.** This slice fixes the record-producing door
(`plainfiles.save`) and adds the **guard as a test**: no record built through brain's own
capture path can carry `@legacy`, a branch-shaped actor, or an unmeasured `actorKind`.
`exportObservation` gains only D2's soft rejection and a comment naming #874 as its
retirement. Any reader counting `actorKind` must exclude `actor === '@legacy'` — `audit.mjs`'s
`classifyActor` already does, which is why brain's own numbers were never fooled.

### D5 — The audit target and the exit

| horizon | target | measured by |
|---|---|---|
| **fresh records** (captured by `memory:save` after merge) | `handle` **100%**, `branch` 0, `@legacy` 0, `actorKind` matching the capturing session | `npm run memory:audit` — the same `actorShape`/`coverage` definitions #870 shipped |
| all-time share (2177 `@legacy`, 183 branch) | **unchanged** — write-time fix, no rewrite | the historical rows move only with #864 task 1.2a / #368, out of scope |
| #864 exit 6.1 | `actor` handle share vs the 0/94 baseline, `@legacy` vs 66/94 | quoted in this slice's verify report and again at 6.1 |

Exit evidence for the PR: one real `memory:save` in this worktree, the resulting record
pasted (`actor: "@csrinaldi"`, `actorKind` matching the session, `issue: 738`), plus the
refusal message from a checkout with `brain.actor` unset.

### D6 — Scope, tests-first order, delivery

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**` from the counted diff.

| path | counted |
|---|---|
| `memory/lib/actor-identity.mjs` (new — pure `resolveActor` + reader seams) | ~60 |
| `memory/lib/format.mjs` — W3, plus `HANDLE_RE`/`DEFAULT_BRANCHES`/`classifyActor` rehomed | ~35 |
| `memory/lib/audit.mjs` — import what it used to define | ~ −12 / +5 |
| `memory/backends/plainfiles.mjs` — wire the seam, retire `PLAINFILES_ACTOR_KIND`, `source` evidence, `issue` derivation | ~40 |
| `memory/lib/engram-export.mjs` — soft rejection + the #874 retirement note | ~15 |
| `i18n/en.mjs`, `i18n/es.mjs` — the refusal and the derived-issue notice | ~8 |
| `brain/core/methodology/memory-format.md`, `memory-backend-contract.md` | ~12 |

**Estimated counted: ~165. Reviewer-visible with tests: ~600. 400-line budget risk: Low.
Chained PRs recommended: No. One PR closing #738.** No ADR, so no `decision-gate` surface.

**STRICT TDD — tests first, in this order:**

| # | file | what it pins |
|---|---|---|
| 1 | `memory/lib/actor-identity.test.mjs` (new) | `resolveActor`: configured handle ⇒ `{actor, actorKind, evidence}`; unset ⇒ refusal naming the command; a non-handle-shaped config value ⇒ refused; agent marker present ⇒ `agent`, absent ⇒ `human`; `brain.agentEnv` override honoured; NO env var can supply the handle |
| 2 | `memory/lib/format.test.mjs` (extend) | W3 refuses `feat/x` and each of `main`/`master`/`develop`/`trunk`; `validateRecord` (read gate) still ADMITS them; `@legacy` and `@csrinaldi` pass both; `classifyActor` re-exported with identical behaviour |
| 3 | `memory/lib/audit.test.mjs` | **unchanged and green** — the proof the predicate move is behaviour-preserving |
| 4 | `memory/backends/plainfiles.save.test.mjs` (extend/adjust) | a record's `actor` is the configured handle, never the injected branch; `actorKind` follows the session; `source` names the instrument; `--issue` absent + a matching branch ⇒ derived; a non-matching branch ⇒ `issue` absent, never fabricated |
| 5 | `memory/backends/plainfiles.actorkind-consistency.test.mjs` (**REWRITTEN**) | the surviving convention: neither door accepts caller-supplied `actor`/`actorKind`; the capture door derives a handle and a branch value can never reach `actor`; `featureCheckpoint` still branch-scopes its own working memory (it is not a record producer) |
| 6 | `memory/cli.save-search.test.mjs` (extend) | the refusal exits non-zero with the `git config --local brain.actor` command in the message; still no `--actor`/`--actor-kind` flag is recognised |
| 7 | `memory/lib/engram-export.test.mjs` (extend) | a genuine §4 block still recovers exactly as today; a recovered branch-shaped actor ⇒ `{rejected}`, never a throw; the `@legacy` path is unchanged for the historical case |
| 8 | `memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs` (extend) | `#738` accepted as a decision anchor alongside `obs #578`; the live tracked-docs assertion stays clean |

## Capabilities (contract with `sdd-spec`)

**New: none. Modified: none.** `openspec/specs/**` is empty in this repo by convention; the
normative surfaces are `memory-format.md`, `memory-backend-contract.md` and ADR-0017, and
only the first two change (schema example + the already-written Producers row).

## Non-goals

No change to engram's `mem_save` / `mem_session_summary` MCP tools (#874 owns that door, and
its body says *"No change to the MCP plugin"*). No un-stubbing of engram's `save`. No backfill
of the 2177 `@legacy` records (#864 task 1.2a / #368). No `HANDLE_RE` grammar change. No
ADR-0017 amendment and no `actorKind: unknown`. No `--actor`/`--actor-kind`/`--ts` flag and no
`BRAIN_ACTOR` env var. No network call on the capture path. No `supersedes` writer (#805). No
chunk-materialization work (#247). No change to the cold-review poster, which already carries
a verified handle.

## Affected areas

| path | impact | what changes |
|---|---|---|
| `brain/scripts/memory/lib/actor-identity.mjs` | New | the one pure identity resolver + its git-config/env seams |
| `brain/scripts/memory/lib/format.mjs` | Modified | W3 (never a branch); the actor predicate rehomed here |
| `brain/scripts/memory/lib/audit.mjs` | Modified | imports the predicate it used to define |
| `brain/scripts/memory/backends/plainfiles.mjs` | Modified | derived `actor`/`actorKind`, `PLAINFILES_ACTOR_KIND` retired, `issue` from the branch, evidence in `source` |
| `brain/scripts/memory/lib/engram-export.mjs` | Modified | soft rejection of a branch-shaped recovered actor; the #874 retirement note |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | Modified | refusal + derived-issue strings |
| `brain/core/methodology/memory-format.md` | Modified | the `actor` example becomes `@`-prefixed; the agent-capture convention stated |
| `brain/core/methodology/memory-backend-contract.md` | Modified | the Producers row's "#738" promise marked delivered |
| `openspec/changes/issue-864-memory-2-0/tasks.md:31` | Modified | box checked in this slice's PR |
| a maintainer's machine | Configuration | `git config --local brain.actor @csrinaldi` — **not in the diff** |

## Risks

| risk | likelihood | mitigation |
|---|---|---|
| The refusal blocks a capture mid-session on a fresh clone | **High (by design, once)** | the message IS the remedy: the exact `git config` command. Named in the PR body and in `memory-format.md` |
| W3 refuses a record some untested producer writes | Low | `appendRecord` is the single chokepoint and every in-tree producer is enumerated (`store.mjs:105-110`); W3 refuses only the branch shape, never "not a handle" |
| `share` starts throwing on a recovered branch-shaped actor | Low | D2 makes it a `{rejected}` row, not a throw; measured vacuous at 0/278 recoveries |
| `AI_AGENT` is a convention brain does not own and may vanish | Med | absence degrades to `actorKind: human`, which is the honest reading of "no agent marker present"; the var name is `git config brain.agentEnv`-overridable, and the evidence is in `source` so a wrong measurement is visible rather than silent |
| An operator configures a handle that is not their real forge login | Med | accepted and stated: `actor` is a CONFIGURED identity corroborated by the git author of the commit that lands the record on the lane — never a proven one. `reviewer.handle` is the only handle brain token-verifies, and only for review |
| Test churn in `plainfiles.save.test.mjs` reads as scope creep | Med | the `getBranch` seam SURVIVES (it now feeds `issue`), so most injections stand; the changed assertions are the ones the fix is about |
| The consistency test's rewrite is read as "patching the test to pass" | Med | D0's correction note and the PR body state the surviving convention explicitly; the rewritten test asserts a branch value can never reach `actor` — strictly stronger than what it replaced |

## Rollback

Revert the PR. No record is rewritten, no store is migrated, no config is required by the
reverted code — `git config brain.actor` simply becomes unread. Records captured while the
change was live keep their handles and remain valid under both the read and write gates
(a handle is not a shape any rule refuses). The one non-obvious step: nothing.

## Success criteria

- [ ] `npm test` green; `memory/lib/audit.test.mjs` passes **unmodified**.
- [ ] A fresh `memory:save` in this worktree writes `actor: "@<handle>"`, an `actorKind`
      matching the session, and `issue: 738` — pasted in the verify report.
- [ ] With `brain.actor` unset, `memory:save` refuses, exits non-zero, and the message names
      `git config --local brain.actor @<handle>`.
- [ ] `PLAINFILES_ACTOR_KIND` no longer exists; no `--actor`/`--actor-kind` flag exists.
- [ ] `validateWritableRecord` refuses `feat/x` and `main`; `validateRecord` still admits both.
- [ ] No record produced by brain's own capture path can carry `@legacy` — asserted by test.
- [ ] `plainfiles.actorkind-consistency.test.mjs` pins the NEW convention and fails if the
      derivation reverts to the branch.
- [ ] `npm run memory:audit`: the fresh window shows `handle` incrementing from an all-time 0.
- [ ] `#738` is an accepted anchor in the doc tripwire; the live tracked-docs scan is clean.
- [ ] The correction comment is posted on #542 and #738 (maintainer act).

## For the maintainer

**1. This slice overturns a named, tested ruling.** PR #542 ruled branch-derived `actor` "not
a defect". `plainfiles.actorkind-consistency.test.mjs` is its pin, and it will be REWRITTEN —
please read it (and D0) before approving, because a design that leaves it passing unchanged is
a design in which the fix did not happen.

**2. The identity precedence chain you are approving:**

```
actor      ← git config brain.actor        (handle-shaped, else the save is REFUSED)
actorKind  ← agent-marker env present ? "agent" : "human"   (name via git config brain.agentEnv)
issue      ← --issue, else ^[a-z]+/issue-(\d+) from the branch, else absent
source     ← "plainfiles save on <host>; actorKind from <VAR>=<value>; issue from branch <b>"
```

Explicitly refused: `BRAIN_ACTOR` (an env var is `--actor` with extra steps), `git config
user.name`/`user.email` (PII into a durable store), `gh api user` (network on the capture
path), and `actorKind: unknown` (an ADR-0017 amendment that would not produce a handle).
One setup command per machine: `git config --local brain.actor @csrinaldi`.

**3. Draft comment for #542 and #738:**

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

## Proposal question round

Each has a working recommendation above; none blocks `sdd-spec` / `sdd-design`.

1. **D1 makes a fresh clone refuse its first capture.** The alternative is guessing an actor
   from `git config user.name`, which mints a legal name into a durable public store. Is a
   one-time `git config --local brain.actor @you` the right price, or should the first refusal
   instead be a prompt in `bootstrap`/`brain:init` (a different slice)?
2. **D1 gives an agent capture the OPERATOR's handle**, not the agent's, with the agent named
   in `source` — on the argument that this repo already refuses AI co-authorship in commit
   messages. If you want `actor: "@claude-code"` instead, say so now: it changes the handle
   space, `memory-format.md`, and what the audit's handle share means.
3. **D2 departs from the epic's literal wording** ("`buildRecord` refuses a `/`") and puts the
   refusal in `validateWritableRecord` so the read path and `share` keep working. Accept the
   departure, or should `buildRecord` throw?
4. **D4 declines to add an `exportObservation` guard beyond a test**, ruling the export path
   legacy by construction and retiring it with #874 rather than with a date cutoff. Enough for
   acceptance item 5, or do you want a hard refusal there now?
5. **D3 derives `issue` from the branch.** It is a new inference on a hashed field. The
   derivation is recorded in `source` so it is never mistaken for a declaration — is that the
   right side of #461's line?
