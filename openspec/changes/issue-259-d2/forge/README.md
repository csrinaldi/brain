# §7.1 attack-table evidence — forge scripts

These are the reproducible fixtures that ground design §7.1. They are **evidence** (run against real
`git` and the actual exported predicate), snapshotted here so the design table's `Forge:` citations resolve
inside the repo — "what is not in the repo does not govern, and does not survive." Each row is ALSO ported
into `brain/scripts/governance/postmerge/resolution.test.mjs` (CI-enforced); these scripts are the
standalone, human-runnable form.

> Note: a few scripts import the predicate by absolute path (the path of the worktree they were forged in);
> they are evidence snapshots, not CI. The CI-enforced form is `resolution.test.mjs`.

| §7.1 row(s) | Forge script | Proves |
|---|---|---|
| A2 (liveness), T7(b) | `forge_final.mjs` #1/#9, `forge5.mjs` | real D2 `git revert -m 1` loop resolves; genuine binary revert resolves |
| A3, T1, T2, T3 | `forge_final.mjs` #5/#2/#3/#4 | partial revert, pure rename, rename+modify, copy launder → NOT resolved |
| A4 (F-1) | `forge_final.mjs` #8 | empty first-parent diff → anti-vacuity, NOT resolved |
| T4, T5, T6 | `forge_splitmerge.mjs` | split / merge-files / equivalent-rewrite → NOT resolved |
| T7(a) (F-2) | `forge5.mjs`, `forge_final.mjs` #9 | different binary payload → NOT resolved; `--binary` needed |
| T8 (F-3) | `insp4.mjs`, `forge6.mjs` | identical content, different paths → distinct normDiff |
| T9 (F-4) | `forge6.mjs`, `insp4.mjs`, `forge_forkb2.mjs` | `.gitattributes -diff` attack; `--binary` ALONE defeats it (info/attributes override removed) |
| T10 (whitespace) | `ws.mjs`, `forge_final.mjs` #10 | patch-id collides on indentation → normDiff does not; killed patch-id |
| T11 (blast radius) | `blast.mjs` | intervening edit within 3 lines (U3) → human gate; ≥4 → auto |
| T12 (determinism) | `forge_forkb2.mjs`, `forge_forkb3.mjs` | verdict independent of hostile `GIT_CONFIG_GLOBAL`; env pins do not flip a verdict given `--binary` |
| §3.1 (patch-id rejected) | `forge2.mjs`, `ws.mjs` | path-scoped/path∧blob fail open; patch-id ignores whitespace |

History (for provenance): `forge.mjs`/`forge2.mjs` = the original kill of path-scoped and `path ∧ blob`.
