---
status: draft
issue: 633
---

# Design

## Decision 1 — two layers of test, because each catches what the other cannot

**Behavioural.** The real hooks run with a mock `node` on a synthetic PATH that writes a distinct
marker to *each* stream, and the test asserts which one survives. This follows
`pre-push.test.mjs`'s established technique rather than inventing a second one, and it is the
only layer that proves the redirection actually behaves as intended — a structural scan would
pass against a hook whose redirection is syntactically fine and semantically wrong.

The mock writes to **both** streams unconditionally. A mock that only wrote to stderr would pass
against a hook that discarded stdout as well, which is the other half of the rule.

**Structural.** A scan of every hook file for `cli.mjs` invocations, failing on any that discards
stderr. The behavioural layer can only cover lines that exist today. This one covers the line
somebody adds next year, which is what the acceptance actually asks for.

Neither is sufficient alone, so both ship.

## Decision 2 — the structural check scans, rather than listing the three known lines

The tempting form is a list: "these three lines must read `>/dev/null`". It would pass forever
while a fourth line is added with `2>&1` beside them — the precise failure this ticket is an
instance of, since `post-merge:35` carried the right reasoning in the same file as `:43`'s
mistake.

So the check has no list. It walks the hook directory, skips `.mjs`/`.md`, and refuses any line
mentioning `cli.mjs` that also matches `2>&1` or `2>/dev/null`. Comment lines are excluded so the
explanations in the headers — which necessarily quote the forbidden forms — do not fail the check
that explains them.

## Decision 3 — the rule is pinned as prose too

`REQ-633-7` looks redundant next to the structural guard. It is not: a later edit could delete
the header comments while leaving the test green, and the repository would keep a guard nobody
can find the reasoning for. This repo has already paid for that once — the `tranche.mjs`
evaluator ADR-0031 describes cited `CLAUDE.md`, a file that does not exist.

So the test asserts the rule's sentence is present in both hooks. Enforcement and explanation
fail together or not at all.

## Decision 4 — `|| true` and `|| exit 0` are untouched, and tested

They are a *different* decision from the redirection, and the ticket is explicit that they stay.
The risk in a change like this is fixing the stream and accidentally letting a tool's exit code
start blocking a push — so a test asserts both hooks still exit 0 while the mock writes to both
streams.

Their existence is also what makes the stderr loss severe rather than cosmetic: `|| exit 0`
discards the exit code by design, so once `2>&1` discarded the message there was no channel left
at all. That is the argument for the change, and it depends on the `|| exit 0` staying exactly
where it is.

## Decision 5 — `feature-checkpoint` decided by measurement, not by symmetry

The ticket suspected `2>/dev/null` was "exactly backwards" and left it to be decided on the same
rule. Measuring it made the case stronger than symmetry would have: the verb writes **0 lines to
stdout**, so the redirection was not merely inverted — it discarded 100% of what the command
says, and the specific thing it silenced is the ambiguous-feature skip the hook's own comment
documents as a known limitation.

A limitation documented in a comment and invisible at runtime is indistinguishable from a
limitation that does not occur.

## What was measured and changed the work

The first probe of `resolve-index` reported **0 stderr lines with a duplicate planted**, which
would have suggested the ticket was wrong about that line. It was the measurement that was wrong:
`resolve-index` resolves its store from `repoRoot` and does **not** honour
`BRAIN_MEMORY_TEST_ROOT` (cli.mjs:170), so it had read the real store — which #636 had just
reconciled to zero. Checked before concluding anything, rather than reporting a finding that
would have sent the next reader to a defect that is not there.

That absence of a test seam on `resolve-index` is real, and it is why the behavioural layer uses
a mock `node` rather than a fixture store: the mock needs no seam and tests the hook rather than
the verb, which is what this ticket owns.
