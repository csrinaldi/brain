---
status: draft
issue: 641
---

# Spec

## REQ-641-1 — the documented verb works where the work happens
`npm run memory:share` MUST complete successfully in an environment with no `engram` binary and
no stated `MEMORY_BACKEND`. It MUST NOT require the caller to set an environment variable, and
it MUST NOT be satisfied by a message that only names an install command.

## REQ-641-2 — a substituted backend is announced
When the dispatcher runs a backend other than the one `MEMORY_BACKEND` resolved to, it MUST say
so, naming the backend that was unavailable, the backend that ran, and the verb. The notice MUST
go to **stderr**: `brain/scripts/hooks/pre-push` and `post-merge` discard stdout, and those are
the callers most likely to meet a substitution.

## REQ-641-3 — a stated selector is never overridden
When `MEMORY_BACKEND` is set explicitly — in the environment **or** in `.env` — the dispatcher
MUST run that backend, even when its binary is absent, and the run MUST still fail. The failure
MUST additionally name the records-only route that does work.

## REQ-641-4 — the substitution is bounded to ops that the missing binary actually BLOCKS
Only `share` and `pull` MAY be substituted — the ops measured to fail with "engram binary not
found". Every other op MUST keep engram's behaviour:

- `setup` and `index` exit 0 with no binary installed. `engram.setup()` in particular creates the
  `.engram → .memory` symlink and registers the `merge=union` driver for `.memory/manifest.json`
  (ADR-0002), and `plainfiles.setup()` does NEITHER — substituting silently drops the merge driver
  that ADR-0017's union safety rests on.
- `save`/`search` are refused by design (C3 Decision 5), and the refusal already names the
  records-only route (#530). Substituting would make that signpost unreachable.
- `import` is genuinely blocked, but `plainfiles` has no `importMemory`, so substituting trades a
  message naming the actual fix for one naming a backend the caller never chose.

A fallback MAY only replace a FAILURE. Where the op does not fail on the binary, a substitution is
not a fallback but a silent behaviour change, and is prohibited. The covered set MUST be derived
from measured behaviour, not from which ops the fallback backend happens to implement.

## REQ-641-5 — presence is measured, never inferred from a failure
The decision MUST be driven by a direct probe of the binary, never by inspecting a thrown
error's message. An engram failure that is not "the binary is missing" MUST propagate unchanged.

## REQ-641-6 — "I could not check" is a distinct answer from "it is not there"
The probe MUST be three-valued. A probe that could not run MUST NOT be reported as an absent
binary, MUST NOT trigger a substitution, and MUST be reported as a probe failure carrying its
cause. This applies to `requireEngram` as well as to the dispatcher.

## REQ-641-7 — one copy of the resolution rule
The dispatcher's decision and `engram.mjs`'s refusal MUST read the same binary-resolution
expression. No second copy of `which engram` may remain in the backend.

## REQ-641-8 — the notices are catalog keys
Every string added MUST exist in both `en.mjs` and `es.mjs` and MUST differ between them. A
Spanish locale MUST NOT be handed English text.

## REQ-641-9 — proven by running it, and by mutation
Each requirement above MUST be red-proved: the guard removed, the mutation shown to have landed,
the failure observed, the file restored byte-identically. Behaviour on a machine that *has*
engram MUST be pinned by a test that plants a real binary on the probe's PATH, not by inspection.
