# Tasks — #466 + #474

## 1. Design (blocking — decided before any code)

- [x] 1.1 Enumerate `brain-audit`'s terminal states from source (design §1)
- [x] 1.2 Locate #474's lost signal (design §2)
- [x] 1.3 Rule on #466 with the excluding authority (design §3)
- [x] 1.4 Rule on #474 with the excluding authority (design §4)
- [x] 1.5 Prove the two rulings agree (design §5)
- [x] 1.6 Map the blast radius, all consumers named (design §7)
- [x] 1.7 Flag the #480 interaction rather than adapting silently (design §8)

## 2. #474 — uncomputable is a first-class state (REQ-TS-1/-2/-3)

- [x] 2.1 `fetchPrMeta` returns `prMetaError`; the bare `catch {}` stops
      discarding it
- [x] 2.2 `brain-audit` skips evaluation on `prMetaError`, emits
      `[UNCOMPUTABLE]`, and exits 2 when the count is ≥1
- [x] 2.3 `vcs === null` warns once (REQ-TS-3); `prNum === null` unchanged
- [x] 2.4 `brain-metrics` routes `prMetaError` into its existing `uncomputable`
      bucket, exit code unchanged
- [x] 2.5 Tests, incl. the `c724942` unauthenticated scenario as fixture

## 3. #466 — the unrevertible halt (REQ-TS-4)

- [x] 3.1 `revert` step: zero offenders files `governance:audit-unrevertible`,
      pins the cursor, fails the job
- [x] 3.2 Test by executing the SHIPPED step, not by reading the YAML

## 4. The invariant, structurally (REQ-TS-5)

- [x] 4.1 Every alarm path records `alarm=` in `$GITHUB_OUTPUT`
- [x] 4.2 `terminal` step files a backstop alarm when red with no alarm recorded
- [x] 4.3 Property test over the workflow: red ⟹ an alarm was filed

## 5. Verification by mutation

- [x] 5.1 Disable each new protection, confirm the suite reddens, restore
- [x] 5.2 Record which tests reddened for each mutation
- [x] 5.3 Full `npm test`, `npm run repo:check`, `npm run brain:nav`
