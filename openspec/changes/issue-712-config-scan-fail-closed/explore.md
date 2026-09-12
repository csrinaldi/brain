# Explore: #712 — an unreadable brain.config.json silently degrades the secret-scan policy

Measured in worktree `brain-issue-712`, base `8ec69885`. Carried forward to
`issue-712-config-scan-fail-closed` on `bef6f867`; re-verify line numbers before relying on them.

## 1. Callers of each loader, and where the scan decision lands

**`collect.mjs:94-99` `_defaultLoadConfig`** — the sole default for `collectLane()`'s `loadConfig` param
(`collect.mjs:204`), called once per run at `collect.mjs:226`: `resolveSecretConfig(loadConfig(root))`.
`collectLane` is reached two ways: directly by `memory:collect` (`cli.mjs:333`, with no outer config gate),
and internally by `shipLane()`'s `collect()` call (`ship.mjs:254`, no `loadConfig` override, so still the
swallowing default). Both `memory:collect` and `memory:ship` reach it for the lane's own secret scan.

**`engram.mjs:451-456` `_defaultLoadBrainConfig`** — three wiring points: `dualWriteRecords()`'s default
at `:266` (config read at `:364`), which has had no production caller since #874 split B; and `save()`'s
default at `:939`, read at `:952`, feeding both `deriveProject(config, root)` (`:954`, benign) and
`resolveSecretConfig(config)` (`:1011`, the scan). `save()` is reached by `memory:save` under
`MEMORY_BACKEND=engram`, dispatched from `cli.mjs:835` with no prior config gate.

**`plainfiles.mjs:41-46`** — the same shape, independently defined, default `_loadConfig` for `save()`
(`:99`), read at `:112`, feeding `deriveProject` and `resolveSecretConfig(config)` at `:213`.

**Asymmetry worth flagging**: `memory:ship`'s CLI wrapper (`cli.mjs:449`) calls the strict, throwing
`loadBrainConfig()` (`lib/brain-config.mjs:29-44`) for `config.project.slug` and `config.governance.tier`
BEFORE `shipLane` runs — so an unparseable config already aborts `ship` at the CLI layer. But that read
targets brain's own `brain.config.json` (path fixed to the module's location, ignoring `root`), not the
`root` that `shipLane` -> `collectLane` scope their own second, independent read against
(`collect.mjs:226`). Two reads of two different files in one `ship` run, one hardened, one not.
`memory:collect` run directly has no outer gate at all.

## 2. What the defaults actually are

`DEFAULT_SECRET_PATTERNS` (`secret-scrub.mjs:22-28`): `ghp_[A-Za-z0-9]{20,}`,
`github_pat_[A-Za-z0-9_]{20,}`, `glpat-[A-Za-z0-9_-]{20,}`, `AKIA[0-9A-Z]{16}`,
`-----BEGIN [A-Z ]*PRIVATE KEY-----`. `DEFAULT_SECRET_ALLOW_PATTERNS` is `[]` (`:31`).
`resolveSecretConfig()` (`:47-65`) computes `[...new Set([...DEFAULT_SECRET_PATTERNS, ...configured])]`
— additive, never a replace.

The audit's claim is verified: the five baseline regexes always run. What is lost on `{}` is exactly
`governance.memorySecretPatterns` (custom detections the operator added because the baseline was
insufficient) and `governance.memorySecretAllowPatterns` (the reviewable allowlist — losing it makes the
scan MORE aggressive, a different-shaped failure than "scan weakened"). Severity: not "scanning off", but
"silently reverts to a baseline the operator explicitly said was insufficient", reported as a clean run.

## 3. Other loaders with the same shape

Feeding a security or governance decision — **all of these were fixed by #942**: `actor-check.mjs`'s
deny readers, `brain-writes-reviewed.mjs`'s, and `approve/cli.mjs`'s write-side twin. #942 established the
rule: a DENY or exclusion reader propagates the failure; an ALLOW or exemption reader may degrade to empty.

Still swallowing, classified by #942's review as allow/exemption-shaped or fail-closed-safe:
`actor-check.mjs:1058` (`approvalActors` -> override labels; empty is stricter), `:1148` (`agentActors`
-> commit exemption; empty is stricter), `:1160` and `brain-writes-reviewed.mjs:296`
(`defaultReadConfig` -> `{}` -> `resolveTier` -> `standard` -> required), `diff-size-count.mjs:94`
(`ignoreList`; empty counts more lines).

Ratified, documented degrades: `governance-tiers.mjs:517-522` `readConfigSafe` (REQ-TIER-10),
`brain-check.mjs:52-59`, `vcs/phase-order-check.mjs:484-491`.

