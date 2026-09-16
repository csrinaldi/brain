# Design: Add a Codex cold-review transport

## Technical Approach

Treat Codex only as the producer transport. `runColdReviewStage` continues to own routing, the first-party Adversary prompt, credential/forge isolation, timeout, candidate selection, and publication refusal. It adds an opaque host-output descriptor and immutable-candidate snapshots. A new Codex backend runs `codex exec` with `gpt-5.5`, a per-run writable isolated `CODEX_HOME`, and a read-only detached candidate. The host atomically materializes the final message; the unchanged `findings-artifact.mjs` reader remains the sole acceptance oracle.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| Host-owned final-message output outside the candidate | Writable artifact directory; workspace-write clone; `codex exec review` | `--output-last-message` preserves a read-only candidate and avoids a second review/schema contract. |
| Generic `output` descriptor carried unchanged through the seam | Encode destination in prompt; Codex-specific review-layer branch | An explicit value is testable at every hop and avoids the repository's recurring dropped-field defect. |
| Before/after inventory of relative path, type, mode, and SHA-256 | Trust sandbox; inspect Git diff only | The bounded runtime proof is not a universal sandbox guarantee; inventory detects untracked, deleted, byte, and mode changes. |
| Per-run `0700` Codex home with only required Codex auth state | Use operator home; read-only home | Codex needs writable state; isolation plus cleanup prevents user config/plugins from changing the run. Poster and forge credentials remain scrubbed. |
| Conditional setup from the effective `cold-review` route | Install Codex everywhere | Unrouted consumers gain no dependency or setup failure. |

## Data Flow

```text
config route -> runColdReviewStage -> snapshot(candidate)
                    | -> scrub env + forge shadow/probe
                    v
              stage-seam -> codex backend -> codex exec (candidate read-only)
                                      | -> temporary final-message file
candidate re-snapshot == before <-----+
                    | -> atomic host rename -> existing artifact reader
                    v
              challenger -> parent-owned poster
```

Every precondition precedes artifact deletion. Any readiness, probe, spawn, timeout, non-zero exit, missing output, snapshot difference, rename, or parser failure returns refusal; there is no Claude fallback.

## File Changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/harness/backends/codex.mjs` / `.test.mjs` | Create | Runtime descriptor, argv/env/home/output lifecycle, bounded result mapping. |
| `brain/scripts/review/lib/candidate-snapshot.mjs` / `.test.mjs` | Create | Deterministic inventory and equality diagnostics. |
| `brain/scripts/harness/stage-seam.mjs` / `.test.mjs` | Modify | Carry `output` without interpretation. |
| `brain/scripts/review/lib/run-cold-review-stage.mjs` / `.test.mjs` | Modify | Select return-mode prompt, snapshot, temporary output, atomic publication. |
| `brain/scripts/review/lib/assemble-review-prompt.mjs` / `.test.mjs` | Modify | Parameterize “return exact artifact bytes” while preserving role/schema text. |
| `brain/scripts/install-tools.sh`, `brain/scripts/bootstrap.sh`, `test/fresh-install/*` | Modify | Route-positive Codex guidance/probes and route-negative no-install proof. |
| `brain.config.json`, `docs/reviewer-setup.md` | Modify | Route self-hosting to Codex/`gpt-5.5`; document bounded host/auth/sandbox support. |

`brain/project/**` is not edited; any ADR-0033 amendment remains a human-promotion action.

## Interfaces / Contracts

`runStage({ ..., output: { mode: 'final-message', tempPath, artifactPath }, codexHome })` carries absolute host-owned paths. The Codex argv is exactly `exec --model <opaque> --sandbox read-only --cd <candidate> --skip-git-repo-check --ephemeral --ignore-user-config --output-last-message <tempPath> <prompt>`. The backend never parses or posts findings.

## Testing Strategy

| Layer | Planned RED coverage |
|---|---|
| Unit | Exact argv/model, env scrub then forge shadow, writable isolated home, cleanup, atomic output, bounded tail/timeout/non-zero/missing-output failures, snapshot path/type/mode/hash differences. |
| Seam | `output` survives review -> seam -> backend; omitted descriptor preserves Claude behavior. |
| Integration | Valid `brain-findings/1` reaches the unchanged reader; malformed/extra blocks and candidate mutation refuse publication. |
| Fresh install | Codex route reports absent/old/auth/home/model/network/sandbox failures; Claude/unrouted route neither installs nor requires Codex. |

## Threat Matrix

| Boundary | Applicability | Safe/failure behavior and RED test |
|---|---|---|
| Documentation-like paths | N/A: no executable-file classification changes. | No task. |
| Git repository selection | Applicable | Only canonical detached `cwd` is passed; relative/absolute selector substitution refuses. RED: wrong/missing candidate cwd. |
| Commit state | Applicable | Snapshot the detached committed tree; staged, `commit -a`, and empty operator indexes cannot affect it. RED: each ambient state leaves candidate identity unchanged. |
| Push state | N/A: producer performs no push. | Forge access remains refused by the existing probe. |
| PR commands | N/A: parent-owned poster remains unchanged. | Producer has no posting credential and no PR-command surface. |

## Rollout, Rollback, and PR Slices

1. Output descriptor, prompt mode, snapshot helper, and site tests; Claude stays routed.
2. Codex backend/security tests and bounded live probe; still unrouted.
3. Conditional setup/fresh-install/docs, then switch `brain.config.json` to Codex `gpt-5.5`.

Each slice targets under 400 authored changed lines and is independently reversible. Rollback restores the Claude/Sonnet route first, then reverts conditional setup and Codex plumbing; shared artifact, challenger, and poster contracts remain usable.

## Open Questions

None.
