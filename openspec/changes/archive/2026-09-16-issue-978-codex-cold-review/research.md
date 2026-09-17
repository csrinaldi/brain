# Codex cold-review transport research

```yaml
schema: gentle-ai.sdd-research/v1
revision: 3
outcome: done
change: issue-978-codex-cold-review
accessed_at: 2026-09-16
admission:
  schema: gentle-ai.sdd-research-capability/v1
  grants:
    documentation: granted
    open-web: granted
```

## Answer first

The selected `gpt-5.5` transport is viable on the tested Linux host. A network-enabled
Codex CLI 0.154.0 run authenticated with ChatGPT, inspected a read-only candidate,
returned the expected final message, and let the host write that message outside the
candidate without changing candidate paths or bytes. The same CLI failed before
inference when its isolated `CODEX_HOME` was read-only, so writable runtime state is a
hard preflight requirement even with `--ephemeral` and `--ignore-user-config`.

Conditional installation is feasible but not implemented yet. The repository currently
routes `cold-review` to Claude and neither `install-tools.sh` nor `bootstrap.sh` detects
Codex. The proposal should make Codex detection, installation guidance, authentication,
and runtime probes conditional on an effective `engine: "codex"` route; unrouted
consumers must retain today's dependency surface.

## Research questions and disposition

| Question | Disposition | Evidence |
| --- | --- | --- |
| Is network-enabled `gpt-5.5` inference available? | Proven for the tested account and host; not a universal entitlement claim. | S1, R1, R2 |
| What CLI and authentication assumptions are supported? | Codex CLI supports non-interactive `exec`, model override, ChatGPT or API-key authentication, and an auth-status check. | S2, S3, S4, R1 |
| Can the candidate be inspected read-only? | Proven on Ubuntu 26.04 x86_64 with Codex CLI 0.154.0 and bubblewrap 0.11.1. | S4, S6, R2 |
| Can the host materialize the final artifact outside the candidate? | Proven with `--output-last-message`; the file appeared outside the candidate while the candidate remained unchanged. | S2, S4, R2 |
| Is candidate-tree immutability enforced? | Proven for the bounded probe by modes, complete file inventory, and before/after SHA-256 equality. Production still needs the same checks around every run. | S6, R2 |
| Must `CODEX_HOME` be writable? | Proven for this CLI/runtime: a read-only isolated home failed app-server initialization before inference; a writable isolated home succeeded. | S2, S3, S5, R2, R3 |
| How should conditional installation behave? | Bounded as a product/implementation contract: only an effective Codex route activates detection or setup diagnostics. It is not current repository behavior yet. | S7, R4 |

## Sources

| ID | Class | Title | Publisher | URL | Accessed | Short excerpt |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | documentation | GPT-5.5 model | OpenAI | https://developers.openai.com/api/docs/models/gpt-5.5 | 2026-09-16 | “GPT-5.5 is a flagship model for the most complex professional work.” |
| S2 | documentation | Codex CLI developer commands | OpenAI | https://developers.openai.com/codex/cli/reference | 2026-09-16 | “Write the assistant’s final message to a file. Useful for downstream scripting.” |
| S3 | documentation | Codex authentication | OpenAI | https://developers.openai.com/codex/auth | 2026-09-16 | “Codex supports two ways for a person to sign in when using OpenAI models.” |
| S4 | documentation | Codex non-interactive mode | OpenAI | https://learn.chatgpt.com/docs/non-interactive-mode | 2026-09-16 | “Use `codex exec` to run Codex in scripts and CI.” |
| S5 | documentation | Codex environment variables | OpenAI | https://learn.chatgpt.com/docs/config-file/environment-variables | 2026-09-16 | “Sets the root for Codex state, including config, auth, logs, sessions, skills, and standalone package metadata.” |
| S6 | documentation | Codex sandboxing | OpenAI | https://learn.chatgpt.com/docs/sandboxing | 2026-09-16 | “The sandbox applies to spawned commands, not just to built-in file operations.” |
| S7 | documentation | OpenAI Codex README | OpenAI | https://github.com/openai/codex/blob/main/README.md | 2026-09-16 | “Codex CLI is a coding agent from OpenAI that runs locally on your computer.” |

All external claims above use OpenAI-owned documentation or the official OpenAI Codex
repository. Excerpts are orientation aids; the mapped claims rely on the source pages,
not on excerpt text alone.

## Runtime observations

### R1 — installed runtime and authentication

- Host: Ubuntu 26.04, x86_64, kernel `7.0.0-31-generic`.
- Codex CLI: `0.154.0`; executable SHA-256
  `3188814c35471432d4123203e0eb38e5bddc60226e3d7ddf0e59e649ea140022`.
- Sandbox dependency: `/usr/bin/bwrap`, bubblewrap `0.11.1`.
- `codex login status` reported `Logged in using ChatGPT`.
- No credential contents, raw environment values, or authentication artifacts are
  included in this report.

### R2 — successful bounded network inference

The probe created an isolated writable `CODEX_HOME`, copied the existing auth cache
without displaying it, created a mode-`0555` candidate directory with mode-`0444`
files, and ran the following sanitized command shape:

```text
CODEX_HOME=<writable-isolated-home> timeout 120s codex exec \
  --model gpt-5.5 \
  --sandbox read-only \
  --cd <read-only-candidate> \
  --skip-git-repo-check \
  --ephemeral \
  --ignore-user-config \
  --output-last-message <host-output>/last.txt \
  <bounded read-and-reply prompt>
```

Observed result:

