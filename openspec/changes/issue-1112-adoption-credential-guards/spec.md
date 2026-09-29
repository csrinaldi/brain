---
status: applied
issue: 1112
---

# Adoption never publishes a credential, and reports failures it saw (#1112)

## Requirements

### Requirement: `.env` is git-ignored before any secret is ever written into it

#### Scenario: fresh repo, no `.gitignore`
- **WHEN** `env:init` reaches §3 (Personal PAT) in a repo with no `.gitignore`
- **THEN** a `.gitignore` is created containing `.env`, and `git check-ignore -q .env` succeeds, before the PAT is ever written

#### Scenario: existing `.gitignore` without a trailing newline
- **WHEN** `.gitignore` already exists and does not end in a newline
- **THEN** the pre-existing content survives intact on its own line, and `.env` is appended as its own line

#### Scenario: idempotent
- **WHEN** `env:init` runs twice
- **THEN** `.gitignore` contains exactly one `.env` line

#### Scenario: an existing broader pattern already covers `.env`
- **WHEN** `.gitignore` already contains a pattern like `.env*`
- **THEN** no redundant literal `.env` line is added, and `git check-ignore -q .env` still succeeds

### Requirement: `env:init` fails closed — a credential is never written unless `.env` is confirmed safe

Cold-review finding (blocker 2), 2026-09-29: `git check-ignore` never reports a TRACKED path as ignored, no matter which pattern matches it, so a warning-only response to a failed ignore check left the PAT write unblocked.

#### Scenario: `.env` is already tracked by git
- **WHEN** `.env` is tracked (even if a `.gitignore` pattern matches it) and the operator provides a candidate token
- **THEN** the token is never written to `.env`, and a message names the real fix (`git rm --cached .env`, then re-run `env:init`)

#### Scenario: the ignore check fails for another reason
- **WHEN** `.env` is untracked but `git check-ignore -q .env` still fails after the repair attempt, and the operator provides a candidate token
- **THEN** the token is never written to `.env`

#### Scenario: safe — no regression
- **WHEN** `.env` is untracked and ignored, and the operator provides a candidate token
- **THEN** the token is written to `.env`, unchanged from before this fix

### Requirement: `vcs.provider` accepts only `github` or `gitlab`

#### Scenario: an invalid answer is rejected and never persisted
- **WHEN** the interactive VCS-provider prompt receives an answer that is not `github`, `gitlab`, or empty
- **THEN** the answer is rejected with a reported message, re-prompted, and never written to `brain.config.json`

#### Scenario: a valid answer is accepted
- **WHEN** the prompt receives `github` or `gitlab`
- **THEN** it is accepted and, if different from the derived value, persisted to `brain.config.json`

#### Scenario: an empty answer keeps the derived default
- **WHEN** the prompt receives an empty answer
- **THEN** the derived `VCS_PROVIDER` is kept and `brain.config.json` is not rewritten

### Requirement: `MEMORY_BACKEND` accepts only `engram` or `plainfiles`

Cold-review should-fix 3, 2026-09-29: reuses the exact validation loop shape used for `vcs.provider`, rather than a second style for the same class of prompt.

#### Scenario: an invalid backend is rejected and re-prompted
- **WHEN** the interactive memory-backend prompt receives an answer that is not `engram`, `plainfiles`, or empty
- **THEN** the answer is rejected with a reported message and re-prompted

#### Scenario: a valid backend is accepted
- **WHEN** the prompt receives `engram` or `plainfiles`
- **THEN** it is accepted

#### Scenario: an empty answer is accepted (the caller applies the `engram` default)
- **WHEN** the prompt receives an empty answer
- **THEN** the loop accepts it as-is; defaulting to `engram` remains the caller's job, unchanged

### Requirement: `brain-to-engram.mjs` resolves the project like the rest of the engram adapter, and reports a failed index

#### Scenario: `project.name` is empty (the shape `env:init` leaves)
- **WHEN** `brain.config.json` has `project.slug` set and `project.name` empty
- **THEN** every `engram save` call receives `--project` resolved via `deriveProject` (slug's last segment, called directly — no pass-through wrapper), never an empty string

#### Scenario: a per-file indexing failure is counted and reported
- **WHEN** one or more files fail to index
- **THEN** each failure is reported (never silently swallowed), and the process exits non-zero

#### Scenario: a clean run exits zero
- **WHEN** every file indexes successfully
- **THEN** the process exits zero

### Requirement: `MEMORY_BACKEND=plainfiles` is a recognized backend

#### Scenario: plainfiles setup and pull run
- **WHEN** `MEMORY_BACKEND=plainfiles`
- **THEN** `memory/cli.mjs setup` and `brain:memory:pull` both run, and neither is reported as an unknown backend

#### Scenario: `index` is never called for plainfiles
- **WHEN** `MEMORY_BACKEND=plainfiles`
- **THEN** `brain:memory:index` is never invoked (it is unsupported by design for plainfiles — C3 Decision 5 — and would always fail)

#### Scenario: a genuinely unknown backend is still reported as unknown
- **WHEN** `MEMORY_BACKEND` is neither `engram` nor `plainfiles`
- **THEN** the existing unknown-backend warning still fires

### Requirement: `pre-commit` accepts a repository's first commit even from the main checkout

Ruled by the maintainer 2026-09-29 (Option A) after this change first stopped and reported the fork. **Corrected the same day**: the condition is "the repository has no commit at all" (`git rev-list -n 1 --all` empty), never "the current HEAD is unborn" (`git rev-parse --verify HEAD` failing) — the two are not equivalent, and the cold review reproduced the gap between them (see the orphan-branch scenario below).

#### Scenario: the first commit is accepted, even on a branch named "main"
- **WHEN** a commit is attempted in a fresh repository with no prior commits, `core.hooksPath` set to the installed hooks, on a branch named `main`
- **THEN** the commit succeeds

#### Scenario: detection is structural, not by branch name
- **WHEN** the same first-commit scenario runs on a default branch named something other than `main`/`master` (e.g. `trunk`)
- **THEN** the commit still succeeds

#### Scenario: the exemption is reported
- **WHEN** the first commit is accepted via the no-commit-at-all exemption
- **THEN** one line naming the reason is printed

#### Scenario: a second commit from the main checkout is still refused
- **WHEN** a second commit is attempted from the same main checkout, on a non-`main` branch, after the first commit has landed
- **THEN** it is refused by check 2 (never a branch in the main checkout), unchanged

#### Scenario: check 1 is unchanged once HEAD is born
- **WHEN** a direct commit to `main` is attempted after the first commit has already landed
- **THEN** it is refused by check 1, unchanged

#### Scenario: an orphan branch in a repo WITH history is never exempted
- **WHEN** `git checkout --orphan` is run in the main checkout of a repository that already has a commit (e.g. on `main`), making the current HEAD unborn again, and a commit is then attempted on that orphan branch
- **THEN** the commit is refused by check 2 exactly as any other main-checkout commit — the no-commit-at-all exemption never fires, because `main`'s commit is still reachable from `git rev-list --all`

#### Scenario: no other installed hook needed the same exemption
- **WHEN** `pre-push`, `commit-msg` and `pre-receive` are reviewed for a branch-name or main-checkout/worktree refusal
- **THEN** none is found — only `pre-commit` carried this class of check, and no GitLab counterpart exists because "which local checkout made this commit" is not observable server-side

#### Scenario: the published adoption guide is untouched
- **WHEN** this change is reviewed
- **THEN** `docs/adoption.md` and `docs/KNOWN-LIMITATIONS.md` are unchanged (they describe the published package and are the orchestrator's to update once, respectively)
