# Verify report — issue-712-config-scan-fail-closed (#944, closes #712)

**Verdict: PASS**

## Evidence (HEAD 7335552d)

- All four call sites wired to `loadBrainConfigOrThrow` (no `catch`, R3/R4):
  `memory/lane/collect.mjs:101`, `memory/backends/engram.mjs:463`,
  `memory/backends/plainfiles.mjs:50`, `governance/lane-scrub.mjs:70`.
- `lane-scrub.mjs` refuses `uncomputable` (exit 2), read kept after the
  `recordPaths.length === 0` early return (R8) — matches proposal's call-site table.
- Focused tests: `memory/lane/collect.integration.test.mjs` +
  `memory/backends/engram.save.test.mjs` + `memory/backends/plainfiles.save.test.mjs` +
  `governance/lane-scrub.test.mjs` → **73/73 pass**.

## Deliberately left undone

- Refusal messages are English-only pending #715 (R10) — no new i18n keys, `i18n/coverage.test.mjs` untouched.
- `#942`'s `brain-drafts/deny-readers-fail-closed.draft.md` remains unpromoted (shared dependency, not this change's artifact).
- `memory:search` / other read paths (R11) — out of scope by evidence, no fail-open exists there.

No CRITICAL / WARNING.
