# ADR-0024 Amendment 6: the platform capability table and membership are derived from each adapter's descriptor (issues #1128, #1129)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1128-platform-and-engine-contracts/brain-drafts/adr-0024-amendment-6.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0024-three-axis-decoupling.md
amendment: 6
issue: 1128
home-summary: `PLATFORM_CAPABILITIES` and the `AGENT_PLATFORM` membership are no longer tables in `axis-config.mjs` — both are derived from each provider's `<name>.descriptor.mjs` through one registry (ADR-0038 Amendment 2), so a platform is one adapter plus configuration; the cold-review runner no longer branches on `codex`/`gemini` by name, #1128, #1129
body: ## Amendment 6 — the platform capability table and membership are derived from each adapter's descriptor (issues #1128, #1129)
body-end: ### Notes for the promoter
```

```amend-find
each have a capability entry in `PLATFORM_CAPABILITIES`
```

```amend-replace
each have a capability entry in `PLATFORM_CAPABILITIES` **[Amended by Amendment 6 (#1128, #1129): the table is derived from each provider's `<name>.descriptor.mjs`]**
```

```amend-find
ships a workspace adapter for (`claude`, `antigravity`, `plain`)
```

```amend-replace
ships a workspace adapter for (`claude`, `antigravity`, `plain`) **[Amended by Amendment 6: the membership is derived, the providers whose descriptor declares `orchestrate`]**
```

```amend-find
  adapter. #1128 and #1129 move it.
```

```amend-replace
  adapter. #1128 and #1129 move it. **[Amended by Amendment 6: moved — each adapter's descriptor declares it, and `axis-config.mjs` derives the table.]**
```

```amend-find
(`resolveStageEngine`) and branches on `codex`/`gemini` by name
```

```amend-replace
(`resolveStageEngine`) and branches on `codex`/`gemini` by name **[Amended by Amendment 6 (#1129): the name branch is gone; the runner reads the engine's declared output mode]**
```

## Amendment 6 — the platform capability table and membership are derived from each adapter's descriptor (issues #1128, #1129)

**Signed**: DD/MM/YYYY — <Name>

### What changed

Amendment 5 recorded two seams on the platform axis: `PLATFORM_CAPABILITIES` lived in
`lib/axis-config.mjs` and not in each adapter, and `AGENT_PLATFORM` was checked against a closed list
in the same file. Both are now derived:

- Each provider declares `orchestrate` and `executeStage` in an import-free `<name>.descriptor.mjs`
  beside its adapter (ADR-0038 Amendment 2, `agent-platform-contract.md`).
- `axes/lib/runtime-registry.mjs` discovers the descriptors. `PLATFORM_CAPABILITIES` is its
  `capabilities`, and `AGENT_PLATFORMS` is its `orchestrators`, the providers that may be
  `AGENT_PLATFORM` / `platform.default`.
- A platform's `init` answers `{ ok, … }` on every provider, so `harness/cli.mjs init` fails on a
  refusal from any of them, antigravity included.
- The cold-review runner reads the engine's declared output mode instead of branching on `codex` and
  `gemini` by name.

### Why

A third platform had to edit the validator's table, the membership list, and the tests that pinned
them. The axis rule (callers use the axis, never a concrete implementation) held for the callers but
not for the validator.

### What this does NOT change

The four config axes and their shape, `AGENT_PLATFORM` selecting only the orchestrator,
`AGENT_PLATFORM=codex` refused, no `claude` default, and `SDD_ENGINE` as a closed list (`SDD_ENGINES`
is not derived).

### What the code does not do yet, said plainly

- **The runtime adapters are still two directories.** One registry reads both. Merging them is a
  follow-up.
- **Nothing routes by `sdd.roles` yet** (#1132). The runner still resolves through `sdd.map`.

### Notes for the promoter

Four in-place annotations in Amendment 5: the `PLATFORM_CAPABILITIES` entry, the `AGENT_PLATFORM`
membership, the "capability table is a seam" bullet, and the runner's name branch. Amendment 5 is the
latest today, so this is number 6. Promote it after `adr-0038-amendment-2.draft.md`, which it cites.
Sources: #1128, #1129.
