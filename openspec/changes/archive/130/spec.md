---
status: draft
issue: 130
---

# Spec

## REQ-130-1 — one implementation per rule
Every governance job MUST run the same command on GitHub and GitLab.

## REQ-130-2 — no bash re-implementation
A job MUST NOT re-implement a portable check as an inline shell script. A `run:` block
yielding no extractable command MUST NOT compare equal to the portable invocation.

## REQ-130-3 — the default branch is derived, never literal
The `issue-link` job MUST NOT compare against a hardcoded branch name. The policy MUST come
from the resolved default branch and MUST fail closed when it is uncomputable.

## REQ-130-4 — the approved label is resolved from config
No runtime code, workflow YAML included, may name the approval label.

## REQ-130-5 — the job supplies the check's inputs
The `issue-link` job MUST declare every context variable the portable check consumes. A
missing input fails closed, which is correct and is still a defect.

## REQ-130-6 — the credential is the neutral one
A job reaching the port MUST declare `VCS_TOKEN`.
