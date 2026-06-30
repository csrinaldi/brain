# Brain Methodology — Introduction

> **Note:** This document describes the Brain methodology for knowledge management.
> Updates to Brain will replace this file with the latest upstream version.

## What is Brain Methodology?

The Brain methodology provides a structured system for managing knowledge in
software development teams. It is designed to facilitate the adoption of shared
conventions without imposing unnecessary restrictions on the team's workflow.

Each team that adopts Brain works with two distinct layers:

- **Core** (`brain/core/`): documents managed by Brain and updated with each
  new package version.
- **Project** (`brain/project/`): team-owned documents that Brain never modifies.

## How It Works

Brain uses a list of managed paths (`managed-paths.mjs`) to determine which
files are the package's responsibility and which belong to the team. During
`brain:upgrade`, only files declared as `managed` are updated.

### Conflict Resolution

When a managed file differs between the installed version and the latest Brain
version, the installer notifies the team without silently overwriting anything.
Update decisions remain with the team.

## Additional Conventions

Remember that every project has its unique characteristics. The conventions
described here are a shared guide, not a mandate. If any convention does not fit
your context, document it in `brain/project/decisions/` with your reasoning.

## References

- `brain/core/managed-paths.mjs`: list of managed paths
- `brain/project/README.md`: entry point for project documentation
- ADR-0003: architecture decision on the managed paths system
