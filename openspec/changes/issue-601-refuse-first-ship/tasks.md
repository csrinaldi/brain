---
status: draft
issue: 601
---

# Tasks — REFUSE protects a first-ship path (issue 601)

- [x] `firstShipOwned` computed in the classification pass, guarded on
      `outgoing !== null`
- [x] Fed into the existing REFUSE gate, so `--force-managed` covers it by
      construction
- [x] The characterization test that PINNED the defect (#570, "MEASURED: REFUSE
      does not protect…") went red on the fix, exactly as it was written to —
      replaced with four tests asserting the real behaviour
- [x] `managed-paths.mjs` REFUSE comment corrected; no ratified row changed
- [x] Full suite: **3627 pass / 0 fail** (1 pre-existing skip)
- [x] Mutation ×2, revert byte-identical:
      M1 drop the `outgoing !== null` guard → **1 red** (the degraded case)
      M2 stop feeding `firstShipOwned` into the gate → **2 red**

## Kept separate from `consumerModified`, deliberately

A caller reporting "you modified this" about a file brain never shipped would be
stating something it cannot know. The two lists carry different evidence and the
return shape keeps `consumerModified` meaning exactly what it meant.
