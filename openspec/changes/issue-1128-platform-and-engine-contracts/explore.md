# Explore: #1128 (platform contract + parity test) and #1129 (cold-review engine contract)

Read-only exploration, 2026-10-05, worktree `issue-1128` off main `4b847561`. Paths are relative to `brain/scripts/` unless stated.

## 0. What changed since the issues were written

- `harness/backends/` is GONE (#1141). Adapters live in `axes/<axis>/adapters/`: `platform/` (claude, antigravity, plain), `sdd-engine/` (gentle-ai, plain), `review-engine/` (claude, codex, gemini), plus `memory/` and `vcs/`. The "one directory per axis" clause of #1128 is already met (`axes/layout.test.mjs:26-48` pins it). The open question is the opposite: ADR-0038 s5 says platform and review engine are ONE axis in config, still two directories (ADR-0038 "What this does NOT close").
- The inline allow-list in `harness/platform.mjs` is GONE. Membership is `AGENT_PLATFORMS = ['claude','antigravity','plain']` in `lib/axis-config.mjs:32`, re-exported by `harness/platform.mjs:50`. It is a closed list that is NOT derived from the adapter directory (the guard cross-checks them, `axes/axis-port.guard.test.mjs:73-90`).
- `PLATFORM_CAPABILITIES` (`lib/axis-config.mjs:48-54`) holds `{orchestrate, executeStage}` for claude/antigravity/plain/codex/gemini. Its own comment: "THIS TABLE IS A SEAM... #1128/#1129 move it". `validateAxisConfig` reads it at `lib/axis-config.mjs:172` (platform.default must orchestrate) and `:193` (`sdd.roles.<stage>.engine` must executeStage).
- The runner STILL reads `sdd.map`, not `sdd.roles` (ADR-0033 Amendment 3 "does not do yet"; `lib/stage-engine.mjs:123` `resolveStageEngine`, called at `review/lib/run-cold-review-stage.mjs:157`). Routing through `sdd.roles` is #1132, not these issues.

## 1. Current layout and de-facto interfaces

### Dispatch (by NAME, three-axis search)
- `harness/cli.mjs:117-125` `defaultBackendLoader(name)` -> `harnessAdapterUrl(name)` (`axes/lib/harness-adapter-url.mjs:30-35`) searches `['platform','sdd-engine','review-engine']` in that order and takes the first `<name>.mjs` that exists. `dispatch(name, op, args)` (`harness/cli.mjs:157-174`) then calls `backend[kebabToCamel(op)]`. Ops: `init` (cli) and `run-stage` (programmatic only) (`harness/cli.mjs:98-101`).
- Same name-lookup is used by `axes/lib/agent-runtime.mjs:34` (platform probe, reads `AGENT_RUNTIME`) and by the role port `loadInhabitant`.
- Dual-axis names: `claude` has one physical module (`axes/platform/adapters/claude.mjs`) and a logic-free re-export in `axes/review-engine/adapters/claude.mjs:2`; `plain` the same (`axes/platform/adapters/plain.mjs:2` re-exports the sdd-engine one). The lookup order decides which FILE loads, never which code runs.
- Cold review: `review/lib/run-cold-review-stage.mjs:157` resolves `{engine, model}` from `sdd.map`; `runStage` seam = `makeRunStageSeam()` (`harness/stage-seam.mjs:75-134`) which does `dispatch(engine, 'run-stage', [payload])` and refuses (never falls back) on any throw. Nothing validates that `engine` is a review engine/stage runtime at this layer except the adapter file existing (and `assertRoutableStage` inside each adapter).

### Platform adapters (`axes/platform/adapters/`)
| file | exports (de-facto interface) |
|---|---|
| `claude.mjs` (302 lines) | `CLAUDE_SETTINGS_EMIT_PATH`, `AGENT_RUNTIME` (descriptor `{name,bin,versionArgs,latest,updateHint}`, `:31`), `init()` (`:79`, merges `.claude/settings.json`, returns `undefined` or `{ok:false,reason}`), `STAGE_TIMEOUT_MS`, `runStage()` (`:194`) |
| `antigravity.mjs` (313) | `SOURCE_DOCS`, `AGENTS_EMIT_PATH` (`AGENTS.md`), `GEMINI_SETTINGS_EMIT_PATH`, `AGENT_RUNTIME = null` (`:62`), `REGENERATE_HINT`, `compileAgentsMd(docs,{roles})` (`:160`), `init()` (`:240`, writes AGENTS.md + merges `.gemini/settings.json`, returns `{missingDocs, agentsWritten, geminiWritten, geminiSettingsError?}` with NO `ok` key on failure by design) |
| `plain.mjs` | re-export of sdd-engine `plain` (`init`, `declareRoles`, `runStage`, `AGENT_RUNTIME=null`) |
| `lib/settings-hooks.mjs` | shared `compileSettingsHooksJson()` (same hooks payload for both platforms, #315) |

### SDD-engine adapters (`axes/sdd-engine/adapters/`) — not in scope, but they share `init`/`AGENT_RUNTIME`/`runStage` names
`gentle-ai.mjs` (`AGENT_RUNTIME=null`, `declareRoles`, `init`, `runStage`), `plain.mjs`; the role-port contract is `axes/sdd-engine/role-port.mjs` + `contract.test.mjs` (the shape a platform/engine parity test should copy).

### Cold-review engine adapters (`axes/review-engine/adapters/`)
| engine | where | exports |
|---|---|---|
| claude | platform adapter, re-exported | `runStage` above; output = the engine writes the artifact FILE itself (`claude -p ... --settings {disableAllHooks:true}`, `claude.mjs:~230`) |
| codex | `codex.mjs` (221) | `CODEX_MODEL='gpt-5.5'`, `CODEX_HOME_MODE`, `CODEX_AUTH_MODE`, `runStage` (`:115`). Pinned model, isolated `CODEX_HOME` with copied OAuth, `codex exec --sandbox read-only --output-last-message <tempPath>` |
| gemini | `gemini.mjs` (236) | `GEMINI_MODEL='gemini-2.5-pro'`, `hasAgyAuth`, `deduplicateFindingsBlocks`, `canonicalPath`, `isWithin`, `runStage` (`:114`). Picks runner `agy` or `gemini` by auth; writes stdout to `output.tempPath` itself |
| readiness probes | NOT in the adapters: `harness/codex-readiness.mjs` (142), `harness/gemini-readiness.mjs` (108) | `resolveCodexRoute/checkCodexReadiness` and `resolveGeminiRoute/checkGeminiReadiness` |

## 2. De-facto contracts

### Platform contract (what a platform adapter implements today)
1. `init(opts)` — idempotent workspace emission; MERGES consumer files, never overwrites (#1139); malformed existing JSON -> refuse. Return shapes DIFFER (claude `undefined|{ok:false,reason}`; antigravity `{agentsWritten,geminiWritten,...}` with no `ok`), and `harness/cli.mjs:~265` only treats an explicit `{ok:false}` as failure. A parity test must normalise or the contract must define the return.
2. `AGENT_RUNTIME` export REQUIRED (descriptor or `null`; absence = `seam-missing`, `axes/lib/agent-runtime.mjs:386`). Descriptor read by `brain:day:start` notify-only.
3. Emit paths: `.claude/settings.json` vs `AGENTS.md` + `.gemini/settings.json`; both use the SAME `compileSettingsHooksJson()` and `mergeSettings` core (`lib/installer.mjs`).
4. Role materialisation (first-party shelf -> platform): `roles/first-party/project-role.mjs` has `PROJECTION_PLATFORMS=['claude','antigravity']` and an `if (platform==='claude')` branch (`:43`) that emits `.claude/agents/brain-<role>.md`; antigravity gets a section appended in `compileAgentsMd` (`antigravity.mjs:183`). Only antigravity's `init` calls it today; `claude.init` does not project roles (verified: no caller of `projectRole` outside antigravity). So "role materialisation" is a platform VERB that exists in logic but not in the adapter interface.
5. Capabilities (`orchestrate`, `executeStage`) — NOT in the adapter; in `axis-config.mjs` (the seam).
6. `runStage` — only claude implements it among platforms (`executeStage:true`); antigravity declares `executeStage:false`.
7. Stage-runtime hygiene (claude): `assertRoutableStage`, credential scrub (`credentialEnvNames`/`withoutCredentials`), `withForgeConfigDir` shadow (#775), `--settings {disableAllHooks:true}` (#1010), timeout 10 min.

### Engine contract (what a cold-review engine implements today)
Input `runStage({stage, prompt, model, cwd, timeoutMs, credentialEnv, forgeConfigDir, output, routed, _env,_run,_now})`; output `{ok, elapsedMs?, reason?}`.
- Output modes: `file` (claude: engine writes `openspec/reviews/pr-N/...`) vs `final-message` (codex, gemini: host-owned `{mode,tempPath,artifactPath}`, adapter must leave the final text in `tempPath`; the host renames it atomically and re-reads it, `run-cold-review-stage.mjs:392-405`). The runner decides the mode by engine NAME (`:170`) and tells the prompt assembler via `outputMode` (`:339`).
- Model: claude opaque pass-through; codex pinned (`model !== CODEX_MODEL` refuses, `codex.mjs:~125`); gemini default `gemini-2.5-pro`, remapped to `gemini-3.1-pro-high` for `agy` (`gemini.mjs:~158`). Model policy is per-engine and undeclared.
- Auth/readiness: codex (`codex login status`, version >= 0.154.0, in `harness/codex-readiness.mjs`); gemini (`agy`+auth, or `gemini` + API key/GCP creds, checked inside `runStage` AND in `gemini-readiness.mjs`); claude none. Only codex readiness is wired (`bootstrap.sh:413`); `gemini-readiness.mjs` has NO production caller (rg: only the allowlist cites it).
- Spawn: via `defaultRun` (`axes/lib/agent-runtime.mjs:125`), env scrubbed + forge shadow; codex adds an isolated `CODEX_HOME`.
- Exit handling: spawnError / `error` (ETIMEDOUT) / non-zero status / missing final message -> `{ok:false, reason}`; reason carries `tail()` of the engine output. No distinct quota/rate-limit state (an "engine exited" can be a usage limit; the contract has no way to say so).
- Redaction DIVERGES three ways: codex `tail` redacts secrets over the full text, strips control bytes, caps 4 KiB (`codex.mjs:22-36`); gemini redacts but does not strip/cap (`gemini.mjs:~44`); claude's `tail(r, max)` has NO secret redaction at all (`claude.mjs:~175`). The contract should pin one.
- Duplicated helpers: `validateOutput`, `canonicalPath`, `isWithin` in both codex and gemini (gemini exports them); the model constant `CODEX_MODEL` lives twice (`codex.mjs:18`, `harness/codex-readiness.mjs:15`).
- Verdict extraction is NOT the engine's: brain reads the artifact with `readFindingsArtifact` (`run-cold-review-stage.mjs:~395`); gemini pre-normalises duplicate `brain-findings/1` blocks (`deduplicateFindingsBlocks`) — an engine-specific quirk that belongs in the contract as "engine may post-process its own output before handing it over".

## 3. Engine-name / platform-name branches outside adapters

Guard allowlist (`axes/axis-port.allowlist.mjs`), entries that belong here:
| entry | rule / max | owner | belongs to |
|---|---|---|---|
| `review/lib/run-cold-review-stage.mjs` (`:170`) | axis-branch / 2 | #833 | #1129 (the headline branch) |
| `harness/codex-readiness.mjs` | axis-branch / 1 (`:43`), spawn-concrete:codex / 2 (`:83,90,99`) | #833 | #1129 (readiness verb) |
| `harness/gemini-readiness.mjs` | adapter-import / 1 (`:11`), axis-branch / 1 (`:19`) | #833 | #1129 |
| `brain-promote.mjs` | adapter-import / 1 (`:49`, antigravity `compileAgentsMd`) | #1114 ("no owning ticket yet") | #1128 (platform "compile the instructions file" verb) |
| `roles/first-party/project-role.mjs` | axis-branch / 1 (`:43`) | #1114 ("no owning ticket yet") | #1128 (role materialisation verb) |
Not ours: `day-start.mjs` gentle-ai spawns (#1114 engine lifecycle), all `#1107` (VCS), `#1349/#1352` (memory), `legitimate` entries. Total in scope: 5 files, 7 entries (5 for #1129, 2 for #1128). Phase-2 exit ("no unexplained entries") means both `#1114` platform owners must be re-owned or deleted.

NOT caught by the guard (it scans `.mjs` in `brain/scripts/**` only, string literals masked):
- `bootstrap.sh:402,413` (shell): `for tool in ... claude`, and the named `harness/codex-readiness.mjs --check` call. A new engine needs a new bootstrap block today.
- `lib/axis-config.mjs:31-32,48-54`: closed memberships + the capability table (config-validation tier, inside the leaf that cannot import adapters).
- `roles/first-party/project-role.mjs:24` `PROJECTION_PLATFORMS` (a second closed list, cited as `@param {'claude'|'antigravity'}`).
- `axes/lib/agent-runtime.mjs:274` hint text `<claude|antigravity|plain>`; `lib/init.mjs:133` help text; `lib/axis-migration-context.mjs:21` `DEFAULT_PLATFORM='claude'` (a code default, legacy-migration context); `lib/hermetic-box.mjs:20` (`claude`,`codex` in an ABSENT set).
- `axes/layout.test.mjs:38-44` and the guard's `adapterNames` read dirs: adding an adapter edits `EXPECTED_ADAPTERS`.
- Error strings in the runner hardcode "Codex" for gemini too (`run-cold-review-stage.mjs:~412,~419`, "the Codex final message could not be ...") — a user-visible defect on the gemini path.
- `.${routing.engine}-final-...tmp` temp name (`:174`) is data, not a branch.

## 4. Parity test and scaffold fixture

### What a claude vs antigravity parity test can assert (same body, parameterised, like `axes/vcs/contract.test.mjs` and `axes/sdd-engine/contract.test.mjs`)
1. Module exports: `init` function and an `AGENT_RUNTIME` export present (`Object.hasOwn`), `null` or a well-formed descriptor.
2. `dispatch(name,'init',[opts])` through the real `cli.mjs` resolves (precedent: `antigravity.test.mjs:283,308`).
3. init emits ONLY declared paths (to be exported as e.g. `EMIT_PATHS`) and the hooks payload is `compileSettingsHooksJson()` byte-identical in the settings file of each.
4. Idempotent: run twice -> byte-identical; consumer key + custom hook survive; malformed existing settings -> not overwritten, failure reported (REQ-1139 cases exist per-platform in `claude.test.mjs:45-114` and `antigravity.test.mjs:340-425`; the parity test collapses them into one body).
5. Failure contract: a normalised `{ok:false}`-or-absent rule (today differs, see s2).
6. Capability agreement: declared capabilities match what the adapter exports (`executeStage:true` iff `runStage` exported; `orchestrate` iff `init` exported) — the first test that would have caught the seam being separate from the adapter.
7. Role materialisation: `projectRole`-equivalent verb yields a path under the declared emit set for each platform.
Keep per-platform goldens: `antigravity.drift.test.mjs` (182 lines) stays as the platform-specific byte golden; the parity test does not replace it.
Cannot assert: `AGENT_RUNTIME` live probe results (host-dependent; use injected `_run`), and quality of AGENTS.md prose.

### Engine parity (claude, codex, gemini) — #1129
Table-driven `runStage` conformance with injected `_run`/`_env`/`_now`: (a) refuses no prompt, (b) refuses an unroutable lifecycle stage without `routed` (`assertRoutableStage`), (c) env passed to the spawn has every `credentialEnvNames()` var removed and `forgeConfigDir` applied AFTER the scrub, (d) spawnError/ETIMEDOUT/non-zero -> `{ok:false, reason}` with elapsedMs, (e) redaction: a secret in stderr never reaches `reason` (this FAILS for claude today), (f) declared output mode honoured (`file` -> artifact exists; `final-message` -> `tempPath` exists), (g) readiness verb returns `{ready, diagnostic}` and never spawns the engine when not required.

### Scaffold fixture for a third platform / engine
Acceptance "one adapter + configuration". Today a third platform touches: the adapter file; `AGENT_PLATFORMS` and `PLATFORM_CAPABILITIES` (`lib/axis-config.mjs`); `PROJECTION_PLATFORMS` + a branch in `project-role.mjs`; `EXPECTED_ADAPTERS` in `layout.test.mjs`; the hint strings; and the guard's value sets. The fixture must show exactly one adapter file (plus its capability leaf) + a `brain.config.json` fragment (`platform.providers.<x>`, `platform.default: <x>`) and NOTHING else changing. Mechanics: a fixture adapter under `axes/platform/adapters/__fixtures__/` (or a temp dir via an injectable adapter directory — `harnessAdapterDir` is currently hardwired to `import.meta.url`, so injectability is a prerequisite) run through the same parity body, and `validateAxisConfig` accepting a config naming it. The same pattern for a fourth engine: one adapter + `sdd.map`/`sdd.roles` entry, runner untouched (assert by running `runColdReviewStage` with the fixture engine).

## 5. Doctrine

- New contract docs go in `brain/core/methodology/` -> agents cannot write there; draft in `openspec/changes/issue-1128-platform-and-engine-contracts/brain-drafts/`, maintainer promotes with `brain:promote`: `agent-platform-contract.md` (#1128) and `cold-review-engine-contract.md` (#1129). Precedent shape: `vcs-contract.md` (132 lines, "Required verbs / Normalization rules / How to add a provider / Current implementation") and `memory-backend-contract.md` (202 lines, verbs + rules + agnosticism test). Also add both to the `AGENTS.md`/`brain/HOME.md` Methodology list (HOME.md edit = `decision-gate` cascade only if an ADR is added).
- ADR-0038 s5 explicitly delegates "the rest of the capability vocabulary and where it is checked" to #1128/#1129 and says each capability is declared in the adapter. A one-axis ruling plus a new capability vocabulary (output modes, readiness, executeStage, orchestrate, emit surfaces) is a decision, so: **new ADR-0041** (or next free number; check the open drafts in `issue-1263-config-ownership/brain-drafts/` first) "Agent runtime adapters declare capabilities; the runner and validator read them", OR an ADR-0038 Amendment 2. It supersedes nothing.
- Amendments (in place, with the "what does NOT change" block): ADR-0024 (the "capability table is a seam, #1128 and #1129 move it" line at `adr-0024-three-axis-decoupling.md:308` and the "two directories" line), ADR-0033 (the "branches on codex/gemini by name ... dropping the name branch is #1129" line at `adr-0033-cold-review-transport.md:412-415`), ADR-0038 (the "What does NOT close" bullets). The in-flight `issue-1263` drafts (`adr-0024-amendment-5`, `adr-0033-amendment-3`) already carry those same sentences: sequence after them or the amendment numbers collide. ADR-0023 (role port) only if role materialisation becomes a platform verb.
- Related allowlist doc: no allowlist edit needs an ADR.

## 6. One change or two?

Shared machinery (the reason to keep them one change): the capability descriptor and its home (`PLATFORM_CAPABILITIES` serves both), the adapter registry that replaces the three-directory name search in `harnessAdapterUrl`, the `runStage` conformance base, and ADR-0038 s5 being ONE axis. Different work: platform = `init`/emit/roles; engine = `runStage`/output mode/readiness.

Recommendation: ONE change/branch (`issue-1128-platform-and-engine-contracts`, closes #1128 and #1129), TWO PRs stacked on the same issue branch order. Estimated GATED diff (excl. `*.test.mjs`, `.memory`, `openspec/changes`; budget 1000 at lite; promoted docs count):
| slice | content | gated est. |
|---|---|---|
| S1 capability seam | per-adapter capability declaration (leaf side-files, precedent `gentle-ai.roles.mjs`, so `axis-config.mjs` stays cycle-free), `axis-config` reads the registry, `AGENT_PLATFORMS` derived, scaffold-fixture injectability in `harness-adapter-url.mjs` | ~120 |
| S2 engine contract (#1129) | engine descriptor (`outputMode`, `readiness`, `model` policy), runner reads it (drops `:170`, fixes the "Codex" strings), generic readiness verb replaces codex/gemini-readiness files (net ~ +60 after deleting ~250), bootstrap.sh calls the generic verb, shared `tail`/`validateOutput` helper, redaction parity for claude, delete 5 allowlist entries | ~350 |
| S3 platform contract (#1128) | `init` return normalisation, role-materialisation + instructions-compile as adapter verbs (removes `brain-promote` import and `project-role` branch), delete 2 allowlist entries | ~200 |
| S4 docs | 2 contract drafts + ADR + 3 amendments (in `brain-drafts/`, ~0 gated until promoted; ~500 lines when promoted, in a separate maintainer PR) | 0 / ~500 |
Tests (parity bodies, scaffold fixtures, drift) are excluded. Total code ~670 gated, under 1000; the promotion PR is the maintainer's.

## 7. Approaches, recommendation, maintainer decisions

### Approaches
A. **Descriptor exports in each adapter + registry** (recommended). Each adapter exports `CAPABILITIES`/`ENGINE` (or a `.capabilities.mjs` leaf for cycle-free reads). The runner/validator/bootstrap read the descriptor. Pro: matches ADR-0038 s5 ("declared in its adapter"), makes the guard entries deletable, scaffold = one file. Con: `axis-config.mjs` is a leaf imported by `platform.mjs` which adapters import (ESM cycle, the documented #682 deadlock `harness/platform.mjs:1-45`) so reads must be via side-files or lazy.
B. **Keep tables central, add parity tests only**. Pro: tiny. Con: the scaffold acceptance fails (third platform still edits `axis-config`), allowlist entries remain.
C. **Manifest per adapter (JSON)** read statically by validator, code by runner. Pro: no cycle. Con: a second declaration language beside the `.mjs` exports; drift risk.
D. **Merge `review-engine/` into `platform/`** (codex/gemini become platform adapters, `orchestrate:false`). Pro: matches the config's one axis, kills the dual-axis re-export files and the lookup-order hack. Con: larger move (~10 files), churn in `layout.test.mjs`, guard `AXIS_DIRS`, the guard's `adapterNames('platform')` would then include engine-only members that `AGENT_PLATFORMS` must stay consistent with.

Recommendation: A for S1-S3, defer D unless the maintainer wants the single directory now; A makes D a mechanical follow-up.

### Maintainer decisions (product forks, NOT decided here)
1. One change (closes both) with stacked slices, or two separate issues/branches?
2. Merge `review-engine/` into `platform/` now (D), or keep two directories and let the descriptor bridge them (ADR-0038 says "until a slice moves them")?
3. Where do capabilities live: adapter export (A) vs per-adapter manifest (C)? And may `axis-config.mjs` remain the validator while reading a registry, given the cycle constraint?
4. Capability vocabulary: only `orchestrate`/`executeStage` plus engine output mode and readiness, or also `emitsSessionHooks`, `rolesProjection`, `emitPaths` now?
5. Engine output mode: keep two (`file`, `final-message`) and let each engine declare one, or make `final-message` the single contract (claude adopts it)? (Claude writing the file itself is the odd one out.)
6. Redaction/`tail` policy: pin codex's (full-text redact, strip control bytes, 4 KiB cap) as the contract and make claude and gemini conform (a behaviour change on claude)?
7. Model policy: engines declare a pinned model (codex) vs opaque (claude) vs default+remap (gemini) — should the contract forbid a pinned model, require it declared, or leave it per engine?
8. Quota/rate-limit: add a distinct engine result state (`{ok:false, kind:'quota'}`) now, or leave it to a later issue?
9. `gemini-readiness.mjs` has no caller: wire it into bootstrap (via the generic readiness verb) or delete it?
10. Must `init` return shape be unified (`{ok}` on every platform) in this change, or documented as is?
11. ADR vehicle: a new ADR vs ADR-0038 Amendment 2 (and number sequencing with the pending `issue-1263` drafts).
12. Re-own the two `#1114` "no owning ticket yet" platform allowlist entries (`brain-promote`, `project-role`) to #1128 so Phase 2's exit check is satisfiable?
13. Is the third-platform scaffold fixture a TEST fixture only (temp dir), or a shipped `brain:scaffold-platform` generator?
