---
status: draft
issue: 633
---

# Spec

## REQ-633-1 — a hook never discards stderr on a `cli.mjs` invocation
No hook may use `2>&1` or `2>/dev/null` on a `memory/cli.mjs` call. `>/dev/null` stays: the
per-run progress line is noise on every push and every pull.

## REQ-633-2 — the rule holds for invocations that do not exist yet
The prohibition MUST be enforced by a check that scans every hook file, not only by repairing the
three lines this ticket names. A rule stated in a comment and enforced nowhere is the decay this
ticket is an instance of.

## REQ-633-3 — the push path reports, and still does not block
`pre-push`'s `|| exit 0` MUST stay. With it, a `share` failure — including `rebuildIndex`'s
tamper refusal — MUST reach the operator on stderr and MUST still exit 0.

## REQ-633-4 — `post-merge`'s `resolve-index` reports
`resolve-index` runs precisely because two branches merged, which is when `merge=union` mints a
duplicate. Its stderr MUST survive. `|| true` stays.

## REQ-633-5 — `feature-checkpoint` is decided on the same rule
Measured, it writes 0 lines to stdout and 2 to stderr, so `2>/dev/null` discarded everything it
says — including the hook's own documented ambiguous-feature skip. It MUST discard stdout and
keep stderr, like every other invocation.

## REQ-633-6 — both directions are proved
A store WITH duplicates MUST surface the report; a CLEAN store MUST stay silent. A check that
fires on every store reports nothing.

## REQ-633-7 — the rule is written where the next hook author reads it
Both hooks MUST state the rule in full, and a test MUST pin that they do — so a later edit cannot
remove the reasoning and leave the enforcement unexplained.

## REQ-633-8 — no hook gains the power to block
`pre-push` and `post-merge` MUST still exit 0 when the tool writes to either stream. The
redirection change MUST NOT alter blocking behaviour.

## REQ-633-9 — red-proved by mutation
Each requirement MUST be red-proved: the guard removed or reverted, the mutation shown to have
landed, the failure observed, the file restored byte-identically. This MUST include restoring a
plausible FUTURE offending line, not only the historical ones.
