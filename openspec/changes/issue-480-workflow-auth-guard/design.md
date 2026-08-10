---
status: draft
issue: 480
---

# Design

`lib/workflow-auth.mjs` — `stepBlocks`, `auditWorkflowAuth`.

## The pipeline

1. **`stepBlocks`** slices on step bullets at a common indent and returns each slice whole.
   The bullet line is rewritten from `- key:` to plain indentation, because A3 has a second
   form: recognising `- run: …` as a step and then reading it as if it had no `run:` at all.
   Comments are stripped first.
2. **`runScript`** extracts the shell, handling `|`, `>` and inline (A1, A2).
3. **`entryPoints`** resolves `node <path>` and `npm run <verb>` (A5) through
   `package.json`, case-insensitively (A6).
4. **`importClosure`** walks relative imports transitively.
5. **`requirementFor`** classifies: closure reaches `vcs/cli.mjs` ⇒ `VCS_TOKEN`; the shell
   or a script in the closure spawns `gh`/`glab` ⇒ a credential (A4, A7); every command
   inert ⇒ nothing; anything unresolved ⇒ **violation**.
6. The `permissions:` scope condition, applied only when a block exists.

## Why the inert list is small and safe-side

It names shell builtins, `git`, and text utilities. `curl` is deliberately absent and is
asserted to be caught — the point is that forgetting an entry costs a false alarm, never a
miss. The counterweight is asserted too: a step of `set`/`git`/`echo` must stay clean, or
the guard becomes noise and stops being read.

## The limitation that is asserted rather than denied

PR #476's guard carried a rationale that was **false** — "Actions does not inherit a token
into a step" — and the cost was concrete: a maintainer consolidating four duplicated
bindings into one job-level `env:` would get a working workflow and a red guard, with a
comment telling them it was impossible.

This guard reads the step block, so an inherited credential is invisible to it. That is
asserted by a test that says so, so the next reader learns the truth from the suite instead
of the fiction from a comment. The honest response to that refactor is to widen the guard.

## Red-proof

Ten mutations, all RED. M5 (comments not stripped) **survived the first pass** — A10 turned
out to be defended by anchoring the credential read, not by stripping. Stripping earns its
place on the other side: a shell comment mentioning `gh` in an otherwise inert step would
demand a token for nothing. The guard added for that kills M5.

| mutant | the lie it would tell |
|---|---|
| M1 undecidable becomes a pass | the whole defect class returns |
| M2 a missing script reads as safe | a deleted entry point passes |
| M3 an unrecognised binary reads as inert | `curl` escapes |
| M4 the bullet is not normalised | A3's second form |
| M5 comments are not stripped | a comment demands a token |
| M6 case-sensitive entry match | `.MJS` escapes |
| M7 `npm run` unresolved | A5 escapes |
| M8 provider CLI not seen in the shell | A4/A7 escape |
| M9 credential pinned to an expression | #476's false positive returns |
| M10 the scope condition dropped | looks fixed, still blind |

Full suite: **3031 tests, 0 failures**.
