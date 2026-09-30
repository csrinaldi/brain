# Design: branch grammar (#697)

New pure module `lib/branch-grammar.mjs` with two anchored regexes (canonical tried first). Slug is required in both shapes, preserving the existing rejection of `feature/42`. Readers that already work with a stricter, purpose-built regex are left alone. `brain-start.mjs` unchanged; `harness-contract.md` needs no edit.
