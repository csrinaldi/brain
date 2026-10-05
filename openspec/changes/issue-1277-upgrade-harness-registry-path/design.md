# Design — issue #1277

Consumer flow in the container: `npm init` -> `.gitignore` node_modules -> `npm i -D
@logikas/brain@FROM` -> `npx brain init` -> `CI=1 brain:env:init </dev/null` -> customise
and commit -> `npm i -D @logikas/brain@TO` -> `npm run brain:upgrade -- TO` (default path;
`--no-install` is not needed). `VCS_TOKEN` remains only to clone the sample consumer.

The workflow mirrors `m4-danger-paths.yml`: its own file (governance.yml is a ratified,
vendored contract), `.brain-source` gate, `timeout-minutes: 20`. `run.sh` is unchanged
(its `docker run` env is pinned by `harness-npm-audit.e2e.test.mjs`).
No drift-guard enumerates workflows, so none needed updating.
