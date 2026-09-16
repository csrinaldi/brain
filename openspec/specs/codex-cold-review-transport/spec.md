# Codex Cold-Review Transport Specification

## Purpose

Run the repository-owned `cold-review` stage through Codex `gpt-5.5` without transferring authority for prompts, artifact validation, challenge, or publication to the transport.

## Requirements

### Requirement: Execute a bounded Codex review

When the effective stage route selects Codex, the transport MUST run non-interactive `codex exec` with model `gpt-5.5`, a read-only sandbox, ignored user configuration, ephemeral execution, and an isolated writable `CODEX_HOME`. It MUST pass the repository-owned review prompt and exact candidate reference; it MUST NOT replace the first-party reviewer or poster.

#### Scenario: Routed review succeeds

- GIVEN a ready Codex CLI, authenticated account, writable isolated state, and supported sandbox
- WHEN the cold-review stage executes
- THEN Codex inspects the bound candidate and returns a final message for host validation
- AND the parent-owned poster remains the only publication actor

#### Scenario: Runtime prerequisite is unavailable

- GIVEN missing authentication, model entitlement, network access, sandbox support, or writable `CODEX_HOME`
- WHEN execution is attempted
- THEN the transport refuses the review with actionable, secret-scrubbed diagnostics
- AND it does not publish findings

### Requirement: Materialize output outside the candidate

The host MUST supply an output descriptor identifying a writable destination outside the immutable candidate. The transport MAY write only the final Codex message there; it MUST reject descriptors that resolve inside, through, or onto candidate paths and MUST treat missing or unreadable output as failure.

#### Scenario: Final message is materialized safely

- GIVEN a valid host-owned output descriptor outside the candidate
- WHEN Codex exits successfully
- THEN exactly the final message is available at that destination
- AND no candidate file, directory, or metadata is used as the output destination

#### Scenario: Output descriptor is unsafe or absent

- GIVEN an output path inside the candidate, an unresolvable path, or no output file
- WHEN the stage completes
- THEN the transport fails closed before artifact publication

### Requirement: Enforce candidate immutability

The host MUST snapshot the candidate's complete path inventory, bytes (including SHA-256 digests), and file modes before and after execution. Any addition, deletion, rename, byte change, or mode change MUST invalidate the run, even when Codex exits zero.

#### Scenario: Candidate remains unchanged

- GIVEN matching before/after inventories, digests, and modes
- WHEN output validation continues
- THEN the run may proceed to the existing findings parser

#### Scenario: Codex mutates the candidate

- GIVEN any before/after difference
- WHEN the host compares snapshots
- THEN it refuses publication and reports the bounded difference without exposing secrets

### Requirement: Preserve fail-closed findings and security boundaries

The existing exact-one `brain-findings/1` reader MUST remain authoritative for Codex output. Malformed, empty, multiple, or schema-invalid blocks, timeout, non-zero exit, or leaked credential/config evidence MUST produce no publishable result. The transport MUST return bounded diagnostics and MUST NOT edit durable doctrine.

#### Scenario: Valid artifact passes transport checks

- GIVEN immutable candidate evidence and exactly one valid `brain-findings/1` block
- WHEN the host validates the final message
- THEN it returns the artifact to the existing challenge and poster flow

#### Scenario: Validation or security check fails

- GIVEN malformed output, timeout, non-zero exit, or suspected credential exposure
- WHEN validation runs
- THEN the stage reports failure and emits no finding to the poster
