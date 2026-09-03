---
issue: 810
phase: design
---

# Design — #456 slice B

## D1 — doctrine before behaviour

ADR-0019 Amendment 5 is the authorisation Amendment 1 withheld. It rides this
PR as a draft; the human promotes it (same ceremony as ADR-0023 in #832). Its
content maps each of Amendment 1's four conditions to the enforcing code:
condition 1 (one layout) → same change dir + `resolveStageSet` file map;
condition 2 (neutral verification) → gates read the resolved set, no engine in
the read path; condition 3 (boundary-indistinguishable) → S2's
`assertRoutedStage` + S4's engines route custom stages already; condition 4
(refusal replaced, not removed) → the three refusals + collision guard in
`resolveStageSet`, and the gate's demand for a DECLARED artefact.

## D2 — the gate's set: tier scopes the four, declaration demands the rest

`runPhaseOrderCheck` resolves `artefacts` as: walk the declared stage order
(`resolveStageSet(config).stages`), keep a lifecycle stage only if
`tierParams(tier).artefacts` keeps it, keep every custom stage. Interleaving
is preserved because the declared order is walked, not concatenated.
`resolveStageSet` throwing (a malformed declaration) is an uncomputable
verdict, not a crash — same posture as the existing unknown-tier path.

## D3 — the generic presence probe

`buildChangeDir` today returns fixed `has*` flags probed from fixed files. It
grows `present: Record<name, boolean>` computed from the RESOLVED file map for
every walked name; `ARTEFACT_FIELD` lookups fall back to `present[name]` for
names outside the fixed map. Legacy flags stay — every existing test and
consumer reads them unchanged.

## D4 — scaffold reads the same resolver, NOT the same config reader

`new-change.mjs` imports `resolveStageSet` and reads `brain.config.json`
directly (inline `readFileSync` + `JSON.parse`, degrade to `{}`), NOT via
`brain-config.mjs`'s `loadBrainConfig`: the script's test fixture copies it
together with `sdd-layout.mjs` ALONE, and importing the shared reader drags
brain-config → repo + installer + config-migrations into a fixture that
promises none of them — the exact #555 module-drag trap governance-tiers.mjs
documents. Accepted tradeoff (round-1 editorial): this is a third
read/parse/degrade copy in the tree; it stays because the drag is worse than
the copy, and the degrade contract is pinned by a test on each side. Custom
artefacts get one generic stub template (front matter: issue, stage; one
heading). The four keep their existing template bytes — zero-config runs
produce byte-identical output (S6-R1 scenario 1 pins it).

## D5 — archive: pin, don't change

`archiveChange` already moves the dir whole. One test pins the custom artefact
riding the move. No logic change unless the pin fails.

## D6 — what stays apart (REQ-L4-2′ redux)

SCAFFOLD = full declared set. GATE = tier-scoped four ∪ declared customs.
check-refs/checkpoint DEMAND = tier-scoped four only (unchanged). Three sets,
three owners, asserted in tests in both directions.
