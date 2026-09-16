## Exploration: Codex/OpenAI transport for the cold-review stage

### Current State

`brain:review` already separates production from publication. It resolves
`sdd.map["cold-review"]`, creates a detached checkout at the reviewed head,
builds the first-party Adversary prompt, spawns the selected transport, reads
`openspec/reviews/pr-N/cold-review.md`, validates its single
`brain-findings/1` JSON block, and only then lets the parent-owned poster use
`BRAIN_REVIEWER_TOKEN`. A routed transport that exits non-zero, times out,
writes no file, or writes an unreadable artifact fails closed and posts no
verdict.

The live repository routes the stage to `{ "engine": "claude", "model":
"sonnet" }`. Dispatch dynamically imports
`brain/scripts/harness/backends/${engine}.mjs`, so `engine: "codex"` would
already select `backends/codex.mjs`; no transport allow-list or model catalogue
needs to grow. There is no such backend today. The `model` value must remain an
opaque pass-through.

The Claude backend supplies the reusable security and failure pattern:

- remove the configured reviewer token plus all brain/forge token variables
  from the child environment;
- shadow `GH_CONFIG_DIR` and `GLAB_CONFIG_DIR` with one disposable directory;
- probe that exact post-scrub environment and refuse if `gh` or `glab` can
  still authenticate;
- run in the detached head worktree with a bounded timeout;
- preserve non-zero, spawn, timeout, and bounded tail evidence as failures.

Codex CLI `0.154.0` is installed locally and advertises noninteractive
`codex exec`, `--model`, `--sandbox read-only`, `--add-dir`, `--ephemeral`,
`--ignore-user-config`, `--output-schema`, and `--output-last-message`. The
candidate `gpt-5.6-luna` is present in the local SDD cheap profile and the CLI
accepted it as the selected model. An actual inference could not be proven in
this environment: the bounded probe exhausted its timeout because outbound
Codex websocket/HTTPS access was denied. The same probe also found that a
nested Codex process needs a writable `CODEX_HOME` even in ephemeral mode;
with the session's read-only home it failed before inference. Therefore model
availability, authentication, writable runtime state, and Linux sandbox
support must be explicit preflight/e2e evidence, not inferred from `--help`.

### Affected Areas

- `brain/scripts/harness/backends/codex.mjs` — new transport, runtime
  descriptor, command construction, credential scrub, sandbox, timeout, and
  result mapping.
- `brain/scripts/harness/backends/codex.test.mjs` — strict-TDD contract tests
  for argv, opaque model pass-through, environment isolation, output handling,
  and every failure class.
- `brain/scripts/review/lib/run-cold-review-stage.mjs` — likely needs to hand
  the selected backend an explicit output path/mode so Codex can remain
  read-only over the candidate while the host materializes the final artifact.
- `brain/scripts/harness/stage-seam.mjs` — must carry any new output descriptor
  without dropping it; this seam has previously dropped timeout and routing
  evidence, so a site-level test is required.
- `brain/scripts/harness/backends/gentle-ai.mjs` — compatibility check only;
  its payload-forwarding contract must not discard a newly added generic field
  if the Codex transport is later composed through a framework.
- `brain/scripts/review/lib/assemble-review-prompt.mjs` — may need a narrowly
  parameterized delivery instruction (write the file versus return its exact
  bytes), while keeping role and artifact schema derived from their current
  sources.
- `brain/scripts/review/lib/findings-artifact.mjs` — unchanged reader and
  acceptance oracle; its exact-one-block JSON contract should validate Codex
  output without a Codex-specific schema fork.
- `brain/scripts/harness/backends/agent-runtime.mjs` and its tests — reusable
  runtime probe; a Codex descriptor can report absent/unreadable/outdated CLI,
  but stage execution still needs stronger auth/model/sandbox readiness.
- `brain/scripts/install-tools.sh`, `brain/scripts/bootstrap.sh`, and
  `test/fresh-install/` — installation/detection policy for `@openai/codex` and
  actionable diagnostics. Codex should remain conditional for consumers that
  do not route a stage to it.
- `brain.config.json` — self-hosting route eventually changes to
  `{ "engine": "codex", "model": "gpt-5.6-luna" }` only after the runtime
  probe succeeds in an environment with network access.
- `docs/reviewer-setup.md` and ADR-0033-related documentation — document the
  Codex auth/state/sandbox requirements and the stronger candidate-write
  boundary. Any durable `brain/project/**` amendment must follow the existing
  human-promotion authority rather than being written directly by an agent.

### Approaches

1. **Read-only candidate plus host-materialized final artifact** — run
   `codex exec` against the detached checkout with `--sandbox read-only`; have
   Codex return exactly the artifact bytes and use
   `--output-last-message <artifact>` (or a transport-owned temporary output
   followed by an atomic host write). Pass the output path explicitly through
   the stage seam rather than extracting it from prompt prose.
   - Pros: candidate immutability is enforced by the Codex sandbox rather than
     prompt discipline; the model never needs write access to the operator
     checkout; the existing artifact reader remains the only acceptance
     boundary; parent-owned credential/forge isolation is reusable unchanged.
   - Cons: requires an explicit generic output descriptor and a transport-mode
     prompt clause; `output-last-message` still needs the existing reader to
     reject extra/malformed prose; actual sandbox and cross-directory output
     behavior must be proven on supported hosts.
   - Effort: Medium

