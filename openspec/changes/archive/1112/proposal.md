# Issue #1112 — a fresh consumer's init can publish a credential, and reports success over failures it saw

## Status
Applied (see `tasks.md`).

## Intent

The #1081 consumer demonstration (`csrinaldi/brain-test`, adopting
`@logikas/brain@1.7.0`) found four defects in `brain init` / `env:init`,
plus a fifth folded in from the issue's own comments (#1121 phase 1):

1. `.env` is never git-ignored by `brain init`/`env:init` — the operator's
   PAT is one `git add -A` away from a public commit.
2. `vcs.provider` accepts any typed string at the interactive prompt and
   writes it verbatim into the TRACKED `brain.config.json` — a pasted PAT
   answered the prompt in the repro and got committed to a tracked file.
3. `brain-to-engram.mjs` read `project.name` directly (`brain-to-engram.mjs:16`,
   pre-fix); `env:init` only ever sets `project.slug`, so every
   `engram save … --project ""` call failed, and `env:init` reported
   success over the failure it observed.
4. The installed pre-commit hook refuses the adoption commit — it is
   necessarily the first commit on `main` in a brand-new repo, and the
   guide never says how to make it.
5. `bootstrap.sh`'s memory `case` had only `engram)` and `*)`, so
   `MEMORY_BACKEND=plainfiles` — a real, supported backend — was reported
   as `I18N_BOOTSTRAP_MEMORY_UNKNOWNBACKEND`.

Evidence: `openspec/changes/issue-1081-memory-2-0-exit-audit/findings.md`
(F1-F4) and its `evidence/` directory, on the #1081 branch.

## Scope

Fix items 1, 2, 3, 4, 5 in `bootstrap.sh` / `brain-to-engram.mjs` /
`brain/scripts/hooks/pre-commit` (the product surfaces `env:init` and the
adoption commit actually run through), each behind a red test that
reproduces the exact defect first.

## Item 4 (hook refusal of the adoption commit) — ruled

`brain/scripts/hooks/pre-commit`'s check 2 (issue #788/#782 slice 2)
refuses **every** commit from the main checkout, on **any** branch, once
`core.hooksPath` is set — not only direct commits to `main` (check 1).
`env:init` sets `core.hooksPath` at `bootstrap.sh:384` (unconditionally,
before the memory-backend case), and in the #1081 repro the adoption
commit is attempted AFTER `env:init` has already run — so both checks are
live against the only checkout that exists.

This needed a product decision this agent was not authorized to make (the
worktree brief names this exact scenario as an example of one), so it was
first stopped and reported as a fork with three options (below).

**Ruling (maintainer, 2026-09-29): Option A.** `pre-commit` exempts a
commit when **the repository has no commit at all**
(`git rev-list -n 1 --all` empty), printing one line naming why the
commit was allowed. The exemption applies while NO ref reaches any commit;
it stops applying once one does. (It is not permanent: deleting every ref
brings it back, in a state with no shared history left to protect.) The rationale, in order: (1) check
2 (#782) exists so parallel work cannot collide in one checkout, and a
repository with no commit at all has no parallel work to isolate; (2)
the cost (ADR-0036) of moving `npx brain init`/`env:init`'s files, `.env`
and git config into a separate worktree, or re-running the install
there, on the most fragile step for someone new to brain; (3) an orphan
worktree (`git worktree add --orphan`) is the one construction that
could otherwise isolate this commit even with zero commits so far, and
it requires git >= 2.42. See `design.md` D5 for the full rationale.

**Corrected condition after cold review, same day.** The first cut
detected "HEAD is unborn" (`git rev-parse --verify -q HEAD` failing)
instead of "the repository has no commit at all". That is a different,
narrower-looking-but-actually-wider fact: `git checkout --orphan x` in
the main checkout of a repo that already has real history ALSO makes the
current HEAD unborn, so the first cut's exemption fired repeatably for a
crafted orphan-branch commit — reopening #782 on demand (reproduced in
cold review). See `design.md` D5.1 for the corrected condition and the
real-git-fixture tests that pin both the "still refused" side (a second
commit from the main checkout; a direct commit to `main` once HEAD is
born) and the orphan-branch regression (refused, even though HEAD is
unborn again).

**Corrected RATIONALE after a second cold review, same day (2026-09-29).**
The ruling above originally read "`git worktree add` cannot run without
a commit, so worktree isolation is impossible for exactly that commit" —
i.e., that `git worktree add` itself requires a commit to exist. That
premise is FALSE: `git worktree add --orphan` works against a repository
with zero commits (git >= 2.42, verified on 2.53). The maintainer
re-confirmed Option A the same day with the corrected rationale given
above, which does not depend on that false premise: the exemption rests
on there being no parallel work to protect against yet, not on worktree
creation being impossible. See `design.md` D5 for the full record.

