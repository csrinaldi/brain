---
issue: 603
phase: spec
capability: tier-parity
---

# Spec — the tier decides the exit code, in one place

## Requirement: a detection-tier gate exits 0, whoever runs it (R603-1)

`run-check.mjs` MUST route its result through `mapDetectionToWarning` before
computing an exit code, so REQ-TIER-3's scenario holds for the four gates it
owns exactly as it already holds for `phase-order` and `actor-check`.

### Scenario: memory-gate fails at lite
- WHEN `governance.tier` is `lite` and `memory-gate` finds no record
- THEN the process exits **0** and prints a warning naming the gate and the tier.

### Scenario: the same failure at standard
- WHEN the tier is `standard`, where `memory-gate` is `required`
- THEN the process exits **1** — the softening is policy-scoped, never global.

### Scenario: uncomputable is never softened
- WHEN a check returns `uncomputable: true` at a detection tier
- THEN the exit stays **2** — absent evidence is not a passing gate, and the
  helper must refuse it rather than the caller remembering to.

## Requirement: the contributor scaffold requirement names no platform (R603-2)

`openspec/specs/governance/spec.md` MUST state the scaffold requirement over
the providers brain actually emits for, not over one provider's path.

### Scenario: a GitLab consumer reads the spec
- WHEN the spec's scaffold requirement is read
- THEN it requires each supported provider's scaffold path to be managed and to
  carry the issue-link, size-note and decision sections
- AND `.gitlab/merge_request_templates/Default.md` satisfies it as fully as
  `.github/PULL_REQUEST_TEMPLATE.md` does.

## Requirement: the fragment says where the tier is resolved (R603-3)

`gitlab-governance.yml`'s header MUST state that exit policy is resolved by the
checkers, so a reader looking for `allow_failure:` learns why there is none
instead of concluding the fragment forgot.
