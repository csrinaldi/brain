# Design — #1128 + #1129

Line numbers are from `main` at `4b847561`. Paths are relative to `brain/scripts/` unless stated.

## D1 — The descriptor: one import-free leaf per runtime provider (rulings 2, 3, 4)

Each runtime provider gets `<name>.descriptor.mjs` beside its adapter. The leaf follows the
`axes/sdd-engine/adapters/gentle-ai.roles.mjs` pattern: data that a pure reader can load without
pulling in the adapter's graph. The difference is that a descriptor imports NOTHING.

```js
// axes/review-engine/adapters/codex.descriptor.mjs
export const DESCRIPTOR = Object.freeze({
  name: 'codex',
  capabilities: Object.freeze({ orchestrate: false, executeStage: true }),
  stage: Object.freeze({
    outputMode: 'final-message',                       // 'file' | 'final-message'
    model: Object.freeze({ policy: 'pinned', id: 'gpt-5.5' }), // 'opaque' | 'pinned' | 'default'
  }),
  readiness: true,                                     // a sibling codex.readiness.mjs exports checkReadiness
});
```

`rank` (Q2, ruled) is an optional finite number on a descriptor. The registry orders its derived lists by
`rank` (absent = last), then by `name`. `claude` is 1, `antigravity` 2, `plain` 3, which keeps ADR-0024
Amendment 2's order. The stage runtimes carry no rank.

| name | dir | orchestrate | executeStage | outputMode | model | readiness |
|---|---|---|---|---|---|---|
| `claude` | platform | true | true | `file` | `opaque` | false |
| `antigravity` | platform | true | false | — | — | false |
| `plain` | platform | true | false | — | — | false |
| `codex` | review-engine | false | true | `final-message` | `pinned` `gpt-5.5` | true |
| `gemini` | review-engine | false | true | `final-message` | `default` `gemini-2.5-pro` | true |

The capability values are today's `PLATFORM_CAPABILITIES` (`lib/axis-config.mjs:48-54`), copied
exactly. `claude` has ONE descriptor, in `platform/`. `review-engine/adapters/claude.mjs:2` stays a
logic-free re-export with no descriptor of its own, because the registry merges the two directories
(D2). `plain` is declared in `platform/` only. The `sdd-engine/plain.mjs` it re-exports is not a
platform provider, and `sdd-engine/` is not scanned.

`readiness` is a boolean, not a module path. The convention `<name>.readiness.mjs` is the address.
A path field would be a second spelling of a file name, with nothing to compare it against.

**Why `model` is in the descriptor and not just in the adapter (ruling 4).** Two readers need it:
the adapter (the runtime refusal, D7) and the readiness verb (the route check, D8). Today each has
its own copy (`codex.mjs:18`, `harness/codex-readiness.mjs:15`). The descriptor is the one place
both can import without a cycle. `codex.mjs` keeps `export const CODEX_MODEL = DESCRIPTOR.stage.model.id`
so that its existing tests and importers stay valid, and `gemini.mjs` does the same for `GEMINI_MODEL`.

## D2 — The registry: discovered by directory, loaded once, cycle-free

New `axes/lib/runtime-registry.mjs`. Its static imports are only `node:fs`, `node:path` and `node:url`.

```js
export const RUNTIME_AXES = Object.freeze(['platform', 'review-engine']); // the platform CONFIG axis (ADR-0038 §5)
export async function loadRuntimeRegistry({ base = DEFAULT_BASE } = {}) { … }   // injectable
export const RUNTIME_REGISTRY = await loadRuntimeRegistry();                     // the shipped tree
```

`loadRuntimeRegistry` runs these steps:
1. For each axis dir, it lists the `*.mjs` files that are not tests. An adapter name is a basename
   with no further dot (D12 uses the same rule).
2. It dynamic-imports each `<name>.descriptor.mjs` found in either dir.
3. It calls `validateDescriptor(d, file)`, which checks the D1 shape, that `name === basename`, that
   `stage` is present iff `executeStage`, that `outputMode` is in the set, and that `policy` and `id`
   are consistent.
