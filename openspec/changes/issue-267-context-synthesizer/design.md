---
status: draft
issue: 267
---

# Technical Design — Intelligent Context Synthesizer (Issue #267)

## Architecture Overview

The Intelligent Context Synthesizer operates as a pure Node.js module under `brain/scripts/context/`.

```
brain/scripts/context/
├── synthesizer.mjs        — Pure core synthesizer engine (file matcher, term indexer, failsafe floor)
├── synthesizer.test.mjs   — Unit & contract tests
└── cli.mjs                — CLI entrypoint for npm run brain:context:compile
```

## Data Flow

```
[Git Changed Files / Target Files]
               │
               ▼
   [synthesizer.mjs (Core Floor + Scanner)]
               │
               ├─ 1. Always load brain/core/ methodology (Core Floor)
               ├─ 2. Match touched files vs brain/project/decisions/ ADRs
               ├─ 3. Match touched files vs .memory/records/*.jsonl
               ├─ 4. Apply Empty-Match Failsafe if 0 targeted matches
               │
               ▼
   [.brain-context.md / resume.md Hydration]
```

## Failsafe Policy & Enum

```js
export const FAILSAFE_MODES = Object.freeze({
  CORE_FLOOR: 'core_floor',
  FULL_FALLBACK: 'full_fallback',
});
```

When no specific ADR or memory record matches the active branch diff, `synthesizer.mjs` selects `FAILSAFE_MODES.CORE_FLOOR`, appending `brain/core/` methodology summaries to ensure zero doctrine omission without token bloat.
