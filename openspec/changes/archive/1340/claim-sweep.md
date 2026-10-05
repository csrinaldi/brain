# Claim sweep (#1340)

Each behavioural sentence of the 1.12.0 CHANGELOG entry and each changed doc line, against the code on this tree (`main` at `d731fbad` plus the release commit). Paths are under `brain/scripts/` unless stated. "Run" means the claim was also observed on a scratch consumer installed from `npm pack` of this tree (`rel112pack/consumer`, `consumer2`, `consumer3`; see "Pre-publish upgrade check" below).

Corrected during drafting (counted at the end): the first draft of the entry said six things the code does not do. Each is listed under "Corrected".

## Read before upgrading (table)

| # | Claim | Proof | OK |
|---|---|---|---|
| 1 | At 1.11.0 `platform` defaulted to `claude` and `sdd` to `gentle-ai` in code; `memory` and `vcs` already refused | `git show v1.11.0:brain/scripts/harness/platform.mjs` (`DEFAULT_PLATFORM = 'claude'`, `return DEFAULT_PLATFORM`), `.../harness/cli.mjs:69` (`return 'gentle-ai'`), `.../vcs/cli.mjs:85` (`throw`), ADR-0038 Context table | YES |
| 2 | No axis has a default in code; the resolver refuses an undeclared axis and names the fix | `lib/axis-config.mjs:478` (`throw new AxisRefusal('undeclared'...)`), no `DEFAULT_PLATFORM` left in `harness/` (rg empty); the only defaults are the migration's own record, `lib/axis-migration-context.mjs:21-22`. Run: `config/cli.mjs resolve memory` on a blanked config printed the refusal | YES |
| 3 | `brain:config -- resolve <axis>` exits 3 for undeclared, 4 for a refused value | `config/cli.mjs:42-43,136`. Run: rc=3 and rc=4 | YES |
| 4 | After `brain:upgrade` each axis carries `{ default, providers }`, and `memory`, `platform`, `sdd` carry `locked: false`; flat keys stay | `core/config-migrations.mjs:269-291`; flat keys: `readAxis` alias, `lib/axis-config.mjs:62-83`. Run: consumer brain.config.json after upgrade (memory.backend and vcs.provider still present, `vcs` has no `locked`) | YES |
| 5 | A custom stage routed in `sdd.map` gets a role in `sdd.roles` | `core/config-migrations.mjs:312-327`. Run (consumer2): `sdd.roles["cold-review"] = {agent: brain:cold-review, engine: codex, model: gpt-5.5}` | YES |
| 6 | `team-config-reviewed` needs an approving review from a `governance.owners` login who is not the author; `detection` at `lite`, `required` at `standard` and `regulated` | `vcs/team-config-reviewed.mjs:1-30,64-125`, `vcs/governance-tiers.mjs:248-252`. Run: `checkContexts` gives `[]` at lite, `['team-config-reviewed']` at standard and regulated | YES |
| 7 | On GitLab at `standard`/`regulated` the gate fails closed until #1281 | `vcs/team-config-reviewed.mjs:114-118` (commitId null, GitLab limitation), `ci/gitlab-governance.yml:206-221`, ADR-0040 Amendment 1; open issue #1281 | YES |
| 8 | The five files are REFUSE-managed; `brain:upgrade` does not replace an edited copy and names `--force-managed <path>` | `core/managed-paths.mjs:168` (PR template), `:181` (GitLab MR template), `:184` (governance.yml), `:186` (governance-postmerge.yml), `:190` (gitlab-governance.yml); `brain-upgrade.mjs:600` | YES |
| 9 | What those files gained: the gate's job, one `pull_request_review` trigger, one PR-template row, one post-merge condition | `git diff v1.11.0..HEAD -- .github .gitlab brain/scripts/ci`: `governance.yml:22,381`, `PULL_REQUEST_TEMPLATE.md:119`, `Default.md` (+1 line), `gitlab-governance.yml:222`, `governance-postmerge.yml:714` | YES |
| 10 | "Without the new `governance.yml` the gate does not exist in your CI" | `governance.yml:381` is the only job named `team-config-reviewed` | YES |
| 11 | 1.11.0 `env:init` asked for the backend on a terminal when none was declared, and filled an empty `project.gitHost`/`project.slug`; 1.12.0 writes no team config in an existing repo | v1.11.0 CHANGELOG; `git show v1.11.0:brain/scripts/lib/brain-config.mjs` lines 187-191 (fills); now `lib/brain-config.mjs:345-348` (reports `missing`), `bootstrap.sh:295-333` (`_axis_settle`), `:713-716` | YES |
| 12 | "No brain gate treated `brain.config.json` specially" at 1.11.0 | `git show v1.11.0:brain/scripts/vcs/governance-checks.mjs` `GOVERNANCE_JOBS` has no such job | YES |

