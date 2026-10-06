---
status: draft
issue: 1124
---

# Tasks: #1124

- [x] **T1** RED: `brain-config.test.mjs`'s fresh-config assertion flipped to `lite`. It failed
      with `expected: 'lite'`, and the file had `standard` (REQ-1124-1).
- [x] **T2** RED: `config-migrations.test.mjs` gains five #1124 tests. The file failed to load:
      `does not provide an export named 'NEW_CONSUMER_DEFAULTS'` (REQ-1124-2..4). The
      declared-tier and missing-key tests pin behaviour that already held; they are
      characterisation pins, and they went green with the export.
- [x] **T3** RED: `tier-notice.test.mjs` (9 tests) failed with `ERR_MODULE_NOT_FOUND` for
      `tier-notice.mjs` (REQ-1124-5, -6).
- [x] **T4** RED: `bootstrap.tier-notice.test.mjs` (2 tests), lifting `bootstrap.sh`'s own ensure
      line: the new consumer got `standard`, and the existing one printed no tier line
      (REQ-1124-5). Its `bash` spawn is allowlisted in `test-spawn-hygiene.test.mjs`
      (`no-vcs-capability`: the ensure step only reads `git remote get-url origin`).
- [x] **T5** GREEN: `NEW_CONSUMER_DEFAULTS` in `config-migrations.mjs`; `buildDefaultConfig()`
      merges it first.
- [x] **T6** GREEN: `lib/tier-notice.mjs`, the `config.tier.*` keys in `en.mjs` and `es.mjs`, and
      the notice wired into `brain-config.mjs`'s `ensure`. The first wiring used a top-level
      `await import()` and deadlocked on the import cycle (exit 13); now it is chained with
      `.then()` (design D3).
- [x] **T7** Full `npm test`: exit 0, 6438 tests, 6435 pass, 0 fail, 3 skipped.
      `npm run brain:repo:check`: exit 0.
- [x] **T8** `brain-drafts/adr-0026-amendment-8.draft.md`: `planAmendment` returns `ok: true`,
      with all six acts pending (status, three edits, body, HOME marker). Each of the three
      anchors: `f=1, r=0` (free = 1).
- [x] **T9** ADR-0036 check on the packed tarball (REQ-1124-7). Commands, from a scratch dir:

      ```
      npm pack --pack-destination $S                       # logikas-brain-1.7.0.tgz, 760 files
      git init -b main && git remote add origin https://github.com/acme/fresh.git
      # package.json: { "name": "fresh", "version": "0.0.0", "private": true }
      npm install $S/logikas-brain-1.7.0.tgz
      node node_modules/@logikas/brain/brain/scripts/brain-upgrade.mjs --no-install
      npm run brain:env:init </dev/null
      ```

      Fresh: upgrade exit 0, env:init exit 0, `governance.tier` = `lite`, and the log shows
      `✓ governance tier: lite — set for this new repository …`, the why line, and the
      change line.
      Existing, same tarball, `brain.config.json` written before install:
      `standard`@1.6.0 stays `standard` (no migrations pending), `regulated`@1.6.0 stays
      `regulated`, and a 0.8.0 config with no key has 0.9.0 through 1.6.0 applied and comes out
      `standard`. Each case's env:init prints `governance tier: <tier> — already declared …;
      left unchanged`.
      `npx brain init` was NOT usable as the apply step: it re-installed
      `github:csrinaldi/brain#v1.7.0` over the tarball (design D5). Reported separately.
- [x] **T10** SDD artefacts: `proposal.md`, `spec.md`, `design.md`, `tasks.md`.
- [ ] **T11** Maintainer: promote the amendment (`npm run brain:promote -- <draft>`) on this branch.
