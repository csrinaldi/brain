# ADR-0034 Amendment 4 — draft (issue #936)

> **Tier 3 target. Not promoted, and not promotable by an agent.**
>
> ```
> npm run brain:promote -- openspec/changes/archive/936/brain-drafts/adr-0034-amendment-4.draft.md
> ```
>
> The verb renders the plan, waits for the typed word, performs the edits, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops. **Your commit
> is the signature** (ADR-0028). Source note: `adr-0034-l2-auto-merge-note.md` in this folder.

```brain-amendment/1
target: brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md
amendment: 4
issue: 936
home-summary: observed, not a policy change — this repository has `allow_auto_merge: false`, so `mrAutoMerge` is refused at every tier and a `lite` lane PR waits for a human merge like `standard`; whether to enable the setting or amend L2 is deferred to epic #864 task 6.1, #936
body: ## Amendment 4 — `lite` does not auto-merge in this repository (issue #936)
body-end: ### Notes for the promoter
```

```amend-find
| `lite` | 0 | `mrAutoMerge` (2.5) enables auto-merge on green |
```

```amend-replace
| `lite` | 0 | `mrAutoMerge` (2.5) enables auto-merge on green — **not in this repository while `allow_auto_merge` is off; see Amendment 4** |
```

## Amendment 4 — `lite` does not auto-merge in this repository (issue #936)

**Signed**: DD/MM/YYYY — <Name>

### What was observed

On 2026-09-19 `gh api repos/csrinaldi/brain` reported `allow_auto_merge: false`. GitHub
therefore refuses `mrAutoMerge` at every tier. `shipLane`
(`brain/scripts/memory/lane/ship.mjs`) records the refusal as `autoMerge.enabled: false` and
does not fail. Lane PR #1075 shows it: `"autoMerge":{"enabled":false,"reason":"unsupported"}`.
In practice, tier `lite` in this repository behaves like `standard` and `regulated`: every
lane PR waits for a human merge.

### What this does NOT change

L2's table still describes the intended behavior in a repository that allows auto-merge. C1,
the `lane-scrub` requirement, and the tier contract are unchanged. No code changes.

### Open decision

Whether to enable `allow_auto_merge` or amend L2's table is deferred to epic #864 task 6.1.

### Notes for the promoter

Only the `lite` row of L2's table is annotated in place. Nothing else in the body changes.
