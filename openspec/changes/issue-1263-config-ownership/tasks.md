# Tasks — #1263

- [x] ADR-0040 drafted, ratified (2026-10-02) and cold-reviewed (PR #1264)
- [ ] Maintainer promotes ADR-0040 (`brain:promote`)
- [x] Slice 1: user layer (`BRAIN_HOME`/`~/.brain`) and `locked` in `resolveAxis`, plus the guard test for `BRAIN_HOME` in tests (read-only: nothing writes `~/.brain`)
- [ ] Slice 2: `env:init` writes the user layer and never the team config in an existing repo; no-TTY memory left undeclared
- [ ] Slice 3: foundation seeds `governance.owners`; migration writes `locked: false` for existing consumers
- [ ] Slice 4: team-config approval gate on the tier ladder; CODEOWNERS drift check
- [ ] Amendment drafts: ADR-0038, ADR-0020, ADR-0026, ADR-0004
