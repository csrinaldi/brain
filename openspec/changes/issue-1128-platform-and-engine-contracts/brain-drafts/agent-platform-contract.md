# Agent Platform Contract

> **status:** current | **last-reviewed:** 2026-10-06 | **owner:** @crinaldi

> **Purpose:** defines what an agent-platform adapter must declare and implement so that brain can
> run a workspace on Claude Code, Antigravity, a human, or a platform not written yet, without
> editing the validator or the dispatcher. Referenced by ADR-0024 (the platform axis) and ADR-0038
> §5 (one `platform` config axis, capabilities declared by each provider). Sibling of
> `vcs-contract.md`, `memory-backend-contract.md` and `review-engine-contract.md`.

> **Promotion note (agent-drafted).** `brain/core/**` is Tier 2. This file is a draft under
> `openspec/changes/issue-1128-platform-and-engine-contracts/brain-drafts/`. It is a NEW methodology
> document, so neither of `brain:promote`'s shapes (new ADR, in-place amendment) applies. The
> maintainer copies it to `brain/core/methodology/agent-platform-contract.md`, adds the
> `brain/HOME.md` Methodology entry beside `vcs-contract.md`, and signs with the commit. It must land
> in the same PR as `adr-0038-amendment-2.draft.md`. That draft cites this file, and `decision-gate`
> fails a `brain/HOME.md` edit that touches no ADR. See the README's promotion order. Delete this
> note on promotion.

The orchestrator is `platform.default` in `brain.config.json` (ADR-0038 §5). It can be overridden
per machine by `AGENT_PLATFORM`, through the one resolver `resolveAxis`
(`brain/scripts/lib/axis-config.mjs`). The dispatcher `brain/scripts/harness/cli.mjs` loads
`brain/scripts/axes/platform/adapters/<name>.mjs` and calls the op by name.

---

## The descriptor

Every platform provider declares what it can do in **`<name>.descriptor.mjs`**, beside its adapter.
The file is a leaf: it has no `import`, no `export … from` and no top-level `await`. That lets the
validator read it without loading the adapter's graph (the #682 cycle rule).

```js
export const DESCRIPTOR = Object.freeze({
  name: 'claude',                                            // = the basename
  rank: 1,                                                   // optional: order of AGENT_PLATFORMS
  capabilities: Object.freeze({ orchestrate: true, executeStage: true }),
  stage: Object.freeze({ outputMode: 'file', model: Object.freeze({ policy: 'opaque' }) }), // iff executeStage
  readiness: false,
});
```

| Field | Meaning | Who reads it |
|---|---|---|
| `capabilities.orchestrate` | may be `platform.default`, the one orchestrator per session | `validateAxisConfig`, `resolveAxis` |
| `capabilities.executeStage` | may be an `sdd.roles.<stage>.engine`. When true, the provider is also a review engine and `stage` is governed by `review-engine-contract.md` | `validateAxisConfig`, the cold-review runner |
| `rank` | optional number; orders the derived `AGENT_PLATFORMS` (lower first, then by name), so claude stays first (ADR-0024 Amendment 2) | the registry |
| `stage`, `readiness` | see `review-engine-contract.md` | the runner, `harness/readiness.mjs` |

**The registry** (`brain/scripts/axes/lib/runtime-registry.mjs`) discovers descriptors by listing
`axes/platform/adapters/` and `axes/review-engine/adapters/`. It keeps no list of names.
`AGENT_PLATFORMS` (the platforms `AGENT_PLATFORM` may name) is its `orchestrators`, and
`PLATFORM_CAPABILITIES` is its `capabilities`. Both are derived, never typed. The registry refuses to
load on a malformed descriptor, a duplicate name, a name that differs from its basename, or an
adapter with no descriptor. A missing capability is never a warning and never a fallback (ADR-0038).

