---
status: draft
issue: 1127
---

# Tasks — #1127

- [x] **T1** Sweep the five areas and classify every site (design.md inventory).
- [x] **T2** RED then GREEN: `archive.mjs --backfill` reads the changes root through
      `listChangeFolders()` (`archive.test.mjs`).
- [x] **T3** RED then GREEN: `featureResume` rejects on a failed projection
      (`engram.feature.test.mjs`, two tests).
- [x] **T4** Share the source masker: extract `maskNonCode` from `test-spawn-hygiene.test.mjs`
      into `lib/mask-non-code.mjs`, add regex-literal handling.
- [x] **T5** The guard: `swallow-guard.test.mjs` (scan, allowlist-as-reason, orphan and stale
      checks, scanner proven on synthetic sources).
- [x] **T6** Mark every scoped site (`swallow-ok:` / `surfaced:` / `follow-up:`); own the sites
      #1155 / #1154 are rewriting via `OWNED_ELSEWHERE`.
- [x] **T7** Pin the `index-lag` claim: a corrupt index line reads as missing (`index-lag.test.mjs`).
- [x] **T8** Cold-review round: reasons rewritten to what the code does; `brain-upgrade` guard inputs
      (corrupt config, unreadable installed package, broken migrations module) refuse or warn;
      `featureCheckpoint` never overwrites an unreadable `resume.md`; `tryFeatureResume` keeps the summary.
- [x] **T9** Guard: embedded JS in shell, own-marker windows, strict self-explaining, shell evasions,
      `install-tools.sh` in scope; `install-tools.sh` provider and summary fixed (`install-tools.test.mjs`).
- [x] **T10** Round-2 review: incoming migrations module import-checked before the copy on every path;
      ERR_MODULE_NOT_FOUND for the module vs its imports; guard shell forms and per-catch windows;
      install-tools no-node provider scope; `tryFeatureResume` label only when the projection message is present.
- [x] **slice-A** bootstrap steps join `REQUIRED_FAILURES` (7 tests); `ensure` reports a corrupt config.
- [x] **T11** #1154/#1155 merged: `OWNED_ELSEWHERE` retired, every merged site marked with a reason
      that says exactly what it is (create-if-absent, portable stat fallback, ...).
- [x] **T12** Mutation-checked every guard rule and N1/N3 in a scratch clone; three survivors
      (per-catch trailing text, unscoped sed, empty-provider default) got tests that kill them.
- [x] **T13** Round 3 (blocker): memory steps classified by cause (engram binary, preflight, connectivity
      helper), config-parse REQUIRED by cause, `ensure` CLI exit pinned, hermetic e2e over the real
      `bootstrap.sh` (4 healthy scenarios exit 0, a real merge refusal exits 1), mutation-checked.
- [ ] **slice-B** `brain-upgrade` AGENTS.md regeneration failure vs the closing `Done.`.
- [ ] **slice-C** record readers: an unreadable records dir/file must not read as an empty store.
- [ ] **slice-D** installer walkers that fail open (`listFiles`, `escapesRoot`).
- [ ] **slice-E** sweep day-start, session-start, adopt, the VCS adapters and hooks (53 unmarked sites) and bring them into the guard.
