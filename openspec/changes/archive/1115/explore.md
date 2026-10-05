# Explore: backend-owned memory lifecycle verb (#1115, folds #1189)

Read-only exploration at v1.12.1. No code changed.

## 1. Contract and dispatcher today

- `brain/core/methodology/memory-backend-contract.md:60-70` already names four required verbs: `setup`, `share`, `hydrate`, `save`. `hydrate({root, recordId?}) -> {written, skipped, deferred?, contended?}`. The contract says the bulk form "is still spelled `pull` and `cli.mjs import`" (line 65). So the verb exists on paper; #1115 is mostly wiring it.
- Conformance table (`:~108`): plainfiles rule 1 holds "by construction (`hydrate` is `rebuildIndex`)".
- Dispatcher `brain/scripts/memory/cli.mjs`:
  - `VALID_OPS` `:~170-188` includes `import`, `pull`, `share`, `setup`, `index`, `save`, `search`, `feature-*`, `heal-duplicates`; no `hydrate`.
  - `VERB_TO_EXPORT = {import: 'importMemory'}` `:942`; `fn = VERB_TO_EXPORT[op] ?? camelCase(op)` `:944`.
  - Backend-agnostic ops dispatched before backend selection: reindex, audit, resolve-index, split-records, collect, ship, migrate-v1.
  - Selection `:973-1000`; load adapter `:1030`; missing export -> `backend 'X' does not implement op 'Y'` exit 1 (`:1048`). That is the plainfiles noise.
  - `ROOTED_OPS = {share, pull, import, setup}` `:1190` (passes `{root}` under `BRAIN_MEMORY_TEST_ROOT`).
- `FALLBACK_OPS = ['pull']` (`lib/backend-selection.mjs`, the comment block explains why `import` is excluded). Issue says do NOT add `import` there; consistent.
- Exports per backend:
  - engram (`axes/memory/adapters/engram.mjs`): `share:175`, `importMemory:391` (bulk, requires binary via `_requireEngram`, hydration guard), `pullMemory:548`/`pull:577` (git pull + reindex + import), `save:637`, `search:777` (refuses), `hydrate:826` (SINGLE record only: throws `recordNotFound` when `recordId` absent, defers when binary missing), `index:924` (spawns brain-to-engram.mjs), `setup:956`, `featureCheckpoint:1064`, `featureResume:1195`, `healDuplicates:1599`.
  - plainfiles (`plainfiles.mjs`): `save:94`, `search:336`, `share:390` (rebuildIndex), `pull:410` (git pull + rebuildIndex), `setup:424`, `index:437`/`featureCheckpoint:441`/`featureResume:445` = `unsupportedOp`. NO `importMemory`, NO `hydrate`.
- Existing name collision to resolve: engram's `hydrate` is the single-record form. Bulk form must be `hydrate({root})` with `recordId` absent (contract already types `recordId?`), delegating to `importMemory`. Today it throws on missing id.

## 2. Callers of `import` / engram-specific steps

| Caller | Where | What it does |
|---|---|---|
| session-start | `brain/scripts/session-start.mjs:89` `MEMORY_CLI_ALLOWED_OPS=['import','feature-resume']`; `assertLocalArgv` `:~111-140`; `step2HydrateEngram:286-299` spawns `cli.mjs import`; `runSessionStart:~430` | Result `{ok}` / `{ok:false, reason, undeclared?}`; rendered by `renderContextBlock:205` via `session.memory.*` i18n (en.mjs:444-450, es.mjs:402-407) |
| day-start | `brain/scripts/day-start.mjs:347-370` | probe `engram --version`; 4a `cli.mjs import`; 4b `brain-to-engram.mjs` (project brain/ docs into engram = the `index` verb); 4c `engram sync --export` (+ i18n `day.memory.exporting/exported/exportFailed`, en.mjs:74-76) |
| post-merge hook | `brain/scripts/hooks/post-merge:53` (managed path under `core.hooksPath=brain/scripts/hooks`; there is no top-level `hooks/`) | `cli.mjs import >/dev/null`; maps exit 3/4 to a one-liner; plainfiles exit 1 is silent in rc but stderr noise shows |
| `brain:memory:pull` | `package.json:71,83` -> `cli.mjs pull` | engram: `pullMemory` (git pull, reindex, import). plainfiles: `pull` (git pull + reindex). Already backend-owned. `FALLBACK_OPS` covers binary-absent. NOT noisy; the #1189 claim about `brain:memory:pull` calling `import` appears wrong or stale on plainfiles (verify in the consumer evidence). `engram.pull` calls `importMemory` internally only. |
| bootstrap | `bootstrap.sh:880,908` call `setup` only | not affected |
| other | `brain-to-engram.mjs` (engram projector), `engram.mjs:280-282` comments naming import callers | comments to refresh |

