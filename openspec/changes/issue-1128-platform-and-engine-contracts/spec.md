# Spec — #1128 + #1129: runtime adapters declare a descriptor; the platform and engine contracts

Delta requirements for this change. Section A is shared (the descriptor and the registry, S1).
Section B is the review-engine contract (#1129, S2). Section C is the agent-platform contract
(#1128, S3). Section D is the guard's end state. Section E is the doctrine (S4). Paths are
relative to `brain/scripts/` unless stated.

## A. Descriptors and the registry (S1)

### REQ-1128-1 Every runtime provider declares one descriptor, in an import-free leaf
For every runtime provider of the `platform` config axis (ADR-0038 §5), meaning every `<name>.mjs`
under `axes/platform/adapters/` and `axes/review-engine/adapters/` whose basename has no further
dot, exactly ONE `<name>.descriptor.mjs` MUST exist in one of those two directories. It exports
`DESCRIPTOR`, a frozen object:
`{ name, capabilities: { orchestrate: boolean, executeStage: boolean }, stage?, readiness: boolean }`.
`name` MUST equal the file's basename. `stage` MUST be present iff `executeStage` is `true`, and is
`{ outputMode: 'file'|'final-message', model: { policy: 'opaque'|'pinned'|'default', id? } }`, with
`id` required for `pinned` and `default` and absent for `opaque`. A descriptor file MUST contain no
`import` or `export ... from` statement and no top-level `await`.

#### Scenario: the five shipped descriptors
- GIVEN the shipped tree
- WHEN the registry loads
- THEN it holds `antigravity`, `claude`, `codex`, `gemini` and `plain`, with the capabilities of
  today's `PLATFORM_CAPABILITIES` (`lib/axis-config.mjs:48-54`), unchanged
- AND `claude` declares `stage.outputMode: 'file'` and `model.policy: 'opaque'`, `codex` declares
  `'final-message'` with `pinned` `gpt-5.5`, and `gemini` declares `'final-message'` with `default`
  `gemini-2.5-pro`
- AND `codex` and `gemini` declare `readiness: true`, while `claude`, `antigravity` and `plain`
  declare `readiness: false`

#### Scenario: a dual-axis name has one descriptor
- GIVEN `axes/review-engine/adapters/claude.mjs` (a re-export of the platform module)
- WHEN the registry loads
- THEN `claude`'s single descriptor is `axes/platform/adapters/claude.descriptor.mjs`, and a second
  `claude.descriptor.mjs` in either directory fails the load, naming both paths

### REQ-1128-2 One registry discovers, validates and serves the descriptors
`axes/lib/runtime-registry.mjs` MUST discover descriptors by listing the two directories. It MUST
NOT keep a list of names. It MUST refuse to build, throwing an error that names the file, on any of
these: a malformed descriptor, a `name` that differs from its basename, a duplicate name, or an
adapter module with no descriptor. It exports `loadRuntimeRegistry({ dirs })` (async, injectable)
and `RUNTIME_REGISTRY`, the shipped tree's registry, loaded once at module evaluation. A registry
exposes `names` (sorted), `capabilities` (`{[name]: {orchestrate, executeStage}}`, frozen),
`orchestrators` (sorted names with `orchestrate: true`), `stageRuntimes` (sorted names with
`executeStage: true`) and `descriptor(name)` (`null` when absent).

#### Scenario: a missing descriptor is refused
- GIVEN an injected directory holding `zed.mjs` and no `zed.descriptor.mjs`
- WHEN `loadRuntimeRegistry({ dirs: [thatDir] })` runs
- THEN it rejects, and the message names `zed.mjs` and the expected `zed.descriptor.mjs`

#### Scenario: helper leaves are not adapters
- GIVEN `codex.readiness.mjs`, `codex.descriptor.mjs` and `*.test.mjs` beside `codex.mjs`
- WHEN the registry lists the directory
- THEN only `codex` is an adapter name. A basename with a second dot is never an adapter

### REQ-1128-3 The capability table and the platform membership are derived
`PLATFORM_CAPABILITIES` MUST equal `RUNTIME_REGISTRY.capabilities`, and `AGENT_PLATFORMS` MUST equal
`RUNTIME_REGISTRY.orchestrators`. Neither may be a literal in `lib/axis-config.mjs`.
`validateAxisConfig(config, { registry })` and `resolveAxis(axis, { registry })` MUST read the
injected registry, defaulting to `RUNTIME_REGISTRY`. `AXIS_MEMBERS.platform` follows `AGENT_PLATFORMS`.
`config/config-verb.mjs` keeps reading both exports, unchanged.

#### Scenario: the validator reads capabilities from the adapter
- GIVEN `platform.default: "codex"` with `codex` in `platform.providers`
- WHEN `validateAxisConfig` runs
- THEN it refuses with `default-cannot-orchestrate`, because `codex.descriptor.mjs` declares
  `orchestrate: false`. No table in `axis-config.mjs` is consulted

#### Scenario: the order of the derived list (Q2)
- GIVEN the shipped tree
- WHEN `AGENT_PLATFORMS` is read
- THEN it is `['antigravity', 'claude', 'plain']` (sorted), pending Q2. The two pins that assert
  `['claude', 'antigravity', 'plain']` (`harness/cli.test.mjs:79`, `lib/axis-config.test.mjs:78`)
  change to the derived order

### REQ-1128-4 The adapter directories are injectable
`harnessAdapterDir(axis, { base })` and `harnessAdapterUrl(name, { base })` MUST accept a base URL,
defaulting to `axes/`. `dispatch(name, op, args, { backendLoader })` already accepts a loader. No
production caller changes its arguments.

#### Scenario: a fixture tree resolves
- GIVEN a temp `base` holding `platform/adapters/zed.mjs`
- WHEN `harnessAdapterUrl('zed', { base })` runs
- THEN it returns that file's URL, and `harnessAdapterUrl('zed')` (the default) still returns the
  first-axis candidate under the shipped tree

### REQ-1128-5 No ESM cycle through the registry
The registry module MUST NOT statically import any brain module. Descriptors import nothing, by
REQ-1128-1. The #682 graph test (`harness/cli.test.mjs:228`) stays green, and
`AGENT_PLATFORM=claude node harness/cli.mjs init` still exits 0 in a scratch consumer.

#### Scenario: the registry stays a leaf
- GIVEN the source of `axes/lib/runtime-registry.mjs`
- WHEN its static imports are read
- THEN every specifier is a `node:` builtin

## B. The review-engine contract (#1129, S2)

### REQ-1129-1 The runner names no engine
`review/lib/run-cold-review-stage.mjs` MUST choose the output mode from
`registry.descriptor(routing.engine).stage.outputMode`, with the registry injected through
`deps.registry` and defaulting to `RUNTIME_REGISTRY`. The name branch at `:170` is removed.
`outputMode` handed to `assembleReviewPrompt` is the declared mode.

#### Scenario: codex and gemini get the final-message output by declaration
- GIVEN `sdd.map['cold-review'] = { engine: 'gemini' }`
- WHEN the stage runs with a fake `runStage` seam
- THEN the seam receives `output.mode === 'final-message'`, with a `tempPath` outside the candidate
- AND the prompt carries the final-message instruction

#### Scenario: a third engine plugs in without touching the runner (REQ-1129-9)
- see REQ-1129-9

### REQ-1129-2 An engine that cannot execute a stage is refused before any mutation
When the routed engine has no descriptor, or its descriptor declares `executeStage: false`, the
runner MUST return `{ routed: true, ok: false, reason }` BEFORE it makes the directory, clears the
previous artifact, or probes the forge. `reason` names the engine and contains
`Refusing rather than falling back`.

#### Scenario: an unknown engine
- GIVEN `sdd.map['cold-review'] = { engine: 'no-such-engine-at-all' }` and a previous artifact on disk
- WHEN the stage runs
- THEN the result is `routed: true, ok: false`, the reason names `no-such-engine-at-all`, and the
  previous artifact is byte-identical
- AND `review/cli.judgment.test.mjs:887-897` and `harness/stage-seam.test.mjs:234-262` stay green
  unchanged

#### Scenario: plain cannot run the cold review
- GIVEN `engine: 'plain'`
- WHEN the stage runs
- THEN it is refused with a reason that says `plain` does not declare `executeStage`, and the seam is
  never called

### REQ-1129-3 The runner's messages name the routed engine
No runner message may name a vendor the route did not select. The materialisation and reader
failures (`:418`, `:422`) MUST read `the <engine> final message ...`.

#### Scenario: a gemini rename failure
- GIVEN `engine: 'gemini'` and a `renameSync` that throws
- WHEN the stage runs
- THEN the reason starts `the gemini final message could not be atomically materialized` and does
  not contain `Codex`

### REQ-1129-4 One redaction contract for every engine
Every stage-runtime adapter MUST build each failure `reason` tail with `engineTail(result, secrets)`
from `axes/lib/stage-output.mjs`, which applies, in this order:
1. it takes `stderr`, trimmed, or `stdout`, trimmed, when `stderr` is empty;
2. it replaces every non-empty secret with `[redacted]`, over the FULL text;
3. it removes the control bytes `[\u0000-\u0008\u000B-\u001F\u007F]`;
4. it keeps the last 4096 characters;
5. it joins the last two non-empty lines with ` / ` and keeps the last 300 characters, prefixed `…`
   when cut;
6. it renders ` — the engine last said: <text>`, or `''` when nothing is left.
`secrets` MUST include the value of every credential env name the adapter scrubbed, plus any
engine-specific credential the adapter knows (for example `GEMINI_API_KEY`). No adapter may put raw
engine output into a `reason` by any other path. That covers claude's non-zero-exit branch, which
today appends the first stderr line.

#### Scenario: a secret in claude's stderr (fails today)
- GIVEN `_env.GH_TOKEN = 'ghp_SECRET'` and a fake run that exits 1 with stderr
  `auth failed for ghp_SECRET`
- WHEN claude's `runStage` runs
- THEN `reason` contains `[redacted]` and not `ghp_SECRET`

#### Scenario: control bytes and length on gemini (fails today)
- GIVEN stderr of 10 KiB holding `\u001b[31m` sequences
- WHEN gemini's `runStage` fails
- THEN `reason` holds no byte in the control class, and its tail is at most 300 characters plus the
  prefix

### REQ-1129-5 One copy of each output helper, one model constant
`validateFinalMessageOutput(output, cwd, { engine })`, `canonicalPath` and `isWithin` MUST exist
once, in `axes/lib/stage-output.mjs`. codex, gemini and the runner MUST import them. `isWithin` MUST
treat a child named `..x` as inside its parent (gemini's `..${sep}` form). `CODEX_MODEL` MUST be
declared once, in `codex.descriptor.mjs`. `codex.mjs` re-exports it for compatibility.
`GEMINI_MODEL` likewise comes from `gemini.descriptor.mjs`.

#### Scenario: no duplicate definitions
- GIVEN `axes/review-engine/adapters/*.mjs`, `axes/platform/adapters/claude.mjs` and
  `review/lib/run-cold-review-stage.mjs`
- WHEN their source is scanned
- THEN none of them defines `function isWithin`, `function canonicalPath`, `function validateOutput`
  or `function tail`, and none declares `= 'gpt-5.5'`

#### Scenario: a dot-dot-prefixed child
- GIVEN `isWithin('/c', '/c/..x/f')`
- THEN it is `true`

### REQ-1129-6 Readiness is dispatched through the descriptor
`harness/readiness.mjs` MUST resolve the cold-review route (`resolveStageEngine`, still over
`sdd.map`). It reads the routed engine's descriptor. When `readiness` is `true`, it loads
`<engine>.readiness.mjs` from the engine's adapter directory and calls its `checkReadiness(route, seams)`.
Otherwise it answers `{ ready: true, required: false, diagnostic }` without spawning anything. When
the descriptor's model policy is `pinned` and the route's model differs, route resolution MUST throw,
naming the pinned id. That is today's codex behaviour, now generic. CLI modes: `--check` (prints the
diagnostic, exits 1 when not ready), `--required` (`yes`/`no`), `--engine` (prints the routed engine,
or nothing). `bootstrap.sh` and `install-tools.sh` call only this verb. Neither calls a per-engine
readiness script. `harness/codex-readiness.mjs` and `harness/gemini-readiness.mjs` no longer exist.

#### Scenario: a gemini route is probed at bootstrap (wired today: no)
- GIVEN `sdd.map['cold-review'] = { engine: 'gemini' }` and neither `agy` nor `gemini` on PATH
- WHEN `node harness/readiness.mjs --check` runs
- THEN it prints gemini's "neither agy ... nor gemini CLI is installed" diagnostic and exits 1

#### Scenario: a claude route probes nothing
- GIVEN `engine: 'claude'` and a `run` seam that throws when called
- WHEN `checkRouteReadiness` runs
- THEN it returns `ready: true, required: false` and the seam was never called

#### Scenario: codex's pin is generic
- GIVEN `engine: 'codex', model: 'gpt-4'`
- WHEN the route resolves
- THEN it throws `... requires model gpt-5.5; received gpt-4`

### REQ-1129-7 Each engine honours its declared model policy
`pinned`: `runStage` with any other model returns `ok: false` and does not spawn. `default`: an
absent model runs with the declared `id`, subject to the adapter's own documented remap (gemini's
`agy` remap stays inside the adapter). `opaque`: the model passes through unchanged, or is omitted
when absent.

#### Scenario: pinned refuses before spawning
- GIVEN codex and `model: 'gpt-4'`
- WHEN `runStage` runs with a `_run` that records calls
- THEN `ok: false` and `_run` was not called

### REQ-1129-8 Engine parity test
`axes/review-engine/contract.test.mjs` MUST run ONE body over every name in
`RUNTIME_REGISTRY.stageRuntimes` (claude, codex, gemini), with injected `_run`, `_env` and `_now`,
and each engine's own success seams:
(a) an empty prompt → `ok: false`, no spawn;
(b) a lifecycle stage without `routed` → throws (`assertRoutableStage`);
(c) the spawn env lacks every `credentialEnvNames()` var, and `forgeConfigDir` is applied after the scrub;
(d) a spawn throw, `ETIMEDOUT` and a non-zero status each → `ok: false` with a numeric `elapsedMs`;
(e) the redaction contract of REQ-1129-4;
(f) declared `final-message` → a missing or in-candidate `output` is refused before spawning;
declared `file` → `output` is ignored;
(g) `readiness: true` ⇔ `<name>.readiness.mjs` exports `checkReadiness`, and a not-required route
never spawns;
(h) the model policy of REQ-1129-7, for `pinned`.
It MUST be green for all three.

### REQ-1129-9 A third engine plugs in with one adapter file and config
A test-only fixture, in a temp `base`, holds `review-engine/adapters/zed.mjs` (a `runStage` that writes
its final message to `output.tempPath`) and `zed.descriptor.mjs` (`executeStage`, `final-message`,
`opaque`, `readiness: false`). With `sdd.map['cold-review'] = { engine: 'zed' }`, a registry loaded
from that base, and a seam whose loader resolves through `harnessAdapterUrl(name, { base })`,
`runColdReviewStage` MUST return `ok: true` and materialise the artifact. The engine parity body
(REQ-1129-8 (a), (d), (f)) MUST pass on it. No production file changes.

## C. The agent-platform contract (#1128, S3)

### REQ-1128-6 `init` answers `{ok, ...}` on every platform
`init()` on claude, antigravity and plain MUST resolve an object with a boolean `ok`:
- `ok: false, reason` when the platform refused to write a consumer file it could not merge
  (malformed JSON). This is claude's behaviour today and is new for antigravity
  (`geminiSettingsError` stays as an additive field);
- `ok: false, reason` when a write threw (**pending Q1**; the proposed default);
- `ok: true` otherwise. antigravity keeps `missingDocs`, `agentsWritten` and `geminiWritten` as
  additive fields, and a missing source doc alone stays `ok: true` with `missingDocs` listed.
`init()` never throws. `harness/cli.mjs` keeps reading `undefined` as success, for SDD engines only.

#### Scenario: antigravity refuses a malformed settings file, and the CLI says so
- GIVEN an existing `.gemini/settings.json` that is not JSON
- WHEN `node harness/cli.mjs init` runs with `AGENT_PLATFORM=antigravity`
- THEN the file is byte-identical, stderr names the path, and the exit status is 1

### REQ-1128-7 Platform parity test
`axes/platform/contract.test.mjs` MUST run ONE body over every name in
`RUNTIME_REGISTRY.orchestrators` (antigravity, claude, plain), each `init({ _repoRoot: tmp })` against
a temp root seeded with `SOURCE_DOCS` copies:
(a) the module exports `init` and an own `AGENT_RUNTIME` (`null` or `{name, bin, versionArgs}`);
(b) `ok === true` on an empty root;
(c) a second run leaves every file byte-identical;
(d) for every `.json` file the first run wrote, a consumer key and a custom hook added to it survive a
re-run;
(e) for every `.json` file the first run wrote, replacing it with malformed text → `ok: false`, the
file is byte-identical, and the `reason` names the path;
(f) capability agreement: `orchestrate` ⇒ `init` exported; `executeStage` ⇒ `runStage` exported
and the descriptor carries `stage`;
(g) `dispatch(name, 'init', [{ _repoRoot }])` through the real `harness/cli.mjs` resolves the same
answer.
The written-file set is observed from the tree, not declared, because emit surfaces are not yet
vocabulary (ruling 3). `antigravity.drift.test.mjs` stays as the byte golden.

### REQ-1128-8 A third platform plugs in with one adapter file and config
A test-only fixture, in a temp `base`, holds `platform/adapters/zed.mjs` (`init`, `AGENT_RUNTIME = null`)
and `zed.descriptor.mjs` (`orchestrate: true`, `executeStage: false`). With a registry loaded from
that base:
- `validateAxisConfig({ platform: { default: 'zed', providers: { zed: {} } } }, { registry })` is
  valid;
- `resolveAxis('platform', { config: <same>, registry })` resolves `zed`;
- the platform parity body passes on `zed`.
The fixture MUST write only under its temp `base`, and it MUST reach the shipped modules only
through their exported, injectable entry points (`loadRuntimeRegistry`, `validateAxisConfig`,
`resolveAxis`, `harnessAdapterUrl`, `dispatch`). The commit that adds the fixture test MUST NOT touch
`lib/axis-config.mjs`, `roles/first-party/project-role.mjs` or `axes/layout.test.mjs`. A hash pin
was rejected: it would fail every later legitimate edit of those files.

## D. The guard's end state

### REQ-1128-9 The allowlist after this change
**Deleted (5, all `#833`, all in S2):**
| file | rule | why it goes |
|---|---|---|
| `harness/codex-readiness.mjs` | `axis-branch` (1) | file moved into the adapter dir |
| `harness/codex-readiness.mjs` | `spawn-concrete:codex` (2) | file moved into the adapter dir |
| `harness/gemini-readiness.mjs` | `adapter-import` (1) | file moved; `GEMINI_MODEL` and `hasAgyAuth` are now same-axis imports |
| `harness/gemini-readiness.mjs` | `axis-branch` (1) | readiness dispatched by descriptor |
| `review/lib/run-cold-review-stage.mjs` | `axis-branch` (2) | output mode read from the descriptor |

**Re-owned, remaining (2, S1, ruling 1):**
| file | rule / max | owner before → after | retired by |
|---|---|---|---|
| `brain-promote.mjs` | `adapter-import` / 1 | `#1114` → `#1128` | follow-up 2 (emit surfaces); see Q3 |
| `roles/first-party/project-role.mjs` | `axis-branch` / 1 | `#1114` → `#1128` | follow-up 2 (role projection); see Q3 |

**Unchanged:** every other entry (`#1107`, `#1349`, `#1352`, `#1114` day-start gentle-ai, `legitimate`).
The new `harness/readiness.mjs`, `axes/lib/runtime-registry.mjs` and `axes/lib/stage-output.mjs`
MUST produce zero hits. The guard's `adapterNames` MUST ignore every basename with a second dot
(`.roles.`, `.descriptor.`, `.readiness.`), so `axisValues()` is unchanged.

#### Scenario: the guard proves it
- GIVEN the change applied
- WHEN `node --test axes/axis-port.guard.test.mjs` runs
- THEN it is green with 24 entries (29 − 5), and `axisValues()` deep-equals its value before the change

## E. Doctrine (S4)

### REQ-1128-10 Drafts only, planned clean
The change MUST write nothing under `brain/`. `brain-drafts/` MUST hold:
`agent-platform-contract.md` and `review-engine-contract.md` (new methodology docs, copied by hand),
`adr-0038-amendment-2.draft.md`, `adr-0024-amendment-6.draft.md` and `adr-0033-amendment-4.draft.md`
(`brain-amendment/1`), and a README with the promotion order. `planAmendment()` MUST return `ok: true`
with every act pending for each amendment draft, against `main` and again before the PR.

#### Scenario: nothing promoted
- GIVEN the branch
- WHEN `git diff --name-only origin/main -- brain/ | rg '\.md$'` runs
- THEN it is empty
