# Design: Retire Feature-PR Memory Transport

## Technical Approach

Remove the feature-branch transport as one atomic behavior change: enable the existing memory lane, make pre-push checkpoint-only, delete `brain:save`, and teach `brain:next` plus operator guidance to use issue-scoped record capture. Preserve `memory-gate`, repository checks, and `resume.md` checkpointing. Canonical `brain/**` doctrine or manifest edits remain maintainer-owned and are prepared as promotion drafts rather than written directly by an agent.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| Set local `memory.lane.enabled: true` without changing migration defaults | Enable by migration; leave absent | Lane readiness is repository-specific and already proven; global defaults must remain opt-in. |
| Delete `brain:save` with no shim | Deprecation wrapper; alias to lane shipping | Any compatibility shim preserves the retired feature-PR commit path and contradicts the removal spec. |
| Keep `memory-gate` evaluation unchanged; update only obsolete remediation text | Retire or reinterpret the gate | The change moves delivery, not the repository-level evidence rule. Regression tests pin the same verdicts. |
| Detect pending capture by current issue provenance, never dirty `.memory/` | Inspect `git status`; always recommend capture | A validated record with `issue: N` proves capture without coupling readiness to feature-branch staging. `brain:next` parses the issue from the branch, reads records through the existing store reader, and uses lane config only to describe delivery. |
| Ship one atomic PR using reviewable commits | Chained PRs | Partial removal creates contradictory operator paths. The maintainer may add `size:exception` only if the measured authored diff requires it. |

## Data Flow

```text
brain:memory:save --issue N -> .memory/records/<record> -> enabled SessionEnd/day:start ship
                                                        -> memory/<host>-<date> PR -> main

feature push -> feature-checkpoint -> repo:check -> size warning -> push
             X brain:memory:share / dirty-.memory guard / brain:save
```

`brain:next` resolves branch issue → open PR → repository checks → issue-scoped record presence → `brain:memory:save --issue N` or `brain:ship`.

## File Changes

| File(s) | Action | Description |
|---|---|---|
| `brain.config.json` | Modify | Add `memory.lane.enabled: true`; do not change schema migration defaults. |
| `brain/scripts/hooks/pre-push`, `.test.mjs` | Modify | Remove `share` and dirty-memory handling; retain checkpoint, repo check, and size warning. |
| `brain/scripts/brain-save.mjs`, `.test.mjs` | Delete | Remove the command implementation and dedicated tests. |
| `package.json`, `brain/scripts/brain-next.{mjs,test.mjs}` | Modify | Remove script; replace materialization state with issue-record/lane guidance. |
| `brain/scripts/{bootstrap.sh,i18n/en.mjs,i18n/es.mjs}`, `brain/scripts/harness/backends/plain.{mjs,test.mjs}` | Modify | Replace feature-push transport instructions with capture-and-lane wording. |
| `brain/scripts/governance/checks/memory-presence.{mjs,test.mjs}`, `brain/scripts/hooks/commit-msg` | Modify | Remove obsolete `brain:save` wording while pinning unchanged gate/commit behavior. |
| `docs/workflow-guide.md`, `docs/methodology-map/**` | Modify | Remove active `brain:save` and feature-transport guidance. |
| `openspec/changes/issue-890-retire-feature-pr-memory-surfaces/brain-drafts/**` | Create | Draft required ADR-0034, consolidation/harness doctrine, and `MANAGED_SCRIPT_KEYS` retirement for explicit maintainer promotion; never edit `brain/core/**` or `brain/project/**` directly. |

## Interfaces / Contracts

- `deriveNext` receives injected issue-record evidence and lane configuration; it no longer receives porcelain `.memory/` status.
- `brain:memory:save --issue <issue>` remains the only capture command; lane triggers remain the only automatic delivery path.
- `memory-gate` inputs and pass/fail semantics do not change.

## Testing Strategy

| Layer | Planned proof |
|---|---|
| Unit | RED tests for every `brain:next` state, lane config, removed managed/script keys, and unchanged memory-gate verdicts. |
| Integration | Pre-push mock log proves checkpoint and checks run while `share`/`ship` do not; caller scan proves no executable `brain:save` reference. |
| Regression | `npm test`, `brain:repo:check`, config tests, hook stream-discipline tests, and generated-doc consistency checks. |

## Threat Matrix

| Boundary | Applicability | Safe/failure behavior | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A — no executable-file classification changes | Existing classification remains untouched. | None. |
| Git repository selection | Applicable | Pre-push continues resolving the canonical top-level root; failure stops before repository checks. | Relative invocation still targets the resolved root; unresolved root fails closed. |
| Commit state | Applicable | Staged, `commit -a`, and empty-index states never trigger memory transport or a memory commit. | Three hook cases assert zero `share`, `ship`, and `brain:save` calls. |
| Push state | Applicable | Tracking, first-push, and explicit-refspec pushes run the same checkpoint/check path; destination never controls memory delivery. | One hook test per push form. |
| PR commands | N/A — this change removes a commit command and adds no PR command | Lane PR ownership stays in existing lane code. | None. |

## Migration / Rollout

Land all removals and lane activation together. Use reviewable commits for tests, runtime removal, guidance, and maintainer-promoted doctrine. Roll back the whole PR if lane delivery stalls; do not restore only a subset.

## Open Questions

None.
