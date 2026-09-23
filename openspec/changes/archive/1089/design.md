# Design: Antigravity `init()` Reports What It Could Not Read

## Technical Approach

`init()` (`antigravity.mjs:217-251`) already has both facts it needs — the
per-doc read loop (`:228-235`) and the `writeAgents` try/catch (`:239-243`) —
it just never carries them past its own `console.warn`. Add local
accumulators inside `init()` and return them. `brain-upgrade.mjs:672-687`
captures that return value (currently discarded) and picks its message from
it instead of printing one line unconditionally. No new module, no new
callback shape — purely widening an existing return value from `undefined`
to an object, which is how `harness/cli.mjs:246-256` already documents this
seam should evolve ("today nothing answers... the day a command-line op
starts answering").

## Architecture Decisions

### Decision: Additive report object, not `{ ok: false }`

**Choice**: `init()` returns `{ missingDocs: string[], agentsWritten: boolean,
geminiWritten: boolean }`. No `ok` field.
**Alternatives considered**: Returning `{ ok: false, reason }` on a missing
doc or write failure, activating `harness/cli.mjs:266-269`'s existing
(currently dead, per its own comment at `:247-249`) failure branch.
**Rationale**: `harness/cli.mjs` exits 1 on `ok === false`, and that same
`init()` is dispatched from `bootstrap.sh`'s `env:init`/day-start self-heal
path. A missing `brain/HOME.md` is exactly the scenario #1089 was filed
about — it must stay a soft, actionable degradation for those callers, not a
new hard failure. Only the ONE caller that makes a claim about the outcome
(`brain-upgrade.mjs`) needs to change its wording; the fix belongs there, not
in a new exit-code contract for every caller.

### Decision: Track `agentsWritten`, not just `missingDocs`

**Choice**: Also report whether `writeAgents` succeeded.
**Alternatives considered**: Report only `missingDocs`, since that is the
literal defect measured in #1089.
**Rationale**: Read `antigravity.mjs:239-243` next to `brain-upgrade.mjs:672-
687`: `init()` never throws, so the caller's `catch` block is unreachable
dead code for a `writeAgents` failure — the exact same
swallow-then-claim-success shape, one line down. Fixing only the read side
would leave a second, easier-to-hit instance (e.g. a permissions error)
still printing "Regenerated ... from YOUR brain/HOME.md" after a failed
write. The anti-pattern this change follows
(`brain/core/anti-patterns/evidence-reader-empty-on-failure.md`) is about
distinguishing "uncomputable" from "fine" for ANY consumer of the evidence,
not only the one instance that was measured.

### Decision: `.gemini/settings.json` gets the same report field, but `brain-upgrade.mjs` ignores it

**Choice**: `geminiWritten` is returned for symmetry (a future CLI-dispatch
caller that uses the default writer can use it), but `brain-upgrade.mjs`
never branches on it.
**Alternatives considered**: Omit `geminiWritten` entirely (narrower diff).
**Rationale**: `brain-upgrade.mjs` passes `_writeGeminiSettings: () => {}`
(`:679`) specifically to neutralize that seam so it never rewrites the
`.gemini` merge just performed — the no-op can never throw, so
`geminiWritten` is always `true` for this caller and there is nothing to
branch on. Symmetry costs one field; a caller-specific omission would leave
the shape inconsistent for the CLI-dispatch path, which DOES use the real
writer.

### Decision: Export `REGENERATE_HINT`

**Choice**: Add `export` to the existing `const REGENERATE_HINT` in
`antigravity.mjs:63` and import it in `brain-upgrade.mjs`.
**Alternatives considered**: Re-type the command string in
`brain-upgrade.mjs`'s new message.
**Rationale**: The string already exists once, inside the compiled `AGENTS.md`
banner (`:170-173`). A second hand-typed copy in `brain-upgrade.mjs` is
exactly the kind of drift `brain/core/methodology/` docs warn about — one
value, two authors, no test that would catch a mismatch.

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `brain/scripts/harness/backends/antigravity.mjs` | Modify | `init()` accumulates and returns `{ missingDocs, agentsWritten, geminiWritten }`; `REGENERATE_HINT` exported |
| `brain/scripts/brain-upgrade.mjs` | Modify | Capture `init()`'s return; branch the post-regen message on it; import `REGENERATE_HINT` |
| `brain/scripts/harness/backends/antigravity.test.mjs` | Modify | Extend 2.1/2.3/2.4 assertions; add cases for `missingDocs`/`agentsWritten` |
| `brain/scripts/brain-upgrade.test.mjs` | Modify | Add missing-`HOME.md` and write-failure wording cases; assert byte-identical happy path |

## Interfaces / Contracts

```js
// antigravity.mjs — init()'s new resolved value
type InitReport = {
  missingDocs: string[];   // SOURCE_DOCS paths that could not be read, in order
  agentsWritten: boolean;  // false only if writeAgents threw
  geminiWritten: boolean;  // false only if writeGeminiSettings threw
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | `init()`'s return shape under read/write failure combinations | `antigravity.test.mjs`, inject `_readDoc`/`_writeAgents` seams (existing pattern, tests 2.1/2.3) |
| Unit | `brain-upgrade.mjs` wording per scenario | `brain-upgrade.test.mjs`, `runBrainUpgrade()` against `makeUpgradableConsumer()` variants (with/without `brain/HOME.md`) |
| Regression | Byte-identical happy-path wording | Existing test at `brain-upgrade.test.mjs:217-232`, extended with an exact-string assertion |

## Migration / Rollout

No migration required. Pure behavior/wording change, backward-compatible
return value.

## Open Questions

None — the CLI-dispatch exit-code question is resolved above (Decision 1); no
question blocks implementation.
