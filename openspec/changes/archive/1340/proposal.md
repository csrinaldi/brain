# Proposal: cut 1.12.0 (#1340)

## Problem
The release reporter measured `main` at `d731fbad`: 74 commits since v1.11.0 (13 feat, 36 fix, 25 internal) and one config migration, `1.11.1`, promoted above the published 1.11.0. The #1114 tracker merged in #1296. Its migration does nothing until a release ships it, and ADR-0038 removed the `claude` and `gentle-ai` code defaults, so an existing consumer depends on that migration to keep resolving its axes. Phase 2 of #1121 closes only on a published package (ADR-0036).

## Intent
- Release `main` as 1.12.0. New capabilities (ADR-0038's one shape per axis, ADR-0040's user layer, `locked`, `governance.owners` and the gate `team-config-reviewed`, the UI's in-flight home, progress rollups and worktree/origin SDD reading) are each a minor by the rule 1.6.0 to 1.11.0 applied. The migration is versioned 1.11.1, the smallest version above 1.11.0.
- State in the CHANGELOG, the adoption guide and the known limitations only what the code on `main` does. The breaking surface (an undeclared axis now refuses, the migration, the new required check, REFUSE-managed workflow files) goes first.
- Close the gap #1340 names: before publish, run the 1.11.0 to 1.12.0 upgrade by hand against `npm pack` of this commit, because `test:upgrade` tests published releases only (#1325).

## Scope
- `package.json` (no lockfile exists) and the README/adoption pins to 1.12.0; a new CHANGELOG entry; `docs/adoption.md` (axes must be declared, the user layer, `user-set`, `locked`, owners); `docs/KNOWN-LIMITATIONS.md` (#1281, #1339, #1334, the #1325 scope, the stale memory refusal text (#1341); #1190 is fixed and was already retired); the README adapters table.
- `claim-sweep.md`: every behavioural sentence of the new entry and each changed doc line, traced to code.
- Not in scope: tagging, pushing, publishing, the post-publish exit run, a fix for any finding listed in the known limitations.
