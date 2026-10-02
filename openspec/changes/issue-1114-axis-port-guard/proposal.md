# Proposal — #1114 every brain axis is selected by configuration behind a stable port, and a guard keeps it that way

## Problem
ADR-0024 says each axis (memory backend, agent platform, SDD engine, VCS provider, review engine) is selected by configuration and callers use the axis, never a concrete implementation. #123 closed without meeting that rule and nothing noticed. Today selection is resolved in four places with different precedence and defaults, `platform` and `sdd.engine` are undeclared in the config schema, and entrypoints still spawn or branch on concrete implementations (see `explore.md`).

## Intent
State the rule and enforce it: one guard that freezes every leak, one resolver, selectors declared in the schema, and ADR-0024's "Known state" corrected.

## Scope (slices)
- S1 guard + allowlist of today's offenders. Pure test and data, no behavior change. IMPLEMENTED.
- S2 `lib/axis-registry.mjs` and one `resolveAxis`, migrating `resolvePlatform`, `resolveEngine/Harness`, `resolveProviderName`. PENDING (needs a ruling on defaults).
- S3 config migration declaring `platform` and `sdd.engine`; resolves #643, coordinates #807. PENDING.
- S4 per-offender fixes, owned by #1115, #864, #833, #1107, #1109. Each fix deletes its allowlist entry. PENDING (other tickets).
- S5 ADR-0024 Amendment 3, drafted in `brain-drafts/`, promoted by a human (Tier 2). PENDING.

## Non-goals
Fixing any offender in S1; a second "undeclared key" scanner (#807 owns that). (Superseded 2026-10-02: the platform `claude` default is removed by ruling, and every axis refuses when undeclared; see ADR-0038 and the S3-before-S2 order in `tasks.md`.)
