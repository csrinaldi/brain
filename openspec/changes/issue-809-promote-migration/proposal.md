# Proposal: #809 — `brain:promote` learns the migration shape

Tier `lite`. Change `issue-809-promote-migration`, off `origin/main @ 89f4b71`.
**Authority**: #809's approved body (Option A recommended and taken), the
#806 ruling (31/08), Compuerta 4 (no new config surface), the #456 renumber
precedent, agent-authorities Tier 3 (unchanged — the human still signs).

## Intent

A third draft shape, same flow: `config-migrations-<ver>.md` carrying ONE
fenced `brain-migration/1` JSON block promotes into
`brain/core/config-migrations.mjs` through the exact ceremony ADRs get —
render, plan, typed confirmation, write + stage, stop, human commit as
signature. The backlog this unblocks is measured: three drafts
(1.2.0 / 1.3.0 / 1.4.0), each today a Tier 3 hand edit.

## Decisions

- **D1 — the contract is JSON, never JS.** `brain-migration/1` block:
  `{version, description, defaults}`. Nothing is eval'd; `defaults` must be a
  plain object tree. Declarative only — `migrate()` entries stay hand edits
  (nine versions, zero uses; automating the unused arm is surface without a
  writer).
- **D2 — numbering is computed, shown, and signed.** The verb proposes
  next-minor above max(package version, migration tail); the plan prints
  "draft says X → promoting as Y"; the typed confirmation covers the number.
  `--as <version>` overrides; ≤ tail refuses (monotonic-forever).
- **D3 — the splice must prove itself.** After appending the entry before the
  list's closing `];`, the candidate text is written to a temp file, imported,
  and `migrateConfig` must run clean over it — no parse proof, no staging.
- **D4 — the three existing drafts are converted to the contract** in this
  change, so the verb's first real promotions are the backlog itself.

## Scope

`brain/scripts/lib/migration-draft.mjs` (parser + pure splicer + number
proposal), the dispatch arm in `brain-promote.mjs`, tests (parser, splicer,
numbering, refusals, end-to-end against a fixture file), the three draft
conversions.

## Non-goals

#807 (read-but-undeclared detection), option C (unattended authoring — a risk
decision, explicitly reserved), any change to what Tier 3 means.

---

## Addendum — 02/09/2026, during apply

**D2 amended: no `--as` override.** `parseArgs`'s own written rule — "brain:promote
takes no options… deliberately" — was found during apply. `--as` does not bypass
the confirmation, but relaxing a blanket written rule for a knob nobody has
needed is not this ticket's to do. The computed number is the only path; a human
needing a different one edits by hand (today's path, unchanged). Monotonic-forever
holds by construction and is pinned by test.
