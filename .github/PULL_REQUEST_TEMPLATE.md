## Linked Issue (required)

<!--
Every PR must reference an approved issue.
Valid keywords: Closes, Fixes, Resolves (case-insensitive).
The linked issue MUST carry the `status:approved` label.
CI will reject PRs without this reference.
-->

Closes #

## PR Type

<!-- Check exactly ONE box and add the matching type:* label. -->

- [ ] New feature (`type:feature`)
- [ ] Bug fix (`type:bug`)
- [ ] Documentation only (`type:docs`)
- [ ] Code refactoring (`type:refactor`)
- [ ] Maintenance / tooling (`type:chore`)
- [ ] Breaking change (`type:breaking-change`)

## Summary

<!-- 1–3 bullet points describing what this PR does. -->

-

## Changes

| File | Change |
|------|--------|
| `path/to/file` | what changed |

## Diff Size Budget

<!--
Default budget: 400 changed lines (additions + deletions), excluding:
  .memory/**, openspec/changes/**, package-lock.json, pnpm-lock.yaml, yarn.lock

If this PR exceeds 400 lines, add the `size:exception` label and explain why
splitting was not feasible. CI will block merges over budget without it.
-->

- [ ] Diff is under 400 lines (or `size:exception` label added with justification)

## Decision / ADR

<!--
If this PR introduces an architectural or process decision:
  1. Add an `adr-NNNN-<slug>.md` under `brain/project/decisions/`
  2. Update `brain/HOME.md` to index the new ADR
  3. Add the `decision` label to this PR

CI will enforce this when the `decision` label is present.
-->

- [ ] No architectural decision involved
- [ ] ADR added (`brain/project/decisions/adr-NNNN-*.md`) and `brain/HOME.md` updated

## Test Plan

- [ ] `npm test` passes (all unit tests green)
- [ ] `npm run repo:check` passes
- [ ] `npm run brain:nav` passes (no orphans, no broken links)
- [ ] Manually verified the changed functionality

## Contributor Checklist

- [ ] Linked an approved issue (`Closes|Fixes|Resolves #N`)
- [ ] Exactly one `type:*` label added
- [ ] Diff size within budget (or `size:exception` labelled and justified)
- [ ] Conventional commit format (`type(scope): description`, no AI-attribution trailers)
- [ ] Memory materialized before closing (`npm run memory:share` or `skip:memory-gate` label)
