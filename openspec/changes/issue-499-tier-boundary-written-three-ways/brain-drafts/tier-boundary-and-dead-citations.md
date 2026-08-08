---
status: draft
issue: 499
epic: 313
artifact_store: openspec
topic_key: sdd/issue-499-tier-boundary-written-three-ways/brain-drafts/tier-boundary-and-dead-citations
---

# DRAFT for human promotion — the tier boundary, and 22 dead path citations

`brain/**` is Tier 2. This is the agent's draft; a human applies it.

**Sequencing matters here.** This branch ships the *guard* (`check-brain-nav.mjs` now fails
on a cited `brain/…` path that does not exist). The guard is **RED against `main`'s current
content** — that is the finding, not a defect in the guard. It goes green when the edits
below are applied. Precedent for how: on #405/T18b the maintainer committed the promotion
directly onto the agent's branch, so the code and the doctrine landed together.

---

## What the guard measures

```
22 cited brain/… paths across 6 files do not exist
```

`brain:nav` was green throughout, because it only ever validated markdown links and
`[[wikilinks]]` — never a path cited between backticks, which is the most common way the
doctrine points at itself.

| file | dead citations |
| --- | --- |
| `brain/core/methodology/agent-authorities.md` | 4 |
| `brain/core/methodology/consolidation-protocol.md` | 7 |
| `brain/core/anti-patterns/ia-promueve-sus-propios-artefactos.md` | 1+ |
| `brain/core/methodology/harness-contract.md` | 2 |
| `brain/project/decisions/adr-0013-auto-adr-onboarding.md` | 1 |

---

## Bucket 1 — mechanical renames (core/project reorganization left these behind)

| cited | real |
| --- | --- |
| `brain/decisions/` | `brain/project/decisions/` |
| `brain/domain/` | `brain/project/domain/` |
| `brain/methodology/` | `brain/core/methodology/` |
| `brain/anti-patterns/ia-escribe-brain-sin-gate.md` | `brain/core/anti-patterns/ia-escribe-brain-sin-gate.md` |
| `brain/methodology/consolidation-protocol.md` | `brain/core/methodology/consolidation-protocol.md` |

The last one is `consolidation-protocol.md` cited **by another doc at the path it itself no
longer has**, and the second-to-last is §2 citing the anti-pattern that justifies its own
hard rule.

## Bucket 2 — needs a ruling: `brain/anti-patterns/` is ambiguous

It resolves to **two** real directories, `brain/core/anti-patterns/` and
`brain/project/anti-patterns/`. Every occurrence is inside a prohibition, so the intent is
almost certainly **both** — but that is a doctrine decision, not a rename, and writing one of
the two would narrow a prohibition silently.

## Bucket 3 — dangling: the target does not exist anywhere

| cited | note |
| --- | --- |
| `brain/methodology/agent-skills.md` | no file of that name in `brain/` |
| `brain/methodology/project-workflow.md` | no file of that name in `brain/` |
| `brain/project/architecture/` | no such directory |
| `brain/core/methodology/intro.md` | exists only inside a **test fixture**, not in real `brain/` |

These are references to documents deleted or never written. Each needs a call: drop the
reference, or create the doc. An agent guessing here would invent doctrine.

---

## The boundary itself — the ticket's core

**What executes** (`brain/scripts/vcs/brain-writes-reviewed.mjs:25`):

```js
const BRAIN_MANAGED_PREFIXES = ['brain/core/', 'brain/project/'];
```

`.github/CODEOWNERS` agrees exactly. **That boundary is right.** What follows corrects the
prose to match it; do not widen the gate to match the prose.

### `agent-authorities.md` — Tier 2

Current: *"**Modify files in `brain/`** — the agent drafts the artifact in
`openspec/changes/{iid}/brain-drafts/`; the human moves it to `brain/`"*.

Read literally this covers `brain/scripts/**`, where essentially all of brain's code lives.
An agent applying it as written could not have implemented #469, #443, #468, #472, #378 or
#501 — all agent-authored under `brain/scripts/**`, all through L6, all merged.

Proposed:

> - **Modify files in `brain/core/**` or `brain/project/**`** — the knowledge half. The agent
>   drafts the artifact in `openspec/changes/{iid}/brain-drafts/`; the human moves it to
>   `brain/` in a commit authored by them. This is the boundary L6
>   (`brain-writes-reviewed.mjs`) enforces and `.github/CODEOWNERS` mirrors.
>   `brain/scripts/**` is code and is agent-writable, subject to the usual issue + MR.

### `agent-authorities.md` — Tier 3

Current:

> - Commit directly to `brain/decisions/`, `brain/anti-patterns/`, `brain/domain/`, or
>   `brain/methodology/`

**None of those four directories exists.** This is the list introduced by *"The agent must
never do this, even if explicitly asked"* — the strongest prohibition in the doctrine — and,
read literally, it currently protects nothing. What has actually stopped agents writing to
`brain/core/anti-patterns/` is Tier 2 plus L6, never Tier 3.

Proposed:

> - Commit directly to `brain/core/**` or `brain/project/**` — the knowledge half, whatever
>   its subdirectories are called. Named by PREFIX rather than by enumerating folders,
>   because the enumeration is what went stale: it survived the core/project reorganization
>   naming four directories that no longer exist, and nothing noticed.

### `consolidation-protocol.md` §2 — the Hard Rule

Same four dead paths, same fix. §2's hard rule and Tier 3 are the same prohibition stated
twice; consider having one cite the other rather than restating it, since restating it is how
the two drifted.

### `consolidation-protocol.md` §3 — the zone map

Two rows are wrong together:

| row | problem |
| --- | --- |
| `brain/**` — *Human only* | too wide: swallows `brain/scripts/**` |
| `scripts/**`, `package.json` — *Agent or human* | matches **nothing** — there is no top-level `scripts/` in this repo |

Proposed:

| Zone | Who writes | Enforcement |
| --- | --- | --- |
| `brain/core/**`, `brain/project/**` | Human only | L6 `brain-writes-reviewed` + CODEOWNERS |
| `brain/scripts/**`, `package.json` | Agent or human | `npm run brain:repo:check` |

And the **Golden rule** below the table — *"if the destination is `brain/`, the signature is
human"* — becomes *"if the destination is `brain/core/**` or `brain/project/**`"*.

---

## Why the guard is the deliverable, not the prose fix

The prose has been wrong since the core/project reorganization and everything worked, because
the executable rule was right the whole time. Correcting the words fixes this instance;
without the guard the next reorganization re-breaks them and `brain:nav` stays green again.

The guard's limit, stated so it is not overclaimed: it proves every cited path **exists**. It
does not prove the prose states the same boundary as `BRAIN_MANAGED_PREFIXES` — that would
need the prose to carry a machine-readable marker, which is a heavier change than this
ticket's evidence justifies. What it does guarantee is that a prohibition can never again
name a directory that isn't there.
