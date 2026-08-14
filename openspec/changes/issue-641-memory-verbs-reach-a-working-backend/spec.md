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

## REQ-641-4 — the substitution is bounded to ops the fallback serves natively
Only `share`, `pull`, `setup`, `save` and `search` MAY be substituted. `index`, `import`,
`feature-checkpoint` and `feature-resume` project into engram's own store and MUST keep engram's
error, which names the actual fix. A substitution MUST NOT replace a message that names a
remedy with one that names a backend the caller never chose.

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
