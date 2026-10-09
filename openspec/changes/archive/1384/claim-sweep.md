# Claim sweep (#1384)

Each behavioural sentence of the 1.13.0 CHANGELOG entry and each changed doc line, against the code on this tree (`main` at `4f00469e` plus the release commit). Paths are under `brain/scripts/` unless stated. "Run" means observed on a scratch consumer installed from the registry (`p113/a` at 1.12.1, `p113/c` at 1.11.0 taken to 1.12.0) and upgraded with `npm pack` of this tree (`logikas-brain-1.13.0.tgz`) using the upgrader the consumer already held, `--no-install`. "v1.12.1:" means `git show v1.12.1:<path>`.

## Read before upgrading

| # | Claim | Proof | OK |
|---|---|---|---|
| 1 | No config migration is pending above 1.12.1; the newest is `1.12.1` | `brain/core/config-migrations.mjs:259` (`version: "1.12.1"`, last entry) | YES |
| 2 | The upgrade only restamps `schemaVersion` to `1.13.0` | `brain-upgrade.mjs:692-698` (persists a bumped schemaVersion, prints `Config already up to date — no migrations pending.`), `lib/installer.mjs:1561`; run: consumer a `brain.config.json` diff is the one `schemaVersion` line | YES |
| 3 | The package ships no `*.test.mjs`, `__fixtures__`, `fixtures`, `test-support` and none of the four helpers | `package.json:21-28` (the negated patterns incl. `hermetic-box.mjs`, `test-brain-home.mjs`, `test-tmp.mjs`, `test-hygiene.mjs`); run: tarball has 361 files, consumer a has 0 `*.test.*` under `brain` after the upgrade | YES |
| 4 | Earlier releases copied them into `brain/scripts/` | `lib/retired-test-paths.mjs:1-12` ("Test infrastructure earlier releases shipped under the managed `brain/scripts/**` COPY glob"); run: consumer a held 449 `*.test.mjs` before | YES |
| 5 | `Removed 554 file(s) brain no longer ships:` and a path per file | `brain-upgrade.mjs:644-645`; run: `a.upgrade.log` line 66, 554 paths listed | YES |
| 6 | 554 = 449 test files + 99 fixture/test-support files + 4 helpers + 2 retired readiness scripts | run: `comm` of the consumer's `brain/` file list before and after (removed 554, tests 449, non-test/non-fixture residue = `harness/codex-readiness.mjs`, `harness/gemini-readiness.mjs`, `lib/hermetic-box.mjs`, `lib/test-brain-home.mjs`, `lib/test-tmp.mjs`, `test-hygiene.mjs`; 554-449-6=99 under fixtures/test-support) | YES |
| 7 | Consumer c (1.12.0 upgrader) removed the same 554 | run: `c.upgrade.txt` line 69 `Removed 554 file(s)` | YES |
| 8 | After it `node --test` in the consumer reports `tests 0` | run: `# tests 0`, `# pass 0`, `# fail 0` in consumer a | YES |
| 9 | `--dry-run` prints `would remove N file(s) brain no longer ships:` and the list | `brain-upgrade.mjs:633-636` | YES |
| 10 | A retired file the consumer edited is deleted too; nothing compares bytes | `lib/installer.mjs:1155-1160` (`toRemove` filters on `managed`/`local`/`refusePaths`/`specialMerge`/exists-in-source/is-a-file only; `consumerModified` is not read) | YES |
| 11 | The removal runs under the restore point, so a failed run puts the files back | `lib/installer.mjs:1200` (`relPaths: [...toMerge, ...toCopy, ...toRemove]`) and the `@param retired` doc `:987-991` ("so a failed run puts them back") | YES |
| 12 | `local` and REFUSE/MERGE paths are never removed, and none lies under `brain/scripts/` | `lib/installer.mjs:1156-1157`; `core/managed-paths.mjs:208-214` (`local` = `brain/project/**`, `brain.config.json`, `.env`, `openspec/changes/**`, `.memory/**`) | YES |
| 13 | `--skip-merge` accepts only the three merged settings files, so it cannot keep a retired file | `brain-upgrade.mjs:271-285` (`ALL_MERGES`, `badSkip`) | YES |
| 14 | The list is data in the incoming package; the 1.12.1 upgrader already reads it | `lib/retired-paths.mjs:87` (`MOVED_PATHS` + `RETIRED_TEST_PATHS`); v1.12.1:`brain/scripts/brain-upgrade.mjs` reads `lib/retired-paths.mjs` from the incoming package (same lines as `:485-486` here); run: the held 1.12.1 upgrader (byte-identical to the saved copy) did the prune | YES |
| 15 | Package 10.4 MiB (933 files) to 4.0 MiB (361 files) unpacked; tarball 1.4 MB | `test/publish-allowlist.e2e.test.mjs:66` (comment: 3.99 MiB / 361 files, was 10.43 MiB / 933); run: `npm pack` printed package size 1.4 MB, unpacked 4.2 MB (decimal; = 4.0 MiB), 361 files | YES |
| 16 | `session:start` on plainfiles runs `hydrate --verify`, writes nothing, prints `memory:   plainfiles verified — index current (read-only)` | `session-start.mjs:338` (args), `:344-346`, `i18n/en.mjs:445`; `axes/memory/adapters/plainfiles.mjs:420-430` (verify branch calls `_verifyIndex`, no write); run: that exact line printed, `git status --porcelain` identical before and after | YES |
| 17 | A drifted index prints `memory:   plainfiles index is stale — session:start does not write; run npm run brain:memory:share` | `i18n/en.mjs:446`, `session-start.mjs:272,625`, `memory/cli.mjs:1259-1265` (stale flag and notice) | YES |
| 18 | In 1.12.1 the plainfiles line read `memory:   engram unavailable (skipped) — memory/cli: backend 'plainfiles' does not implement op 'import'` | v1.12.1:`session-start.mjs:292` (`import`), `:305-306` (reason = stderr), v1.12.1:`i18n/en.mjs:448`; `memory/cli.mjs:1053` (the refusal text); not re-run on a live 1.12.1 plainfiles consumer, composed from the three sources | YES (composed) |
| 19 | The line now names the declared backend: `memory:   engram hydrated`, `memory:   <backend> hydration deferred — <reason>` | `i18n/en.mjs:440,444`; `session-start.mjs:330-336,350-353` | YES |
| 20 | New lines `records:  N durable, newest <date> — <title>` and `issue #N: K record(s)` | `i18n/en.mjs:448,450`; run: consumer a printed `records:  durable store unreadable or empty — count unknown` for its empty store (the count form is `:448`) | YES |
| 21 | `memory/cli.mjs hydrate` exists on both backends | `axes/memory/adapters/plainfiles.mjs:414`, `axes/memory/adapters/engram.mjs:827` (bulk `hydrate`, deferral at `:956,964`); `memory/cli.mjs:164` (op list) | YES |
| 22 | `import` still works, prints the quoted notice, runs `hydrate`; #1351 removes it | `memory/cli.mjs:181-185` (alias rewrite), `i18n/en.mjs:628`; #1351 open (`gh api`) | YES |
| 23 | The `does not implement op 'import'` text no longer appears from post-merge, memory:pull or session:start | `hooks/post-merge:56` (`cli.mjs hydrate`), `session-start.mjs:338`, `package.json` `brain:memory:pull` = `cli.mjs pull`, whose `git pull` fires `post-merge` (spec REQ-1115-11) | YES |
| 24 | A deferred hydration exits 6, non-fatal for `post-merge` and `session:start` | `memory/lib/backend-resolve.mjs:42`, `memory/cli.mjs:1269-1275`; `hooks/post-merge:53-62`; `session-start.mjs:350-353` (returns `deferred`, step still exits 0) | YES |
| 25 | On engram it prints `⚠ hydrating .memory/records/ into engram was deferred — <reason>. The records are durable; the next hydration retries.` | `axes/memory/adapters/engram.mjs:956,964`, `i18n/en.mjs:626` | YES |
| 26 | Step 4c and its three lines are gone | `day-start.mjs:364-367` (comment: "There is no 4c"); v1.12.1:`day-start.mjs:361-366` printed them; `i18n/en.mjs` no longer has `day.memory.exporting/exported/exportFailed` (rg) | YES |
| 27 | Step 4a hydrates the declared backend for every backend; 4b stays behind the engram probe | `day-start.mjs:355-362` | YES |
| 28 | When engram is absent step 4 prints `engram not available — skipping the doctrine projection (step 4b, #1349).`, where 1.12.1 printed `engram not available — skipping shared memory.` and an install hint | `day-start.mjs:369-371`, `i18n/en.mjs:74`; v1.12.1:`day-start.mjs:369-370`, v1.12.1:`i18n/en.mjs:77-78` | YES |
| 29 | `antigravity` `init` returns `{ ok: false, reason }` on a malformed `.gemini/settings.json`, with the quoted message | `axes/platform/adapters/antigravity.mjs:287-289,307-316`; run: with a valid file `init()` returned `{"ok":true,...}` (the malformed case is the unit-test path, not re-run) | YES |
| 30 | In 1.12.1 it returned only an additive report | v1.12.1:`antigravity.mjs:230-235` (doc), `:311` | YES |
| 31 | `harness/cli.mjs init` prints `harness/cli: init() failed — <reason>`, exits 1 | `harness/cli.mjs:269-275` | YES |
| 32 | `env:init` then reports `harness init failed — REQUIRED, env:init will exit 1` | `bootstrap.sh:676-677`, `i18n/en.mjs:211` | YES |
| 33 | The same holds when `AGENTS.md` or `.gemini/settings.json` cannot be written | `antigravity.mjs:270,302,308-309` | YES |
| 34 | `claude` already behaved this way; `plain` answers `{ ok: true }` | `axes/platform/adapters/claude.mjs:98-113`; `axes/sdd-engine/adapters/plain.mjs:35-39`; run: `claude init -> {"ok":true}` | YES |
| 35 | `harness/codex-readiness.mjs` and `gemini-readiness.mjs` no longer exist; they are among the 554 | `ls harness/` (absent); run: both in the removed list (`a.removed.txt`) | YES |
| 36 | `harness/readiness.mjs` has `--check`, `--required`, `--engine` and reads the routed engine's descriptor | `harness/readiness.mjs:9-11,28-40,81` | YES |
| 37 | A route to `gemini` is now probed at bootstrap (it was not) | `bootstrap.sh:413-419`; v1.12.1:`bootstrap.sh:410-418` called only `codex-readiness.mjs`; `axes/review-engine/adapters/gemini.descriptor.mjs` declares `readiness: true` | YES |
| 38 | `env:init` prints `Cold-review engine readiness` where it printed `Codex cold-review`, and the pending item `cold-review engine readiness` where `Codex cold-review readiness` | `bootstrap.sh:413,418`; v1.12.1:`bootstrap.sh:412-417` | YES |
| 39 | Nothing else of the consumer's calls the old scripts by path | not claimed: the entry says anything of the consumer's that did must change | n/a |

