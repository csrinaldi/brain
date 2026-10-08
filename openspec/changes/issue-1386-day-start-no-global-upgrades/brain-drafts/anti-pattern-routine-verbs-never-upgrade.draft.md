# instaladores-autoactualizantes-no-inocuos.md — a routine verb never applies an upgrade (issue #1386)

> **Tier 2 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1386-day-start-no-global-upgrades/brain-drafts/anti-pattern-routine-verbs-never-upgrade.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md
issue: 1386
body: ## A routine verb never applies an upgrade (issue #1386)
body-end: ### Notes for the promoter
```

```amend-find
- Watch out for the exit code of doctor commands:
```

```amend-replace
- A routine verb (`day:start`, `session:start`, `env:init`) never applies an upgrade of a global
  tool. Upgrades run only from a dedicated, interactive verb (`brain:tools:update`) that refuses
  under CI and without a TTY. See the section at the end of this file.
- Watch out for the exit code of doctor commands:
```

## A routine verb never applies an upgrade (issue #1386)

**Signed**: DD/MM/YYYY — <Name>

### Second symptom

The same class, reached by a verb that ran on purpose: `day:start` step 3 ran `gentle-ai upgrade`
every day with no condition. Run inside a scratch consumer, it upgraded the machine's `engram`
(2.0.0 to 3.2.1) and so every repository on the machine, live MCP included.

### Rule

A global tool is machine-wide; a repository is not. A verb a person or an agent runs routinely, in
any repository, never applies an upgrade, and never runs a subcommand that is not known to be
read-only (`gentle-ai update` is treated as mutating). It may print a reminder naming the command.
Upgrades run only from a dedicated verb that is interactive: it refuses under `CI` and without a
TTY, and says why.

### What the code does not do yet, said plainly

`env:init` may not comply. When `gentle-ai doctor` reports an unhealthy state, it runs
`gentle-ai install` on an installed gentle-ai (`install-tools.sh:175-181`; `gentle-ai.mjs:215`
under a TTY). Whether that re-fetches newer binaries is not established. #1394 verifies it, and
moves the step behind `brain:tools:update` if it does.

### Notes for the promoter

One in-place bullet in "Solution / correct pattern", plus the appended section.
