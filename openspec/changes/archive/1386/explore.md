# Explore: #1386 — day:start must not upgrade global tools

Read-only exploration. No code changed. Nothing was executed against the host.

## 1. What day:start does today

`brain/scripts/day-start.mjs`, step 3 "Ecosystem updates" (lines 198-231). The only tool touched is `gentle-ai`:

| Line | Command | Effect |
|---|---|---|
| 200 | `gentle-ai --version` | probe; if it fails, prints "not available" + `npm run tools:install` and skips |
| 206 | `gentle-ai update` | read-only check; lines containing `[UP]` are the available updates |
| 225 | `gentle-ai upgrade` | **MUTATING**, run via `run()` with `stdio: 'inherit'` (l.64-70). Upgrades every `[UP]` tool gentle-ai manages: engram, gga, skills. This is the engram 2.0.0 -> 3.2.1 jump. |
| 229 | `gentle-ai skill-registry refresh` | writes the local registry; always runs |

Conditions: NONE. No TTY check, no `CI` check, no flag, no env var, no config key. The code prints "N update(s) available", lists `tool installed -> latest` (l.215-223), prints "Applying updates..." (`day.ecosystem.applying`, i18n en.mjs:~53) and upgrades immediately. Exit status of upgrade is only warned about (l.66-69).

Note l.219: `console.log('...%s...', m[1], ...)` mixes template-literal ANSI with printf specifiers inside a template; the `%-20s` args are passed but the first argument is already interpolated, so the version columns likely print oddly. Cosmetic, adjacent bug, out of scope unless the block is rewritten anyway.

Contrast with the sibling steps in the same file, which already do it right:
- Step 4 (l.233-292, brain core version): check-and-notify, prints the command (`day.brain.upgrade`) and `day.brain.noAutoApply`; comment l.233-236 cites the anti-pattern explicitly.
- Step 4b (l.294+, agent runtime): "NEVER runs an update command".
So step 3 is the lone violator of a rule its neighbours cite.

