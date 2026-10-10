# harness-contract.md — `day:start` updates nothing; `brain:tools:update` does (issue #1386)

> **Tier 2 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1386-day-start-no-global-upgrades/brain-drafts/harness-contract-day-start-updates-nothing.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/methodology/harness-contract.md
issue: 1386
body: ## `day:start` updates nothing (issue #1386)
body-end: ### Notes for the promoter
```

```amend-find
| `npm run brain:day:start` | `day:start` | — | Daily startup: VCS auth, ecosystem updates, team memory, ticket board. |
```

```amend-replace
| `npm run brain:day:start` | `day:start` | — | Daily startup: VCS auth, team memory, ticket board. **Updates nothing** (#1386): its ecosystem step only refreshes the local skill registry and prints a reminder of `brain:tools:update`. |
| `npm run brain:tools:update` | — | — | The ONLY verb that applies global tool updates: runs `gentle-ai update`, then `gentle-ai upgrade`, showing their output. Refuses under `CI` or without a TTY (exit non-zero, nothing applied): it must be run interactively. Becomes a subcommand of `brain:doctor` (#1130). |
```

```amend-find
`gentle-ai` implements this contract. Claude skills are installed with
`gentle-ai install` and maintained with `gentle-ai upgrade`.
```

```amend-replace
`gentle-ai` implements this contract. Claude skills are installed with
`gentle-ai install` and maintained with `gentle-ai upgrade`, which a human runs through
`npm run brain:tools:update` (#1386).
```

## `day:start` updates nothing (issue #1386)

**Signed**: DD/MM/YYYY — <Name>

### What changed

The `brain:day:start` row said "ecosystem updates", which read as "check" and was implemented as
"apply": step 3 ran `gentle-ai upgrade` unconditionally. The row now says the verb updates
nothing, and a new row names `brain:tools:update`, the dedicated verb that applies tool updates.

### Why

A global tool is machine-wide. A `day:start` run inside a throwaway consumer upgraded the
machine's `engram` from 2.0.0 to 3.2.1 and so changed every repository on it, including a live
MCP (#1386, found by the 1.13.0 exit run). That is the class
`brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md` names.

### What this does NOT change

`day:start` keeps its step count and still runs `gentle-ai skill-registry refresh`, a local
write. `env:init` and `tools:install` are not changed here. They install a missing tool, and when `gentle-ai doctor`
reports an unhealthy state they also run `gentle-ai install` on an installed gentle-ai
(`install-tools.sh:175-181`, and `gentle-ai.mjs:215` under a TTY). Whether that re-fetches newer
binaries is not established here; #1394 owns verifying it.

### Notes for the promoter

Two in-place edits: the `brain:day:start` row (plus the new verb row) and the "Current
implementation" sentence. The managed script key `brain:tools:update` ships in the same change.
