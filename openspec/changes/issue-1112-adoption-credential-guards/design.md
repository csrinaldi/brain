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

**D3.1 — cold-review nit fixed: `deriveProject` called directly, no
`resolveProject` wrapper.** The first cut added a `resolveProject(config,
root)` function whose entire body was `return deriveProject(config,
root)` — a pure pass-through with no logic of its own. `run()` now calls
`deriveProject` directly (imported straight from
`axes/memory/adapters/engram.mjs`); the tests that exercised the old
wrapper now exercise `deriveProject` via that same import.

**D4 — `plainfiles` never calls `brain:memory:index`.**
`plainfiles.mjs#index()` always throws (`unsupportedOp`, C3 Decision 5) —
it is not a bug, it is a deliberate scope boundary (no doc→memory
projection target for plainfiles). Calling it from `bootstrap.sh` and
catching the failure with `warn` would report a permanent design decision
as if it were a transient, fixable failure on every single plainfiles
bootstrap, forever. The `plainfiles)` case arm runs `setup` and `pull`
(both genuinely supported) and prints an informational `ok` naming why
`index` is skipped.

**D5 — item 4 was a stop, then ruled: Option A (maintainer, 2026-09-29).**
The worktree brief explicitly named "how the first commit of a new repo
should be made under the hooks" as an example of a product decision this
agent must not invent, so item 4 was first stopped and reported as a
fork (three options, `proposal.md`). The maintainer then ruled Option A:
`pre-commit`'s check 2 (#788/#782 slice 2) refuses every commit from the
main checkout regardless of branch, and `git worktree add` itself cannot
run without at least one commit already existing — it cannot create a
worktree off an unborn branch — so the isolation check 2 exists to force
is structurally impossible to satisfy for a repository's very first
commit. The maintainer's own words: "the pre-commit hook exempts a
commit when HEAD is unborn ... because `git worktree add` cannot run
without a commit, so worktree isolation is impossible for exactly that
commit."

**D5.1 — implementation, CORRECTED after cold review.** The first cut
detected via `git rev-parse --verify -q HEAD` failing — "the CURRENT HEAD
is unborn". Cold review reproduced a bypass: `git checkout --orphan x` in
the main checkout of a repo that already has real history ALSO makes the
current HEAD unborn, so that detector exempted a crafted orphan-branch
commit from checks 1/2 repeatably — reopening #782 on demand, exactly the
guard check 2 exists to close. "HEAD is unborn" and "the repository has
no commit" are not the same fact, and the maintainer's own ruling names
the second one: `git worktree add` needs "a commit", not "a born HEAD".

The condition is now **the repository has no commit reachable from ANY
ref** — `git rev-list -n 1 --all` empty — checked once, ahead of checks 1
and 2. `--all` still reaches `main`'s commit even while `HEAD` itself is
freshly orphaned, so the corrected gate stays false (checks 1/2 apply
normally) for the orphan-branch case, and is only ever true before the
very first commit anywhere in the repository. On that no-commit path, the
hook prints one line to stdout naming the reason ("the repository has no
commit yet") and falls through directly to checks 3/4
(`staged-records-check.mjs`, `check-refs.mjs`), skipping only checks 1
and 2 — those two are the only ones this issue is about, and nothing else
changes for the adoption commit.

The gate is self-closing, restated precisely: false again FOREVER once
any commit exists anywhere in the repository — not merely "once this
commit lands" (the first cut's claim, which was true but insufficient: it
did not rule out a LATER unborn state via `--orphan`). No operation makes
a repository's total commit count go from 1 back to 0, so there is no
separate "first N commits" counter or flag to go stale, and no way to
re-enter the exempted state once any commit exists.

