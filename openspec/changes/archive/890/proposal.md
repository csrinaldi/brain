# Proposal: Retire Feature-PR Memory Transport

## Intent

Complete ADR-0034 L6/L7 after record-first capture (#874), lane governance (#889), artifact retirement, and the first records-only lane merge (PR #1000). Feature branches stop committing team-memory records; records reach `main` through the lane.

## Scope

### In Scope
- Enable `memory.lane.enabled: true` for this repository.
- Remove `brain:memory:share` and dirty-`.memory/` guidance from feature `pre-push`; preserve checkpointing and repository checks.
- Retire `brain:save` permanently, including its command, tests, and `brain:next` dependency.
- Rewrite operator guidance to capture with `brain:memory:save --issue N` and ship on the lane.
- Update tests and draft canonical-doctrine changes for human promotion.

### Out of Scope
- Changing `memory-gate`, lane classification, secret scanning, merge policy, or `brain:memory:share` internals.
- Reworking feature `resume.md` checkpoint/resume behavior.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `feature-working-memory`: pre-push keeps checkpoint automation but stops transporting durable records.
- `governance`: `brain:save` and `brain:next`'s memory-materialization state retire.

## Approach

Apply one atomic retirement: remove the five ADR-named surfaces and direct dependents. Keep the correct contributor-scaffold wording and unchanged `memory-gate` as regression checks. Use reviewable commits in one PR; request a size exception only if required.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/hooks/pre-push` | Modified | Remove record transport; retain checkpoint/checks. |
| `brain/scripts/brain-save.mjs`, `package.json` | Removed | Delete the retired golden-path verb. |
| `brain/scripts/brain-next.mjs` | Modified | Remove the obsolete memory-materialization state. |
| `brain/scripts/i18n/`, setup/docs | Modified | Point delivery to the lane. |
| `brain.config.json` | Modified | Enable automatic lane shipping. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Records stall after fallback removal | Low | Enable the lane and retain manual `brain:memory:ship`. |
| Hidden `brain:save` references break users | Medium | Caller scan plus focused tests. |
| Atomic diff exceeds review budget | Medium | Minimize generated churn; obtain explicit exception if required. |

## Rollback Plan

Revert the retirement PR, restoring `brain:save`, feature pre-push transport, guidance, and prior configuration together. Leave lane governance and record-first storage intact.

## Dependencies

- ADR-0034/#862 ruling; #874 and #889 merged; artifact retirement merged.
- PR #1000 proves a records-only lane reaches `main` with required checks green.

## Success Criteria

- [ ] Feature pushes never invoke `brain:memory:share` or request `.memory/` commits.
- [ ] `brain:save` has no command, implementation, caller, or active documentation.
- [ ] Automatic lane shipping is enabled and feature checkpointing remains intact.
- [ ] The first subsequent feature PR adds zero records and passes unchanged `memory-gate`.
