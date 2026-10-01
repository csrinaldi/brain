# Spec — #1229

- REQ-1: Each phase-1 exit clause is reported citing evidence files. The run does NOT answer clause 1 (no step outside install, bootstrap or upgrade) itself: it lists every human step with its evidence, and the clause is answered only by the maintainer's ruling, which `report.md` records in its "Ruling" section with its date and basis.
  - fresh plainfiles and engram installs need no step outside install, bootstrap or upgrade;
  - no credential is committed;
  - the four seams (and #1118) recover.
- REQ-2: The first feature PR on a fresh consumer is opened by `brain:ship` with no `gh pr create` fallback, and its post-merge run succeeds with no alarm issue.
- REQ-3: Every manual step the PRODUCT required is recorded as a finding in `report.md`. A deviation made by the demo harness itself is recorded in `design.md`.
- REQ-4: The evidence directory contains no token (`ghp_`, `github_pat_`, `gho_`, `ghs_`, `ghu_`, `glpat-`): `credential-scan.txt`.
