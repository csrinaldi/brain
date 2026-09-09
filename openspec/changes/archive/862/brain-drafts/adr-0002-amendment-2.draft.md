# ADR-0002 Amendment 2 — draft (issue #862)

> **Tier 3 draft. Not yet promoted.** ADR-0002 stands at Amendment 1 (#863), so
> this is the next in-place amendment, not a new ADR file.
>
> ```
> npm run brain:promote -- openspec/changes/issue-862-memory-lane/brain-drafts/adr-0002-amendment-2.draft.md
> ```
>
> Promote after ADR-0034 (the new ADR this amendment points at) exists in
> `brain/project/decisions/` — the amendment's prose names it, so a reader who
> follows the reference should find the file.

```brain-amendment/1
target: brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md
amendment: 2
issue: 862
home-summary: the canonical flow's `memory:share`/`pre-push` bullets and the "verbs keep their names until #862" note now point at the lane (ADR-0034); the two-layer decision itself is unchanged
body: ## Amendment 2 — the canonical flow points at the lane (issue #862)
body-end: ### Notes for the promoter
```

## Act 1 — the `memory:share` bullet names what changes once the lane ships

The bullet described `memory:share` as materializing the backend "before
push" with no qualifier. #862 (ADR-0034) rules that a record no longer needs
to wait for a push at all — the lane ships it independently, on its own
schedule.

```amend-find
- `memory:share` → materializes the active backend to `.memory/` before push.
```

```amend-replace
- `memory:share` → materializes the active backend to `.memory/` before push. *(On the lane, ADR-0034: a record does not wait for a push — `brain:memory:ship` collects and pushes it independently, on its own PR. `share`'s role here narrows once 3.1d ships, per the ordering ADR-0034 states.)*
```

## Act 2 — the `pre-push` hook bullet names its own retirement, sequenced

The hook bullet described `share` running on every push, unconditionally.
#862 rules that this is exactly the surface 3.1d retires — but not before
3.1b's first scenario and #874 have proven the lane, so the bullet states
the sequencing rather than a fact not yet true.

```amend-find
- The `pre-push` hook runs `memory:share`; the `post-merge` hook runs `memory:import` after any pull/merge.
```

```amend-replace
- The `pre-push` hook runs `memory:share`; the `post-merge` hook runs `memory:import` after any pull/merge. *(The `pre-push` call retires in 3.1d — after 3.1b's first scenario and #874 land, per ADR-0034 — because by then a record has already reached `main` on the lane before any feature branch is pushed.)*
```

## Act 3 — the note that deferred to #862 is resolved

Amendment 1's "What this does NOT change" section deferred the canonical
flow's verb names to #862. #862 is ruled now (ADR-0034); the deferral is
resolved without reopening what Amendment 1 already settled.

```amend-find
The two-layer decision stands: durable in git, live in a backend, the live layer a derived
index. The canonical flow's verbs keep their names until #862 settles the lane. Retiring the
manifest, the driver and the symlink from the tree is #864 task 2.4, under the rule that
governs it — `brain/core/methodology/memory-backend-contract.md` rule 3 (ruling #863).
```

```amend-replace
The two-layer decision stands: durable in git, live in a backend, the live layer a derived
index. The canonical flow's verbs keep their names; #862 (ADR-0034) settles the lane as a
new governance mechanism carrying records to `main`, not a change to this ADR's two-layer
model — see Amendment 2 for what that ruling touches in the flow above. Retiring the
manifest, the driver and the symlink from the tree is #864 task 2.4, under the rule that
governs it — `brain/core/methodology/memory-backend-contract.md` rule 3 (ruling #863).
```

## Amendment 2 — the canonical flow points at the lane (issue #862)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

The canonical flow's `memory:share` and `pre-push` bullets described a record
waiting for a push and travelling with whatever branch that push was on.
#862 (ADR-0034) rules a `memory/<host>-<date>` pull request as the lane a
record travels on instead — `brain:memory:ship`, triggered by the
session-end hook, `day:start`'s sweep, or by hand, collects and pushes it
independently of any feature branch. The two bullets are annotated with what
changes and when, and Amendment 1's deferral to #862 is resolved.

### What this does NOT change

The two-layer decision itself: durable in git, live in a backend, the live
layer a derived index. This amendment touches only the canonical-flow
bullets and the deferred note — the durable format (ADR-0017), the live
backend's contract (`memory-backend-contract.md`, #863), and everything
Amendment 1 already settled about the manifest, driver and symlink are
untouched. The feature-PR surfaces that make a record ride the branch today
(`pre-push:70`, `contributor-scaffold.mjs:274`, and three more, ADR-0034's
own inventory) retire in 3.1d — sequenced, not by this amendment.

### Notes for the promoter

All three `amend-find` anchors were verified to occur exactly once in the
target before this draft was written, against `main @ f8bdca52`. Promote
after ADR-0034 lands, so the amendment's own reference resolves to a real
file.