**D5.2 — other hooks checked, none changed.** `pre-push`, `commit-msg`
and `pre-receive` were read end-to-end: none contains a branch-name or
main-checkout/worktree check (`rg` for `MAIN CHECKOUT`/`git-common-dir`/
`abbrev-ref HEAD` across all four hook files matches only `pre-commit`).
`commit-msg`/`pre-receive` require Conventional Commit format + a ticket
reference, which the adoption commit can satisfy by being written
correctly (`chore: adopt brain (#N)`) — that is ordinary commit hygiene,
not the class of unconditional, branch-blind refusal item 4 is about, so
it needed no exemption. `pre-receive` is also not installed by `env:init`
at all — it is a bare-repo server hook the maintainer installs explicitly
via `npm run brain:protect-server`, so it is not in a fresh consumer's
adoption path. No GitLab counterpart is needed for the same structural
reason check 2 itself only makes sense client-side: "which local checkout
made this commit" is not observable from a server, so nothing server-side
(a GitLab CI job, a push rule) could implement or need the same
exemption.

**D6 — fail-closed credential gate (cold-review blocker 2).**
`ensure_env_gitignored` (finding 1) only WARNS when it cannot confirm
`.env` is ignored; that warning never stopped the PAT write that follows.
Measured: `git check-ignore` NEVER reports a path as ignored once it is
TRACKED, no matter which pattern in `.gitignore` matches it — a previous
run (this same bug, before this fix, or a manual `git add -A`) may
already have committed `.env`. A `.gitignore` fix cannot protect a secret
about to be written into a file git's index already has, so tracked
status must be checked SEPARATELY from (and before) the ignore check — it
changes which remedy is correct.

`ENV_SECRET_SAFE`/`ENV_SECRET_UNSAFE_REASON` are computed once
(`git ls-files --error-unmatch .env` for tracked, else
`git check-ignore -q .env` for ignored) and read by the single place that
writes a new secret into `.env`. Unsafe for either reason: the write is
skipped and a message names the real remedy — `git rm --cached .env` for
the tracked case (nothing else fixes it), a generic "fix .gitignore by
hand" for any other ignore-check failure. `VCS_TOKEN` itself is NOT
cleared after a refused write — the in-memory value still authenticates
THIS session's git operations (§4/§5 below); only the durable write to
`.env` is refused, so the same unsafe state is caught again next run.

