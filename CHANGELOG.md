# Changelog

All notable changes to brain. Distributed as **`@logikas/brain`** on the npm
registry (ADR-0030, superseding ADR-0006's git tags); consumers upgrade with
`npm run brain:upgrade -- <tag>`. Read this file for **renames / breaking
changes** before upgrading — additive `brain.config.json` migrations apply
automatically, but renames need manual action.

## v1.10.1 — a fresh consumer's first PR and first merge need no human

**Manual step: read before upgrading.** Nothing in your tree has to move, no `brain.config.json`
migration applies, and no new key is added. But five things a consumer's automation observes
change, and one of them is a managed file you may have edited (`governance-postmerge.yml`: see
the last row). The 1.10.0 exit run (#1185) found that the first PR and the first real merge of a
fresh consumer still needed a human; this release makes the local checks and the post-merge
audit agree with the CI gates they already claimed to mirror. Each item below was checked
against the code on `main`, not against the PR description.

| Where | 1.10.0 | 1.10.1 |
|---|---|---|
| `npm run brain:check` | Ran the four governance checks, `npm test` and `brain:repo:check`. | Also runs `brain:nav` (a failure exits 1) and `memory/index-lag.mjs` (warning-only: its output is printed as `::warning::` and the step does not fail `brain:check`). Runs `npm test` only where CI does, see below. The output gains `navCheck`, `indexLag` and `[N/A] npmTest` lines (#1186, #1187). |
| `npm test` inside `brain:check` | Always ran, so a consumer's `npm init` placeholder `test` script failed the first PR. | Runs only when the `.brain-source` marker exists (the brain source repo) **and** `package.json` has a non-empty `test` script. Otherwise it prints `[N/A] npmTest` with the reason and is never a failure. A consumer's own `npm test` no longer gates `brain:check`, exactly as it does not gate CI (#1187). |
| `memoryPresence` in `brain:check` | Evaluated raw: at `lite`, a repository with no session summary **failed** locally while CI passed. | Follows the tier, like CI: a failing result at a tier where the memory gate is detection (`lite`) prints `[PASS]` with a `::warning::` reason. At `standard` and `regulated` it still fails. A check whose evidence cannot be read (`uncomputable`) is never softened (#1187). |
| The post-merge audit's memory check (`brain:audit`, `brain:metrics`, the post-merge workflow) | Repo-wide and tier-blind: passed when **any** `session_summary` existed anywhere in `.memory/records/`. | The memory gate's own predicate (issue-scoped, tier-mapped). At `standard` and `regulated`, a merge whose linked issue has no scoped record can now fail the audit where any session summary used to pass it. A repository with **no `.jsonl` file under `.memory/records/`** abstains: its merges pass with `[memory: no history yet — abstained]` (#1188). |
| Post-merge alarm issues | Never closed by brain. | Closed by the workflow when a later run clears the condition (below). |
| `.github/workflows/governance-postmerge.yml` | As shipped in 1.10.0. | Two new steps. It is a REFUSE-managed file: `brain:upgrade` does **not** replace a copy you edited, and names `--force-managed .github/workflows/governance-postmerge.yml` (#1188). |

### `brain:check` and `brain:ship` work on a fresh consumer's first PR (#1186, #1187)

`brain:check` never set the project slug, so `issue-link` asked the port for
`repos/undefined/issues/N`, and it read the default branch only from `origin/HEAD`, which a
clone that never ran `git remote set-head` does not have. Both now come from the sources the
rest of the product uses (`lib/local-gate-context.mjs`), and `brain:ship` resolves its PR base
through the same function:

- **Project slug:** `project.slug` in `brain.config.json`, else the origin remote. Never a
  placeholder.
- **Default branch:** `DEFAULT_BRANCH` (the variable CI reads), else `origin/HEAD` if git has
  it, else the remote's own `HEAD` (`git ls-remote --symref origin HEAD`). The last step only
  reads: it does not write `origin/HEAD`, so **no `git remote set-head` is needed**. If none
  answers (offline), `issueLink` is reported `UNVERIFIED` with the reason, `brain:check` names
  the `DEFAULT_BRANCH` override and still exits 0 with "could NOT be verified" instead of
  "Ready to brain:ship". The closing-keyword rule never assumes `main`; two last-resort
  fallbacks remain, named below (the diff base and `brain:ship`'s PR base).
- **Diff base:** the merge-base with `origin/<default branch>`, falling back to `origin/main`.
  The 1.10.0 code measured only against `origin/main`, which on a remote whose default is not
  `main` produced an empty diff that `diff-size` reads as a pass.
- **`brain:ship`'s PR base:** `project.defaultBranch` from `brain.config.json` if set, else the
  resolved default branch, else `main`. On 1.10.0 it was `project.defaultBranch` or `main`, so a
  consumer whose remote default is `master` and who never set that key opened its PR against
  `main`. `brain:ship` now runs `brain:check` first, as before, and opens the PR only if it
  exits 0.

The `issue-link` and `memory-gate` checks in `brain:check` call the same composition CI's
`run-check.mjs` exits through (`runCheckWithPolicy`), so the tier mapping is one piece of code.
The memory gate's predicate itself moved, unchanged, into `checks/memory-gate.mjs` (below).
`diff-size` and `decision-gate` stay on the pure functions, as before: locally `diff-size`
cannot honour a `size:exception` label, because no label exists before the PR does, so it is
the stricter side. A parity test compares the local `issue-link` and `memory-gate` verdicts
with CI's real exit code at each tier, and another derives the steps of the CI `local-checks` job from `governance.yml` and fails if a
step is not in `brain:check`'s covered list.

### The post-merge audit and the PR gate agree (#1188)

On 1.10.0 a fresh consumer's first real merge passed `memory-gate` at PR time and then failed
post-merge as `governance:audit-unrevertible`, because the audit asked a different question
(any record, any tier). Both now call one function, `checks/memory-gate.mjs`.

- **Scope and tier:** the audit reads the issue from the merge's closing keyword, looks for a
  record scoped to it in the tree it audits, and applies the tier mapping: at `lite` a
  violation is a pass carrying a warning, as at PR time. A merge whose body carries no closing
  keyword falls back to the repo-wide question ("does any session summary exist"), as the gate does.
- **Abstention:** only when `.memory/records/` holds no `.jsonl` file at all (a missing
  directory counts). From the first record on, the full predicate applies, tier included. A
  directory holding only unreadable record files is not "no history": the full predicate runs
  on it. At PR time the rule is the same as before (`standard` still fails a PR with no scoped
  record); only the post-merge audit abstains.
- **Known residual:** a `skip:memory-gate` label honoured at `standard` is not replayed by the
  audit, which has no label-event evidence, so that merge can still surface post-merge as a
  memory failure.

### Post-merge alarms close themselves (#1188)

The alarm for the demo's first failure stayed open after the audit went green. Two new
workflow steps call `alarm.mjs resolve`, which finds the open issue carrying each label, posts a
comment linking the passing run, and closes it (new port verb `issueClose`, below):

| Step runs when | Closes the open alarm for |
|---|---|
| the audit exits 0 **and** the cursor advance succeeded | `governance:cursor-missing`, `governance:cursor-unknown`, `governance:audit-unrevertible`, `governance:revert-blocked`, `governance:audit-uncomputable`, `governance:postmerge-unreported` |
| the archive sweep succeeded | `governance:archive-sweep-failed` |

A still-failing run closes nothing. It closes the first open issue per label. A comment or
close that cannot happen is printed as `[WARN]` and never turns the run red. No new
permission: closing uses the `issues: write` the workflow already holds to file alarms. Alarms
filed before you upgrade close on the next run that meets the condition in the table, **if** the
workflow you run is the new one (see the REFUSE-managed note above). This is GitHub-only: the
GitLab governance fragment ships no post-merge workflow.

### New port verb `issueClose` (#1188)

`issueClose({ project, number })` closes an issue and carries the state change only, with no
body, title or labels: `PATCH repos/{project}/issues/{number}` with `state: closed,
state_reason: completed` on GitHub, `PUT projects/{enc}/issues/{number}` with `state_event:
close` on GitLab. It never throws. Both shipped adapters export it. Its only caller is
`alarm.mjs resolve`, run by the post-merge workflow; a custom adapter that lacks it makes that
close a `[WARN]`, not a failure. Its `vcs-contract.md` row is promoted with this cut (#1196).

### What ships

| PR | Change |
|---|---|
| #1191 | The 1.10.0 phase-1 exit run: evidence, report and findings, all under `openspec/changes/issue-1185-phase-1-exit-demo-1-10-0/`. No runtime change (#1185). |
| #1192 | `brain:check` and `brain:ship` resolve the slug and default branch, follow CI's tier and `npm test` condition, and run every step of CI's `local-checks` job (#1186, #1187). |
| #1193 | The post-merge audit uses the memory-gate's own predicate, an early merge abstains, post-merge alarms close themselves, and `issueClose` joins the port (#1188). |

### Known follow-ups a consumer can hit

Listed in `docs/KNOWN-LIMITATIONS.md`: #1194 (two items), the `skip:memory-gate` residual above, and the 1.10.0 follow-ups that remain open.

### Why a patch and not a minor

The release reporter measured 3 commits since v1.10.0: 0 `feat`, 2 `fix`, 1 internal, and no
config migration above 1.10.0. The two fixes make the product do what its own gates already
declared: the local checks match CI, the audit matches the PR gate, and an alarm stops
outliving the condition it reports. `issueClose` is a new port verb, but only the post-merge
workflow calls it. Nothing you configured has to change. Two observable edges remain and are
listed above rather than hidden: a consumer script that relied on `brain:check` running its own
`npm test` no longer gets that (CI never ran it either), and at `standard`/`regulated` the audit
can fail a merge that lacks a scoped record.

## v1.10.0 — a fresh consumer reaches its first PR and its first memory save without manual steps

**Manual step: read before upgrading.** Nothing in your tree has to move for the upgrade
itself (unless you edited `governance-postmerge.yml`: see `actions: read` below), but six things a consumer's automation observes change. One of them can fail a
command that succeeded on 1.9.0 (the memory backend), and one can open pull requests you
did not expect on the first post-merge run after you upgrade (the audit cursor). Each
item below was checked against the code on `main`, not against the PR description.

| Where | 1.9.0 | 1.10.0 |
|---|---|---|
| Memory operations that consult a backend (`brain:memory:pull`, `import`, `index`, `share`, `search`, `heal-duplicates`, feature checkpoint and resume) | With no backend stated, guessed `engram` (for `pull` only, it fell back to records-only `plainfiles` when the `engram` binary was absent). | **Refuse** when no backend is declared: exit **3**, naming the fix. An invalid value refuses with exit **4**. Nothing is guessed (#1165). |
| The first post-merge run of `governance-postmerge.yml` on a repository with no audit cursor | Filed a `governance:cursor-missing` alarm and audited nothing. Every run failed the same way. | **Creates the cursor at the adoption commit** and audits everything after it, when no earlier run of that workflow ever succeeded on the default branch (#1162). |
| Workflow permissions | `contents`, `pull-requests`, `issues`. | Adds **`actions: read`** (#1162). |
| `npm run brain:env:init` | Created no labels, wrote no `brain.actor`, never said whether the memory lane was on. | Creates the governance labels, resolves `brain.actor` and prints the lane notice (#1163, #1164, #1166). |
| `commit-msg` | Required `#N` on every non-machine commit, including the first. | Exempts **only** a repository's first commit, the one made while no ref reaches any commit (#1161). |
| `npm run brain:ship` | Read only `<prefix>/<N>-<slug>` and refused the branches `brain:ticket:start` creates. | Also reads the canonical `{type}/issue-{N}-{slug}` (#697). |

### The memory backend must be declared (#1165)

If you have run `env:init` and your backend is in `.env` (`MEMORY_BACKEND=...`), or you
export `MEMORY_BACKEND`, **nothing changes for you**: that keeps winning. If you have
neither, the operations in the table above now exit **3** with a message that names the
fix, where 1.9.0 silently ran `engram`:

```bash
npm run brain:config -- set memory.backend engram      # or plainfiles
git add brain.config.json && git commit
```

- **Precedence, first wins:** process env `MEMORY_BACKEND` (one run), then `.env` (this
  machine), then `brain.config.json` `memory.backend` (the team). When two disagree the
  CLI says which one won.
- **Values:** `engram` or `plainfiles`. `brain:config set memory.backend` refuses anything
  but those two (or `""`, which clears it) at write time. An invalid value found at run time is the exit **4** refusal.
- **Not affected:** `reindex`, `resolve-index`, `split-records`, `collect`, `ship` and
  `migrate-v1` never consult a backend, and `audit` never refuses over a missing backend (it reads the backend
  only when one is declared). `setup` refuses like the ops in the table. `brain:memory:save` still writes the record and says
  hydration is deferred until a backend is declared (exit 0). `pre-push` and `post-merge`
  stay non-blocking and print one line saying the memory step was skipped (`pre-push` only
  when it runs the feature checkpoint, which needs an active change); `session:start`
  prints `hydration skipped, nothing was tried`.
- **A backend declared only in tracked config, without its binary on `PATH`:** `brain:memory:pull`
  runs records-only and defers hydration. `import` and `index` still need the binary;
  `search` is unsupported on `engram`; feature checkpoint and resume degrade without it. A
  backend stated in the process env or `.env` is never overridden: without its binary the ops
  that need it fail, as they did on 1.9.0.
- **`brain:upgrade`** applies the migration (below) and, when nothing declares a backend,
  prints the one command to run (not on `--dry-run`). It changes no behavior by itself.
- **`env:init`** asks once, on a terminal (Enter accepts `engram`), and writes the answer
  to `brain.config.json`, not to `.env`. Without a terminal it guesses nothing: memory
  setup is skipped and listed as a pending step (exit 0). If your backend lives only in
  `.env`, it keeps working and `env:init` prints the command that shares it.

### The first post-merge run bootstraps the audit cursor (#1162)

`refs/governance/audit-cursor` is where the post-merge audit remembers what it has
audited. Nothing ever created it, so on a new repository every post-merge run ended in
`governance:cursor-missing`. It now creates the cursor itself, **only** when both hold:

- the ref does not exist, and
- no earlier run of `governance-postmerge.yml` on the default branch ever succeeded (a
  success proves the cursor once existed and was deleted).

The cursor is placed **at the adoption commit**: the first commit on the first-parent line
that added the workflow file. The first window audits everything after it. A gate is not
authoritative over the commit that installs it, so the adoption itself is never audited
(or reverted). A cursor that was deleted, or run history that cannot be read, still ends in the
alarm, never in a guess. Known residual: GitHub expires run history (its documented
default is 90 days), so a cursor deleted after every success expired reads as new and re-audits
from the adoption. GitLab is unaffected: its
governance fragment ships no post-merge audit or cursor. The
alarm now gives the init command at the adoption commit instead of at the repository root.

**If you are already installed and your post-merge run never succeeded** (the state measured on
the two 1.9.0 demo consumers), your first run on 1.10.0 reads "no
prior success" and bootstraps at *your* adoption commit, which may be old. That run
audits **every commit since adoption for the first time, in one run**. A commit that
fails a tree-keyed check (`diff-size`, `decision-gate`) is nominated for an
`auto-revert/<sha>` pull request against current `main`, unless reverting it would
resurrect a payload or `size:exception` is honored. Commits that fail only `issue-link` or
`memory-gate` are never reverted: the run files `governance:audit-unrevertible` and the
cursor stays pinned until you run `cursor.mjs accept`. Expect revert PRs, or
`governance:revert-blocked` alarms where a revert conflicts; the cursor also stays pinned
until revert PRs merge. Nothing is capped automatically, because a cap would be a silent skip. To choose the window yourself,
**before** the upgrade merges:

- Set `governance.auditBaseline` in `brain.config.json` to a recent ref (tag, sha or
  `origin/<branch>`; a bare branch name does not resolve in the CI checkout, and an
  unresolvable ref audits everything with a warning). Commits that do not descend from it are printed as
  `[SKIP] <sha> ... — before audit baseline` and not judged. This does not move the window
  start; it only skips what precedes the ref. `brain:config set` refuses this key (no
  migration declares it), so edit the file by hand.
- Or create the cursor at a commit you choose, and push it:
  `git update-ref refs/governance/audit-cursor <sha> && git push origin refs/governance/audit-cursor`.
  The bootstrap then finds the cursor present and does nothing.

### `actions: read` on the workflow (#1162)

`governance-postmerge.yml` now declares `actions: read`, read only: the bootstrap lists
past runs of the workflow, and on a **private** repository an explicit `permissions:` block
that omits it reads as `unknown` and alarms forever. The workflow is a managed file: `brain:upgrade`
replaces it if you have not modified it; if you have, it refuses and names
`--force-managed .github/workflows/governance-postmerge.yml`. If you keep your edited copy, or an organization policy caps the
`GITHUB_TOKEN` below `actions: read`, the bootstrap cannot read run history and you get
the alarm instead of a cursor.

### What `env:init` now does for you (#1163, #1164, #1166)

Each step is optional in the `env:init` sense: if it cannot run, it is listed under
pending steps with the command that closes it, and `env:init` still exits 0.

- **Governance labels.** Through the VCS port (new verb `labelCreate`), it creates the
  approved label (`governance.approvedLabel`, default `status:approved`), the `type:*`
  labels that `brain:ship` and `brain:ticket:start` read, `size:exception`,
  `skip:memory-gate` and, on GitHub, the `governance:*` alarm labels. It creates only what
  is missing, so a re-run changes nothing. This is a **write to your remote**, and needs a
  reachable, authenticated VCS. On GitLab the approved and `type:*` labels use the scoped
  `key::value` form; `size:exception` and `skip:memory-gate` keep their names.
- **`brain.actor`.** Keeps a valid handle you already configured; otherwise writes your
  authenticated VCS identity as `@<username>` with `git config --local`. It never derives
  it from `user.name`. A stored `@legacy`, or a value that is not a handle, counts as unset
  and is replaced (when a VCS identity is available; otherwise it is left and listed as pending).
- **Memory lane.** States on every run whether the lane is on. It is off by default on
  every tier; to turn it on: `npm run brain:config -- set memory.lane.enabled true`. The
  closing next-steps text of `env:init` no longer reads as if the lane were already on.
  `day:start`, `ticket:start` and the `plain` SDD engine's manual-flow step still say "the
  enabled memory lane ships it" (noted on #1177).

### `commit-msg` accepts a repository's first commit (#1161)

`pre-commit` (1.9.0) already allowed the adoption commit without `--no-verify`, but
`commit-msg` then refused it for lacking `#N`, in a repository that cannot have an issue
yet. Both hooks now share one predicate: **no ref reaches any commit**. Conventional
Commit format is still enforced. Every later commit is judged as before. The exemption is
not "HEAD is unborn": a `git checkout --orphan` in a repository with history does not
earn it, and outside a repository, or on a git error, it is denied.

Two edges you can hit: `git commit --amend` on the adoption commit is refused (it is no
longer the first commit; #1175), and the **server-side** `pre-receive` still refuses a
ticket-less first push where `brain:protect-server` is installed before it (#1169).

### `brain:ship` reads the branches `ticket:start` creates (#697)

`brain:ship` used to parse only `<prefix>/<N>-<slug>` (what `brain:start` creates), so the
`{type}/issue-{N}-{slug}` branch of `brain:ticket:start` failed with "cannot determine
issue number". One module (`branch-grammar.mjs`) now serves them: `brain:ship` and `brain:next` read
both shapes, `brain:start` uses it only for the slug, and the status snapshot and capture
provenance read the canonical shape only. A title with no ASCII letters or digits yields
the slug `task`, not a trailing dash.

### What ships

| PR | Change |
|---|---|
| #1160 | The adoption guide: a missing token and the ticket board are run-time warnings, not summary entries (#1159). |
| #1170 | `commit-msg` accepts the adoption commit of a repository with no commit yet, sharing one predicate with `pre-commit` (#1161). |
| #1171 | A fresh consumer's post-merge run bootstraps its audit cursor at the adoption commit instead of alarming; new VCS verb `workflowRunSucceeded`; `actions: read` (#1162). |
| #1172 | `env:init` creates the governance labels (new VCS verb `labelCreate`), resolves `brain.actor` and states the memory lane (#1163, #1164, #1166). |
| #1173 | The team's memory backend is declared in tracked `brain.config.json` (`memory.backend`), with one resolver, and nothing is guessed (#1165). |
| #1174 | `brain:ship` reads the `{type}/issue-{N}-{slug}` branches `ticket:start` emits (#697). |
| #1181 | Doctrine: `vcs-contract.md` rows for the two new verbs, the `memory-backend-contract.md` selector, ADR-0004 Amendment 3, ADR-0024 Amendments 3 and 4 (#1180). |

### Migration 1.9.1: `memory.backend`

`brain:upgrade` adds `memory.backend: ""` to `brain.config.json`, additive and empty on
purpose: empty means **undeclared**, because a non-empty default would silently choose a
backend for a team that never chose one. The migration is numbered 1.9.1 because it was
declared above the published 1.9.0; it was unreachable until this release. No other key
changes.

### Known follow-ups a consumer can hit

Listed in `docs/KNOWN-LIMITATIONS.md`: #1167, #1168, #1169, #1175, #1176, #1177, #1178.

### Why a minor and not a patch

The release reporter measured 7 commits since v1.9.0: 1 `feat`, 4 `fix`, 2 internal, and
a declared migration (1.9.1) that could not be reached without a cut. The `feat` is a new
required VCS port verb (`labelCreate`, and `workflowRunSucceeded` with it), and there is a
new config key with a migration. Several fixes also change what a consumer's automation
observes: memory operations refuse where they guessed, the first post-merge run creates
a ref and can audit a long history at once, and `env:init` writes to the remote. A script
that passed on 1.9.0 can fail on 1.10.0, which a patch promises it does not. A minor, by the
rule v1.6.0 to v1.9.0 applied. Not a major: nothing you rely on stops working once the
backend is declared, and the refusals name their fix.

## v1.9.0 — the consumer path is honest: credentials stay safe, and failures are reported

**Manual step: read before upgrading.** Nothing in your tree has to move, but several
commands now exit non-zero where 1.8.0 exited 0. If a script, a CI step or an agent
wraps these commands and treated exit 0 as "fine", it will now see the failures brain
used to hide. Each item below was measured against the code, not the changelog of
the PR that shipped it.

| Command | 1.8.0 | 1.9.0 |
|---|---|---|
| `npm run brain:env:init` | Always printed `Environment ready` and exited 0, whatever failed on the way. | Exits **1** when a **required** step failed, and names the failure in the closing summary. Optional steps that could not run are listed as next steps and still exit 0 (see the classification below) (#1112, #1127). |
| `npm run brain:env:init`, PAT prompt | Wrote the token into `.env` wherever it was. | **Refuses** to write the token when `.env` is tracked by git, is a symlink, is hardlinked, is not a regular file, or cannot be confirmed as git-ignored. A refusal names the fix and is a required failure, so exit **1** (#1112). |
| `npm run brain:env:init`, provider and backend prompts | Accepted any typed text and wrote it into `brain.config.json` or `.env`. | Accepts only `github` or `gitlab` (or empty, keeping the derived default) for the provider, and only `engram` or `plainfiles` (or empty) for the memory backend; anything else re-prompts (#1112). |
| `npm run brain:upgrade -- <tag>` | A corrupt `brain.config.json`, or a broken incoming `config-migrations.mjs`, was found **after** the managed copy had already run. | Refuses **before any write** and says `Nothing was written` (#1127). An unreadable installed package version now prints a warning instead of vanishing. |
| `npm run tools:install` (`install-tools.sh`) | A failed `gentle-ai install` printed a warning, then a clean summary. An unreadable `brain.config.json` silently selected `gitlab`. | A failed `gentle-ai install` ends the run with `Setup INCOMPLETE` and exit **1**. An unreadable config is refused instead of guessed (#1127). |
| `node brain/scripts/lib/brain-config.mjs ensure` (run by `env:init`) | An unparseable `brain.config.json` was treated as absent. | Reports the parse error and exits **1** (#1127). |
| Feature resume (`feature-resume`) | An unreadable change directory printed a warning and returned. Files not projected into engram were skipped quietly. | Rejects, naming each file that did not land, so a partial projection never reads as a complete one (#1127). |
| `git commit` in a repository with no commit yet | Refused by `pre-commit` (checks 1 and 2), so the adoption commit needed `--no-verify`. | Allowed, and only while **no ref reaches any commit**. The `repo:check` and staged-records checks still run. Every later commit is judged as before (#1112). |

### How `env:init` now classifies what it could not do

`env:init` ends with a summary in two parts. A **required** failure exits 1. An
**optional** gap is listed under pending steps with the command that closes it, and the
run still exits 0, because an environment without it is usable (records-only capture
needs no memory backend).

| Step | Required (exit 1) | Optional (listed as next step, exit 0) |
|---|---|---|
| SDD harness init | the init exits non-zero | |
| `core.hooksPath` | `git config` fails | |
| Memory backend `setup` (engram or plainfiles) | `setup` exits non-zero | |
| Memory `pull` | it was attempted and refused (merge or reconcile refusal, corrupt store) | no commit yet, no upstream, or the remote is unreachable |
| Memory `index` (engram) | the `engram` binary exists and indexing fails | the `engram` binary is absent, so hydration and indexing are skipped |
| VCS token | it was typed and could not be saved to `.env`, or `auth login` failed with a token present | no token was given |
| VCS provider override | the write fails | |
| `brain.config.json` | it cannot be parsed | any other `ensure` failure, such as the tier notice |
| Open-ticket board | | a read-only listing |

### `.env` is git-ignored by `env:init`, and a token is never written into an unsafe one (#1112)

`env:init` now runs `git check-ignore` on `.env` and appends `.env` to `.gitignore`
(creating the file if needed) when nothing already ignores it. A broader pattern you
already have is respected. It does **not** add `node_modules/`; ignoring that stays
yours. The refusal cases are in the table above. `.git/info/exclude` and a global
`core.excludesFile` count as ignored for that clone only, which is why the tracked
`.gitignore` line is still written.

`MEMORY_BACKEND=plainfiles` is no longer reported as an unknown backend: `env:init` runs
its `setup` and `pull`, and never `brain:memory:index` (`plainfiles` has no index, by
design).
`project.name` may be empty: the engram adapter derives the project from
`project.slug`, then `project.name`, then the checkout's directory name, and a failed
doctrine index now makes `brain:memory:index` exit non-zero instead of logging and
succeeding.

### The archive sweep treats a missing `openspec/changes/` as nothing to archive (#1113, #1151)

A consumer that had not started its first SDD change made every clean post-merge run
crash and file a false `governance:archive-sweep-failed` alarm. A missing
`openspec/changes/` is now zero eligible changes. The real diagnostic of a genuine sweep
failure (stderr) now reaches the alarm's output block, which used to be empty. The same
reader is used by `archive --backfill` (#1127).

### Memory

- **A fresh engram 2.x store accepts brain's import sessions (#1116, #1152).** Every
  session row in the import payload now carries `directory` (the repository root).
  engram 2.0.0 refused the payload without it. Measured against 2.0.0 (accepts) and
  1.20.0 (accepts the field as extra metadata). Both recovery paths, `memory/cli.mjs
  import` and `brain:memory:pull`, use the fixed builder. The engram duplicate-heal
  probe's tested range is unchanged (1.20.x), and outside it the probe still says so.
- **`prLookupFailed` no longer claims a push that did not happen (#1119, #1153).** Since
  #936 the PR lookup runs before the push, so a lookup failure means nothing was pushed.
  The message now states what this run did. A lookup that fails after a push (the
  one-shot re-scan after creating a PR) gets its own message, `prLookupFailedAfterPush`,
  in English and Spanish.
- **The checkout that captured a record can `pull` after its own lane merged (#1118,
  #1154).** `pull` reconciles a local record file only when it is byte-identical to the
  blob at `@{u}`, is a regular file and is not staged differently; git's object store is
  the only backup. Anything else still refuses as before. Applies to both the engram and
  the plainfiles adapters.

### No step reports success over a failure it saw (#1127, #1156)

The sweep of `|| true`, swallowed `catch` and warn-and-continue sites across install,
bootstrap, upgrade, the memory CLI and the post-merge workflow. Each site now either
reports a failure or carries a stated reason it is optional, and `swallow-guard.test.mjs`
fails on a new unexplained swallow in those paths. The consumer-visible results are the
exit-code rows above. Also: `checkpoint` no longer overwrites an unreadable `resume.md`,
and a partial resume still shows its summary with the projection failure named.
Four slices are deliberately left open (an `AGENTS.md` regeneration failure during
`brain:upgrade` still ends in `Done.`; an unreadable `records/` directory still reads as
an empty store; two installer read-failure sites; and swallows outside the five swept
areas). See `docs/KNOWN-LIMITATIONS.md`.

### Docs

`docs/adoption.md`, `docs/KNOWN-LIMITATIONS.md` and the definition of done were written
and verified against 1.8.0 (#1147, #1150), and are updated here to describe 1.9.0: the
first commit needs no `--no-verify`, the `.env` guarantees, the classified `env:init`
summary, and the closed defects removed.

### Why a minor and not a patch

The release reporter measured 7 commits since v1.8.0 — 0 `feat`, 6 `fix`, 1 internal.
It counts no `feat`, and that is exactly why this note exists: several fixes change what
a consumer's automation observes. `env:init` exits 1 on a required failure,
`brain:upgrade` and `tools:install` refuse where they used to proceed, and
`pre-commit` allows a first commit it used to refuse. A script that passed on 1.8.0 can
fail on 1.9.0. Shipping that as a patch would change consumers' results under a version
number that promises it does not. It is a minor by the rule v1.6.0, v1.7.0 and v1.8.0
applied. Not a major: nothing you rely on stops working, and the failures it now reports
were already happening.

No config migration is added above 1.8.0. `brain:upgrade` has nothing to rewrite in your
`brain.config.json`.

## v1.8.0 — new consumers get lite and claude, and adapters live one directory per axis

**Manual step: read before upgrading.** `brain/scripts/harness/backends/`,
`brain/scripts/memory/backends/`, `brain/scripts/vcs/providers/` and
`brain/scripts/roles/role-port.mjs` are gone. Every adapter now lives under
`brain/scripts/axes/<axis>/` (#1141). `brain:upgrade` removes the old files from your
tree for you — it reads the list from the **incoming** (1.8.0) package, not your
current one, so running `npm run brain:upgrade -- v1.8.0` is enough for brain's own
files. What it cannot fix is **your own code**: if anything in your repository imports
one of these paths directly, that import breaks the moment the old file is removed. Fix
those imports yourself, using the complete mapping below (generated from
`brain/scripts/lib/retired-paths.mjs` and the move's own renames — every entry is a
real `git mv`, not a guess).

| Old path | New path |
|---|---|
| `brain/scripts/harness/backends/agent-runtime.mjs` | `brain/scripts/axes/lib/agent-runtime.mjs` |
| `brain/scripts/harness/backends/agent-runtime.test.mjs` | `brain/scripts/axes/lib/agent-runtime.test.mjs` |
| `brain/scripts/harness/backends/antigravity.mjs` | `brain/scripts/axes/platform/adapters/antigravity.mjs` |
| `brain/scripts/harness/backends/antigravity.test.mjs` | `brain/scripts/axes/platform/adapters/antigravity.test.mjs` |
| `brain/scripts/harness/backends/antigravity.drift.test.mjs` | `brain/scripts/axes/platform/adapters/antigravity.drift.test.mjs` |
| `brain/scripts/harness/backends/claude.mjs` | `brain/scripts/axes/platform/adapters/claude.mjs` |
| `brain/scripts/harness/backends/claude.test.mjs` | `brain/scripts/axes/platform/adapters/claude.test.mjs` |
| `brain/scripts/harness/backends/settings-hooks.mjs` | `brain/scripts/axes/platform/lib/settings-hooks.mjs` |
| `brain/scripts/harness/backends/settings-hooks.test.mjs` | `brain/scripts/axes/platform/lib/settings-hooks.test.mjs` |
| `brain/scripts/harness/backends/codex.mjs` | `brain/scripts/axes/review-engine/adapters/codex.mjs` |
| `brain/scripts/harness/backends/codex.test.mjs` | `brain/scripts/axes/review-engine/adapters/codex.test.mjs` |
| `brain/scripts/harness/backends/gemini.mjs` | `brain/scripts/axes/review-engine/adapters/gemini.mjs` |
| `brain/scripts/harness/backends/gemini.test.mjs` | `brain/scripts/axes/review-engine/adapters/gemini.test.mjs` |
| `brain/scripts/harness/backends/gentle-ai.mjs` | `brain/scripts/axes/sdd-engine/adapters/gentle-ai.mjs` |
| `brain/scripts/harness/backends/gentle-ai.test.mjs` | `brain/scripts/axes/sdd-engine/adapters/gentle-ai.test.mjs` |
| `brain/scripts/harness/backends/gentle-ai.roles.mjs` | `brain/scripts/axes/sdd-engine/adapters/gentle-ai.roles.mjs` |
| `brain/scripts/harness/backends/gentle-ai.roles.test.mjs` | `brain/scripts/axes/sdd-engine/adapters/gentle-ai.roles.test.mjs` |
| `brain/scripts/harness/backends/plain.mjs` | `brain/scripts/axes/sdd-engine/adapters/plain.mjs` |
| `brain/scripts/harness/backends/plain.test.mjs` | `brain/scripts/axes/sdd-engine/adapters/plain.test.mjs` |
| `brain/scripts/memory/backends/engram.mjs` | `brain/scripts/axes/memory/adapters/engram.mjs` |
| `brain/scripts/memory/backends/engram.batch-import.test.mjs` | `brain/scripts/axes/memory/adapters/engram.batch-import.test.mjs` |
| `brain/scripts/memory/backends/engram.branch.test.mjs` | `brain/scripts/axes/memory/adapters/engram.branch.test.mjs` |
| `brain/scripts/memory/backends/engram.duplicates.test.mjs` | `brain/scripts/axes/memory/adapters/engram.duplicates.test.mjs` |
| `brain/scripts/memory/backends/engram.feature.test.mjs` | `brain/scripts/axes/memory/adapters/engram.feature.test.mjs` |
| `brain/scripts/memory/backends/engram.heal.test.mjs` | `brain/scripts/axes/memory/adapters/engram.heal.test.mjs` |
| `brain/scripts/memory/backends/engram.heal.integration.test.mjs` | `brain/scripts/axes/memory/adapters/engram.heal.integration.test.mjs` |
| `brain/scripts/memory/backends/engram.hydrate.test.mjs` | `brain/scripts/axes/memory/adapters/engram.hydrate.test.mjs` |
| `brain/scripts/memory/backends/engram.import.test.mjs` | `brain/scripts/axes/memory/adapters/engram.import.test.mjs` |
| `brain/scripts/memory/backends/engram.pull.test.mjs` | `brain/scripts/axes/memory/adapters/engram.pull.test.mjs` |
| `brain/scripts/memory/backends/engram.save.test.mjs` | `brain/scripts/axes/memory/adapters/engram.save.test.mjs` |
| `brain/scripts/memory/backends/engram.search-unsupported.test.mjs` | `brain/scripts/axes/memory/adapters/engram.search-unsupported.test.mjs` |
| `brain/scripts/memory/backends/engram.setup.test.mjs` | `brain/scripts/axes/memory/adapters/engram.setup.test.mjs` |
| `brain/scripts/memory/backends/engram.share.test.mjs` | `brain/scripts/axes/memory/adapters/engram.share.test.mjs` |
| `brain/scripts/memory/backends/plainfiles.mjs` | `brain/scripts/axes/memory/adapters/plainfiles.mjs` |
| `brain/scripts/memory/backends/plainfiles.actorkind-consistency.test.mjs` | `brain/scripts/axes/memory/adapters/plainfiles.actorkind-consistency.test.mjs` |
| `brain/scripts/memory/backends/plainfiles.pull.test.mjs` | `brain/scripts/axes/memory/adapters/plainfiles.pull.test.mjs` |
| `brain/scripts/memory/backends/plainfiles.save.test.mjs` | `brain/scripts/axes/memory/adapters/plainfiles.save.test.mjs` |
| `brain/scripts/memory/backends/plainfiles.save-index-failure.test.mjs` | `brain/scripts/axes/memory/adapters/plainfiles.save-index-failure.test.mjs` |
| `brain/scripts/memory/backends/plainfiles.search.test.mjs` | `brain/scripts/axes/memory/adapters/plainfiles.search.test.mjs` |
| `brain/scripts/memory/backends/plainfiles.setup.test.mjs` | `brain/scripts/axes/memory/adapters/plainfiles.setup.test.mjs` |
| `brain/scripts/memory/backends/plainfiles.share.test.mjs` | `brain/scripts/axes/memory/adapters/plainfiles.share.test.mjs` |
| `brain/scripts/memory/backends/plainfiles.unsupported.test.mjs` | `brain/scripts/axes/memory/adapters/plainfiles.unsupported.test.mjs` |
| `brain/scripts/memory/backends/no-artifact.parity.test.mjs` | `brain/scripts/axes/memory/no-artifact.parity.test.mjs` |
| `brain/scripts/memory/backends/reindex-parity.test.mjs` | `brain/scripts/axes/memory/reindex-parity.test.mjs` |
| `brain/scripts/memory/backends/save-parity.test.mjs` | `brain/scripts/axes/memory/save-parity.test.mjs` |
| `brain/scripts/roles/role-port.mjs` | `brain/scripts/axes/sdd-engine/role-port.mjs` |
| `brain/scripts/roles/role-port.test.mjs` | `brain/scripts/axes/sdd-engine/role-port.test.mjs` |
| `brain/scripts/roles/roles.contract.test.mjs` | `brain/scripts/axes/sdd-engine/contract.test.mjs` |
| `brain/scripts/roles/fixtures/stage-set-custom.json` | `brain/scripts/axes/sdd-engine/fixtures/stage-set-custom.json` |
| `brain/scripts/vcs/providers/github.mjs` | `brain/scripts/axes/vcs/adapters/github.mjs` |
| `brain/scripts/vcs/providers/gitlab.mjs` | `brain/scripts/axes/vcs/adapters/gitlab.mjs` |
| `brain/scripts/vcs/providers/identity.drift.test.mjs` | `brain/scripts/axes/vcs/adapters/identity.drift.test.mjs` |
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | `brain/scripts/axes/vcs/contract.test.mjs` |

53 paths in total — the exact list `brain:upgrade` acts on is
`brain/scripts/lib/retired-paths.mjs` in the package you are upgrading to. What is
**kept**, never removed by this step: a file you added yourself in one of these
directories (it is not on the list); a path your `brain.config.json` declares `local`;
a symlink (the removal only ever touches a real file, checked with `lstat`); and a path
the installer treats as `REFUSE` or `MERGE` (your bytes there matter enough that the
strategy exists precisely so an upgrade never clobbers them).

### Why a minor and not a patch

The release reporter measured 6 commits since v1.7.0 — 2 `feat`, 1 `fix`, 3 internal —
and no config migration is pending above 1.7.0. Two of those `feat` changes alter what a
**new** consumer gets on its first `env:init` (the default governance tier, the default
agent platform), and the axes refactor's upgrade step removes files from every
consumer's tree. Capability and behavior a consumer relies on changing is a minor, by
the same rule v1.6.0 and v1.7.0 applied. Not a patch: existing consumers are not
silently reconfigured. Not a major: nothing existing consumers rely on breaks on its
own — only a consumer's own out-of-tree imports of the moved adapter paths do, and
that is the one manual step above.

### New consumers default to `lite`; existing consumers keep their tier (#1124)

A `brain.config.json` that `env:init` **creates** now declares `governance.tier:
"lite"` — `NEW_CONSUMER_DEFAULTS`, not a migration. `lite` fits the one-maintainer
repository that runs `env:init` first: it needs no second approver. An **existing**
consumer's declared tier is never touched by an upgrade; `migrateConfig` never reads
`NEW_CONSUMER_DEFAULTS`, and the pre-existing 0.9.0 migration entry (which still
defaults an absent-key config to `standard`) is unchanged. `env:init` now prints the
tier on every run — the tier, why (for a new config), and how to change it — for both
cases, so it is never a silent decision either way.

### The default agent platform is `claude`; `antigravity` is the second supported platform (#1125)

`resolvePlatform()` (and `bootstrap.sh`'s shell mirror of it) now answers `claude` when
no platform is stated anywhere. What this means in practice turns on one fact: since
`env:init` has always written whatever it resolved back into your `.env`, an **existing**
consumer that has ever run `env:init` already has `AGENT_PLATFORM=antigravity` recorded
there explicitly — an existing, non-empty `.env` value is never rewritten, so nothing
changes for that consumer on upgrade. A **brand-new install**, with no `AGENT_PLATFORM`
in `.env` yet, resolves and persists `claude` the first time `env:init` runs. `antigravity`
remains fully supported — set `AGENT_PLATFORM=antigravity` (in `.env`, or as a stated
config/process value) to keep or choose it.

### `env:init` merges your `.claude/settings.json` and `.gemini/settings.json` instead of overwriting them (#1139)

Both platform backends' `init()` used to write their settings file unconditionally,
discarding any consumer-owned `permissions.allow` entries and custom hooks on every run
— `brain:upgrade` already merged the same file more carefully, so the file had two
writers with opposite rules. `init()` now reads the existing file first (when present)
and merges it through the same `mergeSettings` core `brain:upgrade` uses: your existing
top-level keys are kept, and brain's hook entries are appended only where you do not
already have them. A malformed existing file is never overwritten — `init()` reports
which file and why, and leaves it alone.

### Doctrine: ADR-0036 and ADR-0037

- **ADR-0036** — a change is done when it works on a fresh consumer install, at a cost
  one person can pay. Names the preconditions brain's own repository has that no
  consumer does, and the checkable procedure a change now has to satisfy before it
  counts as finished.
- **ADR-0037** — autonomy is configurable: modes A, B and C, B by default, and the
  producing identity never approves or merges, in any mode. **Doctrine only — there is
  no runtime for it yet.** The merge verb (`mrMerge`) and the identity gate it depends on
  are #1133 and #1134; until both land, mode B cannot actually be claimed and the
  effective mode stays A.

## v1.7.0 — closed changes archive themselves, and adoption stops running the wrong code

**Manual step: read before upgrading.** On GitHub this release starts running a new
post-merge step in your repository.

1. **Decide how the archive sweep opens its pull requests.** After your next clean
   post-merge audit, `governance-postmerge.yml` archives every change folder whose issue
   is closed and pushes an `auto-archive/<date>` branch. To have it open the PR too,
   create a GitHub App with *Contents: read and write* and *Pull requests: read and
   write* on the repository, install it, and set the secrets `BRAIN_SWEEP_APP_ID` and
   `BRAIN_SWEEP_APP_PRIVATE_KEY`. Without them, the sweep keeps the pushed branch and
   files a `governance:archive-sweep-failed` issue with a compare link for you to open
   the PR by hand. Nothing breaks either way. Provisioning the App through brain itself
   is #1107.

Optional: if you hand-added a bare `repo:check` script to work around #1094, you can
drop it.

No branch-protection change. No new status context ships, so `brain:protect` does not
need a re-run.

### Why a minor and not a patch

It was planned as 1.6.1, two adoption fixes. Then #557 landed in full, and it adds
behaviour that runs in your repository: `governance-postmerge.yml` is a managed
workflow, so the sweep reaches every consumer on upgrade and acts on the first clean
merge after it. `issue-link` also gains an exemption. By the rule 1.6.0 applied,
capability a consumer can rely on is a minor. Shipping it as a patch would change your
repository under a version number that says it will not.

Not a major: nothing is renamed or removed.

### What you can do that you could not before

- **Closed changes leave `openspec/changes/` on their own** (#557). After a clean
  post-merge audit, the sweep asks the VCS whether each change folder's issue is closed
  and moves the closed ones to `openspec/changes/archive/<iid>/` as byte-identical
  renames, consolidating any declared capability spec into `openspec/specs/`. It opens
  at most one `auto-archive/*` PR at a time and never a second one on the same day.
  **It is fail-closed:** if a single issue state cannot be read, it archives nothing and
  files the alarm, because archiving the readable subset would report a sweep it could
  not complete. Folders it cannot place (several folders sharing one issue number, an
  existing destination, a name that does not parse as `issue-<N>-<slug>`) are listed in
  the PR and left alone. They never raise the alarm, which would otherwise fire on every
  merge. If you have never archived, expect the first sweep to be large. GitHub only:
  the GitLab fragment has no sweep yet.
- **The sweep's PR can pass `issue-link` without a closing keyword** (ADR-0035). An
  `auto-archive/<YYYY-MM-DD>` head targeting the default branch is exempt only when the
  diff earns it: byte-identical renames from `openspec/changes/<name>/` into
  `openspec/changes/archive/<X>/` with the same relative path, plus new or purely
  additive `openspec/specs/**/spec.md` files, and nothing else. **No file may be added or
  modified anywhere under `archive/`** (Amendment 1). An uncomputable diff is not exempt.
  The exemption is never granted by branch name, the same discipline ADR-0034 applies
  to `memory/*` lane heads.
- **The sweep acts as an App, through the VCS port** (#1106). It mints an installation
  token with `actions/create-github-app-token`, pinned by commit SHA, pushes with it,
  and opens the PR through the port's `mrCreate` against your repository's actual
  default branch. The workflow's `GITHUB_TOKEN` could not do this: GitHub refuses
  Actions-created PRs by default, and a PR created with that token triggers no checks,
  so it could never merge.

### What was repaired

- **`env:init` runs the code of the tree that invoked it** (#1093). It moves into the
  main checkout because `.env` and git config live there (#657), but it also ran every
  script from there. From a worktree holding a newer brain (every adoption or upgrade on
  a branch), it ran the old code and still printed `== Environment ready ==`. Measured
  in a real adoption: two `Cannot find module` errors, a merge driver 1.6.0 had retired,
  and a success line. It now records the invoking tree first and runs its scripts,
  including `brain:memory:pull` and `brain:memory:index`, from there. `.env` and git
  config stay where they were. A missing `brain/scripts/` stops the run, and two steps
  that failed in silence (`brain-config`, `home-scaffold`) now warn. They stay
  non-blocking.
- **The shipped workflows call a script you actually have** (#1094). `governance.yml`
  and the GitLab fragment ran `npm run repo:check`, which only exists in brain's own
  `package.json`. The installer delivers `brain:repo:check`, so every new consumer's
  `local-checks` failed on its first pull request. Both now call `brain:repo:check`,
  and a drift guard walks every managed workflow (discovered from the managed-paths
  list, not a hand-written one) and fails if any `npm run <script>` names a key the
  installer does not ship.
- **The upgrade reports what it regenerated, not what it meant to** (#1089). When it
  could not read `brain/HOME.md`, it still claimed to have regenerated `AGENTS.md` from
  it.

### Doctrine

ADR-0035 (*the archive sweep's `issue-link` exemption is content-earned, never granted
by branch name*) was promoted with Amendment 1, which closes its added-file residual
risk (#557). `workflow-governance.md` invariant 1 now names `issue-link`'s two
content-earned exemptions, `memory/*` (ADR-0034) and `auto-archive/<date>` (ADR-0035).
`harness-contract.md` lost a dead reference, cites project ADRs by name because
`brain/core/` ships to you and `brain/project/` is yours, and states that archiving is
machine-guaranteed on GitHub only. `openspec/README.md` gained the rule that closed
changes archive automatically.

### Known limits

- The pre-existing `auto-revert/*` post-merge step still opens its PR with
  `GITHUB_TOKEN` and a `Part of` reference to the default branch, so it can neither open
  nor pass `issue-link` on GitHub.
- GitHub's `mrCreate` ignores the `token` argument the VCS contract says it accepts
  (#1109). The sweep binds the identity to the port, so it is not affected.
- The doctrine does not yet say that automatic archiving needs the App. That note is
  drafted in #1106's change folder, awaiting promotion.

## v1.6.0 — memory travels on its own lane, and three gates become required at every tier

**Manual steps — read all four before upgrading.** Unlike v1.5.0, this release asks
something of you.

1. **Re-run `npm run brain:protect`** if you have branch protection armed. Three new
   status contexts ship — `lane-paths`, `lane-scrub` and `base-branch` — and
   `brain:protect` derives the required set from your tier. Without the re-run, the
   three run unenforced on GitHub and block on GitLab, which has no protection layer
   to hide them.
2. **`standard`/`regulated` with a diverged `governance.yml`:** add `VCS_TOKEN`,
   `PR_NUMBER` and `PR_BODY` to the `memory-gate` step's `env:` (see the vendored job
   for the exact form). Nothing to do at `lite`.
3. **Remove two inert leftovers:** `git rm .memory/manifest.json` and
   `git config --unset merge.engram-manifest.driver`. The upgrade already drops the
   `merge=engram-manifest` attribute, so git never runs the old driver again.
4. **`brain:memory:migrate-v1 --rollback` is removed** and refuses with a reason.
   Forward `migrate-v1` and `--dry-run` are unchanged.

### Why a minor and not a patch

Eleven of the 55 shipping changes add capability a consumer can rely on, and one
dormant migration becomes reachable — `1.6.0`, `memory.lane.enabled` (#906, ADR-0034
L5). `migrateConfig` applies only entries at or below the installed package version,
so at 1.5.0 that entry was code no consumer could reach. It runs now, and **its
default is `false` on every tier, always**. Flipping it is a maintainer act, never a
migration default, so no consumer's behaviour changes silently when the migration
lands: the lane's triggers read the flag before they spawn anything, and an absent
flag already meant `false`.

Not a major: nothing a consumer had is renamed or removed. The eleven `memory:*` →
`brain:memory:*` names (#961) are not a rename a consumer sees — consumers never had
those scripts, and they arrive here for the first time under their `brain:` names.

(Measured 24 feat / 31 fix / 44 internal by commit prefix, which is not the same split
as the prose below: #961 carries a `refactor` prefix and #922 a `chore` one, and both
are listed as capability because what they changed for a consumer is which verbs exist
in their `package.json`.)

### What you can do that you could not before

- **Run the verbs the doctrine has been telling you to run.** `MANAGED_SCRIPT_KEYS`
  went from 9 to 33 (#922). `brain:upgrade` now injects 24 more keys into your
  `package.json` — `brain:audit`, `brain:check`, `brain:config`, `brain:metrics`,
  `brain:next`, `brain:promote`, `brain:protect`, `brain:review`, `brain:review:board`,
  `brain:ship`, `brain:start`, `brain:upgrade`, `brain:governance-status`, `brain:nav`,
  `brain:adopt`, `brain:change:archive`, and the seven `brain:memory:*` verbs plus
  `brain:memory:session-end`. The catalog is reconciled against every `npm run …`
  mention in governed doctrine by a drift-guard test, so doctrine can no longer
  recommend a script the installer never delivers. `brain:memory:session-end` matters
  most: the compiled SessionEnd hook runs that script, and without the key every
  adopter's hook printed an npm "missing script" error to a surface the agent shows the
  user.
- **Let a memory record travel on its own branch.** ADR-0034's lane ships whole, across
  nine slices: a pure planner that groups records, breaks C2 ties and names the ref
  (#897); a collector that writes one local ref with a secret scan before the write and
  a CAS on `update-ref` (#887); `shipLane`, which pushes `--no-verify` behind a diverged
  pre-check, finds or creates the lane PR and arms by tier (#901); the `memory:ship` op
  itself, reading `BRAIN_MEMORY_TOKEN` once into the port identity, with `--dry-run` and
  `--json` (#888); and the triggers — a SessionEnd hook on both platforms and a
  `day:start` sweep, inert until `memory.lane.enabled` (#906). `mrAutoMerge` (#886) arms
  auto-merge only at exactly zero required reviews, never throws, and hardcodes squash.
  **All of it is off by default.**
- **Stop rebasing to satisfy `memory-gate`.** Scoped evidence now unions the PR's
  checked-out tree with `origin/<default>`, deduped by record `id`, PR tree winning a
  collision (#1024). Since ADR-0034 a record reaches `main` on its own lane PR, usually
  after the feature PR opens — such a record used to count as MISSING. It no longer
  does. If the default branch is unreadable and the PR tree has a scoped hit, the gate
  still passes on that hit; if neither has one it fails closed with an explicit "default
  branch unreadable" reason. A read failure never produces a silent pass. Every run now
  prints the path it took (`path=presence|retrieval|skipped`), including a clean pass,
  which printed nothing before. `skip:memory-gate` is honored per tier — accepted at
  `standard` from an actor who is neither the PR author nor a listed review/agent actor,
  refused at `regulated`, noted but not consulted at `lite`. `brain:metrics`'s column
  for it is now `raw/honored`, with an honored-usage-by-author table mirroring
  `size:exception`'s.
- **Ask what the memory actually contains.** `brain:memory:audit` (#870) answers epic
  #864's five numbers as one command, from records and git alone. `brain:snapshot`
  (#879) serves the whole read model as one JSON shape.
- **Correct a record instead of contradicting it.** `brain:memory:save --supersedes
  <id>` (#805) carries the correction chain, local-first and fail-closed, refused before
  any write rather than half-written.
- **Trust a record's provenance.** Actor is the configured handle, never the branch;
  `actorKind` is measured rather than guessed; `issue` is derived, never fabricated
  (#738). A known agent marker means agent, never human, and W4 now refuses a
  fabricating `source` (#939, #461).
- **Review with Codex or Gemini.** The `cold-review` stage routes to `claude`, `codex`
  or `gemini` (#978, #1017) — transport backend, output wiring, conditional readiness
  and routing. There is deliberately no default engine: a silent fallback to `claude`
  would be a degradation nobody could see.
- **Declare an epic's tracker as data.** The `brain-issue-graph` block declares it, the
  verb resolves it, and a gate refuses a slice aimed at `main` while its epic is in
  flight (#967). `brain:ticket:start` already enforced this at creation; `base-branch`
  is the backstop for a PR that reached the forge anyway.
- **See the work.** A local Brain UI ships behind `node brain/scripts/ui/server.mjs` —
  an SSE stream and a DAG canvas with an inspector drawer (#881), the six-tab surface
  with lanes, the SDD view and the reviews timeline (#998), the management views for
  roadmap, decisions, anti-patterns, history and by-actor (#882), the maintainer's
  design built region by region with a harness that runs it (#1059), and lanes that
  group by epic now that kind, parent and tracker are data (#1032). Note: `brain:ui` and
  `brain:snapshot` are **not** managed script keys — the files travel with
  `brain/scripts/**`, the npm scripts do not.

### Three gates that are required at every tier

This is the loudest change in the release, and `lite` is not exempt.

- **`lane-paths`** (#905) — a lane branch may touch only lane paths.
- **`lane-scrub`** (#905) — a non-waivable secret scan over every added
  `.memory/records/*.jsonl` path, on **every** PR, lane or not. It never imports the
  tier module at all: non-waivability is a property of the code, not of a matrix a
  future tier edit could soften. It fails closed on an unreadable secret config, an
  unreadable record, an invalid pattern, or an uncomputable diff.
- **`base-branch`** (#967) — a slice PR's base must be its epic's declared tracker. A
  consumer who declares no `brain-issue-graph` block passes untouched; a block that
  cannot be parsed is uncomputable and refuses, never a silent pass.

`GOVERNANCE_JOBS` is 3 entries longer than it was — 11 total — and `brain:audit` now
prints `[LANE]` for a lane merge while `local-checks` warns on index lag without
mutating anything (#889).

### What was repaired

- **An unreadable `brain.config.json` refuses instead of assuming defaults** — across
  four surfaces that each got it wrong independently: the memory scan (#712), the
  deny-list readers (#942), the release gate (#962), and the strict loader, which now
  also rejects a config that parses to something that is not a JSON object (#975).
- **`ship` refuses unless its caller declares itself** (#1012). `cli.mjs ship` refuses,
  before any credential read or VCS call, unless `--invoker` is `hook`, `sweep` or
  `manual`, and refuses independently whenever `NODE_TEST_CONTEXT` is set even with a
  valid invoker. `--dry-run` and `BRAIN_VCS_TEST_MODULE` are the only bypasses. This
  closes #1007, where `npm test` reached the real port because nothing on the call path
  checked who was calling. A meta-test now enforces a closed allowlist over every test
  that spawns a `brain/scripts/**` runtime entrypoint.
- **The lane reconciles its own branches** (#936, #930, #920). A half-finished delivery
  from a previous run is reconciled rather than repeated (#920). When today's local ref
  was already squash-merged, the next ship checks by content whether its records are all
  on `origin/main` and, if so, parents the new commit on `origin/main` — the PR diff
  stops listing records already merged; partial or unreadable delivery keeps appending,
  fail closed. After a successful ship (never under `--dry-run`) a cross-day sweep
  visits every other `memory/<host>-*` ref of this host with no age cutoff: fully
  merged refs are deleted locally, pending refs are re-shipped without collecting
  today's records into them, remote-only refs are reported and never touched. A sweep
  failure never turns a successful ship into a failure — it reports `sweep.failed`.
  **Behaviour change (#920 R8 reversed):** a lane PR closed without merge is no longer
  reopened. The lookup runs before the push; the ship reports and stops, every run,
  until an operator deletes the local ref. `mrList` now carries `state` and `merged` on
  both providers, with an optional `headBranch` filter that queries all states and fails
  closed on a full page; unfiltered calls send exactly the request they always did.
- **The engram adapter heals its own duplicate rows.** `brain:memory:heal-duplicates`
  (#1061, `engram`-only) groups a live export by `rec-`-prefixed `topic_key` and, for a
  key with exactly two live rows whose content, title and type agree, keeps the lower
  observation id. Report-only unless you pass `--apply`; it refuses, deleting nothing,
  when copies diverge, when a key has more than two live rows, when the engram version
  is outside the tested `1.20.x` range, or when the export shape is unrecognized.
  Deletion is hard — measured against engram 1.20.0, a soft delete leaves the row in the
  export with `deleted_at` set, which the audit would still count as live. It never
  reads or writes `.memory/records/` or the index.
- **The chunk read-back became an enforced boundary** (#247) — an allowlist guard, two
  pins and #874's deletion ledger — and `memory:save` under engram now writes the record
  first and hydrates one record afterwards (#924), with `share()` committing what is
  already true rather than exporting (#874).
- **Two importers through one snapshot yield one write** (#820): a non-blocking
  hydration guard makes the second importer skip and say so.
- **A worktree that could not be inspected is reported, not dropped** (#921, #923).
- **Reindex parity between the two backends is pinned** rather than assumed (#361).
- **The cold reviewer honors `size:exception` exactly as the diff-size gate does**
  (#1072) — the two had diverged.
- **The review run stopped writing into its own candidate**, and a symlink is now hashed
  by its target (#1019).
- **A prose `Parent:` declares the reference it names**, not every issue on the line
  (#1030).
- **The suite stopped touching the real repository.** `archive.test.mjs` sandboxes in
  tmp with a guard that keeps the class closed (#1022), the suite no longer reindexes
  the real memory index and the guard learned to see a defaulted root (#1058),
  `session-end-ship`'s real-config test holds for both lane flag states and never spawns
  for real (#1013), and the suite's verdict no longer depends on the shell (#714, #638).

### Retirements

- **The feature-PR memory surfaces are gone** (#890). The five surfaces `pre-push` and
  `ticket.nextSteps.step3` used are retired; the lane is where a record travels.
- **Engram's transport artifacts are gone** (#955). `session:start`, `day:start` and
  `brain:memory:pull` no longer restore a manifest; `brain:memory:share` no longer
  creates the `.engram` symlink (`brain:env:init` / `cli.mjs setup` still does).
  `brain:memory:migrate-v1 --rollback` is removed.
- **The manifest, its merge driver and share's symlink self-heal are gone** (#958).
- **`dualWriteRecords` is gone**, and five comments stopped citing it (#1060).

### Doctrine

ADR-0034 (*memory travels on its own lane*) was ruled and promoted with three
amendments, plus consolidation-protocol §5 and openspec README rule 3 (#862, #892), and
gained Amendment 4 with a `vcs-contract` `mrList` row for #936 (#1080). The backend
contract was ruled — records are the concept, engram is an adapter — across six promoted
drafts (#863, #876). The evidence-reader doctrine gained direction (deny readers fail
closed, #959) and names `brain:audit` as fixed and `approved-label` as an exemption
(#976). Five ADR errata corrected #961's amendments, which had annotated a body they
claimed was untouched (#973). The memory scripts are `brain:memory:*` throughout
doctrine and the ADRs (#961), and `memory-presence`'s header now cites ADR-0034, names
the export trigger and bounds the backend-to-file lag (#795).

## v1.5.0 — the governance surface stops trusting what it cannot measure

**No manual step.** No migration was promoted since v1.4.0, so nothing is
dormant and nothing is renamed or removed. `brain:upgrade` is enough.

### Why a minor and not a patch

Three of the eight changes add capability a consumer can rely on — a capability
report, a coverage measurement, and a release-debt line — and the remaining five
repair the verification surface itself. Nothing is removed, so the number moves
right.

(The eight split 4 feat / 4 fix by commit prefix, which is not the same split:
#124 carries a `feat` prefix but is listed below as a repair, because what it
changed for a consumer is that a gate stopped being theatre.)

### What you can do that you could not before

- **Ask what your forge account actually allows.** brain now reports the
  capability it HAS rather than the plan the platform sells. Where a control
  (required reviews, protected branches) is unavailable on the account tier,
  it is reported as unavailable and the ruling is *ratify and report* — brain
  states the gap instead of assuming a control it cannot verify, so the
  agent–human operating flow degrades honestly across GitHub and GitLab.
- **Measure the port instead of asserting it.** `brain:vcs:coverage` walks the
  exported verbs, folds their provenance and reports per-verb coverage with
  consumer counts, excluding itself from its own walk.
- **See release debt in `brain:status`.** A line now names dormant migrations
  (declared above the published version and therefore unreachable) and ordinary
  drift since the last tag. When a fact cannot be read it says so — the report
  never claims health from evidence it did not read, on either channel.

### Repairs to the verification surface

- **An approval can no longer be granted by the identity it governs.** An agent
  may act under an approval and may never grant one: the deny set is the union
  of `governance.reviewActors` and `governance.agentActors`, compared
  case-folded, and one exported predicate now answers for both the gate and the
  approve CLI — the two had diverged twice.
- **The tier decides the exit code, and decides it once.** `run-check.mjs` —
  which owns `memory-gate`, `decision-gate`, `issue-link` and `diff-size` —
  never called `mapDetectionToWarning`, so a gate whose lite policy is
  *detection* still exited 1. GitHub's branch protection hid this; GitLab has
  no such layer, so a lite consumer there was blocked by a gate that REQ-TIER-3
  says must warn. This is the fix consumers on GitLab want most.
- **The publish guard checks the right thing.** It asserted `tag === HEAD` and
  so called ordinary post-release history a failure, red on every maintainer
  checkout while the published state was correct. It now asserts the tag is ON
  this history — and it no longer returns early in CI, where it had been inert.
- **The container harness stopped waiting on a service it does not use.** The
  danger-paths scenarios install a zero-dependency package from a local
  `git+file://` remote and spent minutes in npm's audit call: 17m57s end to end
  before, 59s after.
- **Dogfooding got a boundary.** Configuring `sdd.map` turned 26 tests red, so
  the repository could dogfood the router or the reviewer and never both.

## v1.4.0 — the SDD pipeline becomes composable (M5 + M8)

**No manual step.** Unlike v1.1.0, this release is additive: `brain:upgrade`
migrates `brain.config.json` for you and nothing is renamed or removed.

### Why the number jumps 1.1.0 → 1.4.0

Three config migrations were promoted and signed between the two releases, and
`migrateConfig` applies a migration only when its version is **at or below the
installed package version** (`installer.mjs`). At 1.1.0 all three were dead
code for every consumer. The package meets its migration tail, so they run:

| migration | key it adds | default |
|---|---|---|
| 1.2.0 | `sdd.stages` — the declared stage set | `{}` |
| 1.3.0 | `sdd.configs` — per-stage agent and enabled state | `{}` |
| 1.4.0 | `sdd.engines` — what each SDD engine declared when last interrogated | `{}` |

Every default is an **empty object**, and that is the design: an absent
declaration keeps today's behaviour exactly. A stage you never declared runs as
it always did; an engine nobody recorded stays honestly absent rather than
reading as "interrogated and declared nothing".

### What you can do that you could not before

- **Compose the SDD pipeline per stage.** `sdd.map.<stage> = { engine, model? }`
  routes who PRODUCES each stage's artefact. Two engines ship wired: `plain`
  (manual handoff) and `gentle-ai` (runs on the platform). Who VERIFIES stays
  neutral — no gate can name an engine, and a test guards that.
- **Declare a stage of your own.** A stage beyond the four lifecycle stages is
  scaffolded by `brain:project:feature`, walked by `phase-order` in its declared
  position, and carried into the archive like any other. Declaring it is the
  demand: the gate then requires its artefact.
- **One config verb.** `brain:config get|set` is the single writer for
  `brain.config.json`, running pending migrations as part of the write.
- **Roles as a port.** Each stage declares its agent, model tier and
  instructions through one interface, with four archetypes on it.

### Refusals you may meet if you declare stages

`sdd.stages` is validated when read, and a malformed declaration is refused
with a message naming what is wrong — never silently normalised. It refuses:
omitting one of the four lifecycle stages (the set is additive-only),
reordering them relative to each other, a custom artefact impersonating a
lifecycle file, a reserved vocabulary name, one of the four renaming its own
artefact, two stages sharing one file, a stage name that is not a plain kebab
identifier, and an artefact that is not a bare `.md` filename.

### Also in this release

- `brain:promote` grows a migration arm: adding a config migration is a
  declarative draft the human signs, and the verb proves the candidate imports
  and migrates before it shows a plan.
- `brain:status` reports stranded feature branches — a tracker ahead of the
  default branch with no open PR is a signal, not silence.
- `tasks.md` may carry a `brain-slice-scope/1` block declaring a slice's claims
  and its terminal PR; `check-refs` refuses a malformed one repo-wide.
- Test fixtures no longer leak: every temporary directory lives under one
  per-run root that dies with the process, with a pre-suite sweep for runs that
  were killed.

## v1.1.0 — BREAKING: the package is now `@logikas/brain` (#655)

**If brain is already installed in your repo, do not upgrade with
`brain:upgrade`.** Reinstall by hand. This is a one-time step and it is the
only way across.

### Why the usual verb cannot do it

Your checkout carries brain's **previous** `brain-upgrade.mjs`, and that code
resolves `node_modules/brain`. It installs the new version, npm reads the new
`package.json`, the tree lands in `node_modules/@logikas/brain`, and the old
code then finds nothing and stops. Nothing written today reaches code that is
already in your repository (#625).

**Nothing is damaged if you try it.** Measured: the stop happens 19 lines before
any managed path is written, and the lock is released on exit. Your `package.json`,
lockfile and `node_modules` are updated; no brain file in your tree is touched.
You land exactly where the two commands below start.

### The migration

```bash
npm i -D @logikas/brain@<version>
node node_modules/@logikas/brain/brain/scripts/brain-upgrade.mjs <version> --no-install
```

The second command runs the **new** upgrader from its new location, and it
migrates your `brain:upgrade` alias — which points at the old path and would
otherwise stay broken, because brain never overwrites a script value you set.
If you customised that alias yourself, it is kept and you update it by hand.

`npm uninstall brain` afterwards, if you want the old directory gone.

### Behind a mirror or an air-gapped registry

The git URL still installs the same allowlisted bytes into the same directory,
and is a supported fallback rather than a retired path (ADR-0030 Amendment 1):

```bash
npm i -D "git+https://github.com/csrinaldi/brain.git#<tag>"
```

## v1.0.0 — first stable (controlled pilot) (#319)

First stable tag. **1.0 is a controlled-pilot release** — intended for repos the
maintainer controls, not yet open external adoption. Read `docs/KNOWN-LIMITATIONS.md`
before relying on it: `brain:upgrade` has no rollback and is not yet safe for
uncontrolled adopters, the external reviewer's flow-guarantees are inert in prod
(#317), distribution needs a manual `package.json` step, and rung-2/3 governance is
GitHub-only. The remaining path (1.1 line) is tracked in the epic #313 and
`docs/inbox/MASTER-PLAN-1.0.md`; the hard gate before external adoption is
auto-update-safety (rollback / clobber-safety / lockout).

Highlights of the v2 line landing as 1.0: three-axis decoupling
(`AGENT_PLATFORM` · `SDD_ENGINE` · `MEMORY_BACKEND`, ADR-0024), git-native durable
team memory (engram + plainfiles), VCS-agnostic PR-time governance (GitHub + GitLab),
the external cold reviewer (security boundary sound), and the SDD artifact contract.

## v0.9.5 — consumers no longer run brain's internal unit suite (#211)

Closes the portability treadmill v0.9.4 started down. v0.9.4 made two coupled
test files hermetic, but the governance CI job `local-checks` (vendored,
merge-blocking) runs `npm test` — brain's **entire** internal unit suite —
inside consumer repos, and two more tests coupled to brain-repo state surfaced
immediately in an `es` consumer. Those tests validate brain's own tooling, not
the consumer's integration; making each one portable is endless. **CI/config
only — no runtime or CLI change.**

- **`local-checks` runs `npm test` only in the brain source repo.** The step is
  now gated on the `.brain-source` marker (present only in brain source, never a
  managed path, so never vendored). Consumers run `repo:check` + `brain:nav` —
  which validate the consumer's own `brain/` state — and skip brain's internal
  suite. Since `governance.yml` is a managed path, every consumer picks this up
  on `brain:upgrade`.

Upgrade note: nothing to do beyond `brain:upgrade -- v0.9.5`. A consumer whose
CI was red solely from vendored brain unit tests goes green after upgrading.
The two tests that surfaced this (`brain/scripts/harness/backends/gentle-ai.test.mjs`,
`brain/scripts/check-refs.test.mjs`) remain brain-CI-only by design and are not
made portable.

## v0.9.4 — consumer-portable unit test suite (#206)

Fixes a merge-blocking regression for consumers on v0.9.3: the governance CI job
runs `npm test` (brain's whole vendored suite) inside consumer repos, but five
tests assumed they ran inside the brain source repo and failed there — red CI
blocked every consumer PR (surfaced on a `docs.language: es` monorepo).
**Test-only + additive i18n seam — no renames, no breaking changes, no CLI
behavior change.**

- **i18n gains an explicit-locale seam.** `t()` accepts an optional `{ locale }`,
  and a new exported `loadCatalog(lang)` resolves a catalog without touching the
  ambient `brain.config.json` or the module-level cache; `resolveSessionStrings`
  forwards it. The CLI path is unchanged (still reads the ambient locale). The
  affected tests pin `'en'` instead of the consumer's ambient language.
- **Brain-source-only tests skip in consumers.** Tests asserting on files that
  are never vendored (`.claude/commands/**`, `README.md`, the deprecated bare
  `session:start` alias) skip when the `.brain-source` marker is absent. One
  module-scope read that threw at import in a consumer moved inside its test.

Upgrade note: nothing to do beyond `brain:upgrade -- v0.9.4`. A consumer whose
CI was red on v0.9.3 solely from these tests goes green after upgrading.

## v0.9.3 — install-time HOME.md scaffold + agnostic ADR-index helper (#184)

Closes the fresh-consumer onboarding gap: adopting brain now creates a
`brain/HOME.md` at `brain:env:init`, and the auto-ADR flow can index accepted
ADRs into it. **Additive — no renames, no breaking changes.**

- **`brain:env:init` scaffolds `brain/HOME.md`** (create-if-absent; never
  overwrites an existing one) from a new managed template
  `brain/core/templates/HOME.template.md`. Fresh installs get a nav-clean entry
  point instead of the missing-HOME stopgap warning.
- **New agent-agnostic `brain/scripts/lib/home-index.mjs`** — inserts an ADR
  link into HOME.md's `### Architecture decisions` section (idempotent,
  CRLF-safe, fail-safe when the anchor is absent). The `project-bootstrap-adrs`
  flow now calls this helper instead of re-implementing the patch in prose, so
  any agent adapter reuses the same agnostic logic (enforced by a neutrality
  source-scan test).
- **`check-brain-nav`** excludes `brain/core/templates/` from the nav walk.

Upgrade note: `brain:upgrade` never touches your `brain/HOME.md` (it is
consumer-owned). To scaffold a HOME.md on an existing repo that lacks one, run
`brain:env:init`.

## v0.9.2 — upgrade self-host guard hardening (#180)

Fixes a lockout hazard for consumers stranded by a **pre-v0.8.0** upgrade.

- **No more false-positive lockout.** A pre-v0.8.0 upgrader plain-copied brain's
  `package.json`, clobbering the consumer's `name` → `brain`; that tripped
  `brain:upgrade`'s own `name === 'brain'` self-guard and locked the consumer out of
  every future upgrade. The self-host guard now keys on a `.brain-source` marker (present
  only in the brain source repo, never distributed) instead of the package name — a
  clobbered consumer can upgrade to recover; the old name check remains only as a
  non-fatal warning.
- **`package.json` locked into specialMerge** — a regression test pins it so it can never
  revert to a plain copy that would clobber consumer identity again.
- New anti-pattern doc: `brain/core/anti-patterns/pre-v0-8-0-upgrade-clobber-lockout.md`
  (mechanism + recovery).

Recovery for an already-locked-out consumer: restore your `package.json` name, then run
`node node_modules/brain/brain/scripts/brain-upgrade.mjs -- v0.9.2` (or `--force` once).

## v0.9.1 — upgrade/distribution robustness (#176)

Three bugs found by a real v0.9.0 upgrade test of a vendored + pnpm-workspace
consumer. **Upgrade to v0.9.1 if you are on v0.9.0** — the v0.9.0 L2 workflows did
not actually distribute.

- **L2 workflows now distribute.** `.github/workflows/release.yml` and
  `.github/workflows/governance-postmerge.yml` were missing from `managed[]`, so
  rung-2/rung-3 enforcement never reached consumers on `brain:upgrade` (the v0.9.0
  CHANGELOG claim was aspirational). They are now managed and arrive on upgrade.
- **pnpm workspace support.** `brain:upgrade` on a pnpm **workspace root** aborted
  with `ERR_PNPM_ADDING_TO_ROOT`; the installer now passes `-w` when
  `pnpm-workspace.yaml` is present (never for non-workspace pnpm or other PMs).
- **`brain:nav` fails gracefully** on a missing `brain/HOME.md` (incomplete
  adoption) — clear message + exit 1 instead of a raw ENOENT stack trace.

**No action beyond `brain:upgrade -- v0.9.1`.** Additive; no renames.

## v0.9.0 — governance v3: fail-closed substrate ladder (#144)

Governance v3 makes brain's load-bearing workflow discipline **fail-closed over
observable CI/git/PR evidence**, harness-agnostic, and capability-aware. See
[ADR-0015](brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md).

### New CI gates (six enforcement levels)

`.github/workflows/governance.yml` gains, alongside `issue-link` / `diff-size`:

| Job | Level | Tier |
|-----|-------|------|
| `local-checks` | L1 — `repo:check` + `brain:nav` + `npm test` in CI | required |
| `memory-gate` | L3 — engram dumped before close | required |
| `decision-gate` | L3 — ADR ships with a `brain/HOME.md` change | required |
| `phase-order` | L4 — SDD phase order (spec/design present, monotonic status, no code before a checked task) | detection |
| `actor-check` | L5 — no self-approval of `status:approved` (PR author *or* issue author) | detection |
| `brain-writes-reviewed` | L6 — `brain/core|project` writes reviewed by a non-author human | detection |

Detection jobs **run and report but do not block merge**; promote one by moving its
name from `DETECTION_JOBS` to `REQUIRED_JOBS` in `governance-checks.mjs`.

### New managed files (arrive automatically on `brain:upgrade`)

- `.github/workflows/release.yml` — rung-2 fail-closed release gate (audits `PREV_TAG..HEAD` on a tag push).
- `.github/workflows/governance-postmerge.yml` — rung-3 post-merge auto-revert (idempotent).
- `.github/CODEOWNERS` — optional rung-1 enhancement (ships with a placeholder reviewer; set your real team).

### Substrate ladder

Every gate enforces at the **highest rung its substrate allows** (branch protection →
release script → post-merge auto-correct → detection floor) and **never lies about the
active rung**: `brain:governance-status` reports the rung and the remedy to climb higher.

**No breaking renames.** Additive gates + managed paths only. Note: the new detection
gates run in your CI on the next PR; on a solo-dev repo `actor-check` /
`brain-writes-reviewed` may show red (self-approval) — that is honest detection, not a
merge blocker. This tag also carries the previously untagged v0.8.0 / v0.8.1 content.

## v0.8.1 — brain:session:start canonical verb (#154)

### New canonical verb

`session:start` (added in v0.8.0 as a bare verb) is now prefixed under the
`brain:` namespace per the convention established by #137:

| New canonical verb       | Deprecated alias |
|--------------------------|------------------|
| `brain:session:start`    | `session:start`  |

The `session:start` alias continues to work — it shipped in v0.8.0 and will not
be removed before the next MAJOR version.

### Automated consumer migration on `brain:upgrade`

`brain:upgrade` now injects `brain:session:start` into the consumer's
`package.json` alongside the existing 8 `brain:*` verbs (via `MANAGED_SCRIPT_KEYS`
in `brain/core/managed-paths.mjs`). Consumer-wins rule applies: if
`brain:session:start` already exists in the consumer's scripts, it is not
overwritten.

The `.claude/settings.json` `SessionStart` hook now uses `npm run brain:session:start`.
Consumers whose hook still says `session:start` remain functional via the alias.

**No action required**: `brain:upgrade` handles injection automatically.

## v0.8.0 — brain:* verb namespace + automated consumer migration (#137)

### New: 8 `brain:*` canonical verbs

All harness commands now have a `brain:`-prefixed canonical name alongside the
original verb, which continues to work as a deprecated alias:

| New canonical verb      | Deprecated alias   |
|-------------------------|--------------------|
| `brain:env:init`        | `env:init`         |
| `brain:day:start`       | `day:start`        |
| `brain:ticket:start`    | `ticket:start`     |
| `brain:project:feature` | `project:feature`  |
| `brain:project:status`  | `project:status`   |
| `brain:tracker:board`   | `tracker:board`    |
| `brain:repo:check`      | `repo:check`       |
| `brain:change:verify`   | `change:verify`    |

Both forms invoke the **same direct `node` target** — no indirection, no
subprocess, no name-coupling. Old verbs are functional in 0.8.0 and will not
be removed before the next MAJOR version.

### New capability: automated `package.json` migration on `brain:upgrade`

`brain:upgrade` now **additively injects** all 8 `brain:*` script keys into
the consumer's `package.json`. Rules:

- **Consumer-wins**: if a key already exists in the consumer's `scripts`, its
  value is never overwritten.
- **Additive only**: no existing key is deleted, renamed, or reordered.
- **Idempotent**: running `brain:upgrade` a second time leaves `package.json`
  byte-identical — no mtime churn.
- **Non-scripts fields** (`version`, `dependencies`, etc.) are never touched.
- Implemented via the `specialMerge` path in `copyManaged`, the same
  mechanism already used for `.claude/settings.json`. Controlled by
  `MANAGED_SCRIPT_KEYS` in `brain/core/managed-paths.mjs` (single source of
  truth — keys and targets are never hardcoded in two places).

**No action required**: `brain:upgrade` handles migration automatically on
the first upgrade to 0.8.0.

## v0.7.2 — core→project link fix + nav guard

- `check-brain-nav` now flags any `brain/core/**` link that resolves into
  `brain/project/**`. Core is generic and shipped to consumers; `brain/project/**`
  is consumer-owned and varies — so a core→project link resolves in brain's own
  self-hosting but **breaks every consumer's `brain:nav`**. Fixed the one offender
  (`core/methodology/workflow-governance.md` referenced `ADR-0014` by path → now by
  name). Discovered dogfooding the catastro/plataforma-scit adoption. (#126)

## v0.7.1 — maintenance

- `gitlab.capabilities()` now returns a `detail` field on the `unknown` outcome,
  so `brain:governance-status` can surface the underlying glab error (parity with
  the other outcomes). No config or behavior changes for consumers.

## v0.7.0 — BREAKING: scripts/ → brain/scripts/ namespace migration (#97)

### BREAKING CHANGE — Manual action required on upgrade

Brain's managed harness directory has moved from the consumer repo root
(`scripts/`) into the `brain/` namespace (`brain/scripts/`). This eliminates the
namespace collision where `brain:upgrade` could overwrite consumer-owned scripts
living at the root `scripts/` path.

**Required migration steps (in order):**

1. **Upgrade brain**: `npm run brain:upgrade -- <new-tag>`
   After this step, `brain/scripts/` is populated with the new harness.

2. **Delete the orphaned root `scripts/`**: the installer never deletes files —
   your old `scripts/` directory remains at the repo root and is now ORPHANED
   (brain no longer manages it). Delete it manually:
   ```bash
   rm -rf scripts/
   ```
   Do NOT delete it before upgrading if you have consumer-owned files there.

3. **Update your `package.json` aliases** (if you seeded them from the README):
   ```json
   {
     "brain:upgrade": "node node_modules/brain/brain/scripts/brain-upgrade.mjs",
     "env:init":      "bash ./brain/scripts/bootstrap.sh",
     "day:start":     "node ./brain/scripts/day-start.mjs"
   }
   ```
   Note the double `brain/` in `node_modules/brain/brain/scripts/...` — this is
   intentional: the installed package is `node_modules/brain/`, and the harness
   now lives at `brain/scripts/` within it.

4. **Run `day:start` after `brain:upgrade`** to self-heal `core.hooksPath`:
   `brain:upgrade` does not write git config. Between the upgrade and the next
   `day:start`, your `core.hooksPath` still points at the old `scripts/hooks`
   (which no longer exists). `day:start` detects this and reconfigures
   `core.hooksPath = brain/scripts/hooks` automatically. During this one-run
   window, git hooks are inactive — run `day:start` promptly.

### Summary of changes

- `scripts/**` → `brain/scripts/**` in the managed-paths manifest.
- `core.hooksPath` reconfigured from `scripts/hooks` → `brain/scripts/hooks`
  by `day:start` on first run after upgrade (self-healing, one-time).
- All npm script aliases in `package.json` updated to `./brain/scripts/...`.
- Bootstrap install path changes from `node_modules/brain/scripts/brain-upgrade.mjs`
  to `node_modules/brain/brain/scripts/brain-upgrade.mjs`.



## v0.6.1 — 2026-06-28

### Fixed

- **pnpm install** (#86): removed the `prepare` script that triggered
  `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` — pnpm 11 blocks git-hosted deps with
  build scripts. brain now installs cleanly via **npm / pnpm / yarn / bun**. The
  `prepare` was useless for consumers (it ran in brain's temporary clone on a
  git-dep install); `core.hooksPath` is configured by `env:init` and self-healed
  by `day:start`.

## v0.6.0 — 2026-06-28

### Added — Workflow governance (ADR-0014, #67)

A **tool-agnostic** governance layer enforcing the 4 load-bearing invariants
(approved ticket · PR ≤400 · memory dumped · ADR for decisions):

- **The floor** (always-on, tool-independent): the generic checks library
  (`scripts/governance/checks/`), the client-hook suite (`commit-msg`,
  `pre-commit`, a reliable `pre-push`), and **`brain:audit`** — re-verifies the
  invariants on merged history (the universal teeth).
- **The hard gate** (additive, capability-aware): `brain:protect` +
  `branchProtect` adapter verb (GitHub; GitLab Phase 3); **`brain:governance-status`**
  reports per-consumer what enforcement the platform/tier actually supports.
- **The golden path**: `brain:start` / `brain:check` / `brain:save` / `brain:ship`
  / `brain:next` — self-gating verbs unifying human + agent.
- **`--no-verify` policy**: a `repo:check` prohibited-reference + a Claude Code
  PreToolUse hook (`.claude/settings.json`).

### Changed

- `pre-push` `.memory/` check is now a **WARNING**, not a hard block — the
  reliability precondition for the `--no-verify` policy (the hook re-materializes
  memory, which churns, so a hard block self-blocked the push).
- New npm scripts: `brain:audit`, `brain:protect`, `brain:governance-status`,
  `brain:start`, `brain:check`, `brain:save`, `brain:ship`, `brain:next`.

### Notes

- **L1 hard enforcement** (branch protection / rulesets) requires **GitHub Pro
  for private repos, a public repo, or self-hosted** — run `brain:governance-status`
  to see your repo's capability. The **floor (hooks + audit) works on every repo,
  tier, and platform**. Activation (`brain:protect`) is a one-time per-repo admin step.

## v0.5.0 — 2026-06-27

### Added

- **Auto-ADR onboarding** (ADR-0013, #53): the bootstrap notices when
  `brain/project/decisions/` has no ADRs and points to the new
  `/project:bootstrap-adrs` agent command, which explores the consumer repo and
  drafts **descriptive** starter ADRs (Stack, Testing, Build) into
  `openspec/changes/auto-adrs/brain-drafts/` (Tier 1). The human accepts each into
  `brain/` via per-action **Tier 2** confirmation; the agent never auto-commits and
  never invents rationale (`Context`/`Consequences` stay `<TODO>` stubs).
- **`memory:import`** verb — `engram sync --import` only (no `git pull`).
- **`post-merge` git hook** — re-imports engram after any pull/merge.

### Fixed

- **Cross-machine `memory:pull` churn** (#59): `engram sync --export` rewrites
  `.memory/manifest.json` and leaves it dirty, blocking a `git pull`
  (*"local changes would be overwritten"*). `memory:pull` is now churn-resilient
  (restore the regenerable manifest → `git pull` → import). The manifest stays
  **committed** — it is engram's authoritative chunk index (see ADR-0002 note);
  gitignoring it would silently lose memory on every fresh machine.

### Changed

- `memory:pull` now performs a safe `git pull` (restore + pull + import), not just
  an import. Use the new **`memory:import`** for the old import-only behavior.

## v0.4.1 — 2026-06-27

### Fixed

- `brain-upgrade` (and the install flow) now use `git+https://…#<tag>` instead of
  npm's `github:` shorthand, which resolved to SSH and failed for the **private**
  brain repo on HTTPS-only consumers (CI / containers without an SSH key).
  `package.json` gains a `repository` field; the install URL is derived from it
  and normalized to `git+https`. (#44)

## v0.4.0 — 2026-06-27

### ⚠ BREAKING

- **VCS credential env var is now generic `VCS_TOKEN`** (was provider-specific
  `GITHUB_TOKEN` / `GITLAB_TOKEN`). **Action for consumers**: rename the variable
  in your `.env` to `VCS_TOKEN`, then re-run `npm run env:init` to refresh the git
  credential helper. (#33)

### Added

- **CLI output i18n** — harness output externalized to message catalogs
  (`scripts/i18n/`) with an English canonical fallback, driven by `docs.language`. (#11)
- **Feature-scoped working memory** — a second memory layer that travels with the
  feature branch (`openspec/changes/<feature>/resume.md` + `feature-checkpoint` /
  `feature-resume` verbs), hydrated into local engram, never merged to `main`.
  (ADR-0011, #16)
- **Harness-init adapter** — each SDD harness defines its own `init` via
  `scripts/harness/`; `bootstrap.sh` dispatches instead of an inline `case`.
  (ADR-0012, #27)
- **`env:init` bootstraps `brain.config.json`** for a fresh consumer: creates it
  from the schema and derives `vcs.provider` + `gitHost` + `slug` from the git
  origin (interactive provider confirm on a TTY). (#41, #35)

### Changed

- Restored the `.memory/` ↔ `.engram` abstraction: `.memory/` is the committed
  canonical directory, `.engram` a local symlink. The pre-push memory guard now
  actually works. (#234)
- The feature-working-memory contract is promoted to `brain/core/`. (#26)

### Fixed

- `feature-checkpoint` resolves the single active change that has a `resume.md`
  in multi-change repos. (#25)
- The harness SDD-context check resolves the engram project as the bare repo
  name (no spurious "context not found" notice). (#37)
- Stale `ADR-0003` references corrected; `package-lock.json` gitignored
  (zero-dependency repo). (#23, #28)

## v0.1.0

Initial versioned release: NX monorepo, VCS provider adapter, versioned
installer with managed paths + additive migrations, memory backend adapter,
check-refs engine.
