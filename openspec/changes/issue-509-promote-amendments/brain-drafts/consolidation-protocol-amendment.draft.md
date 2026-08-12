# `consolidation-protocol.md` §1c/§1d — draft correction (issue #509)

> **status:** Tier 2 draft. Not yet promoted. Two sentences in `consolidation-protocol.md` are
> written in the future tense about #509 ("until `brain:promote` gains the amendment path") and
> stop being true when this change lands. Leaving them is the #516 defect in miniature: doctrine
> describing a state of the world that no longer holds.
>
> **Promote it with the verb this change ships:**
>
> ```
> npm run brain:promote -- openspec/changes/issue-509-promote-amendments/brain-drafts/consolidation-protocol-amendment.draft.md
> ```
>
> A doctrine-document target takes no Status line and no `brain/HOME.md` marker — the acts are
> the in-place edits plus the `AGENTS.md` regeneration. **Your commit is the signature.**

```brain-amendment/1
target: brain/core/methodology/consolidation-protocol.md
issue: 509
```

```amend-find
So an amendment can land with the index still describing the previous version, and no gate
will say so. Until `brain:promote` gains the amendment path (#509), the three acts above and
this fourth one are convention held by whoever runs them.
```

````amend-replace
So an amendment can land with the index still describing the previous version, and no gate
will say so. That is still true of an amendment executed by hand.

What changed with #509 is that one path no longer lets you skip a step by accident:
`brain:promote` takes an amendment draft — a `*.draft.md` file carrying one `brain-amendment/1`
block naming its target and the passages it supersedes — and performs the three acts, this fourth
one and the §1d cascade in one run, then stages and stops. It derives the `brain/HOME.md` marker
from the same amendment number it writes into the Status line, so those two cannot disagree, and
it refuses outright when it finds the cascade half-applied rather than reporting success over the
missing acts. What it does NOT do is make a partial promotion impossible: it applies the whole
cascade or none of it, and anything already half-done is your repair, not its. Use it:

```
npm run brain:promote -- openspec/changes/<change-id>/brain-drafts/<name>.draft.md
```

**Off that path, you are still the enforcement.** A hand-run edit, or the next bespoke script,
is exactly as unguarded as it was before — no gate reads the marker.
````

```amend-find
Regenerate with `AGENT_PLATFORM=antigravity npm run brain:env:init`. Never hand-edit `AGENTS.md`.
```

```amend-replace
Regenerate with `AGENT_PLATFORM=antigravity npm run brain:env:init`. Never hand-edit `AGENTS.md`.
`brain:promote` does this step itself, for a new ADR (#378) and for an amendment (#509) alike —
a promoter written from THIS TEXT rather than from the verb is how the step gets lost, which is
what happened on #529 and failed the drift guard on the human's signing commit.
```
