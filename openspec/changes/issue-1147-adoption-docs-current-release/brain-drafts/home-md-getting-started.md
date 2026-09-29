# Draft — `brain/HOME.md` "Getting started" section

**Tier 2 (agent-authorities.md): drafted here, not applied.** `brain/HOME.md` is
under `brain/`, and `AGENTS.md` is generated from it (`env:init` regenerates it,
drift-guarded by `antigravity.drift.test.mjs`) — an agent may draft the change,
only a human moves it into `brain/HOME.md` and regenerates `AGENTS.md`.

## Proposed change

In `brain/HOME.md`, under `## Getting started`, add two lines after the existing
adoption-guide entry:

```diff
 ## Getting started

 - [Adoption guide](../docs/adoption.md) — bring brain into a repo (new repo vs existing repo, step by step)
+- [Known limitations](../docs/KNOWN-LIMITATIONS.md) — open defects on the consumer path, each with a workaround if one exists
+- [Definition of done](../docs/definition-of-done.md) — what "done" means for brain 2.0, and how it maps to epic #1121's phases
```

## Why

`docs/adoption.md` now links both sibling docs from its own "Reference" section
(issue #1147), and both exist for the same reader `docs/adoption.md` is written
for — someone adopting or evaluating brain. `brain/HOME.md`'s "Getting started" is
the one place that reader is pointed at first; leaving the two new docs undiscoverable
from there defeats the point of writing them.

## After applying

Run `AGENT_PLATFORM=antigravity npm run brain:env:init` (or the project's normal
regeneration step) to regenerate `AGENTS.md` from the updated `brain/HOME.md`, so
the two stay in sync per the drift guard.
