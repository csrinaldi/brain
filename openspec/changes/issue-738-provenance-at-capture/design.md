---
status: proposed
issue: 738
---

# Design — #738 provenance at capture: one configured handle, one measured kind, and the branch demoted to the field it can answer

Parent: #864 task 2.2 (Wave 2), prerequisite of #874. Ruling: engram
`sdd/issue-738-provenance-at-capture/ruling` (operator + `brain.actor`; refusal when unset; an
agent capture carries the OPERATOR's handle; #542's "not a defect" overturned). Inputs:
`proposal.md`, `explore.md`. Shape follows `openspec/changes/archive/889/design.md`.

## Approach in one paragraph

One **pure** module — `memory/lib/capture-provenance.mjs` — answers the capture door's three
provenance questions (who / what kind / which ticket) from values someone else read, and one
**15-line** git primitive — `lib/git-config.mjs` — is the only thing that touches git.
`plainfiles.save()` keeps every seam it has (`getBranch` survives, now feeding `issue`), gains two
(`getGitConfig`, `getEnv`), loses one constant (`PLAINFILES_ACTOR_KIND`), and refuses by name when
`brain.actor` is unset — the same refusal shape `type` and `--issue` already have. The
never-a-branch rule lands as **W3** in `validateWritableRecord`, the one chokepoint all three
in-tree producers pass (`store.mjs:105-118`); `HANDLE_RE`/`DEFAULT_BRANCHES`/`classifyActor` move
from `audit.mjs:15-68` to `format.mjs` so the schema owner holds the predicate and `audit.test.mjs`
stays green **unmodified** — the proof the move is behaviour-preserving.

## Module map and signatures

```
brain/scripts/lib/git-config.mjs                     NEW  the ONE spawn
  export function gitConfigGet(key, cwd, { _spawn }) -> string|null      never throws

brain/scripts/memory/lib/capture-provenance.mjs      NEW  pure: no fs, no child_process
  export const AGENT_ENV_DEFAULT = 'AI_AGENT'
  export const RESERVED_ACTORS   = new Set(['@legacy'])
  export const ISSUE_BRANCH_RE   = /^[a-z]+\/issue-(\d+)(?:-|$)/
  export function resolveActor({ configured })
      -> { ok:true, actor, evidence } | { ok:false, reason:'unset'|'malformed'|'reserved', value }
  export function resolveActorKind({ env, agentEnvConfig })
      -> { actorKind:'human'|'agent', marker: string|null, evidence }
  export function deriveIssue({ declared, branch })
      -> { issue: number|undefined, derived: boolean, evidence }
  export function composeSource({ host, actor, kind, issue })  -> one trimmed line (W1-safe)

brain/scripts/memory/lib/format.mjs                  MOD  W3 + the rehomed actor predicate
brain/scripts/memory/lib/audit.mjs                   MOD  imports what it used to define
brain/scripts/memory/backends/plainfiles.mjs         MOD  wire the resolvers, retire the constant
brain/scripts/memory/lib/engram-export.mjs           MOD  soft-reject a branch-shaped recovery
brain/scripts/i18n/{en,es}.mjs                       MOD  4 keys × 2 catalogs
```

## Architecture decisions

### A1 — One pure module named for what it does, and the git read is a separate 15-line primitive

Departure from the proposal's single `actor-identity.mjs`, stated: the module also derives `issue`
from the branch, and a file named `actor-identity` either lies about that or forces a second
20-line module. `capture-provenance.mjs` names the job. `provenance.mjs` is taken — it is the §4
prose PARSER (`engram-export.mjs:9`) and must not become two things.

| option | cost |
|---|---|
| one module with a `spawnSync` default seam inside it | the module is no longer pure; `format.mjs:7` and `audit.mjs:5` both declare "no child processes" as a contract, and the capture resolver is exactly the kind of rule that deserves zero-seam unit tests |
| **pure resolver + `lib/git-config.mjs` beside `lib/git-branch.mjs`** | one extra ~15-line file. `git-branch.mjs`'s own header exists because two ad-hoc implementations of "read a fact from git" disagreed; a second copy of that mistake for `git config` is avoided at introduction, not after |
| put `resolveActor` in `format.mjs` | `format.mjs` is the schema, not the derivation. D2 keeps the positive handle requirement OUT of the schema on purpose |

