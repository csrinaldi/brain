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

## Bucket 1 is NOT mechanical — measured, and it changes the fix

The rename table above is right about where the paths went and wrong about applying it
inside `brain/core/**`. Applying it verbatim and re-running the guard gives **22 → 7**, all
green — and it introduces the exact class the script's OWN older rule exists to stop:

```js
// check-brain-nav.mjs — the coreLeaks rule
} else if (isUnder(f, CORE) && isUnder(r, PROJECT)) {
  // core/** es genérico y se distribuye a consumidores; project/** es del consumidor
  // y varía. Un link core→project resuelve acá (self-hosting) pero rompe en todo
  // consumidor, donde ese target no existe.
```

That rule runs over `linksOf(f)` — markdown links and wikilinks. **The new citation check
does not carry it.** So rewriting `` `brain/decisions/` `` to `` `brain/project/decisions/` ``
inside a core doc satisfies the new guard while committing the older violation one notation
over. `workflow-governance.md:3` already states the convention in prose: *"Core docs
reference project ADRs by name, not by path — `brain/project/**` is consumer-owned and
varies per repo."*

**Seven of the fifteen renames are core→project** (`brain/decisions/` ×3 and
`brain/domain/` ×3 in `agent-authorities.md`, `consolidation-protocol.md` and
`ia-escribe-brain-sin-gate.md`, plus the ADR line in `brain/project/**`, which is fine —
project→project is not a leak).

**This is why the prefix form proposed further down is the correct fix, not merely the
tidier one.** `` `brain/core/**` `` / `` `brain/project/**` `` names no consumer-specific
path, and the citation regex does not match globs (measured — the source documents it at
`check-brain-nav.mjs:106`), so a prohibition stated as a prefix is both honest in a consumer
tree and un-breakable by the next reorganization.

**Follow-up worth a ticket:** the citation check should carry the coreLeaks rule too, or a
future core doc can cite a `brain/project/…` path and pass. The guard closed
"names something that does not exist" and left "names something that does not exist *in a
consumer*" open in the notation it just started reading.

## The verified patch — 22 → 3

Applied in a scratch worktree and measured, not proposed:

| step | dead citations |
| --- | --- |
| baseline (`443f48b`) | 22 |
| naive rename table | 7 — but 7 core→project leaks introduced |
| **prefix form (below)** | **3** |

`check-brain-nav.citations.test.mjs` — 4/4 pass under the prefix form.

```diff
- Commit directly to `brain/decisions/`, `brain/anti-patterns/`,
-   `brain/domain/`, or `brain/methodology/`
+ Commit directly to `brain/core/**` or `brain/project/**` — the knowledge half,
+   whatever its subdirectories are called
```
(`agent-authorities.md` Tier 3 · `consolidation-protocol.md` §2 Hard Rule ·
`ia-escribe-brain-sin-gate.md` §problem — same shape in all three.)

Plus, in `consolidation-protocol.md`:
- §1b *"a file is added to `brain/methodology/` or `brain/anti-patterns/`"* →
  *"a file is added under `brain/core/**` or `brain/project/**`"*
- §4 *"contradicts active ADRs in `brain/decisions/`"* → *"contradicts the project's active
  ADRs"* (by name, not by path — the stated convention)
- §2 *"See anti-pattern: `brain/anti-patterns/ia-escribe-…`"* → `brain/core/anti-patterns/…`
  (core→core, a plain rename)

And two plain core→core renames: `harness-contract.md`'s `consolidation-protocol.md` cite,
and `ia-promueve-…`'s `` `brain/methodology/` `` in its Symptom. One project→project rename
in `adr-0013`.

The full patch is attached to this change as the reviewed evidence; it touches 6 files,
+12/−13.

## The 3 that remain — each needs a ruling

Two of them share a class the first draft missed: **the citation is historically true.**
Rewriting it falsifies the record; deleting it loses provenance. The guard cannot tell that
shape from a live pointer, and that is the interesting part.

| # | where | what it is | why it is not a rename |
| --- | --- | --- | --- |
| 1 | `ia-escribe-brain-sin-gate.md:23` | quotes `consolidation-protocol.md §2` **as it read before issue #54**: *"draft and attach an append-only file in `brain/anti-patterns/`"* | it is a quotation of a past document. `brain/anti-patterns/` is what that document said |
| 2 | `ia-promueve-…:3` | `**Discovered in:** ISSUE-8 / governance of `brain/methodology/project-workflow.md`` | a provenance record of where an incident happened. The doc existed then |
| 3 | `harness-contract.md:76` | *"See `brain/methodology/agent-skills.md` for the full skill inventory."* | a **live** cross-reference to a document that does not exist. The only genuinely dead pointer of the three |

**Options for 1 and 2 (they take one ruling together):**

- **(a) Drop the backticks** on a historical path, keeping the words. Cheapest, works today,
  and it says what is true: this is prose about the past, not a pointer. Costs nothing and
  needs no change to the guard.
- **(b) A marker convention** — e.g. `` `brain/anti-patterns/` `` *(historical)* — and teach
  the extractor to skip a marked citation. Honest and machine-readable; adds surface to a
  guard whose value is that it has none.
- **(c) Rewrite them to today's paths.** Do not. It makes a quotation say something the
  quoted document never said.

**Leaning (a)** — the guard reads backticks as "this is a path in this tree", and a
historical path is not one. That is a convention, not a mechanism, which is the right weight
for two occurrences.

**Option for 3:** either write `agent-skills.md` (it is referenced as *the* skill inventory
and does not exist anywhere), or drop the sentence. Dropping is honest; writing it is a
different ticket. **Leaning: drop the sentence here, open a ticket for the inventory** —
`harness-contract.md` promising an inventory that has never existed is its own small lie.

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
