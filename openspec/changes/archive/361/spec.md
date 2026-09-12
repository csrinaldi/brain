# Spec — issue #361 reindex parity

## Delta requirement

REQ-361-1: `share()` and the `pull` path (`pullMemory()` on `engram`,
`pull()` on `plainfiles`) MUST rebuild `.memory/index.jsonl`
**unconditionally** — never gated on "did anything change" (no record
appended, no-op `git pull`) — on every backend that implements the verb.

This requirement was already satisfied by production code before this
change (see `proposal.md`, "Ticket framing vs. current code"). This spec
formalizes what was previously implicit so a future regression on either
verb, on either backend, is caught by a named requirement with dedicated
coverage rather than rediscovered as a fresh ticket.

## Scenarios

1. **share() with nothing to append** — `share()` still calls its reindex
   step and returns `{indexCount, duplicates}` reflecting the current
   `.memory/records/` state, on both `plainfiles` and `engram`.
   Covered by: `engram.share.test.mjs`, `plainfiles.share.test.mjs`,
   `reindex-parity.test.mjs`.
2. **pull path with a no-op `git pull`** — the reindex step still runs,
   between the git pull and any hydrate/import step, on both backends.
   Covered by: `plainfiles.pull.test.mjs`, `engram.pull.test.mjs` (new
   tests f/g), `reindex-parity.test.mjs`.
3. **Cross-backend shape parity** — both backends derive
   `recordsDir`/`indexPath` from `root` the same way, for both verbs.
   Covered by: `reindex-parity.test.mjs`.

## Non-requirements

- Does not require `engram.pull()`/`engram.setup()` to honor an injected
  `{root}` — that is a separate, already-documented bound (see
  `proposal.md` Non-goals).
- Does not require retiring `dualWriteRecords()` or closing rule 3 (epic
  tasks 2.3/2.4).
