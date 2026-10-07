# Apply progress — #1076 (strict TDD)

| Step | RED (before) | GREEN (after) |
|---|---|---|
| Generated list + classifier (`test/retired-test-paths.e2e.test.mjs`) | `ERR_MODULE_NOT_FOUND` for `test/tools/retired-test-paths.mjs`, then for `retired-test-paths.mjs`: 0 pass / 1 fail | 4 pass / 0 fail |
| Tarball excludes test infra (`test/publish-allowlist.e2e.test.mjs`) | 4 fail: no-test-infra, retired-absent, patterns present, canary (10.43 MB vs the new bound) | 10 pass / 0 fail; tarball 361 files, 3.99 MB (was 933 / 10.43) |
| RETIRED_PATHS guard (`installer.retired.test.mjs`) | `brain/scripts/__fixtures__/promote-repo.mjs is declared retired but brain still has it` | 9 pass / 0 fail (strict for hand-kept entries, "test infra, excluded" for generated) |
| `port-coverage` refusal | 2 fail (`contractSuiteMissing` undefined; CLI exits 0 with a table) | 30 pass / 0 fail |

End-to-end (scratch consumer, registry 1.12.1 -> this package, SAVED 1.12.1 `brain-upgrade.mjs --no-install`): test files under `brain/scripts` 449 -> 0 (a consumer-owned `my-own.test.mjs` survived: 1 -> removed by hand for the next check); consumer-edited `installer.test.mjs` was removed and named in the "Removed 554 file(s) brain no longer ships" report (existing behaviour); `brain:repo:check` passes; bare `node --test` reports `tests 0`; `brain:session:start` runs; `port-coverage.mjs` refuses with exit 1.