## 3. What `hydrate` must do and what "context" means

- engram `hydrate()` bulk: `importMemory` (delta vs engram state under `lib/hydration-guard.mjs`, #820). Returns `{written, duplicates}` today; normalize to `{written, skipped, deferred?, contended?}`. Binary absent -> `deferred` (not throw), consistent with single form.
- plainfiles `hydrate()`: `rebuildIndex` (same as `share` shape). Return `{written: 0, skipped: n}` or `indexCount, duplicates`. Reuse `share` body; no git.
- Context today: session-start output is only the one status line (`memory: engram hydrated` / `unavailable`) + recency line (`step4bMemoryRecency` reads `.memory/records/*.jsonl` directly, backend-free) + ticket resume (`featureResume`, a no-op on plainfiles). So on plainfiles the agent gets NO memory content, only a skip line. `renderContextBlock` also hardcodes the word "engram" in `memoryOk` and `memorySkip` strings.
- What plainfiles could deliver (all derivable from records, local, no network): count of records and newest ts (partially present), the N most recent record titles/types, records scoped to the active change's issue (`issue` field). Needs a product decision (see Q3). Note `step5SynthesizeContext` is defined but unwired (#923 comment, `:~395`), also a candidate carrier.

## 4. day-start step 4c export

- `engram sync --export` writes engram's chunk store into `.memory/chunks` (the retired transport). Under record-first (rule 2, `share` "exports nothing from the backend", `memory-backend-contract.md:64`), the backend is never the first home of a capture and nothing exports it (agent-authorities.md:22: "nothing exports it"). Step 4c reverses that. Its i18n text even says "ready to commit with the next push", contradicting ADR-0034 (records travel only on the lane).
- Dependents: none in code beyond i18n keys; `day-start.test.mjs` is a source-scan test (`:25,35`) that only pins the lane-sweep block never calls `die`/`exit`, not 4c. `axis-port.allowlist.mjs:23` (`day-start.mjs spawn-concrete:engram max 2, owner #1115`) counts the probe plus the export; removing both makes this entry stale and the guard fails until the entry is deleted (it is designed that way).
- Options: (a) remove 4c (recommended: contradicts doctrine, no reader); (b) justify: none found, the only defensible reading ("closes the loop") predates record-first.
- 4b (`brain-to-engram.mjs` = `index` verb) is a separate engram-only projection: route through `cli.mjs index` (engram implements; plainfiles `unsupportedOp` by design, would be noise, so skip when unsupported or only call when backend implements). Allowlist entries for `brain-to-engram.mjs` (owner #1115) cover the file itself and are only deletable if the projector moves inside the adapter; likely out of scope.

## 5. Doctrine and ADRs

- `memory-backend-contract.md` is `brain/core` (read-only for agents, Tier 2/3): the `hydrate` row text "bulk form is still spelled `pull` and `cli.mjs import`" and rule 3's "`cli.mjs import`" need amending to name `hydrate`. Also `harness-contract.md:36,38`, `consolidation-protocol.md:190`, `agent-authorities.md:22` mention `cli.mjs import`. Needs `brain-drafts/` draft + maintainer promote (`brain:promote`), as an Amendment 3 to the contract (existing pattern: Amendments 1-2 exist).
- ADR amendments likely: ADR-0004 (its line 17 says "`hydrate` (today `pull` / `cli.mjs import`)", now delivered; amendment 5) and maybe ADR-0002 only if the 4c removal is read as a doctrine change (it is enforcement of existing doctrine; a note suffices). ADR-0024 not needed.
- Delivery of the "context to the agent" for plainfiles is a new capability; if it extends the contract (a `context`/`session-start` verb) it is a contract change and an ADR. If kept inside `hydrate`'s result or session-start code it is not.

## 6. Pinning tests and specs

- `session-start.test.mjs`: `:184-226,284` memory line strings; `:263-268,406-409` reason surfacing; `:424-430` asserts argv `import` exactly; `:543`, `:592-627` `assertLocalArgv` allowlist for `import`; `:653+` import-graph guard. All change if the verb is renamed.
- `hooks/post-merge.undeclared.test.mjs:25` (exit 3/4 message), `hooks/hooks.stream-discipline.test.mjs` (stderr must not be discarded: keep).
- `memory/cli.backend-fallback.test.mjs:~307-309` pins `import` on plainfiles refusing ("does not implement op 'import'"); `cli.backend-declaration.test.mjs:119` lists `import` among ops that refuse when undeclared; `lib/backend-selection.test.mjs` pins FALLBACK_OPS exclusion; `engram.import.test.mjs`, `engram.pull.test.mjs`, `engram.batch-import.test.mjs`, `engram.hydrate.test.mjs` (single form), `retired-artifacts.static.test.mjs`, `axes/memory/no-artifact.parity.test.mjs`, `reindex-parity.test.mjs`, axis-port allowlist guard test, `i18n/coverage.test.mjs:446-447`.
- Specs: `openspec/specs/session-start/spec.md` REQ-2 (allowlist wording names `import`), REQ-4 ("Local Engram Hydration" using `import`: needs renaming to backend-agnostic hydration + plainfiles scenario), REQ-9 (day:start non-regression; 4c removal is an intentional observable change, needs delta). `openspec/specs/memory-backend/spec.md` gets a scenario for bulk hydrate under both backends (two hydrations, one snapshot already there).

## 7. Approaches

A. **Add `hydrate` op (bulk) on both adapters; callers use only it; keep `import` as deprecated alias in the dispatcher** (maps to engram `importMemory`, plainfiles hydrates too).
 - + minimal blast radius, back-compat for consumers' installed hooks (post-merge is a managed copy, old hook calls `import` until upgrade, so the alias must stay at least one release).
 - - two names; alias silently succeeds on plainfiles (desired, ends the noise).
B. **Rename `import` to `hydrate` outright** (remove `import`).
 - + clean; - breaks stale consumer hooks (`post-merge` calls `import`; fails with unknown op, exit 1, noisy) and `assertLocalArgv` users. Needs a migration. Violates "fresh consumer install" caution (ADR-0036).
C. **A + context payload**: `hydrate` also returns a `context` block (recent records/issue-scoped) that session-start renders for every backend.
 - + closes "no memory context delivered" fully; - widens contract (return shape, i18n, privacy/size of what is printed), larger diff, likely needs ADR.

**Recommendation:** A now (hydrate bulk + `import` kept as alias printing nothing extra), remove day-start 4c, route day-start 4a to `hydrate`, session-start/post-merge to `hydrate`, and a small plainfiles "memory context" line (counts + newest + N recent titles) as a separate slice (or the same PR if the maintainer wants to close the "context delivered" column, 6.1). Do not add to FALLBACK_OPS.

Diff estimate (excluding tests/openspec/.memory): adapters +50 (engram hydrate bulk branch ~25, plainfiles hydrate ~20), cli.mjs +10 (VALID_OPS, ROOTED_OPS, alias), session-start.mjs ~±25 (allowlist, renamed step, strings), day-start.mjs -25, post-merge ±5, i18n ±20, allowlist -2 entries, comment refreshes ±15: about 150-200 lines net for A; +80-120 for the context payload in C. Under the 400 `standard` budget, and the 1000 `lite` one.

## 8. Decisions for the MAINTAINER (questions, not decided)

1. Verb name: `hydrate` (contract's own name) or `session-start` (issue offers both)? Contract favors `hydrate`.
2. Keep `import` as a permanent alias, a one-release deprecated alias, or remove it? (stale managed hooks)
3. Is "context delivered to the agent" for plainfiles in scope of this issue, and if so what: counts+recency only, recent N record titles, or issue-scoped records? Does it live in `hydrate`'s result (contract change) or in session-start reading records (no contract change)?
4. day-start 4c: confirm removal (no justification found). And 4b (`brain-to-engram` reprojection): leave as is, route through the `index` verb, or out of scope?
5. Session-start strings that say "engram hydrated/unavailable": rename to backend-neutral wording, naming the active backend?
6. Contract/ADR path: approve drafting an Amendment 3 to `memory-backend-contract.md` (+ ADR-0004 amendment) under `brain-drafts/`, and the `harness-contract.md`/`consolidation-protocol.md`/`agent-authorities.md` wording touch-ups in the same promote?
7. #1189: is `brain:memory:pull` really noisy on plainfiles (code says `pull` is already backend-owned)? If not, close that bullet with evidence and fold only post-merge and session-start.
8. Split: one PR, or contract/doctrine draft first and code second?

Key file paths: `brain/scripts/memory/cli.mjs`, `brain/scripts/memory/lib/backend-selection.mjs`, `brain/scripts/axes/memory/adapters/{engram,plainfiles}.mjs`, `brain/scripts/session-start.mjs`, `brain/scripts/day-start.mjs`, `brain/scripts/hooks/post-merge`, `brain/scripts/axes/axis-port.allowlist.mjs`, `openspec/specs/session-start/spec.md`, `brain/core/methodology/memory-backend-contract.md`.
