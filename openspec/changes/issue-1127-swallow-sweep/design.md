---
status: draft
issue: 1127
---

# Design — the swallow inventory and its guard

## Decisions

**D1. The verdict lives in the code, and the guard reads it.** A separate allowlist file drifts from
the code it describes; a marker in or directly above the site cannot be missed by whoever edits it.
Three words, one grep: `swallow-ok:` (the failure does not change the outcome the step reports —
and the reason says why), `surfaced:` (this very block reports it: a named value, a warning, a
captured exit code the caller branches on), `follow-up: slice-X` (a known defect, deliberately not
fixed here, owned by a slice below). A block that throws or exits explains itself and needs
nothing. This is the allowlist style of `sdd-layout.test.mjs` / `test-spawn-hygiene.test.mjs`: the
allowlist IS the reason, and a reason under 15 characters fails.

**D2. A comment does not fix a site.** `swallow-ok` was granted only where the failure genuinely
cannot change what the step reports (an fsync hint, a cleanup on a path that already alarms, a
probe whose null IS its answer). Where it could, the site is `surfaced` with the mechanism named,
`follow-up`, or was fixed (below).

**D3. Owned-elsewhere sites were inventoried, not edited, while #1154/#1155 were open; both have merged.** A marker on lines an open PR rewrites is a guaranteed conflict, and fixing bootstrap then would have created a SECOND failure list beside #1155's `REQUIRED_FAILURES`. The guard therefore carried an `OWNED_ELSEWHERE` list matched by site text. It is now retired: every site those PRs brought has its own marker or a fix, and the mechanism stays (empty) with its stale-entry check for the next time a PR owns a region.

**D4. `index-lag.mjs` returns 0 on purpose.** Its contract (spec "local-checks warns on index lag,
never fails", L3) is a report, not a gate: the swallowed reads (`index.jsonl` unreadable, one
corrupt line) both turn into a WARNING naming the direction and counts, so nothing claims the index
is fine. Verdict: optional-with-reason (`surfaced`), pinned by `index-lag.test.mjs` (missing index
warns and exits 0; corrupt line reads as missing).

**D5. The cross-day lane sweep failing does not fail today's ship.** Ruled in #936 and pinned by
`cli.ship.test.mjs` ("a throwing sweepLanes() never turns today's successful ship into a failure"):
the failure is a `sweep.failed` marker in the JSON and one stderr line. Kept, `surfaced`.

**D7. Cold-review corrections (S1-S6).** The first cut of the guard was blind to JS embedded in shell (`node <<'NODE'` heredocs, `node -e`), let an adjacent catch inherit the previous line's marker, accepted `exitCode`-the-identifier, a conditional `throw` and a throw in an uncalled nested function as "self-explaining", and missed (round 2: `sh -c "x || true"`, `|| { true; }`, `|| (true)`, `if ! cmd; then :; fi`, and two catches on one line sharing one marker window) `|| return 0`, `|| log`, `|| printf`, `|| /bin/true`, `; true`, `|| { :; }`, `set +o errexit` and `||`-newline-`true`. Each evasion now has a synthetic test. A self-explaining block is one whose OWN top level unconditionally throws, calls `die(`, `process.exit(<non-zero>)` or sets a non-zero `process.exitCode`. A marker is honoured only inside the catch or on a standalone comment line directly above it. Reasons that were false were rewritten to say what the code does (e.g. `readJournal` returning null is `corrupt` and refuses, not "debris"), and reasons now state which errors they cover: where a non-ENOENT error was swallowed with a consequence, the catch was narrowed (below) or marked `follow-up`.

**D6. One masker.** `maskNonCode` moved out of `test-spawn-hygiene.test.mjs` into
`lib/mask-non-code.mjs` and gained regex-literal handling (a `/"/g` had unbalanced the scan); both
guards import it. The scanner throws when its masked source has unbalanced braces rather than
silently missing a `catch`.

## Fixed in this change (red then green)