`gitConfigGet` runs **one** `git config --get <key>` with `cwd` = the record root. Not "local then
global": git's own precedence (system → global → local, last wins) is already what a single
`--get` returns, and re-implementing it would be a second precedence rule to keep in sync. The
`cwd` is `root` — the checkout that owns `.memory/records/` — never `repoRoot`, because reading the
developer's real repo config while writing to a test root makes a test's verdict depend on the
machine it runs on (A6).

### A2 — `resolveActor`: three refusals, one of them non-obvious

`HANDLE_RE` (`/^@[A-Za-z0-9][A-Za-z0-9-]*$/`, rehomed to `format.mjs`) is the positive requirement.

| input | result | why |
|---|---|---|
| unset / empty / whitespace | `{ok:false, reason:'unset'}` | fail closed (D1) — the message IS the remedy |
| `Cristian Rinaldi`, `csrinaldi`, `feat/x`, `csrinaldi@gmail.com` | `{ok:false, reason:'malformed'}` | the `@` prefix is normative; `memory-format.md:58`'s bare `claude-sonnet-4-6` example is the outlier and is corrected in this PR |
| **`@legacy`** | `{ok:false, reason:'reserved'}` | **the sentinel is configurable text.** Without this rule, `git config brain.actor @legacy` mints the export sentinel through the capture door and the guard test (D4) is true only by convention. One `Set`, one branch, one test |

`resolveActorKind`: `agentEnvConfig` is a **comma-separated list of variable NAMES**, default
`AI_AGENT`, read from `git config brain.agentEnv`. The first name whose value is non-empty wins and
is named in `source`; none ⇒ `human`. A list, not a single name, for the reason
`hooks/commit-msg:70` gives `brain.aiAgents`: tomorrow's agent harness needs no brain release. A
**set-but-empty** marker counts as absent (⇒ `human`) with `set but empty` recorded in the
evidence — the #888 set-but-blank discipline, made visible instead of silent.

`composeSource` emits ONE trimmed line, W1 by construction, and never a bare fact:

```
plainfiles save on <host>; actor from git config brain.actor; actorKind agent from env
AI_AGENT=claude-code_2-1-266_agent; issue 738 derived from branch feat/issue-738-provenance
```

The env VALUE is whitespace-collapsed and sliced to 64 chars before it enters the line: it is
agent-controlled text landing in a durable field, and W1 (`format.mjs:192-196`) is a refusal, not a
sanitizer. Declared vs derived is spelled in words (`declared via --issue` / `derived from branch`)
— #461's line: a reader must never mistake an inference for a declaration.

### A3 — `plainfiles.save`: the pipeline, and why the two existing refusals stay first

```
ignoredOpts warn (:87-90) ─► ts (:92) ─► branch = getBranch(root) (:93, seam SURVIVES)
  ─► resolvedProject (:111) ─► type refusal (:112-114)  ─► --issue integer refusal (:120-122)
  ─► resolveActor(getGitConfig('brain.actor'))     ─► REFUSE: actorUnset|Malformed|Reserved
  ─► resolveActorKind(getEnv(), getGitConfig('brain.agentEnv'))
  ─► deriveIssue({ declared: issue, branch })      ─► notice on stdout when derived
  ─► composeSource(...)  ─► buildRecord (:124)  ─► secret scan (:129)
  ─► _appendRecord (:139) ─► validateWritableRecord W1/W2/W3 (store.mjs:117)
  ─► rebuildIndex (:161)
```

Two orderings settled:

1. **`type` and `--issue` refuse before the actor does.** Both are caller mistakes the caller can
   fix in the same second; the actor refusal is a machine setup. Keeping them first also means no
   existing test changes its expected first-failure message.
