# Self-updating installers are not innocuous

- **Discovered in:** ISSUE-6 / environment bootstrap (`brain:env:init`, formerly `env:init`)
- **Applies to:** any ecosystem tooling with an `install`/`upgrade` subcommand (gentle-ai, and any CLI that manages itself)

## Symptom

`gentle-ai install --help` is run expecting to see the subcommand help. Instead,
the command triggers the REAL installation flow: creates a backup, self-updates
via brew (1.33.2 → 1.37.2), restarts itself, and only then fails with
`Error: flag: help requested`. The system was modified by a command that was
assumed to be read-only.

## Cause

Self-managed CLIs typically intercept the subcommand BEFORE parsing flags:
the auto-update runs as a prologue to `install` regardless of what flags follow.
The convention "`--help` never has side effects" is just that — a convention, not
a guarantee.

## Solution / correct pattern

- To inspect capabilities: use the read-only diagnostic command
  (`gentle-ai doctor`, `gentle-ai config`, `<tool> version`) or GLOBAL help
  (`gentle-ai --help`), never `<mutating-subcommand> --help`.
- In bootstrap scripts: invoke `install` only deliberately, behind an idempotency
  guard based on a read-only diagnostic. Real example in
  `scripts/bootstrap.sh`:

  ```bash
  if gentle-ai doctor 2>/dev/null | grep -q 'state file OK'; then
    ok "ecosystem already initialized"
  else
    gentle-ai install   # interactive and self-updating: inherited TTY, intentional
  fi
  ```

- A routine verb (`day:start`, `session:start`, `env:init`) never applies an upgrade of a global
  tool. Upgrades run only from a dedicated, interactive verb (`brain:tools:update`) that refuses
  under CI and without a TTY. See the section at the end of this file.
- Watch out for the exit code of doctor commands: `gentle-ai doctor` reports "unhealthy"
  due to ambient noise (duplicates in PATH, engram endpoint down). Grep for the specific
  line that matters; do not rely on the global exit code.

## A routine verb never applies an upgrade (issue #1386)

**Signed**: 07/10/2026 — Cristian Rinaldi

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
