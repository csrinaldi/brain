# Draft amendment — `agent-authorities.md`, Tier 2 and Tier 3 lists

**Status**: Draft — for the maintainer to apply, review and sign
**Date**: 2026-08-15 — drafted by agent, per `agent-authorities.md` Tier 2

> **Why this is a draft and not an edit.** `brain/core/**` is Tier 3 for the
> agent: *"Commit directly to `brain/core/**` or `brain/project/**` — the
> knowledge half"*, prohibited **even if explicitly asked**. Requested by the
> maintainer on 2026-08-15; the request does not move the boundary, so the text
> is proposed here instead of applied.

## Why: the doctrine names one vendor while the machinery supports four

`brain/scripts/harness/backends/` ships **`antigravity.mjs`, `claude.mjs`,
`gentle-ai.mjs`, `plain.mjs`**. The harness layer is explicitly multi-platform,
and this very session reports `harness: antigravity` at `brain:day:start`.

The doctrine does not follow. Tier 3 reads:

> `- Add AI attribution in commits (Co-Authored-By: Claude...)`

And `agent-authorities.md` is **compiled verbatim** into every consumer's
`AGENTS.md` — `SOURCE_DOCS` in `harness/backends/antigravity.mjs` marks it
*"Tier table VERBATIM"*. So a consumer running Antigravity, gentle-ai, opencode
or anything not yet invented reads a prohibition naming a tool they do not use,
and has to translate the rule to their own situation before obeying it.

A rule stated for one vendor and shipped to all of them is the same defect this
repository keeps closing elsewhere: a confident statement over too narrow a
subject. It is also now **out of step with its own mechanism** — `hooks/commit-msg`
and `hooks/pre-receive` read `git config brain.aiAgents`, so the enforcement is
already agnostic and only the wording is not (#671).

## Two more defects in the same two lists, found while reading them

Neither is about AI attribution; both ship verbatim to consumers too.

**1. Wrong ecosystem.** Tier 3 line 56:

> `- Publish JARs to the Package Registry without explicit human instruction`

`@logikas/brain` is an **npm** package. `JAR` is a Java artefact — a leftover
from an earlier life. A Node consumer reading this cannot tell whether the rule
applies to them.

**2. A dead command.** Tier 2 line 43:

> `- **Deploy to the Package Registry** (`npm run backend:deploy`) — affects artifacts shared by all consumers`

Measured: **`backend:deploy` appears zero times in `package.json`.** The rule
cites a command that does not exist — the same failure as `tranche.mjs` citing
`CLAUDE.md`, which #671 repaired: a citation that reads as verified and resolves
to nothing.

## Proposed text

### Tier 3 — replace the attribution bullet

```diff
-- Add AI attribution in commits (`Co-Authored-By: Claude...`)
+- Add AI attribution to commits — an agent `Co-Authored-By:` trailer, a session
+  URL, or a "generated with" footer, whatever the tool is called. Provenance is
+  not authorship: it is evidence when a runner attests to it, and a claim when
+  the producer asserts it about itself (ADR-0031). Enforced by
+  `hooks/commit-msg` and `hooks/pre-receive`; the agent vocabulary is
+  `git config brain.aiAgents`, so a consumer governs their own tooling without
+  waiting for a brain release.
```

### Tier 3 — replace the registry bullet

```diff
-- Publish JARs to the Package Registry without explicit human instruction
+- Publish release artifacts to the package registry without explicit human
+  instruction — whatever the ecosystem's artefact is
```

### Tier 2 — repair the dead command

Either name the command that exists, or drop the parenthetical:

```diff
-- **Deploy to the Package Registry** (`npm run backend:deploy`) — affects artifacts
-  shared by all consumers
+- **Publish to the package registry** — affects artifacts shared by all consumers
```

> The publish path in this repository today is the `publish.yml` workflow, not a
> local script. Naming a workflow in doctrine would age the same way the dead
> command did, so the proposal names no command at all. If a command is wanted,
> `cites-resolve`-style resolution for it would be the guard, not the reader's
> memory.

## Applying this

1. Edit `brain/core/methodology/agent-authorities.md` (maintainer — Tier 3 for
   the agent).
2. **Regenerate `AGENTS.md`**, which is compiled from the five `SOURCE_DOCS`,
   not hand-edited. `brain-promote.mjs` treats this as its own act precisely
   because an earlier change *"lost the AGENTS.md step on the human's side"*.
3. `AGENTS.md` is `regenerate`, compiled **in the consumer** — brain's own is
   deliberately not shipped (#397), so consumers pick the change up when they
   recompile.

## Not proposed

The Tier-3 list's other entries. They are accurate and ecosystem-neutral as
written, and widening this beyond the three defects measured above would be
editing signed doctrine on an agent's taste rather than on evidence.
