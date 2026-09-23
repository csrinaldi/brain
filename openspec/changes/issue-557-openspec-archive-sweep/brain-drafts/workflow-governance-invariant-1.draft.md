# Amendment draft: `workflow-governance.md`, invariant 1 (`issue-link`) and its two content-earned exemptions (issue #557)

> **Tier 2 draft. Not yet promoted.** `workflow-governance.md` is one of the five `SOURCE_DOCS`
> compiled into `AGENTS.md` (`brain/scripts/harness/backends/antigravity.mjs#SOURCE_DOCS`). The
> maintainer promotes it. An agent never does, because agents never edit `brain/core/**`:
>
> ```
> npm run brain:promote -- openspec/changes/issue-557-openspec-archive-sweep/brain-drafts/workflow-governance-invariant-1.draft.md
> ```
>
> Promote it after ADR-0035 (`adr-0035-archive-sweep-issue-link-exemption-is-content-earned.md`
> in this directory), because the text below cites it. Promotion regenerates and stages
> `AGENTS.md`. Its compiled copy of this file's gate table changes through promotion, never by hand.

```brain-amendment/1
target: brain/core/methodology/workflow-governance.md
issue: 557
```

## Edit 1: invariant 1's table row

The row says `issue-link` is "not skippable" and gives it no qualifier. That is still true of
labels, but two diff-proven exemptions now exist: `memory/*` (ADR-0034) and `auto-archive/*`
(ADR-0035).

```amend-find
| 1 | Every PR links an approved ticket | `issue-link` | _(none — not skippable)_ | Hard |
```

```amend-replace
| 1 | Every PR links an approved ticket — except a lane PR whose diff earns the exemption (ADR-0034, ADR-0035) | `issue-link` | _(none — no label bypasses it)_ | Hard, with two content-earned exemptions — see below |
```

## Edit 2: a new "Invariant 1 scope" section, placed before invariant 3's

Invariants 3 and 4 each have a scope section. Invariant 1 now needs one too. The anchor is
invariant 3's heading. The replacement puts the new section in front of it and then repeats the
heading unchanged.

```amend-find
### Invariant 3 scope — what `memory-gate` does and does not check
```

```amend-replace
### Invariant 1 scope — two content-earned exemptions, never a branch-name exemption

**"Not skippable" means no label bypasses `issue-link`.** Invariant 3 has `skip:memory-gate`;
invariant 1 has no `skip:issue-link`. That does not mean the check never yields. Two narrow lanes
are exempt from the closing-keyword requirement, and both follow one rule: **the branch name is a
claim, never the proof. The diff is recomputed and checked before the exemption is granted.**

| Lane | Branch claim | Content proof, recomputed from `BASE...HEAD` | Decision · predicate |
|---|---|---|---|
| Memory | `memory/<host>-<date>` | every changed path is an ADDED `.memory/records/*.jsonl` file | ADR-0034 L1 · `checks/lane.mjs#classifyLane` |
| Archive sweep | `auto-archive/<date>` | at least one exact-content (`-M100%`, `R100`) rename `openspec/changes/<name>/…` → `openspec/changes/archive/<iid>/…` with the same relative path. Otherwise only added files under `openspec/changes/archive/**`, and new or pure-addition (zero deleted lines) `openspec/specs/<capability>/spec.md` | ADR-0035 · `checks/archive-sweep.mjs#classifySweepDiff` |

Both are wired into `run-check.mjs#runIssueLinkCheck` in the same shape. The branch regex is
tested first, so a non-lane head never touches git. The diff predicate runs next, inside a
`try`. A pass is returned only when the predicate proves the lane. A head that claims a lane
but whose diff fails the proof falls through to the ordinary rule: a closing keyword on the
default branch. It is never exempted silently. An uncomputable diff also falls through, and is
never reported as `uncomputable`.

**Why not a label.** Both lanes are opened by unattended automation, a memory collector and a
post-merge sweep, with no human in the loop to apply one. A label that automation applies to
its own pull request is the spoofable shortcut this rule exists to prevent. Recomputing the
proof costs less than trusting the claim.

**Not exempt: `auto-revert/*`.** The post-merge auto-revert opens `auto-revert/<sha>` against
the default branch with `Part of #259.` and no closing keyword, so `issue-link` refuses it. A
revert has no fixed diff shape for a path predicate to check. ADR-0035 names this gap and leaves
it open.

### Invariant 3 scope — what `memory-gate` does and does not check
```

## Edit 3: the enforce-outputs table row

```amend-find
| A ticket link exists and has `status:approved` | Whether the ticket describes the right work |
```

```amend-replace
| A ticket link exists and has `status:approved`, unless the diff earns a lane exemption (invariant 1 scope) | Whether the ticket describes the right work |
```

### Notes for the promoter

Three edits, three `amend-find`/`amend-replace` pairs. Every anchor was copied verbatim from
`brain/core/methodology/workflow-governance.md` at `origin/feature/issue-557-archive-sweep`
(`0367a32d`), and each occurs exactly once in the target (`assessEdit` → `free === 1`). This
draft makes no `brain/HOME.md` act, because the target is a methodology doc, not an ADR. Promotion
is the three edits plus the `AGENTS.md` regeneration that is unconditional for a `SOURCE_DOCS`
file (§1d act 3).