4. It refuses a duplicate name, and an adapter name with no descriptor in either dir.
5. It returns a frozen
   `{ names, capabilities, orchestrators, stageRuntimes, descriptor(name), dirs }`, where the lists
   are sorted (`localeCompare`).

Every refusal is an `Error` that names the offending file. A broken shipped descriptor therefore
fails every brain command at import. That is fail-closed, and the registry tests catch it before
release.

**Why a top-level await is safe here, and where it would not be.** The #682 deadlock
(`harness/platform.mjs:1-40`) was a cycle re-entered through a module suspended at its top-level
await. The registry closes no cycle. It imports only builtins, and its dynamic imports reach only
descriptors, which import nothing (REQ-1128-1, pinned by a source test). `lib/axis-config.mjs`
statically imports the registry, so the registry finishes evaluating before `axis-config` and before
its existing cycle partner `axes/sdd-engine/role-port.mjs:27`. An async dependency of a cycle is
evaluated before the cycle. A cycle member suspended at its own await is a different case.
`harness/cli.mjs` evaluates `platform.mjs` → `axis-config` → the registry statically, before its own
top-level `await dispatch(...)`. Two existing tests guard the property: the #682 graph walker
(`harness/cli.test.mjs:228-268`), which walks every adapter's static graph, descriptors included, and
the e2e bootstrap run. A new test asserts the registry's import specifiers are all `node:`.

**Rejected alternatives:**
- **A static list of descriptor imports in the registry.** A third platform would then edit the
  registry, which fails ruling 8's "one adapter file + config".
- **Synchronous `require(esm)` via `createRequire`.** It is unflagged only from Node 22.12, and
  `package.json` `engines` says `>=22`.
- **A JSON manifest.** Ruling 2 rejects it.
- **Lazy, async capability reads.** `validateAxisConfig` and `resolveAxis` are synchronous and pure,
  and every caller would have to change.

## D3 — `axis-config.mjs` derives the platform facts (ruling 2)

- `lib/axis-config.mjs:32`: `export const AGENT_PLATFORMS = RUNTIME_REGISTRY.orchestrators;` (rank-ordered)
- `:48-54`: `export const PLATFORM_CAPABILITIES = RUNTIME_REGISTRY.capabilities;` The "THIS TABLE IS A
  SEAM" comment is replaced by a pointer to the descriptors.
- `validateAxisConfig(config, { defaultRole, registry = RUNTIME_REGISTRY })`: the two reads at `:172`
  and `:193` become `registry.capabilities[...]`.
- `resolveAxis(axis, { …, registry = RUNTIME_REGISTRY })`: the membership read at `:358`
  (`AXIS_MEMBERS[axis]`) becomes `axis === 'platform' ? registry.orchestrators : AXIS_MEMBERS[axis]`.
  This is an axis-name branch, not a provider-name branch, so the guard does not flag it.
  `legacyValue` (`:74`) keeps reading `AGENT_PLATFORMS`. The legacy alias is shipped-tree only.
- `AXIS_MEMBERS.platform` (`:246`) stays `AGENT_PLATFORMS`, which is now derived.
- `SDD_ENGINES`, `MEMORY_BACKENDS` and `VCS_PROVIDERS` stay literals (non-goal).
- `harness/platform.mjs:42-46` re-exports, unchanged. `config/config-verb.mjs:26,37,73` reads the same
  exports, unchanged.

**The order (Q2, ruled).** The registry sorts by `rank`, then by name. With `claude` 1, `antigravity` 2 and
`plain` 3 the derived list is `claude, antigravity, plain`, ADR-0024 Amendment 2's ratified order. The two
"claude first (#1125)" tests (`harness/cli.test.mjs:78-83`, `lib/axis-config.test.mjs:78`) stay green
unchanged.

## D4 — Injectable adapter directories (ruling 8)

`axes/lib/harness-adapter-url.mjs:26-28,38-41`:

