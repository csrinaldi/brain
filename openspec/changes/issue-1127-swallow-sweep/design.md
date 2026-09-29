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

**D3. Owned-elsewhere sites are inventoried, not edited.** #1155 rewrites `bootstrap.sh` (it adds
`REQUIRED_FAILURES` and a summary that exits 1) and #1154 rewrites two regions of `engram.mjs` /
`upstream-records.mjs`. A marker there would be a guaranteed conflict, and fixing bootstrap here
would create a SECOND failure list beside `REQUIRED_FAILURES`. Those sites sit in the guard's
`OWNED_ELSEWHERE`, matched by their own text (so line drift does not matter); when the owner lands
the entry goes stale, the test fails, and it is replaced by a real marker. A first implementation
of the bootstrap fix (`FAILED_STEPS`, `NOT ready` banner, exit 1) was written test-first and
withdrawn for exactly this reason; slice-A re-applies it on `REQUIRED_FAILURES`.

**D4. `index-lag.mjs` returns 0 on purpose.** Its contract (spec "local-checks warns on index lag,
never fails", L3) is a report, not a gate: the swallowed reads (`index.jsonl` unreadable, one
corrupt line) both turn into a WARNING naming the direction and counts, so nothing claims the index
is fine. Verdict: optional-with-reason (`surfaced`), pinned by `index-lag.test.mjs` (missing index
warns and exits 0; corrupt line reads as missing).

**D5. The cross-day lane sweep failing does not fail today's ship.** Ruled in #936 and pinned by
`cli.ship.test.mjs` ("a throwing sweepLanes() never turns today's successful ship into a failure"):
the failure is a `sweep.failed` marker in the JSON and one stderr line. Kept, `surfaced`.

**D6. One masker.** `maskNonCode` moved out of `test-spawn-hygiene.test.mjs` into
`lib/mask-non-code.mjs` and gained regex-literal handling (a `/"/g` had unbalanced the scan); both
guards import it. The scanner throws when its masked source has unbalanced braces rather than
silently missing a `catch`.

## Fixed in this change (red then green)

