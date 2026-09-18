# Amendment draft — `consolidation-protocol.md` §5, pre-push stops transporting memory (issue #890)

**For**: `npm run brain:promote -- openspec/changes/issue-890-retire-feature-pr-memory-surfaces/brain-drafts/consolidation-protocol-memory-lane.draft.md`

> Drafted by agent, applied by the maintainer via `brain:promote` (Tier 2 doctrine).
> ADR-0034's feature-PR memory surfaces (L6/L7) are retired as of issue #890: `pre-push` no
> longer runs `brain:memory:share` or inspects `.memory/`, `brain:save` is deleted with no shim,
> and this repository sets `memory.lane.enabled: true`. `memory-gate` evaluation is unchanged.

## Why

§5 (Memory Synchronization) still told a reader that "until the memory lane (#862) exists,
records still travel with the branch" and instructed running `brain:memory:share && git add
.memory/` before pushing, and that pre-push "runs `brain:memory:share` and warns, never blocks."
All three claims are now false: the lane is enabled in this repository, `pre-push` is
checkpoint-and-checks only, and `brain:save`/the dirty-`.memory/` guard are gone. A reader who
never scrolls to §5's own lane paragraph below is left believing feature branches still
transport records.

```brain-amendment/1
target: brain/core/methodology/consolidation-protocol.md
issue: 890
```

## Act 1 — the pre-push transport paragraph

~~~amend-find
A capture made in session is a record first (`npm run brain:memory:save --issue N`, rule 2). Until the memory lane (#862) exists, records still travel with the branch — before pushing:

```bash
npm run brain:memory:share && git add .memory/ && git status
```

The **pre-push hook** (`brain/scripts/hooks/pre-push`) runs `brain:memory:share` and **warns, never blocks**, when `.memory/` holds uncommitted records. `.engram` is the engram adapter's gitignored symlink (ADR-0002 Amendment 1): it is never added and never committed. The hook auto-installs via `core.hooksPath`; `git push --no-verify` remains the emergency escape.
~~~

~~~amend-replace
A capture made in session is a record first (`npm run brain:memory:save --issue N`, rule 2). Since the feature-PR memory surfaces retired (issue #890, ADR-0034 Amendment 3), this repository sets `memory.lane.enabled: true` and a captured record reaches `main` on the lane's own pull request — never the feature branch, and with nothing to run by hand before pushing.

The **pre-push hook** (`brain/scripts/hooks/pre-push`) checkpoints feature working memory and runs the repository reference/prohibition checks; it no longer runs `brain:memory:share` and holds no `.memory/` check of any kind. `brain:memory:share` remains the backend's own materialization verb (`brain:day:start`'s cycle, or run by hand) — it is simply not invoked from `pre-push` anymore. The hook auto-installs via `core.hooksPath`; `git push --no-verify` remains the emergency escape.
~~~

## Act 2 — the "surfaces retire in 3.1d" caveat

```amend-find
The surfaces that make a record ride the feature branch today retire in 3.1d, sequenced — see the caveat above, which this amendment does not touch.
```

```amend-replace
The five surfaces that used to make a record ride the feature branch retired in 3.1d (issue #890, ADR-0034 Amendment 3): the caveat above now describes the lane as the only transport, not a pending transition.
```

### Notes for the promoter

Both anchors verified to occur exactly once on this branch with `assessEdit` (`free = 1`). Act 1
is wrapped in `~~~` (tilde) fences, not backtick fences, because its anchor and replacement both
quote example shell commands with backtick spans and the original anchor also contains a fenced
` ```bash ` block — a backtick-fenced `amend-find` block cannot contain another backtick fence
without closing early (`fenced-blocks.mjs`, § \"backtick and tilde are peers and never close each
other\"); tilde sidesteps that. Act 2's anchor and replacement contain no fences, so it keeps the
plain backtick convention every other promoted draft uses.

This target is `brain/core/methodology/consolidation-protocol.md`, a plain doctrine document, not
an ADR under `brain/project/decisions/` — no `amendment:`/`home-summary:`/`body:` keys apply
(the parser rejects them on a non-ADR target). Only `target:` and `issue:` are declared.
