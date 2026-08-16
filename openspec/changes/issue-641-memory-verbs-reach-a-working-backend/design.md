---
status: draft
issue: 641
---

# Design

## Decision 1 — the fallback lives in the dispatcher, not in `package.json`

ADR-0004 §17 makes `cli.mjs` "the single entry point; reads `MEMORY_BACKEND` and delegates".
Resolving the selector is already its job, so extending that resolution is a change to the thing
that owns the question. Putting it in `package.json` (option 1) would encode the answer in seven
npm scripts, where it cannot consult anything, cannot explain itself, and cannot tell an engram
machine from an agent container.

The decision itself is lifted into `lib/backend-selection.mjs` because `cli.mjs` is a
top-level-`await` script that calls `process.exit` — untestable except through a child process.
The pure core is unit-tested directly; the half the ticket is actually about (that a human hears
it) is tested through the real CLI in a child process.

## Decision 2 — `stated` is carried separately from the resolved value

The resolved value cannot express the distinction the ruling turns on: `MEMORY_BACKEND=engram`
in `.env` and no `.env` at all both come out `"engram"`. So the dispatcher keeps
`STATED_BACKEND` (possibly `undefined`) alongside `MEMORY_BACKEND` (always a name), and
`stated: STATED_BACKEND !== undefined` is what `selectBackend` reads.

This is the same asymmetry `plainfiles.save` applies to `project` vs `type` (#530): a fact the
tool can derive gets derived; a choice the caller made gets honoured. An unstated default is not
a choice. An `.env` line is.

## Decision 3 — the covered set is named, not computed

`FALLBACK_OPS` is an explicit `["share", "pull", "setup", "save", "search"]`, not
`typeof plainfiles[fn] === "function"`. The computed form would be wrong: `index`,
`featureCheckpoint` and `featureResume` *are* exported functions on `plainfiles` — they defer at
runtime via `unsupportedOp`. So the property that matters is behavioural and a static check
cannot see it.

The list is not left to drift, either. `backend-selection.test.mjs` measures it against the real
`plainfiles` module: every covered op must be a function, and every excluded-because-deferred op
must actually **reject** with the deferral message. If one of them ever becomes real, that test
fails and says so — the list is a claim under measurement rather than a comment.

## Decision 4 — a direct probe, never a caught error message

The tempting implementation is `try { engram.share() } catch (e) { if (/binary not found/.test(e.message)) … }`.
It is rejected. On a machine that *has* engram, a genuine export failure would then be
swallowed and silently retried on a different backend — turning a loud, real failure into a
quiet, wrong success. That is strictly worse than the defect being fixed. So the probe runs
*before* dispatch and decides on its own evidence.

The cost is one extra `which` per backend op, paid only when the resolved backend is `engram`;
`plainfiles` and the backend-agnostic ops (`reindex`, `resolve-index`, `migrate-v1`) never
probe, because they have already exited above the selection block.

## Decision 5 — three-valued, because two-valued is how the house defect is built

`spawnSync` reports *its own* failure in `.error` while still returning an object, so on a
container with no `which` the old `result.status !== 0` test produced `true` — reported as
"engram binary not found". "The check did not run" wore the costume of "the binary is not
there".

That was cosmetic while the only consequence was an error string. It stops being cosmetic the
moment the same answer decides whether to run a backend nobody asked for: a broken probe would
switch the backend on a machine that may well have engram.

Hence `{available: true} | {available: false} | {available: null, reason}`, and `null` is inert —
it substitutes nothing and reports itself. `selectBackend` also treats a missing or garbled
probe object as `null` rather than as permission, so a future caller cannot get a green light by
passing nothing.

## Decision 6 — `requireEngram` reads the same expression

Leaving `engram.mjs` with its own `spawnSync("which", ["engram"])` would be the #340 shape: two
copies of one rule, free to drift, with the dispatcher concluding "absent, substitute" while the
backend concludes "present, run". The observable symptom would be a backend nobody chose.

The absent-branch message is preserved byte for byte, so no existing test or reader's
expectation moves. What is new is the third branch, which was previously unreachable-by-design
because the two-valued test absorbed it.

## Decision 7 — a test-only seam for `.env`

`BRAIN_MEMORY_ENV_FILE` joins `BRAIN_MEMORY_TEST_ROOT` and `BRAIN_MIGRATE_V1_TEST_ROOT`, with
the same "NEVER set this outside tests" warning.

It is not decoration. The stated-vs-defaulted branch is read partly out of `.env`, and `.env` is
gitignored — so whether the maintainer's checkout happens to carry `MEMORY_BACKEND=engram` would
decide the outcome of the very branch under test. That is exactly the trap #657's suite hit with
an ambient `$VCS_TOKEN`: green in the container, red on the maintainer's box, for reasons having
nothing to do with the code. The end-to-end suite also replaces `PATH` outright rather than
inheriting it, for the same reason — `engram` present vs absent is the variable under test.

## What was measured and turned out to be false

The first version of the `index` test asserted a non-zero exit and a `gentle-ai install`
message. Run, it failed: `engram.index()` never calls `requireEngram` at all. It shells
`brain-to-engram.mjs`, which prints `✗ … spawnSync engram ENOENT` once per document and then
**exits 0** with `0 documentos del cerebro indexados`.

That is a separate `evidence-reader-empty-on-failure` instance — a reader whose total failure is
reported as a healthy-looking count of zero — in a file this ticket does not claim. It is named
in the proposal and left alone; the test now asserts only what #641 owns (that nothing was
swapped underneath `index`) and records the measurement in a comment so the next reader does not
repeat the assumption.
