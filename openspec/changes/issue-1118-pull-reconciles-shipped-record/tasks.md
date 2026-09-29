# Tasks: pull reconciles the shipped record

- [x] 1. Reuse the real-git fixtures (`__fixtures__/pull-fixture.mjs`) and the
      `ref` parameter of `upstreamRecordEntries` (with unit tests).
- [x] 2. RED then GREEN, real git, in `reconcile-pull.integration.test.mjs`:
      (a) F10 reconciles and ends tracked; (b) no upstream; (c) `@{u}` lacks
      the path; (d) different bytes refused; (e) diverged with `pull.ff=only`
      and with stock config; (f) race plus never-overwrite; (g) nothing stored
      outside working tree and object store.
- [x] 3. Wire the shared `defaultGitPull` into `plainfiles.mjs#pull` and
      `engram.mjs#pullMemory`; adapter end-to-end tests.
- [x] 4. `npm test`, `brain:repo:check`, `brain:nav`.