2. **W3 stays inside `appendRecord`, i.e. AFTER the secret scan** — not hoisted. The chokepoint is
   the entire argument for W3 (`store.mjs:105-110` enumerates the three producers); a hoisted copy
   would be a second gate to keep in sync. Consequence, stated plainly: **W3 is unreachable from
   this door** once `resolveActor` succeeds. It exists for `dualWriteRecords` and `migrate-v1`, and
   it is tested directly on `validateWritableRecord`, never through `save`.

`PLAINFILES_ACTOR_KIND` (`:42`) and its docblock are deleted; the JSDoc at `:53-67` is rewritten
(it currently documents `actor ← getBranch` as the contract). The refusal shape is byte-identical
to `issueInvalid`: `throw new Error(await t(key, params))` → `cli.mjs:815` prints
`memory/cli: plainfiles.save() failed — <message>` → `process.exit(1)` (`:817`).

### A4 — W3: refuses the branch SHAPE, never "not a handle"

```js
// format.mjs, after W2
// W3 — `actor` must not be branch-shaped: no `/`, and not a bare default branch
//      (`main`/`master`/`develop`/`trunk`). #738 [rev #870].
if (classifyActor(record.actor) === 'branch') writeErrors.push(
  `actor is branch-shaped: '${record.actor}' — a branch answers WHERE, not WHO (W3, #738); ` +
  `the branch belongs in 'issue'`);
```

Departure from the epic's literal "`buildRecord` refuses a `/`", carried over from proposal D2 and
ratified: `buildRecord` validates nothing by contract (`format.mjs:114`) and `exportObservation`
calls it, whose discipline is *counted, never thrown*.

Rejected: **W3 requiring `HANDLE_RE`**. `exportObservation` recovers §4 actors verbatim, and a
recovered bare name (`crinaldi`, `claude-sonnet-4-6`) classifies as `other`; refusing `other` at the
write gate would make `migrate-v1.mjs:242` and `dualWriteRecords` (`engram.mjs:453`) **throw** on
records brain cannot migrate. The positive requirement lives in `resolveActor`, where the value is
being minted rather than recovered. `@legacy` classifies as `legacy`, so the sentinel still passes.

**One rule, one home.** `HANDLE_RE` (`audit.mjs:15`), `DEFAULT_BRANCHES` (`:18`) and
`classifyActor` (`:62-68`) move to `format.mjs`; `audit.mjs` imports them and re-exports
`classifyActor` (its own callers and `audit.test.mjs` import it from there). The repo's own
precedent: `governance/checks/issue-ref-patterns.mjs`, `lib/credential-env.mjs`. **Acceptance:
`audit.test.mjs` passes with zero edits.**

### A5 — `exportObservation`: the `@legacy` fallback stays; a RECOVERED branch is rejected

Settled precisely, because "legacy by door" (D4) and "soft-reject" (D2) can be read as contradicting
each other:

| path | behaviour | rationale |
|---|---|---|
| no §4 block (measured **0/278** recover) | **unchanged** — `@legacy` / `human` / `provenance unknown — migrated from engram chunk <id>` | legacy **by construction**: everything reaching this function came through a door brain does not own. The pair retires WITH that door under #874 — a comment at `engram-export.mjs:11-17` says so |
| §4 block recovered, actor branch-shaped | `{ rejected: { id, title, type, reason } }` **before** `buildRecord` | without it, W3 turns a recovery into a **throw** inside `share`/`migrate-v1` — the #529 trap #542 already declined. Rejecting keeps `share` counted-not-thrown |
| §4 recovered, actor `other`-shaped | accepted, unchanged | not this slice's rule; W3 admits it too |

Rejected: falling back to `@legacy` when a recovered actor is branch-shaped. That makes "recovery
produced something invalid" indistinguishable from "there was nothing to recover" — the
evidence-reader-empty-on-failure class this repo keeps paying for. The rejection is **measured
vacuous today** (0/278), which is exactly why it is cheap to make honest.

### A6 — The test surface: two seams, one fixture rule, and no ambient config

`save()` gains `getGitConfig = (key) => gitConfigGet(key, root)` and `getEnv = () => process.env`.
Every existing direct caller must inject `getGitConfig` or the default reads a real machine —
**~30 call sites** across `plainfiles.save.test.mjs` (12), `plainfiles.save-index-failure.test.mjs`
(12), `plainfiles-roundtrip.integration.test.mjs` (4), `plainfiles.actorkind-consistency.test.mjs`
(2, rewritten). Mechanical: one key added to each existing seam bag.

The **CLI-spawn** tests (`cli.save-search.test.mjs`, `capture-reachable.test.mjs`,
`cli.reindex-duplicates`, `cli.backend-fallback`) cannot inject a seam. They must:

1. `git init` the tmp root and `git config --local brain.actor @test` (the resolver reads `cwd:
   root`), and
2. spawn with `HOME=<isolated>`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1` — the exact
   isolation `cli.collect.test.mjs:199-213` already uses after the #897 runner failure.

