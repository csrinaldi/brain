---
status: draft
issue: 400
epic: 313
artifact_store: openspec
topic_key: sdd/issue-400-npx-brain-init/proposal
---

# Proposal: `npx brain init` — kill the manual package.json step (issue #400)

Issue #400. Epic #313 (**M4 — Distribution**, the adoption half of the hard gate).
Change folder: `openspec/changes/issue-400-npx-brain-init/`.

## Intent

First install requires a **hand-edit of the consumer's `package.json`** (README step 2)
before `brain:upgrade` can run at all. For an external adopter this is the first
impression, and it is the least polished step of the product. M4's exit is *"an external
team adopts and upgrades without risk of losing its work"* — #396–#401 secure **upgrades**;
nothing yet secures **adoption**.

## The measured root cause — a bootstrap paradox, not an oversight

`MANAGED_SCRIPT_KEYS` (`brain/core/managed-paths.mjs`) lists **9** verbs that
`brain:upgrade` merges into the consumer's `package.json` via `mergePackageJson`. It
deliberately does **not** include `brain:upgrade` itself:

> `brain:env:init` · `brain:day:start` · `brain:session:start` · `brain:ticket:start` ·
> `brain:project:feature` · `brain:project:status` · `brain:tracker:board` ·
> `brain:repo:check` · `brain:change:verify`

Injecting `brain:upgrade` there would be useless: the merge only runs **during** an
upgrade, and running one requires the alias to already exist. So exactly **one** alias is
structurally un-injectable, and the manual step exists to write it.

The repo's own fresh-install fixture encodes this (`test/fresh-install/in-container.sh:118`):
it hand-writes `brain:upgrade` into `package.json` before invoking it. The paradox is not
documented anywhere — it reads as an arbitrary setup chore.

**Consequence for the design:** `init` does not need to reimplement alias-writing. The
idempotent, consumer-wins merge already exists and is tested (`mergePackageJsonScripts`).
`init` only has to be an **entry point that runs without an alias** — which is precisely
what a `bin` entry provides.

## Decision

Add `bin: { "brain": "brain/scripts/cli-entry.mjs" }` and an explicit `npx brain init`
that (1) merges the single bootstrap alias using the existing merge function, then
(2) delegates to the existing `brain:upgrade <tag>` flow, which injects the other nine.

**Not a lifecycle hook.** `prepare`/`postinstall` on git-deps break pnpm (#86), which is
why the ticket specifies `bin` + an explicit verb. Recorded here so it is not
"simplified" later into a postinstall.

## Scope

- `bin` entry + `brain/scripts/cli-entry.mjs`.
- `npx brain init` — writes the bootstrap alias (idempotent, consumer value wins), then
  runs `brain:upgrade <installed-tag>`; reports the `brain:env:init` next step rather than
  running it (it is interactive — see design D4).
- `npx brain --help` — the verb surface, which is also the discoverability gap
  `KNOWN-LIMITATIONS.md` records for `plain`/`plainfiles`/`AGENT_PLATFORM`.
- README rewritten to the new flow, old manual path kept as documented fallback.
- `test/fresh-install/in-container.sh` updated: the hand-written alias step becomes
  `npx brain init`, across all four package-manager fixtures.

Out of scope: `brain:adopt --apply`, the `bootstrap.sh:226` i18n leak, the MCP read
server. **The registry/mirror/public-repo decision** the ticket folds in is a human call
and is raised in `design.md` §D6 for a recorded answer — it does not block the bin work.
