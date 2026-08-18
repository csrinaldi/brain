## Linked issue (required)

Closes #709

## Chain context

**Terminal PR of a feature-branch-chain.** This is the only PR of #709 that targets the
default branch, and the only one that closes the issue. It exists as a draft from the
start, deliberately: a chained delivery that stops halfway is invisible, because every
gate fires on a PR and the defect is a PR that was never opened (open issue #713).

```
main
 └── feature/issue-709 ....................... 📍 THIS PR (terminal, Closes #709)
      └── fix/issue-709-declaring-selector ... PR #720 (selector)
           └── (splitter branch) ............. PR 2 (blocked by #720 — D0)
```

| Child | Unit | State |
|-------|------|-------|
| #720 | Selector: the fence tag declares, not an interior scalar; ADR-0032 promoted | open |
| — | Splitter: CommonMark-correct `fenced-blocks.mjs` + the 14-axis matrix | not opened — blocked by #720 (D0) |

**Do not mark ready until both children have merged into `feature/issue-709`.** The
splitter is the load-bearing half by ADR-0032's own Decision: the tag is a narrowing,
not the fix. Landing the selector alone and closing #709 would report a finished change
with its stated fix missing.

**Why a tracker at all**, when the tasks phase recommended `stacked-to-main`:
`issue-link` accepts `Part of #N` only when a PR's base is not the default branch. Under
`stacked-to-main`, the selector PR would have had to carry `Closes #709` and would have
closed the issue on merge with the splitter unbuilt. The tracker also satisfies design
D0 slightly better — both halves reach `main` in a single merge, so the window where the
splitter exists without the tag selector never opens at all.

## Pull request type

- [ ] New feature (`type:feature`)
- [x] Bug fix (`type:bug`)
- [ ] Documentation only (`type:docs`)
- [ ] Code refactoring (`type:refactor`)
- [ ] Maintenance / tooling (`type:chore`)
- [ ] Governance / process (`type:governance`)

## Summary

- Lands #709 on `main`: the graph block is declared by its fence tag, and the shared
  fence splitter agrees with the renderer that produced the text it reads.
- Integration only — this PR authors no change of its own. Its diff is exactly the
  union of its children.

## Changes

| File | Change |
|------|--------|
| — | None authored here. See #720 and the splitter PR for the per-unit tables. |

## Diff size budget

- [x] Diff is under the tier's budget (or `size:exception` label added with justification — not available at `regulated`)

Integration PR: its diff is the sum of children already reviewed under their own
budgets. #720 carries a maintainer-accepted `size:exception`.

## Decision / ADR

- [ ] No architectural decision involved
- [x] ADR added (`brain/project/decisions/adr-NNNN-*.md`) and indexed in `brain/HOME.md`

ADR-0032, promoted and signed by @crinaldi in #720 (`a4262ec`).

## Test plan

- [ ] `npm test` passes (all unit tests green) — re-run on the integrated tracker before ready
- [ ] `npm run brain:repo:check` passes
- [ ] `npm run brain:nav` passes (no orphans, no broken links)
- [ ] Manually verified: `brain:epic:map --dry-run` shows no fabricated edge with BOTH halves present

Unticked on purpose. These are integration checks — they mean something only once both
children have landed on this branch, and ticking them now would assert a verification
that has not run.

## Contributor checklist

- [x] Linked an approved issue on the reference line above (#709 carries `status:approved`)
- [x] Exactly one `type:*` label added, from the list above
- [x] Diff size within the tier's budget (or `size:exception` labelled and justified)
- [x] Conventional commit format (`type(scope): description`, no AI-attribution trailers)
- [ ] Session memory captured with `npm run memory:share` — done per child; re-synced before ready
