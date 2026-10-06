# Proposal — #1128 + #1129: the agent-platform contract and the review-engine contract, declared by each adapter

## Problem

Phase 2 of #1121 asks for two contracts that do not exist yet. Both axes have adapters, and neither
has a written contract or a parity test. What each adapter can do is written somewhere else.

**The platform axis (#1128).**
- `PLATFORM_CAPABILITIES` (`brain/scripts/lib/axis-config.mjs:48-54`) holds every runtime's
  `orchestrate` / `executeStage` facts in a table. Its own comment says "THIS TABLE IS A SEAM ...
  #1128/#1129 move it". `AGENT_PLATFORMS` (`:32`) is a second closed list. Adding a third platform
  means editing both, the guard's value sets, and the tests that pin them.
- There is no parity test. `antigravity.drift.test.mjs` is a single-backend golden, and the
  REQ-1139 merge/idempotence cases are written twice (`claude.test.mjs:45-114`,
  `antigravity.test.mjs:340-425`).
- `init()` answers in two shapes. claude returns `undefined` or `{ok:false, reason}`
  (`axes/platform/adapters/claude.mjs:79`). antigravity returns
  `{missingDocs, agentsWritten, geminiWritten, geminiSettingsError?}` with no `ok`, even when it
  refused a malformed `.gemini/settings.json` (`antigravity.mjs:240-312`). `harness/cli.mjs:263-275`
  can only treat an explicit `{ok:false}` as a failure, so antigravity's refusal exits 0.
- The issue's "split the directory by axis" clause is already met (#1141, `axes/layout.test.mjs`).

**The review-engine axis (#1129).**
- The runner picks the output mode by engine name: `review/lib/run-cold-review-stage.mjs:170`
  (`routing.engine === 'codex' || routing.engine === 'gemini'`). A fourth engine means editing the
  runner.
- Readiness lives outside the adapters and branches by name too: `harness/codex-readiness.mjs:43`
  and `harness/gemini-readiness.mjs:19`. `gemini-readiness.mjs` has no production caller, and only
  codex is wired into `bootstrap.sh:413` and `install-tools.sh:142,151`.
- Redaction diverges three ways. codex redacts over the full text, strips control bytes and caps
  at 4 KiB (`codex.mjs:22-36`). gemini redacts but neither strips nor caps (`gemini.mjs:52-61`).
  claude does not redact at all (`claude.mjs:187-192`), and its non-zero-exit branch prints the
  first raw stderr line (`claude.mjs:292-298`).
- The helpers are duplicated: `validateOutput`, `canonicalPath` and `isWithin` exist in codex,
  gemini and (`isWithin`) the runner (`run-cold-review-stage.mjs:164`), and the copies disagree. The
  codex and runner copies of `isWithin` read a child named `..x` as outside its parent. `CODEX_MODEL`
  is declared twice (`codex.mjs:18`, `harness/codex-readiness.mjs:15`).
- On the gemini path the runner's own messages say "the Codex final message ..."
  (`run-cold-review-stage.mjs:418,422`).

The guard allowlist (`axes/axis-port.allowlist.mjs`) carries five `#833` entries for the engine
branches. It also carries two `#1114` platform entries whose reason says "no owning ticket yet".

## Maintainer rulings (ratified 2026-10-06, binding)

1. **One change, closing both issues,** delivered as ordered slices: S1 capabilities move into the
   adapters (descriptor), S2 the engine contract (#1129), S3 the platform contract (#1128), S4 the
   doctrine drafts. The two `#1114` platform allowlist entries (`brain-promote.mjs`,
   `roles/first-party/project-role.mjs`) are re-owned to #1128.
2. **Each adapter exports a DESCRIPTOR** (capabilities, output mode, readiness) from a cycle-free
   leaf file, on the pattern of `gentle-ai.roles.mjs`. A registry reads the descriptors. There is no
   JSON manifest. `review-engine/` and `platform/` stay separate directories, and merging them is a
   mechanical follow-up. `PLATFORM_CAPABILITIES` and `AGENT_PLATFORMS` are DERIVED from the
   descriptors, so a third platform does not edit `axis-config.mjs`.
3. **Minimal vocabulary now:** `orchestrate` / `executeStage`, the output mode, and readiness. Emit
   surfaces and role projection come later, in a follow-up.
4. **Engine contract.** Both output modes, `file` and `final-message`, are kept, and each adapter
   declares its own. That removes the name branch at `run-cold-review-stage.mjs:170`. Codex's
   redaction policy (redact, then strip control bytes, then cap at 4 KiB) becomes the contract for
   ALL engines, which fixes claude (no redaction) and gemini (no strip or cap). Each engine declares
   its model policy in its descriptor. A distinct quota state is a follow-up. The change also fixes
   the runner's user-visible "the Codex final message ..." strings on non-codex paths, and removes
   the duplicate `validateOutput`/`canonicalPath`/`isWithin` and the double `CODEX_MODEL`.
5. **gemini-readiness is wired into bootstrap** like codex-readiness, not deleted. Readiness is
   dispatched through the descriptor, which removes the #833 readiness name branches.
6. **`init` returns `{ok, ...}` on every platform** in this change, so the parity test can assert it.
7. **Doctrine:** ADR-0038 gets an amendment (its §5 delegates the capability vocabulary to these
   issues). Two NEW contract docs are drafted for `brain/core/methodology/`:
   `agent-platform-contract.md` and `review-engine-contract.md`. In-place amendment drafts cover
   ADR-0024 (~:308) and ADR-0033 (~:412), where they say otherwise.
8. **The scaffold fixture is test-only,** with no shipped generator. A third platform and a third
   engine each plug in with one adapter file plus config, and `axis-config.mjs`, `project-role.mjs`
   and the layout test stay unchanged. This requires an injectable `harnessAdapterDir`.

**Numbering correction (verified, not assumed).** Ruling 7's brief said ADR-0038 "already has 2
amendments on main". `main` at `4b847561` carries only Amendment 1, and its Status line reads
"amended 05/10/2026 (Amendment 1 ...)". The draft is therefore **ADR-0038 Amendment 2**.
`planAmendment()` refuses any other number. ADR-0024 is at Amendment 5, so this one is 6. ADR-0033
is at Amendment 3, so this one is 4.

## Scope

**S1 — descriptors and the registry (shared).**
- One `<name>.descriptor.mjs` leaf per runtime provider: `claude`, `antigravity`, `plain` under
  `axes/platform/adapters/`, and `codex`, `gemini` under `axes/review-engine/adapters/`. A leaf has
  no `import` statement.
- `axes/lib/runtime-registry.mjs` discovers descriptors in those two directories and validates them.
  It exposes `names`, `capabilities`, `orchestrators` and `descriptor(name)`. The directories are
  injectable.
- `lib/axis-config.mjs` derives `PLATFORM_CAPABILITIES` and `AGENT_PLATFORMS` from the registry.
  `validateAxisConfig` and `resolveAxis` accept an injected registry.
- `axes/lib/harness-adapter-url.mjs`: `harnessAdapterDir`/`harnessAdapterUrl` take an injectable
  base.
- Allowlist: the `brain-promote.mjs` and `project-role.mjs` entries are re-owned `#1114` → `#1128`
  (ruling 1).

**S2 — the review-engine contract (#1129).**
- Engine descriptors declare `stage.outputMode`, `stage.model` (policy) and `readiness`.
- The runner reads the output mode from the descriptor. It refuses, before any mutation, an engine
  that has no descriptor or does not declare `executeStage`. It names the routed engine in every
  message.
- `axes/lib/stage-output.mjs` holds the one redaction contract (`engineTail`), the one
  `validateFinalMessageOutput`, `canonicalPath` and `isWithin`. claude, codex, gemini and the runner
  use it.
- Readiness: `harness/codex-readiness.mjs` → `axes/review-engine/adapters/codex.readiness.mjs` and
  `harness/gemini-readiness.mjs` → `gemini.readiness.mjs` (moves). A generic `harness/readiness.mjs`
  dispatches through the descriptor. `bootstrap.sh` and `install-tools.sh` call the generic verb,
  which wires gemini.
- `CODEX_MODEL` has one source: the codex descriptor.
- Allowlist: the five `#833` entries are deleted.

**S3 — the agent-platform contract (#1128).**
- `init()` returns `{ok, ...}` on claude, antigravity and plain.
- A platform parity test runs the same body over every orchestrating provider. An engine parity test
  runs the same body over every stage runtime.
- Scaffold fixtures (test-only, temp dir): a third platform and a third engine, each one adapter plus
  descriptor plus config, with `axis-config.mjs`, `project-role.mjs`, the runner and the layout test
  untouched.

**S4 — doctrine drafts** in `brain-drafts/`: the two new contract docs, ADR-0038 Amendment 2,
ADR-0024 Amendment 6, ADR-0033 Amendment 4, and a README that gives the promotion order.

## Non-goals

- Merging `axes/review-engine/` into `axes/platform/` (ruling 2: a follow-up).
- Emit-surface (`emitPaths`, session hooks) and role-projection vocabulary (ruling 3). The
  `brain-promote.mjs` adapter import and the `project-role.mjs` claude branch therefore STAY, re-owned.
- A distinct quota / rate-limit engine result state (ruling 4).
- Routing through `sdd.roles` (#1132). The runner still reads `sdd.map`.
- Deriving `SDD_ENGINES` (the `sdd` axis's closed list): not ruled, and it stays a literal.
- The `init` shape of SDD engines (`gentle-ai`). `harness/cli.mjs` keeps reading `undefined` as success
  for them.
- A config-time check of a pinned model (`validateAxisConfig` reading `stage.model`). The adapter
  refuses at run time, as codex does today.
- Shell name mentions in `bootstrap.sh` (`for tool in ... claude`, `INSTALL_HINT[claude]`) and the
  codex install step in `install-tools.sh`. Installers may name tools, and the guard does not scan
  shell. Follow-up.
- Hint and help strings that list platforms (`axes/lib/agent-runtime.mjs:274`, `lib/init.mjs:133`).

## Follow-ups to file (maintainer)

1. **Merge `axes/review-engine/adapters/` into `axes/platform/adapters/`.** Mechanical once the
   registry reads descriptors: it touches the dual-axis re-export (`review-engine/adapters/claude.mjs`),
   `HARNESS_ADAPTER_AXES`, `layout.test.mjs`'s `EXPECTED_ADAPTERS` and the guard's `AXIS_DIRS`.
2. **Emit-surface and role-projection vocabulary** (`emitPaths`, session-hook emission, `projectRoles`).
   It retires the two allowlist entries this change re-owns to #1128 (`brain-promote.mjs`
   adapter-import, `project-role.mjs` axis-branch) and `PROJECTION_PLATFORMS`.
3. **A distinct engine quota state** (`{ok:false, kind:'quota'}`), so "engine exited" can say "usage
   limit".
4. **Shell name mentions:** `bootstrap.sh:400-402` (`claude` in the ecosystem loop and
   `INSTALL_HINT`) and `install-tools.sh`'s codex install block. Deriving them from the registry
   needs an install-hint field in the descriptor.
5. **Derived hint strings** (`agent-runtime.mjs:274`, `init.mjs:133`) read the registry's
   `orchestrators`.
6. (Optional, not ruled) `sdd-engine` descriptors, so that `SDD_ENGINES` is derived the same way.

## Behaviour changes a consumer can see

- **antigravity with a malformed `.gemini/settings.json`:** `harness/cli.mjs init` now exits 1, so
  bootstrap records "SDD harness init failed". claude already behaved this way. Before, it warned
  and exited 0.
- **claude engine failures** now carry a redacted, bounded ` — the engine last said: …` tail. Before,
  they carried the raw first stderr line.
- **A cold-review route to an engine that cannot execute a stage** (`plain`, `antigravity`,
  `gentle-ai`, an unknown name) is refused by the runner before any mutation, with a reason that
  names the engine. Before, the seam or the adapter refused it, after the artifact was cleared.
- **`bootstrap.sh`'s readiness line** is generic. A gemini route is now probed, where before it
  printed "Codex is not required".

## Change-dir completeness

`proposal.md`, `spec.md`, `design.md` and `tasks.md` (flat, per `sdd-layout.md`). `explore.md` is the
read-only exploration. `brain-drafts/` holds two new-document drafts, three `brain-amendment/1`
drafts, and a README with the promotion order.