**D7 — `MEMORY_BACKEND` validation reuses the `vcs.provider` loop shape
(cold-review should-fix 3).** Same defect class as finding 2: the
interactive prompt accepted any typed string and wrote it into `.env`,
with the consequence only surfacing later, deep inside
`memory/cli.mjs`'s backend dispatch. Rather than invent a second
validation style for the same class of prompt, the fix is the identical
shape — read into a scratch variable, `case` it against the closed set
(`engram`, `plainfiles`, or empty), re-prompt on anything else. The
scratch variable (`_membackend_answer`, not `$MEMORY_BACKEND` directly)
is deliberate: the real backend-dispatch `case "$MEMORY_BACKEND" in` a
few lines below is a DIFFERENT case statement for a different job, and
reading into the same variable name would make this loop's own `case
"$MEMORY_BACKEND" in` textually identical to it — exactly the kind of
accidental collision a test's own marker-based fragment extraction (#340)
cannot tell apart.

**D8 — the fail-closed gate checks FILE TYPE, independently of and before
tracking/ignore status (cold-review round 3, blocker).** D6's gate
checked whether `.env` was tracked or ignored, both BY PATH — it never
asked what `.env` actually WAS. A symlink (`.env -> /outside/secrets.env`)
passes both of those checks exactly as a regular file would (the symlink
itself is untracked, and `git check-ignore` matches the symlink's own
path same as any other path), so the gate said "safe" and `env_set`'s
`>> .env` followed the symlink, appending the PAT to a file OUTSIDE the
repo entirely (reproduced). `[ -L .env ]` is checked FIRST, before `[ -f
.env ]` (which follows symlinks and would misclassify a
symlink-to-a-regular-file as safe); anything else that exists but is not
a regular file (a directory, a FIFO, …) is refused the same way, under a
distinct `notRegularFile` reason. The refusal message for a symlink names
the target (`readlink .env`), because "must be a regular file" alone
does not tell the operator what to go check.

**D9 — a refused write is a REQUIRED failure, recorded separately from
MISSING_OPTIONAL, and turns into a non-zero exit (cold-review round 3,
should-fix, class C).** Before this, the gate's refusal was only ever a
`warn` — the same soft signal already used for genuinely optional
degradations (a missing `gh` binary, a failed `brain:memory:pull`).
`MISSING_OPTIONAL`'s own name says what class it is for, and a VCS token
the operator actually typed in, that `env:init` could not persist, is not
in that class. `REQUIRED_FAILURES` is declared as its own array (next to
`MISSING_OPTIONAL`, same top-of-file spot), appended to only inside the
write-gate's refusal branch — never for the "operator skipped the prompt"
case, which attempted nothing. §9's `required-failure-summary` prints the
list in the same final summary a human reads AND exits 1 when it is
non-empty, so a script whose last visible line still reads "Environment
ready" cannot also be read as success by anything checking `$?`.

## Testing approach

Every fix is a bash fragment or pure JS function LIFTED OUT OF the real
source file and executed/imported directly in its test — the same idiom
`bootstrap.worktree.test.mjs`/`bootstrap.tier-notice.test.mjs` already
use (#340: no second copy of the logic to drift from the real one).
`brain-to-engram.mjs`'s `run()` is genuinely importable (guarded by the
main-module check), so it gets ordinary unit tests (calling `deriveProject`
directly, D3.1) plus one true end-to-end run against THIS repo's own
`brain.config.json` (which has `project.name === ""` today — the live,
unmodified shape of the defect).

Item 4's tests are the one exception: they run the REAL installed
`pre-commit` hook against a REAL `git init` fixture (`core.hooksPath`
pointed at the real hooks directory), copying `brain/scripts` + `brain/core`
into the fixture the same way `bootstrap.tier-notice.test.mjs`'s own
`copyBrain` does — checks 3/4 downstream of the new gate need those files
to exist under the fixture's own `--show-toplevel`. A mocked-git fixture
(like `pre-commit.test.mjs`'s existing suite) would only prove the gate
reads the mock correctly, not that `git rev-list -n 1 --all` behaves as
expected against real git — which is exactly what the corrected D5.1
needed proven, including the orphan-branch regression case (`git checkout
--orphan` in a repo WITH history, still refused by check 2). The mocked
`pre-commit.test.mjs` suite was updated in the same pass (a `hasCommit`
fixture flag, default `true`) so its seven pre-existing scenarios — which
all implicitly modeled a repo with history — keep meaning what they always
meant now that gate 0 exists.

D6's two fragments (`env-secret-safe-gate`, `pat-write-gate`) and D7's
(`memory-backend-validate`) follow the same lifted-fragment idiom, each
proven against a real temp git repo where real tracked/ignored state
matters (D6) or against piped stdin driving the same loop shape as
`vcs-provider-validate` (D7). D8's symlink/non-regular-file cases extend
the same two D6 fragments with `symlinkSync`/`mkdirSync` fixtures (a real
symlink pointing outside the repo, and a directory in `.env`'s place).

D9's mechanism (`REQUIRED_FAILURES`, `required-failure-summary`) gets the
same fragment-level proof — but the requirement itself ("the operator
actually tried, bootstrap.sh actually refuses, actually exits non-zero")
needed one thing the fragment tests cannot give: a genuine run of the
WHOLE script reaching the write gate through real interactive input.
§3's PAT prompt only fires when `[ -t 0 ]` is true, and piped stdin is
never a TTY — so `bootstrap.pat-refusal-e2e.test.mjs` drives the real
`bootstrap.sh` under an actual pseudo-tty
(`__fixtures__/pty-drive.py`, using python3 — already a required base
dependency, since Node has no built-in pty) against a fixture with a
TRACKED `.env`, answering the two PAT-section prompts (open-browser: no;
paste-PAT: a fake token) as a human would, and asserts the real exit
code, the real summary text, and that the fake token lands nowhere on
disk. One residual, documented in that test file's own header rather
than worked around: under a real pty specifically (not a plain piped
subprocess, where the same isolation env vars work as expected), `gh
auth status` in this sandbox still reports the ambient session's real
login. It is read-only (no push, no token use) and the test asserts
nothing about that line.