```js
const DEFAULT_BASE = new URL('../', import.meta.url);             // axes/
export function harnessAdapterDir(axis, { base = DEFAULT_BASE } = {}) { return new URL(`${axis}/adapters/`, base); }
export function harnessAdapterUrl(name, { base } = {}) { /* same search, over harnessAdapterDir(axis, { base }) */ }
```

The default behaviour is byte-for-byte the current lookup. The registry's `DEFAULT_BASE` is the same
URL. A fixture passes a temp `base` to both, and reaches `dispatch` through its existing
`backendLoader` seam (`harness/cli.mjs:157-174`), so no production caller changes.

## D5 — The runner reads the output mode, and refuses a non-runtime first (rulings 4, #1129 acceptance)

`review/lib/run-cold-review-stage.mjs`:
- `deps.registry ?? RUNTIME_REGISTRY` (new import of `axes/lib/runtime-registry.mjs`).
- Right after `routing` resolves (`:157-158`), and before `artifactPathFor`, `mkdir`, the forge probe
  and `remove`:
  ```js
  const descriptor = registry.descriptor(routing.engine);
  if (descriptor?.capabilities.executeStage !== true) {
    return { routed: true, ok: false, reason:
      `the engine "${routing.engine}" ${descriptor ? 'does not declare executeStage' : 'is not a runtime brain ships a descriptor for'} ` +
      '— Refusing rather than falling back: … (same rationale as stage-seam.mjs)' };
  }
  ```
  It sits above every mutation, for the reason the `judgment:cold-3` comment at `:181-200` gives. It
  keeps the phrase `Refusing rather than falling back`, so that `review/cli.judgment.test.mjs:897`
  holds unchanged.
- `:164-167`: the local `isWithin` is deleted in favour of the import from `stage-output.mjs` (D6).
- `:168-176`: `const output = descriptor.stage.outputMode === 'final-message' ? {…} : undefined;`. The
  comment names the descriptor, not vendors.
- `:365`: `outputMode: descriptor.stage.outputMode`.
- `:418,:422`: `the ${routing.engine} final message …`.

The temp name `.${routing.engine}-final-…tmp` (`:173`) is data, not a branch, and it stays.

**Why refuse in the runner and not only in the seam.** ADR-0038 ("What this does NOT close") says that
"a provider lacking a capability is refused wherever that capability is required". The runner is where
`executeStage` is required, and it is also the only layer that knows the output mode. Without the
refusal, an unknown engine would have no mode to read. Today the seam refuses an unknown engine
(`harness/stage-seam.mjs:96-118`) only after the runner has cleared the previous artifact. The early
refusal is strictly safer. Its cost is that one pinned test, which routed `antigravity` and `plain`
through a fake seam to prove opaque model pass-through (`review/lib/run-cold-review-stage.test.mjs:255-261`),
switches to two stage runtimes (`claude` with `zz-9`, `gemini` with `null`). See Q4.

## D6 — `axes/lib/stage-output.mjs`: one redaction contract, one copy of each helper (ruling 4)

Exports:
- `engineTail(result, secrets, { max = 300, cap = 4096 } = {})`: this is the codex algorithm
  (`codex.mjs:22-36`), verbatim in order: redact over the full text, strip
  `[\u0000-\u0008\u000B-\u001F\u007F]`, `slice(-cap)`, take the last two lines, keep the last `max`
  characters prefixed `…`.
- `secretValues(env, names)` gives the non-empty values of `names` in `env`. Adapters call it with the
  same name list they passed to `withoutCredentials`.
- `canonicalPath(path)`: gemini's version (`gemini.mjs:63-74`, `relative(parent, current)`).
- `isWithin(parent, child)`: gemini's version (`gemini.mjs:76-79`). The codex copy (`codex.mjs:51-54`)
  and the runner copy (`run-cold-review-stage.mjs:164-167`) test `startsWith('..')`, so they wrongly
  read `/c/..x` as outside `/c`. That is a latent escape in the in-candidate check, and it is fixed by
  the dedupe. A test pins it.
