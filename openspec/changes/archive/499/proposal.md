---
status: draft
issue: 499
---

# Propuesta — tier boundary written three ways (issue 499)

## Qué

Make `brain:nav` fail on a cited `brain/…` path that does not exist, and draft the doctrine
corrections that failure exposes.

## Por qué

Issue #499. Found while implementing #469, whose diff touches `brain/scripts/**` — and the
doctrine governing whether an agent may do that says three different things, none matching
the gate that runs.

**What executes** (`brain/scripts/vcs/brain-writes-reviewed.mjs:25`):

```js
const BRAIN_MANAGED_PREFIXES = ['brain/core/', 'brain/project/'];
```

`.github/CODEOWNERS` agrees exactly. That boundary is right; the prose is what is wrong.

**The prose, three ways.** `agent-authorities.md` Tier 2 says *"Modify files in `brain/`"* —
literally covering `brain/scripts/**`, where essentially all of brain's code lives. Its Tier 3
list names four directories. The `consolidation-protocol.md` §3 zone map has a `brain/**` row
that is too wide and a `scripts/**` row that matches nothing, since this repo's scripts are at
`brain/scripts/**`.

**And the measurement went further than the ticket.** Scanning every backticked `brain/…` path
across `brain/`:

```
22 cited paths across 6 files do not exist
```

`brain:nav` was green throughout: it validated markdown links and `[[wikilinks]]`, never a
path cited between backticks — the most common way the doctrine points at itself.

The sharp case is Tier 3. Its list — introduced by *"The agent must never do this, **even if
explicitly asked**"* — names `brain/decisions/`, `brain/anti-patterns/`, `brain/domain/` and
`brain/methodology/`. **None of those exists.** The core/project reorganization moved them and
the list never followed. Read literally, the strongest prohibition in the doctrine protects no
directory that exists; what has been stopping agents is Tier 2 plus L6.

Two more of the 22 are self-referential: §2 cites the anti-pattern that justifies its own Hard
Rule at that anti-pattern's old path, and `harness-contract.md` cites
`consolidation-protocol.md` at a path **that file itself no longer has**.

## Alcance

- **Incluye:** the guard in `check-brain-nav.mjs`; its tests; the drafted doctrine corrections
  in `brain-drafts/`.
- **No incluye:** applying those corrections — Tier 2, human signature. **Nor widening the
  gate to match the prose**: `brain/core/**` + `brain/project/**` is the boundary that has
  been holding.
- **Nor** a check that the prose states the *same* boundary as `BRAIN_MANAGED_PREFIXES`. That
  needs a machine-readable marker in the doctrine, which is heavier than this evidence
  justifies. See design D3 for the limit, stated rather than overclaimed.
