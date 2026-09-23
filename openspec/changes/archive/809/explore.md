# Exploration: #809 — promote learns the migration shape

Worktree `/home/gandalf/IA/brain-issue-809`, off `origin/main @ 89f4b71`
(#827 merged — the #814 chain complete). #806 (the dependency) ruled 31/08:
the migration number is the package version.

## What exists

- `brain-promote.mjs` (961 lines): TWO shapes, one flow — `adr-NNNN-slug.md`
  (new ADR) and `*.draft.md` + `brain-amendment/1` block (amendment). Render →
  plan → TYPED confirmation → write + stage → STOP; the human's commit is the
  signature. Zero knowledge of migrations.
- `amendment-draft.mjs` (771): the house pattern — a fenced-block CONTRACT
  (`brain-amendment/1`), a parser, pure appliers, `promote-guards.mjs` locks.
- `config-migrations.mjs`: 9 shipped entries, ALL declarative
  `{version, description, defaults}`; the imperative `migrate()` arm has never
  been used (measured in #809's own body). List tail: `0.10.0`.
- THREE pending drafts, none machine-readable — prose + a loose ```js block:
  `issue-456/…-1.2.0.md`, `issue-312/…-1.3.0.md`, `issue-814/…-1.4.0.md`.
  #809's "live instance" (0.11.0) is the first, already renumbered 1.2.0.

## Constraints already settled

- Option A is in the approved issue body: extend `brain:promote`, no new
  surface (Compuerta 4's warning), reuse the whole safety apparatus.
- Option D rejected with reasons: `config-migrations.mjs` is STRATEGY.COPY,
  blast radius LARGER than an ADR's. Tier 3 stands; the verb automates the
  mechanics, never the act — the human still types and still commits.
- #806: numbering is the package version. The #456 precedent renumbered at
  land time (0.11.0 → 1.2.0 while package.json said 1.1.0) — so "the package
  version" in practice means the NEXT version, above both the current package
  and the migration tail.
- Declarative-only is safe to enforce: nine versions, zero imperative uses.
  A `migrate()` entry remains a genuine hand edit.

## The forks

1. **Draft contract**: a fenced `brain-migration/1` JSON block (never JS —
   nothing gets eval'd), mirroring `brain-amendment/1`. The three existing
   drafts are converted to the contract IN this change (openspec/** is Tier 1).
2. **Numbering (#806)**: the verb computes the proposed number (next minor
   above max(package.json, list tail)), SHOWS it in the plan — "draft says
   1.4.0 → promoting as X" — and the typed confirmation covers it. `--as
   <version>` overrides; anything ≤ the tail refuses (monotonic-forever,
   the #231 doctrine note in the file itself).
3. **Post-splice validation**: after the textual append, the modified file is
   imported (temp copy) and `migrateConfig` must run with the new entry —
   the promoted file must PROVE it still parses before anything is staged.
