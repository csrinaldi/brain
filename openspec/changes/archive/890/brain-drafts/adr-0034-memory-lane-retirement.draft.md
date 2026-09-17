# ADR-0034 Amendment 3 — draft (issue #890)

> **Tier 2 draft. Not yet promoted.** ADR-0034 is signed and stands at Amendment 2.
>
> ```
> npm run brain:promote -- openspec/changes/issue-890-retire-feature-pr-memory-surfaces/brain-drafts/adr-0034-memory-lane-retirement.draft.md
> ```
>
> **L6/L7 completed 2026-09-17 (issue #890).** The five feature-PR memory surfaces L6/L7 named
> as "sequenced" retirement targets are retired: `pre-push` no longer runs `brain:memory:share`
> or inspects `.memory/`, `brain:save` is deleted with no shim, `brain:next`'s
> memory-materialization state is replaced by issue-scoped record detection, and the
> `ticket.nextSteps`/PR-template wording points at `brain:memory:save --issue N` and the lane.
> This repository sets `memory.lane.enabled: true`. `memory-gate` evaluation and its
> base-plus-head classification (L6) are unchanged. See `openspec/changes/
> issue-890-retire-feature-pr-memory-surfaces/{proposal,design}.md`.

```brain-amendment/1
target: brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md
amendment: 3
issue: 890
home-summary: the five feature-PR memory surfaces L6/L7 named (`pre-push` share, `brain:save`, `brain:next`'s materialization state, `ticket.nextSteps`/PR-template wording) are retired; `memory-gate` is unchanged; this repository sets `memory.lane.enabled: true`, #890
body: ## Amendment 3 — the feature-PR memory surfaces retire; the lane is enabled (issue #890)
body-end: ### Notes for the promoter
```

## Amendment 3 — the feature-PR memory surfaces retire; the lane is enabled (issue #890)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

3.1d completes: the five feature-PR surfaces L6/L7 named — `pre-push`'s `brain:memory:share`
call and its dirty-`.memory/` warning, `brain:save` (command, implementation, and package
script), `brain:next`'s memory-materialization state, and the `ticket.nextSteps`/PR-template
wording — are retired. This repository sets `memory.lane.enabled: true` (a local,
repository-specific decision; the config schema's own migration default is unchanged).
`pre-push` now only checkpoints feature working memory and runs the repository
reference/prohibition checks; it materializes nothing and inspects no `.memory/` state. A
capture is a record first (`npm run brain:memory:save --issue N`), and the enabled lane
collects and ships it to `main` on its own pull request, independent of the feature PR's review
timeline — L6/L7's "sequenced" plan is now complete, not merely scheduled.

### What this does NOT change

`memory-gate`'s evaluation and its base-plus-head classification (L6) are unchanged — this
amendment retires the feature-PR transport surfaces, not the gate that reads the PR tree.
`brain:memory:share` is unaffected as a verb: it remains the backend's own materialization
command (`brain:day:start`'s cycle, or run by hand); it is simply no longer invoked from
`pre-push`. L1-L5, L8, L9, the targets and the dependency order are untouched.

### Notes for the promoter

Three anchors in this ADR were verified to occur exactly once each on this branch with
`assessEdit` (`free = 1`): the L6/L7 heading, the "Only the PR template's wording changes"
sentence, and the "five feature-PR surfaces" sentence. `brain/HOME.md`'s index line already
carries Amendments 1-2; this promotion appends the Amendment 3 marker after them via
`amendHomeLine`'s existing `; ` join before the closing paren — no manual edit needed there.

## Act 1 — the L6/L7 heading

```amend-find
### L6 / L7 — `memory-gate` is unchanged; the feature-PR surfaces retire, sequenced
```

```amend-replace
### L6 / L7 — `memory-gate` is unchanged; the feature-PR surfaces retired (issue #890 — see Amendment 3)
```

## Act 2 — the PR-template wording sentence

```amend-find
`memory-gate` reads the PR **tree**, not the diff — a feature PR rebased on a
`main` that already carries the lane's record for its issue passes the scoped
gate **unchanged**. Only the PR template's wording changes (3.1d): from
*"captured with `memory:share` (renamed `brain:memory:share`; see Amendment 1)"* to *"captured as a record (`memory:save
--issue N`) (renamed `brain:memory:save`; see Amendment 1); it reaches `main` on the lane"*.
```

```amend-replace
`memory-gate` reads the PR **tree**, not the diff — a feature PR rebased on a
`main` that already carries the lane's record for its issue passes the scoped
gate **unchanged**. Only the PR template's wording changes (3.1d): from
*"captured with `memory:share` (renamed `brain:memory:share`; see Amendment 1)"* to *"captured as a record (`memory:save
--issue N`) (renamed `brain:memory:save`; see Amendment 1); it reaches `main` on the lane"*. **[Amended by Amendment 3 (#890) — this wording change shipped with the retirement below; the PR template now reads the "captured as a record" form.]**
```

## Act 3 — the five feature-PR surfaces sentence

```amend-find
`pre-push:70`'s `share` call, `ticket.nextSteps.step3` (en/es),
`brain-save.mjs`, `contributor-scaffold.mjs:274`, and `day.done.checkCmd` are
the five feature-PR surfaces that make a record ride the branch today. They
retire in 3.1d, and **not before**: only after 3.1b's first scenario ("a
record does not wait for its feature") has passed, **and** after #874
(record-first: `memory:save` (renamed `brain:memory:save`; see Amendment 1) writes a record before any backend, under
`MEMORY_BACKEND=engram` too) has landed. Retiring them earlier would leave a
capture with nowhere to go the moment the lane is not yet proven.
```

```amend-replace
`pre-push:70`'s `share` call, `ticket.nextSteps.step3` (en/es),
`brain-save.mjs`, `contributor-scaffold.mjs:274`, and `day.done.checkCmd` are
the five feature-PR surfaces that make a record ride the branch today. They
retire in 3.1d, and **not before**: only after 3.1b's first scenario ("a
record does not wait for its feature") has passed, **and** after #874
(record-first: `memory:save` (renamed `brain:memory:save`; see Amendment 1) writes a record before any backend, under
`MEMORY_BACKEND=engram` too) has landed. Retiring them earlier would leave a
capture with nowhere to go the moment the lane is not yet proven. **[Amended by Amendment 3 (#890) — all five surfaces are retired: `pre-push` no longer calls `share` or inspects `.memory/`; `brain-save.mjs` is deleted with no shim; `brain:next`'s memory-materialization state is replaced by issue-scoped record detection; `ticket.nextSteps` and the PR-template wording point at `brain:memory:save --issue N` and the lane. See Amendment 3 below.]**
```