## No axis is chosen for you in code

| # | Claim | Proof | OK |
|---|---|---|---|
| 13 | Every axis is `{ default, providers }`; `default` names the team's implementation; one resolver `resolveAxis` reads all four | ADR-0038 section 1; `lib/axis-config.mjs:355` | YES |
| 14 | Precedence for memory/platform/sdd: process env, `.env`, user layer, team `default`, legacy key; vcs: process env, `vcs.default`, legacy; CI-detected provider wins | `lib/axis-config.mjs:225-231` (header comment), `:363-370` (runtime), `:424-433` (selector) | YES |
| 15 | The three refusals quoted | `i18n/en.mjs:252,253,254`; the first two are verbatim runs (memory), the third is the template with `memory` filled in | YES |
| 16 | `set memory.default plainfiles` writes `memory.default`, lists the provider and keeps `memory.backend` in step; `set memory.backend` does the same | `config/config-verb.mjs:172,179`. Run: both paths (consumer3: `{"backend":"plainfiles","default":"plainfiles","providers":{"plainfiles":{}}}`) | YES |
| 17 | The memory commands still refuse with their own 1.11.0 text naming `set memory.backend` and `env:init`, exit 3 | `i18n/en.mjs:569` (`memory.backend.undeclared`). Run: `memory/cli.mjs pull` printed it, rc=3 | YES |
| 18 | `SDD_HARNESS` and the flat `harness` key are a deprecated alias for platform and sdd, and a use prints the quoted notice | `lib/axis-config.mjs:462-473`, `i18n/en.mjs:280` | YES |
| 19 | The flat `memory.backend`, `vcs.provider`, `platform`, `engine` keys are read as a silent read-only alias while no `{ default, providers }` is declared | `lib/axis-config.mjs:62-83` (`legacyValue`), `readAxis` (no `notice` call there) | YES |

## The migration 1.11.1

| # | Claim | Proof | OK |
|---|---|---|---|
| 20 | Applied by `brain:upgrade` when `schemaVersion` is below 1.11.1 | `core/config-migrations.mjs:228`; `lib/installer.mjs` `migrateConfig`. Run: "Applied config migration(s): 1.11.1 (schemaVersion → 1.12.0)" | YES |
| 21 | platform/sdd: process env, `.env`, config keys, then `claude`/`gentle-ai`; a value that is not a provider brain ships is not copied (`default` `""`) | `lib/axis-migration-context.mjs:46-64` (`resolveEffective`: `invalid-value` returns `''`), `:21-22` | YES |
| 22 | memory/vcs: only the legacy key; a backend only in `.env` or the shell is not promoted | `core/config-migrations.mjs:280-281` (`toShape('memory', text(out.memory?.backend) ...)`, `toShape('vcs', text(out.vcs?.provider) ...)`) | YES |
| 23 | `providers` lists the one name as `{}` | `core/config-migrations.mjs:271` | YES |
| 24 | `locked: false` where none is stated; never overwrites a `locked` you set | `core/config-migrations.mjs:287-293` (`!has(out[axis], 'locked')`) | YES |
| 25 | Adds `sdd.providers.brain = {"version":"self"}` | `core/config-migrations.mjs:302-305` | YES |
| 26 | Custom stage: engine added to `platform.providers` as `{}`, role `brain:cold-review` or `brain:stage`; lifecycle stages skipped | `core/config-migrations.mjs:309-327` | YES |
| 27 | Never seeds `governance.owners`; keeps an axis that already has `default` or `providers`; leaves `sdd.map`/`sdd.configs` | `core/config-migrations.mjs:287` (comment), `:269` (`if (isShape(out[axis])) return`), description line 243 | YES |
| 28 | The quoted upgrade output | Run, consumer 1 (abridged, one line elided with "...") | YES |
| 29 | Undeclared memory: `memory.default = ""` line; memory commands refuse (exit 3) until declared | `core/config-migrations.mjs:273-275`; claim 17 | YES |

