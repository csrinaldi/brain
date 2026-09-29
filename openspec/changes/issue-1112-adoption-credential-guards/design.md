# Design — issue #1112

## Decisions

**D1 — `.env` gitignore guard lives in `bootstrap.sh`, not `npx brain init`.**
`.env` is only ever written by `bootstrap.sh`'s `env_set` (§3); `npx brain
init` (`lib/init.mjs`) never touches it. The guard (`ensure_env_gitignored`)
runs as the first thing in §3, before `env_get`/`env_set` are used for the
token, so no code path can write the secret before the guard has run.
`git check-ignore -q .env` is used instead of a literal grep on the
repo-root `.gitignore`, because it also honors a broader pattern
(`.env*`), a parent directory's `.gitignore`, or `core.excludesFile` —
anything less would risk a false "not ignored" against a repo that
already covers it, or a false "ignored" that misses a real gap.

**D2 — `vcs.provider` validation is a fixed two-value enum, not a
`memorySecretPatterns` scan.** The issue's expected behavior asks for
both ("accepts only the known providers" AND "no value matching
memorySecretPatterns is ever written"). Restricting the prompt to
`github`/`gitlab` (ADR-0008's own set) satisfies both at once for this one
write path: no PAT-shaped string can ever equal one of the two literals,
so a separate secret-pattern scan would add complexity without covering
any case the enum doesn't already close.

**D3 — `brain-to-engram.mjs` reuses `engram.mjs`'s `deriveProject`
(exported), not a fourth divergent copy.** `plainfiles.mjs` and
`engram.mjs` already each carry their own copy, deliberately (R1 in
`engram.mjs`'s own comment) — that decision is about the two BACKEND
ADAPTERS staying independent of each other, not about every other caller
reinventing project resolution. `brain-to-engram.mjs` is a third,
unrelated caller (not a backend adapter), and the issue's own "Expected
Behavior" says it should "resolve the project the same way as the rest of
the adapter (deriveProject)" — i.e., specifically reuse `engram.mjs`'s
version. Exporting it and importing it is the minimal, spec-literal fix.

`brain-to-engram.mjs` also gained a `run({repoRoot, config, sources,
engramSave, log, logErr})` seam and a `process.argv[1] ===
fileURLToPath(import.meta.url)` main-module guard (the same pattern
`brain-audit.mjs`/`brain-promote.mjs`/etc. already use), so the project
resolution and failure-counting logic are unit-testable without spawning
a real `engram` binary or touching the real `brain/` tree.

**D4 — `plainfiles` never calls `brain:memory:index`.**
`plainfiles.mjs#index()` always throws (`unsupportedOp`, C3 Decision 5) —
it is not a bug, it is a deliberate scope boundary (no doc→memory
projection target for plainfiles). Calling it from `bootstrap.sh` and
catching the failure with `warn` would report a permanent design decision
as if it were a transient, fixable failure on every single plainfiles
bootstrap, forever. The `plainfiles)` case arm runs `setup` and `pull`
(both genuinely supported) and prints an informational `ok` naming why
`index` is skipped.

**D5 — item 4 is a stop, not a guess.** The worktree brief explicitly
names "how the first commit of a new repo should be made under the
hooks" as an example of a product decision this agent must not invent.
That is item 4 verbatim: `pre-commit`'s check 2 (#788/#782 slice 2)
refuses every commit from the main checkout regardless of branch, and the
adoption commit is necessarily made from the only checkout that exists.
Three technically valid fixes exist (unborn-HEAD exemption, documented
`--no-verify`, guide reordering) with real tradeoffs — see `proposal.md`
— and none is derivable from the issue or the ADRs alone.

## Testing approach

Every fix is a bash fragment or pure JS function LIFTED OUT OF the real
source file and executed/imported directly in its test — the same idiom
`bootstrap.worktree.test.mjs`/`bootstrap.tier-notice.test.mjs` already
use (#340: no second copy of the logic to drift from the real one).
`brain-to-engram.mjs`'s `run()`/`resolveProject()` are genuinely
importable (guarded by the main-module check), so those get ordinary unit
tests plus one true end-to-end run against THIS repo's own
`brain.config.json` (which has `project.name === ""` today — the live,
unmodified shape of the defect).
