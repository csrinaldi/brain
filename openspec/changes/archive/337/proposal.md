# Proposal: Efficacy Probes Replace Presence Probes (Rung 2)

Issue: #337 — M10 Phase 3. Parent: #335. Epic: #313.

## Intent

Rung 2 lies. `evalRung2` treats any truthy `releaseGate` probe as "armed", and
`realReleaseGateProbe` only checks that `.github/workflows/release.yml` exists.
brain's own `release.yml` fires `on: push: tags` with `permissions: contents: read`
— it runs *after* the tag exists and cannot block it. Presence and efficacy have
fully diverged. This is REQ-210-4 carved out as a standalone slice so #210 is
unblocked without rebuilding the release workflow.

## Scope

### In Scope
- `evalRung2` (`brain/scripts/vcs/substrate.mjs:78-88`) — distinguish "wired" from "provably enforcing".
- `realReleaseGateProbe` (`brain/scripts/brain-governance-status.mjs:88-92`) — return a verdict with reasoning + remediation, not a bare boolean.
- Narrow structural anti-pattern check: `push: tags` trigger with no antecedent audit-gating job ⇒ inert.
- Negative fixture test in `substrate.test.mjs`: workflow exists but cannot block ⇒ `active: false`.
- Document the honest demotion of brain's own rung in the PR body.

### Out of Scope
- Rebuilding `release.yml` (audit-then-tag job, `contents: write`) — #210 / Phase 4.
- Inverting `release-postmerge-workflows.test.mjs:153-181`, which asserts today's broken shape — #210 / Phase 4.
- Full workflow-semantics parsing or provider status-check API reads.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `governance-v3`: REQ-L2-1 and REQ-HONESTY-1 — rung 2 `active` MUST derive from structural efficacy of the release path, never from file presence; verdicts MUST carry reasoning and remedy.

## Approach

Exploration approach 3 (honest demotion) plus the minimal structural check that
acceptance criterion (c) demands. Reuse the rung-1 precedent: `evalPreReceiveGate`
already carries `verifiable: true/false` (`substrate.mjs:210-227`). Rung 2 gets the
same honesty distinction, so declared-but-unproven never renders as enforced.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/vcs/substrate.mjs` | Modified | `evalRung2` consumes structured verdict |
| `brain/scripts/brain-governance-status.mjs` | Modified | `realReleaseGateProbe` structural check |
| `brain/scripts/vcs/substrate.test.mjs` | Modified | Negative + positive fixture coverage |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| brain's own status regresses 2 → 3/4 | High | Expected and desired; call out explicitly in PR body |
| Scope creep into workflow semantics | Med | Anti-pattern check only; defer semantics to #210 |
| ADR-0025 (cited by #331) not in tree | Med | Confirm with user; do not assert its guarantee |

## Rollback Plan

Single-commit revert. The probe is read-only reporting — no data, config, or CI
mutation. Reverting restores presence-based `active: true`.

## Dependencies

None. Phase 3 is independent of Phases 0/1/2 (#336 is context, not a blocker).

## Success Criteria

- [ ] Inert `release.yml` fixture ⇒ rung 2 `active: false`
- [ ] Real audit-gated fixture ⇒ rung 2 `active: true`
- [ ] Verdicts include reasoning + remediation text
- [ ] `npm test` green; no change to `release.yml` or its structural tests
