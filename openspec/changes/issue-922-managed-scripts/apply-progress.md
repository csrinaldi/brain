# Apply Progress: issue-922-managed-scripts

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| Drift test (`managed-script-keys-doctrine.test.mjs`) | Written first; ran, confirmed failing with the 22 mechanically-detected missing keys, matching the manual measurement | N/A — **expected to stay RED**. Green requires editing `brain/core/managed-paths.mjs`, which is Tier 2 and cannot be edited from this branch (see Decision below) | Added a second, GREEN sanity test (every managed key names a real script) so the file isn't a single always-red assertion |

This task is **intentionally not GREEN**. See "Decision: expected-red test" below — this is not a gap in the TDD cycle, it is the deliverable.

## Tasks (see tasks.md for full list)

All tasks in `tasks.md` are checked `[x]` — the code-and-measurement half of
this change is complete. The one task genuinely outside this PR's power
(promoting the draft into `brain/core/managed-paths.mjs`) is not a task here;
it is the maintainer's follow-up, named in the draft and in epic task 4.8.

## Three measured sets

- **Recommended-and-managed (10)**: all of today's `MANAGED_SCRIPT_KEYS`.
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
- **Managed-but-NOT-recommended — possibly stale (0)**: none. The current 10
  are all doctrine-justified.

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
promoted (confirmed by running it). `npm test` on this branch reports one new
failing test, by design, not a regression.

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
module: the current 12-line `MANAGED_SCRIPT_KEYS` block occurs exactly once
(284 bytes) in `brain/core/managed-paths.mjs`.

## Epic task 4.8 (issue-864-memory-2-0)

Left **unticked**, with a note pointing at this change and naming the
pending draft. Honest split: the measurement, the drift test, and the draft
are done; the actual catalog edit is not (Tier 2, requires human promotion).
Ticking it now would overstate completion.

## Test results

- Focused: `GIT_CONFIG_GLOBAL=/dev/null node --test
  brain/scripts/lib/managed-script-keys-doctrine.test.mjs` → 1 pass (sanity),
  1 fail (drift guard, expected).
- Full suite: `GIT_CONFIG_GLOBAL=/dev/null npm test` → 5313 tests (baseline
  5311 + 2 new), 5312 pass, 1 fail — the drift guard, by design. No other
  regressions vs. the `origin/main` @ `b4a629cb` baseline.

## Commits (local only, not pushed)

1. `a352e7e3` — `test(installer): a data-driven drift guard catches doctrine
   npm-run scripts MANAGED_SCRIPT_KEYS omits (#922)` — test file, spec.md,
   proposal.md, tasks.md, brain-draft, epic task 4.8 note.
2. `b731a900` — `docs(memory): record the issue #922 measurement and
   drift-test decision (rec-2778aaa612d21996)` — record-first memory commit
   (`.memory/records/2026-09-rec-2778aaa612d21996.jsonl` +
   `.memory/index.jsonl`, one net new id).

## Not done / cannot do from this branch

- Promoting the draft into `brain/core/managed-paths.mjs` (Tier 2 — human
  gate).
- Updating `managed-paths.test.mjs`'s `length === 10` / `startsWith('brain:')`
  assertion — correctly true against TODAY's catalog; changing it now would
  make `npm test` fail against the current, un-promoted state. Left for the
  human promoting the draft, noted in the draft file.
- No push, no PR, no `gh` write, no `brain:promote` — per hard constraints.
