---
status: proposed
issue: 805
epic: 864
---

# Proposal — #805 a writer for `supersedes`: one flag, one refusal, and the correction sequence written down

Parent: #864 (memory 2.0), task 2.1 — Wave 2. Hard prerequisite of *enabling* lane auto-merge
(ADR-0034 L2 `:84-86`, Deferred `:210-213`): a correction on any tier is a `supersedes` record,
never a force-push and never a revert of a record. This slice does not enable auto-merge; it makes
that undo **expressible**.

## What is wrong today

`supersedes` is fully specified, folded into the content hash (`format.mjs:92-98`), carried by
`buildRecord` (`:115-123`) and `buildIndexEntry` (`:252-258`), round-tripped through the
`**Supersede:**` marker (`provenance.mjs:108,218-230`), recovered by the engram importer
(`engram-import.mjs:64-74`), and counted by the audit (`audit.mjs:76-83`) — and **nothing writes
it**. `memory:save`'s parser builds `opts` from five flags and `supersedes` is not one
(`cli.mjs:791`); `plainfiles.save` destructures `{type, project, issue, scope, topic}`
(`plainfiles.mjs:76`) and calls `buildRecord` without it (`:124`); `engram.save` is
`unsupportedOp` outright (`engram.mjs:1108-1110`). So `coverage.supersedes` is **0** by
construction — the epic's 6.1 exit number cannot move — and the only correction the durable layer
admits (`memory-backend-contract.md:90-95`) has no producer.

Nothing on the read side needs changing: a superseded record already round-trips, indexes, and
hashes correctly. This is a **writer** slice plus **one refusal**.

## Decisions

### D1 — The writer surface: one flag, one id, backend-agnostic parser

| option | what it means | cost |
|---|---|---|
| **(a) `memory:save --supersedes <id>` — exactly one id, parsed in `cli.mjs`, forwarded through `plainfiles.save`'s opts into `buildRecord`** | the link is **declared**, never inferred (spec.md; design.md §6 rejected a `topic` field as an ADR-0017 amendment). One correction replaces one record | 2 lines in the parser, 2 in `plainfiles.save` |
| (b) repeatable `--supersedes` (fan-in: one record replacing several) | consolidating N records into one summary becomes expressible | `supersedes` is a **string** in the schema (`memory-format.md:63`) and in `hashInput` (`:85`). An array is a format change → a `validateRecord` change, an index change, a `**Supersede:**` grammar change, an importer change, and an ADR-0017 amendment. Not a flag — a schema slice |

**Recommendation: (a). Fan-in is explicitly out of scope**, and it is out of scope because the field
is a string, not because it is uninteresting. If consolidation needs it, it is a format ticket under
#864, not this one.

`engram.save` **stays `unsupportedOp`** — #874 (task 3.2) owns record-first for engram. The parser
is backend-agnostic, so the flag is *accepted* under `MEMORY_BACKEND=engram` and then refused by the
same blanket `unsupportedOp("save", "engram", …)` that refuses every save today. One improvement,
zero new behaviour: the message names the flag, so an agent that reached for `--supersedes` on the
wrong backend reads *why* instead of a generic "save is unsupported".

### D2 — Refusal semantics: local first, upstream only on a miss, fail **closed** on degradation

"The store" is already defined (`issue-864-memory-2-0/spec.md:24-27`): the local
`.memory/records/` of the worktree **∪** the records at `origin/main`. Both halves have a primitive
already in tree — `store.mjs#readRecordIds({recordsDir})` → `Set<string>`, and
`upstream-records.mjs#upstreamRecordEntries({root})` → `{ok:true, byId}` / `{ok:false, reason}`.

The order matters and it is the cheap half of the design: **check local first; consult
`origin/main` only when local misses.** A correction written next to the record it corrects — the
overwhelmingly common case — never touches git at all, so a shallow clone or a missing `origin`
cannot break it.

| option | what it means | cost |
|---|---|---|
| **(a) on `ok:false` (no ref resolved, unfetched clone, `ls-tree` non-zero) → REFUSE, naming the degradation and the remedy** | "I could not look" is reported as itself, never as "found nothing" — the `evidence-reader-empty-on-failure` class #574/#701 already solved once | a user on a genuinely shallow clone, correcting a record they do not have locally, is blocked until they `git fetch origin main` |
| (b) allow on `ok:false` (degrade open) | never blocks a correction | it writes a durable, hash-committed pointer to an id nobody verified. A dangling `supersedes` cannot be edited out — it can only be superseded, which needs the same check. The field's ONE rule ("the store refuses a `supersedes` that names no record in it") would hold only when the network was kind |

