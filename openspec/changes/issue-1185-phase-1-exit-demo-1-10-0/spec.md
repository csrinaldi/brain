# Spec — #1185

- REQ-1: Each phase-1 exit clause is answered yes or no, citing an evidence file:
  - fresh plainfiles and engram installs need no step outside install, bootstrap or upgrade;
  - no credential is committed;
  - the four seams recover.
- REQ-2: Every manual step found is filed as an issue under #1121 phase 1.
- REQ-3: The evidence directory contains no token (scan: `ghp_[A-Za-z0-9]{36}`, `github_pat_[A-Za-z0-9_]{50,}`).
