# Spec — #1346

- REQ-1: In `in-container.sh` step 4b, when `memory.backend` was declared, a non-zero `resolve memory` is a FAIL. Only a failed declaration downgrades it to info, and the text says so.
- REQ-2: No `*.test.mjs` calls `migrateConfig` with fewer than 4 arguments, nor `.migrate(` without `axisContext`/`buildAxisContext`, outside the self-build allowlist. The scanner is itself proven against planted violations.
- REQ-3: `npm pack` never includes `brain/core/.brain-promote-proof-*` (asserted against the real tarball with a planted file).
- REQ-4: `brain:promote`'s migration arm removes stale `.brain-promote-proof-*.mjs` beside its target at start and touches no other file.
- REQ-5: `.gitignore` of this repo ignores the proof file pattern.
