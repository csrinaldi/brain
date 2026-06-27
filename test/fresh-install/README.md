# Fresh-install integration test (TOTAL)

Verifies that a real consumer can install brain **end-to-end**, in a clean Linux
container, from a git **tag** — the actual distribution mechanism. No shortcuts.

This is a maintainer/CI test of brain's own distribution; it is **not** part of
`brain/core` (not copied to consumers) and **not** part of `npm test` (it needs
Docker, network, and a token).

## Run

```bash
npm run test:fresh-install -- v0.4.1   # a specific tag
npm run test:fresh-install             # the latest tag
```

## Requirements

- **Docker** — the test spins up a clean `node:22-bookworm` container.
- **A github token** with read access to the (private) brain repo, from
  `VCS_TOKEN` or `gh auth token`. It is passed to the container via env and is
  never logged.

## What it asserts (exits non-zero on failure)

1. **Install** — brain installs from the tag over **HTTPS** (`git+https`).
2. **Upgrade** — `brain:upgrade -- <tag>` copies the 68 managed paths in FULL
   (no `--no-install`).
3. **Bootstrap** — `env:init` creates `brain.config.json` with the `vcs.provider`
   derived from the git origin (`github` for a github consumer).

Headless-only steps (the interactive PAT prompt, and `gentle-ai install` for
`engram`/`gga`) are **informational**, not failures.

## Maintainer flow (tag-driven)

A change to brain that affects the consumer experience must be verified against a
**tag**, never `main` or a branch:

```
merge to main  →  bump version + tag  →  npm run test:fresh-install -- <newtag>
```

The TOTAL test caught the `env:init` config-bootstrap gap (#41) and the
`github:`→SSH install bug (#44); each fix was validated by cutting a new tag and
re-running this test against it.
