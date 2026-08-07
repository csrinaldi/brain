---
status: tasks
issue: 378
artifact_store: openspec
topic_key: sdd/issue-378-brain-promote/tasks
---

# Tasks — `brain:promote` (issue #378)

Baseline: `main` @ `0401871`.

- [x] T1 — measurements BEFORE designing (proposal M1-M5). Two of them changed the spec:
      the issue's acceptance fixture path is now taken by a different signed ADR (→
      REQ-378-6), and the `AGENTS.md` step **does** fail a gate, contrary to the stated
      rationale in comment 5217778764 (→ corrected in REQ-378-9).
- [x] T2 — SDD artefacts: proposal / spec (REQ-378-1..10) / design (D1-D7) / tasks.
- [x] T3 — slice decision recorded with its cost: new-file promotion is the **minority**
      shape by the #405 measurement; deferred for an ordering reason (design D2), not a
      difficulty one.
- [x] T4 — RED first: `brain-promote.test.mjs` (mechanics) and
      `brain-promote.locks.test.mjs` (REQ-378-1..4) written and failing before the module.
- [x] T5 — `brain/scripts/brain-promote.mjs`: pure core + injected seams, CLI behind the
      main-module guard, `insertAdrLink` and `compileAgentsMd` reused (D5).
- [x] T6 — `package.json`: `brain:promote`. NOT added to `MANAGED_SCRIPT_KEYS` (D6).
- [x] T7 — red-proof pass per D7: twelve mutations, diff printed, `node --check`,
      substitution-site **count** asserted, liveness confirmed before trusting any result.
      Results in the report; every one killed its intended test.
- [x] T8 — `brain-drafts/adr-0028-brain-promote-read-confirm-stage.md` DRAFTED
      (open question 3 → yes), recording the honest limits as measurements.
- [x] T9 — `brain-drafts/amendment-convention.md` DRAFTED — writes down the rule that
      today exists only as precedent in `git show 0f54781`. **Prerequisite for slice 2.**
- [x] T10 — gates: `npm test` (2654 pass / 0 fail), `npm run repo:check`, `npm run brain:nav`.
- [x] T11 — ACCEPTANCE, run against the real repo content in an independent clone, with
      the verb promoting **its own ADR draft**:
      - plan rendered, header before/after shown, HOME.md line shown and inserted after
        ADR-0027, `AGENTS.md` regeneration announced;
      - `git rev-list --count HEAD` unchanged at 1 — **zero commits**;
      - `git diff --cached --name-only` = the three expected paths;
      - `npm run repo:check`, `npm run brain:nav`, and the existing
        `antigravity.drift.test.mjs` all **pass on the result**;
      - the printed commit message fed to the real `brain/scripts/hooks/commit-msg`
        exits 0.
      The verb refuses on the non-TTY of this session, verified live (exit 2).

## Open human acts — NOT agent decisions

- [ ] H1 — sign and promote the ADR draft. `0028` is a suggestion; `0018` and `0023` are
      also free. (The verb can promote its own ADR draft, which is the acceptance run.)
- [ ] H2 — sign and promote `amendment-convention.md`. Until it is signed, slice 2 has no
      written rule to encode.
- [ ] H3 — rule on `MANAGED_SCRIPT_KEYS` (D6).
- [ ] H4 — decide whether the acceptance replay against the ADR-0025 drafts in
      `openspec/changes/issue-375-l5-deny-set/brain-drafts/` still means anything, given
      that `adr-0025` is taken. The drafts must be renumbered before they can be promoted
      by hand or by tool; that renumbering is a human edit to a human artefact.

## Slice 2 — blocked on H2

- [ ] In-place edits to signed `brain/**` files: the majority shape. Needs the amendment
      convention written first (D2), and needs a decision on how a draft expresses
      "replace lines X-Y" in a way a tool can apply without half-applying.

## Micro-decisiones en caliente

- The printed commit command is **single-quoted**. Found by reading ADR-0027's H1, which
  contains backticks; a double-quoted paste would execute them.
- `isTTY` is consulted exactly **once** (D3). The temptation to also check it inside the
  confirm function is the duplicated-predicate drift the anti-pattern doc records.
- `insertAdrLink`'s `already-present` branch is a **refusal** here, not a no-op (D5).
- Root is `process.cwd()`, not `import.meta.url` — the real-child-process non-TTY test
  needs to run against a fixture repo, not the developer's checkout.
- **Deviation from the issue, stated rather than silently dropped.** Step 1 asks for the
  draft to be rendered *"in full, paginated"*. It is rendered in full; it is **not**
  paginated. A pager means spawning a second external process, which would break the
  single-spawn-site count REQ-378-3 relies on and would hand a child process control of
  the terminal immediately before a confirmation prompt. Scrollback and the caller's own
  `| less` cover the ergonomics; the lock does not survive the alternative.
- A stray acceptance run was executed inside a **copy of the worktree**, whose `.git`
  file still resolved to the real gitdir — so `git add` staged into the real index.
  Caught, `git reset`, working tree verified byte-identical to HEAD. Recorded because it
  is a live hazard for anyone testing a staging tool: the test fixtures use
  `mkdtemp` + a fresh `git init` precisely so this cannot happen there.
