# ADR-0038 Amendment 2: the capability vocabulary is declared in each runtime's descriptor, and the runner reads it (issues #1128, #1129)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1128-platform-and-engine-contracts/brain-drafts/adr-0038-amendment-2.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028). Promote it in the same PR as the two new contract docs
> (README, steps 1-3): this amendment cites them, and their `brain/HOME.md` entries need an ADR in the
> diff to pass `decision-gate`.

```brain-amendment/1
target: brain/project/decisions/adr-0038-one-config-shape-per-axis-default-and-providers.md
amendment: 2
issue: 1128
home-summary: §5's capability vocabulary is delivered — every `platform` provider declares `orchestrate`, `executeStage`, its stage output mode (`file` or `final-message`), its model policy (`opaque`, `pinned`, `default`) and readiness in an import-free `<name>.descriptor.mjs`; one registry discovers them, `PLATFORM_CAPABILITIES` and `AGENT_PLATFORMS` are derived from it, the cold-review runner reads the output mode instead of branching on engine names, and the two contracts are agent-platform-contract.md and review-engine-contract.md; the two adapter directories stay unmerged, #1128, #1129
body: ## Amendment 2 — the capability vocabulary is declared in each runtime's descriptor, and the runner reads it (issues #1128, #1129)
body-end: ### Notes for the promoter
```

```amend-find
belongs to #1129 and #1128.
```

```amend-replace
belongs to #1129 and #1128. **[Amended by Amendment 2 (#1128, #1129): delivered. Each provider declares `orchestrate`, `executeStage`, a stage output mode, a model policy and readiness in its `<name>.descriptor.mjs`, read by one registry; see `agent-platform-contract.md` and `review-engine-contract.md`.]**
```

```amend-find
| `antigravity` | yes | not until a stage-runtime adapter exists (#1128, #1129) | `platform.default` |
```

```amend-replace
| `antigravity` | yes | not until a stage-runtime adapter exists (#1128, #1129) **[Amended by Amendment 2: still none; its descriptor declares `executeStage: false`]** | `platform.default` |
```

```amend-find
  the runtime. The runner can stop branching on runtime names (#1129).
```

```amend-replace
  the runtime. The runner can stop branching on runtime names (#1129). **[Amended by Amendment 2: it has — it reads the engine's declared output mode.]**
```

```amend-find
  vocabulary, and where capabilities beyond these two are checked, belong to #1129 and #1128.
```

```amend-replace
  vocabulary, and where capabilities beyond these two are checked, belong to #1129 and #1128.
  **[Amended by Amendment 2 (#1128, #1129): the declaration is the adapter's `<name>.descriptor.mjs`; the output mode is checked by the cold-review runner, readiness by `harness/readiness.mjs`, and the model policy by the engine and the readiness route check. The directories are still not merged.]**
```

## Amendment 2 — the capability vocabulary is declared in each runtime's descriptor, and the runner reads it (issues #1128, #1129)

**Signed**: DD/MM/YYYY — <Name>

### What changed

Section 5 named two capabilities and left "the rest of the capability vocabulary, and where it is
checked" to #1128 and #1129. Both are delivered:

- **Each provider declares itself in a leaf.** `<name>.descriptor.mjs`, beside the adapter in
  `axes/platform/adapters/` or `axes/review-engine/adapters/`, exports a frozen `DESCRIPTOR`:
  `capabilities: { orchestrate, executeStage }`; for a stage runtime,
  `stage: { outputMode: 'file' | 'final-message', model: { policy: 'opaque' | 'pinned' | 'default', id? } }`;
  and `readiness`. It imports nothing, so the validator can read it without loading the adapter.
- **One registry, no list.** `axes/lib/runtime-registry.mjs` discovers the descriptors in the two
  directories and refuses a malformed, duplicate or missing one. `PLATFORM_CAPABILITIES` and
  `AGENT_PLATFORMS` in `lib/axis-config.mjs` are derived from it. A third platform or engine is one
  adapter, one descriptor and configuration, and a temp-dir scaffold test proves it.
- **The checks this section requires read the descriptor.** `validateAxisConfig` reads it for
  `platform.default` (`orchestrate`) and `sdd.roles.<stage>.engine` (`executeStage`). The cold-review
  runner refuses, before any mutation, an engine that does not declare `executeStage`, and takes the
  output mode from the descriptor instead of comparing `routing.engine` to `codex` and `gemini`.
  `harness/readiness.mjs` dispatches readiness through it.
- **Two contracts.** `brain/core/methodology/agent-platform-contract.md` (`init` returns
  `{ ok, … }`, merges, refuses what it cannot merge) and `review-engine-contract.md` (`runStage`, the
  two output modes, the one redaction rule for every engine, readiness). Each has a parity test over
  the registry.

### Why

The section said each capability is declared in the provider's adapter. The code kept them in one
table that its own comment called a seam, plus a closed list beside it and a name branch in the
runner. A fourth runtime meant editing the validator, the runner and the readiness scripts.

### What this does NOT change

The one `platform` axis, one orchestrator per session, the two capabilities' meaning and where they
are required, `plain` as the human orchestrator, and the refusal on a missing capability (never a
warning, never a fallback).

### What the code does not do yet, said plainly

- **The two directories are not merged.** One registry reads both. Moving the files is a mechanical
  follow-up.
- **Emit surfaces and role projection are not vocabulary.** `brain:promote` still imports
  antigravity's AGENTS.md compiler, and `project-role.mjs` still branches on `claude`. Both stay
  allowlisted.
- **No quota state.** An engine cannot yet report a usage limit as distinct from a failure.
- **The runner still reads `sdd.map`** (#1132).

### Notes for the promoter

Four in-place annotations: §5's "belongs to #1129 and #1128", the `antigravity` table row, the
Consequences bullet about the runner branching, and the "What this does NOT close" sentence about the
rest of the vocabulary. `main` carries Amendment 1 only (Status line: "Amendment 1 — see below"), so
this is number 2. Sources: #1128, #1129.
