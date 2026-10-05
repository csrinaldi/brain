# Proposal — #1115 (folds #1189): one backend-owned lifecycle verb, `hydrate`, for every memory entrypoint

## Problem

The entrypoints that load memory choose engram's operations themselves instead of calling the
configured backend (`memory-backend-contract.md`, ADR-0024's axis rule):

- `brain/scripts/session-start.mjs:89` allowlists `['import', 'feature-resume']`, and
  `step2HydrateEngram()` (`:286-305`) spawns `memory/cli.mjs import`. `plainfiles` has no
  `importMemory`, so the dispatcher refuses (`brain/scripts/memory/cli.mjs:1047-1050`) and the
  banner reads `memory: engram unavailable (skipped) — memory/cli: backend 'plainfiles' does not
  implement op 'import'`. The wrong backend is named and **no memory context reaches the agent**
  (#1081 evidence `76`; #1185 evidence `brain-test-plainfiles-42`).
- `brain/scripts/day-start.mjs:347-372` probes `engram --version`, runs `cli.mjs import` (4a),
  `brain-to-engram.mjs` (4b), and `engram sync --export` (4c). Step 4c copies the backend into
  `.memory/`, which reverses record-first (contract rule 2; `share` "exports nothing from the
  backend") and its own text promises a commit "with the next push", which ADR-0034 retired.
- `brain/scripts/hooks/post-merge:53` runs `cli.mjs import` after every merge or pull. On
  `plainfiles` it prints the same refusal on every `git pull`, including the one inside
  `brain:memory:pull` (#1189; evidence `brain-test-plainfiles-22`, `-43`).

The contract already names the operation: `hydrate({root, recordId?})` is a required verb
(`memory-backend-contract.md:65`). Only the single-record form exists, on engram
(`engram.mjs:826`, which throws `recordNotFound` without an id). The bulk form "is still spelled
`pull` and `cli.mjs import`". #1115 is mostly wiring the verb the contract already requires.

## Maintainer rulings (ratified 2026-10-05, binding)

1. **The verb is `hydrate`** (the contract's own name). The bulk form is `hydrate({root})` with no
   `recordId`. On engram it runs `importMemory` and returns the normalized shape. When the engram
   binary is absent it DEFERS and never throws. On plainfiles it runs `rebuildIndex`.
2. **`session-start`, `day-start` and the `post-merge` hook call ONLY `hydrate`.** `import` stays
   as a DEPRECATED ALIAS for one release, because installed consumer post-merge hooks still call
   it. The alias prints a deprecation notice that names `hydrate`. Nothing is added to
   `FALLBACK_OPS`.
3. **Remove day-start step 4c** (`engram sync --export`, which reverses record-first). Leave 4b
   (the brain-to-engram doctrine projection) as is. Routing 4b through `index` is a separate
   follow-up issue.
4. **session-start strings stop saying "engram"** and name the active backend.
5. **Plainfiles context, minimal, NO contract change.** session-start reads the records and shows
   the record count, the newest record, and the records scoped to the active change's issue. A
   context payload returned by `hydrate` would widen the contract, so it is a follow-up and not
   part of this change.
6. **Doctrine goes through drafts the maintainer promotes:** Amendment 3 to
   `brain/core/methodology/memory-backend-contract.md` (bulk `hydrate` implemented, `import` a
   deprecated alias), an amendment to ADR-0004 (its "today `pull` / `cli.mjs import`" wording),
   and wording touch-ups in `harness-contract.md`, `consolidation-protocol.md` and
   `agent-authorities.md` wherever they say `cli.mjs import`.
7. **One PR** with the code and the drafts.

## Scope

- `hydrate` bulk form on both adapters: `brain/scripts/axes/memory/adapters/engram.mjs`
  (bulk branch over `importMemory`, deferring) and `plainfiles.mjs` (new export over `rebuildIndex`).
- Dispatcher `brain/scripts/memory/cli.mjs` gets a `hydrate` op, the `import` alias with its
  deprecation notice, and a distinct exit status for a deferred hydration, so callers can tell
  "deferred" from "done".
- Callers: `session-start.mjs` (allowlist, step, strings, records context), `day-start.mjs` (4a
  runs `hydrate` for every backend, 4c is removed, 4b is unchanged), `hooks/post-merge`.
- i18n `en`/`es` for every new or changed string. Retired keys are removed.
- `brain/scripts/axes/axis-port.allowlist.mjs`: the `day-start.mjs spawn-concrete:engram` entry
  shrinks from 2 to 1. Only the 4b probe is left.
- Code-side docs: `docs/KNOWN-LIMITATIONS.md` drops the #1115 and #1189 entries.
  `docs/adoption.md:193` lists `hydrate` and calls `import` deprecated.
- Spec deltas to `openspec/specs/session-start/spec.md` (REQ-2, REQ-4, REQ-7, REQ-9, plus a new
  REQ-10) and to `openspec/specs/memory-backend/spec.md` (new REQ-MB-6..9). They are applied at
  archive.
- Six doctrine drafts in `brain-drafts/`: the contract, ADR-0004, `harness-contract.md`,
  `consolidation-protocol.md`, `agent-authorities.md` and `memory-format.md`. The last one is the
  same wording class, found at `memory-format.md:340`.

## #1189's third caller, verified

#1189 says `brain:memory:pull` calls `import`. The code says otherwise. `package.json:84` runs
`cli.mjs pull`, `plainfiles.pull` is `git pull` + `rebuildIndex`
(`plainfiles.mjs:410-415`), and `engram.pull` calls `importMemory` in-process. The refusal it
observed is real, but it comes from the `post-merge` hook that the `git pull` inside
`brain:memory:pull` fires. In #1185 evidence `brain-test-plainfiles-43-capturing-pull.txt:9-18`,
the refusal line follows the fast-forward and comes before the pull's own verification lines. In
`-42` there is no hook-installed checkout and no refusal. Fixing the hook fixes the third caller.
The spec records the verified and unverified parts (REQ-1115-11).

## Non-goals

- A context payload returned by `hydrate` (a contract widening). Follow-up.
- Routing day-start 4b (`brain-to-engram.mjs`) through the `index` verb, and the two
  `brain-to-engram.mjs` allowlist entries owned by #1115. Follow-up.
- Removing the `import` alias. It goes in the next release.
- Adding anything to `FALLBACK_OPS`. Changing `pull`, `share`, `setup` or `save`.
- Wiring `step5SynthesizeContext` (#923, #267).
- `featureResume` on plainfiles (`unsupportedOp`), which is untouched.
- The other #1115-owned allowlist entries (`memory/cli.mjs` heal, `memory/lib/audit-io.mjs`).
  They are a different leak class (heal/audit), and #1115 does not close them. Their `owner`
  re-points to a follow-up (see tasks).

## Follow-ups to file (before the PR is merged, so the allowlist owners point at open issues)

1. **day-start 4b → `cli.mjs index`.** Retire the `engram --version` probe and the
   `brain-to-engram.mjs` spawn from day-start, and take over the `day-start.mjs
   spawn-concrete:engram` allowlist entry (max 1 after this change).
2. **`hydrate` returns a context payload** (contract widening, ADR-level). session-start would then
   render the backend's own context instead of reading records itself.
3. **Remove the `import` alias** in the release after the one that ships `hydrate`. That covers
   `VALID_OPS`, the alias block, the i18n deprecation key and `ROOTED_OPS`.
4. **Owner for the residual #1115 allowlist entries** (`memory/cli.mjs` adapter-import and
   axis-branch for heal, `memory/lib/audit-io.mjs` adapter-import and axis-branch, and the two
   `brain-to-engram.mjs` entries). #1115 closes, so each entry needs a live issue.

## Change-dir completeness

`proposal.md`, `spec.md`, `design.md`, `tasks.md` (flat, `sdd-layout.md`), `explore.md` (read-only
exploration), `brain-drafts/` (six `brain-amendment/1` drafts and a README with the promotion
order).