## Owners, user layer, locked

| # | Claim | Proof | OK |
|---|---|---|---|
| 30 | `governance.owners` is a list of bare logins; `set governance.owners alice,bob` writes it (login, comma list or JSON array; `@` dropped) | `config/config-verb.mjs:53-68`. Run: `set governance.owners alice` and `'["alice","bob"]'`, `get` returned the array | YES |
| 31 | An existing consumer is not seeded; `owners-undeclared` is a warning in `brain:governance-status` and `config -- diagnose` | `core/config-migrations.mjs:287`; `lib/axis-config.mjs:541-546`. Run: both printed it | YES |
| 32 | User layer is `${BRAIN_HOME:-~/.brain}/config.json`, untracked, per person | `lib/user-config.mjs:39-45` | YES |
| 33 | Holds `memory`, `platform`, `sdd` selectors (no vcs), same shape | `lib/user-config.mjs:121-125` (`user-set` rejects vcs), `lib/axis-config.mjs:299` (`validateUserConfig`) | YES |
| 34 | Written with 0600 in a 0700 directory by `user-set`; never writes `brain.config.json` | `lib/user-config.mjs:102,105-106`; `config/cli.mjs:89-107`. Run: `user-set` wrote only `$BRAIN_HOME/config.json` | YES |
| 35 | User and team providers are unioned and a selected value must be in the union | `lib/axis-config.mjs:322-336,448-458` | YES |
| 36 | `locked` is a boolean the team sets on memory/platform/sdd; refuses a differing value from user layer, `.env`, process env; quoted refusal | `config/config-verb.mjs:50-52`, `lib/axis-config.mjs:401-421`, `i18n/en.mjs:260`. Run: `MEMORY_BACKEND=engram resolve memory` rc=4, text verbatim | YES |
| 37 | `user-set` applies the same refusal and exits 4 | `config/cli.mjs:97-102`. Run: rc=4 | YES |
| 38 | A value equal to the team's is not an override | `lib/axis-config.mjs:412-415` (`v !== nonEmpty(shape.default)`), `config/cli.mjs:97` (`name !== declared`) | YES |
| 39 | A locked axis the team never declared refuses nothing | `lib/axis-config.mjs:401` (`... && nonEmpty(shape.default) !== ''`) | YES |
| 40 | A new adoption writes `governance.owners` from `brain.actor`, `memory.locked: true`, `sdd.locked: true`, `platform` free | `bootstrap.sh:631-633`, `lib/env-init-setup.mjs:165-179`, `core/config-migrations.mjs:367-371`. Run, consumer3: owners `["csrinaldi"]`, memory/sdd `locked: true`, platform `locked: false` | YES |
| 41 | An existing consumer gets none of that from an upgrade | `core/config-migrations.mjs:365-366` (comment), claims 24, 27 | YES |

## team-config-reviewed

