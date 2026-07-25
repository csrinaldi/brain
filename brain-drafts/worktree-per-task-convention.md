# DRAFT for human co-promotion (#216) — worktree-per-task convention

**Why this draft exists:** the worktree-per-task convention lived only in chat/engram.
Antigravity (E1 kickoff) read `AGENTS.md` — compiled from `harness-contract.md`, whose
`brain:ticket:start` row literally says *"creates the branch … from main"* — and correctly
started a common branch in the main checkout. The human corrected it by hand. Doctrine:
**what is not in the canonical docs does not govern.** Memory gives context; the emitted
docs give conduct (Exp 1/4: agents obey what they READ).

**Co-promotion (agent drafts, human promotes — never an agent commit into the doc zone):**
this file is the draft. A human MR applies the two edits below into the canonical docs, then
regenerates `AGENTS.md`.

---

## Edit 1 — `brain/core/methodology/harness-contract.md` (a SOURCE_DOC of AGENTS.md)

Replace the `brain:ticket:start` row (currently line 28) so the Responsibility cell reads:

```
| `npm run brain:ticket:start -- <id> --worktree --base <tracker>` | `ticket:start -- <id>` | `/ticket-start <id>` | Task start. Creates the branch `{type}/issue-{number}-{slug}` in an ISOLATED WORKTREE off `<tracker>`. **Always an isolated worktree; NEVER a branch in the main checkout when parallel work is possible.** `<tracker>` is the integration base (e.g. `feature/v2.0.0`), not `main`, while an epic is in flight. |
```

And add a convention note directly under the Required-verbs table (mirroring the existing
"Naming note" style):

```
> **Worktree convention (load-bearing):** task start is
> `npm run brain:ticket:start -- <id> --worktree --base <tracker>`. The isolated worktree is
> mandatory whenever parallel work is possible — it gives one-branch-per-worktree isolation
> over a shared object store (single fetch, zero extra clone). A branch in the main checkout
> is only acceptable for strictly solo, serial work. This rule prevents the whole team from
> colliding on one working tree.
```

## Edit 2 — the HOME/global instruction layer (mirror, by hand until F2 unifies the emitter)

Add the same convention to `CLAUDE.md` (project instructions) so the Claude-Code inhabitant
reads it too. This is a SECOND, hand-maintained copy of one rule — see the F2 argument below.

## Edit 3 — regenerate `AGENTS.md`

After Edit 1 lands, run `SDD_HARNESS=antigravity node brain/scripts/harness/cli.mjs init` to
recompile `AGENTS.md`. The drift-guard (`antigravity.drift.test.mjs`) will FAIL until this is
done — the chain-guard enforces it on its own; do not hand-edit `AGENTS.md`.

---

## F2 argument (record this)

This fix touches TWO emitters for ONE rule: `harness-contract.md` → `AGENTS.md` (Antigravity)
AND `CLAUDE.md` (Claude Code), maintained separately by hand. That divergence is exactly what
**F2 (the unified generated agent-context emitter)** should collapse: one canonical source,
N harness-specific emitted files, no hand-mirrored conventions. Every hand-copied rule is a
future drift bug. Cite this episode when F2 is scoped.
