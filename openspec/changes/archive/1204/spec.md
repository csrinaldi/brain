# Spec — #1204

- REQ-1: Each phase-1 exit clause is answered yes or no, citing an evidence file:
  - fresh plainfiles and engram installs need no step outside install, bootstrap or upgrade;
  - no credential is committed;
  - the four seams recover.
- REQ-2: The first feature PR on a fresh consumer is opened by `brain:ship` with no `gh pr create` fallback, and its post-merge run succeeds with no alarm issue.
- REQ-3: Every manual step the PRODUCT required is recorded as a finding. A deviation made by the demo harness itself is recorded in `design.md`.
- REQ-4: The evidence directory contains no token (`ghp_`, `github_pat_`, `gho_`, `glpat-`).
