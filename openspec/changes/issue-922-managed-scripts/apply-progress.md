# Apply Progress: issue-922-managed-scripts

## Outcome (current state, as of `c740bc1c`)

This branch was originally written in a pre-promotion state: the drift test
below was authored EXPECTED RED because `MANAGED_SCRIPT_KEYS` had 10 keys and
the catalog edit itself was a draft, blocked on human promotion (Tier 2).
Since then:

- Issue #961 review round 2 decided to rename the memory scripts first
  (`memory:*` → `brain:memory:*`, bare names kept as repo-only aliases): PR
  #966 (`dc4b56e1`) renamed the scripts in `package.json`; PR #972
  (`62f6bdd3`) updated the doctrine/ADR prose to match.
- This branch merged `origin/main` (bringing in #966/#972), then the
  maintainer applied the catalog promotion by hand in commit `525f7c0a`:
  `MANAGED_SCRIPT_KEYS` now carries **34 keys, all `brain:`-namespaced**,
  with the memory verbs as `brain:memory:*` per #961 R2.
- Commit `2ae18386` replaced `managed-paths.test.mjs`'s `length === 10` /
  `startsWith('brain:')` assertion with two invariants (unique keys, every
  key matches `^brain:[a-z]`) and retired the drift test's "EXPECTED RED"
  header — it now documents the catalog going green in PR #954 instead.
- The drift test (`managed-script-keys-doctrine.test.mjs`) and the sanity
  companion test are both GREEN today (verified: `node --test
  brain/scripts/lib/managed-script-keys-doctrine.test.mjs
  brain/scripts/lib/managed-paths.test.mjs` → 34/34 pass). There is no
  outstanding RED test on this branch.
- Epic task 4.8 (`openspec/changes/issue-864-memory-2-0/tasks.md`) is ticked
  `[x]`, with an audit note citing this sequence.

The sections below describe the branch's ORIGINAL state and the decisions
made at that time. They are historical; read them alongside this Outcome
note, not as the current state of the code.

## TDD Cycle Evidence (as originally written on this branch)

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| Drift test (`managed-script-keys-doctrine.test.mjs`) | Written first; ran, confirmed failing with the 22 mechanically-detected missing keys, matching the manual measurement | N/A at the time — **expected to stay RED** until a maintainer edited `brain/core/managed-paths.mjs` (Tier 2, could not be edited from this branch — see Decision below). **Superseded**: the catalog was promoted in `525f7c0a`; the test is GREEN as of `c740bc1c`. | Added a second, GREEN sanity test (every managed key names a real script) so the file isn't a single always-red assertion |

This task was **originally not GREEN by design**. See "Decision: expected-red
test" below for the reasoning at the time. It went green once the catalog was
promoted (`525f7c0a`) — see Outcome above.

## Tasks (see tasks.md for full list)

All tasks in `tasks.md` are checked `[x]`. When this section was first
written, the catalog promotion into `brain/core/managed-paths.mjs` was
outside this PR's power (Tier 2, maintainer follow-up) and not tracked as a
task here. That promotion has since happened — see Outcome above — so the
"maintainer's follow-up" this paragraph refers to is DONE, not pending.

## Three measured sets (original measurement, against the 10-key catalog)

- **Recommended-and-managed (10)**: all of `MANAGED_SCRIPT_KEYS` as it stood
  at measurement time. (The catalog is 34 keys today — see Outcome above.)
- **Recommended-but-NOT-managed — the defect (24)**: 22 mechanically detected
  via literal `npm run <script>` mentions (`brain:adopt`, `brain:audit`,
  `brain:change:archive`, `brain:check`, `brain:governance-status`,
  `brain:metrics`, `brain:nav`, `brain:next`, `brain:promote`, `brain:protect`,
  `brain:review`, `brain:review:board`, `brain:save`, `brain:ship`,
  `brain:start`, `brain:upgrade`, `memory:audit`, `memory:index`,
  `memory:pull`, `memory:resolve-index`, `memory:save`, `memory:share`) + 2
  manually confirmed (`memory:ship`, `brain:config` — referenced by verb name
  in ADR prose, not a literal `npm run` mention, so the mechanical test's
  blind spot is documented rather than silently accepted). All 4 of the
  ticket's named minimum are in this set.
- **Managed-but-NOT-recommended — possibly stale (0)**: none. The 10 keys
  measured at the time were all doctrine-justified.

Full detail and citations: `proposal.md`.

## Decision: expected-red test, not weakened

Per the task brief's own framing, considered making the test conditional on
"has the draft been applied" instead of a straight doctrine-vs-catalog
comparison. Rejected: detecting "applied" would just re-implement the same
assertion (e.g. checking array length) with an extra layer of indirection —
no real gain, more surface to get wrong. Chosen instead: keep the direct
assertion, accept it as EXPECTED RED until promotion. This is not a novel
pattern in this repo — `brain/scripts/lib/
sdd-layout-doc-promotion-tripwire.test.mjs` (#253) is an existing,
already-merged test of exactly this shape ("THIS TEST IS EXPECTED RED ON
THIS BRANCH, BY DESIGN"), now green on `main` because its target doc was
promoted (confirmed by running it).

**Outcome**: `npm test` reported one new failing test (the drift guard) by
design at the time this decision was written — not a regression. The catalog
was promoted in `525f7c0a`, and the drift test has been green since; there is
no failing test on this branch today.

## Correction to the task brief (verified, not assumed)

The task brief assumed the production fix ships as a
` ```brain-amendment/1 ` fenced block. **Verified false by simulation**,
importing the real `parseAmendmentDraft` from
`brain/scripts/lib/amendment-draft.mjs`:

```
target 'brain/core/managed-paths.mjs' is not a brain/** Markdown path.
  This verb amends signed artefacts under brain/ and nothing else.
```

`amendment-draft.mjs:116` hard-refuses any target not ending in `.md`. There
is no `brain:promote`-automated contract for an arbitrary `.mjs` file today
(`brain-migration/1` is the nearest sibling, and it is narrower still — JSON
only, hardcoded to `config-migrations.mjs`). The draft instead follows the
generic Tier-2 path (`consolidation-protocol.md` §2): a plain proposed-diff
file for a human to review and move by hand. See
`brain-drafts/managed-script-keys.draft.md` for the full explanation and the
proposed 34-entry array.

Anchor uniqueness (the spirit of "verify by simulation with the real
`assessEdit`") WAS confirmed, using the real `countOccurrences` from the same
module: at the time, the 12-line (10-key) `MANAGED_SCRIPT_KEYS` block occurred
exactly once (284 bytes) in `brain/core/managed-paths.mjs`. That block is now
34 lines/keys since the promotion in `525f7c0a` — the byte count above is a
historical measurement, not the shape of the block today.

## Epic task 4.8 (issue-864-memory-2-0)

Originally left **unticked**, with a note pointing at this change and naming
the pending draft — an honest split at the time: the measurement, the drift
test, and the draft were done; the actual catalog edit was not (Tier 2,
required human promotion). Ticking it then would have overstated completion.

**Outcome**: the catalog edit landed in `525f7c0a`. Epic task 4.8 is now
ticked `[x]` (commit `79d24ba4`), with an audit note in
`openspec/changes/issue-864-memory-2-0/tasks.md` citing PR #954 and the
34-key `brain:`-only catalog.

## Test results (original run, pre-promotion)

- Focused: `GIT_CONFIG_GLOBAL=/dev/null node --test
  brain/scripts/lib/managed-script-keys-doctrine.test.mjs` → 1 pass (sanity),
  1 fail (drift guard, expected at the time).
- Full suite: `GIT_CONFIG_GLOBAL=/dev/null npm test` → 5313 tests (baseline
  5311 + 2 new), 5312 pass, 1 fail — the drift guard, by design at the time.
  No other regressions vs. the `origin/main` @ `b4a629cb` baseline.

**Outcome**: the full suite passed 5361/5361 before commit `79d24ba4` (per
that commit's own record). Re-running the two catalog-related test files
today (`managed-script-keys-doctrine.test.mjs` +
`managed-paths.test.mjs`) at `c740bc1c` passes 34/34 — no failing test
remains from this change.

## Commits (original two; the branch has since been pushed and gained more — see Outcome above)

1. `a352e7e3` — `test(installer): a data-driven drift guard catches doctrine
   npm-run scripts MANAGED_SCRIPT_KEYS omits (#922)` — test file, spec.md,
   proposal.md, tasks.md, brain-draft, epic task 4.8 note.
2. `b731a900` — `docs(memory): record the issue #922 measurement and
   drift-test decision (rec-2778aaa612d21996)` — record-first memory commit
   (`.memory/records/2026-09-rec-2778aaa612d21996.jsonl` +
   `.memory/index.jsonl`, one net new id).

## Not done at the time / done since (see Outcome above)

- Promoting the draft into `brain/core/managed-paths.mjs` (Tier 2 — human
  gate) was not yet done when this section was written. **Done**: commit
  `525f7c0a`, 34 `brain:`-namespaced keys.
- Updating `managed-paths.test.mjs`'s `length === 10` /
  `startsWith('brain:')` assertion was left for the human promoting the
  draft, noted in the draft file. **Done**: commit `2ae18386` replaced it
  with invariants (unique keys, `^brain:[a-z]` pattern).

## Still true

- No push, no PR, no `gh` write, no `brain:promote` from THIS agent — per
  hard constraints. (The maintainer's own follow-up commits on this branch,
  listed in Outcome above, are separate from this constraint.)