- `validateFinalMessageOutput(output, cwd, { engine })`: the shared body of `codex.mjs:56-78` and
  `gemini.mjs:81-102`. The two messages that named a vendor take `engine`.

Callers:
- `claude.mjs:187-192`: `tail` is deleted. `:235-238` (scrub) keeps its name list in a local, and the
  failure branches append `engineTail(r, secretValues(_env, names))`. The non-zero branch at `:292-298`
  stops appending `String(r.stderr).split('\n')[0]` and appends `engineTail` instead.
- `codex.mjs:22-78` and `gemini.mjs:52-102`: delete the copies and import from `stage-output.mjs`.
  gemini's extra secrets (`GEMINI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `:162-166`) stay in its
  `secrets` list.
- `gemini.mjs`'s `canonicalPath` and `isWithin` exports: `gemini.test.mjs` imports them, so `gemini.mjs`
  re-exports them from `stage-output.mjs` for one commit. The tests then move to `stage-output.test.mjs`
  and the re-export is dropped.

`stage-output.mjs` lives in `axes/lib/`, not in an adapter dir, because the runner (outside the axes)
and two axis directories import it. It names no provider.

## D7 — The model policy (ruling 4)

The descriptor declares the policy, and the adapter enforces it at run time:
- `pinned` (codex): `codex.mjs:126-128` reads `DESCRIPTOR.stage.model.id`. The behaviour is unchanged.
- `default` (gemini): `gemini.mjs:117` takes its default from `DESCRIPTOR.stage.model.id`. The `agy`
  remap (`:156-158`) stays in the adapter and is documented in the contract as an adapter-owned
  substitution, reported in the diagnostic.
- `opaque` (claude): unchanged (`claude.mjs:213-229`).

The readiness verb (D8) reads the policy for the route check. Making `validateAxisConfig` refuse a
pinned mismatch at config time was not ruled. It is out of scope (Q7).

## D8 — Readiness through the descriptor (ruling 5)

**Moves (`git mv`, so the review diff shows renames):**
- `harness/codex-readiness.mjs` → `axes/review-engine/adapters/codex.readiness.mjs`. It keeps
  `MIN_CODEX_VERSION`, `versionAtLeast`, `parseVersion`, `resultText`, `defaultCommandExists`,
  `defaultRun`, and `checkCodexReadiness` exported as `checkReadiness`, plus a named alias for one
  commit. It deletes `resolveCodexRoute`, which D8's generic resolver replaces, `CODEX_MODEL` (now from
  the descriptor), `loadConfig` and `main`. The diagnostics' text is unchanged.
- `harness/gemini-readiness.mjs` → `axes/review-engine/adapters/gemini.readiness.mjs`. It keeps
  `checkGeminiReadiness` exported as `checkReadiness`. It deletes `resolveGeminiRoute`, `loadConfig` and
  `main`. Its import of `gemini.mjs` (`:11`) is now a same-directory import, which is why the guard
  stops flagging it.

**New `harness/readiness.mjs`:**
- `resolveStageRoute(config, { registry })` calls `resolveStageEngine(config, COLD_REVIEW_STAGE)`.
  - `null` → `{ required: false, engine: null, model: null }`.
  - Otherwise `d = registry.descriptor(engine)`, and the model is decided by the policy: `pinned`
    with a mismatch throws `Cold-review route requires model <id> for <engine>; received <m>`
    (generalising `codex-readiness.mjs:46-48`); `default` gives `model ?? id`; `opaque` gives `model`.
  - The route is `{ required: d?.readiness === true, stage, engine, model, identity }`.
- `checkRouteReadiness(route, { load = loadReadiness, seams })`: when not required it returns
  `{ ready: true, required: false, diagnostic: 'cold-review is routed to <engine|no engine>; it declares no readiness probe' }`.
  When required it returns `(await load(route.engine)).checkReadiness(route, seams)`.
- `loadReadiness(name, { base })` imports `new URL(`${name}.readiness.mjs`, dirOf(name))`. Its
  directory comes from `registry.dirs` (the dir that holds the descriptor), so it is not a literal
  adapter path and is not an `adapter-import`.
