# ADR-0007 — VCS-Agnostic Configuration and Check-Refs Engine

**Status**: Accepted  
**Date**: 2026-06-26

## Context

The harness scripts need to know the VCS host, project identifier, and owner to operate (list tickets, create MRs/PRs, push, etc.).

The problem with hardcoding VCS values in the scripts is twofold: the system stops being reusable (it becomes tied to GitLab, to a specific host, to a specific project ID), and consumers cannot adopt brain without patching the scripts.

In parallel, the prohibited-references validator (`repo:check`) needs a mechanism for each project to define its own rules without modifying the generic engine.

## Decision

### VCS-agnostic configuration

`brain.config.json` (repo root) is the single source of truth for project identity:

```json
{
  "project": {
    "name": "",
    "slug": "",
    "gitHost": "",
    "gitProjectId": "",
    "owner": ""
  }
}
```

The keys are VCS-agnostic: `gitHost` works for GitLab, GitHub, Bitbucket, or any other. `slug` is the project path on that host (e.g. `org/repo`). `gitProjectId` is the numeric ID when the VCS requires it (GitLab API).

All scripts import `scripts/lib/brain-config.mjs` instead of hardcoding values. `brain.config.json` is gitignored — it is configured per repo during `env:init`.

### Check-refs engine with external rules

`scripts/check-refs.mjs` is the generic engine (included in `brain/core/`). Prohibited rules are PROJECT-specific: they live in `brain/project/check-refs-rules.mjs` (exports `prohibitedRefs` and `globalExempt`).

The engine loads the project rules at runtime. If the file does not exist, the engine operates with empty rules (only the generic structural rules apply).

## Consequences

- **Positive**: brain works with GitLab, GitHub, Bitbucket — any host with a REST API.
- **Positive**: the consumer defines its own check-refs rules without touching the engine.
- **Negative**: `brain.config.json` must be filled in manually on each clone — `env:init` guides the developer but cannot pre-fill it.
- **Negative**: if a VCS requires authentication for the API (GitLab private, GitHub private), the developer must configure the token in `.env` in addition to `brain.config.json`.
