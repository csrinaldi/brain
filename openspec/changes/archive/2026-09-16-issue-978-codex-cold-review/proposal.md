# Proposal: Add a Codex cold-review transport

## Intent

Add Codex as a transport for the repository-owned `cold-review` stage so self-hosting can use `gpt-5.5` without changing who defines, validates, challenges, or publishes findings. Preserve ADR-0033's producer/poster separation and fail closed on incomplete evidence.

## Scope

### In Scope
- Implement a Codex backend using non-interactive `codex exec`, a read-only candidate, and host-materialized final output.
- Route `brain.config.json` `cold-review` to `{ "engine": "codex", "model": "gpt-5.5" }` only after readiness exists.
- Preserve credential scrubbing, forge-config shadowing, the forge-auth probe, bounded execution, immutability checks, and `brain-findings/1` validation.
- Detect or guide installation only when the effective route selects Codex; add positive and negative setup coverage.

### Out of Scope
- Replacing the first-party Adversary prompt, challenger, artifact schema, or parent-owned poster.
- Claude fallback or universal model, host, or account claims.
- Direct agent edits to durable `brain/project/**` doctrine; any amendment follows human promotion.

## Capabilities

### New Capabilities
- `codex-cold-review-transport`: Route and execute cold review through Codex while preserving immutable inspection and fail-closed artifact/security boundaries.
- `route-conditional-codex-setup`: Require detection, installation guidance, and readiness diagnostics only for an effective Codex route.

### Modified Capabilities

None.

## Approach

Extend the stage payload with a host-owned output descriptor. Invoke `gpt-5.5` with a writable isolated `CODEX_HOME`, `--sandbox read-only`, `--ignore-user-config`, `--ephemeral`, and `--output-last-message`. Validate unchanged candidate inventory, bytes, and modes before the existing exact-one-block reader. Use slices under the 400-line budget: output plumbing; transport/security; then routing, conditional setup, tests, and documentation.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `brain/scripts/harness/` | New/Modified | Codex backend and output plumbing |
| `brain/scripts/review/` | Modified | Host output and immutability checks |
| `brain/scripts/install-tools.sh`, `brain/scripts/bootstrap.sh` | Modified | Route-conditional setup |
| `test/fresh-install/`, `docs/reviewer-setup.md` | Modified | Setup proof and guidance |
| `brain.config.json` | Modified | Self-hosting Codex route |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Auth, model, writable state, network, or sandbox unavailable | Medium | Explicit preflight and actionable refusal |
| Candidate or malformed output accepted | Low | Before/after snapshots plus existing parser |
| Unrouted consumers gain dependencies | Medium | Route-negative tests |

## Rollback Plan

Restore the Claude route and revert Codex-specific backend/setup changes; unchanged contracts keep Claude usable.

## Dependencies

- Supported Codex CLI, writable isolated state, operator-managed authentication, OpenAI access, and Linux sandbox prerequisites.

## Success Criteria

- [ ] Routed `gpt-5.5` review produces a valid artifact without candidate mutation or poster credential exposure.
- [ ] Every readiness, execution, mutation, and validation failure refuses publication.
- [ ] Unrouted installs neither require nor install Codex.
