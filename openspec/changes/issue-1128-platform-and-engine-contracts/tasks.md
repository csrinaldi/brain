# Tasks — #1128 + #1129

Strict TDD: in every RED/GREEN pair, the RED test is written and seen failing before the GREEN code.
Run touched tests with `node --test <file>`, and the whole suite with `npm test` at T5. One commit per
numbered group, in slice order (ruling 1). Paths are relative to `brain/scripts/`.

## T0 Pre-apply
- [ ] 0.1 Maintainer answers Q1–Q7 (design "Rulings still open"). The tasks below assume the proposed
      defaults: Q1 `ok:false` on a write throw, Q2 sorted, Q3 re-own to #1128 now and re-point to
      follow-up 2 before the PR, Q4/Q5 accepted, Q6 no shim, Q7 out of scope.
- [ ] 0.2 Maintainer files follow-ups 1–5 (proposal). Record the numbers here. Follow-up 2's number
      feeds 4.9.

## S1 — Descriptors and the registry (shared)
- [ ] 1.1 RED `axes/lib/runtime-registry.test.mjs`: against temp `base` fixtures, cover the missing
      descriptor, duplicate name, malformed shape, `name` ≠ basename, `stage` present without
      `executeStage`, `pinned` without `id`, and dotted helper basenames ignored. Assert that the lists
      are sorted and that the module's import specifiers are all `node:`.
- [ ] 1.2 GREEN `axes/lib/runtime-registry.mjs` (D2): `loadRuntimeRegistry({base})`, `validateDescriptor`,
      `RUNTIME_REGISTRY` (top-level await).
- [ ] 1.3 RED `axes/descriptors.test.mjs`: the five descriptors exist, contain no
      `import`/`export … from`/`await` (source scan), and their capabilities deep-equal today's
      `PLATFORM_CAPABILITIES`. Assert the D1 table's stage/model/readiness values.
- [ ] 1.4 GREEN the five leaves: `axes/platform/adapters/{claude,antigravity,plain}.descriptor.mjs`
      and `axes/review-engine/adapters/{codex,gemini}.descriptor.mjs` (D1).
- [ ] 1.5 RED `axes/lib/harness-adapter-url.test.mjs`: `harnessAdapterDir/Url(…, { base })` resolve
      under a temp base, and the default is unchanged.
- [ ] 1.6 GREEN `axes/lib/harness-adapter-url.mjs` (D4).
- [ ] 1.7 RED `lib/axis-config.test.mjs`: with a registry whose `zed` declares `orchestrate`,
      `validateAxisConfig(…, { registry })` accepts `platform.default: zed`. `resolveAxis('platform',
      { registry, … })` resolves `zed`. `PLATFORM_CAPABILITIES === RUNTIME_REGISTRY.capabilities` and
      `AGENT_PLATFORMS === RUNTIME_REGISTRY.orchestrators`.
- [ ] 1.8 GREEN `lib/axis-config.mjs` (D3): derive both, inject `registry` at `:172`, `:193` and `:358`,
      and replace the seam comment.
- [ ] 1.9 Update pins: `harness/cli.test.mjs:78-83` and `lib/axis-config.test.mjs:78` take the derived
      order (Q2).
- [ ] 1.10 Guard: `axes/axis-port.guard.test.mjs:72-76` `adapterNames` excludes every dotted basename
      (D12). Assert `axisValues()` is unchanged (pin its current value in the test first: RED on the
      `.descriptor.` names).
- [ ] 1.11 `axes/axis-port.allowlist.mjs`: re-own `brain-promote.mjs` adapter-import and
      `roles/first-party/project-role.mjs` axis-branch from `#1114` to `#1128`. Rewrite their reasons
      to name the deferred emit-surface and role-projection vocabulary (ruling 1).
- [ ] 1.12 Run `harness/cli.test.mjs` (the #682 graph walker) and the guard: both green.

## S2 — The review-engine contract (#1129)
- [ ] 2.1 RED `axes/lib/stage-output.test.mjs`: cover `engineTail`'s six steps (a secret straddling
      the 4 KiB window is redacted, control bytes go, the tail is ≤300 characters with `…`),
      `secretValues`, `isWithin('/c','/c/..x') === true`, `canonicalPath` on a non-existent leaf, and
      `validateFinalMessageOutput` messages naming the passed `engine`.
- [ ] 2.2 GREEN `axes/lib/stage-output.mjs` (D6).
- [ ] 2.3 RED `axes/review-engine/contract.test.mjs` (REQ-1129-8, D10) over `stageRuntimes`. (e) is red
      for claude and gemini, and (h) covers codex. Record which cases are characterisation (green on
      arrival).
- [ ] 2.4 GREEN `claude.mjs`: delete `tail`. `engineTail` with scrubbed-name secrets is applied on every
      failure branch, including non-zero (`:292-298`). Update the pin `harness/run-stage.test.mjs:60`.
- [ ] 2.5 GREEN `codex.mjs`: import the helpers from `stage-output.mjs` and delete the copies
      (`:22-78`). `CODEX_MODEL` comes from the descriptor.