## Platforms and review engines

| # | Claim | Proof | OK |
|---|---|---|---|
| 40 | Each runtime provider has one `<name>.descriptor.mjs` beside its adapter, declaring orchestrate / executeStage, output mode, model policy, readiness | `axes/platform/adapters/{claude,antigravity,plain}.descriptor.mjs`, `axes/review-engine/adapters/{codex,gemini}.descriptor.mjs`; spec REQ-1128-1; run: five descriptors present in the upgraded consumer (`a.added.txt`) | YES |
| 41 | A registry derives `PLATFORM_CAPABILITIES` and `AGENT_PLATFORMS` | `axes/lib/runtime-registry.mjs`, `lib/axis-config.mjs:34` (`AGENT_PLATFORMS = RUNTIME_REGISTRY.orchestrators`) | YES |
| 42 | The list is still `['claude', 'antigravity', 'plain']` in that order | `claude.descriptor.mjs:6` rank 1, `antigravity.descriptor.mjs:6` rank 2, `plain.descriptor.mjs:6` rank 3 | YES |
| 43 | The runner no longer branches on an engine name | `review/lib/run-cold-review-stage.mjs:166-181` (descriptor-driven); rg for `engine === 'codex'`/`'gemini'` in the file: none | YES |
| 44 | A failed stage's reason carries the last two stderr (else stdout) lines, at most 300 characters, credentials `[redacted]`, control bytes removed | `axes/lib/stage-output.mjs:20-36` (`engineTail`) | YES |
| 45 | In 1.12.1 `claude`'s non-zero-exit branch appended the first stderr line, unredacted and uncapped | v1.12.1:`axes/platform/adapters/claude.mjs:293-298` | YES |
| 46 | A route to an engine with no descriptor, or `plain`, is refused before anything is touched, with the quoted reason; the previous artifact stays | `review/lib/run-cold-review-stage.mjs:166-181` (the check precedes `mkdir`/`remove`, per the comment above it); the artifact-untouched assertion is spec REQ-1129-2's test | YES |
| 47 | Two new contract documents are installed under `brain/core/` | run: `a.added.txt` lists `brain/core/methodology/agent-platform-contract.md` and `review-engine-contract.md` | YES |

