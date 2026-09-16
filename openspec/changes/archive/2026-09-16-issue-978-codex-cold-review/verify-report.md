```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b5879279210ee5224e6a0e9e73300c28288da8170de8d42a056bf67843aa1ae2
verdict: pass
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 14/14
test_command: "GIT_CONFIG_GLOBAL=/dev/null npm test"
test_exit_code: 0
test_output_hash: sha256:8e50e4af4524294502b1d7e46ba1d2f490d7503fbfbe6209dda73077c7d6d264
build_command: "bash -n brain/scripts/install-tools.sh && bash -n brain/scripts/bootstrap.sh && npm run brain:repo:check"
build_exit_code: 0
build_output_hash: sha256:3c14ef2b8073a463f2f587f910ec6a63c31eea1846295fca3e7b17b2607daba1
```

## Verification Report

**Change**: issue-978-codex-cold-review  
**Version**: N/A  
**Mode**: Strict TDD

### Outcome

PASS. All 15 tasks are complete, all 8 requirements and 14 scenarios have passing runtime coverage, the full test suite passes, and the implementation follows the approved design.

### Completeness

| Metric | Value |
|---|---:|
| Tasks total | 15 |
| Tasks complete | 15 |
| Tasks incomplete | 0 |
| Requirements compliant | 8/8 |
| Scenarios compliant | 14/14 |

### Build & Tests Execution

**Build / structural checks**: Passed.

```text
bash -n brain/scripts/install-tools.sh && bash -n brain/scripts/bootstrap.sh && npm run brain:repo:check
exit 0
No prohibited references found.
Artifact structure is valid.
```

**Tests**: 5,380 passed; 0 failed, cancelled, skipped, or todo.

```text
GIT_CONFIG_GLOBAL=/dev/null npm test
exit 0
tests 5380; pass 5380; fail 0; cancelled 0; skipped 0; todo 0
duration_ms 33431.514502
```

The first restricted-sandbox invocation was interrupted after Node workers hit stream-file-descriptor permission failures. The native attempt was settled as interrupted, then the same suite was rerun outside that sandbox and passed. This was an execution-environment limitation, not a candidate failure.

**Coverage**: Not available; `openspec/config.yaml` declares `coverage_available: false` and threshold `0`.

### Spec Compliance Matrix

| Requirement | Scenario | Passing runtime evidence | Result |
|---|---|---|---|
| Execute a bounded Codex review | Routed review succeeds | `brain/scripts/harness/backends/codex.test.mjs` exact argv/env/home test; `run-cold-review-stage.test.mjs` valid Codex handoff | COMPLIANT |
| Execute a bounded Codex review | Runtime prerequisite is unavailable | `codex.test.mjs` timeout/non-zero/missing-output refusal; `codex-readiness.test.mjs` prerequisite diagnostics | COMPLIANT |
| Materialize output outside the candidate | Final message is materialized safely | `codex.test.mjs` host output test; `run-cold-review-stage.test.mjs` atomic materialization test | COMPLIANT |
| Materialize output outside the candidate | Output descriptor is unsafe or absent | `codex.test.mjs` unsafe-path and missing-output refusal tests | COMPLIANT |
| Enforce candidate immutability | Candidate remains unchanged | `candidate-snapshot.test.mjs` inventory test; valid stage handoff test | COMPLIANT |
| Enforce candidate immutability | Codex mutates the candidate | `candidate-snapshot.test.mjs` difference classification; routed-stage mutation refusal test | COMPLIANT |
| Preserve fail-closed findings and security boundaries | Valid artifact passes transport checks | `run-cold-review-stage.test.mjs` valid final-message test; composition suite exercises existing reader/poster flow | COMPLIANT |
| Preserve fail-closed findings and security boundaries | Validation or security check fails | `run-cold-review-stage.test.mjs` malformed-message refusal; backend timeout/non-zero/cleanup refusal tests; full findings-reader suite | COMPLIANT |
| Resolve an explicit Codex route | Codex route is selected | `codex-readiness.test.mjs` supported-route identity test; configured `cold-review: codex/gpt-5.5` | COMPLIANT |
| Resolve an explicit Codex route | Route is invalid or remains Claude | `codex-readiness.test.mjs` unsupported-model and Claude-route tests | COMPLIANT |
| Install and probe only when routed | Unrouted installation stays unchanged | `test/fresh-install/codex-route.e2e.test.mjs` route-negative fixture | COMPLIANT |
| Install and probe only when routed | Routed installation is ready | `codex-readiness.test.mjs` ready CLI test; fresh-install route-positive fixture | COMPLIANT |
| Fail closed with actionable readiness diagnostics | Routed readiness fails | `codex-readiness.test.mjs` absent/old/unauthenticated diagnostics test | COMPLIANT |
| Prove both route branches | Fresh-install coverage runs | Both route-positive and route-negative `codex-route.e2e.test.mjs` cases passed within `npm test` | COMPLIANT |