The vocabulary is deliberately small: `orchestrate`, `executeStage`, the output mode, the model
policy and readiness. Emit surfaces (which files a platform writes) and role projection are not
vocabulary yet. See "What this does NOT close".

## Required exports

| Export | Signature | Contract |
|---|---|---|
| `init` | `(opts?) -> Promise<{ ok: boolean, reason?: string, … }>` | Emits the platform's workspace files at the repo root. **Idempotent:** a second run changes no byte. **Merges, never overwrites:** a consumer's keys and custom hooks in a file it writes survive (#1139). **Refuses a file it cannot merge:** existing malformed JSON leaves the file byte-identical and returns `ok: false` with a `reason` that names the path. `ok: false` is also returned when a write throws. `init` never throws. Additive fields are allowed (antigravity reports `missingDocs`, `agentsWritten`, `geminiWritten`). |
| `AGENT_RUNTIME` | own export: `null`, or `{ name, bin, versionArgs, latest?, updateHint? }` | The runtime binary `brain:day:start` probes and reports, notify-only. `null` means "nothing to check" (`plain`, `antigravity`). A missing export is `seam-missing`, a different fact (`axes/lib/agent-runtime.mjs`). |
| `runStage` | see `review-engine-contract.md` | Required iff `executeStage`. |

`init`'s settings payload is the platform-neutral `compileSettingsHooksJson()`
(`axes/platform/lib/settings-hooks.mjs`), merged with the shared `mergeSettings` core
(`lib/installer.mjs`). A platform owns only WHERE it writes, not WHAT the hooks are (#315).

`harness/cli.mjs init` exits non-zero when any answer is `ok: false`, and `bootstrap.sh` records that
as a required failure.

## Conformance

`brain/scripts/axes/platform/contract.test.mjs` runs ONE body over every orchestrator in the
registry: the exports, `ok` on an empty root, idempotence, consumer-key survival and the
malformed-file refusal for every JSON file the first run wrote, capability agreement
(`orchestrate` ⇒ `init`; `executeStage` ⇒ `runStage` and `stage`), and the same answer through the
real dispatcher. The written-file set is observed from the tree. Per-platform byte goldens
(`antigravity.drift.test.mjs`) stay beside it.

## How to add a platform

1. Write `axes/platform/adapters/<name>.mjs` (`init`, `AGENT_RUNTIME`) and
   `<name>.descriptor.mjs` (`orchestrate: true`).
2. Declare it: `npm run brain:config -- set platform.default <name>`, which also creates
   `platform.providers.<name>`.
3. Run the parity suite. Nothing else changes: not `axis-config.mjs`, not the dispatcher, not the
   layout test. `axes/runtime-scaffold.test.mjs` proves this with a temp-dir platform.

## Current implementation

| Provider | `orchestrate` | `executeStage` | `init` writes | `AGENT_RUNTIME` |
|---|---|---|---|---|
| `claude` | yes | yes | `.claude/settings.json` | `claude --version` |
| `antigravity` | yes | no | `AGENTS.md`, `.gemini/settings.json` | `null` |
| `plain` (human) | yes | no | nothing (prints the manual flow) | `null` |

## What this does NOT close, said plainly

- **Emit surfaces and role projection are not contract verbs.** `brain:promote` still imports
  antigravity's `compileAgentsMd` to regenerate `AGENTS.md`, and
  `roles/first-party/project-role.mjs` still branches on `claude` and keeps its own
  `PROJECTION_PLATFORMS`. Both are allowlisted guard entries owned by #1367 until the follow-up that
  adds the vocabulary.
- **The two runtime directories are not merged.** `axes/platform/adapters/` and
  `axes/review-engine/adapters/` are one config axis read by one registry. Moving the files is a
  mechanical follow-up.
- **Hint and help text** that lists platforms (`axes/lib/agent-runtime.mjs`, `lib/init.mjs`) and
  `bootstrap.sh`'s tool loop are not derived from the registry.
