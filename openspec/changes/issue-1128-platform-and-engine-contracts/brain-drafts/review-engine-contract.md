# Review Engine Contract

> **status:** current | **last-reviewed:** 2026-10-06 | **owner:** @crinaldi

> **Purpose:** defines what a review engine (a runtime that executes a stage prompt, today the cold
> review's) must declare and implement, so that the cold-review runner names no engine and a new
> engine is one adapter plus configuration. Referenced by ADR-0033 (the cold review is a spawned
> subagent) and ADR-0038 §5 (an `engine` is a `platform` provider that declares it can execute a stage
> prompt). Sibling of `agent-platform-contract.md`, `vcs-contract.md` and `memory-backend-contract.md`.

> **Promotion note (agent-drafted).** A NEW methodology document. The maintainer copies it to
> `brain/core/methodology/review-engine-contract.md`, adds the `brain/HOME.md` Methodology entry, and
> signs with the commit, in the same PR as `adr-0038-amendment-2.draft.md` (see the README). Delete
> this note on promotion.

The stage is routed by `sdd.map['cold-review'] → { engine, model }`. `sdd.roles['cold-review']` is
the declared target, which #1132 makes the reader. `engine` is a `platform` provider whose descriptor
declares `executeStage: true`. The runner (`brain/scripts/review/lib/run-cold-review-stage.mjs`)
spawns it through `harness/stage-seam.mjs` → `harness/cli.mjs dispatch(engine, 'run-stage')`.

---

## The descriptor's engine fields

An engine's `<name>.descriptor.mjs` (shape in `agent-platform-contract.md`) carries:

| Field | Values | Meaning |
|---|---|---|
| `stage.outputMode` | `file` | The engine writes the artifact itself, at the absolute path the prompt names. |
| | `final-message` | The engine returns the artifact as its final message. The host hands it `output = { mode, tempPath, artifactPath }`, both absolute and outside the candidate. The adapter leaves the bytes at `tempPath`, and the host renames them atomically to `artifactPath` and reads them with brain's own findings reader. |
| `stage.model` | `{ policy: 'opaque' }` | The model is passed through unchanged, or omitted when absent (#323). |
| | `{ policy: 'pinned', id }` | Only `id` runs. Any other model is refused before spawning, at run time by the adapter and at readiness time by the route check. |
| | `{ policy: 'default', id }` | An absent model runs as `id`. The adapter may substitute a runner-specific equivalent and must say so in its diagnostics (gemini's `agy` remap). |
| `readiness` | `true` | A sibling `<name>.readiness.mjs` exports `checkReadiness(route, seams) -> { ready, required, diagnostic }`. |
| | `false` | Nothing to probe. The generic verb answers `ready` without spawning. |

The runner reads `outputMode` from the descriptor. An engine with no descriptor, or one that does not
declare `executeStage`, is refused BEFORE the runner clears the previous artifact. It is never routed
to a fallback.

## Required export: `runStage`

`runStage({ stage, prompt, model, cwd, timeoutMs, credentialEnv, forgeConfigDir, output, routed, _env, _run, _now })`
→ `Promise<{ ok: true, elapsedMs } | { ok: false, elapsedMs?, reason }>`.

1. **Routable stage.** Call `assertRoutableStage(stage, { routed })` first. A lifecycle stage without
   routing evidence throws.
2. **Nothing to do is not a run.** An empty prompt returns `ok: false` without spawning.
3. **The producer holds no credential.** Spawn with `withoutCredentials(_env, names)`, where `names`
   defaults to `credentialEnvNames()` and the caller may only widen it. Apply `forgeConfigDir` AFTER
   the scrub (ADR-0033 Amendments 1-2).
4. **A failure is never an empty result.** A spawn throw, a timeout (`error.code === 'ETIMEDOUT'`), a
   non-zero status, and (in `final-message`) a missing final message each return `ok: false` with
   `elapsedMs`.
5. **The output mode is honoured.** A `final-message` engine refuses an `output` that is missing,
   relative, inside the candidate, or whose `tempPath === artifactPath`
   (`validateFinalMessageOutput`), and writes only `tempPath`. A `file` engine ignores `output`.
6. **The engine may post-process its own output** before handing it over (gemini collapses identical
   duplicate `brain-findings/1` blocks). Verdict extraction is never the engine's: brain reads the
   artifact.

## The redaction rule (every engine)

Every `reason` that carries engine output is built by `engineTail(result, secrets)`
(`brain/scripts/axes/lib/stage-output.mjs`), in this order:

1. take `stderr`, trimmed, or `stdout`, trimmed, when `stderr` is empty;
2. replace every non-empty secret with `[redacted]`, **over the full text**, because truncating first
   would leave the suffix of a secret that straddles the window (#1274);
3. remove the control bytes `U+0000–U+0008`, `U+000B–U+001F` and `U+007F`;
4. keep the last 4096 characters;
5. join the last two non-empty lines with ` / `, and keep the last 300 characters, prefixed `…` when cut;
6. render ` — the engine last said: <text>`, or nothing.

`secrets` holds the value of every credential name the adapter scrubbed, plus any engine-specific
credential it knows. No other path may put raw engine output into a `reason`.

## Readiness

`node brain/scripts/harness/readiness.mjs --check | --required | --engine` resolves the cold-review
route and reads the engine's descriptor. It checks a `pinned` model against the route, then calls the
engine's `checkReadiness` when `readiness` is true. `bootstrap.sh` and `install-tools.sh` call only
this verb. `checkReadiness` checks deterministic local prerequisites only (binary, version,
authentication). Model access, network and the sandbox are verified by the real run.

## Conformance

`brain/scripts/axes/review-engine/contract.test.mjs` runs ONE body over every registry entry that
declares `executeStage`. It covers rules 1-5, the redaction rule, the readiness export, and the
`pinned` refusal, with injected `_run`, `_env` and `_now`.

## How to add an engine

1. Write `axes/review-engine/adapters/<name>.mjs` (`runStage`) and `<name>.descriptor.mjs`
   (`executeStage: true`, `stage`, `readiness`). Add `<name>.readiness.mjs` if it has prerequisites.
2. Declare it: `platform.providers.<name>`, and route the stage to it in `sdd.map['cold-review']`
   (until #1132) and `sdd.roles['cold-review'].engine`.
3. Run the parity suite. The runner, the readiness verb and the validator stay unchanged.
   `axes/runtime-scaffold.test.mjs` proves this with a temp-dir engine.

## Current implementation

| Engine | `outputMode` | model | readiness |
|---|---|---|---|
| `claude` | `file` | opaque | none |
| `codex` | `final-message` | pinned `gpt-5.5` | `codex` ≥ 0.154.0, `codex login status` |
| `gemini` | `final-message` | default `gemini-2.5-pro` (`agy` → `gemini-3.1-pro-high`) | `agy` + auth, or `gemini` + `GEMINI_API_KEY` / `GOOGLE_APPLICATION_CREDENTIALS` |

## What this does NOT close, said plainly

- **No distinct quota state.** "The engine exited" can be a usage limit, and the result cannot say
  so. Follow-up.
- **The runner still reads `sdd.map`.** Routing through `sdd.roles` is #1132.
- **A pinned model is not checked at config time.** `validateAxisConfig` does not read
  `stage.model`. A mismatch is refused at readiness and at run time.
- **`install-tools.sh` still installs codex by name.** Installers may name tools. Deriving install
  hints needs a descriptor field that is not vocabulary yet.
