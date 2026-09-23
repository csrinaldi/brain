# Design: Efficacy Probes Replace Presence Probes (Rung 2)

Issue #337 — M10 Phase 3. Parent #335. Epic #313.

## Technical Approach

Keep the existing pure/IO split. `realReleaseGateProbe` stays a dumb I/O wrapper: it reads
`.github/workflows/release.yml` and returns **raw evidence**. All interpretation moves into
`evalRung2` in `substrate.mjs`, where it is unit-testable with injected fixtures and zero fs
access — exactly how `evalPipelineMustSucceedGate` interprets raw `{ status, contexts }`
(substrate.mjs:107-179).

Rung 2 gains `verifiable` and `mechanism`, mirroring rung 1's `evalPreReceiveGate`
(substrate.mjs:218-228). Declared-but-unproven can then render as armed-with-caveat instead of
masquerading as verified.

## Architecture Decisions

### Decision: Interpretation lives in `substrate.mjs`, not in the probe

| Option | Tradeoff | Decision |
|---|---|---|
| Regex inside `realReleaseGateProbe` | Simple, but lands in a file whose real probes are explicitly not unit-tested (brain-governance-status.mjs:34-42) | Rejected |
| New `release-gate-efficacy.mjs` module | Testable, but adds a module for one function and splits rung logic across files | Rejected |
| `classifyReleaseWorkflow()` module-local in `substrate.mjs` | Pure text in, verdict out; tested through `detectSubstrate` with injected text like every other rung | **Chosen** |

**Rationale**: the module contract already says "the interpretation lives here so it stays
unit-testable; the actual fs read is the caller's concern".

### Decision: Text scan, no YAML parser

brain has **zero runtime dependencies** (package.json). `release-postmerge-workflows.test.mjs:33`
already sets the precedent: *"Pure text parse (js-yaml is not a dependency)"*. Adding `js-yaml`
for one probe is rejected. Line-scan the `on:` block and job body.

### Decision: The anti-pattern is the *trigger*, not a missing job

brain's `release.yml` **does** have an `audit-gate` job — so "no gating job" would false-negative.
The tag already exists when `on: push.tags` fires; nothing downstream can un-create it. Classify
triggers instead:

- **post-fact** (`push.tags`, `release`, `workflow_run`) → cannot block
- **antecedent-capable** (`workflow_dispatch`, `push.branches`) → can audit, then tag

Blocking requires an antecedent-capable trigger **+** a `brain-audit` invocation **+**
`permissions: contents: write` (the workflow must be able to create the tag it gates). That triple
is #210's target shape, so the positive fixture doubles as a forward contract for Phase 4.

### Decision: A bare `true` from an injected probe stays armed, but `verifiable: false`

| Option | Tradeoff | Decision |
|---|---|---|
| Bare `true` ⇒ not armed | Maximally strict; breaks ~6 injection sites in `brain-governance-status.test.mjs` that are unrelated to rung 2 | Rejected |
| Bare `true` ⇒ armed, `verifiable: false` | An injected `true` **is** a declaration, not a verification — same honesty shape as `preReceive` | **Chosen** |

**Rationale**: the lie #337 kills is *brain's own probe inferring efficacy from file presence*.
That dies because `realReleaseGateProbe` now returns structured evidence. `config.governance.releaseGate === true`
remains a deliberate config-declared escape hatch, rendered with a caveat.

## Data Flow

    realReleaseGateProbe (I/O)          evalRung2 (pure)
    ┌────────────────────────┐          ┌──────────────────────────────┐
    │ config.governance      │          │ declared? → armed, unverified│
    │ readFileSync(release)  │─evidence→│ text? → classifyReleaseWorkflow
    └────────────────────────┘          │        → { blocking, reason }│
                                        └──────────────┬───────────────┘
                                                       ▼
                                   rungs[2] { active, verifiable, reason, remedy }
                                                       ▼
                                        selectRung → printSubstrateReport

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `brain/scripts/vcs/substrate.mjs` | Modify | `evalRung2` (:78-89) consumes evidence; add module-local `classifyReleaseWorkflow`; update the rung-2 doc comment |
| `brain/scripts/brain-governance-status.mjs` | Modify | `realReleaseGateProbe` (:88-92) returns evidence; `printSubstrateReport` adds the rung-2 `verifiable:false` caveat line |
| `brain/scripts/vcs/substrate.test.mjs` | Modify | Fixtures at :74-103: inert, audit-gated, missing, malformed, legacy-boolean |
| `brain/scripts/brain-governance-status.test.mjs` | Modify | One test for the rung-2 caveat render |
| `.github/workflows/release.yml` | **Unchanged** | Out of scope — #210 / Phase 4 |
| `brain/scripts/vcs/release-postmerge-workflows.test.mjs` | **Unchanged** | Asserts today's shape — inverted by #210 |

## Interfaces / Contracts

```js
// probes.releaseGate evidence (bare boolean still accepted → { declared })
{ declared: boolean, workflowPresent: boolean, workflowText: string|null }

// rungs[2]
{ available: true, active, verifiable, mechanism, reason, remedy }
```

Verdict matrix:

| Evidence | active | verifiable | mechanism |
|---|---|---|---|
| `declared: true` | true | false | `release-gate-config-declared` |
| antecedent trigger + audit + `contents: write` | true | true | `release-gate-workflow-structural` |
| only post-fact triggers (brain today) | false | true | `release-gate-workflow-structural` |
| audit present, no `contents: write` | false | true | `release-gate-workflow-structural` |
| no workflow / not wired | false | true | `release-gate-absent` |
| unrecognizable `on:` block, read error | false | **false** | `release-gate-unparseable` |

Every `active: false` row carries a `remedy`. The post-fact row points at #210.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Verdict matrix, all six rows | `detectSubstrate({ probes: { releaseGate: async () => evidence } })` — offline, `env: {}` always explicit |
| Unit | Inert fixture = brain's real `release.yml` text ⇒ `active: false` | Inline template literal fixture, not a disk read (no fs coupling in `substrate.test.mjs`) |
| Unit | Rung-2 caveat render when `verifiable: false` | `reportGovernanceStatus` with probe overrides + captured `console.log` |
| Integration | brain's own status demotes 2 → 3 | Manual `npm run brain:governance-status` before merge; record output in the PR body |

## Migration / Rollout

No migration. Single-commit revert restores presence-based arming. brain's own rung moves
**2 → 3** (not 4) because `governance-postmerge.yml` exists, so `enforced` stays `true`.

## Open Questions

- [ ] `needs:` DAG is **not** validated — a workflow with `contents: write` + an audit job the tag
      step does not `need` would false-positive. Accepted limitation; real semantics land with #210.
- [ ] ADR-0025 (cited by #331) is not in tree; do not assert its guarantee (carried from proposal).
