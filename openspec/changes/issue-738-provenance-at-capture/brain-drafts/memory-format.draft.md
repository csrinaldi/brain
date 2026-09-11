# Amendment draft — `memory-format.md`, the `actor` example and capture doctrine (issue #738)

**For**: `npm run brain:promote -- openspec/changes/issue-738-provenance-at-capture/brain-drafts/memory-format.draft.md`

> Drafted by agent, applied by the maintainer. `brain/core/**` is Tier 2 and
> `brain:promote` is the sanctioned path: it renders this draft, shows the plan,
> requires the typed word, then stages and stops.

## Why

#738 (provenance at capture) shipped `actor` resolution from `git config brain.actor` and
`actorKind` measurement from the agent-marker environment. Two passages here still describe the
pre-#738 shape: (1) the field-table example shows an agent actor with no `@` prefix, inconsistent
with the handle convention the same table already states; (2) the "Public-repo exposure — stance"
section never states the `plainfiles.save` capture rule or the agent-vs-operator distinction. This
amendment fixes the example and appends the capture doctrine as its own bullet, right after the
stable-handle rule it specializes.

```brain-amendment/1
target: brain/core/methodology/memory-format.md
issue: 738
```

## Act 1 — the `actor` field-table example, `@`-prefixed

```amend-find
| `actor` | string | ✅ | Stable handle of the author (`@crinaldi`, `claude-sonnet-4-6`). **A handle, never PII.** |
```

```amend-replace
| `actor` | string | ✅ | Stable handle of the author (`@crinaldi`, `@claude-sonnet-4-6`). **A handle, never PII.** |
```

## Act 2 — the `plainfiles.save` capture doctrine, appended after the stable-handle bullet

```amend-find
- Actor is a **stable handle**, never an email, legal name, or other PII. `actorKind` is the
  coarse `human|agent` only.
```

```amend-replace
- Actor is a **stable handle**, never an email, legal name, or other PII. `actorKind` is the
  coarse `human|agent` only.
- **`plainfiles.save` capture (#738):** `actor` comes from `git config brain.actor` — a fresh
  clone's first `memory save` is refused, naming the remedy, until you run
  `git config --local brain.actor @<handle>` once. An **agent-driven** capture still carries the
  OPERATOR's handle, never an agent identity (`@claude-code`, `@gemini-cli`, …) — only
  `actorKind: agent` changes, measured from the session's agent-marker environment variable
  (`AI_AGENT` by default, configurable via `git config brain.agentEnv`). The branch a capture ran
  from is never the actor — see `issue`, which derives from it when `--issue` is not given.
```

### Notes for the promoter

Act 1's anchor is the `actor` row of the field table (`memory-format.md:58`), verified to occur
exactly once. Act 2's anchor is the whole two-line stable-handle bullet closing the first item of
"Public-repo exposure — stance" (`memory-format.md:275-276`), verified to occur exactly once; the
replacement keeps those two lines verbatim and appends one new bullet — containment inside its own
replacement keeps `brain:promote` idempotent (`free = f − r×k = 0` once applied).