## Memory

| # | Claim | Proof | OK |
|---|---|---|---|
| 48 | plainfiles `hydrate` rebuilds the index only (no git), or with `--verify` writes nothing | `axes/memory/adapters/plainfiles.mjs:414-439` | YES |
| 49 | `brain:memory:pull` on plainfiles is `git pull` plus the index rebuild; on engram it also imports | `axes/memory/adapters/plainfiles.mjs:448-453`; `axes/memory/adapters/engram.mjs:549-575` | YES |

## The UI

| # | Claim | Proof | OK |
|---|---|---|---|
| 50 | A lane card with an open PR carries a footer `PR #N · rev R · <VERDICT> · head <sha7> · ...`; a PR whose verdicts were not read says so | `ui/lib/card-review-model.mjs:22-48` (`footerOf`), `:52-60` (`unreadFooter`: `verdict not read yet` / `verdicts could not be read`) | YES |
| 51 | The ledger shows title and excerpt; a click opens the full content inline as markdown from `GET /api/record/{id}` | `memory/lib/record-summary.mjs:1-8`, `ui/server.mjs:70,74,364`, `ui/record-route.mjs:49`, `ui/static/app.js:152,387` | YES |
| 52 | State and track are two chips: lifecycle state and `Track A` / `? No track` | `ui/static/app.js:777-790`, `ui/lib/state-vocab.mjs:140-146`; `ui/lib/lane-model.test.mjs:568-570` (`Track UI`, `No track`) | YES |
| 53 | An issue with no `brain-graph/1` block shows `Configuration missing` and the text `this issue is missing its brain-graph/1 configuration — paste in the issue body` | `ui/lib/state-vocab.mjs:122`, `ui/static/app.js:2096` | YES |
| 54 | An epic with a closed or in-flight child no longer reads Planned; all-closed open epic reads `Ready to close`; uncounted reads `Not computed` | `ui/lib/state-vocab.mjs:62-82` (`epicProgress`), `:22,25` | YES |
| 55 | `Awaiting approval` replaces `Awaiting review`, meaning the issue lacks `status:approved` | `ui/lib/state-vocab.mjs:13,24,46` | YES |

