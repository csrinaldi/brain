# Proposal: cut 1.13.0 (#1384)

Parent: #1121 (Phase 2).

## Problem
The release reporter (#860) measured `main` at `92919742`: 16 commits since v1.12.1 (3 feat, 10 fix, 3 internal), and #1383 (#1076) was approved and waiting to merge; it merged as `4f00469e`, which is where this cut starts. No config migration is pending above 1.12.1 (`brain/core/config-migrations.mjs` ends at `1.12.1`). Phase 2 of #1121 closes only on a published package (ADR-0036).

## Intent
- Release `main` as 1.13.0. New capabilities, each a minor: `hydrate` as the bulk lifecycle verb of every memory backend (#1115, #1189), the platform and review-engine contracts with descriptors and a derived registry (#1128, #1129), the UI memory ledger (#1313) and lane cards (#1312).
- State in the CHANGELOG only what the code on `main` does, with the destructive step first: the first `brain:upgrade` deletes 554 files (449 of them test files) from each consumer (#1076).
- Run the upgrade by hand against `npm pack` of this commit with the PREVIOUS upgrader before publishing (lesson of #1344), for a 1.12.1 consumer and for a consumer whose config 1.12.0 stamped without the axis shape.

## Scope
`package.json` and the README/adoption pins to 1.13.0; the CHANGELOG entry; `docs/KNOWN-LIMITATIONS.md` (adds #1352, #1353, #1355, #1362, #1374; nothing to remove: the file never carried #1115 or #1189); `docs/adoption.md` (the upgrade deletes test files); README's `memory:pull` and `npm test` rows; `claim-sweep.md`.

## Not in scope
Tagging, pushing, publishing, the post-publish exit run, any fix for a listed limitation, the removal of the `import` alias (#1351).
