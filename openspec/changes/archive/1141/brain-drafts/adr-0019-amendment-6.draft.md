# ADR-0019 Amendment 6 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0019-amendment-6.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> The verb renders the plan, waits for the typed word, performs §1c's acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops. **Your commit
> is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0019-harness-port.md
amendment: 6
issue: 1141
home-summary: the gentle-ai backend and the two `memory/backends/engram.mjs` importer-list citations moved to `axes/sdd-engine/adapters/` and `axes/memory/adapters/`; the citations are annotated in place and the evidence contract is unchanged, #1141
body: ## Amendment 6 — the harness and memory backends moved under `axes/` (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
`brain/scripts/harness/backends/gentle-ai.mjs:74,221`
```

```amend-replace
`brain/scripts/axes/sdd-engine/adapters/gentle-ai.mjs:74,221` (under `brain/scripts/harness/backends/` until #1141; see Amendment 6)
```

```amend-find
`lib/stage-engine.mjs`, `memory/backends/engram.mjs`,
```

```amend-replace
`lib/stage-engine.mjs`, `memory/backends/engram.mjs` (now `axes/memory/adapters/engram.mjs`; moved by #1141, see Amendment 6),
```

```amend-find
`memory/backends/engram.mjs` and `new-change.mjs` import with double quotes
```

```amend-replace
`memory/backends/engram.mjs` (now `axes/memory/adapters/engram.mjs`; moved by #1141, see Amendment 6) and `new-change.mjs` import with double quotes
```

## Amendment 6 — the harness and memory backends moved under `axes/` (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

#1141 moved every backend adapter into one directory per axis, with `git mv`, so `git log
--follow` still reaches its history:

| as written above | the path today |
|---|---|
| `brain/scripts/harness/backends/gentle-ai.mjs` | `brain/scripts/axes/sdd-engine/adapters/gentle-ai.mjs` |
| `memory/backends/engram.mjs` (relative to `brain/scripts/`) | `axes/memory/adapters/engram.mjs` |

These citations sit inside the Evidence section and inside Amendments 3-4's own measured
importer lists — moving a file the lists already named does not change what was measured, so
the counts (eleven production importers, five test files) are untouched. Every citation above
is annotated in place under ruling R6 on #961 as amended (option A) — the maintainer applied
the same ruling to #1141's path moves on 2026-09-28. The four-surfaces decision and the
`sdd-layout.mjs` evidence contract are unchanged.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch.