2. **Read-only candidate with one writable artifact directory** — run Codex
   with `--sandbox read-only --add-dir <openspec/reviews/pr-N>` and retain the
   current prompt that tells the model to write the file directly.
   - Pros: smallest change to the stage contract; the produced file follows
     the same path as Claude.
   - Cons: `--add-dir` grants a directory, not one file; the interaction between
     `read-only` and `--add-dir` is not proven here; the model must choose to use
     a tool and write correctly; the absolute operator-tree path remains
     visible and writable in part.
   - Effort: Low to Medium

3. **Workspace-write Codex clone of the Claude backend** — invoke Codex in the
   cold worktree and let it write the external artifact under a broad writable
   sandbox.
   - Pros: closest mechanical copy of the current backend.
   - Cons: preserves ADR-0033's known gap: a model can edit reviewed files or
     other reachable paths and production performs no post-run tree check. It
     weakens the main security advantage available from Codex and should not be
     selected.
   - Effort: Low

4. **Use `codex exec review` and translate stdout** — delegate diff selection
   and output shape to Codex's built-in review command.
   - Pros: uses a purpose-built user-facing Codex workflow.
   - Cons: creates a second diff/role/artifact contract, bypasses the existing
     first-party Adversary prompt, and requires translation into
     `brain-findings/1`; behavior is less auditable than the generic `exec`
     path and risks reviewing ambient state instead of the supplied refs.
   - Effort: High

### Recommendation

Choose **Approach 1**. Treat Codex as another transport, not another reviewer:
the current first-party role, exact base/head references, artifact schema,
reader, challenger, and parent-owned poster remain unchanged. Add an explicit
output destination/mode to the generic `run-stage` payload, run Codex with the
candidate read-only, and let the host-owned CLI output mechanism materialize
the ephemeral artifact. Keep the existing scrub, per-run forge-config shadow,
pre-spawn forge probe, timeout, elapsed-time reporting, stale-artifact removal,
and post-spawn existence/readability checks.

The implementation should also use a quiet, ephemeral Codex invocation and
avoid loading optional user integrations where supported, but it must not
replace the user's engine authentication or assume a writable home. Runtime
readiness should distinguish at least: binary absent, runtime state unwritable,
authentication/model unavailable, sandbox unavailable, timeout, non-zero exit,
and success-without-valid-artifact. None of those may fall back to Claude.

Use strict TDD and plan a chain because the fixed review budget is 400 changed
lines. A likely three-slice shape is:

1. generic output-descriptor plumbing plus site-level seam/prompt tests, with
   Claude behavior unchanged;
2. Codex backend plus unit/e2e probes for read-only candidate, artifact-only
   output, credentials, forge isolation, runtime state, model pass-through,
   timeout, and failure semantics;
3. self-hosting route, conditional installer/bootstrap diagnostics, fresh-
   install coverage, and reviewer setup/durable documentation through the
   required human-promotion path.

Each slice should remain independently safe: no config route before the
backend exists, and no claim that `gpt-5.6-luna` works before a network-enabled
probe records a successful inference and valid `brain-findings/1` artifact.

### Risks

- `gpt-5.6-luna` availability is not yet proven; local configuration and CLI
  argument acceptance are not evidence that the account can run the model.
- Codex may need writable state below `CODEX_HOME` even with `--ephemeral`; a
  read-only automation home fails before model execution.
- Linux `read-only` sandbox enforcement depends on user-namespace/bubblewrap
  support. Unsupported or degraded sandbox startup must refuse rather than
  silently run unsandboxed.
- `--output-last-message` captures the final answer, not inherently valid
  artifact bytes. The existing artifact reader must remain authoritative, and
  an atomic temporary-file rename is preferable to exposing partial output.
- Adding a backend without threading an explicit output descriptor through
  every seam can recreate the repository's recurring dropped-field defect.
- Codex's own authentication must remain available while reviewer/VCS tokens
  are removed. An environment allow-list would be brittle; reuse the closed
  posting-token denylist and measured forge probe.
- A Codex process may have network/tool capabilities beyond `gh` and `glab`.
  The existing ADR explicitly does not claim closure over unknown credential
  channels; documentation must not inflate that warrant.
- Auto-installing and authenticating Codex for every consumer would expand the
  default dependency and side-effect surface even when `cold-review` is
  unrouted. Prefer conditional detection/install guidance tied to the route.
- The combined backend, security tests, installer changes, and documentation
  are likely to exceed 400 changed lines; a single PR would violate the fixed
  review policy without an explicit exception.

### Ready for Proposal

Yes, with a focused research/proof lane strongly recommended before proposal
finalization: run a network-enabled `gpt-5.6-luna` inference, prove the chosen
read-only/output mechanism on Linux, verify candidate-tree immutability and
artifact atomicity, and record the supported Codex CLI version/authentication
assumptions. The orchestrator should also obtain the product decision on
conditional versus automatic Codex installation and, when the task phase
confirms a chain, the chain strategy.
