# Tasks — env:init labels, actor and lane notice (#1163, #1164, #1166)

- [x] 1. `labelCreate` port verb, both adapters, contract tests (red first), `VERBS`, drift-guard note, contract-row draft (#1163)
- [x] 2. `lib/env-init-setup.mjs`: `desiredLabels`, `ensureLabels`, `resolveBrainActor`, CLI; unit tests red first (#1163, #1164)
- [x] 3. Lane notice in `tier-notice.mjs` + en/es catalogs; tests red first (#1166)
- [x] 4. `bootstrap.sh` section 5b (`_setup_step`), failure classes, swallow-guard scope + markers; hermetic e2e (fake `gh`) red first (#1163, #1164, #1166)
- [x] 5. `docs/adoption.md`: the 1.9.0 manual steps only (#1163, #1164, #1166)
- [x] 6. `release-notes.md`: next-release text for the new behaviour
- [ ] 7. Maintainer: `brain:promote` the `labelCreate` row into `vcs-contract.md`; remove the drift-guard exception
