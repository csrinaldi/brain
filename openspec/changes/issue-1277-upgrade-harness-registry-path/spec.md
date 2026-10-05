# Spec — issue #1277

- REQ-1: `npm run test:upgrade` passes on main (FROM = second-latest tag, TO = latest).
- REQ-2: The harness installs `@logikas/brain` from the registry, follows the
  `docs/adoption.md` flow, and asserts against `node_modules/@logikas/brain`. No manual
  seeding of managed paths, no alias re-pointing.
- REQ-3: The existing assertions are kept: version, custom config value, `.env`,
  `brain/project`, `openspec/changes` preserved; `brain:repo:check` and
  `brain:change:verify` injected; consumer `brain:day:start` not clobbered.
- REQ-4: An informational `upgrade-smoke` workflow runs the harness on push to main and on
  PRs touching brain/scripts/**, brain/core/config-migrations.mjs, test/upgrade/**, behind the `.brain-source` gate, 20 min timeout. It is
  not in GOVERNANCE_JOBS nor in branch protection.