## Doc edits

| # | Claim | Proof | OK |
|---|---|---|---|
| 56 | README `brain:memory:pull`: `git pull`, rebuilds the index, then (on engram) imports; on plainfiles the rebuilt index is the whole step | rows 48-49 | YES |
| 57 | README `npm test`: brain's source repo only; an installed repository has no suites to run | root `package.json:75` (the `test` script) is brain's own; consumer `package.json` has no `test` script (run: `scripts.test` undefined); `adoption.md:320` | YES |
| 58 | adoption "Upgrading": the first upgrade to 1.13.0 deletes brain's test files, lists them, `--dry-run` previews them, an edited file is removed too | rows 5, 9, 10 | YES |
| 59 | KNOWN-LIMITATIONS #1353, #1355, #1352, #1362, #1374 | each issue's body (`gh api repos/csrinaldi/brain/issues/N`), all `open`; #1355: `session-start.mjs:91` (`MEMORY_CLI_ALLOWED_OPS` holds `hydrate`) and `:139` (a 2-arg op in the set passes, so the bare form passes) against `:140` (the `--verify` form) | YES, see Corrected |
| 60 | KNOWN-LIMITATIONS never carried #1115 / #1189 entries | `rg '1115|1189' docs/KNOWN-LIMITATIONS.md` returned nothing | YES |
| 61 | #1374: the readiness check says `cold-review is routed to <engine>; it declares no readiness probe` for an unknown engine while the runner refuses it | `harness/readiness.mjs:61-63` (not-required branch), `review/lib/run-cold-review-stage.mjs:168-181` | YES |