| Site | Was | Now | Test |
|---|---|---|---|
| `archive.mjs` `--backfill` | unguarded `readdirSync` of `openspec/changes/`: uncaught ENOENT stack, exit 1, in a consumer with no changes yet (#1113's crash, second copy) | `listChangeFolders()`: a missing root is `[]`, other errors still throw | `archive.test.mjs` "#1127: --backfill in a repo with no openspec/changes/" |
| `engram.mjs` `featureResume` (3 sites) | a failed save, an unreadable file or an unreadable change dir was a `⚠` line; the verb exited 0 over a partial hydration | every file attempted, then throws naming each that did not land | `engram.feature.test.mjs` (two tests) |
| `lib/auto-resume.mjs` `tryFeatureResume` | (consequence of the row above) a non-zero exit dropped stdout, so session-start lost the resume summary | keeps the summary and appends `projection incomplete: <files>` only when stderr carries the projection message, otherwise `feature-resume exited <code>`; an empty-stdout failure is still `null` | `auto-resume.test.mjs` "#1127: a non-zero exit that printed a summary keeps it" |
| `brain-upgrade.mjs` schema floor (`currentSchema`) | a CORRUPT `brain.config.json` read as "no config yet": the downgrade guard was disarmed and `JSON.parse` threw at the migration step, AFTER the managed copy | only ENOENT is the first run; anything else dies before any write, naming the file | `brain-upgrade.test.mjs` "a corrupt brain.config.json refuses BEFORE any write" (+ the absent-config counter-test) |
| `brain-upgrade.mjs` `installedSemver` | an unreadable installed `package.json` silently dropped the installed version out of the downgrade floor; the reason claimed "the install step names the problem", which is false | ENOENT stays silent; any other error warns that the guard has no installed-version floor | `brain-upgrade.test.mjs` "an unreadable installed package.json is reported as a degraded downgrade guard" |
| `brain-upgrade.mjs` `migrationsForGuard` (downgrade path only) | a migrations module that existed but failed to load read as "no migrations" | only the module ITSELF being absent reads as none (a missing import inside it, or a load failure, dies before any write) | `brain-upgrade.test.mjs` "on the downgrade path a BROKEN installed migrations module refuses" and "whose own IMPORT is missing" |
| `brain-upgrade.mjs` incoming migrations module (every path) | the ordinary upgrade copied, then crashed at the step-3 import of a broken INCOMING `config-migrations.mjs` (the downgrade-only check above never ran) | the incoming package's module is import-checked before `copyManaged`, on every path; a load failure refuses with "No managed path was written" | `brain-upgrade.test.mjs` "an ORDINARY upgrade with a broken incoming migrations module refuses before the copy" |
| `engram.mjs` `featureCheckpoint` | any error reading an existing `resume.md` (EACCES) built a skeleton and OVERWROTE the hand-written state | only ENOENT builds the skeleton; any other read error is re-thrown | `engram.feature.test.mjs` "an existing resume.md that cannot be READ is never overwritten" |
| `install-tools.sh` provider | an unreadable `brain.config.json` defaulted the provider to gitlab, so a GitHub repo got `glab` | absent config keeps the documented default; a corrupt one is refused; without node the `vcs` object's provider is read by a text match (and the message says so), an empty or missing one takes the node path's gitlab default | `install-tools.test.mjs` (5 tests, snippets lifted from the script) |
| `install-tools.sh` summary | `gentle-ai install && ok \|\| warn` then a clean "Installation complete" and next steps | a failed configuration is recorded and the run ends `Setup INCOMPLETE`, exit 1, before the summary | `install-tools.test.mjs` "a failing `gentle-ai install` ends the run incomplete" |

## Follow-ups (each is a slice)

| Slice | Sites | Fix | Note |
|---|---|---|---|
| A (done, reclassified by cause in round 3) | `bootstrap.sh` steps that warned and then read "Environment ready" | see "Bootstrap classification" below | `bootstrap.required-steps.test.mjs`, `bootstrap.e2e.test.mjs` (the real script, hermetic), `brain-config.ensure-cli.test.mjs` |
| B | `brain-upgrade.mjs` AGENTS.md regeneration | decide whether a failed regeneration belongs in the exit code, and stop printing `Done.` over it | product call: the upgrade proper succeeded, AGENTS.md is a compiled derivative |
| C | `store.mjs` `readRecords`: unreadable `records/` dir and unreadable record file | surface as a counted, reported read failure instead of an empty store | needs an audit-visible number, so it touches `brain:memory:audit` |
| D | `installer.mjs` `listFiles`, `escapesRoot` | fail closed: an unreadable source directory or an unresolvable destination root must stop the upgrade | unreachable in a healthy tree, so low urgency |
| E | `lib/brain-config.mjs` (`ensure` still degrades silently on an unwritable directory) and the paths outside the five areas, not swept here (counts of unmarked swallow sites the scanner finds today): `day-start.mjs` 6, `session-start.mjs` 8, `adopt.mjs` 3, `vcs/**` adapters 29 in 12 files, `hooks/*` 7 in 4 files | run the same inventory, then add the files to the guard's scope | 53 sites; `day-start`/`session-start` first (a swallow there reads as a healthy session) |

## Bootstrap classification (by CAUSE, not by step)

Slice A first made `memory pull` and `memory index` REQUIRED by step. Round 3 reproduced the blocker on
isolated clones: a USABLE environment (default engram backend with no engram binary; plainfiles with no
origin, no upstream or offline; a repo with no commits; a new worktree branch) exited 1, its own message
said "(non-blocking)", and the memory contract says records-only capture needs no backend. The lifted-snippet
tests could not see it: nothing ran the whole script in a healthy box. `bootstrap.e2e.test.mjs` now does
(real `bootstrap.sh`, `stdin` closed, isolated HOME/XDG, a PATH of only shimmed host tools with no gh, glab,
engram, gentle-ai or codex and a python3 `grep`, a COPY of the brain tree): four healthy scenarios assert
exit 0 and the next step, one real merge refusal asserts exit 1. The four healthy ones failed on the
previous code first.

| Step | Cause | Verdict | Next step printed |
|---|---|---|---|
| SDD init | the harness init exits non-zero | REQUIRED | |
| `core.hooksPath` | `git config` fails | REQUIRED | |
| engram / plainfiles setup | the backend `setup` exits non-zero | REQUIRED | |
| engram hydration + index | the engram BINARY is absent | OPTIONAL (not attempted; `MISSING_OPTIONAL`) | install engram, then `npm run brain:memory:pull && npm run brain:memory:index` |
| engram index | binary present, `brain:memory:index` fails | REQUIRED | |
| memory pull (either backend) | preflight: no commits, or no upstream (no remote included) | OPTIONAL (skipped) | `npm run brain:memory:pull` once it exists |
| memory pull | the pull fails with a connectivity error (one isolated helper reads git's words, tested) | OPTIONAL (skipped) | `npm run brain:memory:pull` once the remote is reachable |
| memory pull | anything else: merge refusal, reconcile refusal, corrupt store | REQUIRED | |
| provider-override write | the write fails | REQUIRED | |
| `auth-login` | fails with a token present | REQUIRED | |
| no token provided | an operator's explicit choice | OPTIONAL | |
| `brain.config.json` | `ensure` exits 1 and the file cannot be parsed (checked by cause, not by the exit code) | REQUIRED | |
| `brain.config.json` | `ensure` exits 1 for any other reason (tier notice) | OPTIONAL | |
| open-ticket board | read-only listing | OPTIONAL | |

The printed line and the classification agree: the five REQUIRED-step messages say "REQUIRED, env:init will
exit 1" (a test fails if any message printed for a REQUIRED failure says "non-blocking"), and an optional
skip prints its next step.

## What the guard cannot see

A spawn whose exit status nobody reads, a `console.warn` outside a `catch`, a `.then(ok, () => {})`, a
swallow spelled through a helper, and `2>/dev/null` without `||`. Those were judged by hand while
building this table; extending the scan is its own change. (JS embedded in shell IS scanned.)

## Guard shape

`brain/scripts/swallow-guard.test.mjs`: `SCOPE_FILES` + `SCOPE_DIRS`; `scanJs` (masked source, `catch {}`
and `.catch(` sites; window = the catch's own lines plus a standalone comment line directly above);
`endsTheFailure` (top-level unconditional throw / exit); `embeddedJs` (heredocs and `node -e/-p`,
scanned with the JS classifier); `scanShell` (swallow-shaped lines and their continuation, window = the
line plus the contiguous comment block above); `classify` (`fails` / `owned` / `optional` /
`surfaced` / `follow-up` / `weak` / `unexplained`); `scanAll` (adds orphan markers). Four guard
tests and fifteen scanner tests on synthetic sources. `SWALLOW_INVENTORY=1 node
brain/scripts/swallow-guard.test.mjs` prints the table below straight from the markers.

## Inventory (every site, generated from the markers)

Sites per area and verdict, then the table. Line numbers are as of this change's tip and drift; the
guard matches by content, not line.

| Area | fails (throws/exits) | optional | surfaced | follow-up | owned | total |
|---|---|---|---|---|---|---|
| install | 5 | 21 | 8 | 2 | 0 | 36 |
| bootstrap | 2 | 12 | 0 | 0 | 0 | 14 |
| upgrade | 5 | 2 | 1 | 1 | 0 | 9 |
| memory | 25 | 32 | 35 | 2 | 0 | 94 |
| postmerge | 5 | 8 | 9 | 0 | 0 | 22 |

Total: 175 sites.

| Area | Site | Verdict | Reason | Pinned by |
|---|---|---|---|---|
| install | `brain/scripts/lib/init.mjs:73` | optional | an unreadable or unparseable package.json reads as "no installed tag" — the resolver's documented null | swallow-guard.test.mjs |
| install | `brain/scripts/lib/init.mjs:158` | surfaced | an unparseable package.json is re-raised, with the real parse error, by the merge that follows | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:133` | optional | an absent or unreadable outgoing copy is "unknown", never evidence of a consumer edit; callers treat unknown as unknown | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:157` | follow-up | slice-D an unreadable directory lists as empty, so a file could be skipped from a copy without a report | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:213` | surfaced | the path is pushed to `failed`, which the restore result returns and the caller prints | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:221` | surfaced | judged by outcome: pathPresent() on the next line pushes the path to `failed` when it is still on disk | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:233` | surfaced | a directory that could not be removed is pushed to `failed` and reported by the caller | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:248` | optional | removing the journal first is a safety ordering; the recursive removal on the next line still runs | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:287` | surfaced | a read or parse failure is pushed to `unparseable` with its cause and refuses the upgrade before any write | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:392` | optional | fsync is a durability hint; a failure leaves the write valid, only less durable across power loss | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:393` | optional | closing the probe descriptor cannot change the outcome; the fsync attempt above already ran | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:406` | optional | kill(pid, 0) throws by design to say "not alive"; EPERM (alive, not ours) maps to true | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:441` | surfaced | a code outside STRUCTURALLY_UNOWNED marks the lock `unknown`, which fails closed and refuses | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:542` | optional | ONLY EEXIST continues (a live owner refuses, a dead one is reclaimed, a contended retry throws); every other error is re-thrown | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:575` | optional | releasing our own lock is cosmetic; a stale lock is caught by the pid-liveness check on the next run | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:626` | surfaced | any read, parse or version failure returns null; inspectRestorePoint then reports state `corrupt` and refuses whenever a journal file is on disk | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:699` | optional | absent-or-unreadable is the null callers branch on: "nothing there" | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:728` | follow-up | slice-D an unresolvable destination root reads as "does not escape", which fails open in a safety check | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:739` | optional | an unresolvable segment moves the probe to its parent; that walk is how a path still to be created is judged | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:758` | optional | cosmetic — a leftover snapshot directory is harmless, a false failure after a fully applied upgrade is not | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:784` | optional | a frozen error cannot be annotated; the next lines wrap it in a new Error that carries it as cause | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:1022` | fails | the block throws or exits | the block throws or exits |
| install | `brain/scripts/lib/installer.mjs:1024` | optional | annotating a frozen error only changes wording; the original error is re-thrown unchanged | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:1071` | optional | any read error on an existing destination file (EACCES, EISDIR; ENOENT is excluded by existsSync) means "cannot claim it was edited"; the copy that follows reports a real write failure | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:1076` | optional | unreadable incoming file: the copy below reports the real failure | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:1159` | optional | a retired path that cannot be stat'd is neither removed nor claimed removed; it is left out of the removal list | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:1201` | fails | the block throws or exits | the block throws or exits |
| install | `brain/scripts/lib/installer.mjs:1247` | fails | the block throws or exits | the block throws or exits |
| install | `brain/scripts/lib/installer.mjs:1294` | optional | pruning empty parents is tidying after a removal that already succeeded | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:1376` | fails | the block throws or exits | the block throws or exits |
| install | `brain/scripts/lib/installer.mjs:1412` | fails | the block throws or exits | the block throws or exits |
| install | `brain/scripts/lib/installer.mjs:1793` | surfaced | reported as `source: 'fallback'`, never silently | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:1825` | optional | a provenance read must never be what stops an upgrade; `unknown` keeps the prior behaviour and the git fallback | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:2030` | optional | tries the next candidate path; falling off the end returns null, the "version unknown" answer | swallow-guard.test.mjs |
| install | `brain/scripts/cli-entry.mjs:123` | optional | an argv[1] that cannot be resolved is not a direct invocation of this file (REPL, -e, stdin) | swallow-guard.test.mjs |
| install | `brain/scripts/install-tools.sh:181` | optional | a version banner is cosmetic; the tool's presence was already established above | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:195` | optional | grep exits 1 when the key is absent, which is the answer env_get exists to give | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:201` | optional | grep -v exits 1 when .env held only that key; the empty remainder is the correct result | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:242` | optional | npm is the documented default package manager when detection is unavailable | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:291` | optional | create-if-absent: `: > file` IS the creation, not a swallowed failure (the guard reads `\|\| :` as a swallow); a failed write surfaces through the final `git check-ignore` and GITIGNORE_FAILED | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:347` | optional | the target is only quoted in the refusal message; the refusal (ENV_SECRET_SAFE=false) is already decided | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:351` | optional | GNU-then-BSD portability fallback; if BOTH stat forms fail the count reads as 1, so the hardlink check is SKIPPED; the symlink, file-type, tracked and ignore checks around it still gate the write | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:377` | optional | the URL only pre-fills a browser tab; the token prompt that follows works without it | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:385` | optional | opening a browser is a convenience; the URL is printed right after | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:387` | optional | opening a browser is a convenience; the URL is printed right after | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:670` | optional | the open-ticket board is a read-only listing; a failure loses no state and the message names where to look | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:109` | optional | an unparseable config reads as empty here and identity falls back to the git origin; `brain-config.mjs ensure` above now reports it and exits 1 (#1127) | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:116` | optional | no git origin means no derived host or project; the prompts and the final summary name what is still unset | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/harness/cli.mjs:164` | fails | the block throws or exits | the block throws or exits |
| bootstrap | `brain/scripts/harness/cli.mjs:273` | fails | the block throws or exits | the block throws or exits |
| upgrade | `brain/scripts/brain-upgrade.mjs:160` | fails | the block throws or exits | the block throws or exits |
| upgrade | `brain/scripts/brain-upgrade.mjs:210` | optional | the check only warns about a pre-v0.8.0 name clobber; an unreadable package.json is reported by the install step | swallow-guard.test.mjs |
| upgrade | `brain/scripts/brain-upgrade.mjs:255` | fails | the block throws or exits | the block throws or exits |
| upgrade | `brain/scripts/brain-upgrade.mjs:323` | fails | the block throws or exits | the block throws or exits |
| upgrade | `brain/scripts/brain-upgrade.mjs:333` | surfaced | ENOENT (not installed yet) is silent; any other error warns that the installed version is not a floor | swallow-guard.test.mjs |
| upgrade | `brain/scripts/brain-upgrade.mjs:492` | fails | the block throws or exits | the block throws or exits |
| upgrade | `brain/scripts/brain-upgrade.mjs:527` | fails | the block throws or exits | the block throws or exits |
| upgrade | `brain/scripts/brain-upgrade.mjs:702` | optional | detectAgentsClobber treats null as "evidence absent" and warns only when evidence is present | swallow-guard.test.mjs |
| upgrade | `brain/scripts/brain-upgrade.mjs:743` | follow-up | slice-B a failed AGENTS.md regeneration is a warning plus a hint, then the run still prints "Done." | swallow-guard.test.mjs |
| postmerge | `.github/workflows/governance-postmerge.yml:91` | surfaced | the exit code is captured on the next line and branched on; any non-PRESENT state files an alarm and halts | swallow-guard.test.mjs |
| postmerge | `.github/workflows/governance-postmerge.yml:171` | surfaced | the numeric audit exit code is captured, normalised, and decides revert versus alarm | swallow-guard.test.mjs |
| postmerge | `.github/workflows/governance-postmerge.yml:315` | optional | cleanup after a failed per-offender revert; the offender is recorded in `failed` and alarmed below | swallow-guard.test.mjs |
| postmerge | `.github/workflows/governance-postmerge.yml:316` | optional | cleanup after a failed per-offender revert; the offender is recorded in `failed` and alarmed below | swallow-guard.test.mjs |
| postmerge | `.github/workflows/governance-postmerge.yml:317` | optional | cleanup after a failed per-offender revert; the offender is recorded in `failed` and alarmed below | swallow-guard.test.mjs |
| postmerge | `.github/workflows/governance-postmerge.yml:477` | surfaced | the sweep exit code is captured on the next line; non-zero files the shared alarm | swallow-guard.test.mjs |
| postmerge | `.github/workflows/governance-postmerge.yml:551` | optional | strips a credential header the push must not carry; if it was never set there is nothing to strip, and a bad push is alarmed below | swallow-guard.test.mjs |
| postmerge | `.github/workflows/governance-postmerge.yml:569` | optional | best-effort orphan-branch cleanup on a path that already files an alarm ("where possible") | swallow-guard.test.mjs |
| postmerge | `.github/workflows/governance-postmerge.yml:594` | surfaced | the PR exit code is captured on the next line; 0, 2 and any other each branch to an outcome or an alarm | swallow-guard.test.mjs |
| postmerge | `.github/workflows/governance-postmerge.yml:629` | optional | best-effort orphan-branch cleanup on a path that already files an alarm ("where possible") | swallow-guard.test.mjs |
| postmerge | `brain/scripts/brain-audit.mjs:241` | optional | an unresolvable origin/main widens the audited range to HEAD — a superset, never a narrower one | swallow-guard.test.mjs |
| postmerge | `brain/scripts/brain-audit.mjs:308` | fails | the block throws or exits | the block throws or exits |
| postmerge | `brain/scripts/brain-audit.mjs:517` | fails | the block throws or exits | the block throws or exits |
| postmerge | `brain/scripts/archive.mjs:68` | surfaced | a null issue state is read by selectSweep as "could not read" and the run exits 1 (archive.test 5.4) | archive.test.mjs 5.4 |
| postmerge | `brain/scripts/archive.mjs:156` | surfaced | pushed to archiveErrors, printed, and the backfill exits 1 when any exist | swallow-guard.test.mjs |
| postmerge | `brain/scripts/archive.mjs:204` | surfaced | the error is printed and the function returns exit code 1 | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/cli.mjs:173` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:206` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:228` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:301` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:383` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:459` | optional | realpath only normalises the test-root guard's comparison; the lexical path is still compared | cli.ship.test.mjs (#936 remediation) |
| memory | `brain/scripts/memory/cli.mjs:461` | optional | realpath only normalises the test-root guard's comparison; the lexical path is still compared | cli.ship.test.mjs (#936 remediation) |
| memory | `brain/scripts/memory/cli.mjs:568` | surfaced | carried as `sweep.failed` in the JSON and one stderr line; today's ship is deliberately not failed by it (#936) | cli.ship.test.mjs (#936 remediation) |
| memory | `brain/scripts/memory/cli.mjs:628` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:732` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:876` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:963` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:1056` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:1102` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:1158` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/day-start-sweep.mjs:57` | surfaced | returned as `unparsed: true`, which the day-start renderer reports | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/index-lag.mjs:35` | surfaced | an unreadable index reads as empty, which then reports as lag (0 indexed) in the same WARNING | index-lag.test.mjs |
| memory | `brain/scripts/memory/index-lag.mjs:60` | surfaced | covers JSON.parse of one index line only (no I/O); the line is not indexed, so its ids show up as missing from the index in the WARNING | index-lag.test.mjs |
| memory | `brain/scripts/memory/lane/collect.mjs:57` | surfaced | ENOBUFS is returned as status -1, an uncomputable git result the callers never read as a pass | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lane/collect.mjs:177` | surfaced | recorded as `readError` on the candidate and routed to skipped with its reason | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lane/collect.mjs:273` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lane/plan.mjs:82` | surfaced | an unparsable candidate reads as undefined and the caller routes it to `invalid` | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lane/ship.mjs:196` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lane/ship.mjs:253` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lane/ship.mjs:475` | surfaced | folded into `autoMerge: { enabled: false, reason }`, reported on stderr; a refusal is non-fatal by design (A6) | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lane/sweep.mjs:155` | surfaced | a per-branch failure is returned as a row (`action`, `reason`) that the ship op reports | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lane/sweep.mjs:245` | surfaced | an unexpected throw is contained per branch and returned as a row with its reason | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/audit-io.mjs:28` | optional | covers JSON.parse of one line only (no I/O); a corrupt line is the fail-closed rebuildIndex gate's to refuse (store.mjs) | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/audit-io.mjs:72` | optional | an unparseable index line yields a null key that never matches a record id, so the drift shows in the measured row | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/audit-io.mjs:96` | surfaced | returned as `{ measured: false, reason }`: the audit row says why it degraded | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/audit-io.mjs:111` | surfaced | returned as `{ measured: false, reason }`: the audit row says why it degraded | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/auto-resume.mjs:74` | optional | the resume hint is advisory; a runner that cannot start yields null, the same as no resume point | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/backend-selection.mjs:132` | surfaced | returned as `available: null` with the reason, which the caller reports | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/feature-resolution.mjs:56` | optional | no openspec/changes/ means no candidate feature — the nothing-to-resume case | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/feature-resolution.mjs:66` | optional | an entry that cannot be stat'd is not a candidate change directory | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/format.mjs:312` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/format.mjs:379` | optional | canonicalOrNull's contract: a non-canonicalisable record reads as null and the caller routes it to invalid | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:37` | optional | kill(pid, 0) throws by design to say "not alive"; EPERM (alive, not ours) maps to true | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:47` | optional | an absent or unreadable owner file falls to the directory-age rule the caller applies | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:72` | optional | reclaiming orphans is opportunistic; the lock take itself still runs and reports contention | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:80` | optional | gone already or unreadable — not ours to insist on | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:131` | optional | ENOENT means reclaimed by someone else; any other rename error leaves the lock in place, which the stale-lock rule frees — release must never mask the import | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:139` | optional | putting the lock back lost a race; removing the tombstone is the safe end, the lock was not ours | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:151` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:177` | surfaced | an unreadable lock path returns `held: false`, which the caller reports as contention | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:187` | optional | someone else moved the stale lock first; the loop retries the take | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:196` | optional | putting the lock back lost a race; removing the tombstone is the safe end, the lock was not ours | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/migrate-v1.mjs:54` | surfaced | pushed to `unparseable`, which the migration report lists | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/migrate-v1.mjs:108` | surfaced | pushed to `rejected` with its reason; one corrupt observation must not abort the report | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/migrate-v1.mjs:230` | surfaced | pushed to `rejected` with its reason; the migration report lists it | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/reconcile-pull.mjs:89` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/reconcile-pull.mjs:137` | surfaced | pushed to `problems`, which defaultGitPull throws with the pull result | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/reconcile-pull.mjs:164` | surfaced | kept as `pullError` and re-thrown below after verifyOrRestore, with any unrestored records appended | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/resume-frontmatter.mjs:100` | optional | the documented graceful fallback for a hand-edited resume.md: no frontmatter, the body is kept | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/split-records.mjs:78` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/split-records.mjs:173` | optional | only collects ids already present; a corrupt line is refused by the rebuildIndex gate (store.mjs) | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/store.mjs:179` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/store.mjs:270` | optional | covers JSON.parse of one line only (no I/O); the fail-closed integrity gate is rebuildIndex above, which throws, and this reader is tolerant by design | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/store.mjs:357` | follow-up | slice-C a records/ directory that exists but cannot be read reads as an empty store | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/store.mjs:364` | follow-up | slice-C a record file that cannot be read is skipped without being counted or reported | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/store.mjs:374` | optional | covers JSON.parse of one line only (no I/O); the fail-closed integrity gate is rebuildIndex above, which throws, and this reader is tolerant by design | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/upstream-records.mjs:66` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/upstream-records.mjs:74` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/upstream-records.mjs:84` | optional | a failed ref probe reads as "ref not present", the answer the probe exists to give | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/upstream-records.mjs:185` | surfaced | carried as `configError` into the result | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/upstream-records.mjs:342` | surfaced | returned as `{ ok: false, reason }` with the ref and the cause | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/session-end-ship.mjs:80` | optional | ONLY EEXIST continues (the directory exists, and the lstat checks below refuse a symlink, a foreign owner or loose permissions); every other error is re-thrown | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/session-end-ship.mjs:194` | surfaced | the SessionEnd hook must exit 0 so it never blocks closing a session; the error is written to stderr and returned as spawned: false | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/staged-records-check.mjs:247` | surfaced | returned as `{ ok: false, reason }`, which the pre-commit check refuses on | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/staged-records-check.mjs:300` | surfaced | returned as `{ ok: false, reason }`, which the pre-commit check refuses on | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/staged-records-check.mjs:314` | surfaced | only ENOENT means "no merge"; every other read failure returns `{ ok: false, reason }` | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/staged-records-check.mjs:339` | surfaced | returned as `{ ok: false, inMerge: true, reason }`, which the check refuses on | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:96` | optional | an lstat probe; absence is answered by the warning and skip that follow (the symlink is the engram adapter's private artifact) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:109` | optional | an lstat probe: an absent .engram is the normal fresh-clone state and the branch below creates it | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:222` | optional | an unresolvable directory reads as null, this seam's documented "not resolvable" answer | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:478` | surfaced | engram's stderr is surfaced in the thrown error — that is the point of this block (#433) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:741` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:859` | surfaced | warned as hydrateDeferred and returned as `{ deferred: true, reason }`; the record is already durable | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:904` | surfaced | warned as hydrateDeferred and returned as `{ deferred: true, reason }`; the record is already durable | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1027` | optional | enrichment is best-effort by contract: never fatal, never required (feature-working-memory-contract.md) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1071` | optional | contract guarantee: an unresolvable feature is informational and exits 0 (feature-working-memory-contract.md) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1096` | optional | ONLY ENOENT (no resume.md yet) is the skeleton-creation case; any other read error is re-thrown below | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1147` | optional | enrichment is best-effort by contract: never fatal, never required (feature-working-memory-contract.md) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1154` | surfaced | a warning line names the offending field; the write proceeds by contract so the file can be fixed by hand | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1244` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1257` | surfaced | collected into `failures` and thrown after the loop (#1127) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1277` | surfaced | collected into `failures` and thrown after the loop (#1127) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1529` | optional | a failed version probe returns null, this seam's documented "version unknown" answer | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1627` | surfaced | returned as an outcome object with `detail`, which the caller reports | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1654` | surfaced | returned as an outcome object with `detail`, which the caller reports | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1662` | surfaced | returned as an outcome object with `detail`, which the caller reports | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/plainfiles.mjs:253` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/axes/memory/adapters/plainfiles.mjs:297` | optional | rg is an accelerant whose output never determines the search result (see search()) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/plainfiles.mjs:344` | optional | rg is an accelerant whose output never determines the search result (see search()) | swallow-guard.test.mjs |
| postmerge | `brain/scripts/governance/postmerge/alarm.mjs:78` | fails | the block throws or exits | the block throws or exits |
| postmerge | `brain/scripts/governance/postmerge/cursor.mjs:151` | fails | the block throws or exits | the block throws or exits |
| postmerge | `brain/scripts/governance/postmerge/git-seam.mjs:33` | surfaced | mapped to status -1 with the reason kept; an unmapped status is uncomputable, never a verdict | swallow-guard.test.mjs |
| postmerge | `brain/scripts/governance/postmerge/resolution.mjs:511` | optional | an unreadable blob reads as "every removed line resurrects" — the fail-closed direction | swallow-guard.test.mjs |
| postmerge | `brain/scripts/governance/postmerge/sweep.mjs:198` | surfaced | pushed to archiveErrors: the sweep exits 3 and the workflow files the archive-sweep-failed alarm | swallow-guard.test.mjs |
| postmerge | `brain/scripts/governance/postmerge/sweep.mjs:296` | fails | the block throws or exits | the block throws or exits |
