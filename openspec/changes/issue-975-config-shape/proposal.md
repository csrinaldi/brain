# Issue #975 — the strict config loader accepts JSON that is not an object, so DENY readers fail open again

## Status
Applied (see `apply-progress.md`).

## Intent

`loadBrainConfigOrThrow` (`brain/scripts/lib/brain-config.mjs:77-91`) already
distinguishes ABSENCE (`ENOENT` → `{}`) from UNREADABILITY/UNPARSEABILITY
(any other read failure, or a `JSON.parse` failure → throws) — issue #942's
fix. It never checked that the parsed value is a plain object, though: a
`brain.config.json` holding JSON that parses but is not an object (`null`,
`[]`, `42`, `"x"`) was returned as-is, `@returns {object}` JSDoc
notwithstanding. Every caller reads through optional chaining
(`config?.governance?.reviewActors`), so a non-object value degraded exactly
like `{}` — the #942 class (a DENY/exclusion reader failing open) reached
through a shape gap instead of a read/parse failure.

## Scope

- Add a shape check to `loadBrainConfigOrThrow`: after `JSON.parse` succeeds,
  throw a named error when the result is not a plain object (`null`, an
  array, and any primitive are all rejected), naming the path and the JSON
  type found. `ENOENT` still returns `{}`; a valid object is still returned
  unchanged.
- Classify `loadBrainConfig()` (the legacy export) for the same gap —
  decided NOT to change it; see "`loadBrainConfig()` classification" below.
- Prove at least two DENY-direction callers — `brain-audit.mjs` (the release
  gate) and `approve/cli.mjs` — fail closed on a non-object config, driving
  the real production entry point in a fixture, not the loader alone.
- List every `loadBrainConfigOrThrow` call site with its key and direction,
  so the fix's transitive protection is explicit, not assumed.

Out of scope: `brain/core/**` and `brain/project/**` are never edited
directly (hard constraint). A Tier 2 doctrine follow-up is drafted only,
never promoted — see "Doctrine draft" below.

## Acceptance criteria (copied from issue #975)

- With `brain.config.json` containing `null`, `[]`, `42` and `"x"`,
  `loadBrainConfigOrThrow` throws, naming the path and the type. A test
  covers each through a temp fixture, never the real clone.
- A DENY-direction caller, at least `brain-audit.mjs` and `approve/cli.mjs`,
  fails closed on a non-object config. Reverting only the shape check turns
  exactly those tests red.
- An absent config and a valid object config behave exactly as today.

## The fix

`loadBrainConfigOrThrow` (`brain/scripts/lib/brain-config.mjs:136-155` post-fix;
the shape helpers `isPlainObject`/`describeJsonType` live at `:77-91`) gains a
shape check after `JSON.parse` succeeds:

```js
if (!isPlainObject(parsed)) {
  throw new Error(`brain.config.json at ${path} must contain a JSON object, got ${describeJsonType(parsed)}`);
}
```

`isPlainObject` excludes `null` and arrays explicitly (`typeof null ===
'object'` and `typeof [] === 'object'` both pass a bare `typeof` check).
`describeJsonType` names the four rejected shapes as `'null'`, `'array'`,
`'number'`, `'string'` (and `'boolean'`, though the issue's evidence does
not name it — JSON.parse can also produce a top-level `true`/`false`).
Error message text matches the issue's "Expected" section verbatim:
`brain.config.json at <path> must contain a JSON object, got <type>`.

## Every `loadBrainConfigOrThrow` call site — key, direction, test coverage

The issue's own evidence section lists five files as "the six callers"
(`approve/cli.mjs:124,139`, `brain-audit.mjs:181`,
`governance/lane-scrub.mjs:70`, `memory/backends/engram.mjs:458` and
`memory/backends/plainfiles.mjs:50` — six call sites across five files). It
does not claim to be a complete inventory (same disclaimer #976/PR #980 used
for its own roster). Measured directly against `origin/main` via
`rg -n "loadBrainConfigOrThrow\(" brain/scripts`, the actual count is **10
call sites across 8 files** — four more than the issue's evidence section
names (`vcs/actor-check.mjs:1109`, `vcs/brain-writes-reviewed.mjs:259,284`,
`memory/lane/collect.mjs:101`). All 10 are protected the same way: the fix
lives entirely inside the one shared primitive, so every call site gets the
shape check without being touched.