Without (2) a developer's ambient `brain.actor` makes a test pass locally that fails in CI. This is
the single largest reviewer-visible cost of the slice and it is uncounted diff.

## File changes

| File | Action | What |
|---|---|---|
| `brain/scripts/lib/git-config.mjs` | Create | `gitConfigGet` — one spawn, never throws (~15) |
| `brain/scripts/memory/lib/capture-provenance.mjs` | Create | 4 pure resolvers + 3 constants (~65) |
| `brain/scripts/memory/lib/format.mjs` | Modify | W3; `HANDLE_RE`/`DEFAULT_BRANCHES`/`classifyActor` rehomed (~35) |
| `brain/scripts/memory/lib/audit.mjs` | Modify | import + re-export what it defined at `:15-68` (~17) |
| `brain/scripts/memory/backends/plainfiles.mjs` | Modify | 2 seams, 3 resolvers, `PLAINFILES_ACTOR_KIND` deleted, JSDoc `:53-67` rewritten (~45) |
| `brain/scripts/memory/lib/engram-export.mjs` | Modify | A5's rejection + the #874 retirement note (~15) |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | Modify | `actorUnset`, `actorMalformed`, `actorReserved`, `issueDerived` (~8) |
| `brain/core/methodology/memory-format.md` | Modify | `:58` actor example `@`-prefixed; `:276` the agent-capture convention (~8) |
| `brain/core/methodology/memory-backend-contract.md` | Modify | `:82` Producers row — the #738 promise marked delivered (~4) |
| `openspec/changes/issue-864-memory-2-0/tasks.md:31` | Modify | box checked (excluded from the count) |
| a maintainer's machine | Configuration | `git config --local brain.actor @csrinaldi` — **not in the diff** |

i18n note: `i18n/coverage.test.mjs` asserts `es.mjs` has an entry for **every** `en.mjs` key — four
keys means eight lines or a red suite. Doc note: `memory-format.md` will contain the refusal's
`git config` remedy near a `memory save` invocation, so it MUST carry a
`DECISION_REFERENCE_RE`-accepted anchor (`#738`, added below) or the live tripwire scan
(`plainfiles-actorkind-doc-tripwire.test.mjs:141-150`) goes red.

## Testing strategy — STRICT TDD, red before green, in this order

