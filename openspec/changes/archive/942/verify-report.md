# Verify report — issue-942-deny-fail-closed (#943, closes #942)

**Verdict: PASS**

## Evidence (HEAD 7335552d)

- `loadBrainConfigOrThrow` primitive: `brain/scripts/lib/brain-config.mjs:77`.
- Deny readers propagate (no `catch`): `actor-check.mjs:1109`, `brain-writes-reviewed.mjs:259,284`, `approve/cli.mjs:124,139`.
- Tier-aware catch (R6/R7): `brain-writes-reviewed.mjs:338` (`resolveTierForFailure`), `:475-481` (fail/warn by tier), stale "detection-only" docstring corrected (`:423`).
- `approve/cli.mjs` refusal shape wraps the throw in `say('✗ …'); return done(1)` per R5.
- Doctrine draft present, unpromoted: `brain-drafts/deny-readers-fail-closed.draft.md` (R2).
- Focused tests: `lib/brain-config.test.mjs` + `vcs/actor-check.test.mjs` + `vcs/brain-writes-reviewed.test.mjs` + `approve/cli.test.mjs` → **256/256 pass**.

## Deliberately left undone

- English-only refusal strings (R10) — blocked on #715, documented in the code and draft.
- `brain-drafts/deny-readers-fail-closed.draft.md` is an unpromoted amendment — needs maintainer `brain:promote`.
- `config-parses` governance job (R9) — explicit follow-up ticket, not this change.

No CRITICAL / WARNING. Fresh adversarial review (F1-F3) already answered in apply-progress; re-confirmed on this branch.
