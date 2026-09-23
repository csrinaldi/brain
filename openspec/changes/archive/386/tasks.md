---
status: draft
issue: 388
---

# Tasks — #386 · #387 · #388

- [x] **T1** (#386) `gitlab.repoCloneUrl` defaults `host` to `gitlab.com`.
- [x] **T2** (#387) `github.patSetupUrl` builds from `host || 'github.com'`.
- [x] **T3** (#388) `enc` on `name` and per scope; `encPath` per project segment; both providers.
- [x] **T4** The three `PINNED NOT FIXED` locks inverted, keeping their call sites and naming
      the defect they used to hold.
- [x] **T5** Three new properties: a falsy host still defaults on `patSetupUrl` · the scope comma
      stays a separator · a slug keeps its slashes.
- [x] **T6** Full suite: **2943 tests, 0 failures**.
- [x] **T7** Five mutations RED, one per property.

## Recorded

- [x] **T8** The first `encodeURIComponent` pass turned `providers.test.mjs`'s
      `github.patSetupUrl builds settings URL` red on `read:user` → `read%3Auser`. That is a
      real decision, not an oversight: I checked whether a narrower encoder should spare `:`
      and chose not to hand-roll one. `URLSearchParams` encodes `:` identically, so both
      standard options agree; the test's literal is updated with the reasoning attached rather
      than the encoder weakened to fit it.
