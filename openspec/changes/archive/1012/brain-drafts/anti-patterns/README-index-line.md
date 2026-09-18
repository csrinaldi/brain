# Promotion notes — for the maintainer

These drafts live under this change's `brain-drafts/`, not under `brain/`. Promotion
is a Tier 2 action the maintainer performs; this change does not touch `brain/**`.

## 1. The anti-pattern file

Copy `test-spawns-a-live-entrypoint.md` (this folder) verbatim to
`brain/core/anti-patterns/test-spawns-a-live-entrypoint.md`. The draft already has
the shape of the existing files: title, `Discovered in` / `Applies to`, then the body
sections. It carries no draft-only scaffolding to strip.

## 2. The README index line

Target file: `brain/core/anti-patterns/README.md`. Append after the last bullet under
`## Registered` (currently `- [The red-proof is blind along an axis the mutation never
varies](red-proof-blind-along-an-unvaried-axis.md)`), before the closing
`> Only generic harness anti-patterns...` note:

```markdown
- [A test spawns a live entrypoint and trusts configuration to keep it harmless](test-spawns-a-live-entrypoint.md)
```

## 3. After promotion

`brain/HOME.md` indexes the generic anti-patterns and `AGENTS.md` is compiled from it;
if the new file must appear there, regenerate with
`AGENT_PLATFORM=antigravity npm run brain:env:init` and confirm
`node --test brain/scripts/harness/backends/antigravity.drift.test.mjs` is green.
Run `npm run brain:nav` to confirm the new file is linked and not an orphan.
