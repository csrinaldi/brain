---
status: draft
issue: 1125
---

# Spec

## REQ-1125-1 — with nothing stated, `resolvePlatform` answers `claude`

`resolvePlatform({ env: {}, envVars: {}, config: {} })` MUST return `'claude'`. That value
MUST be the exported `DEFAULT_PLATFORM` in `brain/scripts/harness/platform.mjs`.

**Falsifiable by:** `cli.test.mjs` "defaults to claude when nothing is stated". It returned
`'antigravity'` before this change (RED recorded in tasks.md).

## REQ-1125-2 — a legacy `SDD_HARNESS` that names an engine is not a platform

When no `AGENT_PLATFORM` is stated, a legacy `SDD_HARNESS` value MUST select the platform only
if it is a member of `AGENT_PLATFORMS` (`claude`, `antigravity`, `plain`). Any other value MUST
fall to the default, `claude`.

**Falsifiable by:** `resolvePlatform({ envVars: { SDD_HARNESS: 'gentle-ai' } })` returns anything
other than `'claude'`. Or bootstrap.sh's lifted §6 block, run with `.env` holding only
`SDD_HARNESS=gentle-ai`, yields anything other than `claude`.

## REQ-1125-3 — a stated `antigravity` still resolves to `antigravity` on every path

`resolvePlatform` MUST return `'antigravity'` when `antigravity` is stated through any of these
six inputs, with nothing else stated: process-env `AGENT_PLATFORM`, `.env` `AGENT_PLATFORM`,
`config.platform`, process-env `SDD_HARNESS`, `.env` `SDD_HARNESS`, `config.harness`.
`bootstrap.sh` §6 MUST do the same for the four inputs it reads, which are the first two and
the two `SDD_HARNESS` inputs.

**Falsifiable by:** any row of `cli.test.mjs` "a stated antigravity still resolves… on EVERY
path", or of `bootstrap.default-platform.test.mjs` "a stated antigravity still resolves… on
every shell path", yields another value.

## REQ-1125-4 — `bootstrap.sh` defaults to `claude` and states it in `.env`

When neither the process env nor `.env` states `AGENT_PLATFORM`, and no legacy `SDD_HARNESS`
names a platform, `bootstrap.sh` §6 MUST resolve `claude` and MUST write `AGENT_PLATFORM=claude`
to `.env`.

**Falsifiable by:** the lifted §6 block, run in an empty scratch dir, prints anything other
than `claude`, or leaves a `.env` with no `AGENT_PLATFORM=claude` line.

## REQ-1125-5 — `bootstrap.sh` gives the same answer as `resolvePlatform`

For every combination of process-env `AGENT_PLATFORM`, process-env `SDD_HARNESS`, `.env`
`AGENT_PLATFORM` and `.env` `SDD_HARNESS` in the parity table, the platform the lifted §6
block exports for the run MUST equal
`resolvePlatform({ env, envVars, config: {} })` on the same inputs.

**Falsifiable by:** `bootstrap.default-platform.test.mjs` "give ONE answer…" reports any
mismatch. The table has 90 cases. Before this change it failed on every case where the old
shell ignored the process env, the legacy key or the default.

## REQ-1125-6 — the process env is per-invocation; `.env` is what the repo states

`bootstrap.sh` MUST NOT rewrite an `AGENT_PLATFORM` that `.env` already states. When `.env`
states none, it MUST write the repo's own answer, which is the `.env` legacy value or the
default. It MUST NOT write a process-env `AGENT_PLATFORM`, even though that value wins for the
run.

**Falsifiable by:** running the lifted block with process env `AGENT_PLATFORM=antigravity` and
`.env` `AGENT_PLATFORM=claude` changes `.env`. Or running it with process env
`AGENT_PLATFORM=antigravity` and no `.env` leaves `.env` holding `antigravity`.

## REQ-1125-7 — a fresh consumer built from the packed tarball resolves `claude`

In a consumer that installed the `npm pack` tarball of this tree and stated no platform, the
installed `resolvePlatform` MUST return `claude`, and `brain:env:init` MUST write
`AGENT_PLATFORM=claude` and run the `claude` harness init.

**Falsifiable by:** the packed-tarball check in design.md, "ADR-0036 evidence".

## REQ-1125-8 — the ADR-0024 amendment plans cleanly

`brain-drafts/adr-0024-amendment-2.draft.md` MUST parse as a `brain-amendment/1` draft
targeting ADR-0024 with `amendment: 2`. Each `amend-find` anchor MUST occur exactly once in the
target. `planAmendment` MUST return `ok: true` against the current ADR-0024 and
`brain/HOME.md`.

**Falsifiable by:** `planAmendment({ draftText, targetText, homeText, … })` returns `ok: false`,
or any anchor count differs from 1.