| # | File:Line | Reader | Key | Direction | Proven how |
|---|---|---|---|---|---|
| 1 | `approve/cli.mjs:124` | `defaultReadDenyActors` | `governance.reviewActors ∪ governance.agentActors` | **DENY** | Direct: T-style unit test + a `runApprove` fixture test wiring the real reader (not a stub) |
| 2 | `approve/cli.mjs:139` | `defaultReadAgentActors` | `governance.agentActors` | **DENY** | Direct: unit test against the real function |
| 3 | `vcs/actor-check.mjs:1109` | `defaultReadDenyActors` | `governance.reviewActors ∪ governance.agentActors` | **DENY** | Transitive — same loader, same shape as #1; not independently re-driven (already covered by `brain-config.test.mjs` T4-T9 at the loader level and by #1/#6 at two independent call sites) |
| 4 | `vcs/brain-writes-reviewed.mjs:259` | `defaultReadBotAllowlist` | `governance.reviewActors` | **DENY** | Transitive |
| 5 | `vcs/brain-writes-reviewed.mjs:284` | `defaultReadApprovalActors` | `governance.approvalActors` | ALLOW (hardened anyway per #942 D3) | Transitive |
| 6 | `brain-audit.mjs:181` | `loadConfig` | `governance.reviewActors` (read at `:370`) | **DENY** | Direct: fixture test driving the real CLI via `spawnSync` against a temp git repo, mirroring the `#962` precedent |
| 7 | `governance/lane-scrub.mjs:70` | `defaultReadConfig` | `governance.memorySecretPatterns` (DENY) / `governance.memorySecretAllowPatterns` (ALLOW) — one read, both keys, DENY decides for the whole read (#712 R1) | **Mixed, DENY-dominant** | Transitive |
| 8 | `memory/backends/engram.mjs:458` | `_defaultLoadBrainConfig` | same mixed pair | **Mixed, DENY-dominant** | Transitive |
| 9 | `memory/backends/plainfiles.mjs:50` | `_defaultLoadBrainConfig` | same mixed pair | **Mixed, DENY-dominant** | Transitive |
| 10 | `memory/lane/collect.mjs:101` | `_defaultLoadConfig` | same mixed pair | **Mixed, DENY-dominant** | Transitive |

Two of the ten (`#1` and `#6`) are proven at the real entry point per the
acceptance criteria's explicit minimum. The other eight are not
independently re-driven through their own CLI/pipeline entry points in this
change (scope discipline — the issue's acceptance criteria names exactly
`brain-audit.mjs` and `approve/cli.mjs`), but the shape check protecting
them is the same nine loader-level tests (`T4`-`T7` for `null`/`[]`/`42`/`"x"`,
`T8`-`T9` for the unchanged absence/valid-object cases) plus `T1`-`T3`
(pre-existing) — the mutation table below shows reverting the shape check
turns every one of the eight new tests red and nothing else, confirming the
fix is isolated to the one shared primitive every call site imports.

## `loadBrainConfig()` classification (issue #975, Expected item 3)

`loadBrainConfig()` (`brain/scripts/lib/brain-config.mjs:23-65`, unqualified
by `root`, always resolves `CONFIG_PATH`) has the exact same shape gap in
theory: `return JSON.parse(raw);` with no shape check. It is the "legacy
export whose absence throws" the issue names — #942's R8 already ruled it
UNCHANGED because it keeps a single throw-on-both-absence-and-malformation
contract for its callers, which correctly read any throw as "absent."

**Decision: leave it unchanged.** Its callers were re-derived from source
(`rg -n "loadBrainConfig\\(" brain/scripts`, excluding the `Or Throw`
variant and comment-only matches):

| Caller | File:Line | Reads | Category |
|---|---|---|---|
| `archive.mjs` | `:228` | `config` passed to `makeReadIssueState` | Utility — no governance-gate semantics |
| `brain-to-engram.mjs` | `:15` | `{ project }` destructured | Utility — a top-level `null` would already crash on destructure today, unrelated to this gap |
| `day-start.mjs` | `:28` | whole config, greeting/status fields | Utility |
| `governance/approved-label.mjs` | `:54,56-60` | `governance.approvedLabel` (a single string) | Fixed-fallback exemption — a read failure already degrades to the ratified constant `'status:approved'`, guarded by its own `try/catch` |
| `governance/run-check.mjs` | `:172-178` (`defaultReadConfig`) | whole config for `resolveApprovedLabel`/`ignoreList` | Already wraps the call in `try { … } catch { return {}; }` — a raw non-object return would still be handed to callers unchanged if it were NOT caught, but IS caught here |
| `i18n/sh.mjs` | `:71` | `docs.language` | Utility |
| `i18n/t.mjs` | `:18` | `docs?.language` | Already wrapped in its own `try { … } catch { return 'en'; }` |
| `memory/cli.mjs` | `:484` | dynamic import + call | Utility |
| `memory/session-end-ship.mjs` | `:131` | injectable default (`_loadConfig`) | Utility |
| `review/cli.mjs` | `:171,191,291` | `project?.slug`, whole `config` | Review-scoring metadata, not a deny/allow list |
| `review/evaluators/tranche.mjs` | `:313,323` | `governance.ignoreList` | **ALLOW/exemption** — empty is already the strict answer |
| `review/identity.mjs` | `:143,153` | `reviewer`, `project.gitHost` | Fallback identity/host fields, not deny/allow |
| `status/epic-map.mjs` | `:74` | whole config | Status reporting, not a gate |
| `ticket-new.mjs` | `:76` | whole config | Utility |
| `ticket-start.mjs` | `:68` | whole config | Utility |
| `vcs/cli.mjs` | `:129` | whole config, passed to `resolveProviderName` | VCS adapter wiring, not deny/allow |
| `vcs/governance-tiers.mjs` | `:520` | `governance.tier` via `resolveTier()` | **Doctrine-ratified fixed fallback** (`evidence-reader-empty-on-failure.md`'s own "Exemption" paragraph) — not a deny/allow reader at all |
| `vcs/phase-order-check.mjs` | `:487-493` (`defaultReadConfig`) | whole config for `resolveTier()` | Already wraps the call in `try { … } catch { return {}; }` |

No caller of `loadBrainConfig()` reads a DENY/exclusion identity list
(`governance.reviewActors`, `governance.agentActors`, or
`governance.approvalActors` — all three are read exclusively through
`loadBrainConfigOrThrow`'s ten call sites above). The two callers with the
widest blast radius if left unguarded (`run-check.mjs`,
`phase-order-check.mjs`) already wrap the call in a local
`try { … } catch { return {}; }`, so a shape check added here would only
change ONE observable case across all seventeen call sites: a top-level
`null` value stops crashing with an unguarded `TypeError` on the caller's
first `.` access (every other rejected shape — `[]`, `42`, `"x"` — already
degrades silently via property access returning `undefined`, exactly as
today). That is a marginal, non-security improvement (a clearer crash
instead of an opaque one), not a fail-open fix, so `loadBrainConfig()` is
left unchanged — extending R8's ruling to cover shape as well as
absence/malformation.

## Doctrine draft (Tier 2, draft only, never promoted)

`brain-drafts/loader-shape-gap-closed.draft.md` — a `brain-amendment/1` draft
targeting `brain/core/anti-patterns/evidence-reader-empty-on-failure.md`,
anchored on the paragraph text AS IT WILL STAND after PR #980 (issue #976)
merges — **PR #980 is still open at the time of this change**; the anchor
text below was read directly from `gh pr diff 980`, not assumed. #980's own
PR description names this exact gap explicitly: "Known gap, not closed
here… That is #975, open and approved." Once #975 (this change) lands, that
"known gap" framing is stale — the draft appends one sentence recording that
the shape gap is now closed, without touching anything #980 changed. See
the draft file for the full contract; it is NOT promoted by this change
(hard constraint: never run `brain:promote`).
