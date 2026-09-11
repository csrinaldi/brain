---
status: proposed
issue: 805
---

# Design — #805 a writer for `supersedes`: one pure classifier, two seams, and a refusal that says which of the three things went wrong

Parent: #864 task 2.1 (ADR-0034 L2 `:84-86`). Inputs: `proposal.md` (D1–D7), `explore.md`.
**No `sdd/issue-805-supersedes-writer/ruling` artifact exists in engram** — the launch prompt
restates D1–D7 as settled, and this design takes them as ratified. Every departure from the
proposal below is measured and named.

## Approach in one paragraph

One pure module — `brain/scripts/memory/lib/supersedes.mjs` — answers *"is this id in the store?"*
and returns which of three things is wrong when it is not. `plainfiles.save` owns the two reads as
injectable seams and turns the classifier's verdict into an i18n message, thrown before
`buildRecord` so nothing is hashed, scanned, or appended on a refusal. `cli.mjs`'s generic flag
parser gains `--supersedes` plus the two arity guards the generic parser cannot give it for free.
`engram.mjs` is **not touched**: naming the flag in its refusal is a catalog edit, because the
message is data. The doctrine sequence rides along as a `brain-amendment/1` draft in
`brain-drafts/`, at zero counted cost.

## Module map and signatures

```
brain/scripts/memory/lib/supersedes.mjs        NEW  pure — no fs, no child_process (ADR-0016)
  export const SUPERSEDES_ID_RE                /^rec-[0-9a-f]{16}$/
  export function classifySupersedes({ id, localIds, upstream })

brain/scripts/memory/backends/plainfiles.mjs   MOD  opt + 2 seams + the refusal (:76, :120-124, :136)
brain/scripts/memory/cli.mjs                   MOD  --supersedes into opts + 2 arity guards (:771-791)
brain/scripts/i18n/en.mjs, es.mjs              MOD  6 new keys; 1 edited (engramUnsupported)
brain/scripts/memory/backends/engram.mjs       UNCHANGED (A6)
brain/scripts/memory/lib/{format,store,upstream-records,audit}.mjs   UNCHANGED
```

## Architecture decisions

### A1 — `upstream` is a THUNK, so "local first" is a property of the module

`classifySupersedes({ id, localIds, upstream })` takes `upstream` as a **zero-argument function**
returning `upstreamRecordEntries`' result, and calls it **at most once, only on a local miss**. If
it took an already-read object, the git spawn would have happened before the classifier ran and
"a correction next to its target never touches git" would be a property of the caller's discipline
— untestable in the pure unit. A spy asserting **zero calls** on a local hit is the pin. Precedent:
`evaluateLaneScrub({ addedFiles, config, readFile })` (`archive/889/design.md:271`) already takes a
reader function into a pure evaluator.

**Measured correction to the launch prompt**: the reader's success arm is
`{ok:true, ref, stated, byId: Map, byPath, unnamed, configError?}` and its failure arm is
`{ok:false, ref, stated, reason, configError?}` (`upstream-records.mjs:267-268`). The membership
field is **`byId`**, not `entries`.

### A2 — The id grammar is declared here and pinned against the producer, not imported

| option | cost |
|---|---|
| **declare `SUPERSEDES_ID_RE` in `supersedes.mjs`; a test asserts `buildRecord(...).id` satisfies it** | a third copy of the grammar (`store.mjs:33`, `plan.mjs:32` are the other two) — but drift is caught by a test, not by review |
| import `store.mjs`'s `RECORD_ID_RE` | it is not exported, and `store.mjs` imports `node:fs` — the pure module's whole claim dies at its import line |
| move the grammar to `format.mjs` and import it in both | the right long-term home (the module that MINTS the id owns its grammar), but it edits `format.mjs` and `store.mjs`, which the proposal's success criteria pin as unchanged |

