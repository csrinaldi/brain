# Design — issue #361 reindex parity

## Ruling (the "Decision needed" the ticket asked for)

The ticket posed three options. Given the current source (verified, not
assumed — see `proposal.md`):

1. **`engram.pull()` reindex after `importMemory()`?** Already landed, and
   ordered differently than asked: the reindex (`pullMemory()` Step 3) runs
   BEFORE `importMemory()`, not after — deliberately, per the code comment:
   "hydration must not run on a store the merge left unindexable." This is
   stricter than the ticket's own proposal (fail-closed before hydrate, not
   after) and is adopted as-is; no change requested.
2. **`engram.share()` reindex unconditionally?** Already landed via #874
   split B — `share()` is now the `plainfiles.share()` mirror with no
   conditional at all.
3. **Declare the asymmetry acceptable and document it?** Moot — there is no
   remaining asymmetry to document as intentional.

**Ruling: retroactively ratify Option 2 for both verbs** (unconditional
reindex, matching `plainfiles`) — because that is what both independent
landings (#574, #874) already did, and re-deriving a different ruling now
would mean reopening settled, tested behavior for no benefit.

## Why no production change

`share()`'s and `pullMemory()`'s current implementations already satisfy
the spec's REQ-361-1 (see `spec.md`). Mutation testing (revert each fix
independently, confirm targeted tests go red, restore) is the evidence this
is true rather than assumed — see `apply-progress.md`'s mutation table.

## Why a dedicated `reindex-parity.test.mjs` instead of only per-backend tests

Each backend already had its own unit test proving its own unconditional
behavior. Two files that each independently assert "MY backend is
unconditional" can drift apart without either file's author noticing — the
failure mode the ticket's Acceptance section named ("the M10/#335 pattern").
A single file that calls both backends' real functions with the same
assertion shape is what actually pins parity: a future change that breaks
either backend's unconditional-reindex property fails a test that is
explicitly ABOUT parity, not just about one backend in isolation.

## Alternatives considered

- **Shared-core extraction** (one `reindexUnconditionally(root, seams)`
  helper called by both backends) — rejected. `save-parity.test.mjs`'s own
  header already documents the project's convention of pinning duplicated
  bodies via parity tests rather than extracting shared core across
  backends whose signatures differ (`plainfiles` takes `(opts, seams)`;
  `engram` takes one merged opts object). Consistent with existing pattern;
  no new extraction introduced here.
