# Claim sweep (#1225)

Each behavioural sentence of the 1.11.0 CHANGELOG entry and each changed doc line, against the code on this tree (`main` at `831f6c97`). "Test" names a test that pins it. Paths are under `brain/scripts/` unless stated.

Overclaim found and fixed (counted below): the first draft headline said the first PR "needs no manual step". The #1204 report (`openspec/changes/issue-1204-phase-1-exit-demo-1-10-1/report.md`) shows the two manual steps were adding a `type:*` label and pushing the branch; #1206 and #1207 make each fail first with a fix named, they do not remove it. Headline and opening paragraph rewritten.

## CHANGELOG: upgrade table and env:init (#1205, #1214)

| # | Claim | Proof | OK |
|---|---|---|---|
| 1 | 1.10.1 prompt was `Which memory backend do you use? [engram]: ` and Enter declared `engram` | `git show 318f0bf4` diff of `i18n/en.mjs` (old text) and `bootstrap.sh` (`MEMORY_BACKEND="${MEMORY_BACKEND:-engram}"` removed) | YES |
| 2 | 1.11.0 prompt is `Which memory backend does this team use? (engram\|plainfiles): `; `es` text changed too | `i18n/en.mjs:222`, `i18n/es.mjs:203`; test `i18n/coverage.test.mjs:312,317` | YES |
| 3 | There is no default: Enter re-prompts; any other answer re-prompts | `bootstrap.sh:598-600` (`''` falls through the loop, unknown prints and loops); tests `bootstrap.memory-backend-validate.test.mjs:81,102,108` | YES |
| 4 | Unknown value prints `Unknown backend "<value>" — only "engram" or "plainfiles" are supported.` | `bootstrap.sh:600` | YES |
| 5 | End of input with nothing typed declares nothing; `env:init` warns, lists the pending step with the quoted text, writes nothing | `bootstrap.sh:593-596,606-609`; test `...validate.test.mjs:113,183` | YES |
| 6 | ...and still exits 0 | the pending step is `MISSING_OPTIONAL` (`bootstrap.sh:609`); only `REQUIRED_FAILURES` exits 1 (`bootstrap.sh:804-806`) | YES |
| 7 | A valid answer with no trailing newline at end of input is kept; an invalid one at EOF is undeclared | `bootstrap.sh:593-596`; tests `...validate.test.mjs:134,140,144` | YES |
| 8 | Prompt is asked only on a terminal and only when nothing declares a backend; without a terminal nothing is asked, pending step, exit 0 | `bootstrap.sh:571` (`-t 0`) inside the resolver's exit-3 branch (`bootstrap.sh:570`); else branch `bootstrap.sh:624-627` | YES |
| 9 | A valid answer is written to tracked `brain.config.json` | `bootstrap.sh:614` (`config/cli.mjs set memory.backend`) ; test `...validate.test.mjs:191` | YES |
| 10 | ADR-0004 Amendment 3 made the backend a team decision with no default | `AGENTS.md` index line for ADR-0004 Amendment 3 (30/09/2026, #1165) | YES |
| 11 | The 1.10.0 CHANGELOG line "Enter accepts `engram`" is superseded | `CHANGELOG.md` v1.10.0 section (`env:init asks once, on a terminal (Enter accepts engram)`) vs claims 1-3 | YES |
| 12 | End of input is "Ctrl-D" at a terminal | bash `read` returns non-zero at EOF; same path the tests exercise via closed stdin (`...validate.test.mjs:113`) | YES |

## CHANGELOG: ticket:start (#1206)

| # | Claim | Proof | OK |
|---|---|---|---|
| 13 | `ticket:start` exits 1 before any branch or worktree when the issue has no `type:*` label | `ticket-start.mjs:114-118` (`process.exit(1)`), before `resolveBase` at `:126` and any `git worktree add`/`checkout`; leaf test `lib/ticket-type.test.mjs:14-23` (the script wiring itself has no test; it is verified by reading) | YES |
| 14 | In 1.10.1 it created the branch and `brain:ship` refused later | `git show 7b10eca4` (no check existed before); `brain-ship.mjs:210-217` | YES |
| 15 | Same `findTypeLabel` as `brain:ship`; matches a label starting `type:` or `type::` | `lib/ticket-type.mjs:11,19`, `brain-ship.mjs:210`, `lib/branch-type.mjs:36,61` | YES |
| 16 | Runs after the issue is read | `ticket-start.mjs:108-112` (`if (!issue?.number) exit`) precedes `:114` | YES |
| 17 | Quoted message text | `i18n/en.mjs:365` (`ticket.error.noTypeLabel`), printed with a two-space indent at `ticket-start.mjs:116` | YES |
| 18 | `env:init` already creates the `type:*` labels on your remote | `lib/env-init-setup.mjs:21,70` (`TYPE_LABELS`) | YES |
| 19 | Automation calling `ticket:start` on unlabelled issues now fails at that step | claim 13 | YES |

## CHANGELOG: brain:ship (#1207)

| # | Claim | Proof | OK |
|---|---|---|---|
| 20 | In 1.10.1 it reached the forge, which answered with a raw provider error | `openspec/changes/issue-1204-phase-1-exit-demo-1-10-1/report.md` F2 (`GraphQL: Head sha can't be blank ...`) | YES |
| 21 | Exits 1 before any forge call; runs after `brain:check` passes and before the issue is read | `brain-ship.mjs:179,190-195` (checkFn, then headPushedFn, then issueViewFn at `:198+`); test `brain-ship.test.mjs` "#1207 an unpushed branch is refused with ZERO forge calls" | YES |
| 22 | A red `brain:check` still wins and makes no remote call | `brain-ship.mjs:179-188`; test "#1207 a red check still wins" | YES |
| 23 | Uses `ls-remote`, `rev-parse`, `merge-base`; no forge call | `brain-ship.mjs:67,74,78,83` | YES |
| 24 | Never pushes or forces | `brain-ship.mjs:9,191`; no `push` spawn anywhere in the file | YES |
| 25 | Missing: `The branch was never pushed. Run: git push -u origin <branch>` | `brain-ship.mjs:90` | YES |
| 26 | Behind: `The remote branch is behind your HEAD. Run: git push origin <branch>` | `brain-ship.mjs:93` | YES |
| 27 | Diverged: quoted sentence; names no push command | `brain-ship.mjs:96-97`; test "diverged ... does not suggest a plain push" | YES |
| 28 | Unknown: `Could not read the remote branch: <error>.` | `brain-ship.mjs:99` | YES |
| 29 | Every message starts `brain:ship: the head branch "<branch>" is not on the remote at your HEAD — no PR was opened.` | `brain-ship.mjs:88` | YES |
| 30 | Exit code 1 in all four | `brain-ship.mjs:194`, `:340` | YES |

## CHANGELOG: UI (#1198)

| # | Claim | Proof | OK |
|---|---|---|---|
| 31 | Start with `npm run brain:ui`; listens on `127.0.0.1`, port 3000 by default | `package.json:114`; `ui/server.mjs:370,399,514` | YES |
| 32 | The drawer's SDD tab; stages that are documents expand via a "show document" control | `ui/lib/drawer-model.mjs:27,166`; `ui/static/app.js:1872`; test `ui/static/markdown-render.test.mjs:73,92` | YES |
| 33 | Six documents: proposal, spec, design, tasks, apply-progress, verify-report | `ui/change-route.mjs:206-209,221` (`SDD_STAGES` minus `archive`) | YES |
| 34 | A seventh row `working memory — resume.md` for the change branch's `resume.md` | `ui/lib/drawer-model.mjs:172-181`; `ui/change-route.mjs:311` | YES |
| 35 | `archive` is a stage, not a document | `ui/lib/drawer-model.mjs:166`; `ui/change-route.mjs:221` | YES |
| 36 | Read from git at `HEAD` (`resume.md` at the branch tip), never the working tree; `path @ <commit>` stamp | `ui/change-route.mjs:281-300,311-322`; `ui/lib/drawer-model.mjs:139`; test `ui/change-route.test.mjs:507` | YES |
| 37 | Uncommitted edits are not shown; the spec cards and tasks checklist also move to `HEAD` | claim 36; `ui/change-route.mjs:51` (comment) and `buildSpecTab`/`buildTasksTab` read `documents.spec/tasks` (`:70,96`); proposal.md R2 | YES |
| 38 | Cut at 262144 bytes with "truncated at 262144 bytes"; no "load full" | `ui/change-route.mjs:214,270`; test `ui/change-route.test.mjs:462-472` | YES |
| 39 | Missing and unreadable use different wording | `ui/lib/drawer-model.mjs:126-132` | YES |
| 40 | No `innerHTML`; text nodes only | `ui/static/app-source-guard.test.mjs:122,138`; `ui/static/app.js:1720` | YES |
| 41 | Raw HTML and HTML comments shown as literal text | `ui/lib/markdown.mjs:7,113-114`; test `ui/lib/markdown.test.mjs:10,111` | YES |
| 42 | Image shown as `[image: <alt>]`, nothing loaded | `ui/lib/markdown.mjs:74-75`; test `markdown.test.mjs:104` | YES |
| 43 | Relative and `#anchor` links shown as text with target, not navigable | `ui/lib/markdown.mjs:40-47,79-83`; `ui/static/app.js:1746-1753`; test `markdown.test.mjs:159` | YES |
| 44 | Only absolute `http(s)` links live, with `rel="noopener noreferrer"` and `referrerpolicy="no-referrer"` | `ui/lib/markdown.mjs:40-56`; `ui/static/app.js:1738-1741`; test `ui/static/markdown-render.test.mjs:178-179` | YES |
| 45 | `marked` 18.0.14 (MIT) at `brain/scripts/ui/vendor/marked.esm.js`, licence `vendor/LICENSE.marked`, sha256 in `vendor/VERSIONS`, a test fails on drift | `ui/vendor/VERSIONS:1`; `ui/vendor/LICENSE.marked`; `ui/vendor/vendor.test.mjs:28-39` | YES |
| 46 | Not in `dependencies`; installing brain adds no dependency | `ui/vendor/vendor.test.mjs:46-51`; `package.json` has no `dependencies` section for marked | YES |
| 47 | The vendored file ships in the package | `npm pack --dry-run --json` lists `brain/scripts/ui/vendor/marked.esm.js`, `LICENSE.marked`, `VERSIONS` | YES |
| 48 | Only its lexer is used (no HTML-string output) | `ui/lib/markdown.mjs:11-12,18`; `ui/marked-usage-guard.test.mjs` | YES |
| 49 | In 1.10.1 the tab showed which stages are present | `openspec/changes/issue-1198-sdd-artifact-reader/proposal.md` Intent | YES |
| 50 | `server.mjs` serves the vendored file by a literal route | `ui/server.mjs:52-54` | YES |

## CHANGELOG: what ships, follow-ups, why a minor

| # | Claim | Proof | OK |
|---|---|---|---|
| 51 | Eight PRs listed, each described accurately | `git log v1.10.1..HEAD` (8 commits, numbers match); each description traced above | YES |
| 52 | #1213 is a memory lane record; #1222 is tests only | `git show --stat 800bc6d3 831f6c97` | YES |
| 53 | Reporter: 8 commits, 1 feat, 5 fix, 2 internal, no migration above 1.10.1 | issue #1225 body (reporter output); `status/release-debt.mjs:22-34` classifies an unprefixed subject (`memory: ...`, #1213) as a fix; no migration entry above 1.10.1 per the issue | YES (count taken from the issue; the classifier rule explains the 5) |
| 54 | The maintainer ruled A over a 1.10.2 cherry-pick | issue #1225 body | YES |
| 55 | #1189: on `plainfiles`, the post-merge hook and a pull or `brain:memory:pull` that integrates commits print the `import` refusal | `hooks/post-merge:53`; `memory/cli.mjs:1032-1034`; evidence `issue-1185-.../evidence/brain-test-plainfiles-22-post-merge-hook.txt`, `-43-capturing-pull.txt` | YES |
| 56 | #1190: a same-day lane re-ship after a squash merge refuses as diverged, reproduced in both exit runs | `memory/lane/ship.mjs:400,430` produce `memory.ship.diverged`; reproduced in `issue-1185-*/evidence/brain-test-plainfiles-60-seam2-inject.txt` and `issue-1204-*/evidence/plainfiles-61-seam2-inject.txt` | YES (corrected by the orchestrator: the first draft called it an unreproduced candidate) |

## docs/adoption.md

| # | Claim | Proof | OK |
|---|---|---|---|
| 57 | The backend accepts only `engram` or `plainfiles`; empty re-prompts, no default | claims 3-4 | YES |
| 58 | The issue needs a `type:*` label (`type:feature`, `type:bug`, `type:chore`, "and so on"; `type::feature` on GitLab); `env:init` creates the labels, you add one to each issue | `lib/env-init-setup.mjs:70`; `vcs/contributor-scaffold.mjs:60-70`; `i18n/en.mjs:365` | YES |
| 59 | `brain:ticket:start` exits 1 before it creates a branch or worktree, naming the fix | claims 13, 17 | YES |
| 60 | `brain:ship` still refuses an untyped issue too | `brain-ship.mjs:210-217` | YES |
| 61 | `brain:ship` never pushes; after `brain:check` passes it asks git whether `origin` holds the branch at `HEAD`; exits 1 before any forge call naming `git push -u origin <branch>` (never pushed) or `git push origin <branch>` (behind); if the remote has commits you lack it asks you to fetch and integrate | claims 21-28 | YES |

## docs/KNOWN-LIMITATIONS.md

| # | Claim | Proof | OK |
|---|---|---|---|
| 62 | "describes brain 1.11.0" | `package.json:3` | YES |
| 63 | #1189 entry: the hook is non-blocking; `brain:memory:pull` still exits 0 and verifies records; the same call is behind #1115's entry | `hooks/post-merge:16,53`; evidence `plainfiles-43-capturing-pull.txt` (`exit=0`, `verified ...`); `session-start.mjs:292` calls `cli.mjs import` | YES |
| 64 | #1190 entry: merged lane branch not deleted from the remote; `memory.ship.diverged`; workaround delete the remote lane branch | issue #1190 body ("`delete_branch_on_merge` is false and nothing deletes a merged lane branch"; demo deleted the remote branch by hand) | YES |
| 65 | No existing entry describes #1205/#1206/#1207 as open | `rg -n '1205\|1206\|1207' docs/KNOWN-LIMITATIONS.md` returns nothing, so none to remove | YES |

## Summary

Rows: 65. YES: 65 (after fix). NO found and fixed before commit: 1 (the "needs no manual step" headline and the opening sentence that said the release removed the two manual steps). Not verifiable here: the release reporter's counts are the issue's measurement (row 53); the `ticket-start.mjs` wiring has no test of its own (row 13).
