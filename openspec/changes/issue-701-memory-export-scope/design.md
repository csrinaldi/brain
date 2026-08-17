---
status: draft
issue: 701
artifact_store: hybrid
topic_key: sdd/issue-701-memory-export-scope/design
---

# Design — scoping the export to the upstream base (issue 701)

The whole change is **one predicate, resolved once per run, consumed at two call sites**:

> a candidate record is declined when its `id` is already present in `.memory/records/`
> at the upstream base, **in addition to** the existing check against the worktree's own
> `records/`.

Everything below is the consequence of choosing that predicate's *inputs*, its *cost*, its
*failure mode*, and its *seam*. No authorship semantics enter anywhere — that refusal is
`proposal.md` Decision 1 and it is not reopened here.

---

## Decision 1 — the predicate is a `Set` of filename-derived ids: one `git` call, zero blob reads

**Confirmed from the code, not assumed.** `store.mjs#recordFilename` is the ONE place that
maps a record to a path and it returns `` `${month}-${id}.jsonl` `` — the `id` **is** in the
filename. `appendRecord` is the single chokepoint every in-tree producer writes through
(`store.mjs:107` names all three: `plainfiles#save`, `engram#dualWriteRecords`,
`migrate-v1`), and `memory:split-records` derives names the same way. So for any store
written by brain since #677, *the set of ids at a ref is the set of basenames at that ref*,
and the real store proves the shape: 2091 files under `.memory/records/`, every one
`<yyyy-mm>-rec-<16 hex>.jsonl`.

Therefore the reader is:

```
git ls-tree -r -z --full-tree <ref> -- .memory/records
```

