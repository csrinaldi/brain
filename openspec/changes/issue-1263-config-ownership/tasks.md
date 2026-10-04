# Tasks — #1263

- [x] ADR-0040 drafted, ratified (2026-10-02) and cold-reviewed (PR #1264)
- [ ] Maintainer promotes ADR-0040 (`brain:promote`)
- [x] Slice 1: user layer (`BRAIN_HOME`/`~/.brain`) and `locked` in `resolveAxis`, plus the guard test for `BRAIN_HOME` in tests (read-only: nothing writes `~/.brain`)
- [x] Slice 2: `env:init` writes the user layer and never the team config in an existing repo; no-TTY memory left undeclared
- [x] Slice 3: founding seeds `governance.owners` (bare login, after the actor step) and locks memory+sdd; 1.11.1 migration writes `locked: false` for existing consumers; `owners-undeclared` finding; `user-set` missing value is exit 2
- [ ] Slice 4: team-config approval gate on the tier ladder; CODEOWNERS drift check
- [ ] Amendment drafts: ADR-0038, ADR-0020, ADR-0026, ADR-0004