Other verbs that touch global tools:
- `brain/scripts/install-tools.sh` (`tools:install`): INSTALL of missing tools only. gentle-ai: `command -v` guard (l.165-171), else curl|bash installer; `gentle-ai install` only if `gentle-ai doctor` lacks `state file OK` (l.176-184), exactly the anti-pattern's recommended guard. No upgrade of an installed tool.
- `brain/scripts/bootstrap.sh` (`env:init`): checks presence (l.393-400, hint `gentle-ai install`), never upgrades. Calls engram only for hydrate/index when the binary exists (l.863-896). No `upgrade`.
- `brain:upgrade` (`brain-upgrade.mjs`): upgrades brain's own managed paths in the repo; rg found no `gentle-ai`/`engram` upgrade calls in it.
- Only other mention: `harness-contract.md:98` ("maintained with `gentle-ai upgrade`") and `docs/KNOWN-LIMITATIONS.md:219-225` (day:start is hardcoded to gentle-ai, #1114).

Conclusion: day-start.mjs:225 is the single global-upgrade call site in the repo's scripts. Install vs upgrade is already cleanly split everywhere else.

## 2. Existing doctrine and tests

- Anti-pattern `brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md`: records that a gentle-ai subcommand self-updates as a prologue. It is about *accidental* mutation (`install --help`), and its Solution says "invoke install only deliberately". It does not yet say "a routine daily verb must not upgrade a global tool". Candidate for an in-place addition (Tier 3 for agents: draft only).
- `brain/core/methodology/harness-contract.md:29`: day:start row = "Daily startup: VCS auth, ecosystem updates, team memory, ticket board." "ecosystem updates" is ambiguous (check vs apply). Line 98 "maintained with `gentle-ai upgrade`" stays true (the human runs it).
- `openspec/specs/`: no day-start spec. `session-start`, `governance-v3`, `managed-paths-namespace` mention day:start only in passing (rg matched, none states the update step).
- Tests: `brain/scripts/day-start.test.mjs` is a source guard on the lane-sweep block only; NOTHING pins the ecosystem step. `test/bootstrap-smoke/smoke.mjs:90` runs with `CI: '1'` and asserts day:start reaches the literal `6/6` (day-start.mjs l.306-308), so step count must not change.
- `brain/scripts/axes/axis-port.allowlist.mjs:~28`: allowlists `spawn-concrete:gentle-ai` with `max: 4` (owner #1114) for version/update/upgrade/skill-registry. Removing the upgrade spawn lowers actual count to 3; an allowlist ratchet may require lowering `max` to 3 (check the guard test). Adding a new spawn would need it raised.

## 3. Existing opt-in / opt-out

None. rg for `BRAIN_SKIP`, `SKIP_UPDATE`, `autoUpdate`, `isTTY` in non-test scripts found no knob in day-start. TTY detection exists elsewhere as a pattern (`brain-promote.mjs:1071`, `approve/cli.mjs:359`: `Boolean(process.stdin.isTTY)` injected as `ctx.isTTY`, with a non-TTY refusal at brain-promote.mjs:407 / approve/cli.mjs:182).

User layer: `brain/scripts/lib/user-config.mjs` (`readUserConfig`, l.54; dir `${BRAIN_HOME:-~/.brain}`, l.39-46) and `lib/axis-config.mjs:294 validateUserConfig`. It validates only the four axes and IGNORES unknown top-level keys, so a `tools.autoUpdate` key would be tolerated by validation but is not declared anywhere: it needs a documented schema entry. Caveats:
- ADR-0040 s1 frames the layer as per-person selectors ("selectors, never a credential"); a boolean preference is a small stretch, though per-person is exactly right (the tool is machine-global). Probably needs an ADR-0040 amendment line, not a new ADR.
- `setUserDefault` only writes axis defaults; a new writer or a `brain:config`-like verb would be needed for a human to set it conveniently (or just document hand-editing `~/.brain/config.json`).
- Agents must not write the user layer unless asked (agent-authorities Tier 2).
- The team config must NOT hold this key (global-tool policy is per person; a team key would let a PR change what runs on everyone's machine).

Environment alternative: a process env var (e.g. `BRAIN_AUTO_UPDATE=1`) needs no schema and fits CI/scripts, but is invisible/ephemeral for the daily human.

## 4. Approaches

Shared core for all: never upgrade when `process.env.CI` is set or stdin/stdout is not a TTY. The acceptance ("a non-interactive day:start changes no global tool version") is met by every option below.

**A. Report-only by default; upgrade only on explicit opt-in** (`--update` flag on `brain:day:start`, and/or user-layer `tools.autoUpdate: true`; env `BRAIN_AUTO_UPDATE`).
- Default prints "engram 2.0.0 -> 3.2.1 available; run `gentle-ai upgrade`" (the data is already parsed at l.215-223; just drop `run()` and print the command, mirroring step 4's `day.brain.upgrade`/`noAutoApply`).
- Pro: matches the issue's proposal, the anti-pattern, and steps 4/4b. Safe for any repo, scratch consumer, CI, agent. The maintainer's live MCP can never change under a throwaway repo.
- Con: the daily human who liked auto-upgrade must run one extra command or set the key once. Updates may linger (but they are listed every day).
- Opt-in still honors CI/non-TTY refusal (opt-in never overrides non-interactive).

**B. Refuse only non-interactive; keep interactive auto-upgrade.**
- Pro: smallest change (one `isTTY`/`CI` guard around l.224-226), no schema, no doctrine move.
- Con: does NOT fix the incident class. The 2026-10-07 run was an interactive exit run in a scratch consumer, i.e. a TTY; the tool is global, so a human at a TTY in a throwaway repo still upgrades every repo on the machine. Rejects the issue's "opt-in" framing. Weakest option.

**C. Prompt in a TTY (y/N, default N), report-only otherwise.**
- Pro: keeps convenience, informed consent each time, safe non-interactively.
- Con: a prompt in a "daily startup" script is friction and trains reflexive "y"; adds stdin handling (day-start currently has none; needs a readline path and a test seam); agents driving a pty could answer it. Consent is per-run, not per-person. Does not warn that the tool is global unless the text says so.

**A+C hybrid** (report by default; `--update` flag or user key does it without prompting; no prompt anywhere) is simply A. A+ prompt-when-key-is-"ask" would be gold-plating.

Recommendation to put to the maintainer: **A**, with opt-in via flag first (zero schema), and the user-layer key as a second slice only if the maintainer wants a persistent preference. The flag alone gives the daily user a one-word command; the key can follow.

Doctrine:
- harness-contract.md day:start row (l.29): amend wording to "ecosystem update check (reports; applies only on opt-in)". brain/core `*.md` is doctrine: Tier 3 for agents, so the amendment goes in `openspec/changes/issue-1386-.../brain-drafts/` for human promotion (`brain:promote`).
- Anti-pattern doc: optional in-place addendum ("a routine verb must report, never apply, a global upgrade"), same draft channel.
- ADR: not needed for A with a flag (it restores the existing doctrine, step 3 was the deviation). A user-layer key warrants an ADR-0040 amendment (small), since the layer's purpose statement is selectors. No new ADR.

Implementation sketch (for design phase, not done): gate `run('gentle-ai', ['upgrade'])` behind `shouldApply({argv, env, isTTY, userConfig})` as a pure function exported for testing; add en/es i18n keys (replace `day.ecosystem.applying` usage; add `day.ecosystem.runToApply`); add tests (pure decision test + source guard that `'upgrade'` is not reachable without the decision), keep `6/6`; lower allowlist `max` if the ratchet demands; update `docs/KNOWN-LIMITATIONS.md` only if wording about "upgrade" matters (it lists the call). Note `skill-registry refresh` (l.229) is a local write, not a global tool upgrade; keep it unconditional, but flag it as a question.

## 5. Questions for the maintainer (not decided)

1. Approach: A (report-only + opt-in), B, or C? (Recommend A.)
2. Opt-in surface: `--update` flag only, user-layer `tools.autoUpdate`, an env var, or several? If the user layer, is amending ADR-0040 to admit a non-axis preference key acceptable?
3. Should opt-in ever apply under `CI`/non-TTY? (Acceptance suggests never; confirm that the flag cannot override it.)
4. Should `gentle-ai skill-registry refresh` stay unconditional in day:start (it writes locally, not global tool versions)?
5. Should the anti-pattern doc get the "routine verb reports, never applies" addendum, and the harness-contract row be reworded, in this change?
6. Should the incident's lesson also cover `gentle-ai update` itself (confirm it is side-effect-free; the anti-pattern shows gentle-ai prologues can self-update before parsing). Needs a read-only verification by a human on a throwaway machine, not run here.
7. The `%s` formatting glitch at day-start.mjs:219: fix in passing or leave?

## Estimated gated diff (lite budget 1000; tests/openspec/.memory excluded)

- A with flag only: day-start.mjs ~25-35 lines, i18n en+es ~6, allowlist 1 = roughly 40-50 gated lines. Tests (~80) are ignored by the budget.
- + user-layer key: +30-50 (reader + docs); + ADR-0040 amendment and harness-contract/anti-pattern drafts are doctrine drafts under openspec/changes (ignored).
- Far under 1000; single PR, no chaining.
