# Design — #1263

The decision is ADR-0040 (`brain-drafts/adr-0040-*.md`), which amends ADR-0038. Each slice below gets its own design section when it is implemented on the #1114 tracker.

| Slice | Design outline |
|---|---|
| 1. User layer in `resolveAxis` | Read `BRAIN_HOME` (otherwise `os.homedir()/.brain`) `config.json` in the ADR-0038 shape. Merge `providers` as team ∪ user. A user `default` sits between `.env` and the team default. `locked` refuses the user layer, `.env` and process env for that axis. `vcs` takes no user or `.env` level, and the CI runtime provider stays outside the precedence. Tests always set `BRAIN_HOME`, enforced by a guard test. |
| 2. `env:init` in an existing repo | It never writes `brain.config.json`. It writes `~/.brain/config.json`, and an undeclared team axis is refused with a named fix. A no-TTY foundation leaves memory undeclared, and `diagnoseAxes` reports it as an error. This corrects #1114 S3.3, the memory prompt and the VCS override paths. |
| 3. Foundation and owners | A creating `env:init` declares team defaults for every axis except a no-TTY memory, and seeds `governance.owners` with the adopter's bare login. The migration writes `locked: false` for existing consumers. |
| 4. Team-config approval gate | A PR touching team config needs an approval from a `governance.owners` member who is not its author. The only exception is the solo maintainer at `lite` in mode A. The gate is detection at `lite` and required at `standard` and `regulated`. CODEOWNERS is an optional mirror, checked by a drift test. |