| Site | Was | Now | Test |
|---|---|---|---|
| `archive.mjs` `--backfill` | unguarded `readdirSync` of `openspec/changes/`: uncaught ENOENT stack, exit 1, in a consumer with no changes yet (#1113's crash, second copy) | `listChangeFolders()` — missing root is `[]`, other errors still throw | `archive.test.mjs` "#1127: --backfill in a repo with no openspec/changes/" |
| `engram.mjs` `featureResume` (3 sites) | a failed engram save, an unreadable file, an unreadable change dir were each a `⚠` line; the verb exited 0 over a partial hydration | every file attempted, then throws naming each file that did not land; an unreadable change dir throws | `engram.feature.test.mjs` "#1127: rejects, naming the files" and "still attempts every file" |

## Follow-ups (the budget stopped here; each is a slice)

| Slice | Sites | Fix | Note |
|---|---|---|---|
| A | `bootstrap.sh`: SDD init, `core.hooksPath`, engram setup, memory pull, memory index, provider override (`catch {}` + `\|\| true`) | append to #1155's `REQUIRED_FAILURES` so the run ends `NOT ready` with exit 1 | after #1155 merges. A tested draft exists (`FAILED_STEPS`, `Environment NOT ready` banner, five lifted-snippet tests). Board listing stays optional: read-only, loses no state |
| B | `brain-upgrade.mjs` AGENTS.md regeneration | decide whether a failed regeneration belongs in the exit code, and stop printing `Done.` over it | product call: the upgrade proper succeeded, AGENTS.md is a compiled derivative |
| C | `store.mjs` `readRecords`: unreadable `records/` dir and unreadable record file | surface as a counted, reported read failure instead of an empty store | needs an audit-visible number, so it touches `brain:memory:audit` |
| D | `installer.mjs` `listFiles`, `escapesRoot` | fail closed: an unreadable source directory or an unresolvable destination root must stop the upgrade | both are unreachable in a healthy tree, so low urgency |

## What the guard cannot see

A spawn whose exit status nobody reads, a `console.warn` outside a `catch`, a
`.then(ok, () => {})`, and `2>/dev/null` without `||`. Those were judged by hand while building this
table and none showed a defect beyond the rows above; extending the scan is its own change.

## Guard shape

`brain/scripts/swallow-guard.test.mjs`: `SCOPE_FILES` + `SCOPE_DIRS`; `scanJs` (masked source, `catch {}`
and `.catch(` sites, window = the line before the keyword through the closing brace); `scanShell`
(swallow-shaped lines, window = the line plus the contiguous comment block above); `classify`
(`fails` / `owned` / `optional` / `surfaced` / `follow-up` / `weak` / `unexplained`); `scanAll` (adds
orphan markers). Four guard tests, nine scanner tests on synthetic sources. `SWALLOW_INVENTORY=1 node
brain/scripts/swallow-guard.test.mjs` prints the table below straight from the markers.

## Inventory (every site, generated from the markers)

Area · `file:line` · verdict · reason · what pins it. Line numbers are as of this change's tip and
drift; the guard matches by content, not line.

| Area | Site | Verdict | Reason | Pinned by |
|---|---|---|---|---|
| install | `brain/scripts/lib/init.mjs:73` | optional | an unreadable or unparseable package.json reads as "no installed tag" — the resolver's documented null | swallow-guard.test.mjs |
| install | `brain/scripts/lib/init.mjs:158` | surfaced | an unparseable package.json is re-raised, with the real parse error, by the merge that follows | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:133` | optional | an absent outgoing copy is "unknown", never evidence of a consumer edit; callers treat unknown as unknown | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:157` | follow-up | slice-D an unreadable directory lists as empty, so a file could be skipped from a copy without a report | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:213` | surfaced | the path is pushed to `failed`, which the restore result returns and the caller prints | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:221` | surfaced | judged by outcome: pathPresent() on the next line pushes the path to `failed` when it is still on disk | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:233` | surfaced | a directory that could not be removed is pushed to `failed` and reported by the caller | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:248` | optional | removing the journal first is a safety ordering; the recursive removal on the next line still runs | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:287` | surfaced | a read or parse failure is pushed to `unparseable` with its cause and refuses the upgrade before any write | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:392` | optional | fsync is a durability hint; a failure leaves the write valid, only less durable across power loss | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:393` | optional | fsync is a durability hint; a failure leaves the write valid, only less durable across power loss | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:406` | optional | kill(pid, 0) throws by design to say "not alive"; EPERM (alive, not ours) maps to true | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:441` | surfaced | a code outside STRUCTURALLY_UNOWNED marks the lock `unknown`, which fails closed and refuses | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:542` | fails | the block throws or exits | the block throws or exits |
| install | `brain/scripts/lib/installer.mjs:575` | optional | releasing our own lock is cosmetic; a stale lock is caught by the pid-liveness check on the next run | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:626` | optional | an unreadable or malformed journal reads as "no journal"; the snapshot directory is then treated as debris | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:699` | optional | absent-or-unreadable is the null callers branch on: "nothing there" | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:728` | follow-up | slice-D an unresolvable destination root reads as "does not escape", which fails open in a safety check | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:739` | optional | an unresolvable segment moves the probe to its parent; that walk is how a path still to be created is judged | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:758` | optional | cosmetic — a leftover snapshot directory is harmless, a false failure after a fully applied upgrade is not | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:784` | optional | a frozen error cannot be annotated; the next lines wrap it in a new Error that carries it as cause | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:1022` | fails | the block throws or exits | the block throws or exits |
| install | `brain/scripts/lib/installer.mjs:1024` | optional | annotating a frozen error only changes wording; the original error is re-thrown unchanged | swallow-guard.test.mjs |
| install | `brain/scripts/lib/installer.mjs:1071` | optional | unreadable destination means "cannot claim it was edited"; the copy that follows reports a real write failure | swallow-guard.test.mjs |
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
| bootstrap | `brain/scripts/bootstrap.sh:124` | owned | #1155: slice-A the provider override write swallows its own failure (empty catch and `\|\| true`); it must join REQUIRED_FAILURES | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:160` | owned | #1155: swallow-ok: grep exits 1 when the key is absent, which is the answer env_get exists to give | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:166` | owned | #1155: swallow-ok: grep -v exits 1 when .env held only that key; the empty remainder is the correct result | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:207` | owned | #1155: swallow-ok: falls back to npm, the default package manager, when detection is unavailable | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:257` | owned | #1155: swallow-ok: the URL only pre-fills a browser tab; without it the operator is told to create the token by hand | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:265` | owned | #1155: swallow-ok: opening a browser is a convenience; the URL is printed on the next line | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:267` | owned | #1155: swallow-ok: opening a browser is a convenience; the URL is printed on the next line | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:314` | owned | #1155: credential gate: a failed VCS login is warned and the run reads as ready | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:365` | owned | #1155: slice-A a failed SDD init is a warning line, then "Environment ready" | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:386` | owned | #1155: slice-A a failed core.hooksPath config is a warning line, then "Environment ready" | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:394` | owned | #1155: slice-A a failed engram setup is a warning line, then "Environment ready" | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:402` | owned | #1155: slice-A a failed memory pull is a warning line, then "Environment ready" | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:403` | owned | #1155: slice-A a failed memory index is a warning line, then "Environment ready" | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/bootstrap.sh:413` | owned | #1155: swallow-ok: the open-ticket board is a read-only listing; a failure loses no state and the message names where to look | swallow-guard.test.mjs |
| bootstrap | `brain/scripts/harness/cli.mjs:164` | fails | the block throws or exits | the block throws or exits |
| bootstrap | `brain/scripts/harness/cli.mjs:273` | fails | the block throws or exits | the block throws or exits |
| upgrade | `brain/scripts/brain-upgrade.mjs:160` | fails | the block throws or exits | the block throws or exits |
| upgrade | `brain/scripts/brain-upgrade.mjs:210` | optional | the check only warns about a pre-v0.8.0 name clobber; an unreadable package.json is reported by the install step | swallow-guard.test.mjs |
| upgrade | `brain/scripts/brain-upgrade.mjs:254` | optional | not installed yet or unreadable reads as no migrations; the guard still compares versions | swallow-guard.test.mjs |
| upgrade | `brain/scripts/brain-upgrade.mjs:315` | optional | no config yet reads as no recorded schema version — nothing to compare, the first-run case | swallow-guard.test.mjs |
| upgrade | `brain/scripts/brain-upgrade.mjs:319` | optional | an unreadable installed package.json reads as no installed version; the install step names the real problem | swallow-guard.test.mjs |
| upgrade | `brain/scripts/brain-upgrade.mjs:498` | fails | the block throws or exits | the block throws or exits |
| upgrade | `brain/scripts/brain-upgrade.mjs:673` | optional | detectAgentsClobber treats null as "evidence absent" and warns only when evidence is present | swallow-guard.test.mjs |
| upgrade | `brain/scripts/brain-upgrade.mjs:714` | follow-up | slice-B a failed AGENTS.md regeneration is a warning plus a hint, then the run still prints "Done." | swallow-guard.test.mjs |
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
| memory | `brain/scripts/memory/cli.mjs:459` | optional | realpath only normalises the test-root guard's comparison; the lexical path is still compared | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/cli.mjs:461` | optional | realpath only normalises the test-root guard's comparison; the lexical path is still compared | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/cli.mjs:568` | surfaced | carried as `sweep.failed` in the JSON and one stderr line; today's ship is deliberately not failed by it (#936) | cli.ship.test.mjs (#936 remediation) |
| memory | `brain/scripts/memory/cli.mjs:628` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:732` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:876` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:963` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:1056` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:1102` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/cli.mjs:1158` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/day-start-sweep.mjs:57` | surfaced | returned as `unparsed: true`, which the day-start renderer reports | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/index-lag.mjs:35` | surfaced | an unreadable index reads as empty, which then reports as lag (0 indexed) in the same WARNING | index-lag.test.mjs (missing index warns, exits 0) |
| memory | `brain/scripts/memory/index-lag.mjs:60` | surfaced | a corrupt index line is simply not indexed, so its ids show up as missing from the index in the WARNING | index-lag.test.mjs (#1127 corrupt line) |
| memory | `brain/scripts/memory/lane/collect.mjs:57` | surfaced | ENOBUFS is returned as status -1, an uncomputable git result the callers never read as a pass | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lane/collect.mjs:177` | surfaced | recorded as `readError` on the candidate and routed to skipped with its reason | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lane/collect.mjs:273` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lane/plan.mjs:82` | surfaced | an unparsable candidate reads as undefined and the caller routes it to `invalid` | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lane/ship.mjs:196` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lane/ship.mjs:253` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lane/ship.mjs:475` | surfaced | folded into `autoMerge: { enabled: false, reason }`, reported on stderr; a refusal is non-fatal by design (A6) | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lane/sweep.mjs:155` | surfaced | a per-branch failure is returned as a row (`action`, `reason`) that the ship op reports | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lane/sweep.mjs:245` | surfaced | an unexpected throw is contained per branch and returned as a row with its reason | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/audit-io.mjs:28` | optional | audit measures well-formed records; a corrupt line is the fail-closed rebuildIndex gate's to refuse (store.mjs) | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/audit-io.mjs:72` | optional | an unparseable index line yields a null key that never matches a record id, so the drift shows in the measured row | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/audit-io.mjs:96` | surfaced | returned as `{ measured: false, reason }`: the audit row says why it degraded | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/audit-io.mjs:111` | surfaced | returned as `{ measured: false, reason }`: the audit row says why it degraded | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/auto-resume.mjs:61` | optional | the resume hint is advisory; a runner that cannot start yields null, the same as no resume point | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/backend-selection.mjs:132` | surfaced | returned as `available: null` with the reason, which the caller reports | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/feature-resolution.mjs:56` | optional | no openspec/changes/ means no candidate feature — the nothing-to-resume case | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/feature-resolution.mjs:66` | optional | an entry that cannot be stat'd is not a candidate change directory | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/format.mjs:312` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/format.mjs:379` | optional | canonicalOrNull's contract: a non-canonicalisable record reads as null and the caller routes it to invalid | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:37` | optional | kill(pid, 0) throws by design to say "not alive"; EPERM (alive, not ours) maps to true | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:47` | optional | an absent or unreadable owner file falls to the directory-age rule the caller applies | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:72` | optional | reclaiming orphans is opportunistic; the lock take itself still runs and reports contention | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:80` | optional | gone already or unreadable — not ours to insist on | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:131` | optional | the lock is already gone (reclaimed by someone else); nothing of ours to remove | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:139` | optional | putting the lock back lost a race; removing the tombstone is the safe end, the lock was not ours | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:151` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:177` | surfaced | an unreadable lock path returns `held: false`, which the caller reports as contention | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:187` | optional | someone else moved the stale lock first; the loop retries the take | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/hydration-guard.mjs:196` | optional | putting the lock back lost a race; removing the tombstone is the safe end, the lock was not ours | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/migrate-v1.mjs:54` | surfaced | pushed to `unparseable`, which the migration report lists | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/migrate-v1.mjs:108` | surfaced | pushed to `rejected` with its reason; one corrupt observation must not abort the report | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/migrate-v1.mjs:230` | surfaced | pushed to `rejected` with its reason; the migration report lists it | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/resume-frontmatter.mjs:100` | optional | the documented graceful fallback for a hand-edited resume.md: no frontmatter, the body is kept | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/split-records.mjs:78` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/split-records.mjs:173` | optional | only collects ids already present; a corrupt line is refused by the rebuildIndex gate (store.mjs) | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/store.mjs:179` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/store.mjs:270` | optional | corrupt line — the fail-closed integrity gate is rebuildIndex above, which throws; this reader is tolerant by design | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/store.mjs:357` | follow-up | slice-C a records/ directory that exists but cannot be read reads as an empty store | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/store.mjs:364` | follow-up | slice-C a record file that cannot be read is skipped without being counted or reported | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/store.mjs:374` | optional | corrupt line — the fail-closed integrity gate is rebuildIndex above, which throws; this reader is tolerant by design | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/upstream-records.mjs:66` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/upstream-records.mjs:74` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/lib/upstream-records.mjs:84` | optional | a failed ref probe reads as "ref not present", the answer the probe exists to give | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/upstream-records.mjs:185` | surfaced | carried as `configError` into the result | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/lib/upstream-records.mjs:320` | owned | #1154: surfaced: returned as `{ ok: false, reason }` with the ref and the cause | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/session-end-ship.mjs:80` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/memory/session-end-ship.mjs:194` | surfaced | the SessionEnd hook must exit 0 so it never blocks closing a session; the error is written to stderr and returned as spawned: false | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/staged-records-check.mjs:247` | surfaced | returned as `{ ok: false, reason }`, which the pre-commit check refuses on | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/staged-records-check.mjs:300` | surfaced | returned as `{ ok: false, reason }`, which the pre-commit check refuses on | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/staged-records-check.mjs:314` | surfaced | only ENOENT means "no merge"; every other read failure returns `{ ok: false, reason }` | swallow-guard.test.mjs |
| memory | `brain/scripts/memory/staged-records-check.mjs:339` | surfaced | returned as `{ ok: false, inMerge: true, reason }`, which the check refuses on | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:95` | optional | an lstat probe; absence is answered by the warning and skip that follow (the symlink is the engram adapter's private artifact) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:108` | optional | an lstat probe: an absent .engram is the normal fresh-clone state and the branch below creates it | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:221` | owned | #1154: swallow-ok: an unresolvable directory reads as null, the seam's "not resolvable" answer | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:483` | surfaced | engram's stderr is surfaced in the thrown error — that is the point of this block (#433) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:738` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:856` | surfaced | warned as hydrateDeferred and returned as `{ deferred: true, reason }`; the record is already durable | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:901` | surfaced | warned as hydrateDeferred and returned as `{ deferred: true, reason }`; the record is already durable | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1024` | optional | enrichment is best-effort by contract: never fatal, never required (feature-working-memory-contract.md) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1068` | optional | contract guarantee: an unresolvable feature is informational and exits 0 (feature-working-memory-contract.md) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1093` | optional | an absent resume.md is the documented skeleton-creation case | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1142` | optional | enrichment is best-effort by contract: never fatal, never required (feature-working-memory-contract.md) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1149` | surfaced | a warning line names the offending field; the write proceeds by contract so the file can be fixed by hand | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1239` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1252` | surfaced | collected into `failures` and thrown after the loop (#1127) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1272` | surfaced | collected into `failures` and thrown after the loop (#1127) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1524` | optional | a failed version probe returns null, this seam's documented "version unknown" answer | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1622` | surfaced | returned as an outcome object with `detail`, which the caller reports | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1649` | surfaced | returned as an outcome object with `detail`, which the caller reports | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/engram.mjs:1657` | surfaced | returned as an outcome object with `detail`, which the caller reports | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/plainfiles.mjs:252` | fails | the block throws or exits | the block throws or exits |
| memory | `brain/scripts/axes/memory/adapters/plainfiles.mjs:296` | optional | rg is an accelerant whose output never determines the search result (see search()) | swallow-guard.test.mjs |
| memory | `brain/scripts/axes/memory/adapters/plainfiles.mjs:343` | optional | rg is an accelerant whose output never determines the search result (see search()) | swallow-guard.test.mjs |
| postmerge | `brain/scripts/governance/postmerge/alarm.mjs:78` | fails | the block throws or exits | the block throws or exits |
| postmerge | `brain/scripts/governance/postmerge/cursor.mjs:151` | fails | the block throws or exits | the block throws or exits |
| postmerge | `brain/scripts/governance/postmerge/git-seam.mjs:33` | surfaced | mapped to status -1 with the reason kept; an unmapped status is uncomputable, never a verdict | swallow-guard.test.mjs |
| postmerge | `brain/scripts/governance/postmerge/resolution.mjs:511` | optional | an unreadable blob reads as "every removed line resurrects" — the fail-closed direction | swallow-guard.test.mjs |
| postmerge | `brain/scripts/governance/postmerge/sweep.mjs:198` | surfaced | pushed to archiveErrors: the sweep exits 3 and the workflow files the archive-sweep-failed alarm | swallow-guard.test.mjs |
| postmerge | `brain/scripts/governance/postmerge/sweep.mjs:296` | fails | the block throws or exits | the block throws or exits |