ONE process. `-r` because the pathspec would otherwise return the tree entry, not its files.
`--full-tree` so the pathspec is read from the repo root rather than the process cwd — the
`_defaultShareExport` lesson (#657) applied to a reader instead of a writer. `-z` because a
NUL-terminated stream cannot be mis-split, and paying nothing for that is better than
arguing that record filenames happen to be safe.

Output is `<mode> SP blob SP <oid> TAB <path>` per entry: ≈2091 entries, ≈160 KB, one spawn.
The **id set** comes from the basename; the **oid** is carried along because the staged-record
gate (Decision 6) needs it and asking git twice for one tree would be the #340 shape — two
readers of one fact, free to drift. Reading the blobs (2091 `cat-file` calls, or one
`--batch` and a second parser for the durable line format) buys exactly nothing the filename
does not already state, and a second parser of `records/*.jsonl` is a thing this repository
has refused before.

**No network.** The predicate reads the LOCAL remote-tracking ref and never runs `git fetch`.
`memory:share` runs inside `pre-push`; a fetch there would add latency to every push and fail
outright offline. A stale `origin/main` therefore yields a *smaller* id set, which writes
*more* records — degradation in the safe direction, which is the rule this whole design is
built on.

**Rejected — read the blobs and take each record's own `id`.** Exact even for a lying
filename (see "The one loss path"), but it is O(records) git work on a hook path and requires
a second reader of the record format. The exactness it buys is against a file no in-tree
producer can create.

**Rejected — diff the working tree against the ref (`git diff --name-only <ref>`).** It
answers "what is different here", which is a *worktree* question; the predicate needs "what
exists there", a *ref* question. Using the diff would make the answer depend on the local
tree's state, i.e. on the very thing being corrected.

---

## Decision 2 — the ref is the remote trunk **tip**, operator-overridable; and the merge-base is refused

Resolution order — deliberately the STATED-vs-DEFAULTED split `cli.mjs` already uses for
`MEMORY_BACKEND` (#641), because the two cases deserve different volume:

| # | source | stated? |
|---|---|---|
| 1 | `BRAIN_MEMORY_UPSTREAM_REF` env | stated |
| 2 | `brain.config.json` → `memory.upstreamRef` | stated |
| 3 | `refs/remotes/origin/HEAD` (the remote's own default branch) | derived |
| 4 | `origin/main` | derived |

First one that **resolves** wins; `git rev-parse --verify --quiet <ref>^{tree}` is the
resolution test. Levels 3-4 exist so a fork, a `master` trunk, or a consumer whose remote
default is not `main` works without configuration. Levels 1-2 exist as the escape hatch for
the case named below.

**The levels are read strictly in order, and level 1 is read BEFORE level 2 — that ordering
is load-bearing on its own**, not merely a consequence of "first one that resolves wins".
A `brain.config.json` that cannot be read must not disable `BRAIN_MEMORY_UPSTREAM_REF`,
because the env var is precisely the escape hatch an operator reaches for to work around a
broken config. Reading the config first would put the workaround behind the thing it works
around.

**Every outcome, including the ones no stated ref covers:**

| situation | ref reported | `stated` | result | what the operator is told |
|---|---|---|---|---|
| a stated ref (level 1 or 2) resolves | that ref | `true` | `ok: true` | nothing — it worked |
| a stated ref does **not** resolve | that ref | `true` | `ok: false` | the ref they named, and that resolution STOPPED there |
| no stated ref; a derived ref resolves | `origin/HEAD` or `origin/main` | `false` | `ok: true` | nothing — it worked |
| no stated ref; nothing resolves | **`null`** | `false` | `ok: false` | which refs were tried |
| config **unreadable**, a derived ref then answers | that derived ref | `false` | `ok: true` (`ok: false` if `ls-tree` then fails) | a `configError` naming the read failure, **plus** which derived ref was used instead |
| config **unreadable**, and nothing resolves either | **`null`** | `false` | `ok: false` | a `configError` naming the read failure, and that NO base resolved — no ref is named |

**`ref` is `null` whenever no ref answered, and that is the discriminator.** It reported the
string `origin/main` there for one round, which is a name for a run in which no ref was used,
and the consumers dutifully printed it: the operator was told "the upstream base was derived
as `origin/main` instead" one line above a line saying nothing had resolved. Because the
absent case is now absent rather than fabricated, no extra "did a ref resolve" flag is needed
anywhere in the chain, and the two ref-naming messages per consumer are keyed on `ref` itself.
A ref reaching git as the literal string `null` is impossible by construction: the `ls-tree`
call is downstream of a resolved ref, and the one other message that interpolates a ref
(`dedupedUpstream`) only prints on a non-zero count, which requires `ok: true`.

A **stated** ref that fails is still reported BY NAME with `stated: true`, never `null` — it
was honored and it failed, and the operator has to see which ref they asked for.

**The unreadable-config row is the one that needed correcting** (cold review round 2 of
#701). A stated ref that does not resolve stops resolution — that is the STATED guarantee,
and an operator's own ref is never silently swapped for another. An unreadable config is
**not that case**: nothing was stated, because nothing could be read, and levels 3-4 remain
perfectly answerable. Stopping there was measured to cost every repo with a corrupt config
its entire upstream scoping — including the common case where `memory.upstreamRef` was never
set at all, since the key is optional. The #701 pre-commit gate stopped refusing
byte-identical restages in exactly the mid-merge window (conflict markers in
`brain.config.json`) where it matters most.

So resolution **continues**, and the `evidence-reader-empty-on-failure` guarantee of
Decision 3 is kept by the REPORT rather than by the stop: "could not look at the config" is
never collapsed into "the config stated nothing". A `configError` string rides on the result
— on the `ok: true` arm too — and both consumers surface it whatever the verdict is:
`memory:share` via `upstreamScope.configError`, and the pre-commit gate via its own
`configError` channel, deliberately separate from `note` so a "nothing was refused" notice is
never printed over a genuine refusal.

**The merge-base is refused, and this is the load-bearing part.** `git merge-base HEAD
origin/main` is the branch point, and *records that landed on `main` after the branch point*
are precisely the 22 the measurement found. Scoping to the merge-base would reproduce the bug
under a new name. The **tip** is the correct ref because the question is not "what did this
branch start from" but "what is already durable on the trunk".

**What the tip gets wrong, named.** A worktree on a child branch of a `feature/*` tracker
chain (this repo's chain convention) has records that live on the tracker but not yet on
`main`. Those are absent from the trunk's tree, so they are **still re-materialized**, exactly
as today. Git does not know a branch's parent — `@{upstream}` is the branch's own remote
branch, not its base — and deriving one by merge-basing against every remote branch is a
semantics guess of the kind Decision 1 of the proposal refused. So the chain case is served by
the explicit escape hatch (`BRAIN_MEMORY_UPSTREAM_REF=origin/feature/X`) rather than by a
heuristic, and it is a **leak that persists**, never a loss.

**Why declining a trunk-present record is safe, stated as a theorem rather than a hope.**
Every id in that tree is committed and pushed to the shared trunk. Declining to re-write it
into a worktree removes a *copy*, never the record. The property we are knowingly giving up is
**accidental cross-branch replication as a durability mechanism** — today's export replicates
everything everywhere, and a record on an abandoned branch survives by that accident. That
accident is the 95.7%. The real durability mechanisms are the host-global engram DB and a
`memory:share` on the branch that owns the record; this design leans on those and says so.

---

## Decision 3 — unavailable degrades to TODAY, and "could not look" is never reported as "nothing there"

The seam returns a discriminated result, never a bare `Set`:

```
{ ok: true,  ref: string,      stated, byId: Map<id, oid>, byPath: Map<path, oid>,
                                       unnamed: string[],  configError?: string }
{ ok: false, ref: string|null, stated, reason: string,     configError?: string }
```

`configError` rides on BOTH arms — see Decision 2's unreadable-config rows. It is not a
failure of the lookup; it is a failure to read `brain.config.json` that the lookup survived
by falling through to a derived ref, and it must still reach the operator.

`ref` is non-null on the `ok: true` arm by construction and is `null` on the `ok: false` arm
exactly when no ref answered — so `ok: false` alone never means "no ref". `ls-tree` can fail
against a base that resolved perfectly well, and that base IS named, in `reason`. The
consumers' catalog wrappers for the unavailable case therefore interpolate no ref at all:
they fire on every `ok: false`, including the one with nothing to name. `reason` names the ref
where naming one is true, and it never restates the calling consumer's own degradation —
"writing every candidate" is the exporter's fact and was flatly false at the gate, which
writes nothing.

`ok: false` covers every way the lookup can fail to happen: no git binary, not a git
directory (a vendored `brain` inside a consumer repo, a test temp dir), no remote, a fresh
clone whose `origin/main` has never been fetched, an offline runner, `ls-tree` non-zero.

**On `ok: false` the run writes EVERYTHING** — byte-for-byte the pre-#701 behaviour. This is
not a compromise; it is the only defensible direction. A memory system that silently stops
materializing records fails in a way nothing detects, because a record that was never written
reads exactly like a record that was never captured (`#677` design Decision 3 makes the same
argument about the migration, and lands the same way). Writing too many is friction, is
visible, and is what this repository already lived with.

**The `evidence-reader-empty-on-failure` distinction is preserved even though both branches
behave identically here.** `ok: false` and `ok: true` with an empty `byId` (a genuinely empty
upstream store — a fresh repo) produce the same writes, so the distinction is not about
behaviour: it is about the **report**. Collapsing them would let a run print
`re-export declined: 0` as if it had checked, on a machine where it never looked. The
accounting therefore carries `applied: boolean` + `reason`, and `cli.mjs` prints the
unavailable case to **stderr** — the channel the hooks deliberately keep (#633).

**Stated-but-unresolvable is louder, not fatal.** If levels 1-2 named a ref that does not
resolve, that is an operator error worth a distinct message; it still degrades to
write-everything rather than refusing the share, because refusing would block `pre-push`.
Severity differs, behaviour does not.

**Partial scope is its own third state.** A file under `records/` whose name does not match
`/^\d{4}-\d{2}-(rec-[0-9a-f]{16})\.jsonl$/` is a pre-#677 month file (or an unknown shape);
its records are invisible to a filename-derived id set. Those files are counted into
`unnamed[]`, the ids inside them are simply absent from the set, and the records they hold
keep today's behaviour. Reported, with the remedy named (`npm run memory:split-records`).
Silently getting no fix on a legacy store is the failure mode; getting no fix *and being told
why* is the honest boundary, and it matches #677 Decision 2 — the migration is a verb, not an
upgrade step.

**The test that drives this** (question 3's explicit ask) is NOT "the existing suite still
passes". Every current `dualWriteRecords` call site passes `/fake/root`, which is not a git
repo, so the whole suite would exercise the fallback *by accident* and prove only that the
accident is survivable. The fallback gets its own case with an injected
`_upstreamRecordIds: () => ({ ok: false, reason: 'no remote' })`, asserting **both** that
every candidate was written **and** that the accounting says `applied: false` with a non-empty
reason. Mutation M2b (below) is what makes the second half real.

---

## Decision 4 — the ref lookup is a seam; `dualWriteRecords` stays plain-data

`dualWriteRecords` does not shell out. It receives the resolved result as an injected seam,
following this repo's plain-data-fakes-via-`deps` style (`actor-check.test.mjs`,
`run-check.test.mjs`): a pure evaluator plus an I/O wrapper, never a function that tests must
neutralize with a real subprocess.

New module — **`brain/scripts/memory/lib/upstream-records.mjs`** — holding the I/O and nothing
else:

- `resolveUpstreamRef({ root, env, config, _spawn })` → `{ ref, stated }` (Decision 2's table)
- `upstreamRecordEntries({ root, env, config, _spawn })` → the discriminated result of
  Decision 3, `cwd: root`
- `parseLsTree(text)` → `{ byId, byPath, unnamed }` — **pure**, unit-tested on a fixture
  string, which is where the filename grammar and the month-file case are actually pinned

Threading, concretely:

| call site | change |
|---|---|
| `engram.mjs#dualWriteRecords` | new opt `_upstreamRecordIds = upstreamRecordEntries`, defaulted; consumed between the secret scan and the dedup loop |
| `engram.mjs#share` | new opt `_upstreamRecordIds`, defaulted, **threaded into its `dualWriteRecords(...)` call** — it already builds that opts object explicitly, and a seam `share` cannot pass is a seam the end-to-end test cannot reach |
| `memory/cli.mjs` | no seam change; reads the two new accounting fields and prints them (Decision 7) |
| `staged-records-check.mjs` (new) | imports `upstreamRecordEntries` directly — no engram dependency, no backend dispatch |
| existing tests (`engram.share.test.mjs`, `engram.duplicates.test.mjs`, `plainfiles-roundtrip.integration.test.mjs`) | untouched; they inherit `ok: false` and stay green |
| `plainfiles.mjs#share` | **untouched, deliberately.** It is a bare `rebuildIndex()` self-check (its own docblock, REQ-C3-4) — it materializes nothing from a live DB, so it has no scope to get wrong. The defect is engram-backend-only and this bounds the blast radius. |

**Ordering inside `dualWriteRecords`.** The lookup goes *after* the secret scan and *before*
the dedup loop, beside `_readRecordIds`. Two reasons, both load-bearing:

1. The zero-candidate early return still short-circuits above it, so a steady-state share with
   nothing to export pays for no `git` spawn at all.
2. **The secret scan keeps covering every candidate, including the ones that will be
   declined.** Narrowing the scan to what will be written is the obvious "optimization" and it
   is refused: the invariant is *nothing reaches `records/` unscanned*, and it should hold by
   construction, not by an argument that upstream records are already public. That argument is
   true and it is exactly the kind of true argument `_defaultChangedChunkFiles`'s docblock
   records having disarmed a gate with.

---

## Decision 5 — the residual, closed: the sibling leak **persists**, nothing is lost

The proposal left this as an open question. It resolves by simple evaluation of the predicate.

A record authored in sibling worktree B, present in the host-global engram DB, not yet on the
trunk. In worktree A:

- is its id in A's own `records/`? **No** (A never had it).
- is its id in the trunk's tree? **No** (not merged yet).
- ⇒ the predicate **does not see it** ⇒ **it is written**, exactly as today.

So the residual is that **the leak PERSISTS for not-yet-upstream sibling records** — it is not
that anything is declined and lost. The two possible residuals are asymmetric and this is the
harmless one. Stated as an invariant:

> The predicate can only decline records that are provably durable at the trunk. It has no
> branch that declines a record which is not.

It also self-heals: as the sibling's record lands on the trunk, it enters the id set and stops
being re-materialized. And it shrinks with the defect — the measurement found 0 of this class
among 23 writes (the single genuinely-new record was correctly placed in its own worktree).

**Bound on requirement 3 (`git merge` no longer exits 2), stated honestly.** The measured
class — 22 of 23, all trunk-present — stops being written, so those untracked collisions stop
existing. A sibling-class record written into worktree A *can* still collide when it later
lands on the trunk. Whether git's untracked-overwrite check tolerates byte-identical content
was **not measured here**, so the residual is stated as *may still block*, not *does*. The
requirement is satisfied for the measured class; the residual is named rather than absorbed.

---

## Decision 6 — the gate: same tree read, blob OIDs instead of ids, `pre-commit` only

`proposal.md` Decision 4 requires a gate, not prose. It is the **same** `ls-tree` result
(Decision 1 already carries the oids) consumed differently.

- staged side: `git diff --cached --raw -z -- .memory/records` → `<dst-oid> <status> <path>`
- refuse when `dstOid === upstream.byPath.get(path)`

**Byte-identity is compared as OID equality, so there are still zero blob reads.** Two blobs
with the same OID are the same bytes; that is what a content-addressed object store is for.

Shape follows `actor-check.mjs`: a pure `evaluateStagedRecords({ staged, upstream })` →
`{ level: 'pass' | 'fail', offending: [...] }` taking plain data, plus a thin I/O wrapper and
a CLI. The evaluator is where every case is tested; no test spawns git.

- **byte-identical → refuse.** Loud, with the paths named.
- **bytes differ (the divergent-`source` pair) → allow.** Refusing it would be a ruling about
  which side of an ADR-0017 Amendment 1 divergence wins, which the proposal explicitly did not
  take (Decision 3, filed as #461).
- **staged deletion → allow.** `dstOid` is zeros, never equal. Deleting records is a different
  concern.
- **upstream lookup `ok: false` → PASS**, plus a stderr notice. The gate never blocks on a
  question it could not ask — the same degradation direction as the exporter.

**The refusal is provably lossless, which is why it may be hard.** The gate can only fire on a
path whose staged bytes are *identical to the trunk's*, so the remedy it prints —
`git restore --staged <paths>` and, if untracked, `rm` them — cannot destroy information. That
theorem is the whole licence for exit 1.

**`pre-commit`, not `pre-push`.** `pre-push`'s `.memory/` check is WARN-only by an explicit,
recorded decision (`pre-push:114-119`, ADR-0014 §9): `memory:share` runs earlier *in the same
hook* and churns the manifest, so a hard block there self-blocks the push it runs on and
teaches `--no-verify`. Inverting that would be a doctrine change this ticket has no mandate
for. And after the exporter fix `pre-push`'s own `share` no longer produces byte-identical
records, so the pre-push case is closed by Decision 1 rather than by a second gate.

Wiring: `brain/scripts/memory/staged-records-check.mjs`, invoked from `pre-commit` between the
main/master block and `check-refs.mjs`, following `check-refs`' precedent as the repo's
established shape for a *blocking* hook check (a `cli.mjs` verb is the shape for a
*non-blocking* one). **No stream redirection at all** — nothing to discard, so
`hooks.stream-discipline.test.mjs`' rule is satisfied by construction rather than by a rule it
does not currently scan for.

**Accepted one-time friction, not hidden.** A stale worktree that already holds byte-identical
re-exports will have `brain:save` refused until they are cleaned. It is loud, mechanical,
lossless, and happens once — the same trade #677 Decision 6 took and for the same reasons.

---

## Decision 7 — what the accounting says, and why `deduped` still moves

`spec.md` pins `accounting.deduped` incrementing on an upstream decline, so `deduped` stays the
**total** of every decline. The new reason gets its own bucket, because this module's stated
honesty contract is that every observation is accounted for exactly once and *never silently
folded into a neighbouring counter*:

```
deduped          total declines (unchanged meaning: own-records ∪ in-batch ∪ upstream)
dedupedUpstream  the new reason — the number `measure-701b.mjs` reads as `re-export`
upstreamScope    { applied, ref, stated, reason, configError, entries, unnamed }
                 `ref` is `null` when nothing resolved; `reason` and `configError`
                 are `null` when there is nothing to report — never a fabricated
                 value standing in for a fact this run did not observe.
```

`cli.mjs` prints, beside the existing `unprovenanced` line:

- `applied: false` → **stderr**, naming the ref tried and the reason ("this run wrote every
  candidate — the pre-#701 behaviour").
- `applied: true && unnamed.length > 0` → **stderr**, naming the count and
  `npm run memory:split-records`.
- `dedupedUpstream > 0` → **stdout** (progress; it is the success number, not a warning).

New i18n keys in `brain/scripts/i18n/{en,es}.mjs` under the existing `memory.share.*` block.

---

## Component map and data flow

```
                    ┌─ resolveUpstreamRef ─┐   env > config > origin/HEAD > origin/main
lib/upstream-       │                      │
records.mjs   ──────┤  git ls-tree -r -z --full-tree <ref> -- .memory/records   (1 spawn)
                    │                      │
                    └─ parseLsTree (pure) ─┴─> { ok, ref, stated, byId, byPath, unnamed }
                                                     │                │
                        ids ─────────────────────────┘                └──── oids
                         │                                                    │
   engram.mjs#share ─────┤ _upstreamRecordIds                                 │
        └─ dualWriteRecords                                                   │
             read obs → exportObservation → SCAN ALL candidates for secrets    │
             → decline if id ∈ (ownIds ∪ upstreamIds ∪ batch) → append rest    │
             → rebuildIndex (unchanged) → accounting                          │
                                                                              │
   pre-commit → staged-records-check.mjs                                      │
        └─ git diff --cached --raw -z -- .memory/records ──> evaluateStagedRecords
             refuse where dstOid === byPath[path]
```

Nothing else moves. `rebuildIndex`, `readRecords`, `resolve-index`, the duplicate/divergence
reporting, `.gitattributes`, `index.jsonl`, `manifest.json` and the record schema are all
untouched.

---

## The one loss path, named

A file at the ref named `2026-08-rec-A.jsonl` whose content is record `rec-B` would put `rec-A`
in the id set although `rec-A` is not upstream — and a candidate `rec-A` would then be declined
without being durable. That is the only way this design can lose a write.

Its precondition is a filename that lies about its content. No in-tree producer can create one:
`appendRecord` is the sole chokepoint and derives the name from the record; `split-records` does
the same and verifies read-back before deleting. It requires a hand-written or renamed file at
the trunk.

It is accepted rather than guarded, and the reasons are: (a) the guard is reading every blob,
which is the O(N) cost and the second parser Decision 1 refused, for a threat no producer can
realise; (b) it is not permanent — the record is still in the host-global engram DB, so once
the bad file is corrected the next `share` writes it; (c) adding a filename↔id check to
`rebuildIndex` would be a **new read-path rejection** on consumer-owned `.memory/**`, which
`store.mjs`' read/write note forbids outright.

---

## Mutation plan

Every mutation must be verified to have LANDED before its result is read (#677 T9's rule), and
each one names **the axis it does not vary** — a green mutation over an unvaried axis proves
nothing.

| # | mutation | must go red | axis NOT varied |
|---|---|---|---|
| M1 | predicate **inverted**: write only what IS upstream | "genuinely new record is still written" + the re-export case | the *plumbing* — the ref still resolves and the set is still built, so this isolates the direction of the test |
| M2a | the `ok: false` fallback removed — unavailable treated as an **empty set** | the injected-`ok:false` fallback case: every candidate written | reporting; M2a alone would pass a suite that only asserts writes |
| M2b | fallback behaviour kept, but the accounting reports `applied: true` on `ok: false` | the fallback case's *second* assertion (`applied === false`, reason non-empty) | behaviour; this is the `evidence-reader-empty-on-failure` axis on its own |
| M3 | dedup **narrowed back** to the worktree's own `records/` (the upstream union dropped) | every upstream-decline case | everything else; this is the "did the new code do anything" control |
| M4 | the decline path also **unlinks** the local record file (a plausible "tidy the duplicate" implementation) | the reachability case: a declined record is still present and readable via `readRecords` | the decision to decline; M4 varies only what happens *after* it, which is exactly requirement 5's "we stopped writing it ≠ we lost it" |
| M5 | `parseLsTree` accepts any `*.jsonl` name and derives the id by stripping the suffix | the month-file fixture case (`2026-08.jsonl` must land in `unnamed`, not in `byId`) | the git call; the parser is pure and the fixture is a string |
| M6 | the gate compares **path presence** instead of blob OID | "gate allows genuinely new or divergent content" | the refusal path; M6 leaves byte-identical still refused, so it isolates over-refusal |
| M7 | the gate's `ok: false` branch changed to **fail** | the lookup-unavailable case (must PASS) | the byte-identical case, which stays refused either way |
| M8 | **negative control** — the whole export-scope filter reverted, then `store.duplicates.test.mjs` + `resolve-index.integration.test.mjs` run | **0 tests** | proves the duplicate/divergence suite is orthogonal to this change, so "the report still works" is a real claim and not a tautology of our own tests |

M8 is the one that discharges the proposal's "what must NOT break". If reverting the filter
turns a duplicate-reporting test red, the two concerns are entangled and the claim must be
re-earned rather than asserted.

---

## Test plan (shapes, not a task list)

- **Pure**: `parseLsTree` over fixture strings — per-record names, a month file, a nested path,
  an empty tree, garbage. This is where the filename grammar lives.
- **Pure**: `resolveUpstreamRef` with a fake `_spawn` — each of the four levels, and each level
  failing through to the next.
- **Pure**: `evaluateStagedRecords` with plain-data staged/upstream inputs — identical,
  divergent, new, deleted, empty upstream.
- **Seam-injected** `dualWriteRecords`: upstream-declines, own-records-declines, new-record
  written, `ok: false` fallback (writes + report), `unnamed > 0` partial.
- **Seam-injected** `share`: proves `_upstreamRecordIds` is actually threaded through — the
  seam `share` cannot pass is the seam the end-to-end path never uses.
- **Integration (real git, temp repo)**: seed a trunk with a record, branch, run `share`,
  assert nothing untracked appears; then `git merge` and assert the record **is readable** —
  requirement 5's other half, which no unit test can state.

---

## Out of scope, and one ticket owed

- **`post-merge` cannot fire on a conflicted merge.** Measured by controlled experiment:
  conflicted → the hook did not run; clean → it ran. `resolve-index` at `post-merge:67` is
  therefore structurally unreachable for the one case that needs it, and the hook's own comment
  (`post-merge:55-58`) already asserts the operator runs it by hand there — which is a gap, not
  a design. **A separate ticket is owed**; closing it needs a different trigger point
  (`git rerere`, a `merge` wrapper, or a doctor command), not a change to this predicate.
- **No merge rule for `index.jsonl`.** Its exclusion from the union driver is doctrine stated
  twice (`memory-format.md:238-246`, ADR-0017), attempted once as `merge=union` (PR #360) and
  rewritten out; the remedy shipped as `memory:resolve-index` (#330). Not reopened.
- The `source` round-trip widening (ADR-0017 Amendment 1; #461).
- Authorship semantics of any kind. `manifest.json`. `.gitattributes`.

---

## Doctrine and Tier 3

**No ADR-0017 amendment is required.** Nothing here touches the schema, the id, the merge
policy or the index. Scoping *which* records an export writes is not a format change, and the
records written are format-valid either way.

`brain/core/**` and `brain/project/**` are **Tier 3 — nothing is committed there by this
change.** `memory-format.md` §Layout is nonetheless silent on *who* writes records into a
worktree, and the next reader will otherwise re-derive this from six files. So a short note is
produced as a **draft for a human**:

- `openspec/changes/issue-701-memory-export-scope/brain-drafts/memory-format.note.draft.md`
- `openspec/changes/issue-701-memory-export-scope/brain-drafts/README.md` — why the note is
  wanted, which section it belongs in, and that nothing was applied.

---

## Rollback

Both call sites are additive filters over existing code paths, and the upstream lookup is
read-only. Revert the commit: the exporter returns to writing unconditionally and the gate
stops refusing. Nothing is migrated, rewritten or deleted on disk, so rollback has nothing to
undo. Partial rollback is also available without a revert: setting
`BRAIN_MEMORY_UPSTREAM_REF` to an unresolvable value disables the scope via the documented
`ok: false` path — which is a property of Decision 3 rather than a switch bolted on for it.
