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

## Status

#939: done (2/2 code tasks + doctrine draft). #461: investigated, correctly
not implemented — blocked on a maintainer architecture decision, not on
missing effort. Nothing further to apply in this session for either ticket
beyond the record-first closing commit.