## Corrected

The first draft said nine things the code does not do, or does not do that way. Each was fixed before commit.

1. **"Only `local` protects a retired file."** `local` is brain's fixed list and none of it is under `brain/scripts/`; `--skip-merge` is limited to three settings files (rows 12-13). Rewritten as "no flag keeps a retired file", with the two ways to keep content (copy it out first, or git).
2. **"~450 files."** Measured: 554 removed, 449 of them test files. The entry uses 554 and the breakdown.
3. **"A retired file the consumer edited is deleted and listed by name."** True, but every removed file is listed by name, not only the edited ones. Reworded.
4. **"A run that succeeds does not [put the files back]."** Noise; deleted.
5. **"`claude` did none of this before."** `claude` had a redacted tail on its timed-out branch (v1.12.1:`claude.mjs:183-188`); only its non-zero-exit branch appended the raw first stderr line (`:297`). Reworded to that branch.
6. **"`codex` is pinned to its model ... any other model is refused."** Codex's pin is not new; only its being generic is. Deleted from the consumer-visible list.
7. **"Prints `hydrating .memory/records/ into <backend> was deferred`."** Only the engram adapter prints it (`engram.mjs:956,964`); written as `into engram`.
8. **"A missing configuration is a warning with the block to paste."** The warning's label is `Configuration missing` (`state-vocab.mjs:122`) and the pasted text is `app.js:2096`; quoted.
9. **The 1.12.1 plainfiles `session:start` line** was drafted as `memory:   engram unavailable (skipped)`; the real line also carries the reason (`— memory/cli: backend 'plainfiles' does not implement op 'import'`). Quoted in full (row 18, composed from the three sources, not re-run).

Not a correction but a limit of the proof: the scratch consumers' `env:init` with `CI=1` wrote no `.env`, so "all four axes resolve with `.env` moved aside" is vacuously true on consumer a. Consumer c had a `.env`; moving it aside reproduced the 1.12.0 defect (`platform` and `sdd` rc=3) before the repair and rc=0 after it.

## Pre-publish upgrade proof (lesson of #1344, with the PREVIOUS upgrader)

Scratch: `/tmp/claude-1000/-home-gandalf-IA-brain/d53d5a1f-10c9-4e27-a1f9-7dd5af425ce9/scratchpad/p113/`.

**Consumer a (registry 1.12.1, plainfiles).** The saved copy of `node_modules/@logikas/brain/brain/scripts` is `old1121-scripts` and is byte-identical to the consumer's own `brain/scripts/brain-upgrade.mjs`, which is what `npm run brain:upgrade` ran after `npm i` of the tarball (`--no-install`; the REFUSE guard cannot fire in that mode and the upgrader says so).
- `Removed 554 file(s) brain no longer ships:`; `Copied 356 managed file(s)`; `Config already up to date — no migrations pending.`; `brain.config.json` schemaVersion `1.12.1` to `1.13.0`.
- `*.test.*` files remaining under `brain`: 0; `node --test`: `tests 0, pass 0, fail 0`.
- `resolve vcs|memory|platform|sdd`: rc=0 each (`github`, `plainfiles`, `claude`, `gentle-ai`), no `.env` present.
- `npm run brain:session:start`: `memory:   plainfiles verified — index current (read-only)`; `git status --porcelain` unchanged (outside `node_modules`).
- `node brain/scripts/harness/cli.mjs init`: rc=0; adapter `init()` returns `{"ok":true}` for `claude` and `{"ok":true,"missingDocs":[],"agentsWritten":true,"geminiWritten":true}` for `antigravity`.
- `npm run brain:repo:check`: `No prohibited references found.`, `Artifact structure is valid.`

**Consumer c (registry 1.11.0 taken to 1.12.0 by its own upgrader: stamped `1.12.0`, axes unshaped, `platform`/`sdd` rc=3 with `.env` aside).** The 1.12.0 upgrader (saved as `old120c-scripts`) against the tarball: `Applied config migration(s): 1.12.1 (schemaVersion → 1.13.0)` with the six `wrote in brain.config.json` lines; `Removed 554 file(s)`; all four axes rc=0 with `.env` moved aside.
