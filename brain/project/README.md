# brain/project/ — Consumer-Specific Knowledge

This directory contains everything that belongs to **this particular project** (the consumer of brain).

`brain/core/` is upstream and treated as **read-only**. Do not add files there; improvements to core go upstream first (see ADR-0003).

## What lives here

| Directory / File | Purpose |
|---|---|
| `decisions/` | Architecture Decision Records (ADRs) for this project — start at `adr-0001`. |
| `domain/` | Domain glossary, entity maps, business rules. |
| `anti-patterns/` | Project-specific things we decided NOT to do, and why. |

## Conventions

- Every durable architectural choice gets an ADR in `decisions/`.
- ADR naming: `adr-NNNN-<slug>.md`. Numbering is local to this project (starts at 0001).
- Orphan documents (not reachable from `brain/HOME.md`) will be flagged by `npm run brain:nav`.
- Generic improvements (applicable to any project) belong upstream in `brain/core/` first.