- [ ] 2.6 GREEN `gemini.mjs`: same, plus `GEMINI_MODEL` from the descriptor. Re-export
      `canonicalPath`/`isWithin` for this commit only, then move the `gemini.test.mjs` cases to
      `stage-output.test.mjs` and drop the re-export.
- [ ] 2.7 RED `review/lib/run-cold-review-stage.test.mjs`:
      (a) a fake registry declaring `final-message` for an engine named `alpha` yields
      `output.mode === 'final-message'`;
      (b) `engine: 'plain'` is refused before the seam with the previous artifact intact;
      (c) a gemini rename failure reason contains `gemini final message` and not `Codex`;
      (d) the `outputMode` handed to the prompt equals the descriptor's.
- [ ] 2.8 GREEN runner (D5): `deps.registry`, the early refusal, the declared mode, the imported
      `isWithin`, and the strings at `:418` and `:422`. Update the pin `:255-261` → `claude`/`gemini`.
- [ ] 2.9 Allowlist: delete `review/lib/run-cold-review-stage.mjs` axis-branch (the guard reported
      `STALE`).
- [ ] 2.10 RED `harness/readiness.test.mjs`: `resolveStageRoute` covers unrouted, claude (not required),
      codex pin mismatch throws, gemini default model. `checkRouteReadiness` covers claude never
      spawning, and gemini with nothing installed giving `ready:false` and its diagnostic. The CLI's
      `--check`/`--required`/`--engine` are tested on a temp cwd.
- [ ] 2.11 `git mv harness/codex-readiness.mjs axes/review-engine/adapters/codex.readiness.mjs` and the
      same for gemini, plus their tests (`*.readiness.test.mjs`). Then GREEN the leaves (D8): export
      `checkReadiness`, delete the route resolvers, `loadConfig`, `main` and the second `CODEX_MODEL`.
- [ ] 2.12 GREEN `harness/readiness.mjs` (D8).
- [ ] 2.13 RED parity (g) for codex and gemini (`<name>.readiness.mjs` exports `checkReadiness`), then
      green from 2.11.
- [ ] 2.14 `bootstrap.sh:409-418` and `install-tools.sh:139-158` call `harness/readiness.mjs` (D8).
      The shell test that greps bootstrap for the codex call (if any, `rg codex-readiness test/`) is
      updated.
- [ ] 2.15 Update `test/fresh-install/codex-route.e2e.test.mjs:5` to the generic API.
- [ ] 2.16 Allowlist: delete the four `harness/{codex,gemini}-readiness.mjs` entries. The guard is green
      at 24 entries.

## S3 — The agent-platform contract (#1128)
- [ ] 3.1 RED `axes/platform/contract.test.mjs` (REQ-1128-7, D10) over `orchestrators`. (b) is red for
      claude and plain, and (e) is red for antigravity. Export the body as `platformParity(name, loader)`
      for 3.7.
- [ ] 3.2 GREEN `claude.mjs` `init`: `{ok:true}`, and `{ok:false, reason}` on a malformed file or a
      write throw (Q1).
- [ ] 3.3 GREEN `antigravity.mjs` `init`: `ok` plus `reason`, the additive fields kept, and the JSDoc
      rewritten. Update the pins `antigravity.test.mjs:186,305`.
- [ ] 3.4 GREEN `sdd-engine/adapters/plain.mjs` `init` returns `{ok:true}`.
- [ ] 3.5 RED `harness/cli.test.mjs`: a spawned `node harness/cli.mjs init` with `AGENT_PLATFORM=antigravity`
      and a malformed `.gemini/settings.json` (temp `_repoRoot` via env-free fixture repo) exits 1.
      Then GREEN by 3.3. Update the comment at `cli.mjs:252-262`.
- [ ] 3.6 Update any claude test that asserts `init()` resolved `undefined`.
- [ ] 3.7 RED→GREEN `axes/runtime-scaffold.test.mjs` (REQ-1128-8, REQ-1129-9, D11): a third platform
      (`zed`) and a third engine (`zed-engine`) in a temp base. Cover the registry, validate, resolve,
      the platform parity body, the engine parity (a)(d)(f), and `runColdReviewStage` ok. Confirm that
      the commit touches neither `lib/axis-config.mjs`, `roles/first-party/project-role.mjs` nor
      `axes/layout.test.mjs`.

