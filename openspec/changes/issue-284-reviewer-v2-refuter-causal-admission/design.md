---
status: draft
issue: 284
---

# Technical Design — Reviewer v2: Refuter Role & Causal Admission (Issue #284)

## Architecture Overview

Reviewer v2 builds on the modular architecture established in Track H (`brain/scripts/review/`).

```
brain/scripts/review/
├── identity.mjs            — Token & auth gate
├── cold-boot.mjs           — Detached worktree & doctrine loader
├── mode.mjs                — Mode derivation (tranche, checkpoint, ruling)
├── deny-set.mjs            — Chokepoint label permission control
├── evaluators/
│   ├── tranche.mjs         — Tranche evaluator
│   ├── checkpoint.mjs      — Checkpoint evaluator
│   ├── ruling.mjs          — Ruling evaluator
│   └── refuter.mjs         — [NEW] Refuter role evaluator
├── lib/
│   ├── parse-verdict.mjs   — Parser supporting brain-review/1 and /2
│   └── schema-v2.mjs       — [NEW] Schema validator for v2
├── verdict.mjs             — [UPDATED] Emits brain-review/2 with causal admission
├── poster.mjs              — PR/Issue comment poster
├── queue.mjs               — Review queue reader
└── board.mjs               — Reconciler for reviewed:* and seq:* labels
```

## Architectural Decision Records / Rulings on Issue #284 FORKs

### FORK 1: Refuter Execution Trigger
- **Option (a)**: Refuter runs lazily only when ≥1 blocker carries `evidence_class: inferential`.
- **Option (b)**: Refuter always runs in checkpoint mode.
- **RULING**: **Option (a)**. Running the refuter lazily when inferential blockers exist minimizes model token cost and latency while protecting against false-positive blockers.

### FORK 2: Refuter Output Channel
- **Option (a)**: Separate comment block (`brain-refute/1`).
- **Option (b)**: Folded into the reviewer's verdict as per-finding `refuter:` outcomes.
- **RULING**: **Option (b)**. Folding refuter outcomes into the single canonical `brain-review/2` block keeps the verdict self-contained, avoids comment clutter, and simplifies board/queue reconciliation.

### FORK 3: Schema Migration Strategy
- **Option (a)**: Dual schema parsing (`/1` and `/2` supported in reader; `/2` emitted by default for all new reviews).
- **Option (b)**: Emitter flag with `/1` default until all parsers migrate.
- **RULING**: **Option (a)**. Readers (`parse-verdict.mjs`) accept both `/1` and `/2` seamlessly. The emitter defaults to `/2` for all new verdicts.

### FORK 4: Reviewer Execution Runtime (Local Subagent vs Central Server CI)
- **Option (a)**: Mandatory Central Server CI account (GitHub Actions token).
- **Option (b)**: Local Subagent Cold Execution (using local developer credentials, isolated detached worktree in `/tmp/`, zero server token dependency, fallback to VCS comment posting or dry-run output).
- **RULING**: **Option (b)**. Local Subagent cold execution is the primary runtime mode. It operates without central API costs or account overhead, maintaining 100% cold-boot worktree isolation while keeping token consumption minimal via deterministic pre-checks.

## Module Design & Data Models

### `brain-review/2` Fenced YAML Format
```yaml
protocol: brain-review/2
head_sha: d5232a0...
rev: 1
verdict: REVISE | APPROVE | STOP
findings:
  - id: R3-001
    location: "brain/scripts/review/cold-boot.mjs:42"
    severity: blocker
    claim: "Potential race condition during worktree cleanup"
    cites: "cold-boot.mjs:42-50"
    evidence_class: inferential
    causal_disposition: introduced
    refuter_outcome: corroborated
    proof_refs:
      - "hunk inspection at lines 42-50"
follow_ups: []
```
