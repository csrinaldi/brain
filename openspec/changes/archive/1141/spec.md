---
status: draft
issue: 1141
---

# Spec

## REQ-1141-1 — the three retired adapter directories do not exist

`brain/scripts/harness/backends/`, `brain/scripts/memory/backends/` and
`brain/scripts/vcs/providers/` MUST NOT exist in brain's tree.

**Falsifiable by:** `brain/scripts/axes/layout.test.mjs`, tests 1-3. RED before the move (all
three directories existed), GREEN after.

## REQ-1141-2 — each axis directory holds its adapters

`brain/scripts/axes/<axis>/adapters/` MUST exist for each axis and hold these modules:

| axis | adapters |
|---|---|
| `memory` | `engram.mjs`, `plainfiles.mjs` |
| `vcs` | `github.mjs`, `gitlab.mjs` |
| `platform` | `claude.mjs`, `antigravity.mjs`, `plain.mjs` |
| `sdd-engine` | `gentle-ai.mjs`, `plain.mjs` |
| `review-engine` | `claude.mjs`, `codex.mjs`, `gemini.mjs` |

**Falsifiable by:** `axes/layout.test.mjs`, tests 4-8. RED before the move, GREEN after.

## REQ-1141-3 — a dual-axis adapter has one physical module

`plain` and `claude` each serve two axes. Each MUST have exactly one module with logic. The
file in its other axis MUST contain only `export * from '<physical module>'`.

**Falsifiable by:** reading `axes/platform/adapters/plain.mjs` and
`axes/review-engine/adapters/claude.mjs`: any line other than one comment and the re-export
breaks this requirement.

## REQ-1141-4 — history follows every moved file

For each of the 53 moved files, `git log --follow -- <new path>` MUST list commits from
before the move.

**Falsifiable by:** the loop in tasks.md 2.6, which printed `checked 53 short 0`.

## REQ-1141-5 — no loader changes what a name resolves to

For every harness backend name (`claude`, `antigravity`, `plain`, `gentle-ai`, `codex`,
`gemini`), `harness/cli.mjs`'s dispatcher, `agent-runtime.mjs`'s platform probe and the role
port's `loadInhabitant` MUST load a module with the same exports as before the move.
`memory/cli.mjs` and `vcs/cli.mjs` MUST load the same memory and VCS adapters.

**Falsifiable by:** the full suite, with no test assertion edited except for the paths inside
it: `stage-seam.test.mjs`, `cli.test.mjs`, `agent-runtime.test.mjs`, `role-port.test.mjs`,
`vcs/cli.test.mjs` and the memory CLI tests drive the real loaders.

## REQ-1141-6 — the guards keep their meaning after the move

A guard whose subject moved MUST still scan that subject, not a path that is now empty:

- `engine-blind-gates.test.mjs` MUST count the harness axes (`axes/platform`,
  `axes/sdd-engine`, `axes/review-engine`, `axes/lib`) as "the engines' home", next to
  `harness/`.
- `ci-context-drift-guard.test.mjs` MUST refuse a direct import of an adapter from its new
  path.
- The directory-reading tests (`stage-seam`, `cli.test` cycle walk, `agent-runtime` registry,
  `settings-hooks` single-copy scan) MUST read the three harness axis directories.

**Falsifiable by:** adding `import { x } from '../axes/sdd-engine/adapters/plain.mjs';` to any
gate file turns `engine-blind-gates.test.mjs` red; before this change it would have stayed
green.

## REQ-1141-7 — an upgrade removes what the incoming package retired, and nothing else

`copyManaged` MUST remove from the consumer's tree each path in the incoming package's
`RETIRED_PATHS` that exists there as a file, unless the path is `local`, outside `managed`,
or shipped again by the incoming package. A consumer file in the same directory MUST survive.
A dry run MUST report the removal and remove nothing. A directory emptied by the removal MUST
be removed, and a directory that still holds anything MUST NOT.

**Falsifiable by:** `lib/installer.retired.test.mjs` (7 tests) and the CLI test in
`brain-upgrade.test.mjs` "a file the incoming package retired leaves the consumer". Six of the
unit tests and the CLI test were RED before the fix; the "consumer file survives" test passed
vacuously, because nothing was removed at all.

## REQ-1141-8 — `RETIRED_PATHS` names only paths brain no longer ships

Every entry MUST be absent from brain's tree and MUST sit under a managed COPY glob.

**Falsifiable by:** the last test in `lib/installer.retired.test.mjs`.

## REQ-1141-9 — a fresh consumer upgraded from 1.7.0 keeps no old-path file

A consumer with the published `@logikas/brain@1.7.0` copied in, upgraded to this branch's
packed tarball with `brain-upgrade.mjs --no-install`, MUST hold no brain file under
`harness/backends/`, `memory/backends/` or `vcs/providers/`. A consumer file under
`harness/backends/` MUST survive. `brain:env:init` MUST still exit 0.

**Falsifiable by:** the run recorded in tasks.md 3.5.
