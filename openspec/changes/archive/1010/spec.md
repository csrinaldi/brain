# Spec: candidate integrity for the cold-review stage (#1010)

## R1010-1 — the suite writes nothing into the real repo root

Any test that spawns `node brain/scripts/memory/cli.mjs setup` (or otherwise
calls `engram.setup()`) MUST run it against a sandboxed root, never the real
repository root, regardless of `process.cwd()`.

`engram.setup({root = repoRoot} = {})` MUST forward `root` to
`ensureMemorySymlink(root)`. When a caller forwards `BRAIN_MEMORY_TEST_ROOT`
via `cli.mjs`'s `ROOTED_OPS` seam, the `.engram -> .memory` symlink MUST be
created only under that sandboxed root, never under the real repo root.

**Verification**: `cli.backend-fallback.test.mjs`'s guard test snapshots the
real repo root's `.engram` state before running the real `setup` subprocess
through `runCli()`, and asserts the state is unchanged after — a
before/after comparison, never an absence claim (a developer checkout may
already carry the symlink).

## R1010-2 — a symlink is hashed by its target, never through it

`snapshotCandidate()`'s `entry()` MUST hash a symlink's identity as its
target string (`readlinkSync`), never by following the link
(`readFileSync`).

**Verification**: a symlink to a directory and a symlink to a file both
snapshot without throwing; retargeting a symlink to an already-present
sibling (no byte under either target changes) is classified as `changed`.

## R1010-3 — the refusal names what changed

When `compareCandidateSnapshots(...).equal` is `false`, the
`run-cold-review-stage.mjs` refusal reason MUST name the changed paths
(added/removed/changed), bounded to the first 10 (sorted) plus a count of
the rest.

**Verification**: a single-path mutation names that path exactly; a
12-path mutation shows exactly 10 named paths and a `(+2 more)` suffix.

## R1010-4 — the engine's own hooks stay out of the candidate

The claude harness backend's `runStage()` MUST spawn the CLI with
`--settings {"disableAllHooks": true}` on every run, so the repo's own
committed `.claude/settings.json` SessionStart hook (or any other hook)
never fires inside a stage this backend runs — including a cold review over
the repo's own candidate worktree. This is a claude-backend-specific detail;
brain's cross-engine contract is "must not mutate the candidate", not "must
not run hooks".

**Verification**: `runStage()`'s spawned args array always contains
`--settings` followed by `JSON.stringify({disableAllHooks: true})`.

## R1010-5 — the prompt tells the engine the candidate tree is off-limits

Measured on PR #1019's own cold review, with R1010-1..4 already in place:
the stage correctly refused — "the cold-review candidate changed during
execution; refusing publication — 1 path(s) changed: +scratch" — because the
engine created a `scratch` file inside the candidate on its own initiative.
Disabling hooks (R1010-4) and naming what changed (R1010-3) do not stop an
engine that was never told the tree is off-limits.

When `assembleReviewPrompt()` renders the DETACHED CHECKOUT paragraph
(`artifactRoot` given and `artifactPath` absolute — file mode), the prompt
MUST state, in its own voice: the working directory is snapshotted before
and after the run; any added, removed, or changed path inside it refuses
publication of the whole review; the engine therefore creates, edits, and
deletes nothing under the working directory (no scratch files, no notes, no
installed modules, no test artefacts left behind); the only file it writes
is the artifact path, which is deliberately outside the working directory;
scratch space, if needed, is the OS temp dir.

This paragraph MUST NOT appear when there is no working directory to
protect (plain mode — no `artifactRoot`), so the plain-mode prompt never
carries a dangling reference to a snapshot rule with nothing above it to
anchor it.

**Verification**: the file-mode prompt (absolute `artifactPath`) matches
"snapshotted", "refuses publication", "no scratch files", and "OS temp dir";
the plain-mode prompt matches neither "DETACHED CHECKOUT" nor "snapshotted".
