# ADR-0033 Amendment 4: each engine declares its output mode, and one redaction rule covers every engine (issue #1129)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1128-platform-and-engine-contracts/brain-drafts/adr-0033-amendment-4.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0033-cold-review-transport.md
amendment: 4
issue: 1129
home-summary: the engine declares its output mode in its descriptor — `file` (the engine writes the artifact) or `final-message` (the host writes it from the engine's final message, renamed atomically) — and the runner reads it instead of branching on `codex`/`gemini`, refusing an engine that cannot execute a stage before it clears anything; every engine builds its failure reason with one redaction rule (redact over the full text, strip control bytes, cap at 4 KiB); readiness is dispatched through the descriptor and gemini is wired; the contract is review-engine-contract.md, #1129
body: ## Amendment 4 — each engine declares its output mode, and one redaction rule covers every engine (issue #1129)
body-end: ### Notes for the promoter
```

```amend-find
It is written, never committed by the run.
```

```amend-replace
It is written, never committed by the run. **[Amended by Amendment 4 (#1129): in an engine's declared `final-message` mode the host writes this file from the engine's final message, renamed atomically from a host-owned temp path outside the candidate; the engine declares its mode (review-engine-contract.md).]**
```

```amend-find
by name to choose the final-message output.
```

```amend-replace
by name to choose the final-message output. **[Amended by Amendment 4 (#1129): no longer — the runner reads the engine's declared output mode.]**
```

```amend-find
  is #1129.
```

```amend-replace
  is #1129. **[Amended by Amendment 4: dropped by #1129.]**
```

## Amendment 4 — each engine declares its output mode, and one redaction rule covers every engine (issue #1129)

**Signed**: DD/MM/YYYY — <Name>

### What changed

Decision part 3 said "the engine writes" the artifact. Two engines did not: codex and gemini return
it as a final message, and the host writes the file. The runner chose between the two by comparing
`routing.engine` to `codex` and `gemini`. Now:

- **The engine declares its output mode** in its `<name>.descriptor.mjs` (ADR-0038 Amendment 2):
  `file` (the engine writes the artifact at the absolute path the prompt names) or `final-message`
  (the host hands it a temp path outside the candidate, renames the bytes atomically to the artifact
  path, and reads them with brain's own findings reader). The runner reads the mode and names no
  engine.
- **An engine that cannot execute a stage is refused before any mutation.** That covers an engine
  with no descriptor and one that does not declare `executeStage`. The refusal comes before the
  previous artifact is cleared, never after, and it is never a fallback.
- **One redaction rule for every engine.** A failure `reason` carries engine output only through
  `engineTail`: it redacts the scrubbed credentials' values over the full text, strips control
  bytes, keeps the last 4 KiB, then shows the last two lines. claude, which redacted nothing, and
  gemini, which neither stripped nor capped, now conform.
- **Readiness goes through the descriptor.** `harness/readiness.mjs` reads the routed engine's
  descriptor, checks a pinned model, and calls the engine's own `checkReadiness`. `bootstrap.sh`
  calls it, so a gemini route is probed at bootstrap, as a codex route already was.
- **The model policy is declared:** `opaque` (claude, as part 1 decided), `pinned` (codex) or
  `default` (gemini).

The contract is `brain/core/methodology/review-engine-contract.md`.

### Why

#1129: a fourth engine meant editing the runner and writing another readiness script. The three
engines leaked different amounts of their output into a reason that reaches the operator and the
review.

### What this does NOT change

Part 1's opaque model for every engine that declares `opaque`, part 2 (spawn through the harness),
part 4 (only `brain:review` touches the forge), the warrant table, the credential channels, and
Amendments 1-3. In `file` mode the engine still writes the artifact, as part 3 decided.

### What the code does not do yet, said plainly

- **No distinct quota state.** "The engine exited" can still be a usage limit.
- **The runner still reads `sdd.map`** (#1132).

### Notes for the promoter

Three in-place annotations: part 3's output sentence, and the two sentences of Amendment 3's "does not
do yet" bullet about the name branch. Amendment 3 is the latest today, so this is number 4. Promote it
after `adr-0038-amendment-2.draft.md`. Source: #1129.
