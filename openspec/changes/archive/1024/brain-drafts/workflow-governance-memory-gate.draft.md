# Amendment draft — `workflow-governance.md`, memory-gate's tier-scoped default-branch read and skip override (issue #1024)

> **Tier 2 draft. Not yet promoted.** `workflow-governance.md` is one of the five `SOURCE_DOCS`
> compiled into `AGENTS.md` (`brain/scripts/harness/backends/antigravity.mjs:36-42`). The
> maintainer promotes it AFTER this PR merges — never before, and never by an agent (agents
> never edit `brain/core/**`):
>
> ```
> npm run brain:promote -- openspec/changes/issue-1024-memory-gate-pr-context/brain-drafts/workflow-governance-memory-gate.draft.md
> ```
>
> Promotion regenerates and stages `AGENTS.md` — its compiled copy of this file's gate table
> and skip-label column changes THROUGH this promotion, never by hand.
>
> Historical, no edit: ADR-0014's own text (`:66`) and
> `brain/project/decisions/../evidence-reader-empty-on-failure.md:14` (if either exists in a
> consumer's tree) describe the PRE-#1024 state as a historical record of what shipped at the
> time, not a standing claim — they are not amended here (see `README.md` in this directory).

```brain-amendment/1
target: brain/core/methodology/workflow-governance.md
issue: 1024
```

## Edit 1 — Invariant 3's table row (`workflow-governance.md:23`)

```amend-find
| 3 | `.memory/` has EVER held a session summary (repo-scoped) | `memory-gate` _(S4)_ | _(none — `skip:memory-gate` is named but unimplemented)_ | Soft — see below |
```

```amend-replace
| 3 | Repo-scoped when no issue is detectable; otherwise issue-scoped over the PR tree plus `origin/<default>` (#1024) | `memory-gate` _(S4)_ | `skip:memory-gate` — honored at `standard` by a non-author, refused at `regulated`, not consulted at `lite` (#1024) | Soft — see below |
```

## Edit 2 — "repo-scoped and permanently satisfied" / "Nothing enforces per-change capture" (`workflow-governance.md:42-49`)

```amend-find
**It is repo-scoped and it is permanently satisfied.** `memoryPresence` asks whether ANY
`session_summary` observation exists in `.memory/records/`. There are 205. The gate therefore
passes on every PR regardless of whether that PR captured anything, and it will keep passing if
nothing is ever captured again.

**Nothing enforces per-change capture.** The PR template's "Memory materialized before closing"
is a promise the checklist makes and no gate keeps. Read invariant 3 as *"this repository has a
memory layer"*, never as *"this change was remembered"*.
```

```amend-replace
**It is repo-scoped only when no issue is detectable from the PR/MR description; otherwise it
is issue-scoped over the union of the PR tree and `origin/<default>` (#1024).** When
`ci-context.mjs`'s `loadContext()` can resolve an issue number, `memoryRetrieval()` requires a
record scoped to that issue in either tree — a record that reached the default branch on its
own lane PR (ADR-0034) satisfies a feature PR closing the same issue, with no rebase. Only when
no issue number can be resolved does the gate fall back to `memoryPresence`'s repo-wide
question — whether ANY `session_summary` observation exists anywhere in `.memory/records/`.

**Per-change capture is enforced when an issue is detectable.** The PR template's "Memory
materialized before closing" is now backed by the scoped check above whenever the pipeline can
resolve the issue; it remains an unenforced promise only in the repo-scoped fallback case (no
issue detectable).
```

## Edit 3 — "`skip:memory-gate` does not exist in code" (`workflow-governance.md:55-57`)

```amend-find
**`skip:memory-gate` does not exist in code.** No path checks for it. It is listed here and in
`AGENTS.md` as documentation of an intent, and `brain:metrics` counts its usage raw without ever
subtracting it. Applying the label changes nothing.
```

```amend-replace
**`skip:memory-gate` is real, per tier (#1024).** `memory-gate-override.mjs#decideMemoryGateOverride`
honors it ONLY at the `standard` tier (`TIER_PARAMS.honorSkipMemoryGate`), and only when the
applier — the latest `add` event's actor — differs from the PR author and is not listed in
`governance.reviewActors`/`governance.agentActors` (mirrors `actor-check`'s own distinct-actor
rule). At `regulated` the label is refused, consistent with `regulated` refusing
`size:exception`. At `lite` it is noted in the output and not consulted, because the gate is
detection-only there. `brain:metrics` reports it as `raw/honored`, not a raw count alone.
```

## Edit 4 — the #529 sequence paragraph (`workflow-governance.md:59-62`)

```amend-find
**This is a ruling, not a resting place** (issue #529). The sequence is: #530 makes capture a
mechanism rather than a habit → `skip:memory-gate` becomes real → invariant 3 tightens to
recency. Tightening it before the writer is reliable would block every PR with no override,
which is how a gate teaches people that gates are obstacles.
```

```amend-replace
**This is a ruling, not a resting place** (issue #529). The sequence is: #530 makes capture a
mechanism rather than a habit → `skip:memory-gate` becomes real → invariant 3 tightens to
recency. Tightening it before the writer is reliable would block every PR with no override,
which is how a gate teaches people that gates are obstacles. **Step 2 done (#1024)**: the
tier-scoped override above and the union read that makes a strict scoped check safe without
forcing a rebase. Recency (the rest of step 3) remains — this change activates `GATE_MATRIX`'s
`required` evidence at `standard`/`regulated` but does not tighten the evidence form itself.
```

## Edit 5 — the metrics rows (`workflow-governance.md:236`, `:262-267`)

```amend-find
| `size:exception` / `skip:memory-gate` usage | Raw count of merges whose PR carries the label, by period |
```

```amend-replace
| `size:exception` usage / `skip:memory-gate` usage (raw / honored) | `size:exception`: raw count of merges whose PR carries the label, by period. `skip:memory-gate`: raw count of merges whose PR carries the label, AND how many of those `decideMemoryGateOverride` actually honored (#1024) |
```

```amend-find
- **`skip:memory-gate` is documented, not enforced.** The label is named in
  `AGENTS.md` and this file, but no code path anywhere checks for it or exempts
  anything on its presence — unlike `size:exception`, which `diff-size` genuinely
  honors. `brain:metrics` reports `skip:memory-gate` usage as a RAW label count only
  and **never subtracts it** from an enforced count — subtracting it would invent an
  exemption that does not exist in code.
```

```amend-replace
- **`skip:memory-gate` is enforced at `standard` only (#1024).** `memory-gate` is not in
  `PER_PERIOD_GATES` (design D3 — it is a repo-level signal, not a per-period series), so there
  is no enforced-failure count to subtract an honored skip from. `brain:metrics` reports it as
  `raw/honored`: raw is every merge whose PR carried the label; honored is the subset
  `decideMemoryGateOverride` actually honored (a non-author applier, at the `standard` tier),
  with a by-author breakdown mirroring `size:exception`'s own table.
```

### Notes for the promoter

Five edits, six `amend-find`/`amend-replace` pairs (Edit 5 has two). Every anchor above was
copied verbatim from `brain/core/methodology/workflow-governance.md` at commit `02896d69` and
is expected to occur exactly once in the target (`assessEdit` → `free === 1`). This draft makes
no `brain/HOME.md` act — `workflow-governance.md` is an in-place methodology doc, not an ADR,
so promotion is Edit-only, plus the standard `SOURCE_DOCS` `AGENTS.md` regeneration (§1d act 3,
unconditional for any of the five `SOURCE_DOCS`).

ADR-0014 `:66` and `evidence-reader-empty-on-failure.md:14` (if present in a consumer's tree)
are historical records of the pre-#1024 state and receive no edit — see `README.md` in this
directory.
