# Apply progress — issue-939-461-provenance

## Commits (local, on `fix/issue-939-461-provenance`, base `64084f23`)

1. `d5517d14` — `fix(memory): widen the default agent-marker list beyond AI_AGENT (#939)`
   — `capture-provenance.mjs` + `capture-provenance.test.mjs`.
2. `ef7dd4cd` — `docs(sdd): open issue-939-461-provenance; tick epic 4.10, analyze 4.2 as blocked`
   — this change's artifacts + `issue-864-memory-2-0/tasks.md`.
3. (pending) record-first `memory:save` commit — see below.

## TDD Cycle Evidence (#939)

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| Widen default markers | 6 new tests added (only-`CODEX_THREAD_ID`, only-`CLAUDECODE`, none-present w/ evidence listing, `CODEX_THREAD_ID` set-but-empty, `brain.agentEnv` still overrides, `AGENT_ENV_DEFAULTS` shape) — module failed to load (`AGENT_ENV_DEFAULTS` not exported) | Added `AGENT_ENV_DEFAULTS` array + switched `resolveActorKind`'s default from `[AGENT_ENV_DEFAULT]` to it — 35/35 green | Comments explaining each marker's runtime + verification method; kept `AGENT_ENV_DEFAULT` exported for back-compat |

## Mutation table (production revert, tests re-run)

| Mutation | Command | Result |
|---|---|---|
| Revert `capture-provenance.mjs` alone (`git stash push -- <file>`), re-run `capture-provenance.test.mjs` | `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/memory/lib/capture-provenance.test.mjs` | RED — module fails to load: `AGENT_ENV_DEFAULTS` not exported (import error, whole file fails, 1/1 fail) |
| Restore (`git stash pop`), re-run | same | GREEN — 35/35 pass |

Only one production file changed for #939, so one mutation row; the failure
mode is an import error rather than a per-test assertion failure because the
test file imports `AGENT_ENV_DEFAULTS` directly — reverting the production
change removes that export, which is itself a valid (in fact stronger) proof
that the new tests depend on the new production code.

## Test counts (isolation: `GIT_CONFIG_GLOBAL=/dev/null`)

