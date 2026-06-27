# Test Fixtures — Mock Consumer Repos

Mock consumer repositories for integration testing brain across different package managers and configurations.

Each fixture represents a minimal but realistic consumer project that installs brain and goes through the upgrade cycle.

## Fixtures

- **npm/** — Default npm (package-lock.json)
- **pnpm/** — pnpm with `packageManager` field (pnpm-lock.yaml)
- **yarn/** — Yarn Berry with `packageManager` field (yarn.lock)
- **bun/** — bun with `packageManager` field (bun.lockb)

Future additions: `nx/`, `maven/`, etc.

## Structure

```
<pm>/
  package.json          # Consumer app + brain scripts
  .gitignore
  src/
    index.js            # Sample consumer code (unmodified by brain upgrade)
  brain/                # Created during test
    project/
      decisions/        # Consumer ADRs (READ-ONLY, not touched by upgrade)
    core/               # Managed by brain (updated during upgrade)
```

## Test Workflow

For each fixture:
1. Install brain @ TAG (via the fixture's PM)
2. Create a consumer change (e.g., src/app.js modification)
3. Create brain/project/decisions/adr-0001.md (consumer ADR)
4. Simulate brain upgrade (brain:upgrade -- TAG)
5. Verify:
   - ✅ brain/core/* updated
   - ✅ scripts/*, brain/core/* updated
   - ❌ brain/project/decisions/* untouched (READ-ONLY)
   - ❌ src/index.js untouched

## Usage (in tests)

```bash
export CONSUMER_FIXTURE=npm    # use test/fixtures/npm
export TARGET_TAG=v0.5.0
npm run test:fresh-install
```