- process exit: `0`;
- selected model: `gpt-5.5`;
- provider: OpenAI;
- expected final message: `brain-codex-gpt55-proof-ok`;
- host output file: present outside the candidate;
- candidate file inventory: exactly the two original files;
- candidate before/after SHA-256 set: equal;
- candidate directory and file modes: unchanged.

This proves availability only for the tested account, CLI build, host, and date. Every
deployment still needs its own preflight because model entitlement, authentication,
network policy, CLI version, and sandbox support can differ.

### R3 — read-only `CODEX_HOME` negative control

The same isolated setup was repeated with a mode-`0555` `CODEX_HOME` and mode-`0444`
auth cache. The process exited `1`, produced no final-message file, and reported:

```text
Error: failed to initialize in-process app-server client: Permission denied (os error 13)
```

The failure occurred before model inference. `--ephemeral` suppresses persisted rollout
files; it does not make all Codex runtime state or authentication access stateless.

### R4 — repository installation baseline

- `brain.config.json` currently routes `sdd.map["cold-review"]` to Claude/Sonnet.
- `brain/scripts/install-tools.sh` installs/checks Claude and Gentle AI but contains no
  Codex detection or installation branch.
- `brain/scripts/bootstrap.sh` checks optional ecosystem tools including Claude but not
  Codex.
- `test/fresh-install/` has no Codex-specific coverage.

Therefore conditional installation is not already present. The implementation must add
route-sensitive behavior rather than merely document a pre-existing capability.

## Validated claims

| Claim | Source mapping | Validation |
| --- | --- | --- |
| C1. `gpt-5.5` is a current OpenAI model and completed one real Codex CLI inference for the tested account. | S1, R2 | Official model catalog plus exit-zero observed inference. |
| C2. `codex exec` is the supported non-interactive surface; `--model`, `--sandbox`, `--ephemeral`, `--ignore-user-config`, and `--output-last-message` are documented inputs. | S2, S4 | Documentation and the successful exact flag combination. |
| C3. `--output-last-message` lets the host materialize final output outside a read-only candidate. | S2, S4, R2 | Output appeared outside; candidate hashes and inventory were unchanged. |
| C4. Codex supports ChatGPT and API-key authentication; the tested run used an existing ChatGPT login. | S3, R1, R2 | Official authentication contract plus local status and successful inference. |
| C5. `CODEX_HOME` owns auth and runtime state and must be writable for this isolated CLI execution path. | S2, S3, S5, R2, R3 | Official state locations plus positive and negative controls. |
| C6. Linux sandbox readiness depends on bubblewrap/user-namespace support and cannot be inferred from CLI presence alone. | S6, R1, R2 | Official prerequisite plus successful host observation. |
| C7. Conditional installation must be newly implemented and keyed to the effective route; current unrouted consumers do not install Codex. | S7, R4 | Official install mechanisms plus repository baseline inspection. |

## Contradictions, uncertainty, and freshness

- No source contradiction blocks the selected design. The important nuance is that
  `--ephemeral` means no persisted rollout files, not “no writable Codex state.”
- The successful inference is dated evidence, not a durable entitlement guarantee.
  Runtime preflight must continue to classify authentication/model unavailability.
- The probe proves the selected mechanism on one Linux host only. macOS, WSL2, native
  Windows, older CLI builds, and Linux hosts without working bubblewrap/user namespaces
  remain outside the proof.
- `--output-last-message` writes a final message; it does not prove that the bytes satisfy
  `brain-findings/1`. The existing repository artifact parser must remain authoritative.
- Copying a ChatGPT auth cache was limited to this trusted local proof. Official guidance
  prefers API keys for ordinary automation; production authentication remains an operator
  responsibility and must never be printed or embedded in repository state.
- Official web documentation and model availability were checked on 2026-09-16. Recheck
  them when changing the pinned minimum CLI version or release policy.

## Product choices (confirmed, non-authoritative research context)

- Intended configured inference model: `gpt-5.5`.
- Installation policy: `conditional_install`.
- Research selection: `research_required`.
- Artifact mode: hybrid.
- Delivery strategy: auto-chain.

These choices came from the maintainer. This research validates feasibility and bounds;
it does not replace the proposal's product and scope decisions.

## Proposal constraints

1. Treat Codex as a transport. Keep the repository-owned prompt, exact refs,
   `brain-findings/1` reader, challenger, and poster contracts unchanged.
2. Run the candidate with `--sandbox read-only`; materialize only the final message via a
   host-owned destination outside the candidate.
3. Snapshot candidate inventory, bytes, and modes before and after execution and fail
   closed on any difference, even when the CLI exits zero.
4. Require a pre-existing writable `CODEX_HOME`, usable authentication, `gpt-5.5`
   availability, network access to OpenAI, and supported sandbox prerequisites.
5. Preserve `--ignore-user-config` and `--ephemeral` for controlled automation, while
   recognizing that authentication still resolves through `CODEX_HOME`.
6. Make Codex install/detection logic conditional on the effective stage route. An
   unrouted consumer must not download, authenticate, or fail because Codex is absent.
7. For a routed consumer, an absent/old CLI, unwritable state directory, missing auth,
   unavailable model, sandbox failure, timeout, non-zero exit, missing output, malformed
   artifact, or candidate mutation must each fail closed with actionable diagnostics.
8. Add both route-negative and route-positive installer/bootstrap/fresh-install tests;
   documentation alone is insufficient proof of conditional behavior.

## Research conclusion

Outcome: `done`. Every selected question is either proven for the bounded test environment
or explicitly bounded as an implementation contract with current-state evidence. The
research supports proposal creation without claiming cross-host support or universal model
entitlement.