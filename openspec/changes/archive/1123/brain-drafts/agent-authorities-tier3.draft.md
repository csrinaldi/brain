# Amendment draft — `agent-authorities.md`, the self-approval rule becomes per autonomy mode (issue #1123)

> **Tier 2 draft. Not yet promoted.** `agent-authorities.md` is one of the `SOURCE_DOCS`
> compiled into `AGENTS.md`, and it is covered by CODEOWNERS ("changes to tiers require an MR
> with human review"). The maintainer promotes it, never an agent (agents never edit
> `brain/core/**`), and only AFTER ADR-0037 is promoted, because the replacement text cites it
> by number:
>
> ```
> npm run brain:promote -- openspec/changes/issue-1123-autonomy-modes/brain-drafts/agent-authorities-tier3.draft.md
> ```
>
> Promotion regenerates and stages `AGENTS.md`; its compiled copy of the tiers changes THROUGH
> this promotion, never by hand.
>
> Edit 1 touches a Tier 2 line, not only Tier 3: that line says the human reviews every MR
> before merging, which mode B contradicts. Leaving it would leave a reader with the superseded
> rule (`consolidation-protocol.md` §1c act 2).

```brain-amendment/1
target: brain/core/methodology/agent-authorities.md
issue: 1123
body: ## Autonomy modes (issue #1123)
```

## Edit 1 — Tier 2, "Create or merge an MR"

```amend-find
- **Create or merge an MR** — the human reviews the MR before merging
```

```amend-replace
- **Create an MR** — the human authorizes it; **merging** follows the declared autonomy
  mode (ADR-0037): in mode A the human reviews the MR and merges it; in modes B and C the
  agent does not merge, the platform does (see Tier 3)
```

## Edit 2 — Tier 3, "Approve or merge its own MR"

```amend-find
- Approve or merge its own MR
```

```amend-replace
- Approve or merge a change it produced, **in any autonomy mode** (ADR-0037). The producing
  identity (a commit author or the PR/MR author) is never the approver or the merger:
  - **mode A** — a human approves the intent and a human merges;
  - **mode B** (the default) — a human approves the intent; the platform merges, under the
    automation identity, only when every required gate passes and the cold review, posted by
    an identity other than the producer, approves; anything else escalates to the human;
  - **mode C** — an agent identity other than the producer may approve the intent, and the
    platform merges as in B; refused at tier `regulated`.

  No agent holds a merge verb in any mode, and the reviewer gains no approve or merge
  authority. The only exception is the solo maintainer at `lite` in mode A, who may merge a
  change produced under their own credential; it is reported as such, never as independent
```

## Autonomy modes (issue #1123)

**Signed**: DD/MM/YYYY — <Name>

### What changed

Tier 3's "approve or merge its own MR" becomes a rule per autonomy mode, and Tier 2's "the human
reviews the MR before merging" holds in mode A only. The invariant under both is unchanged in
substance and now stated for every mode: the identity that produced a change never approves or
merges it.

### Why

The flat rule asked an agent to remember it, and at `lite` the forge requires no approving
review, so nothing stopped an agent that held a merge path. It also named no way to run
automatically without the agent merging its own work. ADR-0037 separates who approves the
intent from who executes the merge, and makes the merger the platform, not the producer.

### What this does NOT close, said plainly

The rule is still doctrine until the identity gate (#1134) and the port's merge verb (#1133)
land. Until then mode B cannot be claimed and the effective mode is A: a human approves the
intent and a human merges. Brain reports the declared and the effective mode separately rather
than letting the default read as enforced.