- `capture-provenance.test.mjs` alone: 35/35 pass (29 pre-existing + 6 new).
- Full suite (`npm test`): **5283/5283 pass** (baseline on `origin/main` under
  the same isolation: 5277/5277 — the 6 new tests account for the delta,
  confirmed by direct arithmetic, no other file touched by #939's fix).

## #461 — investigated, not fixed

Both the GitHub issue body and the code's own header comment
(`brain/scripts/memory/lib/provenance.mjs` — `renderProvenance()`'s
docstring, "KNOWN-AMBIGUOUS, and NOT resolved here... Tracked as a decision,
not patched here: issue #461") independently state the same finding: a
record with no `issue` whose `source` cites `issue #N` renders a Fuente line
byte-identical to a record that DOES declare `issue: N`. No change to
`renderFuente()`/`parseProvenance()` can distinguish the two shapes, because
the information that would distinguish them was never encoded on write.

Closing it requires ONE of:
1. A new §4 doctrine marker carrying `issue` structurally, separate from
   `source` — a `brain/core/**` doctrine change with a compatibility story
   for every already-shared observation. Out of scope for this apply session
   on both counts (architecture decision; core-doctrine edit).
2. A validation rule refusing the ambiguous shape — the `R4` rule PR #460
   originally carried and that the maintainer explicitly dropped on that PR.
   Re-adding it here would silently overturn a ratified decision without a
   new ruling.

No code changed for #461. Epic task 4.2 in `issue-864-memory-2-0/tasks.md`
left unchecked, with a note pointing here.

## Doctrine draft (not applied to `brain/core/**`)

`openspec/changes/issue-939-461-provenance/brain-drafts/memory-format-actorkind.md`
— proposed patch to `memory-format.md`'s "Public-repo exposure — stance"
section: replaces the stale single-marker sentence and states the #939
ruling's accepted-cost paragraph verbatim. Awaiting maintainer promotion.

## Status (batch 1, pre-review)

#939: done (2/2 code tasks + doctrine draft). #461: investigated, correctly
not implemented — blocked on a maintainer architecture decision, not on
missing effort. Nothing further to apply in this session for either ticket
beyond the record-first closing commit.

---

## Batch 2 — fresh adversarial review response (2026-09-12)

Answers F1-F6 from a fresh review of batch 1. Strict TDD throughout;
`GIT_CONFIG_GLOBAL=/dev/null` on every run.

### F1 (MEDIUM) — #461: batch 1's refusal overreached; a write-time rule exists

The review correctly found batch 1 wrong: the issue itself names a THIRD
option beyond the two batch 1 considered — `validateWritableRecord` ("added
in #460... available and safe, but it does not fix records that already
exist") — explicitly outside #460's read-path ruling. Implemented **W4** in
`brain/scripts/memory/lib/format.mjs#validateWritableRecord`: refuses a
record whose `source` cites `issue #N` while the record's own `issue` is
absent or a different number. `validateRecord`/`parseRecordLine` (READ gate)
left untouched on purpose — proved by a dedicated test that a pre-existing
record carrying the shape still parses.

**Blast radius measured over this repo's `.memory/records/`, 2026-09-12**:
2374 total records (repo grew since the issue's 2026-08-05 measurement of
2157); 2 records cite an issue in `source`; **0/2374** carry the disagreeing
W4 shape (both of the 2 already agree with their own declared `issue`) — the
corruption W4 closes was latent here, not active.

One pre-existing test fixture collided with the new rule incidentally:
`store.test.mjs`'s "an existing file with DIVERGENT bytes is never
overwritten" test fed `appendRecord` a `source: 'issue #405 / PR #405'` with
no declared `issue` (used only to prove `source` is hash-excluded). Fixed by
declaring `issue: 405` on the base record — the test's actual assertions
(same id, first-wins, `source` unhashed) are unaffected.

Ticked epic 4.2 in `issue-864-memory-2-0/tasks.md`, and corrected
`proposal.md`/`spec.md` in this change: they now say what was delivered
(write-time closure via W4) versus what genuinely remains (pre-existing
records already carrying the shape — still blocked on the same architecture
decision, new §4 marker vs. overturning #460's read-path ruling).

### F2 (MEDIUM) — surviving mutation: REPLACE vs APPEND semantics untested

`resolveActorKind`'s override branch REPLACES `AGENT_ENV_DEFAULTS`; no
existing test would catch a mutation to APPEND (the prior override test puts
the configured name first, so it wins either way). Added
`capture-provenance.test.mjs`: a configured name absent + a DEFAULT marker
present must still yield `human`. Mutation-tested: mutated `names` to
`[...configured, ...AGENT_ENV_DEFAULTS]`, confirmed the new test alone went
RED (35/36 pass, 1 fail); reverted, confirmed 36/36 GREEN.

### F3 (LOW) — aliasing hazard

`capture-provenance.mjs`'s default branch returned `AGENT_ENV_DEFAULTS` by
reference. Changed to `[...AGENT_ENV_DEFAULTS]` (fixed in the same edit that
reverted F2's mutation) so no future in-place mutation of `names` can
corrupt the exported constant process-wide.

### F4 (LOW) — accepted cost now lives in code, not just the draft

Added one sentence to `AGENT_ENV_DEFAULTS`'s docblock: a human typing inside
a terminal exporting one of these markers is recorded `actorKind: agent`,
because the list cannot distinguish a human's keystrokes from the agent
runtime hosting them.

### F5 (LOW) — draft's quoted passage now verbatim, line ref corrected

`brain-drafts/memory-format-actorkind.md`'s "Current text" blockquote was
re-wrapped and occurred zero times verbatim in `memory-format.md`. Rebuilt
it programmatically from the actual file bytes (lines 280-283, including the
list-continuation 2-space indent) and verified with a script that it now
`.includes()` the target verbatim. Corrected the line reference from
"282-283" to "280-283" (the sentence starts mid-line-280). Left the fence-free
prose-only shape as-is — matches 59/101 tracked drafts, no `brain-amendment`
fence needed.

### F6 (LOW) — blank sibling marker on the agent path; epic 4.10 note

`{AI_AGENT:'', CODEX_THREAD_ID:'t'}` drops the blank `AI_AGENT` from
evidence once `CODEX_THREAD_ID` decisively wins. **Decision: documented,
not changed.** Added a comment explaining why the agent path drops
`emptyNames` (the #888 set-but-blank discipline exists for the HUMAN path,
where "checked but blank" is the only fact available; the agent path already
has a stronger fact — a live marker — so a blank sibling adds nothing) and
pinned it with a test asserting the evidence names only the winning marker.

Epic 4.10 in `issue-864-memory-2-0/tasks.md`: verified it already carries
the honest form — ticked, WITH a note naming the doctrine draft as pending
promotion (`**Doctrine statement of the accepted cost is a DRAFT pending
promotion**`). No change needed; this was already the correct choice from
batch 1, re-confirmed.

### TDD Cycle Evidence (batch 2)

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| F1 — W4 rule | 5 new `format.test.mjs` tests added first (2 rejects, 1 agrees, 1 no-citation, 1 read-gate-unchanged) — 2/57 failed (the 2 "rejects" cases) | Added `ISSUE_CITED_IN_SOURCE_RE` + W4 check to `validateWritableRecord` — 57/57 green | Docblock header (W1-W3 list) extended with W4; fixed one incidental `store.test.mjs` fixture collision |
| F2/F3 — replacement semantics + aliasing | New test added, passed immediately (behavior was already correct) — proof came from mutation, not from initial RED | N/A (no missing behavior) | `[...AGENT_ENV_DEFAULTS]` copy fixes F3 in the same line that would have fixed an APPEND mutation |
| F6 — blank sibling | Pinning test added, passed immediately (behavior unchanged, decision = document) | N/A | Comment added above the `return` explaining the asymmetry with the human path |

### Mutation table (production revert / mutate, tests re-run)

| Mutation | Command | Result |
|---|---|---|
| F1: `git stash push -- format.mjs` (remove W4), re-run `format.test.mjs` | `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/memory/lib/format.test.mjs` | RED — 55/57 pass, 2 fail (the 2 new "W4 rejects" tests) |
| F1: `git stash pop` (restore W4), re-run | same | GREEN — 57/57 pass |
| F2: mutate `names` to `[...configured, ...AGENT_ENV_DEFAULTS]` (append), re-run `capture-provenance.test.mjs` | `GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/memory/lib/capture-provenance.test.mjs` | RED — 35/36 pass, 1 fail (the new REPLACE-semantics test) |
| F2: revert to `[...AGENT_ENV_DEFAULTS]` (replace + F3's copy), re-run | same | GREEN — 36/36 pass |

### Test counts (isolation: `GIT_CONFIG_GLOBAL=/dev/null`)

- `format.test.mjs` alone: 57/57 pass (52 pre-existing + 5 new, F1).
- `capture-provenance.test.mjs` alone: 37/37 pass (34 pre-existing + 1 F2 +
  1 F6).
- Full suite (`npm test`): **5290/5290 pass** (baseline this branch:
  5283/5283 — the delta is exactly the 7 new tests above; no other file's
  test count changed).

## Status (batch 2)

F1 (#461): write-time closure shipped (W4); read-path and existing-record
correction genuinely remain, blocked on the same architecture decision as
before — now stated accurately in `proposal.md`/`spec.md`/epic 4.2. F2, F3,
F4, F6: all landed (behavior pinned, aliasing fixed, doctrine documented in
code, blank-sibling decision documented and pinned). F5: draft corrected.
Nothing further to apply in this batch.
