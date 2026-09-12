# Draft doctrine amendment — `memory-format.md` §"Public-repo exposure — stance"

Not applied to `brain/core/**` (out of scope for this apply session — the
maintainer promotes). Proposed patch to
`brain/core/methodology/memory-format.md` lines 280-283, for issue #939
(RULED 2026-09-12).

## Current text

Quoted byte-for-byte, same line breaks (and continuation-line indent) as the
source (the sentence starts mid-line-280, inside the `plainfiles.save
capture (#738)` bullet):

> An **agent-driven** capture still carries the
>   OPERATOR's handle, never an agent identity (`@claude-code`, `@gemini-cli`, …) — only
>   `actorKind: agent` changes, measured from the session's agent-marker environment variable
>   (`AI_AGENT` by default, configurable via `git config brain.agentEnv`).

## Proposed replacement

> An **agent-driven** capture still carries the OPERATOR's handle, never an
> agent identity (`@claude-code`, `@gemini-cli`, …) — only `actorKind: agent`
> changes, measured from the session's agent-marker environment. The default
> marker list (`AGENT_ENV_DEFAULTS` in `capture-provenance.mjs`) covers the
> runtimes brain has verified — `AI_AGENT` (brain's own generic marker),
> `CLAUDECODE` (Claude Code), `CODEX_THREAD_ID` (OpenAI Codex CLI) — and is
> configurable/extendable via `git config brain.agentEnv`, which always wins
> over the defaults.
>
> **Accepted cost (ruled 2026-09-12, issue #939):** the two possible errors
> are not symmetric. Labelling an agent capture `human` launders
> machine-written content as human-authored — precisely what
> `adr-0031-ai-attribution-is-a-claim-not-a-record.md` exists to prevent.
> Labelling a human capture `agent` is merely wrong; it takes credit away
> from a person but invents no human authorship. Brain accepts the latter,
> smaller error: a person who runs `memory:save` by hand inside an agent
> terminal is recorded as `actorKind: agent`, because the session genuinely
> is an agent session. `actor` still carries who they are — `actorKind` is
> coarse by design (see above), not an identity claim.

## Why this belongs in doctrine, not just a code comment

The current doctrine sentence states the OLD single-marker default
(`AI_AGENT`) as if it were a complete description of the mechanism; after
#939 that sentence is stale. The accepted-cost paragraph is the maintainer's
own ruling language from the issue body, preserved verbatim where it belongs
per SDD convention: doctrine states rulings, code implements them.
