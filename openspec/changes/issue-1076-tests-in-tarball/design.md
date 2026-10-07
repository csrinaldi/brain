# Design — #1076

- Exclusion: eight negated entries after `brain/scripts` in `files` (`**/*.test.mjs`, `**/__fixtures__`, `**/test-support`, `**/fixtures`, plus the four helpers `lib/hermetic-box.mjs`, `lib/test-brain-home.mjs`, `lib/test-tmp.mjs`, `test-hygiene.mjs`; each verified to have no runtime importer). `vcs/fixtures` and `axes/sdd-engine/fixtures` are plain `fixtures` dirs read only by tests and `port-coverage.mjs`.
- Prune as data: `retired-test-paths.mjs` (generated, 599 exact paths, union over tags v1.0.0..v1.12.1 of paths matching `isTestInfraPath`) is folded into `RETIRED_PATHS`. No glob (a consumer's own test file under `brain/scripts/**` must survive) and no new upgrader logic (the installed upgrader is the old one).
- Only released tags feed the list: suites that never shipped have nothing to prune, and a HEAD-following list would drift on every new suite.
- Generator and classifier live in `test/tools/retired-test-paths.mjs` (repo-only, never shipped); `npm run retired:test-paths` rewrites, `--check` verifies; `test/retired-test-paths.e2e.test.mjs` regenerates and compares (skips when tags are not fetched).
- Existing installer behaviour kept: retired paths are removed even if modified, reported by name, recoverable via the restore point and git; `local` protects.
- `port-coverage.mjs`: `contractSuiteMissing()` plus a CLI refusal.
