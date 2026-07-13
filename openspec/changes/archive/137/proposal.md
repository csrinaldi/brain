# Proposal: Rename 8 package.json verbs to the `brain:` namespace (issue #137)

## Intent

8 of brain's package.json scripts lack the `brain:` prefix every other verb
carries: `env:init`, `day:start`, `ticket:start`, `project:feature`,
`project:status`, `tracker:board`, `repo:check`, `change:verify`. The new
`brain:adopt` verb was born prefixed, spotlighting these 8 stragglers as a
namespace inconsistency. brain dogfoods its own conventions, so an
inconsistent script surface is a credibility and discoverability cost for
consumers. We adopt the **literal-prepend** scheme (`x:y` → `brain:x:y`,
zero collisions) to make the namespace uniform.

## Scope

### In Scope
- De-risk the 2 runtime call sites (`brain-check.mjs:131`,
  `verify-change.mjs:28`) to DIRECT `node brain/scripts/check-refs.mjs`
  invocation, removing all managed-script dependence on package.json verb names.
- Add 8 `brain:*` verbs to brain's package.json; KEEP the 8 old verbs as
  deprecated aliases (same script target) for the 0.8.0 minor.
- Repoint every reference: docs (README, adoption, inbox), i18n catalogs
  (`en.mjs`/`es.mjs`) + `coverage.test.mjs` in lockstep, managed methodology
  (`harness-contract.md` et al.), comments, and test fixtures.
- NEW capability: `package.json` specialMerge in the installer so
  `brain:upgrade` ADDITIVELY injects the new `brain:*` aliases into a
  consumer's package.json without overwriting any consumer-owned value.

### Out of Scope
- Removing the old verbs (deferred to a future MAJOR).
- Renaming verbs in OTHER namespaces (`memory:*`, `feature:*`, `test:*`,
  `tools:*` stay as-is).
- Any parked/unrelated work.

## Capabilities

### New Capabilities
- `package-json-merge`: additive, never-overwrite, idempotent injection of
  managed `brain:*` script keys into a consumer's package.json during
  `brain:upgrade` (installer `copyManaged` / specialMerge flow).

### Modified Capabilities
- None (verb rename is implementation + docs/i18n; no spec-level behavior
  change to existing capabilities beyond the new merge capability above).

## Approach (4 pillars)

1. **De-risk call sites** — switch the only 2 `npm run repo:check` programmatic
   invocations to direct `node` invocation (the existing house pattern). After
   this, NO managed script depends on a package.json verb name → the rename
   cannot break brain or consumers at runtime.
2. **Rename + dual-alias** — add 8 `brain:*` verbs; keep old 8 as deprecated
   aliases for 0.8.0. Design decides whether/how to warn on deprecated use.
3. **Repoint references** — docs, i18n (+ coverage tests lockstep), managed
   methodology, comments, fixtures.
4. **package.json specialMerge** — additive consumer migration in
   `installer.mjs` `copyManaged`, analogous to `mergeClaudeSettings`. This is
   the novel/risky pillar; isolate it.

## Slice Roadmap (chained PRs, each <400 lines)

| Slice | Scope | Risk |
|-------|-------|------|
| S1 | De-risk 2 call sites → direct `node` invocation + tests. No rename yet — safe foundation. | Low |
| S2 | Rename + dual-alias in brain's package.json + repoint comments/internal docs. | Low |
| S3 | Repoint i18n catalogs + coverage tests (lockstep) + user-facing strings (`gentle-ai.mjs`, `bootstrap.sh`). | Med |
| S4 | Repoint managed methodology (`harness-contract.md`) + README/docs/ADRs + test fixtures. | Low |
| S5 | package.json specialMerge capability in installer + fresh-install/upgrade integration tests. | High |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | 8 new `brain:*` verbs + 8 deprecated aliases |
| `brain/scripts/brain-check.mjs`, `verify-change.mjs` | Modified | Direct `node` invocation |
| `brain/scripts/i18n/*.mjs`, `coverage.test.mjs` | Modified | Verb strings + assertions (lockstep) |
| `brain/core/methodology/harness-contract.md` | Modified | Authoritative verb table (managed) |
| `brain/scripts/lib/installer.mjs` | New | specialMerge for package.json |
| `test/fixtures/*/package.json`, `test/{fresh-install,upgrade}/in-container.sh` | Modified | Verb names |
| README, docs/adoption.md, docs/inbox/* | Modified | Doc refs |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missed call-site update breaks consumers on upgrade | Low | S1 removes ALL managed-script verb dependence first |
| i18n `coverage.test.mjs` fails mid-change | Med | Strings + assertions changed in same slice (S3) |
| specialMerge overwrites consumer-owned package.json values | High | Never-overwrite + idempotent merge, integration-tested (S5) |
| ADR/historical files contain old verbs | Low | Historical records — read-only, not rewritten |

## Rollback Plan

Each slice is an independent PR. Revert S5 to drop the merge capability;
revert S2 to restore the original 8 verbs (aliases keep old names valid
throughout, so partial rollback never breaks runtime).

## Dependencies

- None external. Version bump 0.7.2 → 0.8.0 (minor; non-breaking due to
  dual-alias + additive consumer migration).

## Decisions (locked)

- Literal-prepend scheme; dual-alias deprecation (removal in a future MAJOR);
  direct-invocation de-risk; automated consumer migration via package.json
  specialMerge; version 0.8.0.

## Open Questions (for spec/design)

- Exact specialMerge semantics: key-injection rules, idempotency,
  never-overwrite guarantee.
- Whether/how to emit a deprecation warning on old verbs.
- Whether test fixtures keep old names or move to new names.

## Success Criteria

- [ ] All 8 `brain:*` verbs present; old 8 still work as aliases.
- [ ] No managed script invokes a package.json verb by name (`npm run <verb>`).
- [ ] i18n catalogs + coverage tests pass with new strings.
- [ ] `brain:upgrade` additively injects `brain:*` into consumer package.json
      without overwriting consumer values (integration-tested).
- [ ] `node --test` green; version 0.8.0.
