# Spec — #1114 axis-port guard (S1 requirements; S2-S5 stated for context)

- REQ-1 The guard scans production `.mjs` under `brain/scripts/**`, excluding tests, `axes/*/adapters/**`, i18n catalogs and fixtures.
- REQ-2 It reports three rules after masking comments, strings, templates and regex bodies: `spawn-concrete:<tool>` (engram, gentle-ai, gh, glab, codex, gemini), `adapter-import` (a concrete adapter imported from outside its axis), `axis-branch` (a comparison, `case` or `.includes()` on a concrete axis value).
- REQ-3 Axis values are derived from the adapter directories and cross-checked against the exported closed sets; they are not retyped.
- REQ-4 The allowlist is keyed by file + rule with `{ max, owner, reason }`. `owner` is an issue reference or `legitimate`; every reason is one specific sentence.
- REQ-5 The guard fails on: an uncovered hit; a count above `max`; a stale entry; a count below `max` (debt only shrinks); an empty or placeholder reason; a debt owner that is not an issue reference.
- REQ-6 A masker desync is detected (unbalanced brackets); the scan falls back to a template-aware masker and fails naming the file if that is also unbalanced.
- REQ-7 S1 changes no production behavior.
- S2-S5 (ADR-0038, order S3 then S2): the ADR-0038 shape and additive migrations (S3); one `resolveAxis` that refuses every undeclared axis, with no code defaults (S2); each per-axis fix removes its entry (S4); ADR-0038 and the amendments it names (S5).