- `main(argv)`: `--check`, `--required` and `--engine`. `loadConfig` is gemini's lenient form (`{}`
  when absent), so a consumer with no `brain.config.json` gets "no engine".

**Shell callers:**
- `bootstrap.sh:409-418`: one block. `say "Cold-review engine readiness"`, then
  `node "$BRAIN_SCRIPTS/harness/readiness.mjs" --check`. A failure adds
  `"cold-review engine readiness"` to `MISSING_OPTIONAL`, as before. This wires gemini.
- `install-tools.sh:139-158`: `ENGINE="$(node …/readiness.mjs --engine)"`. The codex install step is
  kept under `[ "$ENGINE" = "codex" ]`, because installers may name tools and the shell is not scanned
  (follow-up 4). The readiness line calls the generic `--check` whenever `--required` says `yes`.

## D9 — `init` answers `{ok, ...}` (ruling 6)

- `claude.mjs:79-115`: success returns `{ ok: true }`. A malformed file returns
  `{ ok: false, reason }` (unchanged). A write throw returns `{ ok: false, reason }` (Q1, ruled). Today it
  warns and returns `undefined`, which is success over a failure (#1127's class).
- `antigravity.mjs:240-312`: it returns `{ ok, missingDocs, agentsWritten, geminiWritten, geminiSettingsError?, reason? }`
  with `ok = !geminiSettingsError && agentsWritten && geminiWritten` (the write half per Q1) and
  `reason` = the first failure. The JSDoc at `:230-238` that says "No `ok` field" is rewritten.
- `sdd-engine/adapters/plain.mjs:34-37` (`plain`'s platform module): it returns `{ ok: true }`. The
  sdd-engine `plain` tests that ignore the return are unaffected.
- `harness/cli.mjs:252-277`: the comment "today nothing answers" is replaced. Platforms answer
  `{ok}`. `undefined` stays success for SDD engines (`gentle-ai`), and the code is unchanged.

## D10 — The parity tests (rulings 6, 8; #1128 and #1129 acceptance)

- `axes/platform/contract.test.mjs`: one `describe` per name in `RUNTIME_REGISTRY.orchestrators`
  (+ the fixture, D11). The body is REQ-1128-7 (a)–(g). The written-file set is observed by walking the
  temp root before and after, because emit paths are not vocabulary yet (ruling 3). `plain` writes
  nothing, so (d) and (e) are vacuously empty for it. The test asserts the set is empty, so it cannot
  pass silently on a platform that stopped writing.
- `axes/review-engine/contract.test.mjs`: one `describe` per name in `RUNTIME_REGISTRY.stageRuntimes`.
  Engine-specific success seams (codex `_makeCodexHome`/`_copyAuth`, gemini `_commandExists`/`_hasAgyAuth`)
  come from a small per-engine `SEAMS` table in the test. This is test knowledge, and the fixture
  engine needs none. The body is REQ-1129-8 (a)–(h).
- Precedent and shape: `axes/vcs/contract.test.mjs`, `axes/sdd-engine/contract.test.mjs`.
- The per-platform REQ-1139 cases (`claude.test.mjs:45-114`, `antigravity.test.mjs:340-425`) stay.
  Collapsing them is a follow-up cleanup and is not required.

## D11 — Scaffold fixtures (ruling 8)

`axes/runtime-scaffold.test.mjs`, test-only. `mkdtemp` a base. Write
`platform/adapters/zed.mjs` + `zed.descriptor.mjs` and
`review-engine/adapters/zed-engine.mjs` + `zed-engine.descriptor.mjs`. Then:
1. `loadRuntimeRegistry({ base })`. Its orchestrators include `zed`, and its stage runtimes include
   `zed-engine`.
2. `validateAxisConfig({ platform: { default: 'zed', providers: { zed: {}, 'zed-engine': {} } }, sdd: { roles: { 'cold-review': { agent: 'brain:cold-review', engine: 'zed-engine' } }, … } }, { registry })`
   returns valid.
3. `resolveAxis('platform', { config, registry, env: {}, dotenv: {} }).value === 'zed'`.
4. The platform parity body (exported from `contract.test.mjs` as a function) runs on `zed`.
5. `runColdReviewStage({ config: { sdd: { map: { 'cold-review': { engine: 'zed-engine' } } } }, …, deps: { registry, runStage: makeRunStageSeam({ dispatch: (n, op, a) => dispatch(n, op, a, { backendLoader: (x) => import(harnessAdapterUrl(x, { base })) }) }), forgeProbe: LOGGED_OUT } })`
   returns `ok: true`, and the artifact holds the fixture's `brain-findings/1` block.

The adapter fixtures are written into the temp dir, so the registry's directory scan of the shipped
tree never sees them, and `npm pack` cannot ship them.

## D12 — The guard

- `axes/axis-port.guard.test.mjs:72-76` (`adapterNames`): the filter `!f.includes('.roles.')` becomes
  `!f.slice(0, -'.mjs'.length).includes('.')`. That excludes every helper leaf (`.roles.`,
  `.descriptor.`, `.readiness.`), so `axisValues()` is unchanged.
- `axes/axis-port.allowlist.mjs`: REQ-1128-9. In S1 the two entries are re-owned (`owner: '#1367'`,
  reason rewritten to name the deferred vocabulary). In S2 the five `#833` entries are deleted in the
  same commits that remove the hits, because the guard fails on a stale entry, so each deletion lands
  with its fix.

## D13 — Doctrine drafts and how they are promoted (ruling 7)

- **New docs** (`agent-platform-contract.md`, `review-engine-contract.md`): `brain:promote` has three
  shapes (new ADR by `adr-NNNN-slug.md`, amendment by `*.draft.md`, migration;
  `brain-promote.mjs:149-153,436-441`) and NO shape for a new methodology document. The precedent is
  #863 (`openspec/changes/archive/863/brain-drafts/memory-backend-contract.md`): a plain `<name>.md`
  draft with a "Promotion note" blockquote. The maintainer copies it to `brain/core/methodology/`,
  adds the `brain/HOME.md` Methodology entry, and signs with the commit. The drafts follow that shape.
- **`decision-gate` coupling.** A `brain/HOME.md` edit with no ADR path in the diff fails
  `decision-gate` (`workflow-governance.md`, invariant 4). The two new docs' HOME entries must therefore
  land in the same promotion PR as the ADR-0038 amendment. The README orders them that way.
- **Amendments:** ADR-0038 **Amendment 2** (see the proposal's numbering correction), ADR-0024
  Amendment 6, and ADR-0033 Amendment 4. Each was validated with `planAmendment()` against `main`
  (results in the hand-off and in `brain-drafts/README.md`).
- **ADR-0023 is not amended.** Role projection stays out of the platform interface (ruling 3).

## D14 — Test plan (strict TDD: red first)

**New tests, written red first:**
| test | red because |
|---|---|
| `axes/lib/runtime-registry.test.mjs` | the module does not exist; then each refusal case (missing, duplicate, malformed, name ≠ basename), the sorted lists, and `node:`-only imports |
| `axes/descriptors.test.mjs` | the descriptor files are absent; then every descriptor has no `import`/`await` (source scan) and every value matches today's table |
| `lib/axis-config.test.mjs` (+cases) | `validateAxisConfig(…, { registry })` and `resolveAxis(…, { registry })` ignore the option |
| `axes/lib/harness-adapter-url.test.mjs` | `base` is ignored |
| `axes/lib/stage-output.test.mjs` | the module does not exist; then the six-step contract, `isWithin('/c','/c/..x')`, and `validateFinalMessageOutput` with `engine` |
| `axes/review-engine/contract.test.mjs` | (e) is red for claude (no redaction) and gemini (no strip or cap); the others are green-on-arrival characterisation, stated as such |
| `review/lib/run-cold-review-stage.test.mjs` (+cases) | the gemini rename failure says "Codex"; `plain` reaches the seam; a fake registry declaring `final-message` for `claude` does not change the mode (the name branch wins) |
| `harness/readiness.test.mjs` | the module does not exist; then a gemini route with nothing installed gives `ready: false`; claude never spawns; the codex pin throws |
| `axes/platform/contract.test.mjs` | (b) is red for claude (`undefined`) and plain; (e) is red for antigravity (no `ok`) |
| `axes/runtime-scaffold.test.mjs` | the registry and `base` injection are missing |
| `harness/cli.test.mjs` (+case) | `AGENT_PLATFORM=antigravity` with malformed `.gemini/settings.json` exits 0 |
| `axes/axis-port.guard.test.mjs` | shrinks per S2 commit (the guard's own reconcile reports `SHRANK`/`STALE`) |

**Pinned tests that change (each named in its commit):**
- `harness/cli.test.mjs:78-83` and `lib/axis-config.test.mjs:78`: the order of `AGENT_PLATFORMS` (Q2).
- `review/lib/run-cold-review-stage.test.mjs:255-261`: `antigravity`/`plain` → `claude`/`gemini` (D5).
- `harness/run-stage.test.mjs:60`: `/exited with status 2 — boom/` → `/exited with status 2 — the engine last said: boom \/ more/`.
- `axes/platform/adapters/antigravity.test.mjs:186,305`: `deepEqual` gains `ok: true`.
- `axes/platform/adapters/claude.test.mjs`: any assertion that `init()` resolved `undefined`.
- `harness/codex-readiness.test.mjs` → `axes/review-engine/adapters/codex.readiness.test.mjs`, and
  `harness/gemini-readiness.test.mjs` → `gemini.readiness.test.mjs` (moved). The route cases move to
  `harness/readiness.test.mjs`. The "Codex is not required" / "Gemini is not required" diagnostics
  (`codex-readiness.test.mjs:40`, `gemini-readiness.test.mjs:34`) become the generic not-required line.
- `test/fresh-install/codex-route.e2e.test.mjs:5`: imports `resolveStageRoute` and `checkRouteReadiness`.
- `axes/review-engine/adapters/gemini.test.mjs`: the `canonicalPath`/`isWithin` imports move to
  `stage-output.test.mjs`.
- `axes/axis-port.guard.test.mjs:72-76`: the `adapterNames` filter (D12).

**Unchanged and load-bearing:** `harness/cli.test.mjs:228` (the #682 graph),
`axes/layout.test.mjs`, `antigravity.drift.test.mjs`, `harness/stage-seam.test.mjs:234-262`, and
`review/cli.judgment.test.mjs:887-897`.

**E2E (evidence to `evidence/`):** a scratch consumer from `npm pack`. With `AGENT_PLATFORM=claude`,
`node harness/cli.mjs init` exits 0 (#682). `bootstrap.sh` prints the generic readiness line for
claude, codex and gemini routes. `brain:review --dry-run` on a gemini route reaches the final-message
path with a fake engine on `PATH`.

## Rulings on Q1-Q7 (maintainer, 2026-10-06)

- **Q1** `init` write failure: `ok: false`.
- **Q2** order: claude first, via the descriptor `rank` field (above).
- **Q3** the two re-owned allowlist entries point at **#1367**.
- **Q4** the runner's early refusal wording for legacy `sdd.map` routes is accepted without a deprecation window.
- **Q5** antigravity's malformed `.gemini/settings.json` is a bootstrap REQUIRED failure.
- **Q6** `harness/codex-readiness.mjs` and gemini's old path are deleted outright, no shim (the D8 "named alias for one commit" is dropped).
- **Q7** config-time pinned-model validation: out of scope.

Follow-ups: #1366 (merge review-engine into platform dirs), #1367 (emit surfaces / role projection),
#1368 (quota state), #1369 (shell name mentions), #1370 (hint strings, `DEFAULT_PLATFORM`), #1371
(sdd-engine descriptors).
