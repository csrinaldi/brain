# Explore — #1114 axis selection behind a stable port, with a guard

Measured on `origin/main` (1.11.0+). Paths are under `brain/scripts/` unless noted.

## 1. Offender table re-measured

| # | Row from the issue | Status | Today |
|---|---|---|---|
| 1 | `day-start.mjs:198-227` gentle-ai direct, SDD_ENGINE never resolved | STILL PRESENT | `day-start.mjs:198,204,223,227` (`capture/run('gentle-ai', ...)`); no engine resolution in section 3. ADR-0024 Amendment 2 already admits this |
| 2 | `day-start.mjs:347-368` engram probe, `brain-to-engram.mjs`, 4c export | STILL PRESENT | `day-start.mjs:347` probe, `:358` brain-to-engram, `:362` `engram sync --export`. Owned by #1115 (OPEN) |
| 3 | `session-start.mjs` hardcoded `MEMORY_CLI_ALLOWED_OPS` | STILL PRESENT (reshaped) | `session-start.mjs:89` allowlist; `:292` still calls `memory/cli.mjs import` (engram-only op). #1165 added the undeclared/invalid refusal (`:295-297`) but the op is still caller-picked. #1115 |
| 4 | two `MEMORY_BACKEND` resolvers, different precedence | FIXED | #1165: `memory/lib/backend-resolve.mjs:78` -> `lib/axis-selector.mjs:56`; `memory/cli.mjs:30` imports it. Gone from `harness/cli.mjs` (it resolves engine/harness only) |
| 5 | `harness/platform.mjs` reads `config.platform` (undeclared) then `antigravity` | PARTIAL | Default is now `claude` (`platform.mjs:66`, #1125, ADR-0024 Amend. 2). `config.platform` still read at `platform.mjs:76` and still declared by no migration |
| 6 | `brain-governance-status.mjs` spawns gh/glab | STILL PRESENT | `:66` glab, `:75,156,198` gh; provider branches `:64,138,192,212` |
| 7 | `governance/postmerge/alarm.mjs` gh spawn | STILL PRESENT | `alarm.mjs:44` (`spawnSync('gh', ...)`) |
| 8 | `label-preflight.mjs` / `contributor-scaffold.mjs` import both providers | STILL PRESENT (moved path) | `vcs/label-preflight.mjs:17-18`, `vcs/contributor-scaffold.mjs:40-41` now import `../axes/vcs/adapters/*` (#1141 moved target, not the leak) |
| 9 | `harness/backends/gentle-ai.mjs` spawns `engram search` | MOVED | `axes/sdd-engine/adapters/gentle-ai.mjs:139-146` (`which engram`, `engram search`); #1141 |
| 10 | `run-cold-review-stage.mjs:170` branches on codex/gemini | STILL PRESENT | `review/lib/run-cold-review-stage.mjs:170` unchanged. Owned by #833 |

Counts: FIXED 1, PARTIAL 1 (row 5), MOVED 1, STILL PRESENT 7 (rows 1,2,3,6,7,8,10).
The "best-formed axis" claim for VCS holds: `vcs/cli.mjs:72-78` `resolveProviderName` is its own resolver (VCS_PROVIDER env > config), not routed through axis-selector.

## 2. New offenders (not in the table)

Method: `rg` for tool names as spawn args and for provider/engine literal branches outside `axes/**`, tests, i18n.

True leaks (selection or spawn outside the port):
- `vcs/substrate.mjs:515,596,684,701` provider branches in the substrate rung ladder.
- `vcs/lib/normalize.mjs:36,49,94,98` provider branches (normalization; arguably adapter-owned data).
- `vcs/ci-context.mjs:210-211` `provider === 'github'|'gitlab'` dispatch to `loadGithubContext/loadGitlabContext` (the one seam ADR-0016 sanctions; candidate allowlist entry).
- `governance/approved-label.mjs:32` gitlab branch.
- `approve/cli.mjs:218`, `review/identity.mjs:132` `vcs.PROVIDER === 'gitlab'`.
- `lib/env-init-setup.mjs:54,62,73` provider branches (installer/setup; legitimate-ish, allowlist).
- `harness/codex-readiness.mjs:43,90,99` and `harness/gemini-readiness.mjs:19,49`: engine-named probes spawning `codex`/`gemini` (review-engine axis; belongs to #833 vocabulary).
- `memory/cli.mjs:845` `healBackend !== "engram"`, `memory/lib/audit-io.mjs:69,75` backend name branches: memory axis branching outside the adapter.
- `roles/first-party/project-role.mjs:43` `platform === 'claude'`.
- `harness/platform.mjs:52` `SDD_ENGINES` and `memory/lib/backend-resolve.mjs:20` `MEMORY_BACKENDS`: membership lists, legitimate (they ARE the closed sets).
- `brain-to-engram.mjs:48` spawns `engram` (a verb named for the backend; the whole file is the engram projector, allowlist or move into the adapter via #1115).

Legitimate / noise:
- `harness/producer-forge-reach.mjs:83-84` (names gh/glab to probe credential reach, the point of that file), `lib/hermetic-box.mjs:20` (test box blocklist), `vcs/fixtures/record-fixtures.mjs` (fixture recorder, dev tool), `install-tools.sh`/`bootstrap.sh` (installers must name the tool), `i18n/*`, comments (`memory/cli.mjs:831`, `approve/cli.mjs:214`).

Axes with no hits in the table but present in the tree: review-engine (`axes/review-engine/adapters/{claude,codex,gemini}.mjs`) has adapters but no `resolve` of its own beyond `sdd.map`.

## 3. Resolver and schema state

Resolvers today (none unified):
| Axis | Resolver | Precedence | Default |
|---|---|---|---|
| memory | `memory/lib/backend-resolve.mjs:68` over `lib/axis-selector.mjs:56` | shell > `.env` > config `memory.backend` | none (`undeclared` is a result, refuse) |
| platform | `harness/platform.mjs:75` `resolvePlatform` | env `AGENT_PLATFORM` > envVars > `config.platform` > `SDD_HARNESS` fallback | `claude` |
| sdd engine | `harness/cli.mjs:56` `resolveEngine`, `:83` `resolveHarness` | `SDD_ENGINE` > `SDD_HARNESS` > `config.engine`/`config.harness` | gentle-ai (comment `cli.mjs:24`) |
| vcs | `vcs/cli.mjs:78` `resolveProviderName` | explicit detected provider / `VCS_PROVIDER` > `vcs.provider` | fail closed |
`axis-selector.mjs` has exactly ONE consumer. It is already written for the rest ("SDD_ENGINE and AGENT_PLATFORM are the same shape, #1114", header line 3-4) and has no default by design, whereas platform and engine have defaults. Distance to one `resolveAxis`: the primitive exists and is pure; missing are (a) an axis registry (key, envVar, configPath, allowed, default policy) in one place, (b) migrating 3 resolvers, (c) a ruling on defaults (platform `claude` is deliberate; engine default is a leak of gentle-ai; vcs refuses). Defaults must be data in the registry, not parameters of `resolveAxisSelector`.

Schema (`core/config-migrations.mjs`):
- `vcs.provider` declared (`:43-46`, empty string convention).
- `memory.backend` declared (`:211-223`, #1165, 1.9.1).
- `sdd.map/stages/configs/engines` declared (`:130-163`) but NOT `sdd.engine`.
- `platform` NOT declared; `harness` NOT declared. #643 is OPEN and concerns exactly the `harness` branch of `platformConfig` (`axes/lib/agent-runtime.mjs:240-244`), dead because no schema declares it. Two options per #643 (declare or delete); ADR-0024 owns the ruling.
- #807 (OPEN) is the generic "key read but undeclared" scanner; no such test exists (`rg` finds none; only `vcs/actor-check.test.mjs` mentions it).

## 4. Existing guard patterns (for the new guard)

- `check-refs.mjs` + `brain/project/check-refs-rules.mjs`: line-regex rules, `exempt` paths per rule, no per-entry reason, tracked-file scan. Wrong shape for AST-ish call detection but fine for string patterns.
- `test-spawn-hygiene.test.mjs:1-30` and `test-hygiene.test.mjs`: meta-tests that mask strings/comments, find real call sites and carry an allowlist. This is the closest precedent and solves the false-positive problem by masking before matching.
- Drift guards: `vcs/verb-contract-drift-guard.test.mjs`, `vcs/ci-context-drift-guard.test.mjs`, `axes/vcs/adapters/identity.drift.test.mjs`, `swallow-guard.test.mjs`, `axes/layout.test.mjs` (#1141 layout guard; check whether it already pins adapter dirs).

### Proposed guard shape
- File: `brain/scripts/axes/axis-port.guard.test.mjs` (next to `axes/layout.test.mjs`; runs in `npm test`, so it gates CI with no new wiring).
- Scans `brain/scripts/**/*.mjs` + `brain/core/**/*.mjs`, excluding `axes/*/adapters/**`, `*.test.mjs`, `i18n/**`, `fixtures/**`.
- Detects after masking strings/comments (reuse test-spawn-hygiene masking helper, extract to `lib/` if needed):
  1. spawn call whose first arg literal is in `{engram, gentle-ai, gh, glab, codex, gemini}`;
  2. comparison/switch against a literal in the axis value sets (read the sets from the registry/`MEMORY_BACKENDS`/`SDD_ENGINES`/`AGENT_PLATFORMS`, not retyped; a retyped list is the drift this guard exists to stop);
  3. static import of a concrete adapter path from outside the axis dir.
- Allowlist: `brain/scripts/axes/axis-port.allowlist.mjs`, entries `{ file, rule, reason, owner }` where `owner` is an issue number for debt (`#1115`) or `'legitimate'`. One reason per entry, key by file+rule (NOT line number, lines drift). Test fails on: new unlisted hit, AND stale entry (listed file no longer hits), AND empty reason. Counting per file (`max: N`) freezes debt so it can only shrink.
- Flooding: baseline is frozen in the allowlist at introduction (about 20-25 entries from section 2); i18n/comments/strings are masked, not allowlisted; legit places (resolver, readiness probes, installers) are classified `legitimate` once.

## 5. Slicing (tier lite, budget 1000 excl. tests/openspec/.memory)

| Slice | Content | Owner |
|---|---|---|
| S1 | The guard + allowlist of today's offenders, each with owner issue or reason. Pure test + data; zero behavior change | #1114 |
| S2 | `lib/axis-registry.mjs` + `resolveAxis(name, {...})` over `axis-selector`; migrate `resolvePlatform`, `resolveEngine/Harness`, `resolveProviderName` onto it; defaults declared once. Behavior-preserving, with a ruling needed on engine default and platform fail-closed (issue says not to change silently) | #1114 |
| S3 | Config migration declaring `platform` and `sdd.engine`; resolve #643 (declare, since ADR-0024 implies config selection; delete `harness` branch of `platformConfig`). Absorbs the selector rows of #807 | #1114 (closes #643; coordinate #807) |
| S4 | Per-offender fixes: day-start engine section (new issue or #1115 scope: `day-start` needs an engine verb), day-start memory + session-start ops (#1115 / #864 children), cold-review engine branch and codex/gemini readiness (#833), VCS spawns in `brain-governance-status`/`alarm.mjs` -> `getVcs` verbs (#1107/#1109 or a new VCS ticket), gentle-ai adapter `engram search` (new engine x memory ticket or #1115). Each removal deletes its allowlist entry | other tickets |
| S5 | ADR-0024 Amendment 3 (Tier 2; agent drafts in `brain-drafts/`, human promotes) | #1114 |

S1 first makes debt visible; S2/S3 are independent after S1 (S3 can precede S2 if smaller).

## 6. ADR-0024 "Known state" amendment (what it should say)
- #123 closed 2026-08-13 without clearing it; Amendment 2 recorded that. State of today: resolution is split in four (memory via `axis-selector`; platform, engine, vcs each own resolver); `day-start.mjs` still calls `gentle-ai` (section 3) and `engram` (section 5) directly; `config.platform`/`sdd.engine` undeclared.
- Replace the pointer "#123" with "#1114 owns the cross-axis rule and its guard; per-axis fixes stay with #1115, #833, #1107/#1109, #864".
- Record: the invariant (selection outside the port is a defect), the guard's location and allowlist rule (shrink-only), and that the platform default `claude` and VCS fail-closed are deliberate, not unified.
- Note the stale citation `harness/backends/` -> `axes/<axis>/adapters/` already annotated by #1141.

## Risks / open questions
- Guard over-reach: value-set branches (`=== 'gitlab'`) inside `vcs/substrate.mjs`/`normalize.mjs` are arguably adapter data; allowlist scope needs a maintainer ruling on whether provider branching inside the same axis dir counts.
- Defaults ruling (engine default `gentle-ai`; platform fail-open vs VCS fail-closed) blocks S2 as a pure refactor.
- #807 overlap: do not build two "undeclared key" scanners; S3 should land its keys via the same migration test #807 will add.
