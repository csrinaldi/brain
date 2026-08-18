# Fresh-install integration test (TOTAL)

Verifies that a real consumer can install brain **end-to-end**, in a clean Linux
container, from the **published registry package** `@logikas/brain` — the actual
distribution mechanism since ADR-0030. No shortcuts.

This is a maintainer/CI test of brain's own distribution; it is **not** part of
`brain/core` (not copied to consumers) and **not** part of `npm test` (it needs
Docker and network).

## Run

```bash
npm run test:fresh-install              # the registry's `latest`
npm run test:fresh-install -- 1.1.0     # a specific published version
npm run test:fresh-install -- 1.1.0 pnpm
```

A leading `v` is accepted and stripped, because the tag habit is old.

## Requirements

- **Docker** — the test spins up a clean `node:22-bookworm` container.
- **A github token — OPTIONAL, and its absence is part of the point.** The
  install path needs no credential at all. A token, when present, only widens
  two side steps: `gh auth login` (informational) and the external-repo clone
  fallback used when a fixture is missing.

## What it asserts (exits non-zero on failure)

1. **Install** — `@logikas/brain` installs **from the registry with no
   credential**, into the canonical scoped path `node_modules/@logikas/brain`.
   The user npmrc is pinned to an empty file for this step, so an ambient login
   cannot make it pass.
2. **`npx brain init`** — reachable as a `bin` entry with an empty `scripts`
   block, run with **no version argument** so the version is derived from the
   package just installed, and idempotent on a second run.
3. **Upgrade** — copies the managed paths in FULL; `brain/project/**` and
   consumer code are left untouched; `brain:*` verbs are injected without
   clobbering a consumer's own value.
4. **Bootstrap** — `env:init` creates `brain.config.json` with the `vcs.provider`
   derived from the git origin, and scaffolds a `brain/HOME.md` that passes
   `check-brain-nav.mjs`.

Headless-only steps (the interactive PAT prompt, and `gentle-ai install` for
`engram`/`gga`) are **informational**, not failures.

## Why this stopped being tag-driven

Until #435 this harness installed `git+https://github.com/csrinaldi/brain.git#<tag>`
and refused to start without a `VCS_TOKEN`, explaining that *"the brain repo is
private"*. Both statements had become false: distribution moved to a published
scoped package, and the repo went public.

The harness was therefore exercising the **old** mechanism while standing as the
evidence for the new one — and the credential it demanded is exactly the friction
#435's exit criteria call for proving **gone**. A fixture that requires the
friction cannot be the proof it was removed.

## Maintainer flow (release-driven)

A change to brain that affects the consumer experience is verified against a
**published version**, never `main` or a branch:

```
merge to main  →  bump version  →  dispatch publish.yml  →  npm run test:fresh-install -- <version>
```

The TOTAL test caught the `env:init` config-bootstrap gap (#41) and the
`github:`→SSH install bug (#44); each fix was validated by publishing and
re-running this test against it.
