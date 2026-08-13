---
status: draft
issue: 458
---

# Proposal — bootstrap-smoke (issue 458)

## What

A CI job that runs the three verbs every adopter runs — `brain:env:init`,
`brain:session:start`, `brain:day:start` — cold, in a fresh consumer fixture,
plus idempotency of the first.

## Why

#446: an i18n catalog key with a hyphen made `brain:env:init` abort at exit 127
mid-bootstrap. `main` was broken for every fresh adopter and CI was green: no
job executes those verbs. #449 added two guards over *that catalog* — the
symptom. With #435 (public repo) the cost moves from the maintainer to the
adopter, at first contact.

## Scope

- **In:** the harness, its own workflow, and a record of what was measured.
- **Out:** repairing the `.env` non-idempotency the suite itself found (written
  by `brain/scripts/bootstrap.sh`, outside the claim); adding an offline flag to
  `day-start.mjs` (not needed — measured, it already degrades); an alias in
  `package.json` (outside the claim).

## The frame #590 provided

#458's open question — is this smoke brain's own net or part of the product? —
is the one ADR-0018 answers from the other side: brain *ships* the GitLab
fragment to consumers and runs it in its own CI nowhere, because "what brain
distributes" and "what brain checks about itself" are two surfaces. The smoke is
the second. Hence: its own workflow, NOT `governance.yml`, NOT a managed path,
NOT a required context.