| # | Claim | Proof | OK |
|---|---|---|---|
| 42 | A touch of `brain.config.json` (added, modified, deleted, renamed away) needs the review | `vcs/team-config-reviewed.mjs:11,134` (`--no-renames`) | YES |
| 43 | `APPROVED`, on the current head, from an owner who is not the author | `vcs/team-config-reviewed.mjs:97-125` | YES |
| 44 | Owners and tier read from the base branch | `vcs/team-config-reviewed.mjs:26-28,215` | YES |
| 45 | The adoption PR passes, labelled not independent review | `vcs/team-config-reviewed.mjs:67-73` | YES |
| 46 | Sole owner at `lite` may change the config they authored (named exception) | `vcs/team-config-reviewed.mjs:78-87` | YES |
| 47 | Author or repo unresolved: a touched non-founding config fails at standard/regulated, warns at lite, even with an approval | `vcs/team-config-reviewed.mjs:304-312` (#1333) | YES |
| 48 | GitLab: commitId null so a current approval cannot be told from stale; an MR pipeline does not re-run on approval | `vcs/team-config-reviewed.mjs:114-118`, `ci/gitlab-governance.yml:206-221` | YES |
| 49 | `brain:protect` derives the required checks from the tier, so re-running it adds the check at standard/regulated | `brain-protect.mjs:46-48` (`checks: checkContexts(tier)`). Run: `checkContexts('standard')` includes it | YES |

## env:init in an existing repository

| # | Claim | Proof | OK |
|---|---|---|---|
| 50 | `env:init` decides once whether it creates the file | `bootstrap.sh:79-98`; `lib/brain-config.mjs:355-366` (`--founding-file`) | YES |
| 51 | Existing repo: an undeclared memory/sdd/vcs prints the quoted text and a pending step | `bootstrap.sh:312-316`, `i18n/en.mjs:276` | YES |
| 52 | Empty `project.gitHost`/`project.slug` reported with the origin value and the `set` command | `lib/brain-config.mjs:345-348,380`, `i18n/en.mjs:268` | YES |
| 53 | Platform saved with `user-set` to the user layer | `bootstrap.sh:317-333` | YES |
| 54 | The memory prompt is asked only by the creating run, only on a terminal | `bootstrap.sh:712-718` (`$_founding != true` branch precedes `elif [ -t 0 ]`) | YES |
| 55 | Commands that need `project.slug` share one resolver: tracked value, origin remote, refusal; memory adapters keep their own order | `lib/project-slug.mjs:9-19`; quoted text `i18n/en.mjs:269` with `PROJECT_SLUG_FIX` (`lib/project-slug.mjs:35`) | YES |
| 56 | `env:init` writes no axis selector into `.env`, only the VCS token | `bootstrap.sh:566` is the only `env_set` call; run: no `.env` appeared with no token | YES |

## The local UI

| # | Claim | Proof | OK |
|---|---|---|---|
| 57 | "In flight" section above the track lanes; open issues with a change dir, worktree, branch or PR | `ui/static/app.js:607-627`, `ui/lib/inflight-model.mjs:1-14`, spec R-B/R-H (`issue-1284-*/proposal.md`) | YES |
| 58 | One row per issue, newest first; 7 days or more in a collapsed `stale (N)` group | `ui/lib/inflight-model.mjs:14,156`, `inflight-model.test.mjs:165-173`, `ui/static/app.js:622` | YES |
| 59 | `state unknown` marker; a failed read is `activity unknown`, never stale | `ui/static/app.js:598,600`, `inflight-model.mjs:18` | YES |
| 60 | A loading or failed source is named; "nothing in flight" only when every source is ready | `ui/lib/inflight-model.mjs:17,128-130`, `ui/static/app.js:607-619` | YES |
| 61 | Header is one line; `epic: not resolved` replaces the long sentence | `ui/lib/header-model.mjs:23,26,57` | YES |
| 62 | `done / total` with the source (`working tree`, `at HEAD`); missing/unreadable/empty `tasks.md` said in words, never a number | `ui/lib/progress-view.mjs:6-32` | YES |
| 63 | An epic shows closed / total children, counted only when closed data is present | `ui/lib/rollup-model.mjs:27,35,62-64` | YES |
| 64 | Spec, SDD, Tasks tabs read served HEAD, then the one worktree that holds the change, then the one origin branch that holds it; each tab states the source | `ui/change-route.mjs:590-640`, `ui/lib/drawer-model.mjs:46` | YES |
| 65 | Local worktree documents shown as uncommitted, never written | `ui/local-overlay.mjs:1-8` ("no verb that writes") | YES |
| 66 | `Remote work` panel from `origin/*` branches, `refresh remotes` control | `ui/static/app.js:585,905` | YES |
| 67 | Several holders refused by name | `ui/change-route.mjs:604-607,625-627` | YES |
| 68 | A document renders in a worker with a 1500 ms budget; says why one is unreadable | `ui/lib/render-budget.mjs:13`, `ui/git-run.mjs:3-5` (stderr piped, cause named) | YES |
| 69 | Forge reads in one thread per lane; first snapshot served before any forge call; loading is not failure | `ui/forge-thread.mjs:1-9`, `ui/server.test.mjs:1326`, `ui/lib/banners.mjs:73-79` | YES |
| 70 | Poller keeps one timer; a forge halt is not a user pause | `ui/poller.mjs:77-86,310` | YES |
| 71 | Epic drawer says "closed children are counted above" only when a count exists | `ui/lib/rollup-model.mjs:85-89`, `ui/static/app.js:1888` | YES |
| 72 | SDD tab from a worktree/origin does not mark an unreadable document present and says why | `ui/change-route.mjs:481-482` | YES |
| 73 | `--no-poll`: a section reads idle with the poller's reason; a closed delta cannot delete a just-closed issue | `status/snapshot.mjs:390-394`, `ui/lib/banners.mjs:73-79`, `ui/poller.mjs:191,242`; `issue-1262-*/proposal.md` | YES |
| 74 | Layout fixes #1310, #1311, #1307, #1326 | commit messages `f0de5f69`, `b58462a3`, `9c4f4a41`, `f311e69c`; `ui/static/app.js:1718-1719,1808` (tab scroll). CSS changes are not behavioural claims beyond the commit subjects | YES |

## Other fixes

| # | Claim | Proof | OK |
|---|---|---|---|
| 75 | codex: stdout discarded, output cap 64 MiB, stderr tail redacted before truncation | `axes/lib/agent-runtime.mjs:85,117,127-129`, `axes/review-engine/adapters/codex.mjs:182`, `git show 94b2d134` | YES |
| 76 | Archive-sweep alarm: `resolve-sweep` also requires `steps.sweep.outputs.alarm == ''`; the sweep exits 0 after filing | `.github/workflows/governance-postmerge.yml:714`, `issue-1235-*/proposal.md` | YES |
| 77 | `governance-postmerge.yml` is REFUSE-managed, so an edited copy is not replaced | claim 8 | YES |
| 78 | Lane re-ship: replaces its own remote branch under a lease when its content is on `origin/main` and the newest PR is merged; prints the quoted line | `memory/lane/ship.mjs:429-450`, `i18n/en.mjs:526` | YES |
| 79 | If origin refuses the forced update it says so and changes nothing | `memory/lane/ship.mjs:244-249`, `i18n/en.mjs:525` ("nothing was retried or deleted") | YES |

## What ships, follow-ups, why a minor

| # | Claim | Proof | OK |
|---|---|---|---|
| 80 | Each PR number maps to the named change | `git log --first-parent v1.11.0..HEAD` and `git log --no-merges 118002f2..849ea684` (subjects carry the numbers) | YES |
| 81 | 74 commits since v1.11.0: 13 feat, 36 fix, 25 internal | `release-debt.mjs` run on this tree: `release 74 commit(s) since v1.11.0 — 13 feat, 36 fix, 25 internal` | YES |
| 82 | One migration promoted above the published 1.11.0 that did nothing until a release | issue #1340 body (reporter output at `d731fbad`); `core/config-migrations.mjs:228` | YES |
| 83 | #1190 (listed in 1.11.0) is fixed; #1189, #1281, #1339, #1334 are open | `gh issue view` (1114 closed, 1189/1281/1334/1339 open); `git show 1610432a` | YES |
| 84 | `test:upgrade` / `upgrade-smoke` test published releases only | issue #1325 (closed by #1329), `.github/workflows/upgrade-smoke.yml` | YES |

## Docs changed

| # | Claim | Proof | OK |
|---|---|---|---|
| 85 | README adapters table: SDD engine, platform, memory, vcs selectors and "created by `env:init`" defaults | claims 13-16, 40, 50; `bootstrap.sh:656-661` (`_axis_settle platform claude`, `sdd gentle-ai`); vcs derived from origin: run (consumer3 `vcs.default: github` from the origin URL) | YES |
| 86 | README: `env:init` asks the backend and declares each axis only when it creates the config | claims 50, 54; `bootstrap.sh:295-305` | YES |
| 87 | adoption: `resolve` prints `<run> <repo> <run-where> <repo-where>`; `diagnose` prints JSON, exits 0 | `config/cli.mjs:33-37` | YES |
| 88 | adoption: `user-set` refuses memory/sdd with exit 3 while the team has not declared the axis | `config/cli.mjs:103-106` | YES |
| 89 | adoption: agent-platform paragraph (migration writes `platform.default`; a new adoption declares `claude`/`gentle-ai`) | claims 21, 85; `bootstrap.sh:656-661` | YES |
| 90 | adoption: `brain:governance-status` warns `owners-undeclared` | claim 31 | YES |
| 91 | KNOWN-LIMITATIONS #1281, #1339, #1334 | claims 7, 47; `config/cli.mjs:89-107` (no membership check; run: `user-set platform.default codex` rc=0 then `resolve platform` rc=4 with the quoted text); `vcs/brain-writes-reviewed.mjs:462` (`!author` skip) and `governance-tiers.mjs:216` (required at lite) | YES |
| 92 | KNOWN-LIMITATIONS: the memory refusal text mismatch | claim 17 (text mentions `env:init`), claim 51 (it no longer asks) | YES |
| 93 | KNOWN-LIMITATIONS #1325 scope; `--no-install` cannot tell an edited file from a changed one | run: `brain-upgrade` printed "the outgoing and incoming package are the same tree, so this run CANNOT tell ..." | YES |

## Corrected during drafting (6)

1. "Memory commands then refuse as quoted above" — **wrong**: `memory/cli.mjs` refuses with `memory.backend.undeclared` (`i18n/en.mjs:569`), the 1.11.0 text naming `set memory.backend` and `env:init`. The entry now quotes that fact and the adoption guide and KNOWN-LIMITATIONS flag the text as stale.
2. "`default` is the value from process env, `.env`, config key, code default" for all four axes — **wrong** for `memory` and `vcs`: only the legacy key is read (`core/config-migrations.mjs:280-281`). A `.env`-only backend is not promoted. Entry and adoption guide corrected.
3. "`SDD_HARNESS` and the `harness`/`engine` keys print a deprecation notice" — **wrong**: only `SDD_HARNESS` and `harness` do (`lib/axis-config.mjs:462-473`); `engine` and the flat `platform`/`memory.backend`/`vcs.provider` keys are read silently.
4. "`#1333`: a touched team config fails when the author is unresolved" — **imprecise**: it fails at `standard`/`regulated` and warns at `lite` (`vcs/team-config-reviewed.mjs:304-312`).
5. "Every reader of `project.slug` falls back to the origin" — **overclaim**: the memory adapters keep their own order (`lib/project-slug.mjs:15-17`). Reworded to "the commands that need it share one resolver".
6. "It never touches a key you already set" — **overclaim**: it keeps an axis that already has `default`/`providers` and any `locked` you set, but adds `locked: false` and the `brain` provider (`core/config-migrations.mjs:269,287-305`). Reworded. Also: "`standard`/`regulated` repos gain a required check" became "can gain", since it needs the new workflow and a `brain:protect` re-run, and a table cell saying "Reviewed like any file" (untraceable) became "No brain gate treated it specially".

## Pre-publish upgrade check (what the sweep rests on)

`npm pack` of this tree gave `logikas-brain-1.12.0.tgz` (898 files). A scratch consumer was installed from the registry at 1.11.0, `npx brain init` and `CI=1 npm run brain:env:init` were run, a backend declared, and the tarball installed over it; `brain:upgrade -- v1.12.0 --no-install` then applied migration 1.11.1. `--no-install` cannot do the three-way modified-file check (its own warning), so edited-managed-file refusal was not exercised. All four axes resolved with no refusal, `brain:repo:check` passed, and 33 `brain:*` scripts were present. Two more consumers covered a custom routed stage (consumer2) and the fresh 1.12.0 founding `env:init` (consumer3).