Options B (document `--no-verify`) and C (reorder the guide) were not
taken. `docs/adoption.md`/`docs/KNOWN-LIMITATIONS.md` remain untouched by
this change: the adoption guide describes the PUBLISHED package and
changes when this fix ships in a release, and `docs/KNOWN-LIMITATIONS.md`
is the orchestrator's to update once for all phase-1 fixes.

The three original options, for the record:

| Option | What it does | Tradeoff |
|---|---|---|
| A — no-commit-at-all exemption (taken, corrected) | Hook checks 1 and 2 add a guard: exempt when the repository has no commit at all (`git rev-list -n 1 --all` empty — NOT merely "HEAD is unborn", which `git checkout --orphan` can also produce in a repo with history). Stops applying once any ref reaches a commit (deleting every ref brings it back). | Purely mechanical, derivable from the hooks' own stated purpose (protect history / enable parallel work — neither applies before any commit exists). No doc change needed. Does not cover a SECOND pre-adoption commit (e.g. `npm init -y` before `brain init`), which is a real step in the guide. |
| B — document `--no-verify` explicitly | `docs/adoption.md` states, in Path A, that the adoption commit uses `git commit --no-verify`, with the reasoning (hooks aren't load-bearing yet on a repo with no history/branches). | Zero code change. Leaves the bypass as the sanctioned path forever, which is what issue #1112 calls "undocumented" today — documenting it doesn't make it not a bypass. |
| C — reorder the guide | `docs/adoption.md` has the operator commit `npx brain init`'s output BEFORE running `env:init` (which is what sets `core.hooksPath`). | No code change, no bypass. Breaks down as soon as `env:init` itself writes files worth committing (`brain.config.json` `ensure`, `brain/HOME.md` scaffold) — a second commit would still hit the hook once it's installed. |

## Acceptance

- A fresh consumer's `env:init` never leaves `.env` untracked-but-unignored.
- `env:init` FAILS CLOSED: if `.env` is already tracked by git, or the
  ignore check fails for any other reason, the PAT is never written — the
  step stops with a message naming the real fix (`git rm --cached .env`
  for the tracked case), never a warning the write proceeds past anyway.
- `vcs.provider` can only ever become `github` or `gitlab` through the
  interactive prompt.
- `MEMORY_BACKEND` can only ever become `engram` or `plainfiles` through
  the interactive prompt, validated with the same loop shape as
  `vcs.provider` — not a second style for the same class of prompt.
- `brain-to-engram.mjs` resolves the project the same way the rest of the
  engram adapter does (`deriveProject`, called directly — no pass-through
  wrapper), and a real indexing failure makes `env:init` report failure,
  not silent success.
- `MEMORY_BACKEND=plainfiles` is never reported as an unknown backend.
- The adoption commit (repo's first commit) is accepted by `pre-commit`
  even from the main checkout, with the reason printed; a second commit
  from the same main checkout is still refused, unchanged; an orphan
  branch created in a repo that already has history is judged by checks
  1/2 exactly as any other commit — never exempted.
- `env:init` also refuses a symlinked or otherwise non-regular `.env` —
  the same fail-closed gate, checking file TYPE first, independently of
  tracking/ignore status.
- The same gate refuses a HARDLINKED `.env` (link count > 1), and every
  refusal states that the non-secret settings were still written.
- A refused PAT write is recorded as a REQUIRED failure (not folded into
  the optional-degradation list), named in the final summary, and turns
  the exit code non-zero — proven end to end under a real interactive
  run, not merely at the fragment level.

## Cold review, round 3 (2026-09-29)

Two more findings, on top of the item-4 ruling above (which is unchanged
and not touched by this round — pre-commit and its docs were explicitly
out of scope for round 3, pending a separate maintainer answer on the
first-commit exemption's rationale):

1. **BLOCKER — symlinked `.env`.** The blocker-2 gate (D6) checked
   tracking/ignore status by PATH only, never asking what `.env` actually
   WAS. A `.env -> /outside/secrets.env` symlink, with `.env` matched by
   `.gitignore`, passed both checks — `git check-ignore` matches the
   symlink's own path same as any regular file — so the gate said "safe"
   and `env_set`'s `>> .env` followed the symlink, writing the PAT outside
   the repo entirely (reproduced). Fixed: `[ -L .env ]` checked first
   (before `-f`, which follows symlinks), and anything that exists but is
   not a regular file is refused the same way. See `design.md` D8.
2. **SHOULD-FIX (class C) — a refused write was still a clean exit.** The
   gate only ever `warn`ed on refusal, the same signal used for genuinely
   optional degradations, so `env:init` still finished reading as a
   successful setup. Fixed: `REQUIRED_FAILURES`, a list distinct from
   `MISSING_OPTIONAL`, recorded only when an actual attempt was refused;
   the final summary names it and the process exits non-zero. Proven end
   to end under a real pty, not just at the fragment level — see
   `design.md` D9.
3. **NIT** — the gate's rationale comment now notes that `.git/info/exclude`
   and a global `core.excludesFile` count as ignored for THIS CLONE ONLY
   (never travel to a fresh clone), and that the whole gate runs once,
   before any of the PAT-section prompts.