Reporting only, not gates: `brain-metrics.mjs:121-127`, `brain-audit.mjs:159-165`.

**The house model** is now `lib/brain-config.mjs`'s `loadBrainConfigOrThrow(root)`, added by #942:
ENOENT returns `{}`, anything else throws with a named message. `memory/lib/upstream-records.mjs:62-75`
`loadBrainConfigAt()` predates it with the same semantics, plus a third option: `resolveUpstreamRef()`
catches the throw, turns it into a `configError` string that rides on the result, and CONTINUES — the
operator is told without the operation being refused.

## 4. What "fail closed" must mean, per caller

- `memory:save` (both backends) — a write. No outer gate today. A throwing loader would surface through
  `cli.mjs:835`'s existing try/catch as a failure and exit 1. But the same config read also drives
  `deriveProject`, so a throw conflates "cannot gate secrets" with "cannot derive a project name".
- `memory:collect` — writes a local ref only, never publishes; `cli.mjs:324-345` states it "never pushes,
  opens a PR, or is called from a hook". A throw blocks a local commit, not a publish.
- `memory:ship` — the publish path. `shipLane()` has no catch around `collect()` (`ship.mjs:254`); a
  thrown loader reaches `cli.mjs:517-528`, which already has named-reason handling (`raced`, `badHost`),
  so a `configUnreadable`-shaped tag fits the existing pattern.
- `memory:search` and read paths — not examined; a hard throw there blocks reading for something
  structurally different from a publish refusal. Needs its own check before ruling.

## 5. Absent vs unreadable

`loadBrainConfigOrThrow` (#942) and `loadBrainConfigAt` both distinguish them. `loadBrainConfig()`
(`brain-config.mjs:29-44`) throws for both, with only message text separating them.

The i18n family `configUnreadable` / `upstreamConfigUnreadable` exists (`en.mjs:381,388,397,399`;
`es.mjs:345,346,355,356`), wired to the `upstream-records` path. **#715 blocks localization**:
`activeLang()` (`i18n/t.mjs:18`) resolves the locale by reading the very config that is unreadable, so
it falls back to `en` and the Spanish variant of exactly these strings can never render. #942 ruled
English-only with a documented caveat for its own refusal message; the same constraint applies here.

## 6. Test surface

No test in `collect.integration.test.mjs`, `ship.integration.test.mjs`, `ship.test.mjs`,
`cli.collect.test.mjs` or `cli.ship.test.mjs` writes a `brain.config.json` fixture at all — they exercise
the ENOENT branch implicitly through `testTmp()` temp roots. Unit coverage only ever injects a working
`_loadConfig` stub (`engram.duplicates.test.mjs:53`, `plainfiles.save.test.mjs:363,382,397`). The
present-but-unparseable axis is untested for all three loaders.

The template to copy is `upstream-records.test.mjs:277,370-390`: write a `brain.config.json` into a temp
dir and assert the malformed case by name. #942's own tests are a second, newer template.

## 7. Blast radius

If the fix is "ENOENT -> {}, everything else throws", nothing currently green breaks: no test writes a
malformed config against the default path. If it throws on ANY error including ENOENT — wrong, but worth
naming as the trap — every fixture-root test in `collect.integration.test.mjs`,
`ship.integration.test.mjs`, `ship.test.mjs`, `cli.collect.test.mjs`, `cli.ship.test.mjs`,
`plainfiles.save.test.mjs`, `engram.save.test.mjs` and `save-parity.test.mjs` fails on a fresh temp dir.

## Candidate approaches

**A. Reuse `loadBrainConfigOrThrow` (#942) in all three loaders**, letting each caller's existing
try/catch surface it. Cheapest, reuses a primitive already reviewed. Risk: `save()`'s config also drives
`deriveProject`, so one failure blocks both concerns.

**B. Split the read**: a strict read for the secret policy, a best-effort read for the project name.
Precise, but two reads of one file per save.

**C. Report-and-continue** like `resolveUpstreamRef` — a `configError` rides the result, the scan still
runs on defaults, the operator is told — for collect-adjacent paths, with a hard refusal for `ship`'s
publish. Matches the per-operation nuance but ships two remediation shapes in one PR.

## Open questions for the proposal

1. Does `save()`'s single `_loadConfig(root)` call split into a strict secret-policy read and a
   best-effort project-name read, or does one failure block both?
2. Should `memory:ship`'s `collectLane()` call reuse the config its CLI wrapper already loaded, closing
   the two-reads-of-two-files gap, rather than re-reading?
3. Is losing `memorySecretAllowPatterns` — which makes the scan more aggressive, not less — the same
   failure as losing `memorySecretPatterns`, or do they deserve different handling?
4. Does the refusal message ship English-only, following #942's R10 precedent, pending #715?
