# Tasks — issue #973 R6-erratum drafts

- [x] 1. Read the contract: `brain/scripts/lib/amendment-draft.mjs`, `brain/scripts/brain-promote.mjs`,
      `consolidation-protocol.md` §1c, and the merged precedent drafts in
      `openspec/changes/managed-script-brain-prefix/brain-drafts/adr-*.draft.md`.
- [x] 2. Confirm each ADR's current Status line and amendment number against `origin/main`: each
      stands at the amendment #972 landed (ADR-0002→3, ADR-0011→1, ADR-0014→1, ADR-0017→3,
      ADR-0034→1); the erratum takes the next number.
- [x] 3. Write `adr-0002-amendment-4.draft.md` — one `amend-find`/`amend-replace` pair rewriting the
      false sentence at `adr-0002-memoria-git-based-dos-capas.md:121-122`.
- [x] 4. Write `adr-0011-amendment-2.draft.md` — one pair rewriting the sentence at
      `adr-0011-feature-scoped-working-memory.md:68-69`.
- [x] 5. Write `adr-0014-amendment-2.draft.md` — one pair rewriting the sentence at
      `adr-0014-workflow-governance.md:152-153`.
- [x] 6. Write `adr-0017-amendment-4.draft.md` — one pair rewriting the sentence at
      `adr-0017-memory-format-owned-by-brain.md:471-472` (the "and Amendments 1-2" variant).
- [x] 7. Write `adr-0034-amendment-2.draft.md` — one pair rewriting the sentence at
      `adr-0034-memory-travels-on-its-own-lane.md:267-268`.
- [x] 8. Prove all five promotable without promoting: a throwaway script (never in the repo)
      imports `parseAmendmentDraft`, `assessEdit`, `applyEdits` from the real module and confirms,
      per draft — parses ok; the edit assesses `pending` with `free = 1`; applying it leaves no
      remaining `not rewritten (ruling R6` in that ADR and changes no other line.
- [x] 9. Run the issue's acceptance-criterion `rg` across `brain/project/decisions/` — confirms 5
      hits pre-promotion (one per target ADR); the five drafts reduce this to zero live claims —
      quotations may still match (see `spec.md`).
- [x] 10. Write `proposal.md`, `tasks.md`, `apply-progress.md`, `brain-drafts/README.md`.
- [x] 11. Mirror `proposal.md`, `tasks.md`, `apply-progress.md` to engram under
      `sdd/issue-973-adr-r6-erratum/{proposal,tasks,apply-progress}` (project `brain`,
      `capture_prompt: false`).
- [x] 12. Commit as work units citing `#973`.
- [x] 13. Record-first commit: `npm run brain:memory:save -- "<title>" "<content>"` (renamed from
      `memory:save` by #966), staging only the new `.memory/records/*.jsonl` plus
      `.memory/index.jsonl`.

## Explicitly out of scope for this change

- [ ] Running `npm run brain:promote` against any of the five drafts (maintainer-only, per the
      task's hard constraints) — this SDD-apply agent never runs it. The maintainer has, three
      times on this branch (see `proposal.md`'s "Promotion history" and `apply-progress.md`): the
      third round — revert `49d35565`…`21325498` (`c096754e`), then promote the drafts as
      corrected by this batch (`73b34ebd`, `c0fff7b3`, `a6a27ce7`, `64a0590c`, `ae1d5301`) — is
      done.
- [ ] Editing `brain/core/**`, `brain/project/**`, `brain/HOME.md`, or `AGENTS.md` directly — none
      of this change's own commits do; the maintainer's separate `brain:promote` commits do.