**Recommendation: (a), fail closed.** Three distinct refusal reasons, three distinct messages
(i18n keys in `en.mjs` + `es.mjs`, parity pinned by `i18n/coverage.test.mjs`):

1. **malformed** — not `rec-<16 hex>`. Caught pure, before any filesystem or git call.
2. **not in the store** — well-formed, absent from both halves, upstream read `ok:true`. The message
   must say *why* this is correct, or an agent mid-session reads a correct refusal as a bug: a
   record on another host's unmerged worktree is **not in the store**, by the spec's own vocabulary.
   Remedy: ship it (the lane), then correct it.
3. **could not verify** — local missed and the upstream read returned `ok:false`; the message quotes
   `reason` verbatim and states the two ways forward: `git fetch origin main`, or point
   `BRAIN_MEMORY_UPSTREAM_REF` / `memory.upstreamRef` at a ref that resolves.

**Where it lives**: a new pure module `brain/scripts/memory/lib/supersedes.mjs` exporting
`classifySupersedes({ id, localIds, upstream })` → `{ ok, reason }`, with the two reads staying in
`plainfiles.save` as injectable seams. `format.mjs` cannot host it — its own header states
pure-function-only, no fs, no child process — and this mirrors #889's `checks/lane.mjs` shape
exactly (ADR-0016: the evaluator is context-unaware, the IO lives in the wrapper).

### D3 — Chains, self-supersede, fan-in, and a mismatched `--issue`

