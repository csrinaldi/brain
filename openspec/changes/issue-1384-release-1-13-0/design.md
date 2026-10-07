# Design — #1384

Same shape as the 1.12.0 and 1.12.1 cuts: one release commit (version, CHANGELOG, doc pins), the docs commit, then the OpenSpec trail. No code changes.

## No migration
`brain/core/config-migrations.mjs` ends at `1.12.1` (line 259). The upgrade restamps `schemaVersion` to the installed version when nothing applies (`brain-upgrade.mjs:693-697`, `installer.mjs:1561`), observed as `1.12.1` to `1.13.0` with `Config already up to date`.

## The deletion
The removal list is data in the incoming package (`lib/retired-paths.mjs:87`, folding in the generated `lib/retired-test-paths.mjs`). The upgrader a consumer already has reads it (`brain-upgrade.mjs:485-486`), so the prune needs no new upgrader. The CHANGELOG states that the list has no per-file opt-out: `local` and the REFUSE/MERGE paths are exempt (`installer.mjs:1156-1157`), and none lies under `brain/scripts/`.

## Proof
Scratch consumers `p113/a` (registry 1.12.1) and `p113/c` (registry 1.11.0 taken to 1.12.0 by its own upgrader, which reproduces the stamped-unmigrated state), each upgraded with `npm i` of `npm pack` of this tree and the upgrader the consumer already held (`--no-install`, as in 1.12.1's proof).

## Tarball canary
`test/publish-allowlist.e2e.test.mjs` carries 4.4 MiB. The version string does not move the size; measured 4.2 MB unpacked by `npm pack` (361 files).
