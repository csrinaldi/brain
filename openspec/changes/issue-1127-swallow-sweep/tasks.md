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
- [ ] **slice-A** (after #1155 lands) bootstrap steps, `auth-login || warn` and the three embedded
      snippets join `REQUIRED_FAILURES`.
- [ ] **slice-B** `brain-upgrade` AGENTS.md regeneration failure vs the closing `Done.`.
- [ ] **slice-C** record readers: an unreadable records dir/file must not read as an empty store.
- [ ] **slice-D** installer walkers that fail open (`listFiles`, `escapesRoot`).
- [ ] **slice-E** sweep day-start, session-start, adopt, the VCS adapters and hooks (53 unmarked sites) and bring them into the guard.