| case | ruling | why |
|---|---|---|
| superseding an already-superseded record | **allow** | the chain **is** the history. Refusing it would force a corrector to first discover the tip — work only a reader (#874/#880) can do, and the reader resolves to the tip anyway. spec.md says "names no record in it", and a superseded record is still in it |
| self-supersede | **structurally impossible; one line of prose, no code** | `id` hashes `supersedes` (`memory-format.md:85`), so a record cannot know its own id before choosing the field. No rule to enforce |
| fan-in (two records superseding the same id) | **deferred, and said out loud** | no ordering rule exists; the union merge admits both. Named here so it is deferred, not silently unhandled. Belongs with D1(b) |
| cross-project id | **no extra scoping** | the store is per repository, so "in the store" already scopes it. Same trust model as `issue`, which is also unscoped |
| `--supersedes` whose target carries a different `--issue` | **allow** | a correction routinely arrives on a later ticket. Tying the two would invent a rule no document states |

### D4 — A `resolveSupersedes` reader helper: **defer**, and hand over the semantics

| option | what it means | cost |
|---|---|---|
| **(a) defer; ship the writer only** | this slice matches the epic's own wording ("a writer for `supersedes`") | the "supersedes > 0" audit target ships with no reader story — mitigated below |
| (b) a pure `latestOf(records)` here, tested, wired to nothing | front-loads work #880 needs | ~40 lines + ~60 of tests **with zero call sites** — dead code by the repo's own standard, and it would be *guessing* #880's shape (review rounds chained per PR) and #874's (engram projection). A tip-resolver written against an imagined consumer is a rule to unpick later, not a head start |

**Recommendation: (a) defer** — but the epic's 6.1 metric does not need a reader: `audit.mjs:76-83`
already counts the field, and today's baseline of 0 moves the moment the first correction lands.
What this proposal hands to #874/#880 instead of code is the **semantics, decided**: readers resolve
a chain to its **tip**; a superseded record stays readable and stays indexed (nothing hides it);
fan-in is undefined until D1(b) is ruled. That is the whole contract, and it costs a paragraph.

### D5 — `memory:audit`: no change, and the scenario that moves the number

`coverage.supersedes` already exists and is already tested on the pure side
(`audit.test.mjs:89-96,136-156`). **No audit code changes.** What is added is one integration
fixture that drives the real writer, plus the exit scenario for epic task 6.1, named:

> Save a record. Save a second record with `--supersedes <first-id>`. `npm run memory:audit` reports
> `coverage.supersedes: 1`, up from 0. Both records remain readable and indexed; the second's
> `**Supersede:**` line survives a `memory:reindex` round trip.

### D6 — Doctrine: the deletion ruling is already written; the **sequence** is not — and the issue's version of it is stale

**Measured**: `memory-backend-contract.md:90-95` already states the ruling verbatim — *"Records are
never deleted. A wrong record is corrected by a new record carrying `supersedes` (#805) — the only
correction the durable layer admits."* `memory-format.md:33` says the same from the format side.
**No new ruling is needed; #805 needs a cross-reference, not a draft.**

But the four-step sequence the issue body asks to write down — *correct in engram → `memory:share`
→ remove the stale file → `memory:reindex`* — **contradicts the ruling it would sit beside**. It is
engram-first (which #874 retires) and it deletes a record file (which the Deletion section
forbids). Writing it as-is would enshrine the exact act the same document prohibits.

**Recommendation**: propose the record-first sequence as a small `brain-drafts/` amendment for the
maintainer's sitting (the #863 pattern; `brain/core/**` is Tier-1 doctrine and not ours to edit),
targeting `memory-format.md`'s append-only paragraph (`:30-37`) with a pointer from
`memory-backend-contract.md`'s Deletion section:

> 1. Capture the correction as a new record: `npm run memory:save -- --supersedes <id> --issue N`.
> 2. The lane ships it (ADR-0034); the stale record is **not** touched, moved, or deleted.
> 3. `memory:reindex` regenerates the index; both records appear, the correction carries the link.
> 4. Readers resolve a chain to its tip (#874/#880). Until they do, both are visible — which is
>    correct: the history is the record.

`brain-drafts/` lives under `openspec/changes/**`, which `brain.config.json:18-29` excludes from the
counted diff — so the doc rides with the code slice at zero budget cost.

### D7 — Scope, tests, forecast, delivery

Counted-diff exclusions: `**/*.test.mjs`, `openspec/changes/**` (`brain.config.json:18-29`).

| area | counted |
|---|---|
| `lib/supersedes.mjs` (new, pure `classifySupersedes`) | ~45 |
| `backends/plainfiles.mjs` — destructure, two reads as seams, refusal, forward to `buildRecord` | ~25 |
| `cli.mjs:791` — `--supersedes` into `opts` | ~8 |
| `backends/engram.mjs` — `unsupportedOp` message names the flag | ~3 |
| `i18n/en.mjs` + `es.mjs` — three refusal keys × two locales | ~6 |
| `brain-drafts/` amendment (D6) | 0 (excluded) |
| **total counted** | **~87** |

**`Chained PRs recommended: No`. `400-line budget risk: Low`. Single PR** — ~87 counted, roughly
350–450 reviewer-visible with tests. `delivery_strategy: ask-on-risk`; the call is `sdd-tasks`'
forecast, this is its input.

**Non-goals**: no `engram.save` writer (#874). No index or format change — `supersedes` already
round-trips. No reader-side "hide the superseded" (#874/#880). No fan-in, no array-valued
`supersedes` (D1). No auto-merge enablement — after this merges, `allow_auto_merge` on the
repository and the first real lane are the **maintainer's** acts (#889 D7). No lane, tier, or
governance work. No `brain/core/**` edit — doctrine goes through `brain-drafts/`.

## Capabilities (contract with `sdd-spec`)

**New: none. Modified: none.** `openspec/specs/**` is empty by convention in this repo; the
normative surface is `issue-864-memory-2-0/spec.md`, `memory-format.md`, and
`memory-backend-contract.md` — none of which changes here (D6 proposes a doctrine *draft*, not a
promotion).

## STRICT TDD — tests first, in this order

| # | file | what it pins |
|---|---|---|
| 1 | `lib/supersedes.test.mjs` (new) | `classifySupersedes`: malformed id ⇒ refuse (its own reason); id in `localIds` ⇒ ok **without consulting upstream**; local miss + `upstream.ok:true` hit ⇒ ok; local miss + `ok:true` miss ⇒ refuse "not in the store"; local miss + `ok:false` ⇒ refuse **quoting `reason`** — never allow, never report as "not found" |
| 2 | `lib/format.test.mjs` (extend) | `buildRecord` with `supersedes` folds it into `hashInput` (a different `id` than the same content without it) and R3-omits it when absent — extends the existing `:84` / `:257` cases |
| 3 | `backends/plainfiles.save.test.mjs` (extend) | `save(..., {supersedes})` reaches `buildRecord`; the refusal throws **before** `_appendRecord` (no file written on a refusal); the upstream reader is injected as a seam |
| 4 | `cli.save-search.test.mjs` (extend) | `runCli(['save', …, '--supersedes', id])` under `BRAIN_MEMORY_TEST_ROOT`: happy path writes the field; an unknown id exits non-zero with the reason named |
| 5 | `lib/supersedes.integration.test.mjs` (new) | temp repo + **local bare origin**, following `upstream-records.integration.test.mjs`'s existing seams: an id present only at `origin/main` ⇒ accepted; an unfetched/shallow clone ⇒ refused with the degradation named |
| 6 | `lib/audit.test.mjs` (extend) | D5's integration fixture: a record written through the real writer moves `coverage.supersedes` off 0. The existing pure-function cases stay untouched |
| 7 | `i18n/coverage.test.mjs` (existing, must stay green) | the three new keys exist in **both** locales |

## Affected areas

| path | impact | what changes |
|---|---|---|
| `brain/scripts/memory/lib/supersedes.mjs` | New | the pure classifier |
| `brain/scripts/memory/backends/plainfiles.mjs` | Modified | opt forwarded; the two store reads as seams; refusal before append |
| `brain/scripts/memory/cli.mjs` | Modified | `--supersedes` parsed into `opts` |
| `brain/scripts/memory/backends/engram.mjs` | Modified | the `unsupportedOp` message names the flag |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | Modified | three refusal messages |
| `openspec/changes/issue-805-supersedes-writer/brain-drafts/` | New | D6's amendment, for the maintainer |
| `brain/scripts/memory/lib/format.mjs`, `store.mjs`, `upstream-records.mjs`, `audit.mjs` | **Unchanged** | every primitive this slice needs already exists |

## Risks

| risk | likelihood | mitigation |
|---|---|---|
| `upstreamRecordEntries` returns `ok:false` and a legitimate correction is blocked | Med | D2: local is checked first, so the common case never reaches git. The refusal quotes `reason` and names both remedies. Fail-closed is the direction the field's one rule requires |
| An agent reads a correct refusal ("on another host's unmerged worktree") as a bug and retries or works around it | Med | the message states the vocabulary and the remedy (ship it, then correct it) — test 5 asserts the reason text, not just the exit code |
| Fan-in arrives in practice before a rule exists | Low | D1/D3: named as deferred and why (the field is a string). The union merge admits both records; neither is lost |
| Scope creep toward a reader ("while we're here") | Med | D4 defers it and hands over the semantics instead; no `resolveSupersedes` in this diff |
| Scope creep toward lane/tier work | Low | D7 non-goals; #862/#887/#888/#889 are shipped or in flight |
| The D6 draft is not promoted before the epic's 6.1 exit | Low | the **ruling** is already doctrine (`memory-backend-contract.md:90-95`); only the sequence waits on the maintainer, and the writer does not depend on it |

## Rollback

Revert the PR. No record is touched, no index is rebuilt, no migration runs, no repository setting
changes. Records already written with `supersedes` **stay valid** — the field was always in the
format, the hash, and the index; the revert only removes the ability to write new ones, and every
reader continues to round-trip the existing ones. `coverage.supersedes` keeps whatever count it
reached. The `brain-drafts/` amendment is unpromoted doctrine and reverts with the change dir.

## Success criteria

- [ ] `npm test` green; `i18n/coverage.test.mjs` green with three new keys in both locales.
- [ ] `memory:save --supersedes <id>` writes a record whose `supersedes` equals `<id>`, and whose
      `id` differs from the same content saved without the flag.
- [ ] An id present only at `origin/main` is accepted; an id in neither half is refused **and no
      file is written**; an `ok:false` upstream read is refused with `reason` quoted verbatim.
- [ ] A malformed id is refused purely, before any filesystem or git call.
- [ ] Superseding an already-superseded record succeeds; both records stay readable and indexed.
- [ ] `MEMORY_BACKEND=engram memory:save --supersedes …` still fails with `unsupportedOp`, in a
      message that names the flag.
- [ ] `npm run memory:audit` reports `coverage.supersedes: 1` after the D5 scenario (baseline 0).
- [ ] The D6 amendment sits in `brain-drafts/`; no `brain/core/**` file is edited by this PR.
- [ ] No change to `format.mjs`, `store.mjs`, `upstream-records.mjs`, `audit.mjs`, or the lane.

## Proposal question round

Each has a working recommendation above; none blocks `sdd-spec` / `sdd-design`.

1. **D2 fails closed on a degraded upstream read.** On a shallow clone with no `origin/main`, a
   correction whose target is not local is **refused**, not warned. That is the strict reading of
   "the store refuses a `supersedes` that names no record in it" — but it makes a network condition
   into a write refusal. Refuse (recommended), or warn-and-write with the id unverified?
2. **D4 ships the writer with no reader.** The epic's 6.1 metric moves without one, and #880's chain
   shape is not yet known — but the field's *meaning* (resolve to the tip) then lives only in this
   proposal until #874/#880 implement it. Defer (recommended), or land `latestOf` now with no call
   sites?
3. **D6 refuses to write the sequence the issue asked for.** The issue's four steps are engram-first
   and include deleting a record file — which `memory-backend-contract.md:90-95` forbids. The
   record-first replacement is proposed as a `brain-drafts/` amendment instead. Is rewriting the
   ticket's own sequence the right call, or should the issue be amended first?
4. **D1 closes the door on fan-in.** One correction supersedes one record, because `supersedes` is a
   string in the hash. Consolidating several records into one summary therefore has no expression
   until a format slice. Is that acceptable for memory 2.0's exit, or does 6.1 need it?