**Chosen: the first.** The producer is the oracle (`archive/889/design.md:96-98`, A3's same move).
`plan.mjs:28` already carries a "mirrors store.mjs" comment, so this is the repo's existing
tolerance, not a new one. Unifying the three copies is a follow-up, named in Open Questions.

### A3 — Three reasons, three keys: the classifier decides, the wrapper speaks

`format.mjs`-style purity means the classifier cannot `await t(...)`. It returns a reason token plus
a `detail` object that IS the i18n params bag for that reason; `plainfiles.save` holds a
three-entry reason→key map. ADR-0016's shape: the evaluator is context-unaware, the IO wrapper
renders.

| reason | key | says |
|---|---|---|
| `malformed` | `memory.plainfiles.save.supersedesMalformed` | the grammar `rec-<16 hex>` and the value received. Pure — before any fs or git call |
| `not-in-store` | `memory.plainfiles.save.supersedesNotInStore` | the store is local `records/` ∪ `origin/main` (`issue-864-memory-2-0/spec.md:24-27`); **a record on another host's unmerged branch is not in it, by that vocabulary** — ship it on the lane, then correct it. Names the ref consulted |
| `could-not-verify` | `memory.plainfiles.save.supersedesUnverifiable` | quotes `upstream.reason` **verbatim**, then both remedies: `git fetch origin main`, or point `BRAIN_MEMORY_UPSTREAM_REF` / `memory.upstreamRef` at a ref that resolves |

**Plus a fourth key, `…supersedesConfigError`, which WARNS and never refuses.**
`upstream-records.mjs:277-278` states the contract: `configError` rides on **both** arms and
"Callers MUST surface it — a fall-through that is not reported is the silent override the STATED
split exists to prevent." An operator who wrote `memory.upstreamRef` and then broke the JSON would
otherwise be silently checked against `origin/HEAD`. The classifier carries `configError` through
on every arm that consulted upstream; the wrapper `console.warn`s it, mirroring
`memory.save.plainfilesIgnoredOpts` (`plainfiles.mjs:89`). *Revert path if the reviewer wants it
gone: drop the key and fold the string into the two refusal details — one line, one test.*

### A4 — Placement: after the `issue` refusal, before `buildRecord`, and free when the flag is absent

The gate goes between `plainfiles.mjs:122` (the W2 `issue` refusal) and `:124` (`buildRecord`).
That ordering is forced from both sides: **after** `type`/`issue` so the cheapest and most common
mistakes still win the message, and **before** `buildRecord` so a refused id is never folded into
`hashInput` (`format.mjs:95`), never serialized, never scanned, never appended (`:139`).

`recordsDir` is computed at `:136` today; the gate needs it, so that one `join` **moves up** above
the gate (`indexPath` stays at `:137`). Apply must move it, not duplicate it.

`if (supersedes === undefined) { /* nothing */ }` short-circuits the whole gate: a save without the
flag reads no directory and spawns no git, exactly as today.

The secret scan (`:129`) now runs *after* the supersedes refusal. Neither path writes, so
"scan-then-write" is intact; a record with both a leaked token and a bad id reports the id first,
which is the cheaper diagnosis (no id computed, no serialization).

### A5 — The CLI enforces "exactly one id"; the backend cannot

The parser is `flags[arg.slice(2)] = rest[++i]` (`cli.mjs:778`). Measured consequences:
`--supersedes A --supersedes B` is **silently last-wins**, and `--supersedes` as the final argument
yields `undefined` — indistinguishable from "flag absent", so the record would be written **without
the field the operator asked for**. `plainfiles.save` receives one string and cannot see either.

Two guards in the parser, two distinct keys (`memory.save.supersedesRepeated`,
`memory.save.supersedesMissingValue`) — never one shared message for two situations
(`#637`'s ruling, `archive/889/design.md:160-172`'s two `uncomputable` causes). The repeated-flag
message names fan-in as **deferred** (D1/D3), so the operator who reached for it reads why rather
than getting B.

Scope note: `--issue` has the identical missing-value hole today (`cli.mjs:790` maps `undefined`
to `undefined`). **Not fixed here** — it is a different flag's bug and would widen the diff.

### A6 — `engram.save` names the flag in the CATALOG; `engram.mjs` is untouched

`engram.save()` is `unsupportedOp("save", "engram", { key: "memory.save.engramUnsupported" })`
(`engram.mjs:1108-1110`). The flag's name is a **static clause in a sentence**, not a parameter, so
naming it is an edit to `en.mjs:418` / `es.mjs:375` and nothing else. This is cheaper than the
proposal's ~3 lines of code and keeps "zero new behaviour on engram" literally true.

**Guard to respect**: `capture-reachable.test.mjs:55-59` asserts that message matches `/plainfiles/`,
`/memory:save/` and `/--type/` in **both** locales. Append the clause; do not restructure it.

### A7 — The refusal shape and the exit code are the ones already in use

Measured: `plainfiles.save` refuses by `throw new Error(await t(key, params))`
(`:113`, `:121`). `cli.mjs:811-817` catches, prints
`memory/cli: plainfiles.save() failed — <message>` on stderr, and exits **1**. The `indexFailed`
annotation (`:174-177`) is reserved for the post-append index failure and MUST NOT be set here —
attaching it would tell the operator "the record WAS written" about a record that was refused.

### A8 — Which refusal is testable where: the CLI's test root is not a git repository

`BRAIN_MEMORY_TEST_ROOT` is a bare `mkdtempSync` dir (`cli.save-search.test.mjs:28`). With no
`origin`, `resolveUpstreamRef` resolves nothing and `upstreamRecordEntries` returns
`ok:false, reason: "no upstream ref resolved (tried origin/HEAD, origin/main)"`. So at the CLI
layer an unknown id is honestly **`could-not-verify`**, not `not-in-store`; asserting the latter
there would be asserting a fiction. `not-in-store` requires an `ok:true` upstream read and
therefore belongs to the integration test, which builds a real bare origin.

Chains are allowed **by construction**: the classifier is given ids, never records, so it cannot
know whether its target is itself superseded. That is the ruling (D3) made structural.

## Interfaces

```js
// memory/lib/supersedes.mjs — pure. No fs, no child_process.
export const SUPERSEDES_ID_RE = /^rec-[0-9a-f]{16}$/;

/**
 * @param {object} args
 * @param {unknown} args.id                  the raw `--supersedes` value
 * @param {Set<string>} args.localIds        store.mjs#readRecordIds({recordsDir})
 * @param {() => object} args.upstream       DEFERRED reader; called at most once,
 *                                           and ONLY when localIds misses (A1)
 * @returns {{ok:true, source:'local'|'upstream', configError?:string}
 *          |{ok:false, reason:'malformed'|'not-in-store'|'could-not-verify',
 *            detail:object, configError?:string}}
 *   detail is the i18n params bag for that reason:
 *     malformed         -> { value }
 *     not-in-store      -> { id, ref }            ref may be null
 *     could-not-verify  -> { id, reason }         reason verbatim from the reader
 */
export function classifySupersedes({ id, localIds, upstream }) { … }
```

```js
// backends/plainfiles.mjs — the opts bag and the two new seams
save(title, content,
     { type, project, issue, supersedes, scope, topic } = {},
     { root, getBranch, getTimestamp, getHostname,
       _appendRecord, _rebuildIndex, _loadConfig,
       _readRecordIds = readRecordIds,                 // NEW
       _upstreamRecordEntries = upstreamRecordEntries, // NEW
     } = {})
```

## Data flow

```
memory:save … --supersedes <id>
  cli.mjs parser ── repeated? ─yes─► refuse (supersedesRepeated),      exit 1
                 └─ no value? ─yes─► refuse (supersedesMissingValue),  exit 1
                 └─► opts.supersedes ─► backend.save(title, content, opts, seams)

plainfiles.save
  type? issue?  ──► existing refusals (unchanged)
  supersedes === undefined ──► no read, no spawn ──────────────────┐
  else                                                             │
    _readRecordIds({recordsDir})  ──► localIds ──┐                 │
    classifySupersedes({ id, localIds,           │                 │
                         upstream: () => _upstreamRecordEntries({root}) })
        malformed ─────────────────► throw (pure, no read happened)│
        local hit ─► ok            (upstream thunk NEVER called)   │
        local miss ─► thunk ─► ok:true  ─ byId.has(id)? ─► ok / not-in-store
                            └─ ok:false ──────────────► could-not-verify
        configError present ──► console.warn, never a refusal      │
  ok ◄───────────────────────────────────────────────────────────── ┘
  buildRecord({ …, supersedes })  ──► id hashes the field (format.mjs:95)
  secret scan ─► _appendRecord ─► _rebuildIndex ─► { id, file, written }
```

## File changes

| File | Action | What |
|---|---|---|
| `brain/scripts/memory/lib/supersedes.mjs` | Create | `SUPERSEDES_ID_RE` + `classifySupersedes` (A1–A3) |
| `brain/scripts/memory/backends/plainfiles.mjs` | Modify | `supersedes` in the opts bag (`:76`); two seams; the gate between `:122` and `:124`; `recordsDir` hoisted from `:136`; `buildRecord({…, supersedes})` (`:124`) |
| `brain/scripts/memory/cli.mjs` | Modify | two arity guards + `supersedes` in `opts` (`:791`) |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | Modify | 6 new keys; `memory.save.engramUnsupported` gains one clause (A6) |
| `openspec/changes/issue-805-supersedes-writer/brain-drafts/memory-backend-contract.draft.md` | Create | the correction sequence (below) — excluded from the counted diff |

## The doctrine draft (D6)

A **non-ADR** `brain-amendment/1` contract. Measured constraint
(`lib/amendment-draft.mjs:147-154`): a non-ADR target MUST NOT carry `amendment:` **or**
`home-summary:` — both are refused by name. So the contract is exactly:

```
target: brain/core/methodology/memory-backend-contract.md
issue: 805
```

One `amend-find`/`amend-replace` pair, anchored on the **whole two-line sentence** that closes the
Deletion section (`memory-backend-contract.md:94-95`, verified to occur once):

```
**Records are never deleted.** A wrong record is corrected by a new record carrying
`supersedes` (#805) — the only correction the durable layer admits.
```

The replacement keeps those two lines verbatim and appends the four record-first steps (D6). That
containment is what makes promotion idempotent: with the anchor inside its own replacement,
`free = f − r×k = 1 − 1×1 = 0` and the act reports **done**, never double-applied
(`amendment-draft.mjs:389-398`).

**Verification, non-mutating**: `npm run brain:promote` refuses a non-TTY stdin by design
(`brain-promote.mjs:409-414`), so it is the maintainer's sitting, not the apply check. Apply
verifies the draft by calling `planAmendment` directly (pure, read-only) and asserting `ok:true`
with every act `pending`.

## Testing strategy — STRICT TDD, red before green, in this order

| # | file | pins |
|---|---|---|
| 1 | `memory/lib/supersedes.test.mjs` (new) | malformed (`rec-XYZ`, `rec-<15 hex>`, uppercase hex, `''`, non-string) ⇒ `malformed`, **thunk uncalled**; local hit ⇒ `ok, source:'local'`, **thunk uncalled (spy: 0 calls)**; local miss + `ok:true` + `byId.has` ⇒ `ok, source:'upstream'`; local miss + `ok:true` miss ⇒ `not-in-store` with `ref`; local miss + `ok:false` ⇒ `could-not-verify` carrying `reason` **verbatim** — never `not-in-store`; `configError` carried on both arms; thunk called **at most once**; producer oracle: `buildRecord(...).id` matches `SUPERSEDES_ID_RE` |
| 2 | `backends/plainfiles.save.test.mjs` (extend) | `{supersedes}` reaches `buildRecord` (the written record carries it); a refusal rejects with `_appendRecord` and `_rebuildIndex` at **0 calls** and no `records/` dir created (the `:20-36` secret-hit assertion shape); `supersedes` absent ⇒ **neither** new seam called; a local hit ⇒ `_upstreamRecordEntries` **not** called; the thrown error has **no `indexFailed`** (A7) |
| 3 | `memory/lib/format.test.mjs` (extend) | `buildRecord` with `supersedes` yields a **different id** than the same content without it (extends `:54`); `validateRecord` accepts the field; R3 omission unchanged |
| 4 | `memory/cli.save-search.test.mjs` (extend) | `--supersedes <local id>` writes the field, exit 0; `--supersedes` twice ⇒ exit 1 naming fan-in as deferred; `--supersedes` with no value ⇒ exit 1, **and no record written**; an unknown id in the non-git test root ⇒ exit 1 with the `could-not-verify` reason quoted (A8) |
| 5 | `memory/lib/supersedes.integration.test.mjs` (new) | bare origin + trunk + worktree, `upstream-records.integration.test.mjs:36-75`'s exact fixture: an id present **only** at `origin/main` after `git fetch` ⇒ accepted; an id in neither half ⇒ **`not-in-store`**, no file appended; the clone with `origin` removed ⇒ `could-not-verify` naming the degradation; superseding an already-superseded record ⇒ accepted, both records readable and indexed; D5's 6.1 scenario ⇒ `coverage(records).supersedes === 1` |
| 6 | `memory/lib/audit.test.mjs` | **unchanged** — the pure cases at `:89-96,136-156` stay as they are (D5) |
| 7 | `i18n/coverage.test.mjs` + `memory/capture-reachable.test.mjs` | existing, must stay green: 6 new keys in both locales; the engram refusal still matches `/plainfiles/`, `/memory:save/`, `/--type/` in both locales (A6) |

Full suite before the PR: `npm test`.

## Changed-line forecast and delivery

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**`.

| area | counted |
|---|---|
| `lib/supersedes.mjs` | ~50 |
| `backends/plainfiles.mjs` | ~28 |
| `cli.mjs` (flag + 2 arity guards) | ~14 |
| `i18n/en.mjs` + `es.mjs` (6 new keys, 1 edited line, ×2) | ~14 |
| `brain-drafts/` amendment | 0 (excluded) |
| **total counted** | **~106** |

Single PR; ~450–520 reviewer-visible lines with tests. The guard lines
(`Decision needed before apply`, `Chained PRs recommended`, `400-line budget risk`) are
`sdd-tasks`' to emit — this is their input, and the counted figure is the one the gate reads.

Departures from the proposal's ~87: `engram.mjs` drops out (A6, −3), the two CLI arity guards and
their keys are new (A5, +12), and the `configError` warn key is new (A3, +4).

## What the apply phase must measure live (no Bash was available here)

1. **The refusal shape end to end**: `MEMORY_BACKEND=plainfiles node brain/scripts/memory/cli.mjs
   save t c --type discovery --issue abc` under `BRAIN_MEMORY_TEST_ROOT` — capture the exact stderr
   line and exit code, and make the `--supersedes` refusals byte-identical in shape (A7).
2. **`upstreamRecordEntries({root})` on a non-git temp dir** — confirm `ok:false` and the exact
   `reason` string; A8's CLI test asserts that text.
3. **`SUPERSEDES_ID_RE` against a freshly built record** — `buildRecord(...).id` in a scratch run,
   before the regex is written (the producer is the oracle, A2).
4. **The `amend-find` anchor occurs exactly once**: `planAmendment({draftText, targetText,
   homeText:null, gitUserName:'x', today:'<iso>'})` ⇒ `ok:true`, every act `pending`. Read-only.
5. **The real counted diff** via `npm run brain:governance-status` / `run-check.mjs diff-size`
   before opening the PR, against the ~106 forecast.
6. **`npm test` green**, with `i18n/coverage.test.mjs` and `capture-reachable.test.mjs` named
   explicitly — they are the two that a catalog edit breaks first.

## Risks and residuals

| risk | mitigation |
|---|---|
| A shallow clone with no `origin/main` blocks a correction whose target is not local | D2/A1 — local is checked first, so the common case never reaches git. The refusal quotes `reason` and names both remedies. Fail-closed is what the field's one rule requires |
| An agent reads the correct `not-in-store` refusal as a bug and retries | the message states the spec's vocabulary and the remedy (ship it on the lane, then correct it); test 5 asserts the reason, not just the exit code |
| Fan-in arrives before a rule exists | A5 makes a repeated flag a **loud** refusal naming the deferral, instead of a silent last-wins that writes a half-truth |
| A third copy of the id grammar drifts from `store.mjs:33` / `plan.mjs:32` | A2 — the producer-oracle test fails the moment `computeRecordId`'s output stops matching |
| The catalog edit breaks `capture-reachable.test.mjs`'s three-substring guard | A6 names the guard and the three substrings; test 7 is in the TDD list |
| `configError` is surfaced as a warn on a path that still succeeds | deliberate — `upstream-records.mjs:277` makes surfacing it a caller obligation. One-line revert named in A3 |
| Scope creep toward a reader, or toward lane/tier work | D4/D7 — no `resolveSupersedes` in this diff; `format.mjs`, `store.mjs`, `upstream-records.mjs`, `audit.mjs` and `engram.mjs` are all unchanged |
| The D6 draft is not promoted before the epic's 6.1 exit | the **ruling** is already doctrine (`memory-backend-contract.md:90-95`); only the sequence waits on the maintainer, and the writer does not depend on it |

## Open questions

- [ ] **A5** — refusing a repeated `--supersedes` is a new per-flag arity rule in a parser that is
      otherwise uniformly last-wins. Confirm, or accept silent last-wins (−12 counted lines).
- [ ] **A3** — the fourth key (`configError` warn). Keep, or fold into the two refusal details.
- [ ] **A2** — the id grammar now lives in three places. Worth a follow-up that moves it into
      `format.mjs` (its producer) and has `store.mjs`, `plan.mjs` and `supersedes.mjs` import it?
- [ ] No `sdd/issue-805-supersedes-writer/ruling` exists in engram. If the maintainer's answers to
      the proposal's four questions differ from D1–D7 as restated, D2 (fail closed) and D4 (defer
      the reader) are the two that would move this design.
