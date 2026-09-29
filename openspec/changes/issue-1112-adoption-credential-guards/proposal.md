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

Fix items 1, 2, 3, 5 in `bootstrap.sh` / `brain-to-engram.mjs` (the product
surfaces `env:init` actually runs), each behind a red test that reproduces
the exact defect first. Item 4 is **not implemented** — see "Stopped:
item 4" below.

## Stopped: item 4 (hook refusal of the adoption commit)

`brain/scripts/hooks/pre-commit`'s check 2 (issue #788/#782 slice 2)
refuses **every** commit from the main checkout, on **any** branch, once
`core.hooksPath` is set — not only direct commits to `main` (check 1).
`env:init` sets `core.hooksPath` at `bootstrap.sh:384` (unconditionally,
before the memory-backend case), and in the #1081 repro the adoption
commit is attempted AFTER `env:init` has already run — so both checks are
live against the only checkout that exists.

This needs a product decision this agent is not authorized to make (the
worktree brief names this exact scenario as an example of one). Three
options, not mutually exclusive:

| Option | What it does | Tradeoff |
|---|---|---|
| A — unborn-HEAD exemption | Hook checks 1 and 2 add a guard: exempt when `git rev-parse HEAD` fails (repo has zero commits yet). Self-closing: the exemption stops applying the moment the first commit lands. | Purely mechanical, derivable from the hooks' own stated purpose (protect history / enable parallel work — neither applies before any commit exists). No doc change needed. Does not cover a SECOND pre-adoption commit (e.g. `npm init -y` before `brain init`), which is a real step in the guide. |
| B — document `--no-verify` explicitly | `docs/adoption.md` states, in Path A, that the adoption commit uses `git commit --no-verify`, with the reasoning (hooks aren't load-bearing yet on a repo with no history/branches). | Zero code change. Leaves the bypass as the sanctioned path forever, which is what issue #1112 calls "undocumented" today — documenting it doesn't make it not a bypass. |
| C — reorder the guide | `docs/adoption.md` has the operator commit `npx brain init`'s output BEFORE running `env:init` (which is what sets `core.hooksPath`). | No code change, no bypass. Breaks down as soon as `env:init` itself writes files worth committing (`brain.config.json` `ensure`, `brain/HOME.md` scaffold) — a second commit would still hit the hook once it's installed. |

`docs/adoption.md` is also out of scope here for a second reason: the
worktree brief reserves `docs/KNOWN-LIMITATIONS.md` for the orchestrator to
update once for all phase-1 fixes, and the adoption guide's Path A
narrative is coupled to that same limitations list.

## Acceptance

- A fresh consumer's `env:init` never leaves `.env` untracked-but-unignored.
- `vcs.provider` can only ever become `github` or `gitlab` through the
  interactive prompt.
- `brain-to-engram.mjs` resolves the project the same way the rest of the
  engram adapter does, and a real indexing failure makes `env:init` report
  failure, not silent success.
- `MEMORY_BACKEND=plainfiles` is never reported as an unknown backend.
- Item 4 is described here as a fork, with options and tradeoffs, not
  silently implemented as an assumed default.
