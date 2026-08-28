# harness-contract.md — the worktree is the DEFAULT, not a flag (issue #782)

> **status:** Tier 2 draft. Not yet promoted. `harness-contract.md` is a signed
> `brain/core/**` artefact and a SOURCE_DOC of `AGENTS.md`, so an agent may not commit
> it — `brain/core/anti-patterns/ia-escribe-brain-sin-gate.md`.
>
> ```
> npm run brain:promote -- brain-drafts/harness-contract-worktree-default.draft.md
> ```
>
> The verb renders the plan, waits for the typed word, performs the in-place edits and the
> §1d cascade (a regenerated `AGENTS.md`), stages them, and stops.
> **Your commit is the signature** (ADR-0028).
>
> **Until this is promoted, one test in this PR is RED on purpose** —
> `brain/scripts/lib/ticket-args.test.mjs`'s contract drift guard. That is the guard
> working: the code and the row must land together or the suite says they disagree.

```brain-amendment/1
target: brain/core/methodology/harness-contract.md
issue: 782
body: ## Worktree default (issue #782)
body-end: ### Notes for the promoter
```

```amend-find
| `npm run brain:ticket:start -- <id> --worktree --base <tracker>` | `ticket:start -- <id>` | `/ticket-start <id>` | Task start. Creates the branch `{type}/issue-{number}-{slug}` in an ISOLATED WORKTREE off `<tracker>`. **Always an isolated worktree; NEVER a branch in the main checkout when parallel work is possible.** `<tracker>` is the integration base (e.g. `feature/v2.0.0`), not `main`, while an epic is in flight. |
```

```amend-replace
| `npm run brain:ticket:start -- <id> [--base <tracker>]` | `ticket:start -- <id>` | `/ticket-start <id>` | Task start. Creates the branch `{type}/issue-{number}-{slug}` in an ISOLATED WORKTREE off `<tracker>` — **that is the DEFAULT, no flag required (#782)**. **Always an isolated worktree; NEVER a branch in the main checkout when parallel work is possible.** `--in-place` is the named opt-out, for strictly solo serial work only, and the verb says which mode it took. `<tracker>` is the integration base (e.g. `feature/v2.0.0`), not `main`, while an epic is in flight. |
```

```amend-find
> **Worktree convention (load-bearing):** task start is
> `npm run brain:ticket:start -- <id> --worktree --base <tracker>`. The isolated worktree is
> mandatory whenever parallel work is possible — it gives one-branch-per-worktree isolation
> over a shared object store (single fetch, zero extra clone). A branch in the main checkout
> is only acceptable for strictly solo, serial work. This rule prevents the whole team from
> colliding on one working tree.
```

```amend-replace
> **Worktree convention (load-bearing):** task start is
> `npm run brain:ticket:start -- <id> [--base <tracker>]`, and **the isolated worktree is what
> that does with no flags** (#782). It is mandatory whenever parallel work is possible — it
> gives one-branch-per-worktree isolation over a shared object store (single fetch, zero extra
> clone). A branch in the main checkout is only acceptable for strictly solo, serial work, and
> is reached by asking for it: `--in-place`. This rule prevents the whole team from colliding
> on one working tree.
>
> **The flag used to be required, and that was the defect (#782).** This row said *always* while
> the verb defaulted to the branch the row calls NEVER, so satisfying doctrine depended on
> remembering a flag. Measured: an agent session on 2026-08-27 created five branches in the main
> checkout with `AGENTS.md` loaded and this rule in it. `--worktree` still parses and still means
> what it meant; it is simply no longer load-bearing.
>
> **What still has no reader.** Nothing refuses `git checkout -b` in the main checkout. The
> default is the cheap half; #782's remaining slices are a guard that refuses, and the shape
> where the orchestrator owns isolation so an agent cannot express the wrong thing — which is
> what `cold-boot.mjs` already does for the cold-review producer.
```

## Worktree default (issue #782)

**Signed**: DD/MM/YYYY — <Name>

### What changed

The `brain:ticket:start` row and the worktree convention note stop prescribing `--worktree`.
The isolated worktree is what the verb does with no flags; `--in-place` is the named opt-out
for the strictly solo, serial case the convention already allowed.

### Why

The row said **always** and the verb defaulted to the opposite. `ticket-start.mjs:29` read
`argv.includes('--worktree')`, so the plain spelling — the one an operator or an agent types —
created a branch in the main checkout, which this same row calls NEVER. Doctrine and
implementation disagreed, and nothing compared them.

That is not hypothetical. An agent session on 2026-08-27 (PRs #777–#781) created **five**
branches in the main checkout with `AGENTS.md` loaded and this rule inside it. Nothing broke
because the work was serial and single-agent — luck, not correctness — and it still cost a
`git stash` mid-rebase, because the shared working tree carried local modifications a per-issue
worktree could not have collided with.

### What this does NOT close, said plainly

Nothing refuses a hand-rolled `git checkout -b` in the main checkout, which is what actually
happened. This amendment removes the requirement to REMEMBER; it does not make the wrong thing
unexpressible. #782's slices 2 and 3 own that — a guard that refuses, and the orchestrator
owning isolation the way `cold-boot.mjs` already does for the cold-review producer.

Recorded here rather than left implicit, because a doctrine row that reads as if the problem
were solved is the failure mode this ticket is an instance of.

### Notes for the promoter

Two `amend-find`/`amend-replace` pairs: the verbs table row, and the convention note below it.
Each anchor occurs exactly once in the target.

`harness-contract.md` is one of `AGENTS.md`'s five SOURCE_DOCS, so the §1d cascade regenerates
it. `antigravity.drift.test.mjs` asserts byte-equality and runs under `npm test` — the verb does
the regeneration; never hand-edit `AGENTS.md`.

This target is not an ADR, so there is no `brain/HOME.md` index marker and no amendment number.
