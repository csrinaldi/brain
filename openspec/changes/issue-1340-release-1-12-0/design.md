# Design (#1340)

## Mirror the 1.11.0 cut
Same files (`CHANGELOG.md`, `README.md`, `docs/adoption.md`, `docs/KNOWN-LIMITATIONS.md`, `package.json`), same voice: a "read before upgrading" table first, then one section per observable change, what ships, follow-ups, why this bump level. 1.11.0 had one overclaim, caught late, so the sweep targets scope words ("every", "never", "no"), exit codes and who writes what.

## Claims are read from the code, and from a real run
Each behavioural sentence is traced to a function, an i18n key or a script line. The migration, the refusals, `user-set`, `locked` and `governance.owners` were also exercised on scratch consumers installed from `npm pack` of this tree (the pre-publish check), and the quoted outputs are those runs'.

## Four first-draft sentences were wrong and are corrected
They are listed in `claim-sweep.md` ("Corrected"). The largest: the migration does not promote a memory backend that lives only in `.env`, and the memory commands refuse with their own older text, not the `axes.refusal.undeclared` one.

## No doctrine change
No `brain/core/**` or `brain/project/**` file is touched. No `brain-drafts/` is needed.

## Two test edits the version bump forces
Bumping to 1.12.0 makes the 1.11.1 migration reachable, which `migrateConfig` had skipped at package 1.11.0 (`core/config-migrations.mjs:228`, the "dormant until cut" property its 1.6.0 entry documents). Two `bootstrap.default-platform.test.mjs` assertions that a value only `.env` states leaves `config.platform` absent now see the axis written undeclared (`default: ''`); they assert "not declared" instead of "absent". The tarball canary in `test/publish-allowlist.e2e.test.mjs` moves from 10.1 to 10.2 MiB: the tree measures 10.10 MiB, +1.5 KB over the old line, from the README table and the version string.
