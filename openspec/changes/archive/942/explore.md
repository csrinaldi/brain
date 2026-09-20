# Explore: #942 — an unreadable brain.config.json empties the approval deny set

## Ground map (measured on `8ec69885`, worktree `brain-issue-942`)

### 1. Inventory of `brain.config.json` readers feeding governance/security decisions

**DENY/exclusion — must fail closed:**
- `brain/scripts/vcs/actor-check.mjs:1096-1104` `defaultReadDenyActors` — `governance.reviewActors ∪ governance.agentActors` via `approvalDenySet()`; `catch { return [] }`. Consumed at `:395-404` (`denyActors.some(...)` guarding the `continue`).
- `brain/scripts/vcs/brain-writes-reviewed.mjs:248-257` `defaultReadBotAllowlist` (`governance.reviewActors`, L6's human-approver exclusion) and `:262-271` `defaultReadApprovalActors` (`governance.approvalActors`). Both `catch { return [] }`.
- `brain/scripts/approve/cli.mjs:116-122` `defaultReadDenyActors` (`approvalDenySet(loadBrainConfig())`, `catch { return [] }`) and `:133-140` `defaultReadAgentActors`. This is the write-side twin `actor-check.mjs`'s docblock (~:1078) warns about — it denies nobody on an unreadable config, so `brain:approve` would let a denied identity post a signed approval. Issue #124 round 2 already fixed these two diverging once.

**ALLOW/exemption — may degrade to empty (safe direction):**
- `actor-check.mjs:1058-1066` `defaultReadBotAllowlist` (`governance.approvalActors`, L5's allow-listed automation).
- `governance/run-check.mjs:164-172`, `brain-check.mjs:52-59`, `brain-audit.mjs:159-166`, `brain-metrics.mjs:121-128`, `vcs/diff-size-count.mjs:91-100` — all read `governance.ignoreList`; empty on failure makes diff-size stricter, not weaker.
- `governance/approved-label.mjs:44-51` — degrades to the default label string.
- `memory/backends/plainfiles.mjs:41-47`, `memory/backends/engram.mjs:448-456`, `memory/lane/collect.mjs:94-100`, `governance/lane-scrub.mjs:53-58` — feed `resolveSecretConfig()` (`memory/lib/secret-scrub.mjs:56-66`); out of scope per #712.

**Ratified defaults (already ruled):**
- `governance-tiers.mjs:517-522` `readConfigSafe` (REQ-TIER-10, degrades to `'standard'`).
- `brain-check.mjs:52-59` `loadFullConfig` (same rationale, stated in its comment).
- `vcs/phase-order-check.mjs:484-491` `defaultReadConfig` — feeds `resolveTier()` only.

**House model (target shape):** `memory/lib/upstream-records.mjs:62-75` `loadBrainConfigAt` — `ENOENT → {}`, anything else throws with a named message. The only reader in the tree that already distinguishes absent from unreadable.

**A second, differently-shaped loader:** `lib/brain-config.mjs:29-43` `loadBrainConfig()` throws on both ENOENT and malformed JSON, with only the message text distinguishing them (no error code). It resolves its path from the module location, not `cwd`. `run-check.mjs`, `governance-tiers.mjs`, `phase-order-check.mjs`, `approved-label.mjs` and `approve/cli.mjs` all consume it and treat any throw as a genuine absence — fine for the ALLOW-direction readers, the exact bug for `approve/cli.mjs`'s deny readers.

### 2. REQUIRED vs DETECTION

`GATE_MATRIX` (`vcs/governance-tiers.mjs:151-235`) plus `governance-checks.mjs:41-84`: at this repo's tier, all 10 `GOVERNANCE_JOBS` are `required`, including `actor-check` and `brain-writes-reviewed` (`governance-tiers.mjs:202-210, 211-218`; `tranche.test.mjs:164` — `DETECTION_JOBS` is empty). `.github/workflows/governance.yml:210-216, 242-248` wire both as their own jobs. `checkContexts('standard')` returns 10 contexts, not eight — `GOVERNANCE_JOBS` grew in #905 with `lane-paths`/`lane-scrub`, neither of which reads a deny list. `governance-relabel.yml:8-26` still labels `actor-check` "DETECTION_JOBS, non-blocking"; that comment is stale, predating Phase 5's promotion. `brain-metrics.mjs`/`brain-audit.mjs` are not CI jobs.

### 3. Refusal surface

`actor-check.mjs` already has the pattern to reuse: `gatherActorCheckInputs` (`:1229-1264`) is called inside `runActorCheck`'s `try` (`:1322-1340`); an uncaught throw is caught there and turned into `{level:'fail', reason: '...failing closed: actor-check is required at the "{tier}" tier...'}` via `resolveTierForFailure` + `resolveGatePolicy`. Making `defaultReadDenyActors` throw would route through this existing tiered fail-closed machinery with no new plumbing.

`brain-writes-reviewed.mjs`'s equivalent catch (`:407-415`) is NOT tier-aware — it unconditionally returns `warn`, and its docstring (`:366-370`) is stale, still claiming "detection-only (DETECTION_JOBS)" though the gate is `required` everywhere. A deny-reader throw here would degrade to a warning, not a refusal; this catch needs the same `resolveGatePolicy`-based branch before a throwing deny reader is safe to land.

`approve/cli.mjs` has its own named pattern: `say('✗ ...'); return done(1)` (`:220-227`), and the deny branch already guards a second reader's throw at the call site (`:246-247`, tested at `approve/cli.test.mjs:252-266`). A hardened reader should throw a descriptive error and let `runApprove` catch it into that same shape — never a raw stack trace in an interactive TTY session.

### 4. Parse-validation gate

No existing check validates that `brain.config.json` parses as a standalone assertion. `check-refs.mjs:133-152` comes closest — it does `readFileSync`/`JSON.parse` with `console.error('✗ brain.config.json is present but unreadable — ...')`, but it is a separate script, not in `run-check.mjs`'s registry and not wired as a governance job. Adding a `config-parses` check costs one new file in the check-function-per-file shape, plus a `GATE_MATRIX` row and a `governance.yml` job (the drift guard in `governance-checks.test.mjs` enforces that both move together).

### 5. i18n

`configUnreadable`/`ConfigUnreadable` keys exist only for `memory.share.*` and `memory.stagedRecordsCheck.*` (`i18n/en.mjs:381,388,397,399`; `i18n/es.mjs:345,346,355,356`) — none for L5/L6. Issue #715 is open and blocking for localization: `t.mjs`'s `activeLang()` resolves the locale via `loadBrainConfig().docs?.language`, which throws on the very unreadable config a refusal message would describe, so it falls back to `'en'`. A new Spanish refusal string for #942 cannot render today — it needs #715's option 2 or 3 first, or the message stays English-only with a documented caveat.

### 6. Test surface / blast radius

Every existing test in `vcs/actor-check.test.mjs`, `vcs/brain-writes-reviewed.test.mjs` and `approve/cli.test.mjs` injects the readers as fakes; the few that exercise the real default reader (`actor-check.test.mjs:1254`, `brain-writes-reviewed.test.mjs:750,787`) always write a VALID `brain.config.json` fixture first. No test drives the present-but-unparseable case through any real reader, and none exercises the real reader against a directory with no `brain.config.json` at all. Any fix must add fixtures for the malformed case and confirm the absent-file case still returns `[]`/`{}`. The tests that would catch a regression are `vcs/actor-check.test.mjs`, `vcs/brain-writes-reviewed.test.mjs`, `approve/cli.test.mjs` and `lib/brain-config.test.mjs`.

### 7. Self-judging property — confirmed

`actor-check.mjs`/`brain-writes-reviewed.mjs` readers take `cwd` from `deps.cwd ?? process.cwd()`, and `governance.yml` runs them after `actions/checkout@v4` with no `working-directory` override — so `cwd` is the PR's own checked-out tree, the one being judged. `approve/cli.mjs` goes through `loadBrainConfig()`, whose path is derived from the module's own location, but that resolves to the same on-disk file when brain lives at `<repo>/brain/` — the property holds there too, less obviously.

### Candidate approaches and open questions

- **Shape**: `actor-check.mjs`'s docblocks (`:1078-1082`, `approvalDenySet`'s comment) are explicit — "Opposite answers to different questions about one identity... may never share a list." A single shared hardened loader risks recreating the R2 violation (#124) if it merges reading behaviour across L5/deny, L6/allow and secret-scrub keys. The safer shape is one shared PRIMITIVE (`loadBrainConfigOrThrow(cwd)` — cwd-parameterized, ENOENT-vs-other-distinguishing, mirroring `upstream-records.mjs`) that each existing reader calls and handles per its own direction: deny readers propagate the throw, allow readers keep swallowing. Not a shared list, not a shared policy function.
- Open: should `brain-writes-reviewed.mjs`'s catch (`:407-415`) get the same `resolveGatePolicy`-based fail-closed branch as a prerequisite, or is that a separate ticket?
- Open: does `approve/cli.mjs`'s twin get fixed in the same PR, given it shares the exact defect but is not in the issue's original evidence?
- Open: is a new refusal message shipped English-only pending #715, or does #942 unblock #715 first?
- Open: does `lib/brain-config.mjs`'s `loadBrainConfig()` get hardened to distinguish ENOENT from malformed, since `approve/cli.mjs` depends on it and needs that distinction?