**Compliance summary**: 14/14 scenarios compliant.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Bounded Codex execution | Implemented | Backend pins `gpt-5.5`, read-only sandbox, ephemeral execution, ignored user config, isolated `0700` `CODEX_HOME`, and scrubbed environment. |
| Host-owned output | Implemented | The stage supplies an opaque external output descriptor; the backend rejects candidate-contained destinations. |
| Candidate immutability | Implemented | Complete relative-path/type/mode/SHA-256 snapshots are compared before publication. |
| Fail-closed parsing/security | Implemented | Existing exact-one findings parser remains authoritative; runtime, parser, mutation, and cleanup failures refuse publication. |
| Explicit route | Implemented | `brain.config.json` selects `codex/gpt-5.5`; unsupported Codex models fail before inference. |
| Conditional installation/probe | Implemented | Bootstrap and tool installation gate Codex work on the effective route. |
| Actionable readiness | Implemented | Readiness results are bounded and secret-free. |
| Both route branches | Implemented | Positive and negative fixtures are present and pass. |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Host-owned final-message output outside candidate | Yes | Implemented through `--output-last-message` and atomic host publication. |
| Generic opaque output descriptor | Yes | `stage-seam.mjs` forwards the descriptor without interpretation. |
| Before/after candidate inventory | Yes | `candidate-snapshot.mjs` captures paths, types, modes, and byte hashes. |
| Per-run isolated Codex home | Yes | Backend prepares `0700` state, passes only the scrubbed environment, and proves cleanup. |
| Conditional setup from effective route | Yes | Setup leaves non-Codex consumers independent of Codex. |

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | Yes | Apply progress records RED, GREEN, and REFACTOR evidence for all three work units. |
| All tasks have tests | Yes | 15/15 tasks are covered by the listed unit, integration, or route-fixture tests; task 3.5 documentation/config is structurally covered. |
| RED confirmed | Yes | Every referenced test file exists; apply progress records the pre-implementation failures. |
| GREEN confirmed | Yes | 5,380/5,380 tests pass in the final suite. |
| Triangulation adequate | Yes | 143 changed/relevant test cases cover success, invalid input, timeout, mutation, cleanup, routed, and unrouted variants. |
| Safety net for modified files | Yes | Apply progress records focused and full-suite regressions for each implementation slice; final full-suite verification passed. |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---:|---:|---|
| Unit | 48 | 5 | Node.js `node:test` |
| Integration | 93 | 2 | Node.js `node:test` with temporary stage/worktree fixtures |
| E2E | 2 | 1 | Node.js `node:test` route fixtures |
| **Total** | **143** | **8** | |

### Changed File Coverage

Coverage analysis skipped because no coverage tool is configured.

### Assertion Quality

All assertions verify real behavior. No tautologies, assertion-free production paths, type-only-only assertions, ghost loops, or mock-heavy files were found in the eight changed/relevant test files.

### Quality Metrics

**Linter**: Not available.  
**Type checker**: Not available.  
**Structural checks**: Passed shell syntax checks and `npm run brain:repo:check`.

### Issues Found

**CRITICAL**: None.  
**WARNING**: None.  
**SUGGESTION**: None.

### Verdict

PASS — the implementation is complete, design-coherent, and fully covered by passing runtime evidence.
