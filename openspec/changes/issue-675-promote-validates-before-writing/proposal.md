---
status: draft
issue: 675
---

# Proposal — brain:promote validates the artefact BEFORE it signs it (issues 675, 674)

## What

One new read-only step in `brain:promote`, in the precondition slot the verb
already documents as *"read-only, and BEFORE the plan is shown"*: the content
each write would produce is run past the guards that own the rules about it,
and a failure refuses with nothing written, nothing staged, and the human never
asked to type `PROMOTE`.

Two guards ship, because two defects were found on one promotion:

| guard | rule owner | refuses |
|---|---|---|
| `single-status-line` | `lib/amendment-draft.mjs` — `checkSingleStatusLine` | an ADR with ≠ 1 `**Status**:` line (#675) |
| `shipped-hostnames` | `lib/shipped-hostnames.mjs` — `foreignHostsIn` | a `brain/**` destination naming a host no consumer can resolve (#674) |

Neither rule is new and neither is re-derived. What is new is that the verb
asks them, at the moment the destination is chosen.

## Why

Both tickets are the same defect at different layers, found on the promotion of
ADR-0031 (PR #672), and both are cured one step earlier.

**#675 fails OPEN, which is why it outranks its siblings.** The draft carried a
bare `**Status**:` line where the house shape puts it inside the preamble
blockquote `transformDraft` strips. The verb prepended its own header, kept the
stale one, wrote a signed ADR with **two** `**Status**:` lines, staged it, and
printed a commit command. The maintainer ran it and pushed.

The rule was already written in the module next door — `applyStatusAct` refuses
to *touch* a file with two Status lines — so the two halves of one verb
disagreed about whether that artefact may exist. That is #130/#340/#555 inside
a single file, and it made the corruption unrepairable by the sanctioned route:
the amendment path could not run on the result, so the only way back was
reverting the signing commit. That revert then left `agent-authorities.md`
citing an ADR that no longer existed, red in `adr-citation-resolves.e2e`.

**#674 is a guard whose surface excludes its subject.** `brain/**` ships;
drafts live in `openspec/changes/**/brain-drafts/**` and do not. ADR-0031 went
green through `npm test`, `brain:repo:check`, `brain:nav` and CI, and went red
on the signing commit — because the first instant `shipped-hostnames` could see
the file was the instant promotion had already put it under `brain/`. The
remedy at that point is no longer the agent's to apply: `brain/**` is Tier 3.

## Why they are one change

They land in the same read-only slot, and splitting them would produce two
implementations of *"validate the destination content before writing"* — the
exact defect both tickets cite. One registry, two entries.

## What this is not

Not a widening of `shipped-hostnames`' `SCAN_ROOT` to `openspec/**`. Drafts are
not shipped, and change folders legitimately quote real hosts (measurements, CI
logs, URLs from tickets). **The destination is what makes a file shipped**, so
the check belongs where the destination is decided.

Not new enforcement, either. `brain:promote` still adds none: the real gate is
`brain-writes-reviewed` (L6) and CODEOWNERS at the PR level, unchanged.

## Cost

One extra pass over the text of each write, in-process, on a verb a human runs
by hand a few times a month. Against it: the promote cycle #674 measured —
draft → promote → sign → push → CI red → diagnose → reword → *a human hand-edits
a signed file* → commit → push, where every step after "CI red" was avoidable
and the last of them the agent may not perform at all.