## S4 — Doctrine drafts (no `brain/` writes)
- [x] 4.1 Draft `brain-drafts/agent-platform-contract.md` (new methodology doc, #863 shape).
- [x] 4.2 Draft `brain-drafts/review-engine-contract.md`.
- [x] 4.3 Draft `brain-drafts/adr-0038-amendment-2.draft.md`.
- [x] 4.4 Draft `brain-drafts/adr-0024-amendment-6.draft.md`.
- [x] 4.5 Draft `brain-drafts/adr-0033-amendment-4.draft.md`.
- [x] 4.6 `brain-drafts/README.md` with the promotion order and the `decision-gate` coupling.
- [x] 4.7 `planAmendment()` on the three amendment drafts against `main` `4b847561`: all `ok:true`
      (results in the README).
- [ ] 4.8 Before the PR, re-run 4.7 against `origin/main`, and renumber if an ADR gained an amendment
      meanwhile.
- [ ] 4.9 Re-point the two re-owned allowlist entries to follow-up 2's number if Q3 says so, and update
      the contract draft's "What this does NOT close" to match.

## T5 Gates
- [ ] 5.1 `npm test` green.
- [ ] 5.2 `npm run brain:repo:check` green.
- [ ] 5.3 `git diff --name-only origin/main -- brain/ | rg '\.md$'` is empty (REQ-1128-10).
- [ ] 5.4 Measure the gated diff: `git diff --numstat origin/main...HEAD` minus the ignoreList. Confirm
      it is ≤ 1000, and that the two readiness moves show as renames.

## T6 E2E (evidence to `openspec/changes/issue-1128-platform-and-engine-contracts/evidence/`)
- [ ] 6.1 Scratch consumer from `npm pack` (scratchpad, `BRAIN_HOME` sandboxed):
      `AGENT_PLATFORM=claude node brain/scripts/harness/cli.mjs init` exits 0 and writes
      `.claude/settings.json` (#682 holds with the top-level-await registry).
- [ ] 6.2 Same consumer, three `sdd.map['cold-review']` routes (claude, codex, gemini):
      `harness/readiness.mjs --check` prints the generic line, codex's diagnostic, and gemini's
      diagnostic. `bootstrap.sh`'s readiness section shows the same.
- [ ] 6.3 `AGENT_PLATFORM=antigravity` with a malformed `.gemini/settings.json`: `harness/cli.mjs init`
      exits 1, and the file is unchanged.

## T7 Close-out
- [ ] 7.1 `npm run brain:memory:save -- --issue 1128` with the TLA-registry decision and the `isWithin`
      `..x` gotcha.
- [ ] 7.2 Fresh-context review before push (PR rule). The PR body says `Closes #1128`, `Closes #1129`,
      lists the drafts in README order, and names Q1–Q7's answers.

**Task count per slice:** S1 = 12, S2 = 16, S3 = 7, S4 = 9 (7 done), plus T0 = 2, T5 = 4, T6 = 3,
T7 = 2. Total 55.

## Review Workload Forecast

Changed lines (added + deleted), **excluding** the ignoreList in `brain.config.json`
(`**/*.test.mjs`, `**/*.golden.json`, `.memory/**`, `AGENTS.md`, `openspec/changes/**`,
`openspec/specs/**`, lockfiles). The gate runs `git diff --numstat BASE...HEAD`
(`governance/run-check.mjs:219`). Default rename detection applies, so a `git mv` counts only the edited
lines.

| slice | file | est. |
|---|---|---|
| S1 | `axes/lib/runtime-registry.mjs` (new) | ~85 |
| S1 | 5 × `*.descriptor.mjs` (new) | ~60 |
| S1 | `lib/axis-config.mjs` | ~35 |
| S1 | `axes/lib/harness-adapter-url.mjs` | ~15 |
| S1 | `axes/axis-port.allowlist.mjs` (re-own 2) | ~8 |
| S2 | `axes/lib/stage-output.mjs` (new) | ~85 |
| S2 | `axes/review-engine/adapters/codex.mjs` (−60 copies, +6) | ~66 |
| S2 | `axes/review-engine/adapters/gemini.mjs` (−55 copies, +6) | ~61 |
| S2 | `axes/platform/adapters/claude.mjs` (tail, secrets) | ~30 |
| S2 | `review/lib/run-cold-review-stage.mjs` | ~35 |
| S2 | `codex.readiness.mjs` (rename; −60 route/main, +5) | ~65 |
| S2 | `gemini.readiness.mjs` (rename; −45, +5) | ~50 |
| S2 | `harness/readiness.mjs` (new) | ~95 |
| S2 | `bootstrap.sh` + `install-tools.sh` | ~30 |
| S2 | `axes/axis-port.allowlist.mjs` (−5 entries) | ~10 |
| S3 | `claude.mjs`, `antigravity.mjs`, `sdd-engine/plain.mjs` `init` | ~35 |
| S3 | `harness/cli.mjs` comment | ~12 |
| | **total** | **~717** |

- **Uncertainty:** ±20%, so roughly 575–860. The largest risk is the two readiness moves. If git does
  not pair them as renames (similarity < 50%), they count as 250 deleted + ~100 added, which pushes
  the total to about 900–1000. 5.4 checks this, and the fallback is to keep each leaf's edit minimal so
  the pairing holds.
- **Above 400 (`standard`):** Yes. **Above 1000 (`lite`, `brain.config.json` `governance.tier`):** No.
- **Chained PRs recommended:** **No.** One PR with slice-ordered commits (S1 → S2 → S3 → S4), as ruling
  1 orders. Tests (~1,100–1,400 lines across the parity, scaffold and registry suites) and the drafts
  (~550 lines) are outside the gated count. The doctrine promotion is the maintainer's separate PR
  after merge.
- **Decision needed before apply:** **Yes (Q1–Q7).** None changes the forecast by more than ~20 lines.
  Q2 and Q3 change pinned-test and allowlist text only.