| # | file | pins | command |
|---|---|---|---|
| 1 | `memory/lib/capture-provenance.test.mjs` (new) | `resolveActor`: `@csrinaldi` ⇒ ok; unset/empty/whitespace ⇒ `unset`; `Cristian Rinaldi`/`csrinaldi`/`feat/x`/an email ⇒ `malformed`; **`@legacy` ⇒ `reserved`**. `resolveActorKind`: marker present ⇒ `agent`; absent ⇒ `human`; set-but-EMPTY ⇒ `human` + evidence; a 3-name `brain.agentEnv` list, second name set ⇒ `agent`, that name in the evidence. `deriveIssue`: declared wins; `feat/issue-738-x` ⇒ 738 derived; `main`, `unknown`, `feat/issue-abc` ⇒ absent, never fabricated. `composeSource`: one trimmed line; a 300-char env value is truncated; declared vs derived spelled differently | `node --test brain/scripts/memory/lib/capture-provenance.test.mjs` |
| 2 | `lib/git-config.test.mjs` (new) | `--get` argv asserted on a spawn spy; missing key ⇒ `null`; non-zero status ⇒ `null`; spawn throw ⇒ `null`, never a rethrow | `node --test brain/scripts/lib/git-config.test.mjs` |
| 3 | `memory/lib/format.test.mjs` (extend) | W3 refuses `feat/x` and each of `main`/`master`/`develop`/`trunk`; `validateRecord` (READ gate) still ADMITS all five; `@legacy`, `@csrinaldi` and a bare `crinaldi` pass the write gate; `classifyActor` exported here with identical behaviour | `node --test brain/scripts/memory/lib/format.test.mjs` |
| 4 | `memory/lib/audit.test.mjs` | **unchanged and green** — the proof the predicate move is behaviour-preserving | `node --test brain/scripts/memory/lib/audit.test.mjs` |
| 5 | `memory/backends/plainfiles.save.test.mjs` (extend/adjust) | `actor` is the configured handle and **never** the injected branch; `actorKind` follows the injected env; `source` names host + both instruments; `--issue` absent + matching branch ⇒ derived + notice; non-matching branch ⇒ `issue` absent; `brain.actor` unset ⇒ throws, nothing appended (records dir empty) | `node --test brain/scripts/memory/backends/plainfiles.save.test.mjs` |
| 6 | `memory/backends/plainfiles.actorkind-consistency.test.mjs` (**REWRITTEN**) | the surviving convention: neither door accepts caller-supplied `actor`/`actorKind`; the capture door's `actor` is the handle while `'seam-derived-branch'` reaches only `issue`/`source`; `featureCheckpoint` still branch-scopes its own working memory (not a record producer); **`PLAINFILES_ACTOR_KIND` is no longer exported** | `node --test brain/scripts/memory/backends/plainfiles.actorkind-consistency.test.mjs` |
| 7 | the `@legacy` guard (in #5) | a record built through the capture path can never carry `@legacy` — driven with `brain.actor=@legacy` (refused) **and** with a normal handle (asserted `!== '@legacy'`). Kills the mutant "a fallback in `buildRecord`" | ditto |
| 8 | `memory/cli.save-search.test.mjs` (extend) | with an isolated HOME and no `brain.actor`: exit non-zero and the message contains `git config --local brain.actor`; the existing no-`--actor`/`--actor-kind`/`--ts` test still passes | `node --test brain/scripts/memory/cli.save-search.test.mjs` |
| 9 | `memory/lib/engram-export.test.mjs` (extend) | a genuine §4 block recovers exactly as today; a recovered branch-shaped actor ⇒ `{rejected}`, never a throw and never `@legacy`; the no-block historical path unchanged | `node --test brain/scripts/memory/lib/engram-export.test.mjs` |
| 10 | `memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs` (extend) | `#738` accepted by `DECISION_REFERENCE_RE` (`:43`) alongside `obs #578`; the live tracked-docs scan stays clean **after** the two doc edits | `node --test brain/scripts/memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs` |
| 11 | `i18n/coverage.test.mjs` | en/es parity for the four new keys | `node --test brain/scripts/i18n/coverage.test.mjs` |

Full suite before the PR: `npm test`.

## Changed-line forecast and delivery

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**`.

**Estimated counted: ~212** (the proposal's ~165 plus the `git-config` primitive, the reserved-actor
rule and the wider `source` composition). **Reviewer-visible with tests: ~700. 400-line budget risk:
Low. Chained PRs recommended: No. Decision needed before apply: No.** One PR closing #738. No ADR,
so no `decision-gate` surface.

## What the apply phase must measure live (no Bash was available here)

1. `git config --get brain.actor` and `git config --get brain.agentEnv` in `/home/gandalf/IA/brain`
   and in the worktree — **expected unset**. Record the exit code, because the refusal test asserts
   the resolver's reading of it.
2. After `git config --local brain.actor @csrinaldi` in the MAIN checkout, run
   `git config --get --show-origin brain.actor` **from the worktree** — proves the one-command-per-
   clone claim (worktrees share `.git/config`, `bootstrap.worktree.test.mjs:14`). If it does NOT,
   the remedy message must say "per worktree" instead.
3. `git config --get nonexistent.key` with `cwd` = a NON-git tmpdir, once bare and once under
   `GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null HOME=<tmp>` — confirms both the `null`
   contract and the CLI-test isolation A6 depends on.
4. The exact existing refusal bytes: `BRAIN_MEMORY_TEST_ROOT=<tmp> node brain/scripts/memory/cli.mjs
   save t c --type discovery --issue abc` → stderr text + exit code, so the new refusal matches it
   shape-for-shape.
5. `AI_AGENT` presence and value: inside this Claude Code session vs a plain login shell
   (`bash -lc 'echo ${AI_AGENT-unset}'`). Then the same probe for Antigravity/Gemini if either is
   reachable; **if neither sets a marker, record it as a known gap in the verify report** and name
   `git config brain.agentEnv '<VAR1>,<VAR2>'` as the remedy — the whole reason the config is a list.
6. `npm run memory:audit` before and after one real capture: the fresh-window `handle` count moving
   off an all-time 0, pasted in the verify report (D5, and again at #864 exit 6.1).
7. One real `memory:save --issue 738` in this worktree, the resulting record line pasted, plus the
   refusal message captured from a checkout with `brain.actor` unset (D5's exit evidence).
8. Real counted diff against the ~212 forecast before opening the PR.

## Risks and residuals

| risk | mitigation |
|---|---|
| A fresh clone's first capture is refused | **by design, once.** The message IS the remedy (`git config --local brain.actor @you`), named in `memory-format.md` and the PR body. A `bootstrap`/`brain:init` prompt is a different slice (proposal Q1) |
| `AI_AGENT` absent ⇒ `human` — a fail-OPEN direction on a provenance field | recorded, not hidden: `source` carries `actorKind human — no agent marker among <list>`, so a wrong measurement is visible in the record itself. The list config absorbs a new harness without a release |
| The CLI-spawn tests pass locally on ambient config and fail in CI | A6's `HOME`/`GIT_CONFIG_GLOBAL`/`GIT_CONFIG_NOSYSTEM` isolation, already proven by `cli.collect.test.mjs:199-213` (#897) |
| The consistency test's rewrite reads as "patching the test to pass" | it asserts strictly MORE than what it replaced (a branch value can never reach `actor`; the retired constant is gone), and D0's correction comment states the surviving convention |
| `share` starts throwing on a recovered branch-shaped actor | A5 makes it a `{rejected}` row before `buildRecord`; measured vacuous at 0/278 |
| `git config brain.actor @legacy` mints the sentinel through the capture door | `RESERVED_ACTORS` refusal (A2) + test 7 |
| Doc edits trip the live doc-tripwire | test 10 runs the REAL scan after the edits; `#738` is added to `DECISION_REFERENCE_RE` in the same commit |
| `review/poster.mjs` drifts from this convention | it is **not** a record producer yet (`memory-backend-contract.md:83` — ships with #864 task 3.1a) and already carries a token-VERIFIED handle (`review/identity.mjs:193-197`). Nothing to change; its row is the stricter case |
| Test churn (~30 seam bags) reads as scope creep | uncounted diff, mechanical, one key per call site; the `getBranch` seam survives so no injection is deleted |

## Open questions

- [ ] **A1** — the module is `capture-provenance.mjs`, not the proposal's `actor-identity.mjs`,
      because it also derives `issue`. Rename cost is zero today, non-zero after apply.
- [ ] **A2** — `brain.agentEnv` as a comma-separated LIST rather than the proposal's single
      overridable name. Widens the config surface by ~2 lines; the alternative is a brain release
      every time a new agent harness appears.
- [ ] **A6** — CLI-spawn tests gain a `git init` + isolated-HOME fixture. Confirm this is preferred
      over a test-only capture seam (which would be `BRAIN_ACTOR` wearing a disguise, refused by D1).
