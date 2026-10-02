# Proposal — #1114 every brain axis is selected by configuration behind a stable port, and a guard keeps it that way

## Problem
ADR-0024 says each axis (memory backend, agent platform, SDD engine, VCS provider, review engine) is selected by configuration and callers use the axis, never a concrete implementation. #123 closed without meeting that rule and nothing noticed. Today selection is resolved in four places with different precedence and defaults, `platform` and `sdd.engine` are undeclared in the config schema, and entrypoints still spawn or branch on concrete implementations (see `explore.md`).

## Intent
State the rule and enforce it: one guard that freezes every leak, one resolver, selectors declared in the schema, and ADR-0024's "Known state" corrected.

## Scope (slices)
- S1 guard + allowlist of today's offenders. Pure test and data, no behavior change. IMPLEMENTED.
- S3 the ADR-0038 config shape (`<axis>.default` + `<axis>.providers`) and its additive migrations, with one-minor aliases for the old keys; resolves #643, coordinates #807. Lands BEFORE S2. PENDING.
- S2 `lib/axis-registry.mjs` and one `resolveAxis`, migrating `resolvePlatform`, `resolveEngine/Harness`, `resolveProviderName`; every axis refuses when undeclared (ADR-0038 §3). PENDING.
- S4 per-offender fixes, owned by #1115, #864, #833, #1107, #1109. Each fix deletes its allowlist entry. PENDING (other tickets).
- S5 ADR-0038, drafted in `brain-drafts/`, promoted by a human (Tier 2); it names the ADR-0004/0008/0023/0024/0033 amendments, each its own later draft. DRAFTED.

## Non-goals
Fixing any offender in S1; a second "undeclared key" scanner (#807 owns that). (Superseded 2026-10-02: the platform `claude` default is removed by ruling, and every axis refuses when undeclared; see ADR-0038 and the S3-before-S2 order in `tasks.md`.)
