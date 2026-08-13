---
status: draft
issue: 607
---

# Tasks — licence-and-files-allowlist (issue 607)

- [x] Measure the current publish surface: 1053 files / 16.8 MB
- [x] Confirm the repo is already public and unlicensed
- [x] Derive the byte-needing set from `managed` (12 paths, 3 strategies)
- [x] MIT `LICENSE` + `"license": "MIT"`
- [x] `files` allowlist → 423 files / 4.13 MB
- [x] Coverage test measured against a real `npm pack --dry-run`
- [x] Mutation proof: remove a managed path from the allowlist; re-admit
      `.memory`; drop the declared licence — each red, each reverted
- [x] `npm test`, `brain:repo:check`, `brain:nav` green

## Out of scope, reported

- `README.md:36` still says brain installs *"from a git tag — no registry, works
  with private repos"*. The private-repo half is now false. It belongs with the
  install-spec move in **#435**, not here.
- `test/fresh-install/run.sh` still demands `VCS_TOKEN` and still says *"the
  brain repo is private"*. Same — **#435**.
- ADR-0006 is still `Status: Accepted`. Superseding it is **#435**.
