# Apply Progress: #814 — PR2 of the ruled 3-PR chain

**Worktree**: /home/gandalf/IA/brain-issue-814 (branch `feat/issue-814-…`, off origin/main @ 55700da)
**Batch**: 1 — PR2 (closes #814). PR1 (#823) and PR3 (#824) not started; #823/#824 await `status:approved`.
**Mode**: Strict TDD — every unit RED against the real module before implementation.

## Units — all four complete, one commit each

- [x] U1 `04c3b5a` — `instructions` joins the contract (T3). 5 RED → GREEN.
      Port validates non-empty string | checked null; carries verbatim; plain
      declares null everywhere; both fakeInhabitant copies + one inline fixture updated.
- [x] U2 `bd9b86e` — gentle-ai inhabits the port (T2). RED (module absent) → GREEN.
      `gentle-ai.roles.mjs`: recorded declaration, provenance (endpoint + 2026-09-02),
      tiers sonnet→balanced/opus→deep, chooses_model:false; custom stages answered
      via `derivedRole()` marked `derived: true`.
- [x] U3 `5abb056` — the Adversary is served from the port (T4/D5).
      `roles/first-party/{adversary-cold-review,index}.mjs`; `git mv` of
      cold-review-prompt.mjs → assemble-review-prompt.mjs keeping the
      derived-from-reader machinery, role as refused-if-absent argument;
      `run-cold-review-stage` rewired; ROLE_DEBT_TICKET + its test deleted;
      17 protocol tests moved intact (18−1) + 2 new; 5 first-party tests;
      neutrality asserted (no engine/map/model/transport key on the served object).
- [x] U4 `<this>` — n=2 measured (T6). INHABITANTS += gentle-ai (the one line);
      TRIPWIRE FAILED on the real second entry and was deleted per its own
      instructions, with the parity-debt header.

## Measured

- Full suite: **4593 pass / 0 fail** (session baseline 4520; +73).
- `brain:repo:check`, `brain:nav`: clean.
- Countable diff (ignoreList applied): **+212 −55 = 267** vs the lite budget 1000.
  The tasks forecast said ~740; the `git mv` rename accounting is most of the gap.

## Remaining for the chain (not this batch)

- PR1 (#823): `brain/scripts/config/` — the C4 verb. Blocked on `status:approved`.
- PR3 (#824): `brain:engines` discovery. Blocked on #823 + PR2 landing + `status:approved`.
- The migration draft `config-migrations-1.4.0.md` ships with PR1 (it declares
  `sdd.engines`, which only the verb writes).

## Batch 2 addendum — 02/09/2026, after the phase-order refusal

`phase-order` (Rule C) refused PR2: implementation present, no checked item —
the checklist had not been ticked as the units landed. Corrected here: PR1's
six items are ALSO done (worktree `brain-issue-823`, commit `027cdda`,
unpushed — `brain:config` + the 1.4.0 draft), so both PRs' copies of this
trail are updated together and byte-identically, or the chain's shared files
would conflict on merge. PR3 (#824) remains unstarted, blocked on the 1.4.0
draft's human promotion.

## Batch 3 — PR3 (#824), 02/09/2026

`brain:engines` implemented in worktree `brain-issue-824` (both parent PRs
merged: #825 @ e938685, #826 @ 223ea49). Pure half `engines-report.mjs`
(survey rows + the record planner through `config-verb.mjs` — one validator,
second caller), I/O half `engines-cli.mjs`. 9 tests RED-first, including the
pinned sequencing consequence: `--record` fails closed until the 1.4.0 draft
is promoted (human, Tier 3). The survey shows `[recorded|derived]` per role —
the report must not launder what the port now refuses to.
